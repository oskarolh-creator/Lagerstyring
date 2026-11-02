import Link from "next/link";
import ItemForm from "@/components/ItemForm";
import Messages from "@/components/Messages";
import { allCategories } from "@/lib/categories";
import { requireUser } from "@/lib/supabase-server";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ feil?: string }>;
}) {
  const { feil } = await searchParams;
  const { supabase } = await requireUser({ admin: true });
  return (
    <>
      <Link href="/" className="muted small">← Alle varer</Link>
      <h1 style={{ marginTop: 12 }}>Ny vare</h1>
      <Messages feil={feil} />
      <ItemForm categories={await allCategories(supabase)} />
    </>
  );
}
