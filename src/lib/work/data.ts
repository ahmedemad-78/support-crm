import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  WorkContext,
  WorkTicket,
  WorkEvent,
  WorkFile,
  WorkControls,
  WorkResolution,
  Catalogs,
  RegisterRow,
} from "./types";
export async function workContext(): Promise<WorkContext> {
  const db = await createClient();
  const { data, error } = await db.rpc("work_context");
  if (error) throw error;
  return data as WorkContext;
}
export async function workCatalogs(): Promise<Catalogs> {
  const db = await createClient();
  const tables = [
    "request_types",
    "topics",
    "tracker_causes",
    "tracker_actions",
    "outcomes",
  ] as const;
  const results = await Promise.all(
    tables.map((t) =>
      db
        .from(t)
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("name"),
    ),
  );
  for (const r of results) if (r.error) throw r.error;
  return Object.fromEntries(
    tables.map((t, i) => [t, results[i].data ?? []]),
  ) as Catalogs;
}
export async function loadWorkTicket(id: string) {
  const db = await createClient();
  const ticket = await db
    .from("work_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (ticket.error) throw ticket.error;
  if (!ticket.data) return null;
  const [
    events,
    files,
    controls,
    resolutions,
    notices,
    context,
    catalogs,
    people,
    city,
  ] = await Promise.all([
    db
      .from("work_ticket_events")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at")
      .order("id"),
    db.from("work_ticket_attachments").select("*").eq("ticket_id", id),
    db
      .from("work_ticket_controls")
      .select("priority,due_at")
      .eq("ticket_id", id)
      .maybeSingle(),
    db
      .from("work_ticket_resolutions")
      .select("*")
      .eq("ticket_id", id)
      .order("cycle", { ascending: false }),
    db
      .from("work_notifications")
      .select("id")
      .eq("ticket_id", id)
      .is("read_at", null)
      .limit(500),
    workContext(),
    workCatalogs(),
    db.rpc("work_ticket_people", { ticket: id }),
    db
      .from("cities")
      .select("name")
      .eq("id", ticket.data.external_data?.city_id ?? 0)
      .maybeSingle(),
  ]);
  for (const r of [events, files, controls, resolutions, notices, people, city])
    if (r.error) throw r.error;
  const media = (files.data ?? []) as WorkFile[];
  const signed = media.length
    ? await db.storage.from("work-ticket-attachments").createSignedUrls(
        media.map((f) => f.storage_path),
        600,
      )
    : { data: [], error: null };
  if (signed.error) throw signed.error;
  const urls = new Map(signed.data?.map((f) => [f.path, f.signedUrl]));
  return {
    ticket: ticket.data as WorkTicket,
    events: (events.data ?? []) as WorkEvent[],
    files: media.map((f) => ({ ...f, url: urls.get(f.storage_path) })),
    controls: controls.data as WorkControls | null,
    resolutions: (resolutions.data ?? []) as WorkResolution[],
    noticeIds: (notices.data ?? []).map((n) => n.id as string),
    context,
    catalogs,
    people: people.data as { id: string; name: string }[],
    cityName: city.data?.name as string | undefined,
  };
}
export type RegisterParams = {
  q: string;
  domain: string;
  department: string;
  kind: string;
  state: string;
  page: number;
};
export function registerParams(
  raw: Record<string, string | string[] | undefined>,
): RegisterParams {
  const s = (k: string) => (typeof raw[k] === "string" ? String(raw[k]) : "");
  return {
    q: s("q").trim().slice(0, 120),
    domain: ["internal", "external"].includes(s("domain")) ? s("domain") : "",
    department: /^[0-9a-f-]{36}$/i.test(s("department")) ? s("department") : "",
    kind: ["problem", "execution_request"].includes(s("kind")) ? s("kind") : "",
    state: [
      "open",
      "finished",
      "new",
      "available",
      "assigned_pending",
      "in_progress",
      "awaiting_owner",
      "resolved",
      "cancelled",
      "closed_no_response",
      "awaiting_customer",
      "closed",
    ].includes(s("state"))
      ? s("state")
      : "",
    page: /^[1-9][0-9]*$/.test(s("page"))
      ? Math.min(100000, Number(s("page")))
      : 1,
  };
}
export async function loadWorkRegister(params: RegisterParams, all = false) {
  const db = await createClient();
  const asOf = new Date().toISOString();
  const query = (head = false) => {
    let q = db
      .from("case_register_v2")
      .select("*", { count: "exact", head })
      .lte("created_at", asOf);
    if (params.q)
      q = q.ilike(
        "search_text",
        "%" +
          params.q
            .replaceAll("\\", "\\\\")
            .replaceAll("%", "\\%")
            .replaceAll("_", "\\_") +
          "%",
      );
    if (params.domain) q = q.eq("domain", params.domain);
    if (params.department) q = q.eq("department_id", params.department);
    if (params.kind) q = q.eq("kind", params.kind);
    if (params.state === "open")
      q = q.not(
        "state",
        "in",
        "(resolved,cancelled,closed_no_response,closed)",
      );
    else if (params.state === "finished")
      q = q.in("state", [
        "resolved",
        "cancelled",
        "closed_no_response",
        "closed",
      ]);
    else if (params.state) q = q.eq("state", params.state);
    return q.order("updated_at", { ascending: false }).order("id");
  };
  const count = await query(true);
  if (count.error) throw count.error;
  const total = count.count ?? 0;
  const page = Math.min(params.page, Math.max(1, Math.ceil(total / 25)));
  if (all) {
    const rows: RegisterRow[] = [];
    for (let offset = 0; offset < total; offset += 500) {
      const batch = await query().range(offset, offset + 499);
      if (batch.error) throw batch.error;
      rows.push(...((batch.data ?? []) as RegisterRow[]));
    }
    return { rows, total, page };
  }
  const result = await query().range((page - 1) * 25, page * 25 - 1);
  if (result.error) throw result.error;
  return { rows: (result.data ?? []) as RegisterRow[], total, page };
}
