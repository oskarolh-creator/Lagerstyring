-- Gjør én person til administrator på utleiesiden.
-- 1) Opprett først brukeren i Supabase → Authentication → Users → «Add user»
--    (fyll inn e-post og passord, og huk av for «Auto Confirm User»).
-- 2) Bytt ut e-post og navn under, og kjør filen i SQL Editor.
-- Etterpå kan administratoren legge til flere ansatte selv under «Brukere» på siden.

insert into public.utleie_items (collection, id, data)
values (
  'users',
  lower('isak@eksempel.no'),
  jsonb_build_object(
    'email', lower('isak@eksempel.no'),
    'name', 'Isak',
    'role', 'Administrator',
    'state', 'Aktiv',
    'canApproveInvoices', true
  )
)
on conflict (collection, id) do update set data = excluded.data;
