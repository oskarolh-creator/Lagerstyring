import Link from "next/link";
import type { Profile } from "@/lib/types";
import { signOut } from "@/app/actions";

export default function TopBar({ profile }: { profile: Profile }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">Lagerstyring</Link>
      <nav>
        <Link href="/">Varer</Link>
        <Link href="/utlan">Utlån</Link>
        {profile.role === "admin" && <Link href="/varer/ny">+ Ny vare</Link>}
        {profile.role === "admin" && <Link href="/kategorier">Kategorier</Link>}
        {profile.role === "admin" && <Link href="/brukere">Brukere</Link>}
      </nav>
      <span className="user">
        {profile.full_name} {profile.role === "admin" && "(admin)"}
      </span>
      <form action={signOut}>
        <button className="btn small" type="submit">Logg ut</button>
      </form>
    </header>
  );
}
