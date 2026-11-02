"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type State = "laster" | "klar" | "feil" | "lagrer" | "ferdig";

/** Landingsside for invitasjoner og «glemt passord»: brukeren lager nytt passord her. */
export default function WelcomePage() {
  const [state, setState] = useState<State>("laster");
  const [msg, setMsg] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const query = new URLSearchParams(window.location.search);
        const err = hash.get("error_description") || query.get("error_description");
        if (err) throw new Error(err);

        if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (error) throw error;
        } else if (query.get("token_hash") && query.get("type")) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: query.get("token_hash")!,
            type: query.get("type") as "invite" | "recovery",
          });
          if (error) throw error;
        } else if (query.get("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(query.get("code")!);
          if (error) throw error;
        }
        window.history.replaceState(null, "", "/velkommen");

        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Lenken er ugyldig eller utløpt.");
        setState("klar");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Lenken er ugyldig eller utløpt.");
        setState("feil");
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMsg("Passordet må ha minst 8 tegn.");
    if (password !== password2) return setMsg("Passordene er ikke like.");
    setMsg("");
    setState("lagrer");
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setState("klar");
      return;
    }
    setState("ferdig");
    window.location.href = "/";
  }

  return (
    <main>
      <div className="card login">
        <h1>Velkommen</h1>
        {state === "laster" && <p className="muted">Sjekker lenken…</p>}
        {state === "feil" && (
          <>
            <div className="error">{msg}</div>
            <p className="muted small">
              Be en admin sende ny invitasjon, eller bruk «Glemt passord» på <a href="/login">innloggingssiden</a>.
            </p>
          </>
        )}
        {(state === "klar" || state === "lagrer") && (
          <form onSubmit={save}>
            <p className="muted">Lag et passord for å logge inn i Lagerstyring.</p>
            {msg && <div className="error">{msg}</div>}
            <div className="field">
              <label htmlFor="pw">Nytt passord</label>
              <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="pw2">Gjenta passord</label>
              <input id="pw2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
            </div>
            <button className="btn primary" type="submit" disabled={state === "lagrer"} style={{ width: "100%" }}>
              {state === "lagrer" ? "Lagrer…" : "Lagre passord og gå inn"}
            </button>
          </form>
        )}
        {state === "ferdig" && <p>Ferdig! Sender deg videre…</p>}
      </div>
    </main>
  );
}
