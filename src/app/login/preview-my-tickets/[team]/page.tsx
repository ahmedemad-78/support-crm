import { notFound } from "next/navigation";
import { Sidebar } from "@/components/app-shell/sidebar";
import { navFor } from "@/components/app-shell/nav";
import { PortalTicketList } from "@/components/tickets/portal-ticket-list";
import { portalFilters, type PortalTicketRow, type PortalView, type PortalWorkspaceData } from "@/lib/tickets/portal-workspace";
import type { CurrentUser } from "@/lib/auth/roles";
import type { TicketStatus } from "@/lib/tickets/constants";
export default async function PreviewMyTickets({params,searchParams}:{params:Promise<{team:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.NODE_ENV!=="development")notFound();
 const {team}=await params;const p=await searchParams;const f=portalFilters(p);const role=team==="moderation"?"moderation":"call_center";
 const user:CurrentUser={id:"10000000-0000-4000-8000-000000000001",role,isAdmin:false,email:"fixture@example.com",fullName:role==="moderation"?"Sonia · Demo":"Kabany · Demo"};
 const statuses:TicketStatus[]=["awaiting_customer","in_progress","resolved","new","closed","resolved"];
 const examples=["العميل دفع الاشتراك ولسه المحتوى مقفول، محتاجين تأكيد التفعيل والخطوات اللي يرجع بيها للعميل.","Student cannot sign in after changing their phone number.","Payment confirmed and subscription restored.","A lesson video stops playing on the exercise screen.","The customer did not respond to the requested details.","The same account problem was reopened, then resolved again."];
 const all:PortalTicketRow[]=p.scenario==="empty"?[]:Array.from({length:31},(_,i)=>({id:`10000000-0000-4000-8000-${String(i+10).padStart(12,"0")}`,ticket_number:`TKT-2026-${String(1000+i).padStart(5,"0")}`,issue_description:examples[i%6],customer_name:i%3===0?"محمود عبد الرحمن · بيانات تجريبية":"Demo customer "+(i+1),status:statuses[i%6],source:role,created_at:new Date(Date.parse("2026-11-11T18:00:00Z")-(i+2)*86400000).toISOString(),updated_at:new Date(Date.parse("2026-11-11T18:00:00Z")-(i+1)*3600000).toISOString(),last_activity_at:new Date(Date.parse("2026-11-11T18:00:00Z")-(i+1)*1800000).toISOString(),reopen_count:i%6===1?2:i%6===5?3:0,last_reopened_at:i%6===1||i%6===5?new Date(Date.parse("2026-11-11T18:00:00Z")-86400000).toISOString():null,unread_replies:i<3?[2,1,1][i]:0}));
 const matches=(t:PortalTicketRow,view:PortalView)=>view==="open"?!["resolved","closed"].includes(t.status):view==="waiting"?t.status==="awaiting_customer":view==="unread"?t.unread_replies>0:view==="reopened"?t.reopen_count>0:view==="finished"?["resolved","closed"].includes(t.status):true;
 const summary=Object.fromEntries(["all","open","waiting","unread","reopened","finished"].map(view=>[view,all.filter(t=>matches(t,view as PortalView)).length])) as PortalWorkspaceData["summary"];
 summary.unread_replies=all.reduce((n,t)=>n+t.unread_replies,0);
 const rows=all.filter(t=>matches(t,f.view)&&`${t.ticket_number} ${t.customer_name} ${t.issue_description}`.toLowerCase().includes(f.q.toLowerCase())).sort((a,b)=>f.sort==="unread"?b.unread_replies-a.unread_replies||b.last_activity_at.localeCompare(a.last_activity_at):f.sort==="oldest"?a.created_at.localeCompare(b.created_at):b.last_activity_at.localeCompare(a.last_activity_at));
 const pages=Math.max(1,Math.ceil(rows.length/25));const page=Math.min(f.page,pages);const data:PortalWorkspaceData={rows:rows.slice((page-1)*25,page*25),page,pages,page_size:25,matched:rows.length,summary};
 return <div className="flex min-h-svh flex-col lg:flex-row"><Sidebar user={user} sections={navFor(user)}/><main className="workspace-main min-w-0 flex-1"><div className="border-b bg-amber-50 px-6 py-2 text-xs text-amber-900">DEVELOPMENT PREVIEW · synthetic cases · no customer writes</div><PortalTicketList data={data} filters={f} team={role==="moderation"?"Moderation":"Call Center"} userId={user.id} preview baseHref={`/login/preview-my-tickets/${role}`} detailHref={`/login/preview-portal-ticket?role=${role}`} newTicketHref={`/login/preview-intake?portal=1&role=${role}`}/></main></div>;
}
