import "server-only";
import { createClient } from "@/lib/supabase/server";
import { cairoDate } from "./dashboard-model";
import type { AnalyticsTicket } from "./analytics";

export async function loadAnalytics() {
  const supabase = await createClient();
  const asOf = new Date().toISOString();
  const tickets: AnalyticsTicket[] = [];
  // Deterministic cursor pagination, no silent 10k/5k cut-off or offset drift.
  let cursor: string | undefined;
  for (;;) {
    let query = supabase
      .from("tickets")
      .select(
        "id, ticket_number, issue_description, status, source, created_at, resolved_at, end_user_type, city_id, issue_category_id, platform, assignee_id, fawry_payment, assignee:profiles!tickets_assignee_id_fkey(full_name), issue_categories(name), root_causes(name), request_types(name), topics(name), tracker_causes(name), tracker_actions(name), outcomes(name)",
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
      });
    }
    cursor = data[data.length - 1].id;
  }
  return { tickets, asOf };
}
