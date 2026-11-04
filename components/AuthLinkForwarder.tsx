"use client";

import { useEffect } from "react";

/**
 * Lenker fra invitasjons- og «glemt passord»-e-poster kan lande på feil side
 * (f.eks. /login) hvis Supabase ikke godtar /velkommen som adresse. Da sendes
 * brukeren videre til /velkommen med innloggingsdataene, så de kan lage passord.
 */
export default function AuthLinkForwarder() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith("/velkommen")) return;
    const h = new URLSearchParams(hash.slice(1));
    const q = new URLSearchParams(search);
    const fromEmail =
      h.has("access_token") ||
      h.has("error_description") ||
      q.has("token_hash") ||
      q.has("code") ||
      ["invite", "recovery", "signup", "magiclink"].includes(h.get("type") ?? q.get("type") ?? "");
    if (fromEmail) window.location.replace(`/velkommen${search}${hash}`);
  }, []);
  return null;
}
