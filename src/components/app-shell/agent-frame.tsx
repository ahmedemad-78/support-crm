import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceBar, type TicketAlert } from "./workspace-bar";
import type { TicketSource } from "@/lib/tickets/constants";

export async function AgentFrame({ title, children }: { title: string; children: React.ReactNode }) {
  await requireUser(["support_agent", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("id, ticket_number, source, issue_description, created_at")
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(4);

  const alerts: TicketAlert[] = (data ?? []).map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    source: ticket.source as TicketSource,
    summary: ticket.issue_description,
    createdAt: ticket.created_at,
  }));

  return (
    <>
      <WorkspaceBar title={title} alerts={alerts} />
      {children}
    </>
  );
}
