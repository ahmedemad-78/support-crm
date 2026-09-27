import Link from "next/link";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { PrintButton } from "@/components/app-shell/print-button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  END_USER_TYPE_LABELS,
  END_USER_TYPES,
  SOURCE_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  type TicketSource,
  type TicketStatus,
} from "@/lib/tickets/constants";
import { dashboardQuery, parseDashboardFilters } from "@/lib/tickets/filters";

type Row = {
  status: TicketStatus;
  source: TicketSource;
  created_at: string;
  resolved_at: string | null;
  end_user_type: string | null;
  issue_categories: { name: string } | { name: string }[] | null;
  root_causes: { name: string } | { name: string }[] | null;
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  await requireUser(["support_agent", "manager"]);
  const filters = parseDashboardFilters(await searchParams);
  const supabase = await createClient();

  const [cities, categories] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("name"),
    supabase.from("issue_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  let query = supabase
    .from("tickets")
    .select("status, source, created_at, resolved_at, end_user_type, issue_categories(name), root_causes(name)")
    .gte("created_at", `${filters.from}T00:00:00`)
    .lte("created_at", `${filters.to}T23:59:59`);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.city) query = query.eq("city_id", filters.city);
  if (filters.category) query = query.eq("issue_category_id", filters.category);
  if (filters.userType) query = query.eq("end_user_type", filters.userType);

  const { data, error } = await query.limit(2000);
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  const openStatuses = new Set<TicketStatus>(["new", "in_progress", "awaiting_customer"]);
  const open = rows.filter((row) => openStatuses.has(row.status));
  const resolved = rows.filter((row) => row.status === "resolved" || row.status === "closed");
  const durations = rows
    .filter((row) => row.resolved_at)
    .map((row) => (new Date(row.resolved_at!).getTime() - new Date(row.created_at).getTime()) / 3_600_000);
  const averageHours = durations.length ? durations.reduce((sum, hours) => sum + hours, 0) / durations.length : null;

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const maxDay = Math.max(1, ...days.map(([, count]) => count));

  const bySource = countBy(rows, (row) => SOURCE_LABELS[row.source]);
  const byCause = countBy(rows, (row) => nameOf(row.root_causes) || "Not set");
  const resolutionByCategory = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.resolved_at) continue;
    const category = nameOf(row.issue_categories) || "Uncategorized";
    const hours = (new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000;
    const list = resolutionByCategory.get(category) ?? [];
    list.push(hours);
    resolutionByCategory.set(category, list);
  }

  const queryString = dashboardQuery(filters);

  return (
    <AgentFrame title="Dashboard">
      <div className="flex flex-1 flex-col gap-5 px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a href={`/dashboard/export${queryString}`} className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-semibold">
            Export CSV
          </a>
          <PrintButton />
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
            <input type="date" name="from" defaultValue={filters.from} aria-label="From" className="bg-transparent outline-none" />
            <span className="text-muted-foreground">–</span>
            <input type="date" name="to" defaultValue={filters.to} aria-label="To" className="bg-transparent outline-none" />
          </label>
          <DashSelect name="source" label="Source" value={filters.source}>
            <option value="">Source: All</option>
            {(Object.keys(SOURCE_LABELS) as TicketSource[]).map((source) => (
              <option key={source} value={source}>Source: {SOURCE_LABELS[source]}</option>
            ))}
          </DashSelect>
          <DashSelect name="status" label="Status" value={filters.status}>
            <option value="">Status: All</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>Status: {STATUS_LABELS[status]}</option>
            ))}
          </DashSelect>
          <DashSelect name="city" label="City" value={filters.city}>
            <option value="">City: All</option>
            {(cities.data ?? []).map((city) => (
              <option key={city.id} value={city.id}>City: {city.name}</option>
            ))}
          </DashSelect>
          <DashSelect name="category" label="Issue category" value={filters.category}>
            <option value="">Issue category: All</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>Issue category: {category.name}</option>
            ))}
          </DashSelect>
          <DashSelect name="userType" label="User type" value={filters.userType}>
            <option value="">User type: All</option>
            {END_USER_TYPES.map((type) => (
              <option key={type} value={type}>User type: {END_USER_TYPE_LABELS[type]}</option>
            ))}
          </DashSelect>
          <button type="submit" className="h-9 rounded-lg bg-brand-action px-3 text-sm font-semibold text-white">Apply</button>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Clear</Link>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Tickets created" value={String(rows.length)} detail="In the selected range" />
          <Kpi
            label="Open right now"
            value={String(open.length)}
            detail={`${countStatus(rows, "new")} new · ${countStatus(rows, "in_progress")} in progress · ${countStatus(rows, "awaiting_customer")} awaiting`}
          />
          <Kpi label="Avg. resolution time" value={averageHours == null ? "—" : `${averageHours.toFixed(1)} h`} detail="From creation to resolved" />
          <Kpi
            label="Resolved or closed"
            value={String(resolved.length)}
            detail={rows.length ? `${Math.round((resolved.length / rows.length) * 100)}% of tickets created` : "No tickets in this range"}
          />
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No results for these filters.</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Tickets per day">
              <div className="flex h-40 items-end gap-1">
                {days.map(([day, count]) => (
                  <div key={day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-brand" style={{ height: `${(count / maxDay) * 100}%` }} title={`${day}: ${count}`} />
                    <span className="text-[10px] text-muted-foreground">{day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="By source">
              <Bars entries={[...bySource.entries()]} />
            </Panel>
            <Panel title="Resolution time by category">
              <Bars
                entries={[...resolutionByCategory.entries()].map(([label, hours]) => [
                  label,
                  Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10,
                ])}
                suffix=" h"
              />
            </Panel>
            <Panel title="Top root causes">
              <Bars entries={[...byCause.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)} />
            </Panel>
          </div>
        )}
      </div>
    </AgentFrame>
  );
}

function countStatus(rows: Row[], status: TicketStatus) {
  return rows.filter((row) => row.status === status).length;
}

function countBy(rows: Row[], key: (row: Row) => string) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + 1);
  return map;
}

function nameOf(value: { name: string } | { name: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? "";
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ entries, suffix = "" }: { entries: [string, number][]; suffix?: string }) {
  const max = Math.max(1, ...entries.map(([, value]) => value));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No results.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([label, value]) => (
        <li key={label}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{label}</span>
            <span className="text-muted-foreground">{value}{suffix}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-brand-action" style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DashSelect({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <select name={name} aria-label={label} defaultValue={value} className="h-9 rounded-lg border bg-background px-3 text-sm">
      {children}
    </select>
  );
}
