"use client";
import { useEffect, useState, type ReactNode } from "react";
import { sourceLabel } from "@/lib/tickets/constants";
import { STATUS_GROUP_LABEL, type RankRow, type StatusGroup, type VolumeBucket } from "@/lib/tickets/overview";

export const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#0e7490",
  call_center: "#2563eb",
  moderation: "#7c3aed",
  marketing_team: "#db2777",
  business_development: "#0f766e",
  june_schools: "#0284c7",
  google_play: "#64748b",
};
export const STATUS_COLORS: Record<StatusGroup, string> = {
  resolved: "#1f8a4d",
  followup: "#e0922a",
  closed: "#8b93a1",
};
export const SEGMENT_COLORS: Record<string, string> = {
  "B2B Schools": "#0f766e",
  "30 June Schools": "#1d4ed8",
  "Not specified": "#94a3b8",
};

export function sourceColor(source: string) {
  return SOURCE_COLORS[source] ?? "#475569";
}

function mark(selected: boolean, active: boolean) {
  if (!selected) return "idle";
  return active ? "on" : "dim";
}

export function useFillIn() {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return drawn;
}

export function VolumeChart({
  buckets,
  sources,
  selectedSource,
  selectedFrom,
  onInterval,
  onSegment,
}: {
  buckets: VolumeBucket[];
  sources: string[];
  selectedSource: string;
  selectedFrom: string;
  onInterval: (from: string, to: string) => void;
  onSegment: (source: string, from: string, to: string) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; bucket: VolumeBucket } | null>(null);
  const drawn = useFillIn();
  if (!buckets.length) return <EmptyChart text="Choose a valid reported-date range." />;
  const max = Math.max(1, ...buckets.map((bucket) => bucket.total));
  const width = Math.max(640, buckets.length * 28 + 48);
  const height = 250;
  const base = 206;
  const plot = 168;
  const step = (width - 56) / buckets.length;
  return (
    <div className="cs-volume">
      <div className="cs-legend">
        {sources.map((source) => (
          <span key={source}><i style={{ background: sourceColor(source) }} />{sourceLabel(source)}</span>
        ))}
      </div>
      <div className="cs-volume-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Case volume by reported date and source">
          {[0, 0.5, 1].map((stepPoint) => {
            const y = base - plot * stepPoint;
            return (
              <g key={stepPoint}>
                <line x1="40" x2={width - 8} y1={y} y2={y} stroke="#e6eef2" />
                <text x="34" y={y + 4} textAnchor="end" className="cs-axis">{Math.round(max * stepPoint)}</text>
              </g>
            );
          })}
          {buckets.map((bucket, index) => {
            const x = 44 + index * step;
            const columnOn = !selectedFrom || bucket.from === selectedFrom;
            let cursor = base;
            return (
              <g key={bucket.from} className={columnOn ? "" : "cs-svg-dim"}>
                {selectedFrom === bucket.from && <rect x={x + 2} y="28" width={Math.max(8, step - 8)} height={base - 24} rx="8" fill="#e7f5f8" />}
                <rect x={x + 2} y="28" width={Math.max(8, step - 8)} height={base - 28} fill="transparent" role="button" tabIndex={0} aria-label={`${bucket.label}: ${bucket.total} cases`} onClick={() => onInterval(bucket.from, bucket.to)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onInterval(bucket.from, bucket.to); } }} />
                {bucket.parts.filter((part) => part.count > 0).map((part) => {
                  const barHeight = (part.count / max) * plot;
                  cursor -= barHeight;
                  const state = mark(Boolean(selectedSource || selectedFrom), (!selectedSource || part.key === selectedSource) && (!selectedFrom || bucket.from === selectedFrom));
                  return (
                    <rect
                      key={part.key}
                      className={`cs-rise cs-${state}${drawn ? " is-drawn" : ""}`}
                      style={{ transitionDelay: `${index * 28}ms`, color: sourceColor(part.key) }}
                      x={x + 4}
                      y={cursor}
                      width={Math.max(8, step - 12)}
                      height={Math.max(part.count ? 2 : 0, barHeight)}
                      rx="3"
                      fill={sourceColor(part.key)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={state === "on"}
                      aria-label={`${bucket.label}, ${sourceLabel(part.key)}: ${part.count} cases`}
                      onMouseEnter={(event) => setTip({ x: event.clientX, y: event.clientY, bucket })}
                      onMouseLeave={() => setTip(null)}
                      onClick={() => onSegment(part.key, bucket.from, bucket.to)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSegment(part.key, bucket.from, bucket.to); } }}
                    />
                  );
                })}
                <text
                  className="cs-axis cs-axis-btn"
                  x={x + step / 2}
                  y="228"
                  textAnchor="middle"
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedFrom === bucket.from && !selectedSource}
                  onClick={() => onInterval(bucket.from, bucket.to)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onInterval(bucket.from, bucket.to); } }}
                >{index % Math.ceil(buckets.length / 8) === 0 ? bucket.label : ""}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {tip && (
        <div className="cs-float" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <strong>{tip.bucket.label}</strong>
          <p>{tip.bucket.total} cases</p>
          {tip.bucket.parts.filter((part) => part.count).map((part) => (
            <span key={part.key}><i style={{ background: sourceColor(part.key) }} />{sourceLabel(part.key)} <b>{part.count}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

export function RankChart({
  rows,
  color,
  selectedId,
  onPick,
  showRequests = false,
}: {
  rows: RankRow[];
  color: string;
  selectedId: string;
  onPick: (id: string) => void;
  showRequests?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const drawn = useFillIn();
  if (!rows.length) return <EmptyChart text="No cases match the current filters." />;
  return (
    <div className="cs-ranks">
      {rows.map((row, index) => {
        const state = mark(Boolean(selectedId), selectedId === row.id);
        return (
          <button key={row.id} className={`cs-rank cs-${state}`} aria-pressed={state === "on"} onClick={() => onPick(row.id)}>
            <span className="cs-rank-name">{row.name}</span>
            <span className="cs-rank-track"><i className={`cs-rank-fill${drawn ? " is-drawn" : ""}`} style={{ width: `${(row.count / max) * 100}%`, background: color, transitionDelay: `${90 + index * 80}ms` }} /></span>
            <strong>{row.count}</strong>
            <span className="cs-pop">
              <b>{row.name}</b>
              <em>{row.count} cases · {Math.round(row.share * 100)}% of the current selection</em>
              <em>{row.followup} still need follow-up</em>
              {showRequests && row.requests.map((request) => <em key={request.name}>{request.name}: {request.count}</em>)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SegmentChart({
  rows,
  mode,
  selectedSegment,
  selectedGroup,
  onSegment,
  onStack,
}: {
  rows: { segment: string; total: number; parts: { group: StatusGroup; count: number }[] }[];
  mode: "count" | "share";
  selectedSegment: string;
  selectedGroup: string;
  onSegment: (segment: string) => void;
  onStack: (segment: string, group: StatusGroup) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  const drawn = useFillIn();
  return (
    <div className="cs-segments">
      {rows.map((row, index) => {
        const selectedHere = Boolean(selectedSegment || selectedGroup);
        return (
          <div key={row.segment} className="cs-segment" style={{ animationDelay: `${index * 50}ms` }}>
            <button className={`cs-segment-name cs-${mark(Boolean(selectedSegment), selectedSegment === row.segment)}`} onClick={() => onSegment(row.segment)} aria-pressed={selectedSegment === row.segment}>
              <i style={{ background: SEGMENT_COLORS[row.segment] ?? "#94a3b8" }} />{row.segment}
            </button>
            <div className="cs-segment-track">
              {row.parts.filter((part) => part.count > 0).map((part) => {
                const width = mode === "share" ? (row.total ? (part.count / row.total) * 100 : 0) : (part.count / max) * 100;
                const state = mark(selectedHere, (!selectedSegment || selectedSegment === row.segment) && (!selectedGroup || selectedGroup === part.group));
                return (
                  <button
                    key={part.group}
                    className={`cs-segment-part cs-${state}${drawn ? " is-drawn" : ""}`}
                    style={{ width: `${width}%`, background: STATUS_COLORS[part.group], transitionDelay: `${120 + index * 70}ms` }}
                    aria-label={`${row.segment}, ${STATUS_GROUP_LABEL[part.group]}: ${part.count}`}
                    onClick={() => onStack(row.segment, part.group)}
                  >
                    <span className="cs-pop">
                      <b>{row.segment}</b>
                      <em>{row.total} cases</em>
                      <em>{STATUS_GROUP_LABEL[part.group]}: {part.count}{row.total ? ` · ${Math.round((part.count / row.total) * 100)}%` : ""}</em>
                    </span>
                  </button>
                );
              })}
            </div>
            <strong>{row.total}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function Panel({ title, question, action, children }: { title: string; question: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="cs-panel">
      <header>
        <div><h3>{title}</h3><p>{question}</p></div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyChart({ text, onReset }: { text: string; onReset?: () => void }) {
  return <div className="cs-empty"><p>{text}</p>{onReset && <button onClick={onReset}>Reset filters</button>}</div>;
}
