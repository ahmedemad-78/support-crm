import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENTS_BUCKET } from "./constants";
export async function loadCaseWorkflow(id: string) {
  const db = await createClient();
  const [{ data: ticket, error }, events,notices] = await Promise.all([
    db.from("tickets").select("reporter_id, created_by, reopen_count, contact_channel, linked_ticket_id, reporter:profiles!tickets_reporter_id_fkey(full_name)").eq("id",id).single(),
    db.from("ticket_workflow_events").select("id, kind, body, created_at, actor_id, to_status, resolution_snapshot, actor:profiles!ticket_workflow_events_actor_id_fkey(full_name,role)").eq("ticket_id",id).order("created_at",{ascending:false}),
    db.from("notifications").select("event_id,event:ticket_workflow_events!inner(kind)").eq("ticket_id",id).is("read_at",null).in("event.kind",["comment","resolved"]).order("created_at",{ascending:false}).limit(500),
  ]);
  if(error) throw error; if(events.error) throw events.error;
  if(notices.error)throw notices.error;
  // The ticket/events above are checked with the viewer's RLS first. Read only
  // display identity for these exact actors; never expose general profile access.
  const actorIds=[...new Set([ticket.created_by,...(events.data??[]).flatMap(event=>event.actor_id?[event.actor_id]:[])])];
  const identities=actorIds.length?await createAdminClient().from("profiles").select("id,full_name,role").in("id",actorIds):{data:[],error:null};
  if(identities.error)throw identities.error;
  const actors=new Map((identities.data??[]).map(actor=>[actor.id,actor]));
  const media=await db.from("ticket_attachments").select("id,event_id,file_name,mime_type,size_bytes,storage_path").eq("ticket_id",id).not("event_id","is",null).order("created_at");
  if(media.error)throw media.error;
  const signed=media.data.length?await db.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(media.data.map(file=>file.storage_path),600):{data:[]};
  const urls=new Map(signed.data?.map(file=>[file.path,file.signedUrl]));
  const relation = ticket.reporter as unknown as { full_name: string } | null;
  const replyEvents=new Set((events.data??[]).filter(event=>["comment","resolved"].includes(event.kind)).map(event=>event.id));
  const unreadReplyEvents=(notices.data??[]).flatMap(notice=>notice.event_id&&replyEvents.has(notice.event_id)?[notice.event_id]:[]);
  return { ...ticket, unreadReplyEvents, recordedByName:actors.get(ticket.created_by)?.full_name||"Team member", reporterName: relation?.full_name || "Legacy case · original submitter", events: (events.data ?? []).map(event => ({...event, actorName: actors.get(event.actor_id)?.full_name || "Team member", actorRole:actors.get(event.actor_id)?.role || null,attachments:media.data.filter(file=>file.event_id===event.id).map(file=>({...file,url:urls.get(file.storage_path)}))})) };
}
