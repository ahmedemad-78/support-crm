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
  const user: CurrentUser = { id:"10000000-0000-4000-8000-000000000001", email:"demo@example.com", fullName:"Ahmed Emad", role:params.portal === "1" ? "call_center" : "support_agent", isAdmin:true };
  return <div className="flex min-h-svh flex-col lg:flex-row"><Sidebar user={user} sections={navFor(user)} /><main className="workspace-main min-w-0 flex-1"><div style={{ padding: 16, background: "#e7edde", fontSize: 12 }}>Development preview · synthetic data · no customer writes</div><NewTicketForm today={cairoDate(new Date().toISOString())} cities={[{ id: 1, name: "Cairo" }, { id: 2, name: "Alexandria" }]} lockedSource="call_center" sources={params.portal === "1" ? undefined : [{ code: "whatsapp", name: "WhatsApp", reporter_name: "Ahmed Emad" }, { code: "call_center", name: "Call Center", reporter_name: "Kabany" }]} preview={params.scenario === "uploads" ? "uploads" : "failure"} cancelHref="/login/preview-intake" /></main></div>;
}
