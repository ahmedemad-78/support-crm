"use client";
import { cumulativeShares, shareLabel, treemapRects, weekdayCounts } from "@/lib/tickets/chart-math";
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { reportedDay, statusGroup, type RankRow } from "@/lib/tickets/overview";
import type { AnalyticsTicket } from "@/lib/tickets/analytics";
import { EmptyChart, SOURCE_COLORS } from "./overview-charts";

const palette = ["#285c46", "#497f91", "#ab742b", "#737d54", "#786884", "#795e4b", "#536c70"];
const statusColors: Record<TicketStatus, string> = { new: "#a36c21", in_progress: "#497f91", awaiting_customer: "#8b7350", resolved: "#267346", closed: "#7a8289" };
const muted = (selected: string, id: string) => selected && selected !== id ? "is-muted" : selected === id ? "is-selected" : "";

export function StatusWheel({ tickets, selected, onPick }: { tickets: AnalyticsTicket[]; selected: string; onPick: (status: TicketStatus) => void }) {
  const rows = TICKET_STATUSES.map((status) => ({ status, count: tickets.filter((ticket) => ticket.status === status).length }));
  const total = tickets.length;
  if (!total) return <EmptyChart text="No cases match the current filters." />;
  const shares = cumulativeShares(rows.map((row) => row.count));
  return <div className="an-wheel-layout"><div className="an-wheel"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="58" fill="none" stroke="#e8ece3" strokeWidth="20" />{rows.map((row, index) => {
    const offset = index ? shares[index - 1] : 0;
    return <circle key={row.status} cx="80" cy="80" r="58" fill="none" stroke={statusColors[row.status]} strokeWidth="20" pathLength="100" strokeDasharray={`${row.count / total * 100} 100`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" className={muted(selected, row.status)} />;
  })}<text x="80" y="78" textAnchor="middle" className="an-wheel-total">{total}</text><text x="80" y="98" textAnchor="middle" className="an-wheel-label">cases</text></svg></div><div className="an-legend">{rows.map((row) => <button type="button" key={row.status} aria-pressed={selected === row.status} className={muted(selected, row.status)} onClick={() => onPick(row.status)}><i style={{ background: statusColors[row.status] }} /><span>{STATUS_LABELS[row.status]}</span><strong>{row.count}</strong><small>{shareLabel(row.count, total)}</small></button>)}</div></div>;
}

export function AgeColumns({ ages, selected, onPick }: { ages: { id: string; label: string; count: number }[]; selected: string; onPick: (id: string) => void }) {
  const total = ages.reduce((sum, age) => sum + age.count, 0);
  if (!total) return <EmptyChart text="No open cases in this selection. There is no age distribution to plot." />;
  const max = Math.max(1, ...ages.map((age) => age.count));
  return <div className="an-age"><div className="an-columns">{ages.map((age, index) => <button type="button" key={age.id} className={muted(selected, age.id)} aria-label={`${age.label}: ${age.count} open cases`} aria-pressed={selected === age.id} onClick={() => onPick(age.id)}><strong>{age.count}</strong><span className="an-column-track"><i style={{ height: `${age.count / max * 100}%`, background: ["#97b584", "#567d53", "#ba8736", "#8c4d2c"][index] }} /></span><span>{age.label}</span><small>{shareLabel(age.count, total)}</small></button>)}</div><p className="bi-chart-note">{total} open cases · one shared count scale. Age is not an SLA.</p></div>;
}

export function SourcePressure({ tickets, names, selected, onPick }: { tickets: AnalyticsTicket[]; names: Map<string, string>; selected: string; onPick: (id: string) => void }) {
  const ids = [...new Set(tickets.map((ticket) => ticket.source))];
  const rows = ids.map((id) => { const group = tickets.filter((ticket) => ticket.source === id); return { id, name: names.get(id) || id, total: group.length, open: group.filter((ticket) => statusGroup(ticket.status) === "followup").length }; }).sort((a, b) => b.total - a.total);
  if (!rows.length) return <EmptyChart text="No cases match the current filters." />;
  const maxX = Math.max(1, ...rows.map((row) => row.total));
  const maxY = Math.max(10, Math.ceil(Math.max(...rows.map((row) => row.open / row.total * 100)) / 10) * 10);
  const labels = rows.reduce<{ x: number; y: number }[]>((placed, row) => {
    const x = 48 + row.total / maxX * 422;
    const y = 220 - row.open / row.total * 100 / maxY * 180;
    const candidates = [[0, -16], [-23, -4], [23, -4], [0, 23], [-23, -24], [23, -24], [-23, 20], [23, 20]].map(([dx, dy]) => ({ x: Math.min(478, Math.max(30, x + dx)), y: Math.min(224, Math.max(28, y + dy)) }));
    const label = candidates.find((candidate) => placed.every((other) => Math.abs(other.x - candidate.x) > 17 || Math.abs(other.y - candidate.y) > 14)) || candidates[0];
    return [...placed, label];
  }, []);
  return <div className="an-scatter"><svg viewBox="0 0 500 265" role="img" aria-label="Source workload. Horizontal axis: case count. Vertical axis: current follow-up percentage.">{[0, .5, 1].map((fraction) => <g key={fraction}><line x1="48" x2="470" y1={220 - fraction * 180} y2={220 - fraction * 180} stroke="#e1e7dc" /><text x="40" y={224 - fraction * 180} textAnchor="end">{Math.round(fraction * maxY)}%</text><text x={48 + fraction * 422} y="240" textAnchor="middle">{Math.round(fraction * maxX)}</text></g>)}<text x="48" y="18">FOLLOW-UP SHARE</text><text x="470" y="261" textAnchor="end">CASE COUNT →</text>{rows.map((row, index) => <g key={row.id} className={selected && selected !== row.id ? "is-muted" : ""}><circle cx={48 + row.total / maxX * 422} cy={220 - row.open / row.total * 100 / maxY * 180} r="8" fill={SOURCE_COLORS[row.id] || palette[index % palette.length]} stroke="#fff" strokeWidth="2" /><text x={labels[index].x} y={labels[index].y} textAnchor="middle">{String(index + 1).padStart(2, "0")}</text><title>{`${row.name}: ${row.total} cases, ${row.open} need follow-up`}</title></g>)}</svg><div className="an-pressure-key">{rows.map((row, index) => <button type="button" key={row.id} className={muted(selected, row.id)} aria-pressed={selected === row.id} onClick={() => onPick(row.id)}><b>{String(index + 1).padStart(2, "0")}</b><span>{row.name}</span><strong>{row.open} / {row.total}</strong><small>need follow-up</small></button>)}</div></div>;
}

export function WeekdayRhythm({ tickets }: { tickets: AnalyticsTicket[] }) {
  const counts = weekdayCounts(tickets.map(reportedDay));
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return <EmptyChart text="No valid reported dates in this selection." />;
  const max = Math.max(1, ...counts);
  return <div className="an-weekday"><svg viewBox="0 0 500 230" role="img" aria-label="Case arrivals grouped by reported weekday">{[0, .5, 1].map((fraction) => <g key={fraction}><line x1="30" x2="480" y1={180 - fraction * 145} y2={180 - fraction * 145} stroke="#e3e8df" /><text x="24" y={184 - fraction * 145} textAnchor="end">{Math.round(max * fraction)}</text></g>)}{counts.map((count, index) => <g key={index}><line x1={55 + index * 67} x2={55 + index * 67} y1="180" y2={180 - count / max * 145} stroke="#a9bf99" strokeWidth="3" /><circle cx={55 + index * 67} cy={180 - count / max * 145} r="7" fill={count === max ? "#a6752f" : "#285c46"} /><text x={55 + index * 67} y={165 - count / max * 145} textAnchor="middle" className="an-data-label">{count}</text><text x={55 + index * 67} y="212" textAnchor="middle">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index]}</text><title>{`${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]}: ${count} cases`}</title></g>)}</svg><p className="bi-chart-note">Reported-date totals, not a daily average or staffing forecast. {total} valid dates.</p></div>;
}

export function CausePareto({ rows, selected, onPick }: { rows: RankRow[]; selected: string; onPick: (id: string) => void }) {
  const recorded = rows.filter((row) => row.id !== "__missing__");
  const missing = rows.find((row) => row.id === "__missing__");
  const shares = cumulativeShares(recorded.map((row) => row.count));
  const max = Math.max(1, ...recorded.map((row) => row.count));
  const total = recorded.reduce((sum, row) => sum + row.count, 0);
  const x = (index: number) => 52 + (index + .5) * 400 / Math.max(1, recorded.length);
  return <div className="an-pareto">{recorded.length ? <><div className="an-chart-caption"><span><i />Cases · {total} recorded</span><span><i />Cumulative share</span></div><svg viewBox="0 0 500 240" role="img" aria-label="Root cause counts and cumulative percentage of recorded causes">{[0, .5, 1].map((fraction) => <g key={fraction}><line x1="40" x2="460" y1={195 - fraction * 160} y2={195 - fraction * 160} stroke="#e3e8df" /><text x="32" y={199 - fraction * 160} textAnchor="end">{Math.round(max * fraction)}</text><text x="468" y={199 - fraction * 160}>{fraction * 100}%</text></g>)}{recorded.map((row, index) => <g key={row.id} className={selected && selected !== row.id ? "is-muted" : ""}><rect x={x(index) - Math.min(20, 150 / recorded.length)} y={195 - row.count / max * 160} width={Math.min(40, 300 / recorded.length)} height={row.count / max * 160} rx="2" fill={row.id === "__other__" ? "#849379" : "#356b49"} /><text x={x(index)} y="219" textAnchor="middle">{index + 1}</text><title>{`${row.name}: ${row.count} cases; cumulative ${shares[index].toFixed(1)}%`}</title></g>)}<polyline points={shares.map((share, index) => `${x(index)},${195 - share / 100 * 160}`).join(" ")} fill="none" stroke="#a87329" strokeWidth="2" />{shares.map((share, index) => <circle key={index} cx={x(index)} cy={195 - share / 100 * 160} r="3.5" fill="#a87329" />)}</svg><div className="an-rank-key">{recorded.map((row, index) => <button type="button" key={row.id} className={muted(selected, row.id)} aria-pressed={selected === row.id} onClick={() => onPick(row.id)}><b>{index + 1}</b><span>{row.name}</span><strong>{row.count}</strong></button>)}</div></> : <EmptyChart text="No root causes recorded in this selection." />}{missing && <button type="button" className={`an-missing ${muted(selected, missing.id)}`} aria-pressed={selected === missing.id} onClick={() => onPick(missing.id)}><span>Not recorded · excluded from cumulative line</span><strong>{missing.count}</strong></button>}<p className="bi-chart-note">Top causes in descending order; remaining recorded causes grouped last.</p></div>;
}

export function TopicTreemap({ rows, selected, onPick }: { rows: RankRow[]; selected: string; onPick: (id: string) => void }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyChart text="No cases match the current filters." />;
  const rects = treemapRects(rows.map((row) => row.count));
  const color = (index: number) => rows[index].id === "__missing__" ? "#d8ded2" : palette[index % palette.length];
  return <div className="an-topic-map"><div className="an-treemap" aria-hidden="true">{rects.map((rect) => <div key={rows[rect.index].id} className={muted(selected, rows[rect.index].id)} style={{ left: `${rect.x}%`, top: `${rect.y / 60 * 100}%`, width: `${rect.width}%`, height: `${rect.height / 60 * 100}%`, background: color(rect.index), color: rows[rect.index].id === "__missing__" ? "#294533" : "#fff" }}>{rect.width > 13 && rect.height > 10 && <><strong>{rows[rect.index].count}</strong><span>{rect.index + 1}</span></>}</div>)}</div><div className="an-rank-key">{rows.map((row, index) => <button type="button" key={row.id} className={muted(selected, row.id)} aria-pressed={selected === row.id} onClick={() => onPick(row.id)}><b style={{ borderColor: color(index) }}>{index + 1}</b><span>{row.name}</span><strong>{row.count}</strong><small>{shareLabel(row.count, total)}</small></button>)}</div><p className="bi-chart-note">Tile area = share of cases. Labels below include every tile.</p></div>;
}

export function RequestMatrix({ tickets, names, source, request, onPick }: { tickets: AnalyticsTicket[]; names: Map<string, string>; source: string; request: string; onPick: (source: string, request: string) => void }) {
  if (!tickets.length) return <EmptyChart text="No cases match the current filters." />;
  const sourceIds = [...new Set(tickets.map((ticket) => ticket.source))].sort((a, b) => tickets.filter((ticket) => ticket.source === b).length - tickets.filter((ticket) => ticket.source === a).length);
  const types = [...new Set(tickets.map((ticket) => ticket.requestType).filter(Boolean))].sort((a, b) => tickets.filter((ticket) => ticket.requestType === b).length - tickets.filter((ticket) => ticket.requestType === a).length).slice(0, 5);
  if (request && request !== "__missing__" && !types.includes(request)) types.push(request);
  if (tickets.some((ticket) => !ticket.requestType)) types.push("__missing__");
  return <div className="an-cross-scroll" tabIndex={0} aria-label="Source and request type matrix; scroll horizontally on smaller screens"><table className="an-cross"><caption>Top five recorded types plus missing values. Each cell is a count; shading shows share within its source.</caption><thead><tr><th scope="col">Source</th>{types.map((type) => <th scope="col" key={type}>{type === "__missing__" ? "Not recorded" : type}</th>)}<th scope="col">All types</th></tr></thead><tbody>{sourceIds.map((id) => { const group = tickets.filter((ticket) => ticket.source === id); return <tr key={id}><th scope="row">{names.get(id) || id}</th>{types.map((type) => { const count = group.filter((ticket) => (ticket.requestType || "__missing__") === type).length; return <td key={type}><button type="button" aria-pressed={source === id && request === type} className={source === id && request === type ? "is-selected" : ""} style={{ background: `rgb(53 107 73 / ${.04 + count / group.length * .35})` }} aria-label={`${names.get(id) || id}, ${type === "__missing__" ? "Not recorded" : type}: ${count} cases`} onClick={() => onPick(id, type)}>{count}</button></td>; })}<td><strong>{group.length}</strong></td></tr>; })}</tbody></table></div>;
}

export function OutcomeColumns({ rows }: { rows: RankRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyChart text="No cases match the current filters." />;
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <div className="an-outcomes"><div className="an-outcome-columns">{rows.map((row, index) => <div key={row.id}><strong>{row.count}</strong><span className="an-column-track"><i style={{ height: `${row.count / max * 100}%`, background: row.id === "__missing__" ? "#cbd4c4" : palette[index % palette.length] }} /></span><span>{row.name}</span><small>{shareLabel(row.count, total)}</small></div>)}</div><p className="bi-chart-note">Recorded outcome labels, independent of current status. Missing outcomes remain visible.</p></div>;
}
