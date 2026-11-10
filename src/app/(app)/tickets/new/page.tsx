import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewTicketForm } from "../../portal/new-ticket/new-ticket-form";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import { safeAppReturn } from "@/lib/tickets/filters";

export default async function SupportNewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser(["support_agent"]);
  const rawReturn = (await searchParams).returnTo;
  const cancelHref = safeAppReturn(typeof rawReturn === "string" ? rawReturn : undefined) || "/tickets";
  const supabase = await createClient();
  const [cities, sources] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("ticket_sources").select("code, name").eq("is_active", true).order("sort_order").order("name"),
  ]);
  if (cities.error) throw cities.error;
  if (sources.error) throw sources.error;

  return (
    <AgentFrame title="Create case">
      <NewTicketForm cities={cities.data ?? []} sources={sources.data ?? []} cancelHref={cancelHref} today={cairoDate(new Date().toISOString())} />
    </AgentFrame>
  );
}
