import { signIn } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string }>;
}) {
  const { feil } = await searchParams;
  return (
    <main>
      <div className="card login">
        <h1>Lagerstyring</h1>
        <p className="muted">Logg inn for å se lager og registrere utlån.</p>
        {feil && <div className="error">Feil e-post eller passord.</div>}
        <form action={signIn}>
          <div className="field">
            <label htmlFor="email">E-post</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Passord</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn primary" type="submit" style={{ width: "100%" }}>Logg inn</button>
        </form>
      </div>
    </main>
  );
}
