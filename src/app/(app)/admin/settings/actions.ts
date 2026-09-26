"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const LIST_TABLES = ["cities", "issue_categories", "root_causes"] as const;
export type ListTable = (typeof LIST_TABLES)[number];

const tableSchema = z.enum(LIST_TABLES);
const nameSchema = z.string().trim().min(2, "Name needs at least 2 characters").max(120);

function friendly(error: { code?: string; message: string }, name?: string): string {
  return error.code === "23505" ? `"${name}" is already in the list.` : error.message;
}

export async function addListItem(table: ListTable, name: string): Promise<ActionResult> {
  await assertAdmin();
  const t = tableSchema.parse(table);
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from(t).insert({ name: parsed.data });
  if (error) return { ok: false, error: friendly(error, parsed.data) };

  revalidatePath("/admin/settings");
  return { ok: true, message: `Added "${parsed.data}".` };
}

export async function renameListItem(table: ListTable, id: number, name: string): Promise<ActionResult> {
  await assertAdmin();
  const t = tableSchema.parse(table);
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from(t).update({ name: parsed.data }).eq("id", id);
  if (error) return { ok: false, error: friendly(error, parsed.data) };

  revalidatePath("/admin/settings");
  return { ok: true, message: "Renamed." };
}

export async function setListItemActive(table: ListTable, id: number, active: boolean): Promise<ActionResult> {
  await assertAdmin();
  const t = tableSchema.parse(table);

  const supabase = await createClient();
  const { error } = await supabase.from(t).update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true, message: active ? "Restored." : "Archived. Existing tickets keep this value." };
}

const emailsSchema = z.array(z.email("One of the addresses isn't a valid email")).max(10);

export async function saveNotificationEmails(raw: string): Promise<ActionResult> {
  const me = await assertAdmin();
  const emails = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const parsed = emailsSchema.safeParse(Array.from(new Set(emails)));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ value: parsed.data, updated_by: me.id, updated_at: new Date().toISOString() })
    .eq("key", "notification_emails");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: parsed.data.length ? "Notification recipients saved." : "Saved. No emails will be sent until you add an address.",
  };
}
