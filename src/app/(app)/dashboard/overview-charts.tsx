"use client";
import { useState, type ReactNode } from "react";
import { STATUS_GROUP_LABEL, type RankRow, type StatusGroup, type VolumeBucket } from "@/lib/tickets/overview";

export const STATUS_COLORS: Record<StatusGroup, string> = {
  resolved: "#159d49",
  followup: "#b86e00",
  closed: "#6b7280",
};
export const CHANNEL_COLORS: Record<string, string> = {
  WhatsApp: "#159d49",
  Phone: "#1d4e3a",
  "Support Form": "#3d7ea6",
  Email: "#6f8f7a",
  "Not specified": "#c5cfc8",
};
export const SOURCE_COLORS: Record<string, string> = {
  call_center: "#1d4e3a",
  whatsapp: "#159d49",
  moderation: "#3d7ea6",
  june_schools: "#5eae86",
  business_development: "#c4841d",
  marketing_team: "#6f8f7a",
  google_play: "#b7c4bc",
};
export const FAWRY_COLORS: Record<string, string> = {
  yes: "#159d49",
  no: "#2a312e",
  __missing__: "#d7ded9",
};
const AGE_COLORS = ["#cfead9", "#7dcea0", "#e0a045", "#b45309"];

export type VolumeLine = { id: string; label: string; color: string; values: number[] };

function mark(selected: boolean, active: boolean) {
  if (!selected) return "idle";
  return active ? "on" : "dim";
}

function inkOn(color: string) {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 168 ? "#173126" : "#fff";
}

export function VolumeChart({
  buckets,
  lines,
  selectedFrom,
  selectedLine,
  onPick,
}: {
  buckets: VolumeBucket[];
  lines: VolumeLine[];
  selectedFrom: string;
  selectedLine: string;
  onPick: (lineId: string, from: string, to: string) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; index: number } | null>(null);
  if (!buckets.length) return <EmptyChart text="Choose a valid reported-date range." />;
  const max = Math.max(1, ...lines.flatMap((line) => line.values));
  const width = Math.max(560, buckets.length * (buckets.length > 48 ? 16 : 36));
  const height = 240;
  const pad = { l: 36, r: 12, t: 16, b: 32 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const step = buckets.length <= 1 ? 0 : plotW / (buckets.length - 1);
  const xAt = (index: number) => (buckets.length <= 1 ? pad.l + plotW / 2 : pad.l + index * step);
  const yAt = (value: number) => pad.t + (1 - value / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const signature = `${buckets.map((bucket) => bucket.total).join(",")}|${lines.map((line) => `${line.id}:${line.values.join(",")}`).join(";")}`;
  return (
    <div className="cs-volume cs-draw" key={signature}>
      {lines.length > 1 && (
        <div className="cs-legend">
          {lines.map((line) => {
            const state = mark(Boolean(selectedLine), selectedLine === line.id);
            return (
              <button type="button" key={line.id} className={`is-${state}`} aria-pressed={state === "on"} onClick={() => onPick(line.id, "", "")}>
                <i style={{ background: line.color }} />{line.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="cs-volume-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Case volume by reported date">
          {[0, 0.5, 1].map((point) => {
            const y = yAt(max * point);
            return (
              <g key={point}>
                <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#e7eeea" />
                <text x={pad.l - 6} y={y + 3} textAnchor="end" className="cs-axis">{Math.round(max * point)}</text>
              </g>
            );
          })}
          {lines.map((line) => {
            const points = line.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ");
            const area = `${xAt(0)},${yAt(0)} ${points} ${xAt(line.values.length - 1)},${pad.t + plotH}`;
            const state = mark(Boolean(selectedLine), selectedLine === line.id);
            return (
              <g key={line.id} className={`cs-line cs-${state}`}>
                <polygon points={area} fill={line.color} opacity={state === "dim" ? 0.04 : 0.14} />
                <polyline points={points} pathLength={1} fill="none" stroke={line.color} strokeWidth={state === "on" ? 2.75 : 2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
          {buckets.map((bucket, index) => {
            const active = selectedFrom === bucket.from;
            return (
              <g key={bucket.from}>
                {active && <line x1={xAt(index)} x2={xAt(index)} y1={pad.t} y2={pad.t + plotH} stroke="#159d49" strokeDasharray="3 3" />}
                {lines.map((line) => {
                  const chosen = active && (!selectedLine || selectedLine === line.id || line.id === "total");
                  const dim = Boolean(selectedFrom || selectedLine) && !chosen && !(line.id === "total" && active);
                  return (
                    <circle
                      key={line.id}
                      cx={xAt(index)}
                      cy={yAt(line.values[index] ?? 0)}
                      r={chosen ? 4.5 : 3.5}
                      fill={line.color}
                      stroke="#fff"
                      strokeWidth="1.5"
                      opacity={dim ? 0.2 : 1}
                      role="button"
                      tabIndex={0}
                      aria-pressed={chosen}
                      aria-label={`${bucket.label}, ${line.label}: ${line.values[index] ?? 0} cases`}
                      onMouseEnter={(event) => setTip({ x: event.clientX, y: event.clientY, index })}
                      onMouseLeave={() => setTip(null)}
                      onClick={() => onPick(line.id, bucket.from, bucket.to)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(line.id, bucket.from, bucket.to); } }}
                    />
                  );
                })}
                {index % labelEvery === 0 && <text className="cs-axis" x={xAt(index)} y={height - 8} textAnchor="middle">{bucket.label}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      {tip && (
        <div className="cs-float" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          <strong>{buckets[tip.index]?.label}</strong>
          <p>{buckets[tip.index]?.total} cases</p>
          {lines.length > 1 && lines.map((line) => (
            <span key={line.id}><i style={{ background: line.color }} />{line.label} <b>{line.values[tip.index] ?? 0}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FawryDonut({
  slices,
  selectedId,
  onPick,
}: {
  slices: { id: string; name: string; count: number }[];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const signature = slices.map((slice) => slice.count).join(",");
  return (
    <div className="cs-donut cs-draw" key={signature}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`Fawry payment, ${total} cases`}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#eef2ef" strokeWidth="14" />
        {total > 0 && slices.map((slice) => {
          const length = (slice.count / total) * circumference;
          const dash = `${length} ${circumference - length}`;
          const offset = circumference - cursor;
          cursor += length;
          const state = mark(Boolean(selectedId), selectedId === slice.id);
          return (
            <circle
              key={slice.id}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={FAWRY_COLORS[slice.id] ?? "#d7ded9"}
              strokeWidth={state === "on" ? 18 : 14}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform="rotate(-90 60 60)"
              className={`cs-${state}`}
              role="button"
              tabIndex={0}
              aria-pressed={state === "on"}
              aria-label={`${slice.name}: ${slice.count} cases`}
              onClick={() => onPick(slice.id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(slice.id); } }}
            />
          );
        })}
        <text x="60" y="56" textAnchor="middle" className="cs-donut-total">{total.toLocaleString()}</text>
        <text x="60" y="72" textAnchor="middle" className="cs-donut-label">cases</text>
      </svg>
      <ul>
        {slices.map((slice) => {
          const state = mark(Boolean(selectedId), selectedId === slice.id);
          const share = total ? Math.round((slice.count / total) * 100) : 0;
          return (
            <li key={slice.id}>
              <button type="button" className={`cs-${state}`} aria-pressed={state === "on"} onClick={() => onPick(slice.id)}>
                <i style={{ background: FAWRY_COLORS[slice.id] ?? "#d7ded9" }} />
                <span>{slice.name}</span>
                <strong>{slice.count}</strong>
                <em>{share}%</em>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BarList({
  rows,
  color,
  selectedId,
  onPick,
}: {
  rows: RankRow[];
  color: string;
  selectedId: string;
  onPick: (id: string) => void;
}) {
  if (!rows.length) return <EmptyChart text="No cases match the current filters." />;
  const max = Math.max(1, ...rows.map((row) => row.count));
  const signature = rows.map((row) => `${row.id}:${row.count}`).join("|");
  return (
    <div className="cs-bars cs-draw" key={signature}>
      {rows.map((row) => {
        const state = mark(Boolean(selectedId), selectedId === row.id);
        return (
          <button type="button" key={row.id} className={`cs-bar cs-${state}`} aria-pressed={state === "on"} onClick={() => onPick(row.id)}>
            <span>{row.name}</span>
            <span className="cs-bar-track"><i style={{ width: `${(row.count / max) * 100}%`, background: color }} /></span>
            <strong>{row.count}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function CauseChart({
  rows,
  selectedId,
  onPick,
  color = "#159d49",
  otherColor = "#6f8f7a",
  missingHint = "Data completeness, kept separate from recorded causes",
}: {
  rows: RankRow[];
  selectedId: string;
  onPick: (id: string) => void;
  color?: string;
  otherColor?: string;
  missingHint?: string;
}) {
  const recorded = rows.filter((row) => row.id !== "__missing__" && row.id !== "__other__");
  const other = rows.find((row) => row.id === "__other__");
  const missing = rows.find((row) => row.id === "__missing__");
  if (!recorded.length && !other && !missing) return <EmptyChart text="No cases match the current filters." />;
  return (
    <div className="cs-cause">
      {recorded.length > 0 && <BarList rows={recorded} color={color} selectedId={selectedId} onPick={onPick} />}
      {other && <BarList rows={[other]} color={otherColor} selectedId={selectedId} onPick={onPick} />}
      {missing && (
        <button type="button" className={`cs-missing cs-${mark(Boolean(selectedId), selectedId === missing.id)}`} aria-pressed={selectedId === missing.id} onClick={() => onPick(missing.id)}>
          <span>Not recorded</span>
          <strong>{missing.count}</strong>
          <small>{missingHint}</small>
        </button>
      )}
    </div>
  );
}

export function TopicList({
  rows,
  selectedId,
  onPick,
}: {
  rows: RankRow[];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const ranked = rows.filter((row) => row.id !== "__missing__" && row.id !== "__other__");
  const aside = rows.filter((row) => row.id === "__missing__" || row.id === "__other__");
  if (!ranked.length && !aside.length) return <EmptyChart text="No cases match the current filters." />;
  const signature = rows.map((row) => `${row.id}:${row.count}`).join("|");
  return (
    <div className="cs-topics cs-draw" key={signature}>
      <ol>
        {ranked.map((row, index) => {
          const state = mark(Boolean(selectedId), selectedId === row.id);
          return (
            <li key={row.id}>
              <button type="button" className={`cs-${state}`} aria-pressed={state === "on"} onClick={() => onPick(row.id)}>
                <em>{index + 1}</em>
                <span>{row.name}</span>
                <strong>{row.count}</strong>
                <small>{Math.round(row.share * 100)}%</small>
                {row.followup > 0 && <i>{row.followup} need follow-up</i>}
              </button>
            </li>
          );
        })}
      </ol>
      {aside.length > 0 && (
        <div className="cs-topic-aside">
          {aside.map((row) => (
            <button type="button" key={row.id} className={`cs-${mark(Boolean(selectedId), selectedId === row.id)}`} aria-pressed={selectedId === row.id} onClick={() => onPick(row.id)}>
              <span>{row.id === "__missing__" ? "Not recorded" : row.name}</span>
              <strong>{row.count}</strong>
              <small>{Math.round(row.share * 100)}%</small>
            </button>
          ))}
        </div>
      )}
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
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const grand = Math.max(1, total);
  const floors = rows.map((row) => Math.floor((row.total / grand) * 100));
  let remainder = total === 0 ? 0 : 100 - floors.reduce((sum, value) => sum + value, 0);
  const shareBySegment = Object.fromEntries(rows.map((row, index) => [row.segment, floors[index]]));
  rows
    .map((row, index) => ({ segment: row.segment, fraction: (row.total / grand) * 100 - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((row) => {
      if (remainder > 0) {
        shareBySegment[row.segment] += 1;
        remainder -= 1;
      }
    });
  const signature = `${mode}|` + rows.map((row) => `${row.segment}:${row.total}:${row.parts.map((part) => part.count).join(",")}`).join("|");
  return (
    <div className="cs-segments cs-draw" key={signature}>
      {rows.map((row) => {
        const selectedHere = Boolean(selectedSegment || selectedGroup);
        const segmentShare = shareBySegment[row.segment];
        return (
          <div key={row.segment} className="cs-segment">
            <button type="button" className={`cs-segment-name cs-${mark(Boolean(selectedSegment), selectedSegment === row.segment)}`} onClick={() => onSegment(row.segment)} aria-pressed={selectedSegment === row.segment}>
              {row.segment}
            </button>
            <div className="cs-segment-track" style={mode === "share" ? { width: `${Math.max(segmentShare, row.total ? 6 : 0)}%` } : undefined}>
              {row.parts.filter((part) => part.count > 0).map((part) => {
                const width = mode === "share" ? (row.total ? (part.count / row.total) * 100 : 0) : (part.count / max) * 100;
                const state = mark(selectedHere, (!selectedSegment || selectedSegment === row.segment) && (!selectedGroup || selectedGroup === part.group));
                const share = row.total ? Math.round((part.count / row.total) * 100) : 0;
                return (
                  <button
                    key={part.group}
                    type="button"
                    className={`cs-segment-part cs-${state}`}
                    style={{ width: `${width}%`, background: STATUS_COLORS[part.group] }}
                    aria-label={`${row.segment}, ${STATUS_GROUP_LABEL[part.group]}: ${part.count} cases, ${share}%`}
                    onClick={() => onStack(row.segment, part.group)}
                  >
                    <span className="cs-pop">
                      <b>{row.segment}</b>
                      <em>{STATUS_GROUP_LABEL[part.group]}: {part.count} · {share}%</em>
                    </span>
                  </button>
                );
              })}
            </div>
            <strong>{mode === "share" ? `${segmentShare}%` : row.total}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function AgeStrip({
  ages,
  selected,
  onPick,
}: {
  ages: { id: string; label: string; count: number }[];
  selected: string;
  onPick: (id: string) => void;
}) {
  const total = ages.reduce((sum, age) => sum + age.count, 0);
  const signature = ages.map((age) => age.count).join(",");
  return (
    <div className="cs-age cs-draw" key={signature}>
      <div className="cs-age-bar" role="group" aria-label="Open cases by age since the reported date">
        {ages.map((age, index) => {
          const state = mark(Boolean(selected), selected === age.id);
          const share = total ? (age.count / total) * 100 : 25;
          return (
            <button type="button" key={age.id} className={`cs-${state}${index >= 3 ? " is-ink" : ""}`} style={{ flexGrow: Math.max(share, 8), background: AGE_COLORS[index], color: index >= 3 ? "#fff" : "#173126" }} aria-pressed={state === "on"} onClick={() => onPick(age.id)}>
              <strong>{age.count}</strong>
              <span>{age.label}</span>
            </button>
          );
        })}
      </div>
      <p>Case age counts calendar days since the reported date. It is not an SLA measure.</p>
    </div>
  );
}

export function ColumnChart({
  rows,
  colors,
  selectedId,
  onPick,
}: {
  rows: { id: string; name: string; count: number }[];
  colors: Record<string, string>;
  selectedId: string;
  onPick: (id: string) => void;
}) {
  if (!rows.length) return <EmptyChart text="No cases match the current filters." />;
  const max = Math.max(1, ...rows.map((row) => row.count));
  const signature = rows.map((row) => `${row.id}:${row.count}`).join("|");
  return (
    <div className="cs-columns cs-draw" key={signature}>
      {rows.map((row) => {
        const state = mark(Boolean(selectedId), selectedId === row.id);
        return (
          <button type="button" key={row.id} className={`cs-column cs-${state}`} aria-pressed={state === "on"} onClick={() => onPick(row.id)}>
            <strong>{row.count}</strong>
            <span className="cs-column-track"><i style={{ height: `${Math.max((row.count / max) * 100, row.count ? 6 : 0)}%`, background: colors[row.id] ?? "#159d49" }} /></span>
            <span>{row.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SplitBar({
  rows,
  colors,
  selectedId,
  onPick,
}: {
  rows: RankRow[];
  colors: Record<string, string>;
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const visible = rows.filter((row) => row.count > 0 || row.id === selectedId);
  const total = visible.reduce((sum, row) => sum + row.count, 0);
  if (!visible.length) return <EmptyChart text="No cases match the current filters." />;
  const signature = visible.map((row) => `${row.id}:${row.count}`).join("|");
  return (
    <div className="cs-split cs-draw" key={signature}>
      <div className="cs-split-bar" role="group" aria-label="Share of cases">
        {visible.map((row) => {
          const state = mark(Boolean(selectedId), selectedId === row.id);
          const share = total ? (row.count / total) * 100 : 0;
          const background = colors[row.id] ?? "#159d49";
          return (
            <button type="button" key={row.id} className={`cs-${state}`} style={{ flexGrow: Math.max(share, 8), background, color: inkOn(background) }} aria-pressed={state === "on"} onClick={() => onPick(row.id)}>
              <strong>{row.count}</strong>
            </button>
          );
        })}
      </div>
      <ul>
        {visible.map((row) => {
          const state = mark(Boolean(selectedId), selectedId === row.id);
          const share = total ? Math.round((row.count / total) * 100) : 0;
          return (
            <li key={row.id}>
              <button type="button" className={`cs-${state}`} aria-pressed={state === "on"} onClick={() => onPick(row.id)}>
                <i style={{ background: colors[row.id] ?? "#159d49" }} />
                <span>{row.name}</span>
                <strong>{row.count}</strong>
                <em>{share}%</em>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Panel({ title, question, action, children }: { title: string; question?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="cs-panel">
      <header>
        <div><h3>{title}</h3>{question && <p>{question}</p>}</div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyChart({ text, onReset }: { text: string; onReset?: () => void }) {
  return <div className="cs-empty"><p>{text}</p>{onReset && <button type="button" onClick={onReset}>Reset filters</button>}</div>;
}

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const width = 88;
  const height = 28;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${index * step},${height - (value / max) * (height - 2) - 1}`).join(" ");
  return (
    <svg className="cs-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
