"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/session";
import { clearLock } from "@/lib/auth/lockout";
import { ROLES } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const password = z
  .string()
  .min(10, "Password needs at least 10 characters")
  .max(72, "Password can be at most 72 characters");

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name"),
  email: z.email("Enter a valid email, e.g. name@selaheltelmeez.com"),
  role: z.enum(ROLES),
  password,
});

export async function createUser(input: z.input<typeof createSchema>): Promise<ActionResult> {
  await assertAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { fullName, email, role } = parsed.data;
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role, full_name: fullName },
  });

  if (error) {
    return {
      ok: false,
      error: error.code === "email_exists" ? `${email} already has an account.` : error.message,
    };
  }

  // Supabase inserts the auth user before it writes app_metadata, so the profile trigger
  // can't see the role yet. Set it explicitly.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, full_name: fullName })
    .eq("id", created.user.id);
  if (profileError) return { ok: false, error: profileError.message };

  revalidatePath("/admin/users");
  return { ok: true, message: `${fullName} can now sign in.` };
}

const updateSchema = z.object({
  userId: z.uuid(),
  role: z.enum(ROLES),
  password: z.union([z.literal(""), password]),
});

export async function updateUser(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const me = await assertAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { userId, role } = parsed.data;
  if (userId === me.id && role !== "support_agent") {
    return { ok: false, error: "You can't change your own role — you'd lose access to Admin." };
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
    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
  }

  if (roleChanged || passwordChanged) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ...(passwordChanged ? { password: parsed.data.password } : {}),
      app_metadata: { role, full_name: current.full_name },
    });
    if (error) return { ok: false, error: error.message };

    if (userId !== me.id) {
      const { error: revokeError } = await admin.rpc("revoke_user_sessions", { target_user: userId });
      if (revokeError) return { ok: false, error: revokeError.message };
    }
  }

  revalidatePath("/admin/users");
  if (!roleChanged && !passwordChanged) return { ok: true, message: "Nothing to change." };
  return { ok: true, message: `Saved. ${current.full_name} was signed out and must sign in again.` };
}

export async function unlockUser(email: string): Promise<ActionResult> {
  await assertAdmin();
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email" };
  await clearLock(parsed.data);
  revalidatePath("/admin/users");
  return { ok: true, message: "Account unlocked." };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const me = await assertAdmin();
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "Invalid user" };
  if (userId === me.id) return { ok: false, error: "You can't deactivate your own account." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (banError) return { ok: false, error: banError.message };

  if (!active) await admin.rpc("revoke_user_sessions", { target_user: userId });

  revalidatePath("/admin/users");
  return { ok: true, message: active ? "User reactivated." : "User deactivated. Their tickets and history are kept." };
}
