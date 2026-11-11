import { notFound } from "next/navigation";
import { CaseFollowup } from "@/components/tickets/case-followup";
import "@/app/(app)/tickets/workspace.css";
export default async function LifecyclePreview({ searchParams }: PageProps<"/login/preview-lifecycle">){
  const params=await searchParams;
  if(process.env.NODE_ENV !== "development") notFound();
  return <main className="workspace-main"><div className="case-file desk-case"><header className="desk-case-heading"><span className="desk-eyebrow">DEVELOPMENT PREVIEW / SYNTHETIC DATA</span><h2>TKT-DEMO-0042 · A full case history.</h2><p>Reporting owner: Kabany · Entered by Ahmed Emad · Support assignee: Ahmed Emad</p><p>In-app: reporter receives support updates; support receives reporter replies. Email deferred.</p></header><CaseFollowup preview perspective={params.mode === "reporter" ? "reporter" : "support"} reporterName="Kabany" ticketId="11111111-1111-4111-8111-111111111111" version="2026-11-10T12:00:00Z" status="resolved" count={1} canReply={params.mode !== "readonly"} relatedHref="/login/preview-intake" events={params.mode === "empty" ? [] : [
    {id:"4",kind:"resolved",body:"The subscription was activated after resyncing the account.\nCause: Payment sync delay\nAction: Account resync\nOutcome: Fixed",created_at:"2026-11-10T12:00:00Z",actor_id:null,actorRole:"support_agent",actorName:"Ahmed Emad",to_status:"resolved",resolution_snapshot:{response:"The subscription was activated after resyncing the account.",cause:"Payment sync delay",action:"Account resync",outcome:"Fixed"}},
    {id:"3b",kind:"comment",body:"بنراجع تفعيل الاشتراك بعد تحديث بيانات الحساب.\nهأكد لك أول ما المراجعة تخلص.",created_at:"2026-11-10T11:15:00Z",actor_id:null,actorRole:"support_agent",actorName:"Ahmed Emad",to_status:null,resolution_snapshot:null},
    {id:"3a",attachments:[{id:"image-demo",file_name:"Example screenshot.jpg",mime_type:"image/jpeg",url:"/brand/logo.jpg"}],kind:"comment",body:"تمام، العميل مستني تأكيد مننا قبل ما يجرب تاني.",created_at:"2026-11-10T11:10:00Z",actor_id:null,actorRole:"call_center",actorName:"Kabany",to_status:null,resolution_snapshot:null},
    {id:"3",kind:"reopened",body:"العميل جرب يسجل خروج ودخول ولسه الاشتراك مش ظاهر.",created_at:"2026-11-10T11:00:00Z",actor_id:null,actorRole:"call_center",actorName:"Kabany",to_status:"in_progress",resolution_snapshot:null},
    {id:"2",kind:"resolved",body:"Payment verified. Asked the customer to sign in again.",created_at:"2026-11-10T10:00:00Z",actor_id:null,actorRole:"support_agent",actorName:"Ahmed Emad",to_status:"resolved",resolution_snapshot:{response:"Payment verified. Asked the customer to sign in again."}},
    {id:"1",kind:"created",body:"Subscription is not visible after payment.",created_at:"2026-11-10T09:00:00Z",actor_id:null,actorRole:"support_agent",actorName:"Ahmed Emad on behalf of Kabany",to_status:"new",resolution_snapshot:null},
  ]} /></div></main>;
}
