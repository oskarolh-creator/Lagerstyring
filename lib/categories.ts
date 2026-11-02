import type { SupabaseClient } from "@supabase/supabase-js";

export type Category = { name: string; sort_order: number };

export async function categoryRows(supabase: SupabaseClient): Promise<Category[]> {
  const { data } = await supabase
    .from("categories")
    .select("name, sort_order")
    .order("sort_order")
    .order("name");
  return (data ?? []) as Category[];
}

export async function allCategories(supabase: SupabaseClient) {
  return (await categoryRows(supabase)).map((c) => c.name);
}
