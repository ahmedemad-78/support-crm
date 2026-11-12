import type { TicketView } from "./filters";
export const OPEN_QUEUE_STATUSES = ["new", "in_progress", "awaiting_customer"];
export function inQueueView(ticket: {status:string; reopenCount?:number; assigneeId?:string}, view:TicketView, userId:string) {
  const open=OPEN_QUEUE_STATUSES.includes(ticket.status);
  if(view==="open")return open;
  if(view==="new")return ticket.status==="new";
  if(view==="reopened")return open&&(ticket.reopenCount??0)>0;
  if(view==="awaiting")return ticket.status==="awaiting_customer";
  if(view==="mine")return open&&ticket.assigneeId===userId;
  if(view==="resolved")return ticket.status==="resolved";
  return true;
}

export const QUEUE_VIEWS: Record<TicketView,string> = { all:"All cases", open:"Open", new:"New", reopened:"Reopened", awaiting:"Waiting for customer", mine:"Assigned to me", resolved:"Resolved" };

export function relationName(value:unknown):string { const row=Array.isArray(value)?value[0]:value; if(row&&typeof row==="object") { if("name" in row&&typeof row.name==="string")return row.name; if("full_name" in row&&typeof row.full_name==="string")return row.full_name; } return ""; }
