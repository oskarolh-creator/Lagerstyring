import { requestPasswordReset, signIn } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string; sendt?: string; glemt?: string }>;
}) {
  const { feil, sendt, glemt } = await searchParams;
  return (
    <main>
      <div className="card login">
        <h1>Lagerstyring</h1>
        {sendt && (
          <div className="notice">Hvis e-posten finnes hos oss, har vi sendt en lenke for nytt passord.</div>
        )}
        {glemt ? (
          <form action={requestPasswordReset}>
            <p className="muted">Skriv inn e-posten din, så sender vi en lenke for å lage nytt passord.</p>
            <div className="field">
              <label htmlFor="email">E-post</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <button className="btn primary" type="submit" style={{ width: "100%" }}>Send lenke</button>
            <p className="small"><a href="/login">Tilbake til innlogging</a></p>
          </form>
        ) : (
          <form action={signIn}>
            <p className="muted">Logg inn for å se lager og registrere utlån.</p>
            {feil && <div className="error">Feil e-post eller passord.</div>}
            <div className="field">
              <label htmlFor="email">E-post</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Passord</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <button className="btn primary" type="submit" style={{ width: "100%" }}>Logg inn</button>
            <p className="small"><a href="/login?glemt=1">Glemt passord?</a></p>
          </form>
        )}
      </div>
    </main>
  );
}
