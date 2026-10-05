"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, RefreshCw, X } from "lucide-react";
import { sourceLabel, STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import { dashboardQuery, type DashboardFilters } from "@/lib/tickets/filters";
import { csvCell, isOpen, validDay, type AnalyticsTicket } from "@/lib/tickets/analytics";
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
import { EmptyChart, Panel, RankChart, SegmentChart, STATUS_COLORS, VolumeChart } from "./overview-charts";

type Snapshot = { tickets: AnalyticsTicket[]; asOf: string };
type Option = { id: string; name: string };

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
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [surface, setSurface] = useState<"overview" | "analysis">("overview");
  const [mode, setMode] = useState<VolumeMode | "">("");
  const [share, setShare] = useState(false);
  const [allTopics, setAllTopics] = useState(false);
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
  const causeRank = useMemo(() => rankValues(causeFrame, (ticket) => ticket.trackerCause, 6, "Other causes"), [causeFrame]);
  const topicRank = useMemo(() => rankValues(topicFrame, (ticket) => ticket.topic, allTopics ? 99 : 6, "Other topics"), [topicFrame, allTopics]);
  const causeTops = useMemo(() => topNames(rankValues(causeFrame, (ticket) => ticket.trackerCause, 6, "Other causes")), [causeFrame]);
  const topicTops = useMemo(() => topNames(rankValues(topicFrame, (ticket) => ticket.topic, 6, "Other topics")), [topicFrame]);
  const rows = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), [], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const volumeFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["source", "bucket"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const segmentFrame = useMemo(() => snapshot.tickets.filter((ticket) => matchesOverview(ticket, queryOf(causeTops, topicTops), ["segment", "statusGroup"], today)), [snapshot.tickets, queryOf, causeTops, topicTops, today]);
  const stats = headline(rows);
  const sources = useMemo(() => {
    const order = ["whatsapp", "call_center", "moderation", "marketing_team", "business_development", "june_schools", "google_play"];
    const present = new Set<string>(volumeFrame.map((ticket) => ticket.source));
    if (filters.source) present.add(filters.source);
    return [...order.filter((source) => present.has(source)), ...[...present].filter((source) => !order.includes(source))];
  }, [volumeFrame, filters.source]);
  const buckets = useMemo(() => valid ? volumeBuckets(volumeFrame, filters.from, filters.to, volumeMode, sources) : [], [volumeFrame, filters.from, filters.to, volumeMode, sources, valid]);
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
    { id: "yes", name: "Yes", count: rows.filter((ticket) => ticket.fawry === "yes").length },
    { id: "no", name: "No", count: rows.filter((ticket) => ticket.fawry === "no").length },
    { id: "__missing__", name: "Not recorded", count: rows.filter((ticket) => !ticket.fawry).length },
  ];
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
    filters.q ? { key: "q", label: `Search: ${filters.q}` } : null,
  ].filter((chip): chip is { key: keyof DashboardFilters; label: string } => Boolean(chip));

  const channelRows = rankValues(rows, (ticket) => contactChannel(ticket.source), 8, "Other channels");
  const teamRows = rankValues(rows, (ticket) => referringTeam(ticket.source), 8, "Other teams");
  const ages = AGE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: rows.filter((ticket) => isOpen(ticket) && ageBucketId(daysSinceReported(reportedDay(ticket), today) ?? 0) === bucket.id).length,
  }));

  return (
    <div className="cs-board">
      <header className="cs-title">
        <div>
          <p>Customer Support</p>
          <h2>Customer Support Overview</h2>
          <span>Last updated {new Date(snapshot.asOf).toLocaleString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} · Reported dates {filters.from} – {filters.to}</span>
        </div>
        <div className="cs-title-actions no-print">
          <button type="button" onClick={() => void refresh()} disabled={refreshing || preview} aria-label="Refresh dashboard"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /></button>
          <button type="button" onClick={exportCsv}>Export filtered cases <ArrowDownToLine size={14} /></button>
        </div>
      </header>

      <div className="cs-filters no-print">
        <label>Reported date<input type="date" value={filters.from} max={filters.to} onChange={(event) => patch({ from: event.target.value, bucketFrom: "", bucketTo: "" })} /></label>
        <label>to<input type="date" value={filters.to} min={filters.from} onChange={(event) => patch({ to: event.target.value, bucketFrom: "", bucketTo: "" })} /></label>
        <Select label="Customer segment" value={filters.segment ?? ""} options={SEGMENT_ORDER.map((name) => ({ id: name, name }))} onChange={(segment) => patch({ segment })} />
        <Select label="Contact channel" value={filters.channel ?? ""} options={["WhatsApp", "Phone", "Support Form", "Email", "Not specified"].map((name) => ({ id: name, name }))} onChange={(channel) => patch({ channel })} />
        <label className="cs-search">Search<input value={filters.q ?? ""} placeholder="Case, school, phone, email, text" onChange={(event) => patch({ q: event.target.value })} /></label>
        <button type="button" aria-expanded={more} onClick={() => setMore((open) => !open)}>More filters</button>
        <button type="button" onClick={reset}>Reset filters</button>
      </div>
      {more && (
        <div className="cs-filters no-print">
          <Select label="Status" value={filters.status} options={TICKET_STATUSES.map((status) => ({ id: status, name: STATUS_LABELS[status] }))} onChange={(status) => patch({ status: status as TicketStatus | "", statusGroup: "" })} />
          <Select label="Topic" value={filters.topic ?? ""} options={topicRank.map((row) => ({ id: row.id, name: row.name }))} onChange={(topic) => patch({ topic })} />
          <Select label="Root cause" value={filters.trackerCause ?? ""} options={causeRank.map((row) => ({ id: row.id, name: row.name }))} onChange={(trackerCause) => patch({ trackerCause })} />
          <Select label="Referring team" value={filters.referringTeam ?? ""} options={["Moderation", "Marketing", "Not specified"].map((name) => ({ id: name, name }))} onChange={(referringTeam) => patch({ referringTeam })} />
          <Select label="Request type" value={filters.requestType ?? ""} options={[...new Set(snapshot.tickets.map((ticket) => ticket.requestType).filter(Boolean)), "__missing__"].map((name) => ({ id: name, name: name === "__missing__" ? "Not recorded" : name }))} onChange={(requestType) => patch({ requestType })} />
        </div>
      )}
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
      <p className="cs-scope"><strong>{stats.total.toLocaleString()}</strong> cases with a reported date from {filters.from} to {filters.to}</p>
      {unclassified > 0 && <p className="cs-notice">{unclassified} cases in this selection have no tracker topic or root cause yet. They stay in the totals and appear as Not recorded.</p>}

      <div className="cs-switch no-print" role="tablist" aria-label="Dashboard sections">
        <button type="button" role="tab" aria-selected={surface === "overview"} onClick={() => setSurface("overview")}>Overview</button>
        <button type="button" role="tab" aria-selected={surface === "analysis"} onClick={() => setSurface("analysis")}>Detailed analysis</button>
      </div>

      <section className="cs-kpis">
        <Kpi label="Total Cases" value={stats.total} detail="Distinct cases in this selection" selected={false} dim={Boolean(filters.status || filters.statusGroup)} onClick={() => pickGroup("")} />
        <Kpi label="Needs Follow-up" value={stats.followup} detail={`${stats.fresh} new · ${stats.progress} in progress · ${stats.awaiting} awaiting reply`} selected={filters.statusGroup === "followup"} dim={Boolean(filters.statusGroup) && filters.statusGroup !== "followup"} tone="followup" onClick={() => pickGroup("followup")} />
        <Kpi label="Resolved" value={stats.resolved} detail={`${Math.round(stats.resolvedShare * 100)}% of selected cases`} selected={filters.statusGroup === "resolved"} dim={Boolean(filters.statusGroup) && filters.statusGroup !== "resolved"} tone="resolved" onClick={() => pickGroup("resolved")} />
        <Kpi label="Closed Without Response" value={stats.closed} detail="Separate from resolved cases" selected={filters.statusGroup === "closed"} dim={Boolean(filters.statusGroup) && filters.statusGroup !== "closed"} tone="closed" onClick={() => pickGroup("closed")} />
      </section>

      <section className="cs-fawry" aria-label="Fawry payment">
        <span>Fawry payment</span>
        {fawryRows.map((item) => (
          <button key={item.id} type="button" className={filters.fawry === item.id ? "is-on" : filters.fawry ? "is-dim" : ""} aria-pressed={filters.fawry === item.id} onClick={() => toggle("fawry", item.id)}>
            <b>{item.name}</b><strong>{item.count}</strong>
          </button>
        ))}
      </section>

      {surface === "overview" ? (
        <>
          <div className="cs-row cs-row-volume">
            <Panel
              title="Case volume over time"
              question="When are cases reported, and which source sends them?"
              action={<div className="cs-modes">{(["day", "week", "month"] as VolumeMode[]).map((item) => <button type="button" key={item} aria-pressed={volumeMode === item} onClick={() => { setMode(item); patch({ bucketFrom: "", bucketTo: "" }); }}>{item === "day" ? "Daily" : item === "week" ? "Weekly" : "Monthly"}</button>)}</div>}
            >
              <VolumeChart
                buckets={buckets}
                sources={sources}
                selectedSource={filters.source}
                selectedFrom={filters.bucketFrom ?? ""}
                onInterval={(from, to) => {
                  const same = filters.bucketFrom === from && filters.bucketTo === to && !filters.source;
                  patch({ bucketFrom: same ? "" : from, bucketTo: same ? "" : to, source: "" });
                }}
                onSegment={(source, from, to) => {
                  const same = filters.source === source && filters.bucketFrom === from && filters.bucketTo === to;
                  patch({ source: same ? "" : source, bucketFrom: same ? "" : from, bucketTo: same ? "" : to });
                }}
              />
            </Panel>
            <Panel title="Root causes" question="What is causing these support issues?">
              <RankChart rows={causeRank} color="#0f766e" selectedId={filters.trackerCause ?? ""} onPick={(id) => toggle("trackerCause", id)} />
            </Panel>
          </div>
          <div className="cs-row cs-row-even">
            <Panel
              title="Cases by customer segment"
              question="How does workload and current status differ by customer group?"
              action={<div className="cs-modes"><button type="button" aria-pressed={!share} onClick={() => setShare(false)}>Count</button><button type="button" aria-pressed={share} onClick={() => setShare(true)}>Percentage</button></div>}
            >
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
            <Panel title="Most common topics" question="What are customers contacting support about?" action={<button type="button" className="cs-text" onClick={() => setAllTopics((open) => !open)}>{allTopics ? "Show top topics" : "View all topics"}</button>}>
              <RankChart rows={topicRank} color="#3730a3" selectedId={filters.topic ?? ""} showRequests onPick={(id) => toggle("topic", id)} />
            </Panel>
          </div>
          <section className="cs-panel" id="follow-up">
            <header>
              <div><h3>Cases requiring follow-up</h3><p>{followups.length} open cases in this selection, oldest reported date first.</p></div>
              {!preview && <Link href="/tickets">View all cases <ArrowUpRight size={14} /></Link>}
            </header>
            <div className="cs-table-scroll">
              <table>
                <thead>
                  <tr><th>Case</th><th>Customer / school</th><th>Segment</th><th>Topic</th><th>Status</th><th>Reported</th><th>Days since reported</th><th>Assignee</th><th>Latest update</th></tr>
                </thead>
                <tbody>
                  {followups.slice((currentPage - 1) * 8, currentPage * 8).map((ticket) => {
                    const siblings = siblingCases(ticket, openAll);
                    const days = daysSinceReported(reportedDay(ticket), today);
                    return (
                      <tr key={ticket.id}>
                        <td>{preview ? ticket.number : <Link href={`/tickets/${ticket.id}?returnTo=${encodeURIComponent(returnTo)}`}>{ticket.number}</Link>}</td>
                        <td>{ticket.customerName || "Not recorded"}{ticket.schoolName ? <small>{ticket.schoolName}</small> : null}{siblings.length > 0 && <small className="cs-sibling">Also open: {siblings.map((item) => item.number).join(", ")}</small>}</td>
                        <td>{customerSegment(ticket.source)}</td>
                        <td>{ticket.topic || "Not recorded"}</td>
                        <td><em className={`cs-status cs-status-${statusGroup(ticket.status)}`}>{STATUS_LABELS[ticket.status]}</em></td>
                        <td>{reportedDay(ticket)}</td>
                        <td>{days == null ? "Not recorded" : days}</td>
                        <td>{ticket.assignee || "Not assigned"}</td>
                        <td>{ticket.updatedOn && ticket.updatedOn !== reportedDay(ticket) ? ticket.updatedOn : "Not recorded"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!followups.length && <EmptyChart text="No cases in this selection need follow-up." onReset={reset} />}
            </div>
            <footer>
              <span>{followups.length ? (currentPage - 1) * 8 + 1 : 0}–{Math.min(currentPage * 8, followups.length)} of {followups.length}</span>
              <div><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
            </footer>
          </section>
        </>
      ) : (
        <div className="cs-analysis">
          <Panel title="Cases by contact channel" question="How did the case arrive?">
            <RankChart rows={channelRows} color="#0e7490" selectedId={filters.channel ?? ""} onPick={(id) => toggle("channel", id)} />
          </Panel>
          <Panel title="Cases by referring team" question="Which team referred the case, when that is recorded?">
            <RankChart rows={teamRows} color="#7c3aed" selectedId={filters.referringTeam ?? ""} onPick={(id) => toggle("referringTeam", id)} />
          </Panel>
          <Panel title="Open cases by age" question="How long open cases have been waiting since the reported date. These are age groups.">
            <div className="cs-ages">
              {ages.map((bucket) => (
                <button type="button" key={bucket.id} className={filters.age === bucket.id ? "is-on" : filters.age ? "is-dim" : ""} aria-pressed={filters.age === bucket.id} onClick={() => patch({ age: filters.age === bucket.id ? "" : bucket.id, statusGroup: "followup" })}>
                  <i style={{ height: `${(bucket.count / Math.max(1, ...ages.map((item) => item.count))) * 100}%` }} />
                  <strong>{bucket.count}</strong>
                  <span>{bucket.label}</span>
                </button>
              ))}
            </div>
          </Panel>
          <p className="cs-notice">Resolution time, grade and subject heatmaps, and reopened-case trends stay out of this view until those dates and fields are recorded on the case.</p>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, detail, selected, dim, tone, onClick }: { label: string; value: number; detail: string; selected: boolean; dim: boolean; tone?: StatusGroup; onClick: () => void }) {
  return (
    <button type="button" className={`cs-kpi ${selected ? "is-on" : ""} ${dim ? "is-dim" : ""} ${tone ? `cs-kpi-${tone}` : ""}`} aria-pressed={selected} onClick={onClick}>
      {selected && <em>Selected</em>}
      <span>{label}</span>
      <strong><CountUp value={value} /></strong>
      <small>{detail}</small>
    </button>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = reduce ? 1 : Math.min(1, (now - start) / 720);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString()}</>;
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
