import "server-only";
import { createClient } from "@/lib/supabase/server";
import { cairoDate } from "./dashboard-model";
import type { BusinessTicket, BusinessEvent } from "./business-analytics";

export async function loadAnalytics() {
  const supabase = await createClient();
  const asOf = new Date().toISOString();
  const tickets: BusinessTicket[] = [];
  const { data: sources, error: sourceError } = await supabase.from("ticket_sources").select("code, name, is_active");
  if (sourceError) throw sourceError;
  const sourceNames = new Map((sources ?? []).map((source) => [source.code, source.name]));
  // Deterministic cursor pagination, no silent 10k/5k cut-off or offset drift.
  let cursor: string | undefined;
  for (;;) {
    let query = supabase
      .from("tickets")
      .select(
        "reporter_id, created_by, app_version, is_latest_version, device_type, page_screen, reopen_count, last_reopened_at, credentials_username, resolution_notes, reporter:profiles!tickets_reporter_id_fkey(full_name), creator:profiles!tickets_created_by_fkey(full_name), contact_channel, is_historical, id, ticket_number, issue_description, status, source, created_at, updated_at, resolved_at, issue_date, customer_name, customer_email, customer_phone, school_name, end_user_type, city_id, issue_category_id, platform, assignee_id, fawry_payment, assignee:profiles!tickets_assignee_id_fkey(full_name), issue_categories(name), root_causes(name), request_types(name), topics(name), tracker_causes(name), tracker_actions(name), outcomes(name)",
      )
      .lte("created_at", asOf)
      .order("id")
      .limit(500);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const nameOf = (value: unknown): string => {
        const item = Array.isArray(value) ? value[0] : value;
        return item && typeof item === "object" && "name" in item
          ? String(item.name)
          : "";
      };
      tickets.push({
        id: row.id,
        number: row.ticket_number,
        subject: row.issue_description,
        status: row.status,
        source: row.source,
        contactChannel: row.contact_channel,
        reopenCount: row.reopen_count,
        lastReopenedAt: row.last_reopened_at ?? "",
        reporter: (Array.isArray(row.reporter) ? row.reporter[0]?.full_name : (row.reporter as {full_name?:string}|null)?.full_name) ?? "",
        creator: (Array.isArray(row.creator) ? row.creator[0]?.full_name : (row.creator as {full_name?:string}|null)?.full_name) ?? "",
        credential: row.credentials_username ?? "",
        resolutionNotes: row.resolution_notes ?? "",
        reporterId: row.reporter_id ?? "",
        creatorId: row.created_by ?? "",
        appVersion: row.app_version ?? "",
        latestVersion: row.is_latest_version,
        device: row.device_type ?? "", screen: row.page_screen ?? "",
        workflowEvents: [],
        isHistorical: row.is_historical,
        sourceName: sourceNames.get(row.source),
        createdOn: cairoDate(row.created_at),
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        endUserType: row.end_user_type ?? "",
        cityId: row.city_id == null ? "" : String(row.city_id),
        categoryId:
          row.issue_category_id == null ? "" : String(row.issue_category_id),
        category: nameOf(row.issue_categories),
        cause: nameOf(row.root_causes),
        platform: row.platform ?? "",
        assigneeId: row.assignee_id ?? "",
        assignee: (Array.isArray(row.assignee) ? row.assignee[0]?.full_name : (row.assignee as { full_name?: string } | null)?.full_name) ?? "",
        requestType: nameOf(row.request_types),
        topic: nameOf(row.topics),
        trackerCause: nameOf(row.tracker_causes),
        trackerAction: nameOf(row.tracker_actions),
        outcome: nameOf(row.outcomes),
        fawry: row.fawry_payment === true ? "yes" : row.fawry_payment === false ? "no" : "",
        reportedOn: row.issue_date || cairoDate(row.created_at),
        customerName: row.customer_name ?? "",
        customerEmail: row.customer_email ?? "",
        customerPhone: row.customer_phone ?? "",
        schoolName: row.school_name ?? "",
        updatedOn: row.updated_at ? cairoDate(row.updated_at) : "",
        updatedAt: row.updated_at ?? "",
      });
    }
    cursor = data[data.length - 1].id;
  }
  // Load event rows independently: embedded relations have their own API row cap.
  const byId=new Map(tickets.map(ticket=>[ticket.id,ticket]));
  let eventCursor:string|undefined;
  for (;;) {
    let query=supabase.from("ticket_workflow_events").select("id,ticket_id,kind,from_status,to_status,created_at,resolution_snapshot,actor:profiles!ticket_workflow_events_actor_id_fkey(role)").lte("created_at",asOf).order("id").limit(500);
    if(eventCursor)query=query.gt("id",eventCursor);
    const {data,error}=await query;if(error)throw error;if(!data?.length)break;
    for(const row of data){const ticket=byId.get(row.ticket_id);if(!ticket)continue;
      const actor=Array.isArray(row.actor)?row.actor[0]:row.actor;
      const raw=row.resolution_snapshot as Record<string,unknown>|null;
      const snapshot=raw?Object.fromEntries(["request_type","topic","cause","action","outcome"].map(key=>[key,typeof raw[key]==="string"?raw[key]:null])):null;
      ticket.workflowEvents!.push({id:row.id,kind:row.kind,created_at:row.created_at,from_status:row.from_status,to_status:row.to_status,actorRole:actor?.role??null,resolution_snapshot:snapshot} as BusinessEvent);
    }
    eventCursor=data[data.length-1].id;
  }
  return { tickets, asOf, sources: sources ?? [] };
}
