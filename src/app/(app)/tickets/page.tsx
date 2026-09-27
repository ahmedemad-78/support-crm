import Link from "next/link";
import { Search, X } from "lucide-react";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { StatusBadge } from "@/components/tickets/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  SOURCE_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  type TicketSource,
  type TicketStatus,
} from "@/lib/tickets/constants";
import {
  PAGE_SIZE,
  parseTicketListFilters,
  rangeStart,
  ticketListQuery,
  type TicketListFilters,
  type TicketView,
} from "@/lib/tickets/filters";

const VIEW_LABELS: Record<TicketView, string> = {
  all: "All tickets",
  new: "New",
  mine: "Assigned to me",
  awaiting: "Awaiting customer",
  resolved: "Resolved",
};

export default async function TicketsPage({
  searchParams,
}: PageProps<"/tickets">) {
  const user = await requireUser(["support_agent", "manager"]);
  const filters = parseTicketListFilters(await searchParams);
  const supabase = await createClient();

  const [cities, categories, agents] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("issue_categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "support_agent").eq("is_active", true).order("full_name"),
  ]);
  for (const result of [cities, categories, agents]) {
    if (result.error) throw result.error;
  }

  const db = supabase as unknown as { from: (table: string) => TicketQuery };

  const viewCounts = await Promise.all(
    (Object.keys(VIEW_LABELS) as TicketView[]).map(async (view) => {
      const { count, error } = await applyFilters(db, "id", { ...filters, view, page: 1 }, user.id, true);
      if (error) throw error;
      return [view, count ?? 0] as const;
    }),
  );
  const counts = Object.fromEntries(viewCounts) as Record<TicketView, number>;

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data: tickets, count, error } = await applyFilters(
    db,
    "id, ticket_number, issue_description, customer_name, source, status, created_at, cities(name), assignee:profiles!tickets_assignee_id_fkey(full_name)",
    filters,
    user.id,
    false,
    from,
  );
  if (error) throw error;

  const total = count ?? 0;
  const start = total === 0 ? 0 : from + 1;
  const end = Math.min(from + PAGE_SIZE, total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AgentFrame title="Tickets">
      <div className="flex flex-1 flex-col gap-4 px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(VIEW_LABELS) as TicketView[]).map((view) => {
              const active = filters.view === view;
              return (
                <Link
                  key={view}
                  href={`/tickets${ticketListQuery({ ...filters, view, page: 1 })}`}
                  className={
                    active
                      ? "inline-flex h-9 items-center gap-2 rounded-lg bg-background px-3 text-sm font-semibold shadow-sm"
                      : "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-background"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {VIEW_LABELS[view]}
                  <span className={active ? "text-brand-action" : ""}>{counts[view]}</span>
                </Link>
              );
            })}
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            {filters.view !== "all" && <input type="hidden" name="view" value={filters.view} />}
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            <FilterSelect name="status" label="Status" value={filters.status}>
              <option value="">Status</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </FilterSelect>
            <FilterSelect name="source" label="Source" value={filters.source}>
              <option value="">Source</option>
              {(Object.keys(SOURCE_LABELS) as TicketSource[]).map((source) => (
                <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
              ))}
            </FilterSelect>
            <FilterSelect name="city" label="City" value={filters.city}>
              <option value="">City</option>
              {(cities.data ?? []).map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect name="category" label="Issue category" value={filters.category}>
              <option value="">Issue category</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect name="assignee" label="Assignee" value={filters.assignee}>
              <option value="">Assignee</option>
              <option value="unassigned">Unassigned</option>
              {(agents.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.full_name}</option>
              ))}
            </FilterSelect>
            <FilterSelect name="range" label="Date range" value={filters.range}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </FilterSelect>
            <button type="submit" className="h-9 rounded-lg bg-brand-action px-3 text-sm font-semibold text-white">
              Apply
            </button>
            <Link href="/tickets" className="inline-flex h-9 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
              Clear
            </Link>
          </form>
          <form action="/tickets" className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 sm:hidden">
            <Search className="size-4 text-muted-foreground" />
            <input name="q" defaultValue={filters.q} placeholder="Search by ticket ID, name, phone…" className="w-full bg-transparent text-sm outline-none" />
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {(tickets ?? []).map((ticket) => {
                  const city = relationName(ticket.cities);
                  const assignee = relationName(ticket.assignee);
                  return (
                    <tr key={ticket.id} className="border-t hover:bg-muted/60">
                      <td className="px-4 py-3.5">
                        <Link href={`/tickets/${ticket.id}`} className="font-mono text-[13px] font-medium text-brand-action hover:underline">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block font-medium">{ticket.customer_name}</span>
                        {city && <span className="block text-xs text-muted-foreground">{city}</span>}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3.5">{ticket.issue_description}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{SOURCE_LABELS[ticket.source as TicketSource]}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={ticket.status as TicketStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{assignee || "Unassigned"}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{formatRelative(ticket.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total === 0 && (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">No tickets match these filters.</p>
          )}
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <p>Showing {start}–{end} of {total} tickets</p>
            <div className="flex gap-2">
              <PageLink href={filters.page > 1 ? `/tickets${ticketListQuery({ ...filters, page: filters.page - 1 })}` : null}>
                Previous
              </PageLink>
              <PageLink href={filters.page < pages ? `/tickets${ticketListQuery({ ...filters, page: filters.page + 1 })}` : null}>
                Next
              </PageLink>
            </div>
          </div>
        </div>
      </div>
    </AgentFrame>
  );
}

function FilterSelect({
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
    <select
      name={name}
      aria-label={label}
      defaultValue={value}
      className="h-9 rounded-lg border bg-background px-3 text-sm"
    >
      {children}
    </select>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return <span className="rounded-lg border px-3 py-1.5 opacity-40">{children}</span>;
  }
  return <Link href={href} className="rounded-lg border bg-background px-3 py-1.5 hover:bg-muted">{children}</Link>;
}

function relationName(value: unknown): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row && typeof row.name === "string") return row.name;
  if (row && typeof row === "object" && "full_name" in row && typeof row.full_name === "string") return row.full_name;
  return "";
}

type TicketQuery = {
  select: (columns: string, options: { count: "exact"; head?: boolean }) => TicketQuery;
  eq: (column: string, value: string) => TicketQuery;
  is: (column: string, value: null) => TicketQuery;
  gte: (column: string, value: string) => TicketQuery;
  or: (filters: string) => TicketQuery;
  order: (column: string, options: { ascending: boolean }) => TicketQuery;
  range: (from: number, to: number) => TicketQuery;
} & PromiseLike<{ data: TicketRow[] | null; count: number | null; error: { message: string } | null }>;

function applyFilters(
  supabase: { from: (table: string) => TicketQuery },
  columns: string,
  filters: TicketListFilters,
  userId: string,
  head: boolean,
  from = 0,
) {
  let next = supabase.from("tickets").select(columns, { count: "exact", head });
  if (filters.view === "new") next = next.eq("status", "new");
  if (filters.view === "mine") next = next.eq("assignee_id", userId);
  if (filters.view === "awaiting") next = next.eq("status", "awaiting_customer");
  if (filters.view === "resolved") next = next.eq("status", "resolved");
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.source) next = next.eq("source", filters.source);
  if (filters.city) next = next.eq("city_id", filters.city);
  if (filters.category) next = next.eq("issue_category_id", filters.category);
  if (filters.assignee === "unassigned") next = next.is("assignee_id", null);
  else if (filters.assignee) next = next.eq("assignee_id", filters.assignee);
  if (!filters.q) {
    const start = rangeStart(filters.range);
    if (start) next = next.gte("created_at", start);
  }
  if (filters.q) {
    const term = filters.q.replace(/[%_,]/g, "");
    next = next.or(`ticket_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`);
  }
  if (head) return next;
  return next.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
}

type TicketRow = {
  id: string;
  ticket_number: string;
  issue_description: string;
  customer_name: string;
  source: string;
  status: string;
  created_at: string;
  cities: unknown;
  assignee: unknown;
};
