import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadAnalytics } from "@/lib/tickets/load-analytics";
import { parseDashboardFilters } from "@/lib/tickets/filters";
import { DashboardBoard } from "./analytics-dashboard";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  await requireUser(["support_agent", "manager"]);
  const filters = parseDashboardFilters(await searchParams);
  const supabase = await createClient();
  const [cities, categories, snapshot] = await Promise.all([
    supabase.from("cities").select("id, name").order("name"),
    supabase.from("issue_categories").select("id, name").order("name"),
    loadAnalytics(),
  ]);
  if (cities.error) throw cities.error;
  if (categories.error) throw categories.error;
  return (
    <AgentFrame title="Dashboard">
      <DashboardBoard
        initialSnapshot={snapshot}
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
