import { Sidebar } from "@/components/app-shell/sidebar";
import { navFor } from "@/components/app-shell/nav";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} sections={navFor(user)} />
      <main className="flex min-w-0 flex-1 flex-col bg-muted">{children}</main>
    </div>
  );
}
