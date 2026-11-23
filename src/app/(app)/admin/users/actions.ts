"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/session";
import { clearLock } from "@/lib/auth/lockout";
import { ROLES } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function recordAccountChange(data: Record<string, unknown>) {
  const session = await createClient();
  const { error } = await session.rpc("work_admin", {
    operation: "account_changed",
    data,
  });
  return error
    ? "The account change was saved, but its audit record could not be confirmed. Review before repeating the action."
    : null;
}

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const password = z
  .string()
  .min(10, "Password needs at least 10 characters")
  .max(72, "Password can be at most 72 characters");

const createSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the full name")
    .max(120, "Name can be at most 120 characters"),
  email: z.email("Enter a valid email, e.g. name@selaheltelmeez.com"),
  role: z.enum(ROLES),
  departmentId: z.uuid("Choose a department"),
  password,
});

export async function createUser(
  input: z.input<typeof createSchema>,
): Promise<ActionResult> {
  await assertAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { fullName, email, role, departmentId } = parsed.data;
  const admin = createAdminClient();
  const department = await admin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("is_active", true)
    .maybeSingle();
  if (department.error || !department.data)
    return { ok: false, error: "Choose an active department." };
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role, full_name: fullName },
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "email_exists"
          ? `${email} already has an account.`
          : error.message,
    };
  }

  // Supabase inserts the auth user before it writes app_metadata, so the profile trigger
  // can't see the role yet. Set it explicitly.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update({ role, full_name: fullName, is_active: false })
    .eq("id", created.user.id)
    .select("id")
    .maybeSingle();
  if (profileError || !profile) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      created.user.id,
      { ban_duration: "876000h" },
    );
    revalidatePath("/admin/users");
    return {
      ok: false,
      error: banError
        ? "The login was created, but profile setup and account suspension failed. An administrator must repair this account before it is used. Do not create it again."
        : "The login was created but profile setup failed. Sign-in has been suspended. An administrator must repair this account; do not create it again.",
    };
  }

  const session = await createClient();
  const member = await session.rpc("work_admin", {
    operation: "membership",
    data: { profile_id: created.user.id, department_id: departmentId },
  });
  if (member.error) {
    await admin.auth.admin.updateUserById(created.user.id, {
      ban_duration: "876000h",
    });
    return {
      ok: false,
      error:
        "Login created but department setup failed. Account remains inactive; ask the administrator to repair it.",
    };
  }
  const activated = await admin
    .from("profiles")
    .update({ is_active: true })
    .eq("id", created.user.id);
  if (activated.error)
    return {
      ok: false,
      error:
        "Department saved, but account activation failed. Account remains inactive.",
    };
  await session.rpc("work_admin", {
    operation: "account_changed",
    data: { profile_id: created.user.id, action: "created" },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/departments");
  return { ok: true, message: `${fullName} can now sign in.` };
}

const updateSchema = z.object({
  userId: z.uuid(),
  role: z.enum(ROLES),
  password: z.union([z.literal(""), password]),
});

export async function updateUser(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  const me = await assertAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { userId, role } = parsed.data;
  if (userId === me.id && role !== "support_agent") {
    return {
      ok: false,
      error: "You can't change your own role — you'd lose access to Admin.",
    };
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .single();
  if (readError) return { ok: false, error: readError.message };

  const roleChanged = current.role !== role;
  const passwordChanged = parsed.data.password !== "";

  if (roleChanged) {
    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    const auditError = await recordAccountChange({
      profile_id: userId,
      action: "role_changed",
      role,
    });
    if (auditError) return { ok: false, error: auditError };
  }

  if (roleChanged || passwordChanged) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ...(passwordChanged ? { password: parsed.data.password } : {}),
      app_metadata: { role, full_name: current.full_name },
    });
    if (error) {
      revalidatePath("/admin/users");
      return {
        ok: false,
        error: roleChanged
          ? "The profile role was saved, but login settings could not be synchronized. Review this user's role before retrying."
          : error.message,
      };
    }

    if (userId !== me.id) {
      const { error: revokeError } = await admin.rpc("revoke_user_sessions", {
        target_user: userId,
      });
      if (revokeError) {
        revalidatePath("/admin/users");
        return {
          ok: false,
          error:
            "The requested changes were saved, but existing sessions could not be revoked. Session revocation still needs attention.",
        };
      }
    }
    if (passwordChanged) {
      const auditError = await recordAccountChange({
        profile_id: userId,
        action: "password_changed",
      });
      if (auditError) return { ok: false, error: auditError };
    }
  }

  revalidatePath("/admin/users");
  if (!roleChanged && !passwordChanged)
    return { ok: true, message: "Nothing to change." };
  return {
    ok: true,
    message: `Saved. ${current.full_name} was signed out and must sign in again.`,
  };
}

export async function unlockUser(email: string): Promise<ActionResult> {
  await assertAdmin();
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email" };
  await clearLock(parsed.data);
  const auditError = await recordAccountChange({
    email: parsed.data,
    action: "unlocked",
  });
  if (auditError) return { ok: false, error: auditError };
  revalidatePath("/admin/users");
  return { ok: true, message: "Account unlocked." };
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const me = await assertAdmin();
  if (!z.uuid().safeParse(userId).success)
    return { ok: false, error: "Invalid user" };
  if (userId === me.id)
    return { ok: false, error: "You can't deactivate your own account." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  const auditError = await recordAccountChange({
    profile_id: userId,
    action: active ? "reactivated" : "deactivated",
  });
  if (auditError) return { ok: false, error: auditError };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (banError) {
    revalidatePath("/admin/users");
    return {
      ok: false,
      error: `The profile is ${active ? "active" : "inactive"}, but the sign-in restriction could not be updated. Account access is not fully synchronized.`,
    };
  }

  if (!active) {
    const { error: revokeError } = await admin.rpc("revoke_user_sessions", {
      target_user: userId,
    });
    if (revokeError) {
      revalidatePath("/admin/users");
      return {
        ok: false,
        error:
          "The account was deactivated, but existing sessions could not be revoked. Session revocation still needs attention.",
      };
    }
  }

  revalidatePath("/admin/users");
  return {
    ok: true,
    message: active
      ? "User reactivated."
      : "User deactivated. Their tickets and history are kept.",
  };
}
