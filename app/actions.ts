"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, supabaseServer } from "@/lib/supabase-server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);
const withError = (path: string, msg: string) =>
  `${path}${path.includes("?") ? "&" : "?"}feil=${encodeURIComponent(msg)}`;

// ---------- Innlogging ----------
export async function signIn(form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, "email"),
    password: str(form, "password"),
  });
  if (error) redirect("/login?feil=1");
  redirect("/");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Varer (kun admin) ----------
export async function saveItem(form: FormData) {
  const { supabase } = await requireUser({ admin: true });
  const id = str(form, "id");
  const back = id ? `/varer/${id}/rediger` : "/varer/ny";
  const total = int(form, "total_qty");
  const name = str(form, "name");
  if (!name) redirect(withError(back, "Varen må ha et navn."));
  if (!Number.isFinite(total) || total < 0) redirect(withError(back, "Antall må være 0 eller mer."));

  const row = {
    name,
    category: str(form, "category") || "Annet",
    description: str(form, "description"),
    total_qty: total,
    zone: str(form, "zone"),
    rack: str(form, "rack"),
    shelf: str(form, "shelf"),
    image_path: str(form, "image_path") || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: cur } = await supabase
      .from("items_with_availability")
      .select("out_qty")
      .eq("id", id)
      .single();
    if (cur && total < cur.out_qty)
      redirect(withError(back, `${cur.out_qty} stk er utlånt nå, så totalen kan ikke være lavere enn det.`));
    const { error } = await supabase.from("items").update(row).eq("id", id);
    if (error) redirect(withError(back, error.message));
    revalidatePath("/", "layout");
    redirect(`/varer/${id}`);
  }

  const { data, error } = await supabase.from("items").insert(row).select("id").single();
  if (error || !data) redirect(withError(back, error?.message ?? "Kunne ikke lagre."));
  revalidatePath("/", "layout");
  redirect(`/varer/${data.id}`);
}

export async function deleteItem(form: FormData) {
  const { supabase } = await requireUser({ admin: true });
  const id = str(form, "id");
  const { count } = await supabase
    .from("loans")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);
  if (count)
    redirect(withError(`/varer/${id}/rediger`, "Varen har utlånshistorikk og kan ikke slettes. Sett antall til 0 i stedet."));
  const { data: item } = await supabase.from("items").select("image_path").eq("id", id).single();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) redirect(withError(`/varer/${id}/rediger`, error.message));
  if (item?.image_path) await supabase.storage.from("item-images").remove([item.image_path]);
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- Utlån ----------
export async function createLoan(form: FormData) {
  const { supabase, user } = await requireUser();
  const itemId = str(form, "item_id");
  const back = `/varer/${itemId}`;
  const quantity = int(form, "quantity");
  const borrower = str(form, "borrower_name");
  const start = str(form, "start_date");
  const due = str(form, "due_date");
  if (!Number.isFinite(quantity) || quantity < 1) redirect(withError(back, "Antall må være minst 1."));
  if (!borrower) redirect(withError(back, "Skriv inn hvem som låner."));
  if (!start || !due) redirect(withError(back, "Velg fra- og til-dato."));
  if (due < start) redirect(withError(back, "Til-dato kan ikke være før fra-dato."));

  const { error } = await supabase.from("loans").insert({
    item_id: itemId,
    quantity,
    lent_by: user.id,
    borrower_name: borrower,
    borrower_company: str(form, "borrower_company"),
    borrower_phone: str(form, "borrower_phone"),
    start_date: start,
    due_date: due,
    description: str(form, "description"),
  });
  if (error) redirect(withError(back, error.message));
  revalidatePath("/", "layout");
  redirect(`${back}?ok=utlan`);
}

export async function returnLoan(form: FormData) {
  const { supabase } = await requireUser();
  const id = str(form, "loan_id");
  const back = str(form, "back") || "/utlan";
  const qty = int(form, "return_qty");
  const { data: loan } = await supabase
    .from("loans")
    .select("quantity, returned_qty")
    .eq("id", id)
    .single();
  if (!loan) redirect(withError(back, "Fant ikke utlånet."));
  const outstanding = loan.quantity - loan.returned_qty;
  if (!Number.isFinite(qty) || qty < 1 || qty > outstanding)
    redirect(withError(back, `Antall tilbake må være mellom 1 og ${outstanding}.`));
  const { error } = await supabase
    .from("loans")
    .update({ returned_qty: loan.returned_qty + qty })
    .eq("id", id);
  if (error) redirect(withError(back, error.message));
  revalidatePath("/", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=retur`);
}

// ---------- Brukere (kun admin) ----------
export async function updateProfile(form: FormData) {
  const { supabase, user } = await requireUser({ admin: true });
  const id = str(form, "id");
  const role = str(form, "role") === "admin" ? "admin" : "ansatt";
  if (id === user.id && role !== "admin")
    redirect(withError("/brukere", "Du kan ikke fjerne admin-rollen fra deg selv."));
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: str(form, "full_name"), role })
    .eq("id", id);
  if (error) redirect(withError("/brukere", error.message));
  revalidatePath("/brukere");
  redirect("/brukere?ok=1");
}
