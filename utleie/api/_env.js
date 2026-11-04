// Leser Supabase-oppsettet fra miljøvariablene i Vercel.
// Støtter både navnene Supabase-integrasjonen i Vercel lager og de vanlige navnene.
const pick = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim());

module.exports = {
  supabaseUrl: () => pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
  anonKey: () =>
    pick(
      'SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ),
  serviceKey: () => pick('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
};
