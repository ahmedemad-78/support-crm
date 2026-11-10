import { notFound } from "next/navigation";
import { NewTicketForm } from "@/app/(app)/portal/new-ticket/new-ticket-form";
import { cairoDate } from "@/lib/tickets/dashboard-model";

/** Synthetic UI exercise; no real ticket or file is written. */
export default async function PreviewIntake({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <main className="workspace-main"><div style={{ padding: 16, background: "#e7edde", fontSize: 12 }}>Development preview · synthetic data · no customer writes</div><NewTicketForm today={cairoDate(new Date().toISOString())} cities={[{ id: 1, name: "Cairo" }, { id: 2, name: "Alexandria" }]} sources={params.portal === "1" ? undefined : [{ code: "whatsapp", name: "WhatsApp", reporter_name: "Ahmed Emad" }, { code: "call_center", name: "Call", reporter_name: "Kabany" }]} preview={params.scenario === "uploads" ? "uploads" : "failure"} cancelHref="/login/preview-intake" /></main>;
}
