import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import { requireUser } from "@/lib/supabase-server";
import { imageUrl, location } from "@/lib/format";
import { allCategories } from "@/lib/categories";
import type { Item } from "@/lib/types";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string }>;
}) {
  const { q = "", kategori = "" } = await searchParams;
  const { supabase } = await requireUser();

  let query = supabase.from("items_with_availability").select("*").order("name");
  if (kategori) query = query.eq("category", kategori);
  const term = q.trim().replace(/[%,()]/g, " ");
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      `name.ilike.${like},description.ilike.${like},category.ilike.${like},zone.ilike.${like},rack.ilike.${like}`
    );
  }
  const { data, error } = await query;
  const items = (data ?? []) as Item[];

  const allCats = await allCategories(supabase);

  return (
    <>
      <div className="row spread">
        <h1>Varer</h1>
        <span className="muted small">{items.length} varer</span>
      </div>
      <SearchForm q={q} kategori={kategori} categories={allCats} />
      {error && <div className="error">{error.message}</div>}
      {items.length === 0 && !error && (
        <p className="muted">Ingen varer funnet{q && ` for «${q}»`}.</p>
      )}
      <div className="items">
        {items.map((i) => {
          const src = imageUrl(i.image_path);
          return (
            <Link key={i.id} href={`/varer/${i.id}`} className="item-card">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb" src={src} alt={i.name} loading="lazy" />
              ) : (
                <div className="thumb empty">Ingen bilde</div>
              )}
              <div className="body">
                <div className="name">{i.name}</div>
                <div className="muted small">{location(i)}</div>
                <div className="row spread" style={{ marginTop: 6 }}>
                  <span className="qty">
                    <strong>{i.available_qty}</strong>
                    <span className="muted"> / {i.total_qty} ledig</span>
                  </span>
                  {i.out_qty > 0 && <span className="badge warn">{i.out_qty} ute</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
