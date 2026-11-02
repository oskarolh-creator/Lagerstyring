-- Oppdatering 2: redigerbare kategorier, lån/faktura på utlån.
-- Kjør hele filen i Supabase -> SQL Editor. Trygt å kjøre flere ganger.

-- ============ Kategorier ============
create table if not exists public.categories (
  name text primary key,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into public.categories (name, sort_order) values
  ('Stoler', 10), ('Bord', 20), ('Sofaer og lounge', 30), ('Barer', 40),
  ('Planter og trær', 50), ('Bannere og skilt', 60), ('Gjerder og avsperring', 70),
  ('Telt', 80), ('Lys og teknikk', 90), ('Dekor', 100), ('Annet', 999)
on conflict (name) do nothing;

-- Ta med kategorier som allerede er brukt på varer.
insert into public.categories (name)
select distinct category from public.items where category <> ''
on conflict (name) do nothing;

alter table public.categories enable row level security;
drop policy if exists "kategorier lesbar" on public.categories;
create policy "kategorier lesbar" on public.categories
  for select to authenticated using (true);
drop policy if exists "admin styrer kategorier" on public.categories;
create policy "admin styrer kategorier" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Når en kategori får nytt navn, oppdateres varene også.
alter table public.items drop constraint if exists items_category_fkey;
alter table public.items
  add constraint items_category_fkey foreign key (category)
  references public.categories(name) on update cascade on delete restrict;

-- ============ Lån eller faktura ============
alter table public.loans add column if not exists loan_type text not null default 'lan';
alter table public.loans drop constraint if exists loans_loan_type_check;
alter table public.loans add constraint loans_loan_type_check check (loan_type in ('lan', 'faktura'));
alter table public.loans add column if not exists invoice_to text not null default '';
alter table public.loans add column if not exists invoice_email text not null default '';
alter table public.loans add column if not exists invoiced_at timestamptz;

create index if not exists loans_invoice_idx on public.loans(loan_type, invoiced_at);
