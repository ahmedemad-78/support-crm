import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isPortalRole, type Role } from "@/lib/auth/roles";
import type { TicketStatus } from "@/lib/tickets/constants";
import type { AppNotification, NotificationKind } from "./types";

function hrefFor(role: Role, kind: NotificationKind, ticketId: string) {
  if (kind === "status_changed" && isPortalRole(role)) {
    return `/portal/my-tickets/${ticketId}`;
  }
  return `/tickets/${ticketId}`;
}

export async function loadNotifications(userId: string, role: Role) {
  const supabase = await createClient();
  const [{ data, error }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, ticket_id, ticket_number, summary, status, created_at, read_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null),
  ]);
  if (error) throw error;

  const items: AppNotification[] = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    ticketId: row.ticket_id,
    ticketNumber: row.ticket_number,
    summary: row.summary,
    status: row.status as TicketStatus,
    createdAt: row.created_at,
    readAt: row.read_at,
    href: hrefFor(role, row.kind as NotificationKind, row.ticket_id),
  }));

  return { items, unreadCount: count ?? 0 };
}
