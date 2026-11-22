"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { daysWithoutUpdate, displayValue, lastActivity, type BusinessTicket } from "@/lib/tickets/business-analytics";

const STATUS_COLORS: Record<TicketStatus, string> = { new: "#2447d6", in_progress: "#c77700", awaiting_customer: "#6b3fc4", resolved: "#1e7a46", closed: "#8a909c" };
const SHORT_STATUS: Record<TicketStatus, string> = { new: "New", in_progress: "In progress", awaiting_customer: "Awaiting customer", resolved: "Resolved", closed: "Closed, no response" };
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function StatusBreakdown({ tickets, selected, onPick }: { tickets: BusinessTicket[]; selected: string; onPick: (status: TicketStatus) => void }) {
  const rows = TICKET_STATUSES.map((status) => ({ status, count: tickets.filter((t) => t.status === status).length }));
  return (
    <div className="ov-status">
      <div className="ov-status-bar" role="img" aria-label={rows.map((r) => `${STATUS_LABELS[r.status]}: ${r.count}`).join(", ")}>
        {rows.filter((r) => r.count).map((r) => <i key={r.status} style={{ flexGrow: r.count, background: STATUS_COLORS[r.status] }} />)}
      </div>
      <div className="ov-key">
        {rows.map((r) => (
          <button type="button" key={r.status} aria-pressed={selected === r.status} disabled={!r.count && selected !== r.status} onClick={() => onPick(r.status)} title={STATUS_LABELS[r.status]}>
            <i style={{ background: STATUS_COLORS[r.status] }} />
            <span>{SHORT_STATUS[r.status]}</span>
            <b>{r.count.toLocaleString()}</b>
            <small>{percent(r.count, tickets.length)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}

const PAGE_SIZE = 8;

export function CaseTable({ tickets, query, preview, asOf }: { tickets: BusinessTicket[]; query: string; preview: boolean; asOf: string }) {
  const [page, setPage] = useState(1);
  const [prior, setPrior] = useState(query);
  if (prior !== query) {
    setPrior(query);
    setPage(1);
  }
  const pages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const first = (current - 1) * PAGE_SIZE;
  return (
    <section className="ov-panel ov-cases">
      <header>
        <div>
          <h3>Cases to review</h3>
          <p>Longest without an update first</p>
        </div>
        <span className="ov-panel-meta">{tickets.length.toLocaleString()} open</span>
      </header>
      <div className="ov-table-wrap">
        <table>
          <thead>
            <tr><th>Case</th><th>Source</th><th>Status</th><th>Assignee</th><th>Reopened</th><th>Last activity</th></tr>
          </thead>
          <tbody>
            {tickets.slice(first, first + PAGE_SIZE).map((t) => {
              const idle = Math.floor(daysWithoutUpdate(t, asOf));
              return (
                <tr key={t.id}>
                  <td>
                    <Link href={preview ? "#preview" : `/tickets/${t.id}?returnTo=${encodeURIComponent(`/dashboard?${query}`)}`}>
                      <strong>{t.number}</strong>
                      <span dir="auto">{t.subject}</span>
                    </Link>
                  </td>
                  <td dir="auto">{t.sourceName || displayValue("source", t.source, [])}<small>{t.reporter || "Reporter not recorded"}</small></td>
                  <td><span className="ov-status-chip" data-status={t.status}><i aria-hidden="true" />{SHORT_STATUS[t.status]}</span></td>
                  <td>{t.assignee || <span className="ov-muted">Unassigned</span>}</td>
                  <td>{t.reopenCount ? `${t.reopenCount}×` : <span className="ov-muted">—</span>}</td>
                  <td>{formatDateTime(lastActivity(t))}<small data-stale={idle >= 7 || undefined}>{idle < 1 ? "Updated today" : `${idle} day${idle === 1 ? "" : "s"} without an update`}</small></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer>
        <span>{first + 1}–{Math.min(first + PAGE_SIZE, tickets.length)} of {tickets.length.toLocaleString()}</span>
        <div>
          <button type="button" className="ov-button" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button>
          <button type="button" className="ov-button" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
        </div>
      </footer>
    </section>
  );
}
