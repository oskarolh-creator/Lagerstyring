import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Fant ikke siden</h1>
      <Link href="/">Til varene</Link>
    </main>
  );
}
