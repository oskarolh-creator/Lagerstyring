import TopBar from "@/components/TopBar";
import { requireUser } from "@/lib/supabase-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return (
    <>
      <TopBar profile={profile} />
      <main>{children}</main>
    </>
  );
}
