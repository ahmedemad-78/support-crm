"use client";

import { shareCells, shareLabel } from "@/lib/tickets/chart-math";
import { STATUS_GROUP_LABEL, type StatusGroup } from "@/lib/tickets/overview";
import { EmptyChart, STATUS_COLORS } from "./overview-charts";

type ChartRow = { id: string; name: string; count: number };
type PickProps = { rows: ChartRow[]; selectedId: string; onPick: (id: string) => void };
const state = (selected: string, id: string) => selected ? selected === id ? "is-selected" : "is-muted" : "";
const requestPalette = ["#76715f", "#74896b", "#5c6b84", "#876359", "#647d7a"];
function requestColor(id: string) {
  const known: Record<string, string> = { Inquiry: "#285c46", "Technical Issue": "#427f91", Complaint: "#ac742b", __missing__: "#d8ded2" };
  if (known[id]) return known[id];
  const hash = Array.from(id).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return requestPalette[hash % requestPalette.length];
}

export function SourceRanking({ rows, selectedId, onPick, label = "SOURCE" }: PickProps & { label?: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!total) return <EmptyChart text="No cases match the current filters." />;
  return <div className="bi-source-ranking">
    <div className="bi-ranking-head"><span>{label}</span><span>CASES / SHARE</span></div>
    {rows.map((row, index) => <button key={row.id} type="button" className={`bi-source-row ${state(selectedId, row.id)}`} aria-pressed={selectedId === row.id} aria-label={`${row.name}: ${row.count} cases, ${shareLabel(row.count, total)}`} onClick={() => onPick(row.id)}>
      <span className="bi-source-label"><small>{String(index + 1).padStart(2, "0")}</small>{row.name}</span>
      <span className="bi-lollipop" aria-hidden="true"><i style={{ width: `${row.count / max * 100}%` }}><b /></i></span>
      <span className="bi-source-value"><strong>{row.count}</strong><small>{shareLabel(row.count, total)}</small></span>
    </button>)}
    <p className="bi-chart-note">One shared scale · select a category to filter.</p>
  </div>;
}

export function RequestWaffle({ rows, selectedId, onPick }: PickProps) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyChart text="No cases match the current filters." />;
  const cells = shareCells(rows.map((row) => row.count));
  return <div className="bi-waffle-layout">
    <div><div className="bi-waffle" aria-hidden="true">{rows.flatMap((row, index) => Array.from({ length: cells[index] }, (_, cell) => <i key={`${row.id}-${cell}`} className={state(selectedId, row.id)} style={{ background: requestColor(row.id) }} />))}</div><p className="bi-chart-note">100 squares · 1 ≈ 1%<br />Rounded picture. Exact counts alongside.</p></div>
    <div className="bi-chart-legend-list">{rows.map((row) => <button type="button" key={row.id} className={state(selectedId, row.id)} aria-pressed={selectedId === row.id} onClick={() => onPick(row.id)}><i style={{ background: requestColor(row.id) }} /><span>{row.name}</span><strong>{row.count}</strong><small>{shareLabel(row.count, total)}</small></button>)}</div>
  </div>;
}

export function SegmentMatrix({ rows, mode, selectedSegment, selectedGroup, onSegment, onStack }: {
  rows: { segment: string; total: number; parts: { group: StatusGroup; count: number }[] }[];
  mode: "count" | "share"; selectedSegment: string; selectedGroup: string;
  onSegment: (segment: string) => void; onStack: (segment: string, group: StatusGroup) => void;
}) {
  if (!rows.some((row) => row.total > 0)) return <EmptyChart text="No cases match the current filters." />;
  const groups: StatusGroup[] = ["resolved", "followup", "closed"];
  return <div className="bi-matrix-wrap"><table className="bi-matrix"><caption>{mode === "share" ? "Each percentage is within its customer segment." : "Exact case counts by customer segment and current status."}</caption><thead><tr><th scope="col">Segment</th>{groups.map((group) => <th scope="col" key={group}><i style={{ background: STATUS_COLORS[group] }} />{group === "followup" ? "Follow-up" : group === "closed" ? "Closed" : "Resolved"}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.segment}><th scope="row"><button type="button" className={state(selectedSegment, row.segment)} aria-pressed={selectedSegment === row.segment} onClick={() => onSegment(row.segment)}>{row.segment}<small>{row.total} cases</small></button></th>{groups.map((group) => {
    const count = row.parts.find((part) => part.group === group)?.count ?? 0;
    const selected = (!selectedSegment || selectedSegment === row.segment) && (!selectedGroup || selectedGroup === group);
    return <td key={group}><button type="button" className={`${(selectedSegment || selectedGroup) && !selected ? "is-muted" : ""} ${selectedSegment === row.segment && selectedGroup === group ? "is-selected" : ""}`} aria-label={`${row.segment}, ${STATUS_GROUP_LABEL[group]}: ${count} cases, ${shareLabel(count, row.total)} of segment`} aria-pressed={selectedSegment === row.segment && selectedGroup === group} onClick={() => onStack(row.segment, group)}><span className="bi-matrix-dot" aria-hidden="true" style={{ background: STATUS_COLORS[group], opacity: count ? .15 + count / Math.max(1, row.total) * .85 : 0 }} /><strong>{mode === "share" ? shareLabel(count, row.total) : count}</strong></button></td>;
  })}</tr>)}</tbody></table></div>;
}

export function TeamTiles({ rows, selectedId, onPick }: PickProps) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyChart text="No cases match the current filters." />;
  return <div className="bi-team-tiles">{rows.map((row) => <button type="button" key={row.id} className={state(selectedId, row.id)} aria-pressed={selectedId === row.id} onClick={() => onPick(row.id)}><span>{row.name}</span><strong>{row.count}</strong><small>{shareLabel(row.count, total)} of cases</small></button>)}</div>;
}

export function StatusRing({ value, total }: { value: number; total: number }) {
  const share = total ? value / total : 0;
  return <svg className="bi-status-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" opacity=".12" /><circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" pathLength="100" strokeDasharray={`${share * 100} 100`} transform="rotate(-90 22 22)" /></svg>;
}
