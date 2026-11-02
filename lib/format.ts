import { SUPABASE_URL } from "./env";

export function location(i: { zone: string; rack: string; shelf: string }) {
  const parts = [
    i.zone && `Sone ${i.zone}`,
    i.rack && `Reol ${i.rack}`,
    i.shelf && `Hylle ${i.shelf}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Ingen plassering";
}

export function imageUrl(path: string | null) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/item-images/${path}`;
}

export function date(d: string) {
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

export function isOverdue(l: { due_date: string; returned_qty: number; quantity: number }) {
  return l.returned_qty < l.quantity && l.due_date < today();
}
