import { inviteUser, reactivateUser, removeUser, updateProfile } from "@/app/actions";
import ConfirmButton from "@/components/ConfirmButton";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Messages from "@/components/Messages";
import { requireUser } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string; ok?: string; epost?: string }>;
}) {
  const { feil, ok, epost } = await searchParams;
  const { supabase, user: me } = await requireUser({ admin: true });
  const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
  const users = (data ?? []) as Profile[];

  // E-post og status hentes fra Supabase Auth (krever service role-nøkkelen).
  const info = new Map<string, { email: string; banned: boolean; invited: boolean }>();
  const admin = supabaseAdmin();
  if (admin) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) {
      info.set(u.id, {
        email: u.email ?? "",
        banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
        invited: !u.last_sign_in_at,
      });
    }
  }

  return (
    <>
      <h1>Brukere</h1>
      <Messages feil={feil} ok={ok} />
      {ok === "invitert" && epost && <p className="muted small">Sendt til {epost}.</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Inviter ny bruker</h2>
        <p className="muted small">
          Personen får en e-post med en lenke. Der lager de sitt eget passord og er inne.
        </p>
        <form action={inviteUser}>
          <div className="grid2">
            <div className="field">
              <label htmlFor="inv_email">E-post</label>
              <input id="inv_email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="inv_name">Navn</label>
              <input id="inv_name" name="full_name" placeholder="Fornavn Etternavn" />
            </div>
          </div>
          <div className="row">
            <select name="role" defaultValue="ansatt" aria-label="Rolle" style={{ width: 160 }}>
              <option value="ansatt">Ansatt</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn primary" type="submit">Send invitasjon</button>
          </div>
        </form>
      </div>

      <h2>Alle brukere ({users.length})</h2>
      <div className="loan-list">
        {users.map((u) => {
          const i = info.get(u.id);
          return (
            <div key={u.id} className="card loan">
              <form action={updateProfile} className="row">
                <input type="hidden" name="id" value={u.id} />
                <input name="full_name" defaultValue={u.full_name} aria-label="Navn" style={{ flex: 1, minWidth: 160 }} />
                <select name="role" defaultValue={u.role} aria-label="Rolle" style={{ width: 130 }}>
                  <option value="ansatt">Ansatt</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="btn" type="submit">Lagre</button>
              </form>
              <div className="row spread">
                <span className="muted small">
                  {i?.email}
                  {i?.banned && <span className="badge warn" style={{ marginLeft: 8 }}>Stengt</span>}
                  {!i?.banned && i?.invited && <span className="badge" style={{ marginLeft: 8 }}>Invitert, ikke logget inn ennå</span>}
                </span>
                {u.id !== me.id &&
                  (i?.banned ? (
                    <form action={reactivateUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="btn" type="submit">Åpne kontoen igjen</button>
                    </form>
                  ) : (
                    <form action={removeUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <ConfirmButton message={`Slette ${u.full_name || i?.email || "brukeren"}? De mister tilgangen med en gang.`}>
                        Slett bruker
                      </ConfirmButton>
                    </form>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
