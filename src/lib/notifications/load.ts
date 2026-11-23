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
  const [{ data, error }, { count }, work, workCount] = await Promise.all([
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
    supabase.from("work_notifications").select("id,ticket_id,summary,read_at,created_at,ticket:work_tickets(ticket_number,state)").eq("recipient_id",userId).order("created_at",{ascending:false}).limit(20),
    supabase.from("work_notifications").select("id",{count:"exact",head:true}).eq("recipient_id",userId).is("read_at",null),
  ]);
  if (error) throw error;
  if(work.error)throw work.error;
  if(workCount.error)throw workCount.error;

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

  for(const row of work.data??[]){const ticket=(Array.isArray(row.ticket)?row.ticket[0]:row.ticket) as {ticket_number:string;state:string}|null;if(!ticket)continue;const status:TicketStatus=ticket.state==="awaiting_owner"?"awaiting_customer":ticket.state==="resolved"?"resolved":["cancelled","closed_no_response"].includes(ticket.state)?"closed":ticket.state==="in_progress"?"in_progress":"new";items.push({id:row.id,kind:"status_changed",ticketId:row.ticket_id,ticketNumber:ticket.ticket_number,summary:row.summary,status,createdAt:row.created_at,readAt:row.read_at,href:"/work/"+row.ticket_id,workState:ticket.state});}
  items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return { items:items.slice(0,20), unreadCount: (count ?? 0)+(workCount.count??0) };
}
