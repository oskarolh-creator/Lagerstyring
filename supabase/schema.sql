-- Lagerstyring: database-oppsett for Supabase.
-- Kjør hele filen i Supabase -> SQL Editor -> New query -> Run.

-- ============ Brukere og roller ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'ansatt' check (role in ('admin', 'ansatt')),
  created_at timestamptz not null default now()
);

-- Lag profil automatisk når en bruker opprettes.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============ Varer ============
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Annet',
  description text not null default '',
  total_qty integer not null default 0 check (total_qty >= 0),
  zone text not null default '',   -- f.eks. "A" eller "Hall 2"
  rack text not null default '',   -- reol, f.eks. "12"
  shelf text not null default '',  -- hylle/nivå, f.eks. "3"
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ Utlån ============
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  returned_qty integer not null default 0 check (returned_qty >= 0),
  lent_by uuid not null default auth.uid() references public.profiles(id),
  borrower_name text not null,
  borrower_company text not null default '',
  borrower_phone text not null default '',
  start_date date not null default current_date,
  due_date date not null,
  description text not null default '',
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint returned_le_quantity check (returned_qty <= quantity),
  constraint due_after_start check (due_date >= start_date)
);

create index if not exists loans_item_idx on public.loans(item_id);
create index if not exists loans_open_idx on public.loans(item_id) where returned_qty < quantity;

-- Varer med utregnet tilgjengelig antall.
create or replace view public.items_with_availability
with (security_invoker = true) as
select i.*,
  coalesce(sum(l.quantity - l.returned_qty) filter (where l.returned_qty < l.quantity), 0)::int as out_qty,
  (i.total_qty - coalesce(sum(l.quantity - l.returned_qty) filter (where l.returned_qty < l.quantity), 0))::int as available_qty
from public.items i
left join public.loans l on l.item_id = i.id
group by i.id;

-- Stopp utlån av flere enn det som er tilgjengelig.
create or replace function public.check_loan_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avail integer;
begin
  perform 1 from public.items where id = new.item_id for update;
  select i.total_qty - coalesce(sum(l.quantity - l.returned_qty), 0)
    into avail
  from public.items i
  left join public.loans l on l.item_id = i.id and l.returned_qty < l.quantity and l.id <> new.id
  where i.id = new.item_id
  group by i.id;
  if new.quantity - new.returned_qty > avail then
    raise exception 'Bare % tilgjengelig av denne varen', avail;
  end if;
  return new;
end $$;

drop trigger if exists loans_check_availability on public.loans;
create trigger loans_check_availability
  before insert or update of quantity, item_id on public.loans
  for each row execute function public.check_loan_availability();

-- Sett returned_at når alt er levert tilbake.
create or replace function public.set_returned_at()
returns trigger language plpgsql as $$
begin
  if new.returned_qty >= new.quantity and new.returned_at is null then
    new.returned_at := now();
  elsif new.returned_qty < new.quantity then
    new.returned_at := null;
  end if;
  return new;
end $$;

drop trigger if exists loans_set_returned_at on public.loans;
create trigger loans_set_returned_at
  before insert or update on public.loans
  for each row execute function public.set_returned_at();

-- ============ Tilgangsregler (RLS) ============
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.loans enable row level security;

drop policy if exists "profiles lesbar for innloggede" on public.profiles;
create policy "profiles lesbar for innloggede" on public.profiles
  for select to authenticated using (true);
drop policy if exists "admin endrer profiler" on public.profiles;
create policy "admin endrer profiler" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "varer lesbar for innloggede" on public.items;
create policy "varer lesbar for innloggede" on public.items
  for select to authenticated using (true);
drop policy if exists "admin legger til varer" on public.items;
create policy "admin legger til varer" on public.items
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admin endrer varer" on public.items;
create policy "admin endrer varer" on public.items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin sletter varer" on public.items;
create policy "admin sletter varer" on public.items
  for delete to authenticated using (public.is_admin());

drop policy if exists "utlan lesbar for innloggede" on public.loans;
create policy "utlan lesbar for innloggede" on public.loans
  for select to authenticated using (true);
drop policy if exists "innloggede registrerer utlan" on public.loans;
create policy "innloggede registrerer utlan" on public.loans
  for insert to authenticated with check (lent_by = auth.uid());
drop policy if exists "innloggede registrerer retur" on public.loans;
create policy "innloggede registrerer retur" on public.loans
  for update to authenticated using (true) with check (true);
drop policy if exists "admin sletter utlan" on public.loans;
create policy "admin sletter utlan" on public.loans
  for delete to authenticated using (public.is_admin());

-- ============ Bilder ============
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "admin laster opp bilder" on storage.objects;
create policy "admin laster opp bilder" on storage.objects
  for insert to authenticated with check (bucket_id = 'item-images' and public.is_admin());
drop policy if exists "admin endrer bilder" on storage.objects;
create policy "admin endrer bilder" on storage.objects
  for update to authenticated using (bucket_id = 'item-images' and public.is_admin());
drop policy if exists "admin sletter bilder" on storage.objects;
create policy "admin sletter bilder" on storage.objects
  for delete to authenticated using (bucket_id = 'item-images' and public.is_admin());
