"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MISSING, field, ranking, timeBuckets, type BusinessFilters, type BusinessTicket, type Bucket, type Dimension, type Rank } from "@/lib/tickets/business-analytics";
import { clusteredSources, geographicCases } from "@/lib/tickets/single-page-model";
import countries from "@/lib/tickets/world-countries.json";

export type PickFilter = (key: Dimension, value: string, second?: [Dimension, string]) => void;

const ACCENT = "#159d49";
const ACCENT_STRONG = "#0f7a39";
const GRID = "#e9ebef";
const OTHER = "#9aa3b2";
const NOT_RECORDED = "#d5dae2";
const WARNING = "#c2571a";
const SERIES = [ACCENT_STRONG, "#3b82c4", "#e0a029", "#7c5cc4", "#2aa6a0"];

/** Colours follow rank order, so two series in one chart never share a hue. */
export function seriesColor(id: string, index = 0) {
  if (id === MISSING) return NOT_RECORDED;
  if (id === "__other__") return OTHER;
  if (id.trim().toLowerCase() === "issue persists") return WARNING;
  return SERIES[index % SERIES.length];
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const activate = (run: () => void) => (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    run();
  }
};

type Unit = "day" | "week" | "month" | "year";
function bucketUnit(bucket: Bucket): Unit {
  if (bucket.name.length === 4) return "year";
  if (bucket.name.length === 7) return "month";
  return bucket.from === bucket.to ? "day" : "week";
}
const utcDay = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...options });
function bucketLabel(bucket: Bucket, unit: Unit) {
  if (unit === "year") return bucket.name;
  if (unit === "month") return utcDay(bucket.from, { month: "short", year: "numeric" });
  return utcDay(bucket.from, { day: "numeric", month: "short" });
}
function bucketRange(bucket: Bucket, unit: Unit) {
  if (unit === "day") return utcDay(bucket.from, { day: "numeric", month: "short", year: "numeric" });
  if (unit === "month" && bucket.from.slice(8) === "01") return utcDay(bucket.from, { month: "long", year: "numeric" });
  return `${utcDay(bucket.from, { day: "numeric", month: "short" })} – ${utcDay(bucket.to, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** Monotone cubic path: smooth, and it never overshoots a recorded count. */
function smoothPath(points: number[][]) {
  if (points.length < 3) return points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const slopes = points.slice(1).map((p, i) => (p[1] - points[i][1]) / Math.max(1e-6, p[0] - points[i][0]));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[i - 1];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (2 * slopes[i - 1] * slopes[i]) / (slopes[i - 1] + slopes[i]);
  });
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const third = (x1 - x0) / 3;
    path += `C${(x0 + third).toFixed(1)},${(y0 + tangents[i] * third).toFixed(1)} ${(x1 - third).toFixed(1)},${(y1 - tangents[i + 1] * third).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return path;
}

const AREA_DEFAULT = { width: 720, height: 300 };

/** Draws in real pixels so labels keep their size at any panel width. */
function useChartSize() {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(AREA_DEFAULT);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const width = Math.round(node.clientWidth);
      const height = Math.round(node.clientHeight);
      if (width > 0 && height > 0) setSize((prior) => (prior.width === width && prior.height === height ? prior : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { host, size };
}

export function DemandArea({ tickets, filters, asOf, onPickRange }: { tickets: BusinessTicket[]; filters: BusinessFilters; asOf: string; onPickRange?: (from: string, to: string) => void }) {
  const bins = useMemo(() => timeBuckets(tickets, filters, asOf), [tickets, filters, asOf]);
  const id = useId().replaceAll(":", "");
  const [hover, setHover] = useState<number | null>(null);
  const { host, size } = useChartSize();
  const plot = useMemo(() => ({ left: 40, right: size.width - 14, top: 22, bottom: size.height - 40 }), [size]);
  const unit = bins.length ? bucketUnit(bins[0]) : "month";
  const peak = Math.max(0, ...bins.map((b) => b.count));
  const ceiling = Math.max(4, Math.ceil(peak / 4) * 4);
  const target = useMemo(
    () => bins.map((b, i) => [bins.length > 1 ? plot.left + (i * (plot.right - plot.left)) / (bins.length - 1) : (plot.left + plot.right) / 2, plot.bottom - (b.count / ceiling) * (plot.bottom - plot.top)]),
    [bins, ceiling, plot],
  );
  const x = (i: number) => target[i][0];
  const y = (n: number) => plot.bottom - (n / ceiling) * (plot.bottom - plot.top);
  const animated = useAreaMotion(target);
  const line = smoothPath(animated);
  const labelIndexes = useMemo(() => {
    const count = Math.min(bins.length, Math.max(2, Math.min(6, Math.floor((plot.right - plot.left) / 96))));
    return new Set(Array.from({ length: count }, (_, k) => (count > 1 ? Math.round((k * (bins.length - 1)) / (count - 1)) : 0)));
  }, [bins.length, plot]);
  const peakIndex = bins.findIndex((b) => b.count === peak);
  const active = hover !== null && hover < bins.length ? hover : null;
  const total = bins.reduce((n, b) => n + b.count, 0);
  const locate = (event: Pick<PointerEvent<SVGRectElement>, "currentTarget" | "clientX">) => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box || !bins.length) return null;
    const at = ((event.clientX - box.left) / box.width) * size.width;
    return Math.max(0, Math.min(bins.length - 1, Math.round(((at - plot.left) / (plot.right - plot.left)) * (bins.length - 1))));
  };
  if (!bins.length || !total) return <Empty text="No dated cases in this selection." />;
  const latest = bins[bins.length - 1];
  const tipOnLeft = active !== null && x(active) > size.width * 0.55;
  return (
    <>
      <dl className="ov-facts">
        <div><dt>Busiest {unit}</dt><dd>{peak.toLocaleString()} <span>{bucketLabel(bins[peakIndex], unit)}</span></dd></div>
        <div><dt>Average per {unit}</dt><dd>{(total / bins.length).toLocaleString("en-GB", { maximumFractionDigits: 1 })}</dd></div>
        <div><dt>Latest {unit}</dt><dd>{latest.count.toLocaleString()} <span>{bucketLabel(latest, unit)}</span></dd></div>
      </dl>
      <div className="ov-area-wrap" ref={host}>
        <svg className="ov-area" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`Cases by ${filters.basis} date: ${bins.map((b) => `${b.name}: ${b.count}`).join("; ")}`}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={ACCENT} stopOpacity=".22" />
              <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={plot.left} x2={plot.right} y1={y(ceiling * f)} y2={y(ceiling * f)} stroke={GRID} strokeDasharray={f ? "3 4" : undefined} />
              <text x={plot.left - 10} y={y(ceiling * f) + 4} textAnchor="end">{ceiling * f}</text>
            </g>
          ))}
          <path d={`${line}L${x(bins.length - 1).toFixed(1)},${plot.bottom}L${x(0).toFixed(1)},${plot.bottom}Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && <line x1={x(active)} x2={x(active)} y1={plot.top} y2={plot.bottom} stroke={ACCENT_STRONG} strokeOpacity=".35" />}
          {bins.map((b, i) => (
            <g key={b.id}>
              <circle
                cx={x(i)}
                cy={y(b.count)}
                r={i === active ? 5 : bins.length > 40 ? 0 : 3}
                fill={i === active ? ACCENT_STRONG : "#fff"}
                stroke={ACCENT}
                strokeWidth="2"
                role={onPickRange ? "button" : undefined}
                tabIndex={onPickRange ? 0 : undefined}
                aria-label={onPickRange ? `${bucketRange(b, unit)}: ${b.count} cases. Show only this period.` : undefined}
                onFocus={onPickRange ? () => setHover(i) : undefined}
                onBlur={onPickRange ? () => setHover(null) : undefined}
                onKeyDown={onPickRange ? activate(() => onPickRange(b.from, b.to)) : undefined}
              >
                <title>{`${b.from} – ${b.to}: ${b.count} cases`}</title>
              </circle>
              {i === peakIndex && active === null && <text x={x(i)} y={y(b.count) - 11} textAnchor="middle" className="ov-value">{b.count}</text>}
              {labelIndexes.has(i) && <text x={x(i)} y={plot.bottom + 24} textAnchor={bins.length > 1 && i === 0 ? "start" : bins.length > 1 && i === bins.length - 1 ? "end" : "middle"}>{bucketLabel(b, unit)}</text>}
            </g>
          ))}
          <rect
            x={plot.left - 12}
            y={plot.top - 12}
            width={Math.max(0, plot.right - plot.left + 24)}
            height={Math.max(0, plot.bottom - plot.top + 12)}
            fill="transparent"
            className={onPickRange ? "ov-area-hit is-action" : "ov-area-hit"}
            onPointerMove={(event) => setHover(locate(event))}
            onPointerLeave={() => setHover(null)}
            onClick={onPickRange ? (event) => { const i = locate(event); if (i !== null) onPickRange(bins[i].from, bins[i].to); } : undefined}
          />
        </svg>
        {active !== null && (
          <div className="ov-tip" data-side={tipOnLeft ? "left" : "right"} style={{ left: x(active), top: Math.max(34, Math.min(size.height - 74, y(bins[active].count))) }} aria-hidden="true">
            <span>{bucketRange(bins[active], unit)}</span>
            <strong>{bins[active].count.toLocaleString()} {bins[active].count === 1 ? "case" : "cases"}</strong>
            <small>{percent(bins[active].count, total)}% of this selection{onPickRange ? " · click to focus" : ""}</small>
          </div>
        )}
      </div>
    </>
  );
}

export function SourceMix({ tickets, sources, onPick }: { tickets: BusinessTicket[]; sources: Map<string, string>; onPick: PickFilter }) {
  const { groups, series } = useMemo(() => clusteredSources(tickets, sources), [tickets, sources]);
  const max = Math.max(1, ...groups.map((g) => g.count));
  if (!tickets.length) return <Empty />;
  return (
    <>
      <div className="ov-legend" aria-hidden="true">
        {series.map((s, j) => <span key={s.id}><i style={{ background: seriesColor(s.id, j) }} />{s.name}</span>)}
      </div>
      <div className="ov-mix">
        {groups.map((g) => (
          <div className="ov-mix-row" key={g.id}>
            <button type="button" className="ov-mix-name" onClick={() => onPick("source", g.id)} aria-label={`${g.name}: ${g.count} cases. Filter this source.`}>{g.name}</button>
            <div className="ov-mix-track">
              <svg viewBox={`0 0 ${g.count} 10`} preserveAspectRatio="none" style={{ width: `${(g.count / max) * 100}%` }} role="group" aria-label={`${g.name} by request type`}>
                {series.map((s, j) => {
                  const count = g.values[j];
                  if (!count) return null;
                  const before = g.values.slice(0, j).reduce((n, v) => n + v, 0);
                  const interactive = s.id !== "__other__";
                  const pick = () => onPick("source", g.id, ["requestType", s.id]);
                  return (
                    <rect
                      key={s.id}
                      x={before}
                      y="0"
                      width={count}
                      height="10"
                      fill={seriesColor(s.id, j)}
                      stroke="#fff"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={`${g.name}, ${s.name}: ${count} cases${interactive ? ". Filter this combination." : ""}`}
                      onClick={interactive ? pick : undefined}
                      onKeyDown={interactive ? activate(pick) : undefined}
                    >
                      <title>{`${g.name} · ${s.name}: ${count} (${percent(count, g.count)}%)`}</title>
                    </rect>
                  );
                })}
              </svg>
            </div>
            <b>{g.count.toLocaleString()}</b>
            <small>{percent(g.count, tickets.length)}%</small>
          </div>
        ))}
      </div>
      <details className="ov-exact">
        <summary>Exact values by source</summary>
        <div className="ov-table-wrap">
          <table>
            <thead><tr><th>Source</th>{series.map((s) => <th key={s.id}>{s.name}</th>)}<th>Total</th></tr></thead>
            <tbody>{groups.map((g) => <tr key={g.id}><th>{g.name}</th>{g.values.map((n, i) => <td key={i}>{n}</td>)}<td>{g.count}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function OutcomeDonut({ tickets, onPick }: { tickets: BusinessTicket[]; onPick: PickFilter }) {
  const rows = ranking(tickets, "outcome", new Map(), 6);
  const total = tickets.length;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  if (!total) return <Empty text="No resolved cases in this selection." />;
  return (
    <div className="ov-donut-layout">
      <svg className="ov-donut" viewBox="0 0 170 170" role="group" aria-label={`Outcome distribution across ${total} currently resolved cases`}>
        <circle cx="85" cy="85" r={radius} fill="none" stroke="#f0f2f5" strokeWidth="20" />
        {rows.map((r, i) => {
          const before = rows.slice(0, i).reduce((n, item) => n + item.count, 0);
          const length = (r.count / total) * circumference;
          const interactive = !r.members;
          return (
            <circle
              key={r.id}
              cx="85"
              cy="85"
              r={radius}
              fill="none"
              stroke={seriesColor(r.id, i)}
              strokeWidth="20"
              strokeDasharray={`${Math.max(0, length - (rows.length > 1 ? 2 : 0))} ${circumference}`}
              strokeDashoffset={-(before / total) * circumference}
              transform="rotate(-90 85 85)"
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${r.name}: ${r.count} of ${total} resolved cases`}
              onClick={interactive ? () => onPick("outcome", r.id) : undefined}
              onKeyDown={interactive ? activate(() => onPick("outcome", r.id)) : undefined}
            >
              <title>{`${r.name}: ${r.count} (${percent(r.count, total)}%)`}</title>
            </circle>
          );
        })}
        <text x="85" y="84" textAnchor="middle" className="ov-donut-total">{total.toLocaleString()}</text>
        <text x="85" y="103" textAnchor="middle" className="ov-donut-label">resolved</text>
      </svg>
      <div className="ov-key">
        {rows.map((r, i) => (
          <button type="button" key={r.id} disabled={!!r.members} onClick={() => onPick("outcome", r.id)}>
            <i style={{ background: seriesColor(r.id, i) }} />
            <span>{r.name}</span>
            <b>{r.count.toLocaleString()}</b>
            <small>{percent(r.count, total)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Problems({ tickets, onPick }: { tickets: BusinessTicket[]; onPick: PickFilter }) {
  const [all, setAll] = useState(false);
  const rows = ranking(tickets, "topic", new Map(), 100000);
  const known = rows.filter((r) => r.id !== MISSING);
  const missing = rows.find((r) => r.id === MISSING)?.count || 0;
  const max = Math.max(1, ...known.map((r) => r.count));
  return (
    <>
      <RankList rows={all ? known : known.slice(0, 6)} max={max} total={tickets.length} onPick={(row) => onPick("topic", row.id)} />
      {!known.length && <Empty text="No problem topics recorded." />}
      <div className="ov-list-foot">
        {known.length > 6 && <button type="button" className="ov-link" onClick={() => setAll((v) => !v)}>{all ? "Show top 6" : `Show all ${known.length} topics`}</button>}
        <button type="button" className="ov-missing" disabled={!missing} onClick={() => onPick("topic", MISSING)}><i />{missing.toLocaleString()} without a topic</button>
      </div>
    </>
  );
}

function RankList({ rows, max, total, onPick }: { rows: Rank[]; max: number; total: number; onPick: (row: Rank) => void }) {
  return (
    <ol className="ov-rank">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r)} aria-label={`${r.name}: ${r.count} cases. Filter this value.`}>
            <span className="ov-rank-name" dir="auto">{r.name}</span>
            <b>{r.count.toLocaleString()}</b>
            <small>{percent(r.count, total)}%</small>
            <span className="ov-rank-track"><i style={{ width: `${(r.count / max) * 100}%` }} /></span>
          </button>
        </li>
      ))}
    </ol>
  );
}

const PARETO = { width: 420, height: 196, left: 34, right: 380, top: 18, bottom: 160 };

export function CausePareto({ tickets, onPick }: { tickets: BusinessTicket[]; onPick: PickFilter }) {
  const ranks = ranking(tickets, "trackerCause", new Map(), 100000);
  const known = ranks.filter((r) => r.id !== MISSING);
  const rows = known.slice(0, 5);
  const total = known.reduce((n, r) => n + r.count, 0);
  const missing = ranks.find((r) => r.id === MISSING)?.count || 0;
  const shown = rows.reduce((n, r) => n + r.count, 0);
  const ceiling = Math.max(4, Math.ceil(Math.max(...rows.map((r) => r.count), 0) / 4) * 4);
  const band = (PARETO.right - PARETO.left) / Math.max(1, rows.length);
  const x = (i: number) => PARETO.left + band * (i + 0.5);
  const y = (n: number) => PARETO.bottom - (n / ceiling) * (PARETO.bottom - PARETO.top);
  const cumulative = rows.map((_, i) => rows.slice(0, i + 1).reduce((n, r) => n + r.count, 0) / Math.max(1, total));
  const share = (v: number) => PARETO.bottom - v * (PARETO.bottom - PARETO.top);
  const barWidth = Math.min(44, band * 0.56);
  if (!total) return <Empty text="No causes recorded in this selection." />;
  return (
    <>
      <div className="ov-chart-scroll">
        <svg className="ov-pareto" viewBox={`0 0 ${PARETO.width} ${PARETO.height}`} role="img" aria-label={`Top recorded cause labels: ${rows.map((r) => `${r.name}: ${r.count}`).join("; ")}. Cumulative percentages use ${total} recorded cases.`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PARETO.left} x2={PARETO.right} y1={y(ceiling * f)} y2={y(ceiling * f)} stroke={GRID} strokeDasharray={f ? "3 4" : undefined} />
              <text x={PARETO.left - 8} y={y(ceiling * f) + 4} textAnchor="end">{ceiling * f}</text>
              <text x={PARETO.right + 8} y={y(ceiling * f) + 4}>{100 * f}%</text>
            </g>
          ))}
          {rows.map((r, i) => (
            <g key={r.id}>
              <rect x={x(i) - barWidth / 2} y={y(r.count)} width={barWidth} height={PARETO.bottom - y(r.count)} fill={i === 0 ? ACCENT_STRONG : "#a9d8bc"} rx="3" />
              <text x={x(i)} y={y(r.count) - 7} textAnchor="middle" className="ov-value">{r.count}</text>
              <text x={x(i)} y={PARETO.bottom + 20} textAnchor="middle">{i + 1}</text>
            </g>
          ))}
          <polyline points={cumulative.map((v, i) => `${x(i)},${share(v)}`).join(" ")} fill="none" stroke="#3b4252" strokeWidth="1.75" strokeLinejoin="round" />
          {cumulative.map((v, i) => <circle key={i} cx={x(i)} cy={share(v)} r="3" fill="#fff" stroke="#3b4252" strokeWidth="1.75" />)}
        </svg>
      </div>
      <ol className="ov-cause-key">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button type="button" onClick={() => onPick("trackerCause", r.id)} aria-label={`${r.name}: ${r.count} cases. Filter this cause.`}>
              <i>{i + 1}</i>
              <span dir="auto">{r.name}</span>
              <b>{r.count.toLocaleString()}</b>
              <small>{Math.round(cumulative[i] * 100)}% cumulative</small>
            </button>
          </li>
        ))}
      </ol>
      <p className="ov-footnote">Top {rows.length} cover {shown} of {total} cases with a recorded cause · {total - shown} in other labels · {missing} not recorded</p>
    </>
  );
}

export function Handling({ tickets, onPick }: { tickets: BusinessTicket[]; onPick: PickFilter }) {
  const [all, setAll] = useState(false);
  const actions = ranking(tickets, "trackerAction", new Map(), 100000).filter((r) => r.id !== MISSING);
  const unrecorded = tickets.filter((t) => field(t, "trackerAction") === MISSING).length;
  if (!actions.length) return <Empty text="No actions recorded for resolved cases." />;
  return (
    <>
      <div className="ov-table-wrap">
        <table className="ov-action-table">
          <thead><tr><th>Action taken</th><th>Cases</th><th>Most frequent result</th></tr></thead>
          <tbody>
            {(all ? actions : actions.slice(0, 5)).map((a) => {
              const group = tickets.filter((t) => field(t, "trackerAction") === a.id);
              const results = ranking(group, "outcome", new Map(), 100000);
              const first = results[0];
              const tie = results[1]?.count === first.count;
              return (
                <tr key={a.id}>
                  <td><button type="button" onClick={() => onPick("trackerAction", a.id)} dir="auto">{a.name}</button></td>
                  <td>{a.count.toLocaleString()}</td>
                  <td>
                    {tie ? <span>Mixed · {results.length} outcomes</span> : <span>{first.name}</span>}
                    {!tie && <span className="ov-meter" aria-hidden="true"><i style={{ width: `${percent(first.count, a.count)}%` }} /></span>}
                    {!tie && <small>{first.count} of {a.count}</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="ov-list-foot">
        {actions.length > 5 && <button type="button" className="ov-link" onClick={() => setAll((v) => !v)}>{all ? "Show top 5" : `Show all ${actions.length} actions`}</button>}
        <span className="ov-missing"><i />{unrecorded.toLocaleString()} without an action</span>
      </div>
    </>
  );
}

function countryPath(country: (typeof countries)[number], project: (lon: number, lat: number) => number[]) {
  return country.polygons
    .flatMap((p) => {
      const xs = p[0].map((point) => point[0]);
      const shifts = [0, ...(Math.min(...xs) < -180 ? [360] : []), ...(Math.max(...xs) > 180 ? [-360] : [])];
      return shifts.flatMap((shift) => p.map((r) => r.map((point, i) => `${i ? "L" : "M"}${project(point[0] + shift, point[1]).map((n) => n.toFixed(2)).join(",")}`).join("") + "Z"));
    })
    .join("");
}

/**
 * Neighbouring reference points (Cairo and Qalyubia) would stack and hide a count.
 * Larger markers keep their position; a smaller one moves just far enough to sit beside them.
 */
function spreadMarkers<T extends { at: number[]; r: number }>(markers: T[]): T[] {
  const placed: T[] = [];
  for (const marker of markers) {
    let [x, y] = marker.at;
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (const other of placed) {
        const gap = other.r + marker.r + 2;
        const dx = x - other.at[0];
        const dy = y - other.at[1];
        const distance = Math.hypot(dx, dy);
        if (distance >= gap) continue;
        const ux = distance > 0.01 ? dx / distance : 0.6;
        const uy = distance > 0.01 ? dy / distance : -0.8;
        x = other.at[0] + ux * gap;
        y = other.at[1] + uy * gap;
        moved = true;
      }
      if (!moved) break;
    }
    placed.push({ ...marker, at: [x, y] });
  }
  return placed;
}

export function LocationMap({ tickets, cities, onPick }: { tickets: BusinessTicket[]; cities: { id: string; name: string }[]; onPick: PickFilter }) {
  const [world, setWorld] = useState(false);
  const id = useId().replaceAll(":", "");
  const geo = useMemo(() => geographicCases(tickets, cities), [tickets, cities]);
  const marks = geo.locations.filter((l) => l.place);
  const max = Math.max(1, ...geo.locations.map((m) => m.count));
  const lon = marks.map((m) => m.place!.lon);
  const lat = marks.map((m) => m.place!.lat);
  const bounds = world ? [-180, 180, -58, 85] : [Math.min(24, ...lon) - 3, Math.max(37, ...lon) + 3, Math.min(22, ...lat) - 2, Math.max(33, ...lat) + 2];
  const scale = Math.min(740 / (bounds[1] - bounds[0]), 310 / (bounds[3] - bounds[2]));
  const project = (a: number, b: number) => [30 + (740 - (bounds[1] - bounds[0]) * scale) / 2 + (a - bounds[0]) * scale, 20 + (310 - (bounds[3] - bounds[2]) * scale) / 2 + (bounds[3] - b) * scale];
  return (
    <>
      <div className="ov-map-toolbar">
        <div className="ov-coverage-line" role="img" aria-label={`${geo.mapped} of ${geo.total} cases mapped, ${geo.unmapped} recorded but not mapped, ${geo.missing} without a location`}>
          <span><i style={{ flexGrow: geo.mapped, background: ACCENT }} /><i style={{ flexGrow: geo.unmapped, background: "#e0a029" }} /><i style={{ flexGrow: geo.missing, background: NOT_RECORDED }} /></span>
          <p><b>{geo.mapped.toLocaleString()} of {geo.total.toLocaleString()}</b> cases mapped{geo.unmapped ? ` · ${geo.unmapped} recorded but not mapped` : ""} · {geo.missing.toLocaleString()} without a location</p>
        </div>
        <div className="ov-segmented" role="group" aria-label="Map extent">
          <button type="button" aria-pressed={!world} onClick={() => setWorld(false)}>Fit locations</button>
          <button type="button" aria-pressed={world} onClick={() => setWorld(true)}>World</button>
        </div>
      </div>
      <div className="ov-map-layout">
        <svg className="ov-map" viewBox="0 0 800 350" role="group" aria-label={`Case concentration by recorded location. ${geo.mapped} mapped, ${geo.missing} unknown, ${geo.unmapped} unmapped. Points are area references, not customer addresses.`}>
          <defs>
            <radialGradient id={`${id}-halo`}>
              <stop stopColor={ACCENT} stopOpacity=".34" />
              <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="350" fill="#f4f7fa" />
          {countries.filter((c) => c.id !== "010").map((c) => (
            <path key={`${c.id}-${c.name}`} aria-hidden="true" d={countryPath(c, project)} fill={c.id === "818" ? "#e3f1e8" : "#e9edf2"} stroke="#c5cdd8" strokeWidth={world ? 0.5 : 0.8}>
              <title>{c.name}</title>
            </path>
          ))}
          {spreadMarkers([...marks].sort((a, b) => b.count - a.count).map((m) => ({ m, at: project(m.place!.lon, m.place!.lat), r: 6 + Math.sqrt(m.count) * 3 }))).map(({ m, at: [x, y], r }) => {
            const p = m.place!;
            return (
              <g key={m.id}>
                <circle cx={x} cy={y} r={r * 2.4} fill={`url(#${id}-halo)`} pointerEvents="none" />
                <circle cx={x} cy={y} r={r} fill={ACCENT_STRONG} fillOpacity=".9" stroke="#fff" strokeWidth="1.5" role="button" tabIndex={0} aria-label={`${m.name}: ${m.count} cases. ${p.level} reference point. Filter city.`} onClick={() => onPick("city", m.id)} onKeyDown={activate(() => onPick("city", m.id))}>
                  <title>{`${m.name}: ${m.count} cases · ${p.level} reference`}</title>
                </circle>
                <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" pointerEvents="none">{m.count}</text>
              </g>
            );
          })}
          {!geo.mapped && <text x="400" y="180" textAnchor="middle" fill="#5a5f6b" fontSize="16">No mapped locations in this selection</text>}
        </svg>
        <div className="ov-location-list">
          <ol className="ov-rank is-compact">
            {geo.locations.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onPick("city", m.id)} aria-label={`${m.name}: ${m.count} cases. Filter this location.`}>
                  <span className="ov-rank-name" dir="auto">{m.name}{!m.place && <em>not mapped</em>}</span>
                  <b>{m.count.toLocaleString()}</b>
                  <span className="ov-rank-track"><i style={{ width: `${(m.count / max) * 100}%` }} /></span>
                </button>
              </li>
            ))}
          </ol>
          {!geo.locations.length && <p className="ov-footnote">No recorded locations in this selection.</p>}
        </div>
      </div>
    </>
  );
}

export function Empty({ text = "No cases in this selection." }: { text?: string }) {
  return <div className="ov-empty">{text}</div>;
}

function useAreaMotion(target: number[][]) {
  const [points, setPoints] = useState(target);
  const latest = useRef(target);
  const signature = JSON.stringify(target);
  useEffect(() => {
    const goal = JSON.parse(signature) as number[][];
    if (JSON.stringify(latest.current) === signature) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !goal.length || !latest.current.length) {
      latest.current = goal;
      const frame = requestAnimationFrame(() => setPoints(goal));
      return () => cancelAnimationFrame(frame);
    }
    const sample = (a: number[][], i: number) => {
      const at = (i * (a.length - 1)) / 31;
      const lo = Math.floor(at);
      const hi = Math.ceil(at);
      return a[lo].map((n, k) => n + (a[hi][k] - n) * (at - lo));
    };
    const before = Array.from({ length: 32 }, (_, i) => sample(latest.current, i));
    const after = Array.from({ length: 32 }, (_, i) => sample(goal, i));
    const began = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const p = Math.min(1, (now - began) / 280);
      const e = 1 - Math.pow(1 - p, 3);
      const next = p === 1 ? goal : before.map((a, i) => a.map((n, k) => n + (after[i][k] - n) * e));
      latest.current = next;
      setPoints(next);
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [signature]);
  return points;
}
