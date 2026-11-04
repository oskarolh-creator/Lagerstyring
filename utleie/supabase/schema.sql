-- Utleie (Isaks nettside): database for Supabase.
-- Kjør hele filen i Supabase → SQL Editor i et NYTT Supabase-prosjekt.
-- Filen kan kjøres flere ganger.
--
-- Alle data ligger i én tabell, utleie_items, der hver rad er ett objekt
-- (et produkt, en ordre, en ansatt, en kunde, en lagret handlekurv eller en innstilling).
-- Tilgangsreglene (RLS) under avgjør hvem som ser og endrer hva.

create table if not exists public.utleie_items (
  collection text not null
    check (collection in ('products', 'orders', 'users', 'customers', 'rentalCarts', 'settings')),
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text default lower(auth.jwt() ->> 'email'),
  primary key (collection, id)
);

alter table public.utleie_items enable row level security;
alter table public.utleie_items replica identity full;

-- ---------- Hjelpefunksjoner ----------

create or replace function public.utleie_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.utleie_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from utleie_items
    where collection = 'users'
      and lower(data ->> 'email') = utleie_email()
      and coalesce(data ->> 'state', 'Aktiv') = 'Aktiv'
  ) and utleie_email() <> ''
$$;

create or replace function public.utleie_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from utleie_items
    where collection = 'users'
      and lower(data ->> 'email') = utleie_email()
      and coalesce(data ->> 'state', 'Aktiv') = 'Aktiv'
      and data ->> 'role' = 'Administrator'
  ) and utleie_email() <> ''
$$;

-- Bedrifts-ID for innlogget kunde (både eier og ansatt i bedriften).
create or replace function public.utleie_my_business() returns text
language sql stable security definer set search_path = public as $$
  select nullif(data ->> 'businessId', '') from utleie_items
  where collection = 'customers' and lower(data ->> 'email') = utleie_email()
  limit 1
$$;

-- Bedrifts-ID bare hvis innlogget kunde er eier av bedriftskontoen.
create or replace function public.utleie_owned_business() returns text
language sql stable security definer set search_path = public as $$
  select nullif(data ->> 'businessId', '') from utleie_items
  where collection = 'customers' and lower(data ->> 'email') = utleie_email()
    and data ->> 'accountType' = 'business' and (data ->> 'owner')::boolean is true
  limit 1
$$;

-- ---------- Tilgangsregler ----------

drop policy if exists utleie_select on public.utleie_items;
create policy utleie_select on public.utleie_items for select using (
  collection in ('products', 'settings')
  or utleie_is_staff()
  or (collection = 'customers' and (
        lower(data ->> 'email') = utleie_email()
        or (data ->> 'businessId') = utleie_owned_business()))
  or (collection = 'orders' and (
        lower(data ->> 'customerEmail') = utleie_email()
        or (data ->> 'businessId') = utleie_owned_business()))
);

drop policy if exists utleie_insert on public.utleie_items;
create policy utleie_insert on public.utleie_items for insert with check (
  (utleie_is_staff() and (collection <> 'users' or utleie_is_admin()))
  or (collection = 'customers' and lower(data ->> 'email') = utleie_email() and utleie_email() <> '')
  or (collection = 'orders' and lower(data ->> 'customerEmail') = utleie_email() and utleie_email() <> '')
);

drop policy if exists utleie_update on public.utleie_items;
create policy utleie_update on public.utleie_items for update
using (
  (utleie_is_staff() and (collection <> 'users' or utleie_is_admin()))
  or (collection = 'customers' and lower(data ->> 'email') = utleie_email())
)
with check (
  (utleie_is_staff() and (collection <> 'users' or utleie_is_admin()))
  or (collection = 'customers' and lower(data ->> 'email') = utleie_email())
);

drop policy if exists utleie_delete on public.utleie_items;
create policy utleie_delete on public.utleie_items for delete using (
  (utleie_is_staff() and (collection <> 'users' or utleie_is_admin()))
  or (collection = 'customers'
      and data ->> 'accountType' = 'business-employee'
      and (data ->> 'businessId') = utleie_owned_business())
);

-- ---------- Vern mot at kunder endrer felt de ikke skal ----------

create or replace function public.utleie_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := utleie_email();
  own jsonb;
  biz text;
  new_data_snapshot jsonb;
begin
  new.updated_at := now();
  -- Serveren (service role), SQL Editor og ansatte kan skrive fritt innenfor tilgangsreglene.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or utleie_is_staff() then
    return new;
  end if;

  if new.collection = 'customers' then
    if tg_op = 'INSERT' then
      if new.data ->> 'accountType' not in ('private', 'business') then
        raise exception 'Ugyldig kontotype';
      end if;
      biz := case when new.data ->> 'accountType' = 'business' then nullif(new.data ->> 'businessId', '') end;
      if new.data ->> 'accountType' = 'business' and (biz is null or exists (
          select 1 from utleie_items where collection = 'customers' and data ->> 'businessId' = biz)) then
        raise exception 'Ugyldig bedrifts-ID';
      end if;
      new.id := me;
      new.data := jsonb_build_object(
        'accountType', new.data ->> 'accountType',
        'name', coalesce(new.data ->> 'name', ''),
        'businessName', coalesce(new.data ->> 'businessName', ''),
        'email', me,
        'phone', coalesce(new.data ->> 'phone', ''),
        'address', coalesce(new.data ->> 'address', ''),
        'orgNumber', coalesce(new.data ->> 'orgNumber', ''),
        'businessId', coalesce(biz, ''),
        'owner', new.data ->> 'accountType' = 'business'
      );
    else
      -- Kunden kan bare endre egne kontaktopplysninger, og fjerne kravet om nytt passord.
      new_data_snapshot := new.data;
      new.id := old.id;
      new.data := old.data
        || jsonb_strip_nulls(jsonb_build_object(
             'name', new.data -> 'name',
             'phone', new.data -> 'phone',
             'address', new.data -> 'address',
             'businessName', case when old.data ->> 'accountType' = 'business' then new.data -> 'businessName' end));
      if not (coalesce(new_data_snapshot, '{}'::jsonb) ? 'mustChangePassword') then
        new.data := new.data - 'mustChangePassword';
      end if;
    end if;
    return new;
  end if;

  if new.collection = 'orders' and tg_op = 'INSERT' then
    select data into own from utleie_items
      where collection = 'customers' and lower(data ->> 'email') = me limit 1;
    if own is null then
      raise exception 'Fant ikke kundekontoen';
    end if;
    new.data := new.data || jsonb_build_object(
      'customerEmail', me,
      'status', 'Forespørsel',
      'invoice', '',
      'invoiceStatus', '',
      'nonPaying', false,
      'businessId', case when nullif(new.data ->> 'businessId', '') is not null
                         then coalesce(own ->> 'businessId', '') else '' end
    );
    return new;
  end if;

  raise exception 'Ingen tilgang';
end $$;

drop trigger if exists utleie_guard on public.utleie_items;
create trigger utleie_guard before insert or update on public.utleie_items
  for each row execute function public.utleie_guard();

-- ---------- Offentlige oppslag uten personopplysninger ----------

-- Opptatte perioder per produkt, slik at katalogen kan vise ledig antall.
create or replace function public.utleie_public_bookings() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id,
    'status', data ->> 'status',
    'itemId', data -> 'itemId', 'qty', data -> 'qty', 'from', data -> 'from', 'to', data -> 'to',
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('itemId', i -> 'itemId', 'qty', i -> 'qty', 'from', i -> 'from', 'to', i -> 'to'))
      from jsonb_array_elements(case when jsonb_typeof(data -> 'items') = 'array' then data -> 'items' else '[]'::jsonb end) i
    ), '[]'::jsonb),
    '_public', true
  )
  from utleie_items
  where collection = 'orders'
    and coalesce(data ->> 'status', '') not in ('Returnert', 'Avbestilt', 'Forespørsel')
$$;

-- Aktive ansatte til «Om oss»-siden (bare det som er ment å vises offentlig).
create or replace function public.utleie_public_staff() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', data -> 'name', 'role', data -> 'role', 'state', data -> 'state', 'photo', data -> 'photo',
    'publicTitle', data -> 'publicTitle', 'publicEmail', data -> 'publicEmail', 'publicPhone', data -> 'publicPhone',
    'bio', data -> 'bio', 'email', '', '_public', true)
  from utleie_items
  where collection = 'users' and coalesce(data ->> 'state', 'Aktiv') = 'Aktiv'
$$;

grant usage on schema public to anon, authenticated;
grant select on public.utleie_items to anon;
grant select, insert, update, delete on public.utleie_items to authenticated;
grant execute on function public.utleie_public_bookings() to anon, authenticated;
grant execute on function public.utleie_public_staff() to anon, authenticated;

-- Sanntid: ansatte ser hverandres endringer uten å laste siden på nytt.
do $$ begin
  alter publication supabase_realtime add table public.utleie_items;
exception when duplicate_object then null; when undefined_object then null;
end $$;
