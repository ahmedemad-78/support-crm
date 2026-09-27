import { Sidebar } from "@/components/app-shell/sidebar";
import { navFor } from "@/components/app-shell/nav";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const sections = navFor(user);

  if (user.role === "support_agent" || user.role === "manager") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    if (count) {
      for (const section of sections) {
        for (const item of section.items) {
          if (item.href === "/tickets") item.badge = `${count} new`;
        }
      }
    }
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar user={user} sections={sections} />
      <main id="main-content" tabIndex={-1} className="workspace-main flex min-w-0 flex-1 flex-col bg-muted">{children}</main>
    </div>
  );
}
