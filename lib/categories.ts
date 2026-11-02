import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES } from "./types";

export async function allCategories(supabase: SupabaseClient) {
  const { data } = await supabase.from("items").select("category");
  return Array.from(new Set([...CATEGORIES, ...(data ?? []).map((c) => c.category as string)])).sort(
    (a, b) => a.localeCompare(b, "nb")
  );
}
