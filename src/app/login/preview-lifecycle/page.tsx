import { notFound } from "next/navigation";
import { CaseFollowup } from "@/components/tickets/case-followup";
import "@/app/(app)/tickets/workspace.css";
export default function LifecyclePreview(){
  if(process.env.NODE_ENV !== "development") notFound();
  return <main className="workspace-main"><div className="case-file desk-case"><header className="desk-case-heading"><span className="desk-eyebrow">DEVELOPMENT PREVIEW / SYNTHETIC DATA</span><h2>TKT-DEMO-0042 · A full case history.</h2><p>Reporting owner: Kabany · Entered by Ahmed Emad · Support assignee: Ahmed Emad</p><p>Rollout: notifications go to Ahmed only.</p></header><CaseFollowup preview ticketId="11111111-1111-4111-8111-111111111111" version="2026-11-10T12:00:00Z" status="resolved" count={1} canReply relatedHref="/login/preview-intake" events={[
    {id:"4",kind:"resolved",body:"The subscription was activated after resyncing the account.\nCause: Payment sync delay\nAction: Account resync\nOutcome: Fixed",created_at:"2026-11-10T12:00:00Z",actor_id:null,actorName:"Ahmed Emad",to_status:"resolved",resolution_snapshot:{response:"Second solution"}},
    {id:"3",kind:"reopened",body:"العميل جرب يسجل خروج ودخول ولسه الاشتراك مش ظاهر.",created_at:"2026-11-10T11:00:00Z",actor_id:null,actorName:"Kabany",to_status:"in_progress",resolution_snapshot:null},
    {id:"2",kind:"resolved",body:"Payment verified. Asked the customer to sign in again.",created_at:"2026-11-10T10:00:00Z",actor_id:null,actorName:"Ahmed Emad",to_status:"resolved",resolution_snapshot:{response:"Original solution"}},
    {id:"1",kind:"created",body:"Subscription is not visible after payment.",created_at:"2026-11-10T09:00:00Z",actor_id:null,actorName:"Ahmed Emad on behalf of Kabany",to_status:"new",resolution_snapshot:null},
  ]} /></div></main>;
}
