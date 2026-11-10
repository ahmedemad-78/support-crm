"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { submitCaseFollowup } from "@/app/(app)/tickets/lifecycle-actions";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS, type TicketStatus } from "@/lib/tickets/constants";
export type WorkflowEvent = { id: string; kind: string; body: string | null; created_at: string; actor_id: string | null; actorName?: string; to_status: string | null; resolution_snapshot: unknown };
export function CaseFollowup({ ticketId, version, status, count, events, canReply, relatedHref, preview = false }: { ticketId: string; version: string; status: TicketStatus; count: number; events: WorkflowEvent[]; canReply: boolean; relatedHref: string; preview?: boolean }) {
  const [ready,setReady] = useState(false);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setReady(true));return()=>cancelAnimationFrame(frame);},[]);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState("comment");
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState("");
  const [result, action, pending] = useActionState(async (previous: {error:string;success:string}, data: FormData) => { const next = preview ? {error:"Preview only. No message was sent and no case changed.",success:""} : await submitCaseFollowup(previous,data); if(next.success) {setBody("");setRequestId("");setMode("comment");} setAttempt(value => value+1); return next; }, { error: "", success: "" });
  const finished = status === "resolved" || status === "closed";
  return <section className="desk-panel lifecycle-panel" id="case-followup"><header><span className="desk-eyebrow">FOLLOW-UP / SAME CASE, FULL CONTEXT</span><h3>Conversation & resolution history</h3><p>Reopened {count} {count === 1 ? "time" : "times"}. A comment asks a question; reopening brings the same problem back to Support.</p></header><div className="desk-panel-body">
    {canReply && <form key={attempt} action={action} inert={!ready} aria-busy={!ready || pending} className="lifecycle-form">
      <input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="version" value={version} /><input type="hidden" name="requestId" value={requestId} />
      <label>What do you need?<select name="mode" value={mode} onChange={event => { setMode(event.target.value); setRequestId(crypto.randomUUID()); }} disabled={pending}><option value="comment">Add a comment / question</option>{finished && <option value="reopen">The same problem continues — reopen case</option>}</select></label>
      <label htmlFor={`followup-${ticketId}`}>{mode === "reopen" ? "Why does the problem continue?" : "Message to the reporting team / Support"}<textarea id={`followup-${ticketId}`} name="body" dir="auto" value={body} maxLength={4000} minLength={mode === "reopen" ? 5 : 2} required rows={4} disabled={pending} onChange={event => { setBody(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
      <p>Visible to the reporting owner and Support. Keep private team notes in Internal notes.</p>
      {result.error && <p role="alert" className="desk-form-error">{result.error}</p>}{result.success && <p role="status" className="desk-feedback">{result.success}</p>}
      <button className="desk-save" disabled={!ready || pending || body.trim().length < (mode === "reopen" ? 5 : 2)}>{pending ? "Sending…" : mode === "reopen" ? "Reopen case" : "Send comment"}</button>
      <Link href={relatedHref}>Different problem? Open a linked case ↗</Link>
    </form>}
    <ol className="lifecycle-events">{events.map(event => <li key={event.id}><div><strong>{event.kind === "resolved" ? "Resolved & closed" : event.kind === "reopened" ? "Reopened — same problem" : event.kind === "comment" ? "Comment" : event.kind === "created" ? "Case created" : STATUS_LABELS[event.to_status as TicketStatus] || "Status update"}</strong><small>{event.actorName || "Team member"}</small><time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></div>{event.body && <p dir="auto">{event.body}</p>}{Boolean(event.resolution_snapshot) && <small>Resolution snapshot preserved for this cycle.</small>}</li>)}{!events.length && <li>No new workflow activity recorded. Earlier status changes remain in the case timeline.</li>}</ol>
  </div></section>;
}
