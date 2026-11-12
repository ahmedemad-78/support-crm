import Link from "next/link";
import { PrintButton } from "@/components/app-shell/print-button";
import { formatDateTime } from "@/lib/format";
import { sourceLabel, STATUS_LABELS, type TicketStatus } from "@/lib/tickets/constants";
import { QUEUE_VIEWS, relationName } from "@/lib/tickets/queue";
import { type TicketListFilters, ticketListQuery } from "@/lib/tickets/filters";
import type { QueueRow } from "./ticket-queue";
import "./register-report.css";

export function RegisterReport({tickets,filters,extras,sources,generatedAt,selection}:{tickets:QueueRow[];filters:TicketListFilters;extras:Record<string,string>;sources:{code:string;name:string}[];generatedAt:string;selection:string[]}) {
  return <div className="register-report">
    <div className="register-report-controls no-print"><Link href={`/tickets${ticketListQuery(filters,extras)}`}>← Back to case register</Link><div><p>Choose “Save as PDF” in the print dialog. Includes all matching cases across every page.</p><PrintButton/></div></div>
    <header><p>SELAH ELTELMEEZ / TECHNICAL SUPPORT</p><h1>Case register</h1><div><strong>{tickets.length.toLocaleString()} cases · {QUEUE_VIEWS[filters.view]}</strong><span>Generated {formatDateTime(generatedAt)} · Cairo</span></div><p className="register-report-selection">{selection.length?selection.join(" · "):"All sources · All statuses · All time"}</p></header>
    <div className="register-report-table"><table><thead><tr><th>Case / Customer</th><th>Problem / Support response</th><th>Status / Reopened</th><th>Source / Reporter</th><th>Technical Support</th><th>Dates</th></tr></thead><tbody>{tickets.map(ticket=><tr key={ticket.id}><td><strong>{ticket.ticket_number}</strong><p dir="auto">{ticket.customer_name||"Not recorded"}</p>{ticket.school_name&&<p dir="auto">{ticket.school_name}</p>}</td><td><p dir="auto">{ticket.issue_description||"No description recorded"}</p>{ticket.resolution_notes&&<div className="register-report-response"><small>Support response</small><p dir="auto">{ticket.resolution_notes}</p></div>}</td><td>{STATUS_LABELS[ticket.status as TicketStatus]||ticket.status}<p>Reopened ×{ticket.reopen_count??0}</p>{ticket.last_reopened_at&&<small>Last: {formatDateTime(ticket.last_reopened_at)}</small>}</td><td>{sources.find(source=>source.code===ticket.source)?.name||sourceLabel(ticket.source)}<p dir="auto">{relationName(ticket.reporter)||"Reporter not recorded"}</p></td><td dir="auto">{relationName(ticket.assignee)||"Unassigned"}</td><td><small>Created</small><p>{formatDateTime(ticket.created_at)}</p><small>Updated</small><p>{formatDateTime(ticket.updated_at||ticket.created_at)}</p></td></tr>)}</tbody></table></div>
    {!tickets.length&&<p className="register-report-empty">No cases match this selection.</p>}
    <footer>Internal use · {tickets.length.toLocaleString()} cases · Full selected register</footer>
  </div>;
}
