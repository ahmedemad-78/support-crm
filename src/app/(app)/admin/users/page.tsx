import { PageHeader } from "@/components/app-shell/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getLockStatus } from "@/lib/auth/lockout";
import type { Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddUserDialog } from "./add-user-dialog";
import { UsersTable, type UserRow } from "./users-table";

export default async function UsersPage() {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const [{ data: profiles, error }, { data: authUsers }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, is_admin, is_active").order("full_name"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw error;

  const lastSignIn = new Map(authUsers?.users.map((u) => [u.id, u.last_sign_in_at ?? null]));

  const rows: UserRow[] = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const lock = p.is_active ? await getLockStatus(p.email) : null;
      return {
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role as Role,
        isAdmin: p.is_admin,
        isActive: p.is_active,
        lockedUntil: lock?.locked ? lock.unlocksAt.toISOString() : null,
        lastSignInAt: lastSignIn.get(p.id) ?? null,
      };
    }),
  );

  return (
    <>
      <PageHeader title="Users" actions={<AddUserDialog />} />
      <UsersTable rows={rows} currentUserId={me.id} />
    </>
  );
}
