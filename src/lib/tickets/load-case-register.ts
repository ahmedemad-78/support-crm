import { redirect } from "next/navigation";
import type { QueueRow } from "@/components/tickets/ticket-queue";
import "server-only";
import { filterBusinessTickets, parseBusinessFilters, businessQuery } from "./business-analytics";
import { collectExportRows } from "./export-batches";

import type { CurrentUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  PAGE_SIZE,
  parseDashboardFilters,
  parseTicketListFilters,
  rangeStart,
  ticketListQuery,
  type TicketListFilters,
  type TicketView,
} from "@/lib/tickets/filters";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import { loadAnalytics } from "@/lib/tickets/load-analytics";
import { dashboardPopulation, reportedDay, statusGroup } from "@/lib/tickets/overview";
import { inQueueView as inListView, OPEN_QUEUE_STATUSES, QUEUE_VIEWS } from "@/lib/tickets/queue";
import type { AnalyticsTicket } from "@/lib/tickets/analytics";

const VIEW_LABELS = QUEUE_VIEWS;

export async function loadCaseRegister(rawParams: Record<string,string|string[]|undefined>, user: CurrentUser, exportAll = false) {
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
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const from = (filters.page - 1) * pageSize;

  let tickets: TicketRow[] = [];
  let total = 0;
  let counts: Record<TicketView, number>;

  if (scope) {
    const loaded = await loadAnalytics();
    const today = cairoDate(loaded.asOf);
    let population = rawParams.bi === "1" ? filterBusinessTickets(loaded.tickets,parseBusinessFilters(rawParams),scope === "followup") : dashboardPopulation(loaded.tickets, dashboardFilters, today);
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
        filters.sort === "stale" ? (a.updatedAt || a.createdAt).localeCompare(b.updatedAt || b.createdAt) || a.id.localeCompare(b.id)
          : filters.sort === "updated" ? (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
          : filters.sort === "oldest" ? (scope === "followup" ? reportedDay(a).localeCompare(reportedDay(b)) : a.createdAt.localeCompare(b.createdAt)) || a.number.localeCompare(b.number)
          : b.createdAt.localeCompare(a.createdAt) || a.number.localeCompare(b.number),
      );
    total = viewRows.length;
    if (!exportAll && filters.page > Math.max(1, Math.ceil(total / pageSize))) redirect(listHref({ page: Math.max(1, Math.ceil(total / pageSize)) }));
    const cityNames = new Map((cities.data ?? []).map((city) => [String(city.id), city.name]));
    tickets = (exportAll ? viewRows : viewRows.slice(from, from + pageSize)).map((ticket) => ({
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
      reporter: ticket.reporter ? {full_name:ticket.reporter} : null, creator: ticket.creator ? {full_name:ticket.creator} : null,
      reopen_count:ticket.reopenCount ?? 0, last_reopened_at:ticket.lastReopenedAt || null, school_name:ticket.schoolName, resolution_notes:ticket.resolutionNotes,
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
    if (!exportAll && filters.page > Math.max(1, Math.ceil(counts[filters.view] / pageSize))) redirect(listHref({ page: Math.max(1, Math.ceil(counts[filters.view] / pageSize)) }));
    const columns = "id, ticket_number, issue_description, customer_name, source, status, created_at, updated_at, issue_date, reopen_count, last_reopened_at, school_name, resolution_notes, cities(name), reporter:profiles!tickets_reporter_id_fkey(full_name), creator:profiles!tickets_created_by_fkey(full_name), assignee:profiles!tickets_assignee_id_fkey(full_name)";
    if (exportAll) {
      // Stable ordering and explicit batches prevent the API row cap from truncating exports.
      tickets=await collectExportRows(async offset=>{
        const {data,count,error}=await applyFilters(db,columns,filters,user.id,false,offset,500);
        if(error)throw error;
        return {data:data??[],count};
      });
      total=tickets.length;
    } else {
      const {data,count,error}=await applyFilters(db,columns,filters,user.id,false,from);
      if (error) throw error;
      tickets=data ?? []; total=count ?? 0;
    }
  }
  return {tickets,total,counts,filters,extras,scope,dashboardFilters,cities:cities.data ?? [],categories:categories.data ?? [],agents:agents.data ?? [],sources:sourceOptions.data ?? []};
}

const SCOPE_KEYS = [
  "from", "to", "cause", "platform", "segment", "channel", "referringTeam", "statusGroup", "topic", "trackerCause",
  "requestType", "fawry", "bucketFrom", "bucketTo", "age", "userType",
] as const;

function scopeParams(
  raw: Record<string, string | string[] | undefined>,
  scope: string,
) {
  if (!scope) return {};
  if(raw.bi === "1"){const extra=Object.fromEntries(new URLSearchParams(businessQuery(parseBusinessFilters(raw))));for(const key of ["source","status","city","category","assignee","q"])delete extra[key];return {...extra,scope,...(raw.tab==="operations"||raw.tab==="analysis"?{tab:raw.tab}:{})};}
  const extras: Record<string, string> = { scope };
  for (const key of SCOPE_KEYS) {
    const value = Array.isArray(raw[key]) ? raw[key][0] : raw[key];
    if (value) extras[key] = value;
  }
  return extras;
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
  gt: (column: string, value: number) => TicketQuery;
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
  batchSize?: number,
) {
  let next = supabase.from("tickets").select(columns, { count: "exact", head });
  if (filters.view === "open") next = next.in("status", OPEN_QUEUE_STATUSES);
  if (filters.view === "new") next = next.eq("status", "new");
  if (filters.view === "mine") next = next.eq("assignee_id", userId).in("status", OPEN_QUEUE_STATUSES);
  if (filters.view === "reopened") next = next.gt("reopen_count", 0).in("status", OPEN_QUEUE_STATUSES);
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
    next = next.or(`ticket_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,customer_email.ilike.%${term}%,credentials_username.ilike.%${term}%,school_name.ilike.%${term}%,issue_description.ilike.%${term}%`);
  }
  if (head) return next;
  return next.order(filters.sort === "updated" || filters.sort === "stale" ? "updated_at" : "created_at", { ascending: filters.sort === "oldest" || filters.sort === "stale" }).order("id", { ascending: true }).range(from, from + (batchSize ?? filters.pageSize ?? PAGE_SIZE) - 1);
}

type TicketRow = QueueRow;
