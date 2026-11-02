import { inviteUser, updateProfile } from "@/app/actions";
import Messages from "@/components/Messages";
import { requireUser } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string; ok?: string; epost?: string }>;
}) {
  const { feil, ok, epost } = await searchParams;
  const { supabase } = await requireUser({ admin: true });
  const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
  const users = (data ?? []) as Profile[];

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
        {users.map((u) => (
          <form key={u.id} action={updateProfile} className="card row">
            <input type="hidden" name="id" value={u.id} />
            <input name="full_name" defaultValue={u.full_name} aria-label="Navn" style={{ flex: 1, minWidth: 160 }} />
            <select name="role" defaultValue={u.role} aria-label="Rolle" style={{ width: 130 }}>
              <option value="ansatt">Ansatt</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn" type="submit">Lagre</button>
          </form>
        ))}
      </div>
    </>
  );
}
