import { z } from "zod";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewTicketForm } from "../../portal/new-ticket/new-ticket-form";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import { safeAppReturn } from "@/lib/tickets/filters";

export default async function SupportNewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser(["support_agent"]);
  const params = await searchParams;
  const rawReturn = params.returnTo;
  const linked = typeof params.linked === "string" && z.uuid().safeParse(params.linked).success ? params.linked : "";
  const cancelHref = safeAppReturn(typeof rawReturn === "string" ? rawReturn : undefined) || "/tickets";
  const supabase = await createClient();
  const [cities, sources, reporters] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("ticket_sources").select("code, name, bound_role, default_reporter_id, reporter:profiles!ticket_sources_default_reporter_id_fkey(full_name)").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("profiles").select("id, full_name, role").eq("is_active",true).order("full_name"),
  ]);
  if (cities.error) throw cities.error;
  if (sources.error) throw sources.error;
  if (reporters.error) throw reporters.error;

  return (
    <AgentFrame title="Create case">
      <NewTicketForm reporters={reporters.data ?? []} cities={cities.data ?? []} sources={(sources.data ?? []).map(source => ({...source, reporter_name: (source.reporter as unknown as {full_name:string}|null)?.full_name || "Owner unavailable"}))} linkedTicketId={linked} cancelHref={cancelHref} today={cairoDate(new Date().toISOString())} />
    </AgentFrame>
  );
}
