import { updateProfile } from "@/app/actions";
import Messages from "@/components/Messages";
import { requireUser } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string; ok?: string }>;
}) {
  const { feil, ok } = await searchParams;
  const { supabase } = await requireUser({ admin: true });
  const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
  const users = (data ?? []) as Profile[];

  return (
    <>
      <h1>Brukere</h1>
      <Messages feil={feil} ok={ok} />
      <p className="muted small">
        Nye brukere legges til i Supabase under Authentication → Users → Add user. De dukker opp her som
        «ansatt», og du kan gjøre dem til admin.
      </p>
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
