import { shiftDay } from "./dashboard-model";
import { inPeriod, validDay, type AnalyticsTicket } from "./analytics";
import type { TicketStatus } from "./constants";

export type StatusGroup = "followup" | "resolved" | "closed";
export type VolumeMode = "day" | "week" | "month";

export const STATUS_GROUP_LABEL = {
  followup: "Needs Follow-up",
  resolved: "Resolved",
  closed: "Closed Without Response",
} as const;

export const SEGMENT_ORDER = ["B2B Schools", "30 June Schools", "Not specified"] as const;
export const AGE_BUCKETS = [
  { id: "0-2", label: "0–2 days" },
  { id: "3-7", label: "3–7 days" },
  { id: "8-14", label: "8–14 days" },
  { id: "15", label: "15+ days" },
] as const;

export function reportedDay(ticket: AnalyticsTicket) {
  return ticket.reportedOn || ticket.createdOn;
}

export function customerSegment(source: string) {
  if (source === "business_development") return "B2B Schools";
  if (source === "june_schools") return "30 June Schools";
  return "Not specified";
}

export function contactChannel(source: string) {
  if (source === "whatsapp") return "WhatsApp";
  if (source === "call_center") return "Phone";
  if (source === "moderation" || source === "june_schools" || source === "business_development") return "Support Form";
  return "Not specified";
}

export function referringTeam(source: string) {
  if (source === "moderation") return "Moderation";
  if (source === "marketing_team") return "Marketing";
  return "Not specified";
}

export function statusGroup(status: TicketStatus): StatusGroup {
  if (status === "resolved") return "resolved";
  if (status === "closed") return "closed";
  return "followup";
}

export function daysSinceReported(day: string, today: string) {
  if (!validDay(day) || !validDay(today) || day > today) return day > today ? 0 : null;
  return Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
}

export function ageBucketId(days: number) {
  if (days <= 2) return "0-2";
  if (days <= 7) return "3-7";
  if (days <= 14) return "8-14";
  return "15";
}

export function volumeModeFor(from: string, to: string): VolumeMode {
  if (!validDay(from) || !validDay(to) || from > to) return "day";
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (span <= 45) return "day";
  if (span <= 180) return "week";
  return "month";
}

export type OverviewQuery = {
  from: string;
  to: string;
  source: string;
  segment: string;
  channel: string;
  referringTeam: string;
  status: string;
  statusGroup: string;
  topic: string;
  trackerCause: string;
  requestType: string;
  fawry: string;
  q: string;
  bucketFrom: string;
  bucketTo: string;
  age: string;
  topCauses: string[];
  topTopics: string[];
};

export function matchesOverview(
  ticket: AnalyticsTicket,
  filters: OverviewQuery,
  except: string[] = [],
  today = "",
) {
  const skip = new Set(except);
  const day = reportedDay(ticket);
  if (!skip.has("dates")) {
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
  }
  if (!skip.has("bucket") && filters.bucketFrom && filters.bucketTo && !inPeriod(day, filters.bucketFrom, filters.bucketTo)) return false;
  if (!skip.has("source") && filters.source && ticket.source !== filters.source) return false;
  if (!skip.has("segment") && filters.segment && customerSegment(ticket.source) !== filters.segment) return false;
  if (!skip.has("channel") && filters.channel && contactChannel(ticket.source) !== filters.channel) return false;
  if (!skip.has("team") && filters.referringTeam && referringTeam(ticket.source) !== filters.referringTeam) return false;
  if (!skip.has("status") && filters.status && ticket.status !== filters.status) return false;
  if (!skip.has("statusGroup") && filters.statusGroup && statusGroup(ticket.status) !== filters.statusGroup) return false;
  if (!skip.has("topic") && filters.topic && !matchesRank(ticket.topic, filters.topic, filters.topTopics)) return false;
  if (!skip.has("cause") && filters.trackerCause && !matchesRank(ticket.trackerCause, filters.trackerCause, filters.topCauses)) return false;
  if (!skip.has("requestType") && filters.requestType && (ticket.requestType || "__missing__") !== filters.requestType) return false;
  if (!skip.has("fawry") && filters.fawry && (ticket.fawry || "__missing__") !== filters.fawry) return false;
  if (!skip.has("age") && filters.age) {
    const days = daysSinceReported(day, today);
    if (days == null || ageBucketId(days) !== filters.age) return false;
  }
  if (!skip.has("q") && filters.q) {
    const needle = filters.q.trim().toLowerCase();
    const hay = [ticket.number, ticket.customerName, ticket.schoolName, ticket.customerPhone, ticket.customerEmail, ticket.subject, ticket.topic]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function matchesRank(value: string, selected: string, top: string[]) {
  if (selected === "__missing__") return !value;
  if (selected === "__other__") return Boolean(value) && !top.includes(value);
  return value === selected;
}

export function headline(tickets: AnalyticsTicket[]) {
  const follow = tickets.filter((ticket) => statusGroup(ticket.status) === "followup");
  const resolved = tickets.filter((ticket) => ticket.status === "resolved").length;
  return {
    total: tickets.length,
    followup: follow.length,
    fresh: follow.filter((ticket) => ticket.status === "new").length,
    progress: follow.filter((ticket) => ticket.status === "in_progress").length,
    awaiting: follow.filter((ticket) => ticket.status === "awaiting_customer").length,
    resolved,
    resolvedShare: tickets.length ? resolved / tickets.length : 0,
    closed: tickets.filter((ticket) => ticket.status === "closed").length,
  };
}

export type RankRow = {
  id: string;
  name: string;
  count: number;
  followup: number;
  share: number;
  requests: { name: string; count: number }[];
};

export function rankValues(
  tickets: AnalyticsTicket[],
  pick: (ticket: AnalyticsTicket) => string,
  limit: number,
  otherName: string,
): RankRow[] {
  const groups = new Map<string, AnalyticsTicket[]>();
  for (const ticket of tickets) {
    const raw = pick(ticket);
    const id = raw || "__missing__";
    const list = groups.get(id) ?? [];
    list.push(ticket);
    groups.set(id, list);
  }
  const toRow = (id: string, rows: AnalyticsTicket[], name: string): RankRow => {
    const requests = new Map<string, number>();
    for (const ticket of rows) {
      const label = ticket.requestType || "Not recorded";
      requests.set(label, (requests.get(label) ?? 0) + 1);
    }
    return {
      id,
      name,
      count: rows.length,
      followup: rows.filter((ticket) => statusGroup(ticket.status) === "followup").length,
      share: tickets.length ? rows.length / tickets.length : 0,
      requests: [...requests.entries()]
        .map(([requestName, count]) => ({ name: requestName, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  };
  const named = [...groups.entries()]
    .filter(([id]) => id !== "__missing__")
    .map(([id, rows]) => toRow(id, rows, id))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const top = named.slice(0, limit);
  const rest = named.slice(limit);
  const rows = [...top];
  if (rest.length) {
    const combined = rest.flatMap((item) => groups.get(item.id) ?? []);
    rows.push(toRow("__other__", combined, otherName));
  }
  const missing = groups.get("__missing__");
  if (missing?.length) rows.push(toRow("__missing__", missing, "Not recorded"));
  return rows;
}

export function topNames(rows: RankRow[]) {
  return rows.filter((row) => row.id !== "__other__" && row.id !== "__missing__").map((row) => row.id);
}

export type VolumeBucket = {
  from: string;
  to: string;
  label: string;
  total: number;
  parts: { key: string; count: number }[];
};

export function volumeBuckets(
  tickets: AnalyticsTicket[],
  from: string,
  to: string,
  mode: VolumeMode,
  sources: string[],
): VolumeBucket[] {
  if (!validDay(from) || !validDay(to) || from > to) return [];
  const ranges: { from: string; to: string }[] = [];
  if (mode === "month") {
    let cursor = from;
    while (cursor <= to && ranges.length < 240) {
      const date = new Date(`${cursor}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
      const next = date.toISOString().slice(0, 10);
      ranges.push({ from: cursor, to: shiftDay(next, -1) < to ? shiftDay(next, -1) : to });
      cursor = next;
    }
  } else {
    const step = mode === "week" ? 7 : 1;
    for (let cursor = from; cursor <= to && ranges.length < 800; cursor = shiftDay(cursor, step)) {
      const end = shiftDay(shiftDay(cursor, step), -1);
      ranges.push({ from: cursor, to: end < to ? end : to });
    }
  }
  return ranges.map((range) => {
    const inside = tickets.filter((ticket) => inPeriod(reportedDay(ticket), range.from, range.to));
    return {
      ...range,
      label: bucketLabel(range.from, range.to, mode),
      total: inside.length,
      parts: sources.map((key) => ({ key, count: inside.filter((ticket) => ticket.source === key).length })),
    };
  });
}

function bucketLabel(from: string, to: string, mode: VolumeMode) {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (mode === "day" || from === to) return day.format(start);
  if (mode === "month") return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(start);
  return `${day.format(start)} – ${day.format(end)}`;
}

export function identityKeys(ticket: AnalyticsTicket) {
  const keys: string[] = [];
  const phone = (ticket.customerPhone ?? "").replace(/\D/g, "");
  if (phone.length >= 8) keys.push(`p:${phone.slice(-10)}`);
  const email = (ticket.customerEmail ?? "").trim().toLowerCase();
  if (email.includes("@")) keys.push(`e:${email}`);
  return keys;
}

export function siblingCases(ticket: AnalyticsTicket, openTickets: AnalyticsTicket[]) {
  const keys = new Set(identityKeys(ticket));
  if (!keys.size) return [];
  return openTickets.filter((other) => other.id !== ticket.id && identityKeys(other).some((key) => keys.has(key)));
}
