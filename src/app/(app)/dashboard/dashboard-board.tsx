"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PrintButton } from "@/components/app-shell/print-button";
import {
  END_USER_TYPE_LABELS,
  END_USER_TYPES,
  SOURCE_LABELS,
  STATUS_LABELS,
  TICKET_SOURCES,
  TICKET_STATUSES,
  type TicketSource,
  type TicketStatus,
} from "@/lib/tickets/constants";
import {
  barsForStatuses,
  cairoDate,
  fawryShares,
  filterTickets,
  monthStacks,
  shiftDay,
  summarize,
  ticketBounds,
  type DashboardBar,
  type DashboardTicket,
  type MonthStack,
} from "@/lib/tickets/dashboard-model";
import { dashboardQuery, type DashboardFilters, type FawryFilter } from "@/lib/tickets/filters";

type Option = { id: string; name: string };

const SOURCE_COLOR: Record<TicketSource, string> = {
  whatsapp: "#0f766e",
  moderation: "#2447d6",
  call_center: "#159d49",
  june_schools: "#a15c00",
  business_development: "#6b3fc4",
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  new: "#2447d6",
  in_progress: "#a15c00",
  awaiting_customer: "#6b3fc4",
  resolved: "#1e7a46",
  closed: "#4b5060",
};

const FAWRY_COLOR: Record<FawryFilter, string> = {
  yes: "#159d49",
  no: "#4b5060",
  unknown: "#c5c9d4",
};

const EMPTY_FILTERS = {
  source: "",
  status: "",
  city: "",
  category: "",
  userType: "",
  month: "",
  fawry: "",
} as const;

export function DashboardBoard({
  tickets,
  initialFilters,
  cities,
  categories,
}: {
  tickets: DashboardTicket[];
  initialFilters: DashboardFilters;
  cities: Option[];
  categories: Option[];
}) {
  const today = cairoDate(new Date().toISOString());
  const bounds = useMemo(() => ticketBounds(tickets, today), [tickets, today]);
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    ...initialFilters,
    from: initialFilters.from || bounds.from,
    to: initialFilters.to || bounds.to,
  }));

  useEffect(() => {
    const query = dashboardQuery(filters);
    const next = query ? `/dashboard${query}` : "/dashboard";
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [filters]);

  const rows = useMemo(() => filterTickets(tickets, filters), [tickets, filters]);
  const summary = useMemo(() => summarize(rows), [rows]);
  const months = useMemo(
    () => monthStacks(filterTickets(tickets, { ...filters, month: "", source: "" }), filters.from || bounds.from, filters.to || bounds.to),
    [tickets, filters, bounds.from, bounds.to],
  );
  const statuses = useMemo(
    () => barsForStatuses(filterTickets(tickets, { ...filters, status: "" })),
    [tickets, filters],
  );
  const fawry = useMemo(
    () => fawryShares(filterTickets(tickets, { ...filters, fawry: "" })),
    [tickets, filters],
  );

  function patch(partial: Partial<DashboardFilters>) {
    setFilters((current) => ({ ...current, ...partial }));
  }

  function applyPreset(preset: "7" | "30" | "month" | "year" | "all") {
    const dates =
      preset === "all"
        ? { from: bounds.from, to: bounds.to }
        : preset === "7"
          ? { from: shiftDay(today, -6), to: today }
          : preset === "30"
            ? { from: shiftDay(today, -29), to: today }
            : preset === "month"
              ? { from: `${today.slice(0, 7)}-01`, to: today }
              : { from: `${today.slice(0, 4)}-01-01`, to: today };
    patch({ ...dates, month: "" });
  }

  function toggleMonth(month: string) {
    patch({ month: filters.month === month ? "" : month });
  }

  function toggleSegment(month: string, source: TicketSource) {
    if (filters.month === month && filters.source === source) patch({ month: "", source: "" });
    else patch({ month, source });
  }

  function toggleStatus(status: TicketStatus) {
    patch({ status: filters.status === status ? "" : status });
  }

  function toggleFawry(value: FawryFilter) {
    patch({ fawry: filters.fawry === value ? "" : value });
  }

  function toggleSource(source: TicketSource) {
    patch({ source: filters.source === source ? "" : source });
  }

  const presetActive = {
    "7": filters.from === shiftDay(today, -6) && filters.to === today,
    "30": filters.from === shiftDay(today, -29) && filters.to === today,
    month: filters.from === `${today.slice(0, 7)}-01` && filters.to === today,
    year: filters.from === `${today.slice(0, 4)}-01-01` && filters.to === today,
    all: filters.from === bounds.from && filters.to === bounds.to,
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-5 sm:px-8">
      <p className="sr-only" aria-live="polite">
        {summary.created} tickets match the current filters.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={`/dashboard/export${dashboardQuery(filters)}`}
          className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-semibold"
        >
          Export CSV
        </a>
        <PrintButton />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["7", "7 days"],
              ["30", "30 days"],
              ["month", "This month"],
              ["year", "This year"],
              ["all", "All"],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              aria-pressed={presetActive[preset]}
              onClick={() => applyPreset(preset)}
              className={`h-8 rounded-full px-3 text-sm font-medium transition-colors ${
                presetActive[preset]
                  ? "bg-brand-action text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
            <input
              type="date"
              aria-label="From"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => patch({ from: event.target.value, month: "" })}
              className="bg-transparent outline-none"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              aria-label="To"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => patch({ to: event.target.value, month: "" })}
              className="bg-transparent outline-none"
            />
          </label>
          <DashSelect
            label="Source"
            value={filters.source}
            onChange={(source) => patch({ source: source as TicketSource | "" })}
          >
            <option value="">Source: All</option>
            {(Object.keys(SOURCE_LABELS) as TicketSource[]).map((source) => (
              <option key={source} value={source}>
                Source: {SOURCE_LABELS[source]}
              </option>
            ))}
          </DashSelect>
          <DashSelect
            label="Status"
            value={filters.status}
            onChange={(status) => patch({ status: status as TicketStatus | "" })}
          >
            <option value="">Status: All</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                Status: {STATUS_LABELS[status]}
              </option>
            ))}
          </DashSelect>
          <DashSelect label="City" value={filters.city} onChange={(city) => patch({ city })}>
            <option value="">City: All</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                City: {city.name}
              </option>
            ))}
          </DashSelect>
          <DashSelect label="Issue category" value={filters.category} onChange={(category) => patch({ category })}>
            <option value="">Issue category: All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                Issue category: {category.name}
              </option>
            ))}
          </DashSelect>
          <DashSelect label="User type" value={filters.userType} onChange={(userType) => patch({ userType })}>
            <option value="">User type: All</option>
            {END_USER_TYPES.map((type) => (
              <option key={type} value={type}>
                User type: {END_USER_TYPE_LABELS[type]}
              </option>
            ))}
          </DashSelect>
          <button
            type="button"
            onClick={() =>
              setFilters({
                ...EMPTY_FILTERS,
                from: bounds.from,
                to: bounds.to,
              })
            }
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Tickets created" value={String(summary.created)} detail="In the selected range" />
        <Kpi
          label="Open right now"
          value={String(summary.open)}
          detail={`${summary.newCount} new · ${summary.inProgress} in progress · ${summary.awaiting} awaiting`}
        />
        <Kpi
          label="Avg. resolution time"
          value={summary.averageHours == null ? "—" : `${summary.averageHours.toFixed(1)} h`}
          detail="From creation to resolved"
        />
        <Kpi
          label="Resolved or closed"
          value={String(summary.resolved)}
          detail={summary.created ? `${summary.resolvedShare}% of tickets created` : "No tickets in this range"}
        />
      </div>

      <Panel title="Tickets by month and source">
        <MonthChart
          months={months}
          selectedMonth={filters.month}
          selectedSource={filters.source}
          onMonth={toggleMonth}
          onSegment={toggleSegment}
        />
        <Legend>
          {TICKET_SOURCES.map((source) => (
            <li key={source}>
              <LegendButton
                label={SOURCE_LABELS[source]}
                color={SOURCE_COLOR[source]}
                pressed={filters.source === source}
                onClick={() => toggleSource(source)}
              />
            </li>
          ))}
        </Legend>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Status">
          <ShareChart
            kind="donut"
            entries={statuses}
            selected={filters.status}
            colorFor={(key) => STATUS_COLOR[key as TicketStatus]}
            onSelect={(key) => toggleStatus(key as TicketStatus)}
          />
        </Panel>
        <Panel title="Fawry payment">
          <ShareChart
            kind="pie"
            entries={fawry}
            selected={filters.fawry}
            colorFor={(key) => FAWRY_COLOR[key as FawryFilter]}
            onSelect={(key) => toggleFawry(key as FawryFilter)}
          />
        </Panel>
      </div>
    </div>
  );
}

function MonthChart({
  months,
  selectedMonth,
  selectedSource,
  onMonth,
  onSegment,
}: {
  months: MonthStack[];
  selectedMonth: string;
  selectedSource: TicketSource | "";
  onMonth: (month: string) => void;
  onSegment: (month: string, source: TicketSource) => void;
}) {
  const max = Math.max(1, ...months.map((month) => month.total));
  const labelEvery = months.length > 18 ? Math.ceil(months.length / 12) : 1;
  if (months.length === 0) return <p className="text-sm text-muted-foreground">No results.</p>;
  return (
    <div className="flex h-52 items-end gap-1" role="img" aria-label="Tickets by month, split by source">
      {months.map((month, index) => (
        <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div className="flex h-44 w-full flex-col-reverse">
            {TICKET_SOURCES.map((source) => {
              const value = month.sources[source];
              const chosen =
                (selectedMonth === "" || selectedMonth === month.key) &&
                (selectedSource === "" || selectedSource === source);
              const active = selectedMonth === month.key && selectedSource === source;
              return (
                <button
                  key={source}
                  type="button"
                  aria-label={`${month.label}, ${SOURCE_LABELS[source]}, ${value} tickets`}
                  aria-pressed={active}
                  tabIndex={value === 0 ? -1 : 0}
                  onClick={() => value > 0 && onSegment(month.key, source)}
                  className="w-full transition-[height,opacity] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-action"
                  style={{
                    height: `${(value / max) * 100}%`,
                    background: SOURCE_COLOR[source],
                    opacity: chosen ? 1 : 0.28,
                    pointerEvents: value === 0 ? "none" : "auto",
                  }}
                />
              );
            })}
          </div>
          <button
            type="button"
            aria-label={`${month.label}, ${month.total} tickets`}
            aria-pressed={selectedMonth === month.key}
            onClick={() => onMonth(month.key)}
            className={`h-4 max-w-full truncate text-[10px] ${
              selectedMonth === month.key ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {index % labelEvery === 0 ? month.label : ""}
          </button>
        </div>
      ))}
    </div>
  );
}

function ShareChart({
  kind,
  entries,
  selected,
  colorFor,
  onSelect,
}: {
  kind: "donut" | "pie";
  entries: DashboardBar[];
  selected: string;
  colorFor: (key: string) => string;
  onSelect: (key: string) => void;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const outer = 78;
  const inner = kind === "donut" ? 48 : 0;
  let cursor = 0;
  const slices = entries
    .filter((entry) => entry.value > 0)
    .map((entry) => {
      const start = cursor;
      cursor += entry.value / total;
      return { ...entry, start, end: cursor };
    });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={kind === "donut" ? "Status" : "Fawry payment"}>
        {total === 0 ? (
          <circle cx="100" cy="100" r={outer} fill="none" stroke="#e6e8ee" strokeWidth={kind === "donut" ? outer - inner : outer} />
        ) : (
          slices.map((slice) => {
            const dim = selected !== "" && selected !== slice.key;
            return (
              <path
                key={slice.key}
                d={slicePath(slice.start, slice.end, outer, inner)}
                fill={colorFor(slice.key)}
                opacity={dim ? 0.28 : 1}
                fillRule="evenodd"
                className="cursor-pointer transition-opacity duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-action"
                role="button"
                tabIndex={0}
                aria-pressed={selected === slice.key}
                aria-label={`${slice.label}, ${slice.value} tickets`}
                onClick={() => onSelect(slice.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(slice.key);
                  }
                }}
              >
                <title>{`${slice.label}: ${slice.value}`}</title>
              </path>
            );
          })
        )}
        {kind === "donut" ? (
          <text x="100" y="104" textAnchor="middle" className="fill-foreground text-[22px] font-semibold">
            {total}
          </text>
        ) : null}
      </svg>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li key={entry.key}>
            <LegendButton
              label={`${entry.label} · ${entry.value}`}
              color={colorFor(entry.key)}
              pressed={selected === entry.key}
              onClick={() => onSelect(entry.key)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function slicePath(start: number, end: number, outer: number, inner: number) {
  if (end - start >= 0.999) return fullSlice(outer, inner);
  const large = end - start > 0.5 ? 1 : 0;
  const [x1, y1] = polar(outer, start);
  const [x2, y2] = polar(outer, end);
  if (inner <= 0) {
    return `M 100 100 L ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} Z`;
  }
  const [x3, y3] = polar(inner, end);
  const [x4, y4] = polar(inner, start);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

function fullSlice(outer: number, inner: number) {
  const outerRing = `M 100 100 m -${outer} 0 a ${outer} ${outer} 0 1 0 ${outer * 2} 0 a ${outer} ${outer} 0 1 0 -${outer * 2} 0`;
  if (inner <= 0) return outerRing;
  const hole = `M 100 100 m -${inner} 0 a ${inner} ${inner} 0 1 1 ${inner * 2} 0 a ${inner} ${inner} 0 1 1 -${inner * 2} 0`;
  return `${outerRing} ${hole}`;
}

function polar(radius: number, turn: number) {
  const angle = turn * Math.PI * 2;
  return [100 + radius * Math.sin(angle), 100 - radius * Math.cos(angle)];
}

function Legend({ children }: { children: ReactNode }) {
  return <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">{children}</ul>;
}

function LegendButton({
  label,
  color,
  pressed,
  onClick,
}: {
  label: string;
  color: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-xs ${
        pressed ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums transition-opacity duration-300">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function DashSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border bg-background px-3 text-sm"
    >
      {children}
    </select>
  );
}
