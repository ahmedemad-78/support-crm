"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { sourceLabel, STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { cairoDate, shiftDay } from "@/lib/tickets/dashboard-model";
import { dashboardQuery, ticketListQuery, type DashboardFilters } from "@/lib/tickets/filters";
import { csvCell, inPeriod, isOpen, validDay, type AnalyticsTicket } from "@/lib/tickets/analytics";
import {
  AGE_BUCKETS,
  SEGMENT_ORDER,
  STATUS_GROUP_LABEL,
  ageBucketId,
  contactChannel,
  customerSegment,
  daysSinceReported,
  headline,
  matchesOverview,
  rankValues,
  referringTeam,
  reportedDay,
  siblingCases,
  statusGroup,
  topNames,
  volumeBuckets,
  volumeModeFor,
  type OverviewQuery,
  type StatusGroup,
  type VolumeMode,
} from "@/lib/tickets/overview";
import { AgeStrip, BarList, CauseChart, CHANNEL_COLORS, ColumnChart, EmptyChart, FawryDonut, Panel, SegmentChart, SOURCE_COLORS, Sparkline, SplitBar, STATUS_COLORS, TopicList, VolumeChart, type VolumeLine } from "./overview-charts";

type Snapshot = { tickets: AnalyticsTicket[]; asOf: string };
type Option = { id: string; name: string };

function leadingValue(tickets: AnalyticsTicket[], pick: (ticket: AnalyticsTicket) => string) {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const value = pick(ticket).trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;
}

const blank = {
  source: "",
  status: "" as const,
  city: "",
  category: "",
  userType: "",
  segment: "",
  channel: "",
  referringTeam: "",
  statusGroup: "",
  topic: "",
  trackerCause: "",
  requestType: "",
  fawry: "",
  q: "",
  bucketFrom: "",
  bucketTo: "",
  age: "",
};

export function DashboardBoard({
  initialSnapshot,
  initialFilters,
  preview = false,
}: {
  initialSnapshot: Snapshot;
  initialFilters: DashboardFilters;
  cities?: Option[];
  categories?: Option[];
  preview?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const today = cairoDate(snapshot.asOf);
  const earliest = snapshot.tickets.reduce((day, ticket) => {
    const reported = reportedDay(ticket);
    return reported < day ? reported : day;
  }, today);
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    ...blank,
    ...initialFilters,
    from: validDay(initialFilters.from) ? initialFilters.from : earliest,
    to: validDay(initialFilters.to) ? initialFilters.to : today,
  }));
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<VolumeMode | "">("");
  const [share, setShare] = useState(false);
  const [allTopics, setAllTopics] = useState(false);
  const [allCauses, setAllCauses] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const valid = validDay(filters.from) && validDay(filters.to) && filters.from <= filters.to;
  const volumeMode = mode || (valid ? volumeModeFor(filters.from, filters.to) : "month");

  const queryOf = useCallback((causeTops: string[], topicTops: string[]): OverviewQuery => ({
    from: filters.from,
    to: filters.to,
    source: filters.source,
    segment: filters.segment ?? "",
    channel: filters.channel ?? "",
    referringTeam: filters.referringTeam ?? "",
    status: filters.status,
    statusGroup: filters.statusGroup ?? "",
    topic: filters.topic ?? "",
    trackerCause: filters.trackerCause ?? "",
    requestType: filters.requestType ?? "",
    fawry: filters.fawry ?? "",
    q: filters.q ?? "",
    bucketFrom: filters.bucketFrom ?? "",
    bucketTo: filters.bucketTo ?? "",
    age: filters.age ?? "",
    topCauses: causeTops,
    topTopics: topicTops,
  }), [filters]);

  const causeFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf([], []), ["cause"], today)), [snapshot.tickets, queryOf, today]);
  const topicFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf([], []), ["topic"], today)), [snapshot.tickets, queryOf, today]);
  const causeRank = useMemo(() => rankValues(causeFrame, (ticket) => ticket.trackerCause, allCauses ? 99 : 5, "Other causes"), [causeFrame, allCauses]);
  const topicRank = useMemo(() => rankValues(topicFrame, (ticket) => ticket.topic, allTopics ? 99 : 6, "Other topics"), [topicFrame, allTopics]);
  const causeTops = useMemo(() => topNames(rankValues(causeFrame, (ticket) => ticket.trackerCause, 5, "Other causes")), [causeFrame]);
  const topicTops = useMemo(() => topNames(rankValues(topicFrame, (ticket) => ticket.topic, 6, "Other topics")), [topicFrame]);
  const rows = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), [], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const volumeFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), breakdown ? ["source", "bucket", "channel"] : ["source", "bucket"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today, breakdown]);
  const fawryFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["fawry"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const sourceFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["source"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const requestFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["requestType"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const channelFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["channel"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const teamFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["team"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const ageFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["age"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const segmentFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["segment", "statusGroup"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const stats = headline(rows);
  const sources = useMemo(() => {
    const order = ["whatsapp", "call_center", "moderation", "marketing_team", "business_development", "june_schools", "google_play"];
    const present = new Set<string>(volumeFrame.map((ticket) => ticket.source));
    if (filters.source) present.add(filters.source);
    return [...order.filter((source) => present.has(source)), ...[...present].filter((source) => !order.includes(source))];
  }, [volumeFrame, filters.source]);
  const buckets = useMemo(() => valid ? volumeBuckets(volumeFrame, filters.from, filters.to, volumeMode, sources) : [], [volumeFrame, filters.from, filters.to, volumeMode, sources, valid]);
  const volumeLines = useMemo<VolumeLine[]>(() => {
    if (!breakdown) return [{ id: "total", label: "All cases", color: "#159d49", values: buckets.map((bucket) => bucket.total) }];
    const names = ["WhatsApp", "Phone", "Support Form", "Email", "Not specified"];
    return names.map((name) => ({
      id: name,
      label: name,
      color: CHANNEL_COLORS[name] ?? "#6f8f7a",
      values: buckets.map((bucket) => volumeFrame.filter((ticket) => inPeriod(reportedDay(ticket), bucket.from, bucket.to) && contactChannel(ticket.source) === name).length),
    })).filter((line) => line.values.some((value) => value > 0) || filters.channel === line.id);
  }, [breakdown, buckets, volumeFrame, filters.channel]);
  const spark = useMemo(() => valid ? volumeBuckets(rows, filters.from, filters.to, volumeMode, []).map((bucket) => bucket.total) : [], [rows, filters.from, filters.to, volumeMode, valid]);
  const segments = SEGMENT_ORDER.map((segment) => {
    const matching = segmentFrame.filter((ticket) => customerSegment(ticket.source) === segment);
    return {
      segment,
      total: matching.length,
      parts: (["resolved", "followup", "closed"] as StatusGroup[]).map((group) => ({
        group,
        count: matching.filter((ticket) => statusGroup(ticket.status) === group).length,
      })),
    };
  });
  const fawryRows = [
    { id: "yes", name: "Yes", count: fawryFrame.filter((ticket) => ticket.fawry === "yes").length },
    { id: "no", name: "No", count: fawryFrame.filter((ticket) => ticket.fawry === "no").length },
    { id: "__missing__", name: "Not recorded", count: fawryFrame.filter((ticket) => !ticket.fawry).length },
  ];
  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of sourceFrame) counts.set(ticket.source, (counts.get(ticket.source) ?? 0) + 1);
    if (filters.source) counts.set(filters.source, counts.get(filters.source) ?? 0);
    return [...counts.entries()]
      .filter(([id, count]) => count > 0 || id === filters.source)
      .map(([id, count]) => ({ id, name: sourceLabel(id), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [sourceFrame, filters.source]);
  const requestRank = useMemo(() => rankValues(requestFrame, (ticket) => ticket.requestType, 8, "Other request types"), [requestFrame]);
  const openAll = snapshot.tickets.filter(isOpen);
  const followups = rows
    .filter((ticket) => statusGroup(ticket.status) === "followup")
    .sort((a, b) => reportedDay(a).localeCompare(reportedDay(b)) || a.number.localeCompare(b.number));
  const pages = Math.max(1, Math.ceil(followups.length / 8));
  const currentPage = Math.min(page, pages);
  const unclassified = rows.filter((ticket) => !ticket.topic && !ticket.trackerCause).length;
  const returnTo = `/dashboard${dashboardQuery(filters)}`;

  const refresh = useCallback(async () => {
    if (preview || busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/dashboard/data", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 403 ? "Session expired. Reload and sign in again." : "Refresh failed. Showing the last successful snapshot.");
      const next: Snapshot = await response.json();
      if (!Array.isArray(next.tickets) || !Number.isFinite(Date.parse(next.asOf))) throw new Error("Invalid refresh response. Last snapshot retained.");
      setSnapshot(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Refresh timed out. Last snapshot retained.");
    } finally {
      clearTimeout(timeout);
      busy.current = false;
      setRefreshing(false);
    }
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    const tick = () => { if (document.visibilityState === "visible") void refresh(); };
    const interval = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      abort.current?.abort();
    };
  }, [refresh, preview]);
  useEffect(() => {
    if (!preview) window.history.replaceState(null, "", `/dashboard${dashboardQuery(filters)}`);
  }, [filters, preview]);

  function patch(next: Partial<DashboardFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }
  function reset() {
    setFilters({ ...blank, from: earliest, to: today });
    setMode("");
    setPage(1);
  }
  function toggle(key: keyof DashboardFilters, value: string) {
    patch({ [key]: filters[key] === value ? "" : value });
  }
  function pickGroup(group: "" | StatusGroup) {
    patch({ status: "", statusGroup: group && filters.statusGroup === group ? "" : group });
  }
  function exportCsv() {
    const data = [[
      "Case", "Customer", "School", "Phone", "Email", "Reported date", "Source", "Segment", "Channel", "Referring team",
      "Status", "Request type", "Topic", "Root cause", "Action", "Outcome", "Fawry", "Assignee", "Description",
    ], ...rows.map((ticket) => [
      ticket.number, ticket.customerName ?? "", ticket.schoolName ?? "", ticket.customerPhone ?? "", ticket.customerEmail ?? "",
      reportedDay(ticket), sourceLabel(ticket.source), customerSegment(ticket.source), contactChannel(ticket.source), referringTeam(ticket.source),
      STATUS_LABELS[ticket.status], ticket.requestType, ticket.topic, ticket.trackerCause, ticket.trackerAction, ticket.outcome,
      ticket.fawry === "yes" ? "Yes" : ticket.fawry === "no" ? "No" : "", ticket.assignee ?? "", ticket.subject,
    ])];
    const url = URL.createObjectURL(new Blob(["\ufeff" + data.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `support-cases-${filters.from}-${filters.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chips: { key: keyof DashboardFilters; label: string }[] = [
    filters.source ? { key: "source", label: sourceLabel(filters.source) } : null,
    filters.segment ? { key: "segment", label: filters.segment } : null,
    filters.channel ? { key: "channel", label: filters.channel } : null,
    filters.referringTeam ? { key: "referringTeam", label: filters.referringTeam } : null,
    filters.status ? { key: "status", label: STATUS_LABELS[filters.status] } : null,
    filters.statusGroup ? { key: "statusGroup", label: STATUS_GROUP_LABEL[filters.statusGroup as StatusGroup] } : null,
    filters.topic ? { key: "topic", label: filters.topic === "__missing__" ? "Topic not recorded" : filters.topic === "__other__" ? "Other topics" : filters.topic } : null,
    filters.trackerCause ? { key: "trackerCause", label: filters.trackerCause === "__missing__" ? "Cause not recorded" : filters.trackerCause === "__other__" ? "Other causes" : filters.trackerCause } : null,
    filters.requestType ? { key: "requestType", label: filters.requestType === "__missing__" ? "Request type not recorded" : filters.requestType } : null,
    filters.fawry ? { key: "fawry", label: filters.fawry === "__missing__" ? "Fawry not recorded" : `Fawry: ${filters.fawry === "yes" ? "Yes" : "No"}` } : null,
    filters.bucketFrom ? { key: "bucketFrom", label: `${filters.bucketFrom} – ${filters.bucketTo}` } : null,
    filters.age ? { key: "age", label: AGE_BUCKETS.find((bucket) => bucket.id === filters.age)?.label ?? filters.age } : null,
    filters.q ? { key: "q", label: `Dashboard filter: ${filters.q}` } : null,
  ].filter((chip): chip is { key: keyof DashboardFilters; label: string } => Boolean(chip));

  const channelRows = rankValues(channelFrame, (ticket) => contactChannel(ticket.source), 8, "Other channels");
  const teamRows = rankValues(teamFrame, (ticket) => referringTeam(ticket.source), 8, "Other teams");
  const ages = AGE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: ageFrame.filter((ticket) => {
      if (!isOpen(ticket)) return false;
      const days = daysSinceReported(reportedDay(ticket), today);
      return days != null && ageBucketId(days) === bucket.id;
    }).length,
  }));
  const openInView = rows.filter((ticket) => statusGroup(ticket.status) === "followup");
  const unassignedOpen = openInView.filter((ticket) => !ticket.assignee).length;
  const oldOpen = openInView.filter((ticket) => (daysSinceReported(reportedDay(ticket), today) ?? 0) >= 15).length;
  const topSource = leadingValue(rows, (ticket) => ticket.source);
  const topCause = leadingValue(rows, (ticket) => ticket.trackerCause);
  const insights = [
    unassignedOpen > 0 ? { id: "assignee", tone: "warn" as const, text: `${unassignedOpen} open ${unassignedOpen === 1 ? "case has" : "cases have"} no assignee.`, onClick: () => document.getElementById("follow-up")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }) } : null,
    oldOpen > 0 ? { id: "age", tone: "warn" as const, text: `${oldOpen} open ${oldOpen === 1 ? "case was" : "cases were"} reported 15 or more days ago.`, onClick: () => { const on = filters.age === "15" && filters.statusGroup === "followup"; patch({ age: on ? "" : "15", status: "", statusGroup: on ? "" : "followup" }); } } : null,
    unclassified > 0 ? { id: "class", tone: "plain" as const, text: `${unclassified} ${unclassified === 1 ? "case has" : "cases have"} neither a topic nor a root cause.`, onClick: () => { const on = filters.topic === "__missing__" && filters.trackerCause === "__missing__"; patch({ topic: on ? "" : "__missing__", trackerCause: on ? "" : "__missing__" }); } } : null,
    topSource ? { id: "source", tone: "plain" as const, text: `${sourceLabel(topSource[0])} is the largest source, with ${topSource[1]} ${topSource[1] === 1 ? "case" : "cases"}.`, onClick: () => toggle("source", topSource[0]) } : null,
    topCause ? { id: "cause", tone: "plain" as const, text: `${topCause[0]} is the most common recorded cause, with ${topCause[1]} ${topCause[1] === 1 ? "case" : "cases"}.`, onClick: () => toggle("trackerCause", topCause[0]) } : null,
  ].filter((item): item is { id: string; tone: "warn" | "plain"; text: string; onClick: () => void } => Boolean(item));

  function applyPreset(id: "all" | "7" | "30" | "month") {
    const from = id === "all" ? earliest : id === "7" ? shiftDay(today, -6) : id === "30" ? shiftDay(today, -29) : `${today.slice(0, 8)}01`;
    patch({ from, to: today, bucketFrom: "", bucketTo: "" });
  }
  function pickVolume(lineId: string, from: string, to: string) {
    if (!from) {
      if (lineId !== "total") toggle("channel", lineId);
      return;
    }
    const sameBucket = filters.bucketFrom === from && filters.bucketTo === to;
    if (lineId === "total") {
      patch({ bucketFrom: sameBucket ? "" : from, bucketTo: sameBucket ? "" : to });
      return;
    }
    const same = sameBucket && filters.channel === lineId;
    patch({ channel: same ? "" : lineId, bucketFrom: same ? "" : from, bucketTo: same ? "" : to });
  }
  const activePreset = filters.from === earliest && filters.to === today ? "all" : filters.from === shiftDay(today, -6) && filters.to === today ? "7" : filters.from === shiftDay(today, -29) && filters.to === today ? "30" : filters.from === `${today.slice(0, 8)}01` && filters.to === today ? "month" : "custom";
  const listHref = `/tickets${ticketListQuery({ view: "all", status: filters.status, source: filters.source, city: "", category: "", assignee: "", range: "all", q: (filters.q ?? "").slice(0, 80), page: 1 })}`;
  const updated = new Date(snapshot.asOf).toLocaleString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  function secondaryFilters() { return (
    <>
      <Select label="Customer segment" value={filters.segment ?? ""} options={SEGMENT_ORDER.map((name) => ({ id: name, name }))} onChange={(segment) => patch({ segment })} />
      <Select label="Contact channel" value={filters.channel ?? ""} options={["WhatsApp", "Phone", "Support Form", "Email", "Not specified"].map((name) => ({ id: name, name }))} onChange={(channel) => patch({ channel })} />
      <Select label="Status" value={filters.status} options={TICKET_STATUSES.map((status) => ({ id: status, name: STATUS_LABELS[status] }))} onChange={(status) => patch({ status: status as TicketStatus | "", statusGroup: "" })} />
      <Select label="Topic" value={filters.topic ?? ""} options={topicRank.map((row) => ({ id: row.id, name: row.name }))} onChange={(topic) => patch({ topic })} />
      <Select label="Root cause" value={filters.trackerCause ?? ""} options={causeRank.map((row) => ({ id: row.id, name: row.name }))} onChange={(trackerCause) => patch({ trackerCause })} />
      <Select label="Referring team" value={filters.referringTeam ?? ""} options={["Moderation", "Marketing", "Not specified"].map((name) => ({ id: name, name }))} onChange={(referringTeam) => patch({ referringTeam })} />
      <Select label="Request type" value={filters.requestType ?? ""} options={[...new Set(snapshot.tickets.map((ticket) => ticket.requestType).filter(Boolean)), "__missing__"].map((name) => ({ id: name, name: name === "__missing__" ? "Not recorded" : name }))} onChange={(requestType) => patch({ requestType })} />
    </>
  ); }

  return (
    <div className={`cs-board${refreshing ? " is-refreshing" : ""}`} aria-busy={refreshing} translate="no">
      <header className="cs-title">
        <div>
          <h2>Dashboard</h2>
          <span>Cases reported {filters.from} – {filters.to}. Updated {updated}{refreshing ? " · Updating" : ""}.</span>
        </div>
        <div className="cs-title-actions no-print">
          <button type="button" onClick={() => void refresh()} disabled={refreshing || preview} aria-label="Refresh dashboard"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh</button>
          <button type="button" onClick={exportCsv}>Export <ArrowDownToLine size={14} /></button>
        </div>
      </header>

      <div className="cs-filters no-print">
        <div className="cs-presets" role="group" aria-label="Reported date presets">
          {([["all", "All"], ["7", "7 days"], ["30", "30 days"], ["month", "This month"]] as const).map(([id, label]) => (
            <button type="button" key={id} aria-pressed={activePreset === id} onClick={() => applyPreset(id)}>{label}</button>
          ))}
          {activePreset === "custom" && <span className="is-custom">Custom</span>}
        </div>
        <label>From<input type="date" value={filters.from} max={filters.to} onChange={(event) => patch({ from: event.target.value, bucketFrom: "", bucketTo: "" })} /></label>
        <label>To<input type="date" value={filters.to} min={filters.from} onChange={(event) => patch({ to: event.target.value, bucketFrom: "", bucketTo: "" })} /></label>
        <div className="cs-desktop-filters">{secondaryFilters()}</div>
        <label className="cs-search">Filter this dashboard<input value={filters.q ?? ""} placeholder="Case, school, phone, or email" aria-label="Filter this dashboard" onChange={(event) => patch({ q: event.target.value })} /></label>
        <button type="button" className="cs-drawer-open" onClick={() => setDrawer(true)}><SlidersHorizontal size={14} /> Filters</button>
        <button type="button" onClick={reset}>Reset</button>
      </div>
      {drawer && <FilterDrawer onClose={() => setDrawer(false)}>{secondaryFilters()}</FilterDrawer>}
      {chips.length > 0 && (
        <div className="cs-chips no-print">
          {chips.map((chip) => (
            <button type="button" key={chip.key} onClick={() => patch(chip.key === "bucketFrom" ? { bucketFrom: "", bucketTo: "" } : { [chip.key]: "" })}>
              {chip.label} <X size={12} />
            </button>
          ))}
        </div>
      )}
      {!valid && <p className="cs-alert" role="alert">Choose a reported-date range that starts on or before it ends.</p>}
      {error && <p className="cs-alert" role="alert">{error}</p>}

      <section className="cs-kpis">
        <Kpi label="Total Cases" value={stats.total} detail="Reported in the selected period" selected={false} dim={Boolean(filters.status || filters.statusGroup)} spark={spark} onClick={() => pickGroup("")} />
        <Kpi label="Needs Follow-up" value={stats.followup} detail="Current status within this period" selected={filters.statusGroup === "followup"} dim={Boolean(filters.statusGroup) && filters.statusGroup !== "followup"} tone="followup" onClick={() => pickGroup("followup")} />
        <Kpi label="Resolved" value={stats.resolved} detail="Current status within this period" selected={filters.statusGroup === "resolved"} dim={Boolean(filters.statusGroup) && filters.statusGroup !== "resolved"} tone="resolved" onClick={() => pickGroup("resolved")} />
        <Kpi label="Closed Without Response" value={stats.closed} detail="Current status within this period" selected={filters.statusGroup === "closed"} dim={Boolean(filters.statusGroup) && filters.statusGroup !== "closed"} tone="closed" onClick={() => pickGroup("closed")} />
      </section>
      {insights.length > 0 && (
        <section className="cs-insights" aria-label="What this selection shows">
          {insights.map((item) => (
            <button type="button" key={item.id} className={item.tone === "warn" ? "is-warn" : ""} aria-pressed={item.id === "source" ? filters.source === topSource?.[0] : item.id === "cause" ? filters.trackerCause === topCause?.[0] : item.id === "age" ? filters.age === "15" : item.id === "class" ? filters.topic === "__missing__" && filters.trackerCause === "__missing__" : undefined} onClick={item.onClick}>{item.text}</button>
          ))}
        </section>
      )}
      <div className="cs-row cs-row-volume">
        <Panel
          title="Case volume over time"
          question="Reported cases in the selected period. A zero is a period with no cases."
          action={<div className="cs-modes">
            <button type="button" aria-pressed={!breakdown} onClick={() => setBreakdown(false)}>Total</button>
            <button type="button" aria-pressed={breakdown} onClick={() => setBreakdown(true)}>By channel</button>
            {(["day", "week", "month"] as VolumeMode[]).map((item) => <button type="button" key={item} aria-pressed={volumeMode === item} onClick={() => { setMode(item); patch({ bucketFrom: "", bucketTo: "" }); }}>{item === "day" ? "Daily" : item === "week" ? "Weekly" : "Monthly"}</button>)}
          </div>}
        >
          <VolumeChart buckets={buckets} lines={volumeLines} selectedFrom={filters.bucketFrom ?? ""} selectedLine={breakdown ? (filters.channel ?? "") : ""} onPick={pickVolume} />
        </Panel>
        <Panel title="Fawry payment" question="Recorded on the case. Not recorded stays separate from No.">
          <FawryDonut slices={fawryRows} selectedId={filters.fawry ?? ""} onPick={(id) => toggle("fawry", id)} />
        </Panel>
      </div>
      <div className="cs-row cs-row-even">
        <Panel title="Where cases come from" question="Each case keeps the source it was opened with.">
          <ColumnChart rows={sourceRows} colors={SOURCE_COLORS} selectedId={filters.source} onPick={(id) => toggle("source", id)} />
        </Panel>
        <Panel title="Request types" question="Recorded types stay visible. Not recorded is kept beside them.">
          <CauseChart rows={requestRank} color="#1f6f8b" otherColor="#8aa4b3" missingHint="No request type on the case. Kept separate from the recorded split." selectedId={filters.requestType ?? ""} onPick={(id) => toggle("requestType", id)} />
        </Panel>
      </div>
      <div className="cs-row cs-row-even">
        <Panel title="Root causes" question="Top recorded causes. Not recorded is a completeness check." action={<button type="button" className="cs-text" onClick={() => setAllCauses((open) => !open)}>{allCauses ? "Show top five" : "View all"}</button>}>
          <CauseChart rows={causeRank} selectedId={filters.trackerCause ?? ""} onPick={(id) => toggle("trackerCause", id)} />
        </Panel>
        <Panel title="Most common topics" question="Share of the cases in this chart." action={<button type="button" className="cs-text" onClick={() => setAllTopics((open) => !open)}>{allTopics ? "Show top topics" : "View all"}</button>}>
          <TopicList rows={topicRank} selectedId={filters.topic ?? ""} onPick={(id) => toggle("topic", id)} />
        </Panel>
      </div>
      <div className="cs-row cs-row-even">
        <Panel title="Cases by customer segment" question="Not specified is kept when the source does not name a school group." action={<div className="cs-modes"><button type="button" aria-pressed={!share} onClick={() => setShare(false)}>Count</button><button type="button" aria-pressed={share} onClick={() => setShare(true)}>Percentage</button></div>}>
          <div className="cs-status-key"><span><i style={{ background: STATUS_COLORS.resolved }} />Resolved</span><span><i style={{ background: STATUS_COLORS.followup }} />Needs Follow-up</span><span><i style={{ background: STATUS_COLORS.closed }} />Closed Without Response</span></div>
          <SegmentChart
            rows={segments}
            mode={share ? "share" : "count"}
            selectedSegment={filters.segment ?? ""}
            selectedGroup={filters.statusGroup ?? ""}
            onSegment={(segment) => toggle("segment", segment)}
            onStack={(segment, group) => {
              const same = filters.segment === segment && filters.statusGroup === group;
              patch({ status: "", segment: same ? "" : segment, statusGroup: same ? "" : group });
            }}
          />
        </Panel>
        <Panel title="Open cases by age" question="Calendar days since the reported date. This is case age, not an SLA.">
          <AgeStrip ages={ages} selected={filters.age ?? ""} onPick={(id) => patch({ age: filters.age === id ? "" : id, status: "", statusGroup: filters.age === id ? "" : "followup" })} />
        </Panel>
      </div>
      <div className="cs-row cs-row-even">
        <Panel title="Contact channel" question="How the case arrived. Several sources can share one channel.">
          <SplitBar rows={channelRows} colors={CHANNEL_COLORS} selectedId={filters.channel ?? ""} onPick={(id) => toggle("channel", id)} />
        </Panel>
        <Panel title="Referring team" question="Only Moderation and Marketing cases have a referring team.">
          <BarList rows={teamRows} color="#1d4e3a" selectedId={filters.referringTeam ?? ""} onPick={(id) => toggle("referringTeam", id)} />
        </Panel>
      </div>
      <FollowUp followups={followups} page={currentPage} pages={pages} today={today} openAll={openAll} preview={preview} returnTo={returnTo} listHref={listHref} onPage={setPage} onReset={reset} />
    </div>
  );
}

function FollowUp({ followups, page, pages, today, openAll, preview, returnTo, listHref, onPage, onReset }: { followups: AnalyticsTicket[]; page: number; pages: number; today: string; openAll: AnalyticsTicket[]; preview: boolean; returnTo: string; listHref: string; onPage: (page: number) => void; onReset: () => void }) {
  const slice = followups.slice((page - 1) * 8, page * 8);
  return (
    <section className="cs-panel" id="follow-up">
      <header>
        <div><h3>Cases requiring follow-up</h3><p>{followups.length} open cases in this selection, oldest reported date first.</p></div>
        {!preview && <Link href={listHref}>Ticket list <ArrowUpRight size={14} /></Link>}
      </header>
      <div className="cs-table-scroll">
        <table className="cs-follow-table">
          <thead>
            <tr><th>Case</th><th>Customer</th><th>Status</th><th>Age</th><th>Assignee</th><th>Latest update</th></tr>
          </thead>
          <tbody>
            {slice.map((ticket) => {
              const days = daysSinceReported(reportedDay(ticket), today);
              const old = (days ?? 0) >= 15;
              const unassigned = !ticket.assignee;
              const siblings = siblingCases(ticket, openAll);
              return (
                <tr key={ticket.id} className={old || unassigned ? "is-attention" : ""}>
                  <td>{preview ? ticket.number : <Link href={`/tickets/${ticket.id}?returnTo=${encodeURIComponent(returnTo)}`}>{ticket.number}</Link>}<small>{ticket.subject || "No summary recorded"}</small></td>
                  <td>{ticket.customerName || "Not recorded"}{ticket.schoolName ? <small>{ticket.schoolName}</small> : null}{siblings.length > 0 && <small className="cs-sibling">Also open: {siblings.map((item) => item.number).join(", ")}</small>}</td>
                  <td><em className={`cs-status cs-status-${statusGroup(ticket.status)}`}>{STATUS_LABELS[ticket.status]}</em></td>
                  <td>{days == null ? "Not recorded" : `${days} days`}{old && <small>Older case</small>}</td>
                  <td>{unassigned ? <strong className="cs-unassigned">Not assigned</strong> : ticket.assignee}</td>
                  <td>{ticket.updatedOn && ticket.updatedOn !== reportedDay(ticket) ? ticket.updatedOn : "Not recorded"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="cs-follow-cards">
          {slice.map((ticket) => {
            const days = daysSinceReported(reportedDay(ticket), today);
            const old = (days ?? 0) >= 15;
            return (
              <article key={ticket.id} className={old || !ticket.assignee ? "is-attention" : ""}>
                <strong>{preview ? ticket.number : <Link href={`/tickets/${ticket.id}?returnTo=${encodeURIComponent(returnTo)}`}>{ticket.number}</Link>}</strong>
                <p>{ticket.subject || "No summary recorded"}</p>
                <p>{ticket.customerName || "Not recorded"}{ticket.schoolName ? ` · ${ticket.schoolName}` : ""}</p>
                <p><em className={`cs-status cs-status-${statusGroup(ticket.status)}`}>{STATUS_LABELS[ticket.status]}</em> {days == null ? "Age not recorded" : `${days} days`} · {ticket.assignee || "Not assigned"}</p>
              </article>
            );
          })}
        </div>
        {!followups.length && <EmptyChart text="No cases in this selection need follow-up." onReset={onReset} />}
      </div>
      <footer>
        <span>{followups.length ? (page - 1) * 8 + 1 : 0}–{Math.min(page * 8, followups.length)} of {followups.length}</span>
        <div><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>
      </footer>
    </section>
  );
}

function Kpi({ label, value, detail, selected, dim, tone, spark, onClick }: { label: string; value: number; detail: string; selected: boolean; dim: boolean; tone?: StatusGroup; spark?: number[]; onClick: () => void }) {
  return (
    <button type="button" className={`cs-kpi ${selected ? "is-on" : ""} ${dim ? "is-dim" : ""} ${tone ? `cs-kpi-${tone}` : ""}`} aria-pressed={selected} onClick={onClick}>
      {selected && <em>Selected</em>}
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
      {spark && <Sparkline values={spark} />}
    </button>
  );
}

function FilterDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.showModal();
    return () => { if (node.open) node.close(); };
  }, []);
  return (
    <dialog ref={ref} className="cs-drawer" aria-label="Dashboard filters" onClose={onClose}>
      <header><h3>Filters</h3><button type="button" onClick={onClose} aria-label="Close filters"><X size={16} /></button></header>
      <div className="cs-filters">{children}</div>
      <footer><button type="button" onClick={onClose}>Show results</button></footer>
    </dialog>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <label>{label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}
