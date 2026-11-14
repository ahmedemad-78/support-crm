import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { UserNotifications } from "@/components/app-shell/user-notifications";
import { PortalCaseFile } from "@/components/tickets/portal-case-file";
import type { CaseRecord } from "@/components/tickets/case-workspace";
import { PORTAL_ROLES } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET, type TicketStatus } from "@/lib/tickets/constants";
import { loadCaseWorkflow } from "@/lib/tickets/workflow";
import { portalReturnHref } from "@/lib/tickets/portal-workspace";
export default async function PortalTicketPage({params,searchParams}:PageProps<"/portal/my-tickets/[ticketId]">){
 const user=await requireUser([...PORTAL_ROLES]);const {ticketId}=await params;const query=await searchParams;
 if(!z.uuid().safeParse(ticketId).success)notFound();
 const db=await createClient();
 const {data:ticket,error}=await db.from("tickets").select("id,ticket_number,status,source,created_at,updated_at,customer_name,customer_email,customer_phone,school_name,school_context,credentials_username,issue_date,end_user_type,platform,is_latest_version,app_version,device_type,page_screen,steps,issue_description,fawry_payment,resolution_notes,cities(name)").eq("id",ticketId).or(`reporter_id.eq.${user.id},and(reporter_id.is.null,created_by.eq.${user.id})`).maybeSingle();
 if(error)throw error;if(!ticket)notFound();
 const [history,attachments,workflow]=await Promise.all([
  db.from("ticket_status_history").select("id,to_status,changed_at").eq("ticket_id",ticket.id).order("changed_at",{ascending:false}),
  db.from("ticket_attachments").select("id,file_name,mime_type,size_bytes,storage_path").eq("ticket_id",ticket.id).is("event_id",null).order("created_at"),
  loadCaseWorkflow(ticket.id),
 ]);
 if(history.error)throw history.error;if(attachments.error)throw attachments.error;
 const signed=attachments.data.length?await db.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(attachments.data.map(file=>file.storage_path),600):{data:[]};
 const urls=new Map(signed.data?.map(file=>[file.path,file.signedUrl]));
 const backHref=portalReturnHref(query.returnTo);
 return <><header className="flex min-h-16 items-center justify-between gap-4 border-b bg-background px-5 py-3 sm:px-8"><nav className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-label="Breadcrumb"><Link href={backHref}>My tickets</Link><span>/</span><span className="font-mono">{ticket.ticket_number}</span></nav><UserNotifications/></header><PortalCaseFile ticket={{...ticket,status:ticket.status as TicketStatus} as CaseRecord&{resolution_notes:string|null}} city={relationName(ticket.cities)} attachments={attachments.data.map(file=>({...file,url:urls.get(file.storage_path)}))} history={history.data??[]} reporter={user.fullName} recordedBy={workflow.recordedByName} reopenCount={workflow.reopen_count} events={workflow.events} unreadReplyEvents={workflow.unreadReplyEvents} backHref={backHref} relatedHref={`/portal/new-ticket?linked=${ticket.id}`}/></>;
}
function relationName(value:unknown):string{const row=Array.isArray(value)?value[0]:value;return row&&typeof row==="object"&&"name" in row&&typeof row.name==="string"&&row.name?row.name:"Not recorded";}
