// Kobler utleiesiden til Supabase: innlogging, lasting og lagring av data, og sanntid.
// Siden selv (index.html) jobber fortsatt med vanlige lister i minnet. Denne fila
// laster listene fra databasen og lagrer bare det som er endret når siden kaller save().
(function () {
  const LISTS = ['products', 'orders', 'users', 'customers', 'rentalCarts'];
  const SETTINGS = ['categories', 'followupReasons', 'followupStatuses', 'siteSettings'];
  const NEWEST_FIRST = new Set(['orders', 'rentalCarts']);

  let sb = null;
  let session = null;
  let staffMode = false;
  const synced = new Map(); // "samling|id" -> JSON slik det ligger i databasen
  let saveTimer = null;
  let queue = Promise.resolve();
  let busy = 0;
  let pendingRender = false;
  let recovery = false;
  let hooks = null; // settes av siden: { get(), set(state), render(), toast(msg), isEditing() }

  const key = (c, id) => c + '|' + id;
  const idOf = (c, item) =>
    c === 'users' || c === 'customers' ? String(item?.email || '').trim().toLowerCase() : String(item?.id || '');
  const strip = (item) => {
    if (!item || typeof item !== 'object') return item;
    const { _public, ...rest } = item;
    return rest;
  };

  async function loadConfig() {
    if (window.UTLEIE_CONFIG?.url) return window.UTLEIE_CONFIG;
    const res = await fetch('/api/config', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) throw new Error(body.error || 'Fant ikke Supabase-oppsettet');
    return body;
  }

  async function selectAll() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('utleie_items')
        .select('collection,id,data,created_at')
        .order('created_at', { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  // Leser alt den innloggede har tilgang til og bygger tilstanden siden bruker.
  async function loadState() {
    const rows = await selectAll();
    synced.clear();
    const state = { settings: {} };
    LISTS.forEach((c) => (state[c] = []));
    for (const row of rows) {
      synced.set(key(row.collection, row.id), JSON.stringify(row.data));
      if (row.collection === 'settings') state.settings[row.id] = row.data?.value;
      else state[row.collection]?.push(row.data);
    }
    NEWEST_FIRST.forEach((c) => state[c].reverse());
    const email = (session?.user?.email || '').toLowerCase();
    staffMode = state.users.some((u) => idOf('users', u) === email && (u.state || 'Aktiv') === 'Aktiv');
    if (!staffMode) {
      // Kunder og besøkende ser ikke andres ordre, bare når utstyr er opptatt.
      const [bookings, staff] = await Promise.all([
        sb.rpc('utleie_public_bookings'),
        sb.rpc('utleie_public_staff'),
      ]);
      if (bookings.error) throw bookings.error;
      if (staff.error) throw staff.error;
      const own = new Set(state.orders.map((o) => o.id));
      state.orders.push(...bookings.data.filter((o) => !own.has(o.id)));
      state.users = staff.data;
    }
    return state;
  }

  function currentLists() {
    const s = hooks.get();
    const out = {};
    LISTS.forEach((c) => (out[c] = s[c] || []));
    out.settings = {};
    SETTINGS.forEach((k) => (out.settings[k] = s[k]));
    return out;
  }

  // Finner det som er endret siden sist og skriver det til databasen.
  async function flush() {
    if (!sb || !hooks) return;
    const lists = currentLists();
    const wanted = new Map();
    for (const c of LISTS) {
      for (const item of lists[c]) {
        if (!item || item._public) continue;
        const id = idOf(c, item);
        if (!id) continue;
        wanted.set(key(c, id), { collection: c, id, item, json: JSON.stringify(strip(item)) });
      }
    }
    for (const k of SETTINGS) {
      if (lists.settings[k] === undefined) continue;
      const data = { value: lists.settings[k] };
      wanted.set(key('settings', k), { collection: 'settings', id: k, data, json: JSON.stringify(data) });
    }
    const errors = [];
    for (const [k, w] of wanted) {
      const before = synced.get(k);
      if (before === w.json) continue;
      if (w.collection === 'settings' && !staffMode) continue;
      const data = w.data || JSON.parse(w.json);
      let error;
      if (before === undefined) {
        ({ error } = await sb.from('utleie_items').insert({ collection: w.collection, id: w.id, data }));
        if (error?.code === '23505' && w.collection === 'orders') {
          // Noen andre tok samme ordrenummer samtidig: velg neste ledige og prøv igjen.
          const next = await nextOrderId();
          w.item.id = next;
          data.id = next;
          ({ error } = await sb.from('utleie_items').insert({ collection: 'orders', id: next, data }));
          if (!error) {
            synced.set(key('orders', next), JSON.stringify(data));
            continue;
          }
        }
      } else {
        ({ error } = await sb.from('utleie_items').update({ data }).eq('collection', w.collection).eq('id', w.id));
      }
      if (error) errors.push(error);
      else synced.set(k, JSON.stringify(data));
    }
    for (const k of [...synced.keys()]) {
      if (wanted.has(k)) continue;
      const [collection, ...rest] = k.split('|');
      const id = rest.join('|');
      if (collection === 'settings') continue;
      const { error } = await sb.from('utleie_items').delete().eq('collection', collection).eq('id', id);
      if (error) errors.push(error);
      else synced.delete(k);
    }
    if (errors.length) {
      console.error('Lagring feilet', errors);
      hooks.toast('Noe ble ikke lagret: ' + (errors[0].message || 'ukjent feil'));
    }
  }

  async function nextOrderId() {
    const { data } = await sb.from('utleie_items').select('id').eq('collection', 'orders');
    const local = hooks.get().orders.map((o) => o.id);
    const nums = [...(data || []).map((r) => r.id), ...local]
      .map((id) => Number(String(id).match(/^ORD-(\d+)$/)?.[1] || 0));
    return 'ORD-' + (Math.max(2049, ...nums) + 1);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      busy++;
      queue = queue
        .then(flush)
        .catch((e) => {
          console.error(e);
          hooks?.toast('Kunne ikke lagre: ' + (e.message || e));
        })
        .finally(() => busy--);
    }, 250);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    busy++;
    queue = queue.then(flush).finally(() => busy--);
    return queue;
  }

  // Endringer fra andre (ansatte på andre maskiner) kommer inn her.
  function applyRemote(payload) {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : null;
    const old = payload.old || {};
    const collection = row?.collection || old.collection;
    const id = row?.id || old.id;
    if (!collection || !id) return;
    const k = key(collection, id);
    const s = hooks.get();
    if (payload.eventType === 'DELETE') {
      if (!synced.has(k)) return;
      synced.delete(k);
      if (collection !== 'settings') s[collection] = (s[collection] || []).filter((x) => idOf(collection, x) !== id);
    } else {
      const json = JSON.stringify(row.data);
      if (synced.get(k) === json) return;
      synced.set(k, json);
      if (collection === 'settings') s[id] = row.data?.value;
      else {
        const list = s[collection] || [];
        const i = list.findIndex((x) => idOf(collection, x) === id);
        if (i >= 0) list[i] = row.data;
        else if (NEWEST_FIRST.has(collection)) list.unshift(row.data);
        else list.push(row.data);
        s[collection] = list;
      }
    }
    hooks.set(s);
    requestRender();
  }

  function requestRender() {
    if (hooks.isEditing()) {
      pendingRender = true;
      return;
    }
    pendingRender = false;
    hooks.render();
  }

  let channel = null;
  function subscribe() {
    if (channel) sb.removeChannel(channel);
    channel = sb
      .channel('utleie-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'utleie_items' }, applyRemote)
      .subscribe();
  }

  async function api(action, body) {
    const { data } = await sb.auth.getSession();
    const res = await fetch('/api/admin-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (data.session?.access_token || ''),
      },
      body: JSON.stringify({ action, ...body }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Noe gikk galt');
    return out;
  }

  function authMessage(error) {
    const m = String(error?.message || '');
    if (/invalid login/i.test(m)) return 'E-post eller passord er feil.';
    if (/not confirmed/i.test(m)) return 'Du må bekrefte e-postadressen din først. Se etter en e-post fra oss.';
    if (/already registered|already exists/i.test(m)) return 'Det finnes allerede en konto med denne e-postadressen.';
    if (/rate limit/i.test(m)) return 'For mange forsøk. Vent litt og prøv igjen.';
    if (/password/i.test(m)) return 'Passordet er ikke godt nok. Bruk minst 8 tegn.';
    return m || 'Noe gikk galt. Prøv igjen.';
  }

  // Lager kundeposten etter at kunden har bekreftet e-posten (profilen ligger i brukerens metadata).
  async function ensureCustomerRecord(state) {
    const email = (session?.user?.email || '').toLowerCase();
    if (!email || staffMode) return state;
    if (state.customers.some((c) => idOf('customers', c) === email)) return state;
    const profile = session.user.user_metadata?.utleieProfile;
    if (!profile) return state;
    const { error } = await sb.from('utleie_items').insert({ collection: 'customers', id: email, data: { ...profile, email } });
    if (error) {
      console.error(error);
      return state;
    }
    return loadState();
  }

  async function reload() {
    let state = await loadState();
    state = await ensureCustomerRecord(state);
    hooks.set(state);
    return state;
  }

  window.UtleieBackend = {
    get staffMode() {
      return staffMode;
    },
    get busy() {
      return busy > 0;
    },
    get session() {
      return session;
    },
    // true når siden ble åpnet fra en «Glemt passord»-lenke.
    get recovery() {
      return recovery;
    },
    flushPendingRender() {
      if (pendingRender) requestRender();
    },
    async boot(h) {
      hooks = h;
      const cfg = await loadConfig();
      sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      let booted = false;
      sb.auth.onAuthStateChange((event, s) => {
        session = s;
        if (event !== 'PASSWORD_RECOVERY') return;
        // Kommer fra «Glemt passord»-lenken i e-posten.
        if (booted) hooks.onPasswordRecovery?.();
        else recovery = true;
      });
      const { data } = await sb.auth.getSession();
      session = data.session;
      if (/type=recovery/.test(location.hash)) recovery = true;
      const state = await reload();
      subscribe();
      booted = true;
      window.addEventListener('beforeunload', (e) => {
        if (busy > 0 || saveTimer) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
      return state;
    },
    save: scheduleSave,
    saveNow,
    async signIn(email, password) {
      await saveNow().catch(() => {});
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(authMessage(error));
      session = data.session;
      const state = await reload();
      subscribe();
      return state;
    },
    // Returnerer { state } når kontoen er klar, eller { confirm: true } når e-posten må bekreftes først.
    async signUp(email, password, profile) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { utleieProfile: profile }, emailRedirectTo: location.origin + '/' },
      });
      if (error) throw new Error(authMessage(error));
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
        throw new Error('Det finnes allerede en konto med denne e-postadressen.');
      if (!data.session) return { confirm: true };
      session = data.session;
      const state = await reload();
      subscribe();
      return { state };
    },
    async signOut() {
      await saveNow().catch(() => {});
      await sb.auth.signOut();
      session = null;
      const state = await reload();
      subscribe();
      return state;
    },
    async setPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(authMessage(error));
    },
    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
      if (error) throw new Error(authMessage(error));
    },
    createStaffLogin: (email, password, name) => api('create-staff', { email, password, name }),
    createSubaccount: (body) => api('create-subaccount', body),
    resetCustomerPassword: (email, password) => api('reset-password', { email, password }),
    // Merk en post som allerede lagret av serveren, så den ikke skrives på nytt.
    markSynced(collection, item) {
      synced.set(key(collection, idOf(collection, item)), JSON.stringify(strip(item)));
    },
  };
})();
