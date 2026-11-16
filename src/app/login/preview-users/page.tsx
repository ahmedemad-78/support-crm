import { notFound } from "next/navigation";
import { Sidebar } from "@/components/app-shell/sidebar";
import { navFor } from "@/components/app-shell/nav";
import type { CurrentUser } from "@/lib/auth/roles";
import { AddUserDialog } from "@/app/(app)/admin/users/add-user-dialog";
import { UsersTable, type UserRow } from "@/app/(app)/admin/users/users-table";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const at = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

/** Visual QA only: synthetic accounts, no database reads. Saving from here is rejected by the server actions. */
export default function PreviewUsers() {
  if (process.env.NODE_ENV !== "development") notFound();
  const user: CurrentUser = { id: "10000000-0000-4000-8000-000000000001", role: "support_agent", isAdmin: true, email: "fixture@example.com", fullName: "Preview Agent" };
  const rows: UserRow[] = [
    { id: user.id, fullName: "Preview Agent", email: "fixture@example.com", role: "support_agent", isAdmin: true, isActive: true, lockedUntil: null, lastSignInAt: at(0) },
    { id: "2", fullName: "Demo Agent", email: "agent@example.com", role: "support_agent", isAdmin: false, isActive: true, lockedUntil: null, lastSignInAt: at(1) },
    { id: "3", fullName: "Sonia Demo", email: "sonia@example.com", role: "moderation", isAdmin: false, isActive: true, lockedUntil: null, lastSignInAt: at(3) },
    { id: "4", fullName: "Kabany Demo", email: "kabany@example.com", role: "call_center", isAdmin: false, isActive: true, lockedUntil: at(-1), lastSignInAt: at(6) },
    { id: "5", fullName: "June Schools Demo", email: "june@example.com", role: "june_schools", isAdmin: false, isActive: true, lockedUntil: null, lastSignInAt: null },
    { id: "6", fullName: "Schools Sales Demo", email: "b2b@example.com", role: "business_development", isAdmin: false, isActive: true, lockedUntil: null, lastSignInAt: at(12) },
    { id: "7", fullName: "Manager Demo", email: "manager@example.com", role: "manager", isAdmin: false, isActive: true, lockedUntil: null, lastSignInAt: at(2) },
    { id: "8", fullName: "Former Agent", email: "former@example.com", role: "moderation", isAdmin: false, isActive: false, lockedUntil: null, lastSignInAt: at(40) },
  ];
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <Sidebar user={user} sections={navFor(user)} />
      <main className="workspace-main flex min-w-0 flex-1 flex-col bg-muted">
        <div className="border-b bg-amber-50 px-6 py-2 text-xs text-amber-900">DEVELOPMENT PREVIEW · synthetic accounts</div>
        <header className="flex min-h-24 shrink-0 flex-wrap items-center justify-between gap-4 border-b bg-background px-5 py-5 sm:px-8">
          <div className="space-y-1"><p className="eyebrow">SUPPORT WORKSPACE</p><h1 className="text-2xl font-semibold tracking-tight">Users</h1></div>
          <AddUserDialog />
        </header>
        <UsersTable rows={rows} currentUserId={user.id} />
      </main>
    </div>
  );
}
