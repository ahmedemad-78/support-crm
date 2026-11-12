import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadAnalytics } from "@/lib/tickets/load-analytics";
import { parseBusinessFilters } from "@/lib/tickets/business-analytics";
import { DashboardBoard } from "./analytics-dashboard";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const user=await requireUser(["support_agent", "manager"]);
  const raw=await searchParams;const filters = parseBusinessFilters(raw);
  const supabase = await createClient();
  const [cities, categories, snapshot] = await Promise.all([
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("issue_categories").select("id, name").order("name"),
    loadAnalytics(),
  ]);
  if (cities.error) throw cities.error;
  if (categories.error) throw categories.error;
  return (
    <AgentFrame title="Analytics" hideTicketSearch>
      <DashboardBoard
        initialSnapshot={snapshot}
        userId={user.id}
        initialTab={typeof raw.tab==="string"?raw.tab:undefined}
        initialFilters={filters}
        cities={(cities.data ?? []).map((c) => ({
          id: String(c.id),
          name: c.name,
        }))}
        categories={(categories.data ?? []).map((c) => ({
          id: String(c.id),
          name: c.name,
        }))}
      />
    </AgentFrame>
  );
}
