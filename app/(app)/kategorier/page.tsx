import { deleteCategory, saveCategory } from "@/app/actions";
import Messages from "@/components/Messages";
import { categoryRows } from "@/lib/categories";
import { requireUser } from "@/lib/supabase-server";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string; ok?: string }>;
}) {
  const { feil, ok } = await searchParams;
  const { supabase } = await requireUser({ admin: true });
  const cats = await categoryRows(supabase);
  const { data: used } = await supabase.from("items").select("category");
  const counts = new Map<string, number>();
  (used ?? []).forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));

  return (
    <>
      <h1>Kategorier</h1>
      <Messages feil={feil} ok={ok} />
      <p className="muted small">
        Endrer du navnet på en kategori, flyttes alle varene i den med. «Rekkefølge» bestemmer hvor den står i
        listene (lavest først).
      </p>

      <form action={saveCategory} className="card row" style={{ marginBottom: 16 }}>
        <input name="name" placeholder="Ny kategori, f.eks. Dansegulv" required style={{ flex: 1, minWidth: 180 }} />
        <input name="sort_order" type="number" defaultValue={100} aria-label="Rekkefølge" style={{ width: 90 }} />
        <button className="btn primary" type="submit">Legg til</button>
      </form>

      <div className="loan-list">
        {cats.map((c) => (
          <div key={c.name} className="card row">
            <form action={saveCategory} className="row" style={{ flex: 1 }}>
              <input type="hidden" name="old_name" value={c.name} />
              <input name="name" defaultValue={c.name} aria-label="Navn" required style={{ flex: 1, minWidth: 160 }} />
              <input name="sort_order" type="number" defaultValue={c.sort_order} aria-label="Rekkefølge" style={{ width: 90 }} />
              <span className="muted small" style={{ width: 70 }}>{counts.get(c.name) ?? 0} varer</span>
              <button className="btn" type="submit">Lagre</button>
            </form>
            <form action={deleteCategory}>
              <input type="hidden" name="name" value={c.name} />
              <button className="btn danger" type="submit" disabled={(counts.get(c.name) ?? 0) > 0}>
                Slett
              </button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
