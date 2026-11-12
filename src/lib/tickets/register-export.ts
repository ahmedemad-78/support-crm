import type { QueueRow } from "@/components/tickets/ticket-queue";
import { csvCell } from "./analytics";
import { sourceLabel, STATUS_LABELS, type TicketStatus } from "./constants";
import { relationName } from "./queue";

export function registerCsv(rows: QueueRow[], sources: {code:string;name:string}[]) {
  const headers=["Case number","Customer","Problem","Status","Source","Reporter","Recorded by","Support assignee","Reopen count","Last reopened","Created","Last updated","Issue date","City","School","Support response"];
  const body=rows.map(row=>[
    row.ticket_number,row.customer_name,row.issue_description,STATUS_LABELS[row.status as TicketStatus]||row.status,
    sources.find(source=>source.code===row.source)?.name||sourceLabel(row.source),
    relationName(row.reporter),relationName(row.creator),relationName(row.assignee)||"Unassigned",String(row.reopen_count??0),
    row.last_reopened_at||"",row.created_at,row.updated_at||row.created_at,row.issue_date||"",relationName(row.cities),row.school_name||"",row.resolution_notes||"",
  ]);
  return "\uFEFF"+[headers,...body].map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
