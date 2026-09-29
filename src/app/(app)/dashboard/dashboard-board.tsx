"use client";

import { useEffect, useMemo, useState } from "react";
import { PrintButton } from "@/components/app-shell/print-button";
import {
  END_USER_TYPE_LABELS,
  END_USER_TYPES,
  SOURCE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  TICKET_STATUSES,
  type TicketSource,
  type TicketStatus,
} from "@/lib/tickets/constants";
import {
  barsForCauses,
  barsForResolution,
  barsForSources,
  barsForStatuses,
  cairoDate,
  filterTickets,
  shiftDay,
  summarize,
  ticketBounds,
  timeBuckets,
  type DashboardTicket,
} from "@/lib/tickets/dashboard-model";
import { dashboardQuery, type DashboardFilters } from "@/lib/tickets/filters";

type Option = { id: string; name: string };

const STATUS_BAR: Record<TicketStatus, string> = {
  new: "bg-status-new",
  in_progress: "bg-status-progress",
  awaiting_customer: "bg-status-awaiting",
  resolved: "bg-status-resolved",
  closed: "bg-status-closed",
};

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
  const sources = useMemo(() => barsForSources(rows), [rows]);
  const statuses = useMemo(() => barsForStatuses(rows), [rows]);
  const causes = useMemo(() => barsForCauses(rows), [rows]);
  const resolution = useMemo(() => barsForResolution(rows), [rows]);
  const days = useMemo(
    () => timeBuckets(rows, filters.from || bounds.from, filters.to || bounds.to),
    [rows, filters.from, filters.to, bounds.from, bounds.to],
  );

  function patch(partial: Partial<DashboardFilters>) {
    setFilters((current) => ({ ...current, ...partial }));
  }

  function applyPreset(preset: "7" | "30" | "month" | "year" | "all") {
    if (preset === "all") {
      patch({ from: bounds.from, to: bounds.to });
      return;
    }
    if (preset === "7") patch({ from: shiftDay(today, -6), to: today });
    else if (preset === "30") patch({ from: shiftDay(today, -29), to: today });
    else if (preset === "month") patch({ from: `${today.slice(0, 7)}-01`, to: today });
    else patch({ from: `${today.slice(0, 4)}-01-01`, to: today });
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
              onChange={(event) => patch({ from: event.target.value })}
              className="bg-transparent outline-none"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              aria-label="To"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => patch({ to: event.target.value })}
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
                source: "",
                status: "",
                city: "",
                category: "",
                userType: "",
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

      <Panel title="Tickets over time">
        <ColumnChart buckets={days} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="By source">
          <Bars entries={sources} />
        </Panel>
        <Panel title="By status">
          <Bars entries={statuses} colorFor={(key) => STATUS_BAR[key as TicketStatus]} />
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {statuses.map((status) => (
              <li key={status.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`size-2 rounded-full ${STATUS_STYLES[status.key as TicketStatus].dot}`} />
                {status.label}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Resolution time by category">
          <Bars entries={resolution} suffix=" h" />
        </Panel>
        <Panel title="Top root causes">
          <Bars entries={causes} />
        </Panel>
      </div>
    </div>
  );
}

function ColumnChart({ buckets }: { buckets: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  const labelEvery = buckets.length > 16 ? Math.ceil(buckets.length / 8) : 1;
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">No results.</p>;
  }
  return (
    <div className="flex h-44 items-end gap-1" role="img" aria-label="Tickets created over the selected dates">
      {buckets.map((bucket, index) => (
        <div key={bucket.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t bg-brand transition-[height] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
            style={{ height: `${(bucket.value / max) * 100}%` }}
            title={`${bucket.key}: ${bucket.value}`}
          />
          <span className="h-3 text-[10px] text-muted-foreground">
            {index % labelEvery === 0 ? bucket.label : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function Bars({
  entries,
  suffix = "",
  colorFor,
}: {
  entries: { key: string; label: string; value: number }[];
  suffix?: string;
  colorFor?: (key: string) => string;
}) {
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No results.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.key}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate">{entry.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {entry.value}
              {suffix}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${colorFor?.(entry.key) ?? "bg-brand-action"}`}
              style={{ width: `${(entry.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
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
  children: React.ReactNode;
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
