"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SearchForm({
  q,
  kategori,
  categories,
}: {
  q: string;
  kategori: string;
  categories: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [cat, setCat] = useState(kategori);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (text.trim()) p.set("q", text.trim());
      if (cat) p.set("kategori", cat);
      router.replace(p.size ? `/?${p}` : "/");
    }, 300);
    return () => clearTimeout(t);
  }, [text, cat, router]);

  return (
    <form className="search" method="get" onSubmit={(e) => e.preventDefault()}>
      <input
        name="q"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Søk etter vare, beskrivelse, sone eller reol…"
        type="search"
      />
      <select name="kategori" value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="">Alle kategorier</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </form>
  );
}
