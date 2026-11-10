import { redirect } from "next/navigation";
import { TicketQueue, QUEUE_VIEWS, type QueueRow } from "@/components/tickets/ticket-queue";
import "./workspace.css";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  PAGE_SIZE,
  parseDashboardFilters,
  parseTicketListFilters,
  rangeStart,
  dashboardQuery,
  ticketListQuery,
  type TicketListFilters,
  type TicketView,
} from "@/lib/tickets/filters";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import { loadAnalytics } from "@/lib/tickets/load-analytics";
import { dashboardPopulation, reportedDay, statusGroup } from "@/lib/tickets/overview";
import type { AnalyticsTicket } from "@/lib/tickets/analytics";

const VIEW_LABELS = QUEUE_VIEWS;

export default async function TicketsPage({
  searchParams,
}: PageProps<"/tickets">) {
  const user = await requireUser(["support_agent", "manager"]);
  const rawParams = await searchParams;
  const filters = parseTicketListFilters(rawParams);
  const dashboardFilters = parseDashboardFilters(rawParams);
  const scopeValue = Array.isArray(rawParams.scope) ? rawParams.scope[0] : rawParams.scope;
  const scope = scopeValue === "followup" || scopeValue === "dashboard" ? scopeValue : "";
  if (scope === "followup" && !rawParams.sort) filters.sort = "oldest";
  const supabase = await createClient();

  const [cities, categories, agents, sourceOptions] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("issue_categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "support_agent").eq("is_active", true).order("full_name"),
    supabase.from("ticket_sources").select("code, name, is_active").order("name"),
  ]);
  for (const result of [cities, categories, agents, sourceOptions]) {
    if (result.error) throw result.error;
  }

  const db = supabase as unknown as { from: (table: string) => TicketQuery };
  const extras = scopeParams(rawParams, scope);
  const listHref = (next: Partial<TicketListFilters>) =>
    `/tickets${ticketListQuery({ ...filters, ...next }, extras)}`;
  const from = (filters.page - 1) * PAGE_SIZE;
  const preserved = preservedFields(filters, extras);

  let tickets: TicketRow[] = [];
  let total = 0;
  let counts: Record<TicketView, number>;

  if (scope) {
    const loaded = await loadAnalytics();
    const today = cairoDate(loaded.asOf);
    let population = dashboardPopulation(loaded.tickets, dashboardFilters, today);
    if (scope === "followup") population = population.filter((ticket) => statusGroup(ticket.status) === "followup");
    population = population.filter((ticket) => listDimension(ticket, filters));
    counts = Object.fromEntries(
      (Object.keys(VIEW_LABELS) as TicketView[]).map((view) => [
        view,
        population.filter((ticket) => inListView(ticket, view, user.id)).length,
      ]),
    ) as Record<TicketView, number>;
    const viewRows = population
      .filter((ticket) => inListView(ticket, filters.view, user.id))
      .sort((a, b) =>
        filters.sort === "updated" ? (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
          : filters.sort === "oldest" ? (scope === "followup" ? reportedDay(a).localeCompare(reportedDay(b)) : a.createdAt.localeCompare(b.createdAt)) || a.number.localeCompare(b.number)
          : b.createdAt.localeCompare(a.createdAt) || a.number.localeCompare(b.number),
      );
    total = viewRows.length;
    if (filters.page > Math.max(1, Math.ceil(total / PAGE_SIZE))) redirect(listHref({ page: Math.max(1, Math.ceil(total / PAGE_SIZE)) }));
    const cityNames = new Map((cities.data ?? []).map((city) => [String(city.id), city.name]));
    tickets = viewRows.slice(from, from + PAGE_SIZE).map((ticket) => ({
      id: ticket.id,
      ticket_number: ticket.number,
      issue_description: ticket.subject,
      customer_name: ticket.customerName || "Not recorded",
      source: ticket.source,
      status: ticket.status,
      created_at: ticket.createdAt,
      updated_at: ticket.updatedAt || ticket.createdAt,
      issue_date: ticket.reportedOn || null,
      cities: ticket.cityId ? { name: cityNames.get(ticket.cityId) ?? "" } : null,
      assignee: ticket.assignee ? { full_name: ticket.assignee } : null,
    }));
  } else {
    const viewCounts = await Promise.all(
      (Object.keys(VIEW_LABELS) as TicketView[]).map(async (view) => {
        const { count, error } = await applyFilters(db, "id", { ...filters, view, page: 1 }, user.id, true);
        if (error) throw error;
        return [view, count ?? 0] as const;
      }),
    );
    counts = Object.fromEntries(viewCounts) as Record<TicketView, number>;
    if (filters.page > Math.max(1, Math.ceil(counts[filters.view] / PAGE_SIZE))) redirect(listHref({ page: Math.max(1, Math.ceil(counts[filters.view] / PAGE_SIZE)) }));
    const { data, count, error } = await applyFilters(
      db,
      "id, ticket_number, issue_description, customer_name, source, status, created_at, updated_at, issue_date, cities(name), assignee:profiles!tickets_assignee_id_fkey(full_name)",
      filters,
      user.id,
      false,
      from,
    );
    if (error) throw error;
    tickets = data ?? [];
    total = count ?? 0;
  }
  return <AgentFrame title="Case queue" ticketSearch={{ q: filters.q, hidden: preserved }}><TicketQueue tickets={tickets} total={total} counts={counts} filters={filters} extras={extras} cities={cities.data ?? []} categories={categories.data ?? []} agents={agents.data ?? []} sources={sourceOptions.data ?? []} canCreate={user.role === "support_agent"} reportHref={scope ? `/dashboard${dashboardQuery(dashboardFilters)}` : undefined} /></AgentFrame>;
}

const SCOPE_KEYS = [
  "from", "to", "segment", "channel", "referringTeam", "statusGroup", "topic", "trackerCause",
  "requestType", "fawry", "bucketFrom", "bucketTo", "age", "userType",
] as const;

function scopeParams(
  raw: Record<string, string | string[] | undefined>,
  scope: string,
) {
  if (!scope) return {};
  const extras: Record<string, string> = { scope };
  for (const key of SCOPE_KEYS) {
    const value = Array.isArray(raw[key]) ? raw[key][0] : raw[key];
    if (value) extras[key] = value;
  }
  return extras;
}

function preservedFields(filters: TicketListFilters, extras: Record<string, string>) {
  const hidden: Record<string, string> = { ...extras };
  if (filters.view !== "all") hidden.view = filters.view;
  if (filters.status) hidden.status = filters.status;
  if (filters.source) hidden.source = filters.source;
  if (filters.city) hidden.city = filters.city;
  if (filters.category) hidden.category = filters.category;
  if (filters.assignee) hidden.assignee = filters.assignee;
  if (!extras.scope && filters.range !== "all") hidden.range = filters.range;
  if (filters.sort && filters.sort !== "newest") hidden.sort = filters.sort;
  return hidden;
}

function inListView(ticket: AnalyticsTicket, view: TicketView, userId: string) {
  if (view === "open") return statusGroup(ticket.status) === "followup";
  if (view === "new") return ticket.status === "new";
  if (view === "mine") return ticket.assigneeId === userId;
  if (view === "awaiting") return ticket.status === "awaiting_customer";
  if (view === "resolved") return ticket.status === "resolved";
  return true;
}

function listDimension(ticket: AnalyticsTicket, filters: TicketListFilters) {
  if (filters.city && ticket.cityId !== filters.city) return false;
  if (filters.category && ticket.categoryId !== filters.category) return false;
  if (filters.assignee === "unassigned") return !ticket.assigneeId;
  if (filters.assignee && ticket.assigneeId !== filters.assignee) return false;
  return true;
}

type TicketQuery = {
  select: (columns: string, options: { count: "exact"; head?: boolean }) => TicketQuery;
  eq: (column: string, value: string) => TicketQuery;
  in: (column: string, values: string[]) => TicketQuery;
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
  if (filters.view === "open") next = next.in("status", ["new", "in_progress", "awaiting_customer"]);
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
  const start = rangeStart(filters.range);
  if (start) next = next.gte("created_at", start);
  if (filters.q) {
    const term = filters.q.replace(/[%_,()]/g, "");
    next = next.or(`ticket_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,customer_email.ilike.%${term}%,issue_description.ilike.%${term}%`);
  }
  if (head) return next;
  return next.order(filters.sort === "updated" ? "updated_at" : "created_at", { ascending: filters.sort === "oldest" }).order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
}

type TicketRow = QueueRow;
