import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Profile } from "./types";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Kalt fra en Server Component; middleware fornyer sesjonen.
          }
        },
      },
    }
  );
}

/** Henter innlogget bruker og profil, eller sender til innlogging. */
export async function requireUser(opts: { admin?: boolean } = {}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login");
  if (opts.admin && profile.role !== "admin") redirect("/");
  return { supabase, user, profile };
}
