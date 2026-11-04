// Oppgaver som krever servernøkkelen til Supabase:
//  - administrator oppretter en ansatt med passord          (action: "create-staff")
//  - administrator eller bedriftseier oppretter bedriftsansatt (action: "create-subaccount")
//  - administrator gir en kunde et midlertidig passord        (action: "reset-password")
const { createClient } = require('@supabase/supabase-js');
const env = require('./_env');

const fail = (res, status, error) => res.status(status).json({ error });

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function findAuthUser(admin, email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function rowByEmail(admin, collection, email) {
  const { data, error } = await admin
    .from('utleie_items')
    .select('id,data')
    .eq('collection', collection)
    .eq('data->>email', email)
    .limit(1);
  if (error) throw error;
  return data[0] || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Bruk POST');
  const url = env.supabaseUrl();
  const serviceKey = env.serviceKey();
  if (!url || !serviceKey)
    return fail(res, 500, 'SUPABASE_SERVICE_ROLE_KEY mangler i Vercel. Se README for oppsett.');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return fail(res, 401, 'Du må være logget inn');
    const { data: who, error: whoErr } = await admin.auth.getUser(token);
    if (whoErr || !who?.user?.email) return fail(res, 401, 'Du må være logget inn');
    const me = who.user.email.toLowerCase();

    const staff = await rowByEmail(admin, 'users', me);
    const isAdmin = staff && (staff.data.state || 'Aktiv') === 'Aktiv' && staff.data.role === 'Administrator';

    const body = await readBody(req);
    const action = body.action;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Ugyldig e-postadresse');
    if (password.length < 8) return fail(res, 400, 'Passordet må ha minst 8 tegn');

    if (action === 'create-staff') {
      if (!isAdmin) return fail(res, 403, 'Administratorrolle kreves');
      const existing = await findAuthUser(admin, email);
      if (existing) return res.status(200).json({ ok: true, existing: true });
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: String(body.name || '') },
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'create-subaccount') {
      const businessId = String(body.businessId || '');
      const { data: companies, error: cErr } = await admin
        .from('utleie_items')
        .select('data')
        .eq('collection', 'customers')
        .eq('data->>businessId', businessId)
        .eq('data->>accountType', 'business')
        .limit(1);
      if (cErr) throw cErr;
      const company = companies[0]?.data;
      if (!businessId || !company) return fail(res, 404, 'Fant ikke bedriftskontoen');
      const isOwner = (company.email || '').toLowerCase() === me && company.owner;
      if (!isAdmin && !isOwner) return fail(res, 403, 'Bare bedriftseier eller administrator kan legge til ansatte');
      if ((await rowByEmail(admin, 'users', email)) || (await rowByEmail(admin, 'customers', email)) || (await findAuthUser(admin, email)))
        return fail(res, 409, 'E-postadressen er allerede i bruk.');
      const { error: aErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (aErr) throw aErr;
      const record = {
        accountType: 'business-employee',
        name: String(body.name || '').trim(),
        email,
        phone: String(body.phone || '').trim(),
        address: company.address || '',
        businessName: company.businessName || company.name || '',
        businessId,
        parentEmail: company.email,
        owner: false,
      };
      const { error: iErr } = await admin.from('utleie_items').insert({ collection: 'customers', id: email, data: record, updated_by: me });
      if (iErr) throw iErr;
      return res.status(200).json({ ok: true, record });
    }

    if (action === 'reset-password') {
      if (!isAdmin) return fail(res, 403, 'Administratorrolle kreves');
      const user = await findAuthUser(admin, email);
      if (!user) return fail(res, 404, 'Kunden har ingen innlogging ennå');
      const { error } = await admin.auth.admin.updateUserById(user.id, { password });
      if (error) throw error;
      const row = await rowByEmail(admin, 'customers', email);
      if (row) {
        const { error: uErr } = await admin
          .from('utleie_items')
          .update({ data: { ...row.data, mustChangePassword: true }, updated_by: me })
          .eq('collection', 'customers')
          .eq('id', row.id);
        if (uErr) throw uErr;
      }
      return res.status(200).json({ ok: true });
    }

    return fail(res, 400, 'Ukjent handling');
  } catch (err) {
    return fail(res, 500, err?.message || 'Noe gikk galt');
  }
};
