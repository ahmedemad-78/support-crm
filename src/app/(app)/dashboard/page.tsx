import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cairoDate, type DashboardTicket } from "@/lib/tickets/dashboard-model";
import { parseDashboardFilters } from "@/lib/tickets/filters";
import type { TicketSource, TicketStatus } from "@/lib/tickets/constants";
import { DashboardBoard } from "./dashboard-board";

type DbRow = {
  status: TicketStatus;
  source: TicketSource;
  created_at: string;
  resolved_at: string | null;
  end_user_type: string | null;
  city_id: number | null;
  issue_category_id: number | null;
  issue_categories: { name: string } | { name: string }[] | null;
  root_causes: { name: string } | { name: string }[] | null;
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  await requireUser(["support_agent", "manager"]);
  const filters = parseDashboardFilters(await searchParams);
  const supabase = await createClient();

  const [cities, categories, tickets] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("issue_categories").select("id, name").eq("is_active", true).order("name"),
    loadTickets(),
  ]);
  if (cities.error) throw cities.error;
  if (categories.error) throw categories.error;

  async function loadTickets(): Promise<DashboardTicket[]> {
    const pageSize = 1000;
    const loaded: DashboardTicket[] = [];
    for (let from = 0; from < 10000; from += pageSize) {
      const { data, error } = await supabase
        .from("tickets")
        .select("status, source, created_at, resolved_at, end_user_type, city_id, issue_category_id, issue_categories(name), root_causes(name)")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = (data ?? []) as DbRow[];
      loaded.push(...batch.map(toTicket));
      if (batch.length < pageSize) break;
    }
    return loaded;
  }

  return (
    <AgentFrame title="Dashboard">
      <DashboardBoard
        tickets={tickets}
        initialFilters={filters}
        cities={(cities.data ?? []).map((city) => ({ id: String(city.id), name: city.name }))}
        categories={(categories.data ?? []).map((category) => ({ id: String(category.id), name: category.name }))}
      />
    </AgentFrame>
  );
}

function toTicket(row: DbRow): DashboardTicket {
  return {
    status: row.status,
    source: row.source,
    createdOn: cairoDate(row.created_at),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    endUserType: row.end_user_type ?? "",
    cityId: row.city_id == null ? "" : String(row.city_id),
    categoryId: row.issue_category_id == null ? "" : String(row.issue_category_id),
    category: nameOf(row.issue_categories),
    cause: nameOf(row.root_causes),
  };
}

function nameOf(value: { name: string } | { name: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? "";
}
