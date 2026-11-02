import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteItem } from "@/app/actions";
import ItemForm from "@/components/ItemForm";
import Messages from "@/components/Messages";
import { allCategories } from "@/lib/categories";
import { requireUser } from "@/lib/supabase-server";
import type { Item } from "@/lib/types";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feil?: string }>;
}) {
  const { id } = await params;
  const { feil } = await searchParams;
  const { supabase } = await requireUser({ admin: true });
  const { data: item } = await supabase.from("items").select("*").eq("id", id).maybeSingle<Item>();
  if (!item) notFound();
  return (
    <>
      <Link href={`/varer/${id}`} className="muted small">← Tilbake til varen</Link>
      <h1 style={{ marginTop: 12 }}>Rediger {item.name}</h1>
      <Messages feil={feil} />
      <ItemForm item={item} categories={await allCategories(supabase)} />
      <form action={deleteItem} style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={id} />
        <button className="btn danger" type="submit">Slett vare</button>
        <span className="muted small" style={{ marginLeft: 10 }}>
          Kan bare slettes hvis den aldri har vært lånt ut.
        </span>
      </form>
    </>
  );
}
