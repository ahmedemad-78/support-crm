"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Archive, ArrowDown, ArrowDownToLine, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleCheck, FileText, Hourglass, Inbox, Info, ListFilter, RefreshCw, RotateCcw, Search, SearchX, SlidersHorizontal, Table2, TrendingDown, TrendingUp, X, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { cairoDate, shiftDay } from "@/lib/tickets/dashboard-model";
import type { DashboardFilters } from "@/lib/tickets/filters";
import { businessCsv, businessQuery, completeHistory, displayValue, field, filterBusinessTickets, isOpenCase, lastActivity, parseBusinessFilters, ranking, timeBuckets, MISSING, DIMENSIONS, type BusinessFilters, type Dimension, type Snapshot } from "@/lib/tickets/business-analytics";
import { recordReview } from "@/lib/tickets/single-page-model";
import { Count } from "./business-charts";
import { useLiveAnalytics } from "./use-live-analytics";
import { CausePareto, DemandArea, Handling, LocationMap, OutcomeDonut, Problems, SourceMix, type PickFilter } from "./single-page-charts";
import { CaseTable, Coverage, StatusBreakdown } from "./single-page-panels";
import "./single-page.css";

type Option = { id: string; name: string };
type Props = { initialSnapshot: Snapshot; initialFilters: DashboardFilters | BusinessFilters; cities?: Option[]; categories?: Option[]; preview?: boolean; userId?: string; previewLoader?: () => Promise<Snapshot>; initialTab?: string };

const LABELS: Record<Dimension, string> = { source: "Source", status: "Status", requestType: "Request type", topic: "Problem topic", trackerCause: "Recorded cause", trackerAction: "Action taken", outcome: "Resolution outcome", assignee: "Support assignee", reporterId: "Reporting owner", school: "School", fawry: "Fawry-related flag", origin: "Record origin", reopened: "Ever reopened", platform: "Platform", appVersion: "App version", latestVersion: "Latest version?", city: "City / area", userType: "Customer type", category: "Intake category" };
const MAIN: Dimension[] = ["status", "topic", "trackerCause", "trackerAction", "outcome", "reopened", "city", "assignee", "reporterId"];
const CONTEXT: Dimension[] = ["fawry", "origin", "school", "userType", "platform", "appVersion", "latestVersion", "category"];
const BASIS_LABELS: Record<BusinessFilters["basis"], string> = { reported: "Reported date", created: "System creation date", resolved: "Latest resolution date" };
const BASIS_NOTES: Record<BusinessFilters["basis"], string> = {
  reported: "Reported dates include historical records; they are different from when a case entered the system.",
  created: "System creation dates include imported records. They are not proof of first customer contact.",
  resolved: "Only cases with a recorded resolution timestamp enter this date view.",
};
const PERIODS = [{ id: "all", label: "All time" }, { id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }, { id: "year", label: "This year" }, { id: "custom", label: "Custom" }] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function DashboardBoard({ initialSnapshot, initialFilters, cities = [], categories = [], preview = false, userId, previewLoader }: Props) {
  const { snapshot, refreshing, error, refresh } = useLiveAnalytics(initialSnapshot, { preview, userId, previewLoader });
  const [filters, setFilters] = useState(() => parseBusinessFilters(initialFilters as unknown as Record<string, unknown>));
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const today = cairoDate(snapshot.asOf);

  const sources = useMemo(() => new Map([...(snapshot.sources ?? []).map((s) => [s.code, s.name] as [string, string]), ...snapshot.tickets.map((t) => [t.source, t.sourceName || displayValue("source", t.source, [])] as [string, string])]), [snapshot]);
  const names = useCallback(
    (key: Dimension, value: string) =>
      key === "city" ? (value === MISSING ? "City not supplied" : cities.find((c) => c.id === value)?.name || value) : key === "category" ? categories.find((c) => c.id === value)?.name || value : displayValue(key, value, snapshot.tickets, sources),
    [cities, categories, snapshot.tickets, sources],
  );
  const patch = useCallback((update: Partial<BusinessFilters>) => setFilters((f) => ({ ...f, ...update })), []);

  useEffect(() => {
    if (!preview) window.history.replaceState(null, "", `/dashboard?${businessQuery(filters)}`);
  }, [filters, preview]);
  useEffect(() => {
    if (preview) return;
    const restore = () => setFilters(parseBusinessFilters(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [preview]);
  useEffect(() => {
    if (!exportOpen) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !exportRef.current?.contains(event.target as Node)) setExportOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [exportOpen]);

  const rows = useMemo(() => filterBusinessTickets(snapshot.tickets, filters), [snapshot.tickets, filters]);
  const open = useMemo(() => filterBusinessTickets(snapshot.tickets, filters, true).filter(isOpenCase).sort((a, b) => lastActivity(a).localeCompare(lastActivity(b))), [snapshot.tickets, filters]);
  const resolved = useMemo(() => rows.filter((t) => t.status === "resolved"), [rows]);
  const review = useMemo(() => recordReview(rows), [rows]);
  const reopened = rows.filter((t) => (t.reopenCount ?? 0) > 0).length;
  const reopenEvents = rows.reduce((n, t) => n + (t.reopenCount ?? 0), 0);
  const eligible = rows.filter((t) => completeHistory(t, snapshot.asOf)).length;
  const openInSelection = rows.filter(isOpenCase).length;
  const closed = rows.filter((t) => t.status === "closed").length;

  const active = DIMENSIONS.filter((k) => filters[k]);
  const hasDates = !!(filters.from || filters.to);
  const invalidDates = !!(filters.from && filters.to && filters.from > filters.to);
  const selectionCount = active.length + Number(hasDates) + Number(!!filters.q) + Number(filters.basis !== "reported");
  const query = businessQuery(filters);

  const presetRange = useCallback(
    (id: PeriodId) => {
      if (id === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
      if (id === "7" || id === "30" || id === "90") return { from: shiftDay(today, 1 - Number(id)), to: today };
      return { from: "", to: "" };
    },
    [today],
  );
  const preset = PERIODS.find((p) => p.id !== "all" && p.id !== "custom" && presetRange(p.id).from === filters.from && presetRange(p.id).to === filters.to);
  const period: PeriodId = customOpen ? "custom" : !hasDates ? "all" : (preset?.id ?? "custom");
  const choosePeriod = (id: PeriodId) => {
    if (id === "custom") {
      setCustomOpen(true);
      if (!hasDates) patch({ from: snapshot.tickets.map((t) => t.reportedOn || t.createdOn).filter(Boolean).sort()[0] || today, to: today });
      return;
    }
    setCustomOpen(false);
    patch(presetRange(id));
  };
  const periodLabel = !hasDates ? "All time" : period === "year" ? "This year" : period !== "custom" && preset ? `Last ${preset.label}` : `${filters.from ? shortDay(filters.from) : "Start"} – ${filters.to ? shortDay(filters.to) : "today"}`;

  const comparison = useMemo(() => {
    if (!filters.from || !filters.to || filters.from > filters.to) return null;
    const days = daysBetween(filters.from, filters.to);
    const previous = filterBusinessTickets(snapshot.tickets, { ...filters, from: shiftDay(filters.from, -days), to: shiftDay(filters.from, -1) }).length;
    return { days, previous };
  }, [snapshot.tickets, filters]);

  const pick: PickFilter = (key, value, second) => {
    const clear = filters[key] === value && (!second || filters[second[0]] === second[1]);
    patch({ [key]: clear ? "" : value, ...(second ? { [second[0]]: clear ? "" : second[1] } : {}) });
  };
  const toggle = (key: Dimension, value: string) => patch({ [key]: filters[key] === value ? "" : value });
  const options = (key: Dimension) => {
    const frame = filterBusinessTickets(snapshot.tickets, { ...filters, [key]: "" });
    const counts = new Map(ranking(frame, key, sources, 100000).map((r) => [r.id, r.count]));
    const ids = new Set(snapshot.tickets.map((t) => field(t, key)));
    if (key === "source") snapshot.sources?.forEach((s) => ids.add(s.code));
    if (filters[key]) ids.add(filters[key]);
    return [...ids].map((id) => ({ id, name: names(key, id), count: counts.get(id) || 0 })).sort((a, b) => (a.id === MISSING ? 1 : b.id === MISSING ? -1 : a.name.localeCompare(b.name)));
  };
  const filterSelect = (key: Dimension, inline = false) => (
    <FilterSelect key={key} inline={inline} label={LABELS[key]} value={filters[key]} allLabel={key === "source" ? "All sources" : key === "requestType" ? "All request types" : "All values"} options={options(key)} onChange={(value) => patch({ [key]: value })} />
  );
  const reset = () => {
    setCustomOpen(false);
    patch(parseBusinessFilters({}));
  };
  const csv = () => {
    const url = URL.createObjectURL(new Blob([businessCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `support-analytics-${filters.from || "all"}-${filters.to || "today"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportOpen(false);
  };

  const trend = useMemo(() => timeBuckets(rows, filters, snapshot.asOf).map((b) => b.count), [rows, filters, snapshot.asOf]);
  const change = comparison?.previous ? percent(rows.length - comparison.previous, comparison.previous) : null;
  const totalNote = comparison
    ? comparison.previous
      ? `vs ${comparison.previous.toLocaleString()} in the previous ${comparison.days} days`
      : `No cases in the previous ${comparison.days} days`
    : selectionCount
      ? `${percent(rows.length, snapshot.tickets.length)}% of all ${snapshot.tickets.length.toLocaleString()} cases`
      : "Every recorded case";
  const share = (n: number) => percent(n, rows.length);

  return (
    <div className="ov-board" aria-busy={refreshing}>
      <header className="ov-head">
        <div className="ov-head-title">
          <h2>Support overview</h2>
          <p role="status" aria-live="polite">
            <strong>{rows.length.toLocaleString()}</strong> of {snapshot.tickets.length.toLocaleString()} cases · {periodLabel}
            {selectionCount > Number(hasDates) ? ` · ${selectionCount - Number(hasDates)} filter${selectionCount - Number(hasDates) === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="ov-head-actions no-print">
          <div className="ov-live" role="status" data-state={error ? "error" : refreshing ? "busy" : "ok"}>
            <i aria-hidden="true" />
            <span>{refreshing ? "Checking for updates…" : preview && !previewLoader ? "Design preview" : error ? "Update paused" : "Live · every 15s"}</span>
            <small>Updated {formatDateTime(snapshot.asOf)}</small>
          </div>
          <button type="button" className="ov-button is-icon" onClick={() => void refresh()} disabled={refreshing || (preview && !previewLoader)} aria-label="Refresh analytics" title="Refresh">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          <div className="ov-export" ref={exportRef}>
            <button type="button" className="ov-button" aria-expanded={exportOpen} aria-haspopup="menu" onClick={() => setExportOpen((v) => !v)}>
              <ArrowDownToLine size={16} />Export<ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="ov-export-menu" role="menu">
                <button type="button" role="menuitem" onClick={csv}><Table2 size={16} /><span>CSV<small>{rows.length.toLocaleString()} matching cases</small></span></button>
                <button type="button" role="menuitem" onClick={() => { setExportOpen(false); requestAnimationFrame(() => window.print()); }}><FileText size={16} /><span>PDF<small>Print this dashboard</small></span></button>
              </div>
            )}
          </div>
          {!preview && <Link className="ov-button is-primary" href={`/tickets?scope=dashboard&view=all&${query}`}>View matching cases<ArrowUpRight size={16} /></Link>}
        </div>
      </header>

      <div className="ov-filterbar no-print">
        <div className="ov-filterbar-main">
          <div className="ov-segmented" role="group" aria-label="Period">
            {PERIODS.map((p) => <button type="button" key={p.id} aria-pressed={period === p.id} onClick={() => choosePeriod(p.id)}>{p.label}</button>)}
          </div>
          {filterSelect("source", true)}
          {filterSelect("requestType", true)}
          <button type="button" className={`ov-button ov-more ${filterOpen ? "is-active" : ""}`} aria-expanded={filterOpen} aria-controls="ov-filters" onClick={() => setFilterOpen((v) => !v)}>
            <SlidersHorizontal size={16} />More filters{selectionCount > 0 && <span className="ov-count-tag">{selectionCount}</span>}
          </button>
        </div>
        {period === "custom" && (
          <div className="ov-dates">
            <label>From<input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => patch({ from: e.target.value })} /></label>
            <label>To<input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => patch({ to: e.target.value })} /></label>
            <button type="button" className="ov-link" onClick={() => choosePeriod("all")}>Clear period</button>
          </div>
        )}
        <div id="ov-filters" className={`ov-filter-panel ${filterOpen ? "is-open" : ""}`} inert={!filterOpen} aria-hidden={!filterOpen}>
          <div>
            <div className="ov-filter-inner">
              <div className="ov-filter-grid">
                <FilterSelect allowAll={false} label="Date basis" value={filters.basis} allLabel="Reported date" options={(Object.keys(BASIS_LABELS) as BusinessFilters["basis"][]).map((id) => ({ id, name: BASIS_LABELS[id] }))} onChange={(value) => patch({ basis: value as BusinessFilters["basis"] })} />
                {MAIN.map((key) => filterSelect(key))}
              </div>
              <details className="ov-context-filters">
                <summary>Context · payments, schools, platform and record origin</summary>
                <div className="ov-filter-grid">{CONTEXT.map((key) => filterSelect(key))}</div>
                <p className="ov-footnote">Fawry-related is a recorded flag, not a payment failure or transaction count.</p>
              </details>
              <div className="ov-filter-bottom">
                <label className="ov-search"><span>Find a case</span><Search size={16} aria-hidden="true" /><input type="search" value={filters.q} placeholder="Case, customer, school or problem" onChange={(e) => patch({ q: e.target.value })} /></label>
                <button type="button" className="ov-button" onClick={() => setFilterOpen(false)}>Done</button>
              </div>
            </div>
          </div>
        </div>
        {selectionCount > 0 && (
          <div className="ov-chips">
            {active.map((key) => <button type="button" key={key} onClick={() => patch({ [key]: "" })} aria-label={`Clear ${LABELS[key]}: ${names(key, filters[key])}`}><span>{LABELS[key]}</span>{names(key, filters[key])}<X size={14} /></button>)}
            {hasDates && <button type="button" onClick={() => choosePeriod("all")} aria-label="Clear period"><span>Period</span>{filters.from ? shortDay(filters.from) : "Start"} – {filters.to ? shortDay(filters.to) : "Present"}<X size={14} /></button>}
            {filters.q && <button type="button" onClick={() => patch({ q: "" })} aria-label="Clear search"><span>Search</span>{filters.q}<X size={14} /></button>}
            {filters.basis !== "reported" && <button type="button" onClick={() => patch({ basis: "reported" })} aria-label="Reset date basis"><span>Date basis</span>{BASIS_LABELS[filters.basis]}<X size={14} /></button>}
            <button type="button" className="ov-clear-all" onClick={reset}>Clear all</button>
          </div>
        )}
      </div>

      {invalidDates && <p className="ov-alert" role="alert">Start date must be on or before end date.</p>}
      {error && <p className="ov-alert" role="status">{error}</p>}
      <p className="ov-print-scope">Updated {formatDateTime(snapshot.asOf)} · {filters.from || "All dates"} – {filters.to || "present"} · {filters.basis} date · {active.map((k) => `${LABELS[k]}: ${names(k, filters[k])}`).join(" · ") || "All sources and dimensions"}</p>

      <div className="ov-kpis">
        <Kpi tone="total" icon={Inbox} label="Total cases" value={rows.length} note={totalNote} trend={trend} change={change} />
        <Kpi tone="open" icon={Hourglass} label="Needs follow-up" value={openInSelection} share={share(openInSelection)} note="of selection · still open" href="#ov-followup" action="See open cases" />
        <Kpi tone="resolved" icon={CircleCheck} label="Marked resolved" value={resolved.length} share={share(resolved.length)} note="of selection" pressed={filters.status === "resolved"} onClick={() => toggle("status", "resolved")} action="Filter resolved cases" />
        <Kpi tone="closed" icon={Archive} label="Closed, no response" value={closed} share={share(closed)} note="of selection · not counted as resolved" pressed={filters.status === "closed"} onClick={() => toggle("status", "closed")} action="Filter closed cases" />
        <Kpi tone="reopened" icon={RotateCcw} label="Ever reopened" value={reopened} share={share(reopened)} note={`of selection · ${reopenEvents} reopen event${reopenEvents === 1 ? "" : "s"}`} pressed={filters.reopened === "yes"} onClick={() => toggle("reopened", "yes")} action="Filter reopened cases" />
      </div>

      {rows.length === 0 ? (
        <section className="ov-panel ov-blank">
          <SearchX size={28} aria-hidden="true" />
          <h3>No cases match this selection</h3>
          <p>{invalidDates ? "The start date is after the end date." : "Widen the period or remove a filter to see cases again."}</p>
          {selectionCount > 0 && <button type="button" className="ov-button is-primary" onClick={reset}>Clear all filters</button>}
        </section>
      ) : (
        <>
          <div className="ov-grid">
            <Panel id="demand" size="lead" title="Case volume" subtitle={`By ${BASIS_LABELS[filters.basis].toLowerCase()}`} note={`${BASIS_NOTES[filters.basis]} Select a point to focus on that period.`}>
              <DemandArea tickets={rows} filters={filters} asOf={snapshot.asOf} onPickRange={(from, to) => { setCustomOpen(true); patch({ from, to }); }} />
            </Panel>
            <div className="ov-stack">
              <Panel id="status" title="Current status" subtitle="Where the selected cases stand now" note="Current status of the selected cases. Closed without response is separate from resolved.">
                <StatusBreakdown tickets={rows} selected={filters.status} onPick={(status) => toggle("status", status)} />
              </Panel>
              <Panel id="attention" title="Needs attention" subtitle="Record review · flags may overlap">
                <div className="ov-attention">
                  <AttentionRow tone="warn" count={review.inconsistent.length} title="Resolved, but the issue persists" detail="Review the closure and recorded result" onClick={() => patch({ status: "resolved", outcome: "Issue Persists" })} />
                  <AttentionRow count={review.incomplete.length} title="Classification incomplete" detail="At least one of five tracker fields is missing" />
                  <AttentionRow count={review.missingReporter.length} title="No reporting owner" detail="Source is recorded, the individual is not" onClick={() => pick("reporterId", MISSING)} />
                </div>
              </Panel>
            </div>
          </div>

          <SectionTitle title="Demand" subtitle="Who brings the work, and what it is about" />
          <div className="ov-grid">
            <Panel id="sources" size="wide" title="Sources by request type" subtitle="Each bar is one source · select a segment to filter both" meta={`${rows.length.toLocaleString()} cases`}>
              <SourceMix tickets={rows} sources={sources} onPick={pick} />
            </Panel>
            <Panel id="problems" size="narrow" title="Most reported problems" subtitle="Tracker topics, exactly as recorded">
              <Problems tickets={rows} onPick={pick} />
            </Panel>
          </div>

          <SectionTitle title="Diagnosis and results" subtitle="Recorded causes, what Support did, and how it ended" />
          <div className="ov-grid">
            <Panel id="causes" size="third" title="Recorded causes" subtitle="Bars: cases · line: cumulative share" note="Pareto of recorded cause labels, shown as stored. The cumulative line uses cases with a recorded cause only.">
              <CausePareto tickets={rows} onPick={pick} />
            </Panel>
            <Panel id="actions" size="third" title="From action to result" subtitle="Currently resolved cases" meta={`${resolved.length.toLocaleString()} resolved`} note="Most frequent recorded result for each action. Association is not proof of effectiveness.">
              <Handling tickets={resolved} onPick={pick} />
            </Panel>
            <Panel id="outcomes" size="third" title="Resolution outcomes" subtitle="Each resolved case counted once" note="Marked resolved is a status, not proof of a confirmed fix. Unknown results remain visible.">
              <OutcomeDonut tickets={resolved} onPick={pick} />
            </Panel>
          </div>

          <SectionTitle title="Geography" subtitle="Where cases are reported from" />
          <Panel id="geography" size="full" title="Cases by recorded city or area" subtitle="Marker size follows case count" note="Points are city, area or country reference points, not customer addresses. Unknown locations stay outside the map. Boundaries: Natural Earth / world-atlas. Places: GeoNames (CC BY). No external geocoding.">
            <LocationMap tickets={rows} cities={cities} onPick={pick} />
          </Panel>
        </>
      )}

      <SectionTitle id="ov-followup" title="Follow-up" subtitle="Open cases across all dates, within the other filters" />
      {open.length > 0 ? (
        <CaseTable tickets={open} query={businessQuery({ ...filters, from: "", to: "" })} preview={preview} asOf={snapshot.asOf} />
      ) : (
        <section className="ov-panel ov-blank is-quiet">
          <h3>No open cases to follow up</h3>
          <p>Source and other filters apply; the date range does not hide older open work.</p>
        </section>
      )}

      <Coverage total={rows.length} classified={rows.length - review.incomplete.length} resolved={resolved.length} timestamped={resolved.filter((t) => t.resolvedAt).length} historical={rows.filter((t) => t.isHistorical).length} nativeComplete={eligible} />
      <footer className="ov-footer">Each case is counted once. Reopen events are separate from unique reopened cases. Missing data is never inferred.</footer>
    </div>
  );
}

function SectionTitle({ id, title, subtitle }: { id?: string; title: string; subtitle: string }) {
  return (
    <div className="ov-section-title" id={id}>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}

function Panel({ id, title, subtitle, meta, note, size = "half", children }: { id: string; title: string; subtitle: string; meta?: string; note?: string; size?: "half" | "lead" | "wide" | "narrow" | "third" | "full"; children: ReactNode }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const noteId = useId();
  return (
    <section className={`ov-panel ov-${size}`} data-chart={id}>
      <header>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {meta && <span className="ov-panel-meta">{meta}</span>}
        {note && (
          <button type="button" className="ov-info no-print" aria-expanded={noteOpen} aria-controls={noteId} aria-label={`About ${title}`} onClick={() => setNoteOpen((v) => !v)}>
            <Info size={16} />
          </button>
        )}
      </header>
      {note && <p id={noteId} className={`ov-note ${noteOpen ? "is-open" : ""}`}>{note}</p>}
      {children}
    </section>
  );
}

type KpiProps = { tone: "total" | "open" | "resolved" | "closed" | "reopened"; icon: LucideIcon; label: string; value: number; note: string; share?: number; trend?: number[]; change?: number | null; action?: string; href?: string; pressed?: boolean; onClick?: () => void };
function Kpi({ tone, icon: Icon, label, value, note, share, trend, change, action, href, pressed, onClick }: KpiProps) {
  const body = (
    <>
      <span className="ov-kpi-top">
        <span className="ov-kpi-icon" aria-hidden="true"><Icon size={16} /></span>
        <span className="ov-kpi-label">{label}</span>
        {href && <span className="ov-kpi-hint" aria-hidden="true"><ArrowDown size={14} /></span>}
        {onClick && <span className="ov-kpi-hint" aria-hidden="true">{pressed ? <Check size={14} /> : <ListFilter size={14} />}</span>}
      </span>
      <span className="ov-kpi-figure">
        <strong><Count value={value} /></strong>
        {change !== null && change !== undefined && (
          <span className="ov-kpi-change">
            {change < 0 ? <TrendingDown size={14} aria-hidden="true" /> : <TrendingUp size={14} aria-hidden="true" />}
            {change > 0 ? "+" : change < 0 ? "−" : ""}{Math.abs(change)}%
          </span>
        )}
        {share !== undefined && <span className="ov-kpi-share">{share}%</span>}
      </span>
      {share !== undefined && <span className="ov-kpi-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, share)}%` }} /></span>}
      {trend && <Sparkline values={trend} />}
      <small>{note}</small>
    </>
  );
  if (href) return <a className="ov-kpi" data-tone={tone} href={href} aria-label={`${label}: ${value}, ${share}% ${note}. ${action}`}>{body}</a>;
  if (onClick) return <button type="button" className="ov-kpi" data-tone={tone} aria-pressed={pressed} onClick={onClick} title={pressed ? "Remove this filter" : action}>{body}</button>;
  return <div className="ov-kpi" data-tone={tone}>{body}</div>;
}

function Sparkline({ values }: { values: number[] }) {
  const points = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const top = Math.max(1, ...points);
  const at = (v: number, i: number) => `${((i / (points.length - 1)) * 100).toFixed(2)},${(22 - (v / top) * 20).toFixed(2)}`;
  const line = points.map(at).join(" ");
  return (
    <svg className="ov-kpi-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,24 ${line} 100,24`} />
      <polyline points={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function AttentionRow({ count, title, detail, tone, onClick }: { count: number; title: string; detail: string; tone?: "warn"; onClick?: () => void }) {
  const body = (
    <>
      <b data-tone={count && tone ? tone : undefined}>{count.toLocaleString()}</b>
      <span>{title}<small>{detail}</small></span>
      {onClick && count > 0 && <ChevronRight size={16} aria-hidden="true" />}
    </>
  );
  return onClick ? <button type="button" disabled={!count} onClick={onClick}>{body}</button> : <div>{body}</div>;
}

function FilterSelect({ label, value, allLabel, options, onChange, allowAll = true, inline = false }: { label: string; value: string; allLabel: string; options: { id: string; name: string; count?: number }[]; allowAll?: boolean; inline?: boolean; onChange: (value: string) => void }) {
  const id = useId();
  const display = options.find((o) => o.id === value)?.name || allLabel;
  return (
    <div className={`ov-filter ${inline ? "is-inline" : ""} ${value && allowAll ? "has-selection" : ""}`}>
      <label id={id}>{label}</label>
      <div>
        <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : String(v ?? ""))}>
          <SelectTrigger aria-labelledby={id} className="ov-select-trigger" title={display}>
            <SelectValue>{display}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false} className="ov-select-menu">
            {allowAll && <SelectItem value="__all__">{allLabel}</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="ov-select-option"><span>{o.name}</span>{o.count !== undefined && <small>{o.count.toLocaleString()}</small>}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && allowAll && <button type="button" className="ov-filter-clear" aria-label={`Clear ${label}`} onClick={() => onChange("")}><X size={14} /></button>}
      </div>
    </div>
  );
}
