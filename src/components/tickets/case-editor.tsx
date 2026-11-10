"use client";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { Check, CheckCircle2, Circle, LoaderCircle, Save, UserRound } from "lucide-react";
import { saveCaseWorkspace } from "@/app/(app)/tickets/actions";
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { useCaseDraft } from "./case-session";

export type CaseOption = { id: number; name: string; is_active: boolean };
export type CaseEditValues = {
  status: TicketStatus; assigneeId: string;
  requestTypeId: string; topicId: string; trackerCauseId: string; trackerActionId: string; outcomeId: string;
  issueCategoryId: string; rootCauseId: string; resolutionNotes: string; followUpNotes: string; trackerNotes: string; actionTaken: string;
};
export type CaseEditorProps = {
  ticketId: string; updatedAt: string; returnTo: string; initial: CaseEditValues;
  options: { requestTypes: CaseOption[]; topics: CaseOption[]; causes: CaseOption[]; actions: CaseOption[]; outcomes: CaseOption[]; categories: CaseOption[]; rootCauses: CaseOption[] };
  agents: { id: string; full_name: string }[]; userId: string; canEdit: boolean; preview?: boolean;
};
const requiredFields = [["requestTypeId", "Request type"], ["topicId", "Topic"], ["trackerCauseId", "Cause"], ["trackerActionId", "Action"], ["outcomeId", "Outcome"]] as const;

export function CaseEditor({ ticketId, updatedAt, returnTo, initial, options, agents, userId, canEdit, preview = false }: CaseEditorProps) {
  const [values, setValues] = useState(initial);
  const [submittedValues, setSubmittedValues] = useState("");
  const { setDirty: setCaseDirty, noteDirty } = useCaseDraft();
  const [result, formAction, pending] = useActionState(async (previous: { error: string }, data: FormData) => preview ? { error: "Preview only: no case was updated. Your draft is still here." } : saveCaseWorkspace(previous, data), { error: "" });
  const dirty = (Object.keys(initial) as (keyof CaseEditValues)[]).some((key) => initial[key] !== values[key]);
  const complete = requiredFields.filter(([key]) => values[key]).length;
  const canSave = values.status !== "resolved" || (complete === 5 && values.resolutionNotes.trim().length >= 5);
  useEffect(() => {
    if (!dirty || pending) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const next = new URL(link.href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      if (!window.confirm("You have unsaved case changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, pending]);
  function change(key: keyof CaseEditValues, value: string) { const next = { ...values, [key]: value }; setValues(next); setCaseDirty((Object.keys(initial) as (keyof CaseEditValues)[]).some((field) => initial[field] !== next[field])); }
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!canSave || !dirty || !canEdit) { event.preventDefault(); return; }
    if (!preview && values.status === "closed" && initial.status !== "closed" && !window.confirm("Close this case without a customer response?")) event.preventDefault();
    if (!event.defaultPrevented) setSubmittedValues(JSON.stringify(values));
  }
  function select(key: keyof CaseEditValues, label: string, items: CaseOption[]) {
    return <label className="desk-field" key={key} htmlFor={`case-${key}`}><span>{label}</span><select id={`case-${key}`} name={key} value={values[key]} disabled={!canEdit || pending || noteDirty} onChange={(event) => change(key, event.target.value)}><option value="">Not recorded</option>{items.filter((item) => item.is_active || String(item.id) === values[key]).map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? "" : " (archived)"}</option>)}</select></label>;
  }
  function text(key: keyof CaseEditValues, label: string, hint?: string) {
    return <label className="desk-field desk-wide" htmlFor={`case-${key}`}><span>{label}</span>{hint && <small>{hint}</small>}<textarea id={`case-${key}`} dir="auto" name={key} value={values[key]} disabled={!canEdit || pending || noteDirty} rows={key === "resolutionNotes" ? 5 : 3} onChange={(event) => change(key, event.target.value)} /></label>;
  }
  return <form action={formAction} onSubmit={submit} className="desk-editor" id="case-work">
    <input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="updatedAt" value={updatedAt} /><input type="hidden" name="returnTo" value={returnTo} />
    <div className="desk-editor-main">{noteDirty && <p className="desk-form-warning" role="status">Save or clear your internal note draft before editing the case. This keeps both drafts safe.</p>}
      <section className="desk-panel"><header><span className="desk-eyebrow">02 / WORK THE CASE</span><h3>Classify. Respond. Move forward.</h3><p>Save the tracker, response, status and owner together.</p></header>
        <div className="desk-edit-grid">{select("requestTypeId", "Request type", options.requestTypes)}{select("topicId", "Topic", options.topics)}{select("trackerCauseId", "Cause", options.causes)}{select("trackerActionId", "Action", options.actions)}{select("outcomeId", "Outcome", options.outcomes)}
          {text("resolutionNotes", "Technical Support response", "Visible to the reporting team and managers. Write a clear answer or the next step.")}
        </div>
        <details className="desk-extra" open={Boolean(initial.followUpNotes || initial.trackerNotes)}><summary>Follow-up & tracker notes<span>Optional context</span></summary><div className="desk-edit-grid">{text("followUpNotes", "Follow-up notes")}{text("trackerNotes", "Tracker notes")}</div></details>
        <details className="desk-extra" open={Boolean(initial.issueCategoryId || initial.rootCauseId || initial.actionTaken)}><summary>Technical classification<span>Category, root cause & action taken</span></summary><div className="desk-edit-grid">{select("issueCategoryId", "Issue category", options.categories)}{select("rootCauseId", "Root cause", options.rootCauses)}{text("actionTaken", "Action taken")}</div></details>
      </section>
    </div>
    <aside className="desk-action-column"><section className="desk-panel desk-action-panel"><header><span className="desk-eyebrow">NEXT STEP</span><h3>Manage this case.</h3></header><div className="desk-action-body">
      {["resolved","closed"].includes(initial.status) && <p className="desk-form-warning">Use Conversation & resolution history below to reopen with a reason.</p>}<label className="desk-field" htmlFor="case-status"><span>Status</span><select id="case-status" name="status" value={values.status} disabled={!canEdit || pending || noteDirty} onChange={(event) => change("status", event.target.value)}>{TICKET_STATUSES.filter(status => !["resolved", "closed"].includes(initial.status) || status === initial.status).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
      <label className="desk-field" htmlFor="case-assignee"><span>Support assignee</span><select id="case-assignee" name="assigneeId" value={values.assigneeId} disabled={!canEdit || pending || noteDirty} onChange={(event) => change("assigneeId", event.target.value)}><option value="">Unassigned</option>{values.assigneeId && !agents.some((agent) => agent.id === values.assigneeId) && <option value={values.assigneeId}>Current owner (inactive)</option>}{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label>
      {canEdit && agents.some((agent) => agent.id === userId) && values.assigneeId !== userId && <button type="button" className="desk-assign-me" disabled={pending || noteDirty} onClick={() => change("assigneeId", userId)}><UserRound size={14} /> Assign to me</button>}
      <div className="desk-readiness"><div><strong>{complete} / 5</strong><span>Resolution readiness</span>{complete === 5 && <CheckCircle2 size={17} />}</div><progress max={5} value={complete} aria-label="Resolution readiness" /><ul>{requiredFields.map(([key, label]) => <li key={key} className={values[key] ? "is-complete" : ""}>{values[key] ? <Check size={12} /> : <Circle size={10} />}<a href={`#case-${key}`}>{label}</a></li>)}</ul><p>All five tracker fields and a clear Support response are required for Resolve & close. Closed without response keeps them optional.</p></div>
      {values.status === "closed" && <p className="desk-form-warning">This closes the case without a customer response.</p>}
      {!canSave && canEdit && <p className="desk-form-warning" role="status">Complete the tracker and write a clear Support response to resolve and close.</p>}
      {result.error && !pending && submittedValues === JSON.stringify(values) && <p className="desk-form-error" role="alert">{result.error}</p>}
      {canEdit ? <><button type="submit" className="desk-save" disabled={pending || !dirty || !canSave || noteDirty}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{pending ? "Saving case…" : "Save case"}</button><p className={`desk-save-state${dirty ? " is-dirty" : ""}`} role="status">{pending ? "Saving all case changes together." : dirty ? "Unsaved changes · save before leaving" : "No unsaved changes"}</p>{dirty && !pending && <button type="button" className="desk-discard" onClick={() => { setValues(initial); setCaseDirty(false); }}>Discard changes</button>}</> : <p className="desk-save-state">Read-only access · Technical Support can make changes.</p>}
    </div></section></aside>
  </form>;
}
