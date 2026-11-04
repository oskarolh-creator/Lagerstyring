// Gir nettleseren adressen og den offentlige nøkkelen til Supabase.
// Begge er ment å være offentlige; tilgangen styres av reglene i databasen.
const env = require('./_env');

module.exports = (req, res) => {
  const url = env.supabaseUrl();
  const anonKey = env.anonKey();
  res.setHeader('Cache-Control', 'no-store');
  if (!url || !anonKey) {
    res.status(500).json({
      error:
        'Supabase er ikke koblet til. Legg inn SUPABASE_URL og SUPABASE_ANON_KEY i Vercel (Settings → Environment Variables).',
    });
    return;
  }
  res.status(200).json({ url, anonKey });
};
