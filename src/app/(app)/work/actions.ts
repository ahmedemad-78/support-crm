"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { portalTicketSchemaFor } from "@/lib/tickets/schema";
import { typedCity } from "@/lib/tickets/intake";
import { workContext } from "@/lib/work/data";
import type { WorkCommandResult } from "@/lib/work/types";
const commandSchema = z.object({
  operation: z.enum([
    "start",
    "reply",
    "note",
    "wait",
    "transfer",
    "return",
    "resolve",
    "cancel",
    "close_no_response",
    "reopen",
    "controls",
    "owner",
  ]),
  ticket: z.uuid(),
  revision: z.number().int().positive(),
  requestId: z.uuid(),
  data: z.record(z.string(), z.unknown()),
});
function refresh(id: string) {
  revalidatePath("/tickets");
  revalidatePath("/portal/my-tickets");
  revalidatePath("/dashboard");
  revalidatePath("/reports/work");
  revalidatePath("/reports/performance");
  revalidatePath("/work/" + id);
}
export async function runWorkCommand(
  input: z.input<typeof commandSchema>,
): Promise<
  { ok: true; result: WorkCommandResult } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in with an active account." };
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the action details." };
  try {
    const db = await createClient();
    const v = parsed.data;
    const { data, error } = await db.rpc("work_command", {
      operation: v.operation,
      ticket: v.ticket,
      revision: v.revision,
      request_id: v.requestId,
      data: v.data,
    });
    if (error) return { ok: false, error: error.message };
    refresh(v.ticket);
    return { ok: true, result: data as WorkCommandResult };
  } catch {
    return {
      ok: false,
      error:
        "Could not confirm this action. Your draft is retained; retry the same request.",
    };
  }
}
const createSchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  domain: z.enum(["internal", "external"]),
  kind: z.enum(["problem", "execution_request"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(8000),
  ownerId: z.union([z.uuid(), z.literal("")]),
  external: z.record(z.string(), z.string()),
  details: z.string().trim().max(4000),
});
export async function createWorkTicket(
  input: z.input<typeof createSchema>,
): Promise<
  { ok: true; result: WorkCommandResult } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in with an active account." };
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  try {
    const v = p.data;
    const context = await workContext();
    const owner = v.ownerId || user.id;
    const person = context.people.find((p) => p.id === owner);
    const department = context.departments.find(
      (d) => d.id === person?.department_id && d.is_active,
    );
    if (!department)
      return {
        ok: false,
        error:
          "The owner needs an active department. Ask the administrator to set it.",
      };
    let external: Record<string, unknown> = {};
    if (v.domain === "external") {
      const parsed = portalTicketSchemaFor(
        department.external_source_code || "",
      ).safeParse({ ...v.external, issue_description: v.description });
      if (!parsed.success)
        return {
          ok: false,
          error: parsed.error.issues.map((i) => i.message).join(" · "),
        };
      const db = await createClient();
      const city = await db
        .from("cities")
        .select("name")
        .eq("id", parsed.data.city_id)
        .single();
      if (city.error) return { ok: false, error: "Choose an active city." };
      const place = typedCity(city.data.name, parsed.data.city_other);
      if (place.error) return { ok: false, error: place.error };
      external = { ...parsed.data, city_other: place.value };
    }
    const db = await createClient();
    const { data, error } = await db.rpc("work_command", {
      operation: "create",
      ticket: v.id,
      revision: 0,
      request_id: v.requestId,
      data: {
        domain: v.domain,
        kind: v.kind,
        title: v.title,
        description: v.description,
        owner_id: owner,
        external_data: external,
        optional_details: v.details ? { details: v.details } : {},
      },
    });
    if (error) return { ok: false, error: error.message };
    refresh(v.id);
    return { ok: true, result: data as WorkCommandResult };
  } catch {
    return {
      ok: false,
      error:
        "Could not confirm the save. Your entries are retained; retry the same request.",
    };
  }
}
export async function markWorkNoticesRead(ids: string[]) {
  const user = await getCurrentUser();
  const p = z.array(z.uuid()).max(500).safeParse(ids);
  if (!user || !p.success) return { ok: false };
  const db = await createClient();
  const { error } = await db.rpc("work_read_notifications", { ids: p.data });
  if (!error) revalidatePath("/", "layout");
  return { ok: !error };
}
export async function workAdmin(
  operation: "department" | "membership",
  data: Record<string, unknown>,
) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { ok: false, error: "Admin access required." };
  const db = await createClient();
  const result = await db.rpc("work_admin", { operation, data });
  if (result.error) return { ok: false, error: result.error.message };
  revalidatePath("/admin/departments");
  revalidatePath("/work/new");
  return { ok: true };
}
