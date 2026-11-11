import "server-only";
import { createClient } from "@/lib/supabase/server";
export async function loadCaseWorkflow(id: string) {
  const db = await createClient();
  const [{ data: ticket, error }, events] = await Promise.all([
    db.from("tickets").select("reporter_id, created_by, reopen_count, contact_channel, linked_ticket_id, reporter:profiles!tickets_reporter_id_fkey(full_name)").eq("id",id).single(),
    db.from("ticket_workflow_events").select("id, kind, body, created_at, actor_id, to_status, resolution_snapshot, actor:profiles!ticket_workflow_events_actor_id_fkey(full_name,role)").eq("ticket_id",id).order("created_at",{ascending:false}),
  ]);
  if(error) throw error; if(events.error) throw events.error;
  const relation = ticket.reporter as unknown as { full_name: string } | null;
  return { ...ticket, reporterName: relation?.full_name || "Legacy case · original submitter", events: (events.data ?? []).map(event => ({...event, actorName: (event.actor as unknown as {full_name:string}|null)?.full_name || "Team member", actorRole:(event.actor as unknown as {role:string}|null)?.role || null})) };
}
