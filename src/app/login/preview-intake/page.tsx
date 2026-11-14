import { notFound } from "next/navigation";
import { NewTicketForm } from "@/app/(app)/portal/new-ticket/new-ticket-form";
import { Sidebar } from "@/components/app-shell/sidebar";
import { navFor } from "@/components/app-shell/nav";
import type { CurrentUser } from "@/lib/auth/roles";
import { cairoDate } from "@/lib/tickets/dashboard-model";

/** Synthetic UI exercise; no real ticket or file is written. */
export default async function PreviewIntake({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const portalRole=params.role==="june_schools"?"june_schools":params.role==="moderation"?"moderation":"call_center";
  const user: CurrentUser = { id:"10000000-0000-4000-8000-000000000001", email:"demo@example.com", fullName:params.portal==="1"?"Reporting colleague":"Ahmed Emad", role:params.portal === "1" ? portalRole : "support_agent", isAdmin:params.portal!=="1" };
  return <div className="flex min-h-svh flex-col lg:flex-row"><Sidebar user={user} sections={navFor(user)} /><main className="workspace-main min-w-0 flex-1"><div style={{ padding: 16, background: "#e7edde", fontSize: 12 }}>Development preview · synthetic data · no customer writes</div><NewTicketForm today={cairoDate(new Date().toISOString())} cities={[{ id: 1, name: "Cairo" }, { id: 2, name: "Alexandria" }]} reporters={[{id:"10000000-0000-4000-8000-000000000001",full_name:"Ahmed Emad",role:"support_agent"},{id:"10000000-0000-4000-8000-000000000002",full_name:"Kabany",role:"call_center"},{id:"10000000-0000-4000-8000-000000000003",full_name:"Call Center colleague",role:"call_center"},{id:"10000000-0000-4000-8000-000000000004",full_name:"Yasser Arab",role:"june_schools"}]} lockedSource={portalRole} sources={params.portal === "1" ? undefined : [{code:"june_schools",name:"30 June Schools",reporter_name:"Yasser Arab",default_reporter_id:"10000000-0000-4000-8000-000000000004",bound_role:"june_schools"},{ code: "whatsapp", name: "WhatsApp", reporter_name: "Ahmed Emad",default_reporter_id:"10000000-0000-4000-8000-000000000001",bound_role:null }, { code: "call_center", name: "Call Center", reporter_name: "Kabany",default_reporter_id:"10000000-0000-4000-8000-000000000002",bound_role:"call_center" }]} preview={params.scenario === "uploads" ? "uploads" : params.scenario==="success"?"success":"failure"} cancelHref="/login/preview-intake" /></main></div>;
}
