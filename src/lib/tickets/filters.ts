import { END_USER_TYPES, TICKET_STATUSES, type TicketStatus } from "./constants";
import { validDay } from "./analytics";

export const TICKET_VIEWS = ["all", "new", "mine", "awaiting", "resolved"] as const;
export type TicketView = (typeof TICKET_VIEWS)[number];
export const PAGE_SIZE = 8;

export type TicketListFilters = {
  view: TicketView;
  status: TicketStatus | "";
  source: string;
  city: string;
  category: string;
  assignee: string;
  range: "7" | "30" | "90" | "all";
  q: string;
  page: number;
};

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseTicketListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): TicketListFilters {
  const view = one(searchParams.view);
  const status = one(searchParams.status);
  const source = one(searchParams.source);
  const range = one(searchParams.range);
  const page = Number(one(searchParams.page));

  return {
    view: TICKET_VIEWS.includes(view as TicketView) ? (view as TicketView) : "all",
    status: TICKET_STATUSES.includes(status as TicketStatus) ? (status as TicketStatus) : "",
    source: /^[a-z][a-z0-9_]{1,40}$/.test(source) ? source : "",
    city: one(searchParams.city),
    category: one(searchParams.category),
    assignee: one(searchParams.assignee),
    range: range === "7" || range === "90" || range === "all" ? range : "30",
    q: one(searchParams.q).slice(0, 80),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

export function rangeStart(range: TicketListFilters["range"]): string | null {
  if (range === "all") return null;
  const days = range === "7" ? 7 : range === "90" ? 90 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return start.toISOString();
}

export function ticketListQuery(filters: TicketListFilters, extras?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.view !== "all") params.set("view", filters.view);
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.city) params.set("city", filters.city);
  if (filters.category) params.set("category", filters.category);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.range !== "30") params.set("range", filters.range);
  if (filters.q) params.set("q", filters.q);
  if (filters.page > 1) params.set("page", String(filters.page));
  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type DashboardFilters = {
  cause?: string;
  platform?: string;
  assignee?: string;
  view?: "created" | "resolved" | "open";
  age?: string;
  source: string;
  status: TicketStatus | "";
  requestType?: string;
  topic?: string;
  trackerCause?: string;
  trackerAction?: string;
  outcome?: string;
  fawry?: string;
  segment?: string;
  channel?: string;
  referringTeam?: string;
  statusGroup?: string;
  q?: string;
  bucketFrom?: string;
  bucketTo?: string;
  city: string;
  category: string;
  userType: string;
  from: string;
  to: string;
};

export function parseDashboardFilters(
  searchParams: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const source = one(searchParams.source);
  const status = one(searchParams.status);
  const userType = one(searchParams.userType);
  const from = one(searchParams.from);
  const to = one(searchParams.to);
  return {
    source: /^[a-z][a-z0-9_]{1,40}$/.test(source) ? source : "",
    status: TICKET_STATUSES.includes(status as TicketStatus) ? (status as TicketStatus) : "",
    city: one(searchParams.city),
    category: one(searchParams.category),
    userType: userType === "__missing__" || (END_USER_TYPES as readonly string[]).includes(userType) ? userType : "",
    from: validDay(from) ? from : "",
    to: validDay(to) ? to : "",
    cause: one(searchParams.cause).slice(0, 200),
    platform: one(searchParams.platform),
    assignee: one(searchParams.assignee),
    view: one(searchParams.view) === "open" ? "open" : one(searchParams.view) === "resolved" ? "resolved" : "created",
    age: /^(0-2|3-7|8-14|15)$/.test(one(searchParams.age)) ? one(searchParams.age) : "",
    requestType: one(searchParams.requestType).slice(0, 160),
    topic: one(searchParams.topic).slice(0, 160),
    trackerCause: one(searchParams.trackerCause).slice(0, 160),
    fawry: ["yes", "no", "__missing__"].includes(one(searchParams.fawry)) ? one(searchParams.fawry) : "",
    segment: one(searchParams.segment).slice(0, 80),
    channel: one(searchParams.channel).slice(0, 80),
    referringTeam: one(searchParams.referringTeam).slice(0, 80),
    statusGroup: ["followup", "resolved", "closed"].includes(one(searchParams.statusGroup)) ? one(searchParams.statusGroup) : "",
    q: one(searchParams.q).slice(0, 80),
    bucketFrom: validDay(one(searchParams.bucketFrom)) ? one(searchParams.bucketFrom) : "",
    bucketTo: validDay(one(searchParams.bucketTo)) ? one(searchParams.bucketTo) : "",
  };
}

export function dashboardQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  for (const key of ["cause", "platform", "assignee", "view", "age", "requestType", "topic", "trackerCause", "fawry", "segment", "channel", "referringTeam", "statusGroup", "q", "bucketFrom", "bucketTo"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.city) params.set("city", filters.city);
  if (filters.category) params.set("category", filters.category);
  if (filters.userType) params.set("userType", filters.userType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function dashboardListHref(filters: DashboardFilters, scope: "followup" | "dashboard") {
  const params = new URLSearchParams(dashboardQuery(filters).replace(/^\?/, ""));
  params.delete("view");
  params.set("scope", scope);
  return `/tickets?${params.toString()}`;
}

/** In-app return targets only. Rejects protocol-relative and external URLs. */
export function safeAppReturn(value: string | undefined) {
  if (!value) return null;
  if (!value.startsWith("/tickets") && !value.startsWith("/dashboard")) return null;
  if (value.startsWith("//") || value.includes("://") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}
