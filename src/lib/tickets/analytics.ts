import { cairoDate, shiftDay, type DashboardTicket } from "./dashboard-model";
import type { DashboardFilters } from "./filters";

export type AnalyticsTicket = DashboardTicket & {
  id: string;
  number: string;
  subject: string;
  platform?: string;
  assigneeId?: string;
  assignee?: string;
};
export type View = "created" | "resolved" | "open";
export const isOpen = (ticket: DashboardTicket) =>
  ["new", "in_progress", "awaiting_customer"].includes(ticket.status);
export const isResolved = (ticket: DashboardTicket) =>
  ["resolved", "closed"].includes(ticket.status) && Boolean(ticket.resolvedAt);
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export function inPeriod(day: string, from: string, to: string) {
  return day >= from && day <= to;
}
export function scopeTickets(
  tickets: AnalyticsTicket[],
  filters: DashboardFilters,
) {
  return tickets.filter(
    (t) =>
      (!filters.source || t.source === filters.source) &&
      (!filters.status || t.status === filters.status) &&
      (!filters.city || (filters.city === "__missing__" ? !t.cityId : t.cityId === filters.city)) &&
      (!filters.category || (filters.category === "__missing__" ? !t.categoryId : t.categoryId === filters.category)) &&
      (!filters.cause || (filters.cause === "__missing__" ? !t.cause : t.cause === filters.cause)) &&
      (!filters.platform || t.platform === filters.platform) &&
      (!filters.assignee || (filters.assignee === "__missing__" ? !t.assigneeId : t.assigneeId === filters.assignee)) &&
      (!filters.userType || (filters.userType === "__missing__" ? !t.endUserType : t.endUserType === filters.userType)),
  );
}
export function cohort(
  tickets: AnalyticsTicket[],
  view: View,
  from: string,
  to: string,
) {
  return tickets.filter((t) =>
    view === "open"
      ? isOpen(t)
      : view === "resolved"
        ? isResolved(t) && inPeriod(cairoDate(t.resolvedAt!), from, to)
        : inPeriod(t.createdOn, from, to),
  );
}
export function durationHours(t: DashboardTicket) {
  if (!isResolved(t)) return null;
  const hours =
    (Date.parse(t.resolvedAt!) - Date.parse(t.createdAt)) / 3_600_000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}
export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function formatHours(hours: number | null) {
  if (hours == null) return "—";
  if (hours === 0) return "0 min";
  if (hours < 1 / 60) return "<1 min";
  return hours < 1 ? `${Math.round(hours * 60)} min` : `${hours.toFixed(1)} h`;
}
export function previousPeriod(from: string, to: string) {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return { from: shiftDay(from, -days), to: shiftDay(from, -1) };
}
export function changeLabel(current: number, previous: number) {
  if (!previous)
    return current ? "No prior baseline" : "No change vs prior period";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% vs prior period (${previous})`;
}
export function trend(tickets: AnalyticsTicket[], from: string, to: string) {
  if (!validDay(from) || !validDay(to) || from > to) return [];
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const mode = span <= 31 ? "day" : span <= 90 ? "week" : span <= 730 ? "month" : "quarter";
  const result: {
    from: string;
    to: string;
    created: number;
    resolved: number;
    interval: string;
  }[] = [];
  for (let cursor = from; cursor <= to;) {
    let next: string;
    if (mode === "month" || mode === "quarter") {
      const date = new Date(`${cursor}T12:00:00Z`);
      date.setUTCMonth(mode === "quarter" ? Math.floor(date.getUTCMonth() / 3) * 3 + 3 : date.getUTCMonth() + 1, 1);
      next = date.toISOString().slice(0, 10);
    } else next = shiftDay(cursor, mode === "week" ? 7 : 1);
    result.push({
      from: cursor,
      to: shiftDay(next, -1) < to ? shiftDay(next, -1) : to,
      created: 0,
      resolved: 0,
      interval: mode,
    });
    cursor = next;
  }
  for (const t of tickets) {
    const created = result.find((b) => inPeriod(t.createdOn, b.from, b.to));
    if (created) created.created++;
    if (isResolved(t)) {
      const day = cairoDate(t.resolvedAt!);
      const resolved = result.find((b) => inPeriod(day, b.from, b.to));
      if (resolved) resolved.resolved++;
    }
  }
  return result;
}
export const AGE_LABELS = ["Under 1 day", "1–3 days", "3–7 days", "7+ days"];
export function ageBand(ticket: DashboardTicket, now: number) {
  const days = Math.max(0, (now - Date.parse(ticket.createdAt)) / 86_400_000);
  return days < 1 ? 0 : days < 3 ? 1 : days < 7 ? 2 : 3;
}
export function csvCell(value: string) {
  // Quoting alone does not prevent spreadsheet formula execution.
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Full-population denominator: a truncated Pareto never pretends to reach 100%. */
export function issuePareto(tickets: AnalyticsTicket[]) {
  const groups = new Map<string, { key: string; label: string; value: number }>();
  for (const t of tickets) {
    const key = t.categoryId || "__missing__";
    const g = groups.get(key) ?? { key, label: t.category || "Uncategorized", value: 0 };
    g.value++;
    groups.set(key, g);
  }
  let cumulative = 0;
  return [...groups.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).map(g => {
    cumulative += g.value;
    return { ...g, cumulative: tickets.length ? cumulative / tickets.length * 100 : 0 };
  });
}

export function causeMatrix(tickets: AnalyticsTicket[]) {
  const categories = issuePareto(tickets).slice(0, 5);
  const counts = new Map<string, number>();
  for (const t of tickets) if (t.cause) counts.set(t.cause, (counts.get(t.cause) ?? 0) + 1);
  const causes = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([label]) => label);
  return { categories, causes, cells: categories.map(c => causes.map(cause => tickets.filter(t => (t.categoryId || "__missing__") === c.key && t.cause === cause).length)) };
}
