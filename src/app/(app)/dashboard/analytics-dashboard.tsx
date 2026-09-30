"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, CheckCheck, Clock3, Filter, Inbox, RefreshCw, Ticket, X } from "lucide-react";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_STYLES, TICKET_SOURCES, TICKET_STATUSES, END_USER_TYPES, END_USER_TYPE_LABELS, PLATFORMS, PLATFORM_LABELS } from "@/lib/tickets/constants";
import { cairoDate, shiftDay } from "@/lib/tickets/dashboard-model";
import { dashboardQuery, type DashboardFilters } from "@/lib/tickets/filters";
import { AGE_LABELS, ageBand, causeMatrix, changeLabel, cohort, csvCell, durationHours, formatHours, issuePareto, isOpen, median, previousPeriod, scopeTickets, trend, validDay, type AnalyticsTicket, type View } from "@/lib/tickets/analytics";
import { ActivityChart, ParetoChart, StatusDonut } from "./charts";
type Snapshot = { tickets: AnalyticsTicket[]; asOf: string };
type Option = { id: string; name: string };
const viewLabels = { created: "Received in period", resolved: "Resolved in period", open: "Open now · all creation dates" };

export function DashboardBoard({ initialSnapshot, initialFilters, cities, categories, preview = false }: { initialSnapshot: Snapshot; initialFilters: DashboardFilters; cities: Option[]; categories: Option[]; preview?: boolean }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const today = cairoDate(snapshot.asOf);
  const [filters, setFilters] = useState<DashboardFilters>(() => ({ ...initialFilters, from: validDay(initialFilters.from) ? initialFilters.from : shiftDay(today, -29), to: validDay(initialFilters.to) ? initialFilters.to : today }));
  const [advanced, setAdvanced] = useState(false), [page, setPage] = useState(1), [error, setError] = useState(""), [refreshing, setRefreshing] = useState(false);
  const table = useRef<HTMLElement>(null), busy = useRef(false), abort = useRef<AbortController | null>(null);
  const view: View = filters.view ?? "created";
  const valid = validDay(filters.from) && validDay(filters.to) && filters.from <= filters.to;
  const scoped = useMemo(() => scopeTickets(snapshot.tickets, filters), [snapshot.tickets, filters]);
  const current = useMemo(() => ({ created: valid ? cohort(scoped, "created", filters.from, filters.to) : [], resolved: valid ? cohort(scoped, "resolved", filters.from, filters.to) : [], open: cohort(scoped, "open", "", "") }), [scoped, filters.from, filters.to, valid]);
  const rows = current[view].filter(t => view !== "open" || !filters.age || ageBand(t, Date.parse(snapshot.asOf)) === Number(filters.age));
  const previous = valid ? previousPeriod(filters.from, filters.to) : null;
  const durations = current.resolved.map(durationHours).filter((h): h is number => h !== null);
  const pareto = issuePareto(rows), matrix = causeMatrix(rows), matrixMax = Math.max(1, ...matrix.cells.flat()), missing = rows.filter(t => !t.cause).length;
  const buckets = useMemo(() => valid ? trend(scoped, filters.from, filters.to) : [], [scoped, filters.from, filters.to, valid]);
  const causes = [...new Set(snapshot.tickets.map(t => t.cause).filter(Boolean))].sort().map(name => ({ id: name, name }));
  const agents = [...new Map(snapshot.tickets.filter(t => t.assigneeId).map(t => [t.assigneeId!, { id: t.assigneeId!, name: t.assignee || "Assigned agent" }])).values()];
  const recent = [...rows].sort((a, b) => view === "open" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  const pages = Math.max(1, Math.ceil(recent.length / 10)), currentPage = Math.min(page, pages);
  const refresh = useCallback(async () => {
    if (preview || busy.current) return;
    busy.current = true; setRefreshing(true);
    const controller = new AbortController(); abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/dashboard/data", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 403 ? "Session expired. Reload and sign in again." : "Refresh failed. Showing the last successful snapshot.");
      const next: Snapshot = await response.json();
      if (!Array.isArray(next.tickets) || !Number.isFinite(Date.parse(next.asOf))) throw new Error("Invalid refresh response. Last snapshot retained.");
      setSnapshot(next); setError("");
    } catch (e) { setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Refresh timed out. Last snapshot retained."); }
    finally { clearTimeout(timeout); busy.current = false; setRefreshing(false); }
  }, [preview]);
  useEffect(() => { if (preview) return; const tick = () => { if (document.visibilityState === "visible") void refresh(); }; const interval = setInterval(tick, 30000); document.addEventListener("visibilitychange", tick); return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); abort.current?.abort(); }; }, [refresh, preview]);
  useEffect(() => { if (!preview) window.history.replaceState(null, "", `/dashboard${dashboardQuery(filters)}`); }, [filters, preview]);
  function patch(next: Partial<DashboardFilters>) { setFilters(f => ({ ...f, ...next })); setPage(1); }
  function reset() { setFilters({ from: shiftDay(today, -29), to: today, source: "", status: "", city: "", category: "", userType: "", view: "created" }); setPage(1); }
  function exportCsv() {
    const data = [["Ticket", "Issue", "Source", "Status", "Created", "Resolved", "Category", "Root cause", "Assignee", "Platform"], ...rows.map(t => [t.number, t.subject, SOURCE_LABELS[t.source], STATUS_LABELS[t.status], t.createdAt, t.resolvedAt ?? "", t.category, t.cause, t.assignee ?? "", t.platform ?? ""])];
    const url = URL.createObjectURL(new Blob(["\ufeff" + data.map(r => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `support-${view}-${filters.from}-${filters.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const chips = (["source", "status", "category", "cause", "platform", "assignee", "city", "userType", "age"] as const).filter(k => filters[k] !== undefined && filters[k] !== "");
  function chipLabel(key: typeof chips[number]) {
    const value = filters[key] ?? "", names = key === "category" ? categories : key === "city" ? cities : key === "assignee" ? agents : [];
    if (value === "__missing__") return key === "cause" ? "Cause not recorded" : key === "category" ? "Uncategorized" : "Unassigned";
    if (key === "source") return SOURCE_LABELS[value as keyof typeof SOURCE_LABELS];
    if (key === "status") return STATUS_LABELS[value as keyof typeof STATUS_LABELS];
    if (key === "age") return AGE_LABELS[Number(value)];
    return names.find(n => n.id === value)?.name || value;
  }
  const returnTo = `/dashboard${dashboardQuery(filters)}`;
  const summaryRows = pareto.map(c => { const matches = rows.filter(t => (t.categoryId || "__missing__") === c.key); const hours = matches.map(durationHours).filter((n): n is number => n !== null); return { ...c, open: matches.filter(isOpen).length, hours: median(hours), sample: hours.length }; });
  return <div className="bi-dashboard">
    <div className="bi-titlebar"><div><p className="bi-kicker">SELAH EL TELMEEZ / SUPPORT INTELLIGENCE</p><h2>Support analytics<span className="bi-period">{preview ? "DEMO" : "LIVE DATA"}</span></h2><p className="bi-subtitle">Understand the problems. Find the causes. Focus your team.</p></div><div className="bi-actions no-print"><button onClick={() => void refresh()} disabled={refreshing || preview} aria-label="Refresh dashboard"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /></button><button onClick={() => window.print()}>Print / PDF</button><button className="bi-primary" onClick={exportCsv}><ArrowDownToLine size={14}/> Export selection</button></div></div>
    <div className="bi-filterbar no-print">
      <label>From<input type="date" value={filters.from} max={filters.to} onChange={e => patch({ from: e.target.value })}/></label><label>To<input type="date" value={filters.to} min={filters.from} onChange={e => patch({ to: e.target.value })}/></label>
      <Select label="Source" value={filters.source} options={TICKET_SOURCES.map(s => ({ id:s, name:SOURCE_LABELS[s] }))} onChange={source => patch({ source:source as DashboardFilters["source"] })}/>
      <Select label="Issue category" value={filters.category} options={[...categories, { id:"__missing__", name:"Uncategorized" }]} onChange={category => patch({category})}/>
      <Select label="Root cause" value={filters.cause ?? ""} options={[...causes, { id:"__missing__", name:"Not recorded" }]} onChange={cause => patch({cause})}/>
      <button aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><Filter size={14}/> More filters</button><button onClick={reset}>Reset</button>
    </div>
    {advanced && <div className="bi-filterbar no-print">
      <Select label="Status" value={filters.status} options={TICKET_STATUSES.map(s => ({id:s,name:STATUS_LABELS[s]}))} onChange={status => patch({status:status as DashboardFilters["status"]})}/>
      <Select label="Assignee" value={filters.assignee ?? ""} options={[...agents, {id:"__missing__",name:"Unassigned"}]} onChange={assignee => patch({assignee})}/>
      <Select label="Platform" value={filters.platform ?? ""} options={PLATFORMS.map(p => ({id:p,name:PLATFORM_LABELS[p]}))} onChange={platform => patch({platform})}/>
      <Select label="City" value={filters.city} options={cities} onChange={city => patch({city})}/><Select label="User type" value={filters.userType} options={END_USER_TYPES.map(t => ({id:t,name:END_USER_TYPE_LABELS[t]}))} onChange={userType => patch({userType})}/>
    </div>}
    {!valid && <p className="bi-warning" role="alert">Choose a valid date range. Start must be on or before end.</p>}{error && <p className="bi-warning" role="alert">{error}</p>}
    <div className="bi-kpis">{[
      { label:"Tickets received", value:current.created.length.toLocaleString(), icon:Ticket, view:"created" as View, detail:previous ? changeLabel(current.created.length, cohort(scoped,"created",previous.from,previous.to).length) : "Select a valid period" },
      { label:"Tickets resolved", value:current.resolved.length.toLocaleString(), icon:CheckCheck, view:"resolved" as View, detail:previous ? changeLabel(current.resolved.length, cohort(scoped,"resolved",previous.from,previous.to).length) : "Select a valid period" },
      { label:"Open now", value:current.open.length.toLocaleString(), icon:Inbox, view:"open" as View, detail:"All creation dates · current filters" },
      { label:"Median resolution", value:formatHours(median(durations)), icon:Clock3, view:"resolved" as View, detail:`${durations.length} valid resolutions · elapsed time` },
    ].map((m,i) => <button key={m.label} className={`bi-kpi bi-kpi-${i}`} onClick={() => patch({view:m.view,age:""})} aria-pressed={i < 3 && view === m.view}><span className="bi-kpi-label">{m.label}<m.icon size={18}/></span><strong>{m.value}</strong><span>{m.detail}</span></button>)}</div>
    <div className="bi-context"><div className="bi-tabs no-print">{(["created","resolved","open"] as View[]).map(v => <button key={v} aria-pressed={view===v} onClick={() => patch({view:v,age:""})}>{v==="created"?"Received":v==="resolved"?"Resolved":"Open backlog"}</button>)}</div><span>{viewLabels[view]}{view!=="open" && ` · ${filters.from} — ${filters.to}`} · Cairo time</span><button className="bi-text-button" onClick={() => table.current?.scrollIntoView({behavior:"smooth",block:"start"})}>View {rows.length} matching tickets <ArrowUpRight size={14}/></button></div>
    {chips.length>0 && <div className="bi-chips no-print">{chips.map(k => <button key={k} onClick={() => patch({[k]:""})}>{k}: {chipLabel(k)} <X size={12}/></button>)}<span>Selections apply across the report</span></div>}
    <div className="bi-top-grid"><Panel title="Ticket flow" subtitle="Received vs resolved by event date · click a point to explore" badge="TREND"><ActivityChart buckets={buckets} onSelect={(from,to,selectedView) => patch({from,to,view:selectedView,age:""})}/></Panel><Panel title="Ticket status" subtitle={`${rows.length} tickets in selected cohort`} badge="DISTRIBUTION"><StatusDonut rows={rows} selected={filters.status} onSelect={status => patch({status:filters.status===status?"":status})}/></Panel></div>
    <div className="bi-analysis-grid"><Panel title="What drives support volume?" subtitle="Issue categories by volume · line shows cumulative share" badge="PARETO"><ParetoChart entries={pareto} onSelect={category => patch({category:filters.category===category?"":category})}/></Panel>
      <Panel title="Why are problems happening?" subtitle="Top 5 categories × top 4 recorded causes · counts, not inferred causality" badge="ROOT CAUSES">
        {matrix.causes.length ? <div className="bi-matrix-scroll"><table className="bi-matrix"><thead><tr><th>Issue / cause</th>{matrix.causes.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{matrix.categories.map((c,i) => <tr key={c.key}><th>{c.label}</th>{matrix.causes.map((cause,j) => <td key={cause}><button disabled={!matrix.cells[i][j]} style={{background:`rgba(15,122,87,${0.06+0.84*matrix.cells[i][j]/matrixMax})`,color:matrix.cells[i][j]/matrixMax>.5?"#fff":"#174d3d"}} aria-label={`${c.label}, ${cause}: ${matrix.cells[i][j]} tickets`} onClick={() => patch({category:c.key,cause})}>{matrix.cells[i][j] || "—"}</button></td>)}</tr>)}</tbody></table><div className="bi-scale"><span>Fewer</span><i/><span>More tickets</span></div></div> : <Empty text="No recorded causes in this selection."/>}
        <button className="bi-coverage" onClick={() => patch({cause:filters.cause==="__missing__"?"":"__missing__"})}><span><strong>{missing}</strong> tickets without a recorded cause</span><span>{rows.length?Math.round((rows.length-missing)/rows.length*100):0}% coverage <ArrowUpRight size={13}/></span></button>
      </Panel></div>
    <div className="bi-bottom-grid"><Panel title="Issue performance" subtitle="Current cohort · durations use valid resolved/closed records" badge="DETAIL"><div className="bi-table-scroll"><table className="bi-summary"><thead><tr><th>Issue category</th><th>Tickets</th><th>Open</th><th>Median time</th></tr></thead><tbody>{summaryRows.map(c => <tr key={c.key}><td><button onClick={() => patch({category:c.key})}>{c.label} <ArrowUpRight size={12}/></button></td><td><span className="bi-cell-bar" style={{backgroundSize:`${c.value/Math.max(1,rows.length)*100}% 100%`}}>{c.value}</span></td><td>{c.open}</td><td title={`${c.sample} valid resolutions`}>{formatHours(c.hours)} <small>n={c.sample}</small></td></tr>)}</tbody></table>{!summaryRows.length && <Empty/>}</div></Panel>
      <Panel title="Open backlog" subtitle="All creation dates · age is not an SLA breach" badge="ACTION"><div className="bi-age-grid">{AGE_LABELS.map((label,i) => {const count=current.open.filter(t => ageBand(t,Date.parse(snapshot.asOf))===i).length;return <button key={label} onClick={() => patch({view:"open",age:filters.age===String(i)?"":String(i)})} aria-pressed={view==="open"&&filters.age===String(i)}><span>{label}</span><strong>{count}</strong><div><i style={{width:`${count/Math.max(1,current.open.length)*100}%`}}/></div></button>;})}</div><p className="bi-note">Select an age group to review its tickets. Targets are not assumed.</p></Panel></div>
    <section ref={table} id="matching-tickets" className="bi-panel bi-results" tabIndex={-1}><header><div><h3>Matching tickets <span className="bi-result-count">{rows.length}</span></h3><p>{viewLabels[view]}{view!=="open"?` · ${filters.from} — ${filters.to}`:""} · All active filters applied</p></div><button className="bi-text-button no-print" onClick={exportCsv}>Export these rows <ArrowDownToLine size={14}/></button></header>
      <div className="bi-table-scroll"><table className="bi-ticket-table"><thead><tr><th>Ticket / reported issue</th><th>Category / root cause</th><th>Status</th><th>Source</th><th>Assignee</th><th>Created</th></tr></thead><tbody>{recent.slice((currentPage-1)*10,currentPage*10).map(t => <tr key={t.id}><td>{preview ? <span className="bi-ticket-id">{t.number}</span> : <Link className="bi-ticket-id" href={`/tickets/${t.id}?returnTo=${encodeURIComponent(returnTo)}`}>{t.number} <ArrowUpRight size={12}/></Link>}<p title={t.subject}>{t.subject}</p></td><td>{t.category||"Uncategorized"}<small>{t.cause||"Cause not recorded"}</small></td><td><span className={`bi-status ${STATUS_STYLES[t.status].chip}`}>{STATUS_LABELS[t.status]}</span></td><td>{SOURCE_LABELS[t.source]}</td><td>{t.assignee||"Unassigned"}</td><td>{t.createdOn}</td></tr>)}</tbody></table>{!rows.length && <Empty/>}</div>
      <div className="bi-pagination"><span>{rows.length ? (currentPage-1)*10+1:0}–{Math.min(currentPage*10,rows.length)} of {rows.length}{preview?" · Fictional preview records":""}</span><div className="no-print"><button disabled={currentPage<=1} onClick={() => setPage(currentPage-1)}>Previous</button><span>{currentPage} / {pages}</span><button disabled={currentPage>=pages} onClick={() => setPage(currentPage+1)}>Next</button></div></div>
    </section><footer className="bi-footer"><span>{preview?"Synthetic preview · no customer data":`Updated ${new Date(snapshot.asOf).toLocaleString("en-GB",{timeZone:"Africa/Cairo"})} · refreshes every 30 seconds`}</span><span>Resolution metrics exclude reopened tickets. No SLA or satisfaction scores are assumed.</span></footer><p className="sr-only" aria-live="polite">{rows.length} matching tickets. {viewLabels[view]}.</p>
  </div>;
}
function Select({label,value,options,onChange}:{label:string;value:string;options:Option[];onChange:(value:string)=>void}) { return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">All</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>; }
function Panel({title,subtitle,badge,children}:{title:string;subtitle:string;badge:string;children:ReactNode}) {return <section className="bi-panel"><header><div><h3>{title}</h3><p>{subtitle}</p></div><span className="bi-panel-tag">{badge}</span></header>{children}</section>;}
function Empty({text="No tickets match these filters."}:{text?:string}) {return <div className="bi-empty"><Inbox size={24}/><p>{text}</p><span>Change the period or reset the filters.</span></div>;}
