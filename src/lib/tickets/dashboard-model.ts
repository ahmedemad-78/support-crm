import {
  SOURCE_LABELS,
  STATUS_LABELS,
  TICKET_SOURCES,
  TICKET_STATUSES,
  type TicketSource,
  type TicketStatus,
} from "./constants";
import type { DashboardFilters, FawryFilter } from "./filters";

export type DashboardTicket = {
  status: TicketStatus;
  source: TicketSource;
  createdOn: string;
  createdAt: string;
  resolvedAt: string | null;
  endUserType: string;
  cityId: string;
  categoryId: string;
  category: string;
  cause: string;
  fawryPayment: boolean | null;
};

export type MonthStack = {
  key: string;
  label: string;
  total: number;
  sources: Record<TicketSource, number>;
};

export type DashboardBar = {
  key: string;
  label: string;
  value: number;
};

const OPEN_STATUSES = new Set<TicketStatus>(["new", "in_progress", "awaiting_customer"]);

export function cairoDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ticketBounds(tickets: DashboardTicket[], today = cairoDate(new Date().toISOString())) {
  const dates = tickets.map((ticket) => ticket.createdOn).sort();
  const first = dates[0] ?? today;
  const last = dates[dates.length - 1] ?? today;
  return { from: first, to: last > today ? last : today };
}

export function filterTickets(tickets: DashboardTicket[], filters: DashboardFilters): DashboardTicket[] {
  return tickets.filter((ticket) => {
    if (filters.from && ticket.createdOn < filters.from) return false;
    if (filters.to && ticket.createdOn > filters.to) return false;
    if (filters.source && ticket.source !== filters.source) return false;
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.city && ticket.cityId !== filters.city) return false;
    if (filters.category && ticket.categoryId !== filters.category) return false;
    if (filters.userType && ticket.endUserType !== filters.userType) return false;
    if (filters.month && ticket.createdOn.slice(0, 7) !== filters.month) return false;
    if (filters.fawry && fawryKey(ticket) !== filters.fawry) return false;
    return true;
  });
}

export function fawryKey(ticket: Pick<DashboardTicket, "fawryPayment">): FawryFilter {
  if (ticket.fawryPayment === true) return "yes";
  if (ticket.fawryPayment === false) return "no";
  return "unknown";
}

export function effectiveDashboardRange(filters: Pick<DashboardFilters, "from" | "to" | "month">) {
  let from = filters.from;
  let to = filters.to;
  if (/^\d{4}-\d{2}$/.test(filters.month)) {
    const start = `${filters.month}-01`;
    const [year, month] = filters.month.split("-").map(Number);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (!from || start > from) from = start;
    if (!to || end < to) to = end;
  }
  return { from, to };
}

export function summarize(tickets: DashboardTicket[]) {
  const open = tickets.filter((ticket) => OPEN_STATUSES.has(ticket.status));
  const resolved = tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed");
  const hours = tickets
    .filter((ticket) => ticket.resolvedAt)
    .map((ticket) => (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 3_600_000);
  const averageHours = hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null;
  return {
    created: tickets.length,
    open: open.length,
    newCount: tickets.filter((ticket) => ticket.status === "new").length,
    inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
    awaiting: tickets.filter((ticket) => ticket.status === "awaiting_customer").length,
    resolved: resolved.length,
    resolvedShare: tickets.length ? Math.round((resolved.length / tickets.length) * 100) : 0,
    averageHours,
  };
}

export function barsForSources(tickets: DashboardTicket[]): DashboardBar[] {
  return TICKET_SOURCES.map((source) => ({
    key: source,
    label: SOURCE_LABELS[source],
    value: tickets.filter((ticket) => ticket.source === source).length,
  }));
}

export function barsForStatuses(tickets: DashboardTicket[]): DashboardBar[] {
  return TICKET_STATUSES.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    value: tickets.filter((ticket) => ticket.status === status).length,
  }));
}

export function barsForCauses(tickets: DashboardTicket[]): DashboardBar[] {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const label = ticket.cause || "Not set";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label, value]) => ({ key: label, label, value }));
}

export function barsForResolution(tickets: DashboardTicket[]): DashboardBar[] {
  const groups = new Map<string, number[]>();
  for (const ticket of tickets) {
    if (!ticket.resolvedAt) continue;
    const label = ticket.category || "Uncategorized";
    const hours = (new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()) / 3_600_000;
    const list = groups.get(label) ?? [];
    list.push(hours);
    groups.set(label, list);
  }
  return [...groups.entries()]
    .map(([label, values]) => ({
      key: label,
      label,
      value: Math.round((values.reduce((sum, hours) => sum + hours, 0) / values.length) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const name = MONTH_LABELS[month - 1] ?? monthKey;
  return `${name} ${String(year).slice(2)}`;
}

export function monthStacks(tickets: DashboardTicket[], from: string, to: string): MonthStack[] {
  if (!from || !to || from > to) return [];
  const stacks: MonthStack[] = [];
  for (let cursor = from.slice(0, 7); cursor <= to.slice(0, 7); ) {
    stacks.push({
      key: cursor,
      label: monthLabel(cursor),
      total: 0,
      sources: {
        whatsapp: 0,
        moderation: 0,
        call_center: 0,
        june_schools: 0,
        business_development: 0,
      },
    });
    const [year, month] = cursor.split("-").map(Number);
    cursor = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  }
  const byKey = new Map(stacks.map((stack) => [stack.key, stack]));
  for (const ticket of tickets) {
    const stack = byKey.get(ticket.createdOn.slice(0, 7));
    if (!stack) continue;
    stack.sources[ticket.source] += 1;
    stack.total += 1;
  }
  return stacks;
}

export function fawryShares(tickets: DashboardTicket[]): DashboardBar[] {
  const counts: Record<FawryFilter, number> = { yes: 0, no: 0, unknown: 0 };
  for (const ticket of tickets) counts[fawryKey(ticket)] += 1;
  return [
    { key: "yes", label: "Fawry", value: counts.yes },
    { key: "no", label: "Not Fawry", value: counts.no },
    { key: "unknown", label: "Not recorded", value: counts.unknown },
  ];
}

export function timeBuckets(tickets: DashboardTicket[], from: string, to: string): DashboardBar[] {
  if (!from || !to || from > to) return [];
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const mode = span <= 31 ? "day" : span <= 120 ? "week" : "month";
  const buckets = new Map<string, DashboardBar>();

  const ensure = (key: string, label: string) => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const created = { key, label, value: 0 };
    buckets.set(key, created);
    return created;
  };

  if (mode === "day") {
    for (let day = from; day <= to; day = shiftDay(day, 1)) ensure(day, day.slice(5));
  } else if (mode === "week") {
    let day = from;
    const weekday = new Date(`${from}T12:00:00Z`).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    day = shiftDay(from, mondayOffset);
    if (day < from) {
      /* first partial week still starts at the range */
    }
    for (let cursor = from; cursor <= to; cursor = shiftDay(cursor, 1)) {
      const weekDay = new Date(`${cursor}T12:00:00Z`).getUTCDay();
      const offset = weekDay === 0 ? -6 : 1 - weekDay;
      const weekStart = shiftDay(cursor, offset);
      const key = weekStart < from ? from : weekStart;
      ensure(key, key.slice(5));
    }
  } else {
    for (let cursor = from.slice(0, 7); cursor <= to.slice(0, 7); ) {
      ensure(cursor, cursor);
      const [year, month] = cursor.split("-").map(Number);
      const next = new Date(Date.UTC(year, month, 1));
      cursor = next.toISOString().slice(0, 7);
    }
  }

  for (const ticket of tickets) {
    if (ticket.createdOn < from || ticket.createdOn > to) continue;
    if (mode === "day") {
      const bucket = buckets.get(ticket.createdOn);
      if (bucket) bucket.value += 1;
    } else if (mode === "week") {
      const weekDay = new Date(`${ticket.createdOn}T12:00:00Z`).getUTCDay();
      const offset = weekDay === 0 ? -6 : 1 - weekDay;
      const weekStart = shiftDay(ticket.createdOn, offset);
      const key = weekStart < from ? from : weekStart;
      const bucket = buckets.get(key);
      if (bucket) bucket.value += 1;
    } else {
      const bucket = buckets.get(ticket.createdOn.slice(0, 7));
      if (bucket) bucket.value += 1;
    }
  }

  return [...buckets.values()];
}

export function cairoDayBound(day: string, end: boolean): string {
  const stamp = end ? `${day}T23:59:59.999` : `${day}T00:00:00.000`;
  for (const offset of ["+02:00", "+03:00"]) {
    const instant = new Date(`${stamp}${offset}`);
    if (Number.isNaN(instant.getTime())) continue;
    if (cairoDate(instant.toISOString()) !== day) continue;
    const clock = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(instant);
    if (clock === (end ? "23:59" : "00:00")) return instant.toISOString();
  }
  return new Date(`${stamp}+02:00`).toISOString();
}
