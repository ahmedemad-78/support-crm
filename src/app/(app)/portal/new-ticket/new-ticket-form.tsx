"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, LoaderCircle, Lock, Plus, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_RULES, ATTACHMENTS_BUCKET, END_USER_TYPE_LABELS, END_USER_TYPES, PLATFORM_LABELS, PLATFORMS, sourceLabel } from "@/lib/tickets/constants";
import { APP_FIELDS, CUSTOMER_FIELDS, INTAKE_LABELS, attachmentMime, checkIntakeFiles, initialIntakeDraft, uploadIntakeFiles, type IntakeField, type IntakeFile } from "@/lib/tickets/intake";
import { fieldErrorsOf, needsSchool, portalTicketSchemaFor, supportTicketSchema, type PortalTicketFieldErrors, type SupportTicketInput } from "@/lib/tickets/schema";
import { createPortalTicket, createSupportTicket } from "./actions";
import "./intake.css";
import { LocalAttachmentPreview } from "@/components/tickets/attachment-preview";

type Props = { cities: { id: number; name: string }[]; lockedSource?: string; sources?: { code: string; name: string; reporter_name?: string; default_reporter_id?:string|null; bound_role?:string|null }[]; reporters?:{id:string;full_name:string;role:string}[]; linkedTicketId?: string; today: string; cancelHref?: string; preview?: "failure" | "uploads" };
type CreatedCase = { ticketId: string; ticketNumber: string };
const optionalFields: IntakeField[] = [ "device_type", "app_version", "page_screen", "steps"];

export function NewTicketForm({ cities, sources, reporters=[], lockedSource = "call_center", today, cancelHref = "/portal/my-tickets", preview, linkedTicketId = "" }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const allowLeave = useRef(false);
  const createdRef = useRef<CreatedCase | null>(null);
  const [initial] = useState(() => ({ ...initialIntakeDraft(today, sources?.length === 1 ? sources[0].code : ""), reporter_id:sources?.length===1?sources[0].default_reporter_id||"":"", linked_ticket_id: linkedTicketId }));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<PortalTicketFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [fileIssues, setFileIssues] = useState<string[]>([]);
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [createdCase, setCreatedCase] = useState<CreatedCase | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [previewDone, setPreviewDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  const dirty = (Object.keys(initial) as IntakeField[]).some((key) => initial[key] !== draft[key]) || files.length > 0;
  const source = sources ? draft.source : lockedSource;
  const sourceTeam=sources?.find(item=>item.code===source);
  const eligibleReporters=sourceTeam?reporters.filter(person=>person.role===(sourceTeam.bound_role||"support_agent")):[];
  const schoolRequired = needsSchool(source);
  const noun = sources ? "case" : "ticket";
  const schema = sources ? supportTicketSchema : portalTicketSchemaFor(lockedSource);
  const validation = schema.safeParse(draft);
  const invalid = validation.success ? {} : fieldErrorsOf(validation.error);
  const validField = (key: IntakeField) => Boolean(draft[key]?.trim()) && !invalid[key];
  const groups = [
    { name: "Customer", keys: [...CUSTOMER_FIELDS, ...(schoolRequired ? ["school_name" as const] : [])], target: "intake-customer" },
    { name: "The issue", keys: ["issue_date", "issue_description", ...(sources ? ["source", "reporter_id"] : [])] as IntakeField[], target: "intake-issue" },
    { name: "App & payment", keys: APP_FIELDS, target: "intake-app" },
  ];
  const required = groups.flatMap((group) => group.keys);
  const filled = required.filter((key) => validField(key)).length;
  const configMissing = !cities.length || (sources !== undefined && !sources.length);
  const errorEntries = Object.entries(errors) as [IntakeField, string][];

  useEffect(() => {
    if (!dirty || (createdCase && !files.length)) return;
    const unload = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (allowLeave.current || !(link instanceof HTMLAnchorElement) || link.target === "_blank" || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const next = new URL(link.href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      if (!window.confirm(createdCase ? "Some attachments are not uploaded. Leave this saved case?" : "Leave without creating this case? Your entries will be lost.")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, createdCase, files.length]);
  function change(key: IntakeField, value: string) {
    setDraft((current) => ({ ...current, [key]: value, ...(key==="source"?{reporter_id:sources?.find(item=>item.code===value)?.default_reporter_id||""}:{}) }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; }); setFormError("");
  }
  function focusField(key: IntakeField) {
    if (optionalFields.includes(key)) setMoreOpen(true);
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>(`[data-intake-field="${key}"]`);
      field?.querySelector<HTMLElement>("input,textarea,select")?.focus({ preventScroll: true });
      field?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    });
  }
  function showErrors(next: PortalTicketFieldErrors) { setErrors(next); const first = Object.keys(next)[0] as IntakeField | undefined; if (first) focusField(first); }
  const savedHref = (created: CreatedCase) => sources ? `/tickets/${created.ticketId}?returnTo=${encodeURIComponent(cancelHref)}` : `/portal/my-tickets/${created.ticketId}`;
  function finish(created: CreatedCase) {
    if (preview) { setPreviewDone(true); return; }
    allowLeave.current = true; router.push(sources ? savedHref(created) : `/portal/my-tickets?submitted=${encodeURIComponent(created.ticketNumber)}`);
  }
  function leave() {
    if (dirty && !createdCase && !window.confirm("Discard this case draft and return to the queue?")) return;
    allowLeave.current = true; router.push(createdCase ? savedHref(createdCase) : cancelHref);
  }
  async function upload(created: CreatedCase, items: IntakeFile[], retry: boolean) {
    if (preview) return preview === "uploads" && !retry ? items : [];
    if (!items.length) return [];
    const supabase = createClient();
    return uploadIntakeFiles(created.ticketId, items, {
      hasRecord: async (path) => { const { data, error } = await supabase.from("ticket_attachments").select("id").eq("ticket_id", created.ticketId).eq("storage_path", path).maybeSingle(); return { exists: Boolean(data), failed: Boolean(error) }; },
      upload: async (path, file) => { const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: attachmentMime(file) }); return { ok: !error, alreadyExists: String((error as { statusCode?: string } | null)?.statusCode) === "409" }; },
      record: async (path, file) => { const { error } = await supabase.from("ticket_attachments").insert({ ticket_id: created.ticketId, storage_path: path, file_name: file.name, mime_type: attachmentMime(file), size_bytes: file.size }); return !error; },
    });
  }
  function onSubmit(event: FormEvent) {
    event.preventDefault(); if (!ready || inFlight.current || configMissing || previewDone) return;
    setFormError(""); const existing = createdRef.current;
    const submitted = { ...draft, ...Object.fromEntries([...new FormData(formRef.current!).entries()].filter(([, value]) => typeof value === "string")) };
    setDraft(submitted);
    if (!existing) { const check = schema.safeParse(submitted); if(sources&&!submitted.reporter_id){showErrors({reporter_id:"Choose the reporting owner from this source team."});return;} if (!check.success) { showErrors(fieldErrorsOf(check.error)); return; } }
    setErrors({}); setFileIssues([]); inFlight.current = true;
    startTransition(async () => {
      try {
        let created = existing;
        if (!created) {
          setPhase("saving"); requestId.current ??= crypto.randomUUID(); const input = submitted as unknown as SupportTicketInput;
          const result = preview ? preview === "failure" ? { ok: false as const, error: "Preview save failed. Your entries are still here." } : { ok: true as const, ticketId: "11111111-1111-4111-8111-111111111111", ticketNumber: "TKT-PREVIEW-0001" } : sources ? await createSupportTicket(input, requestId.current) : await createPortalTicket(input, requestId.current);
          if (!result.ok) { if ("fieldErrors" in result && result.fieldErrors) showErrors(result.fieldErrors); setFormError(result.error || "Please fix the highlighted fields."); return; }
          created = { ticketId: result.ticketId, ticketNumber: result.ticketNumber }; createdRef.current = created; setCreatedCase(created);
        }
        if (files.length) setPhase("uploading");
        const failed = await upload(created, files, Boolean(existing)); setFiles(failed);
        if (failed.length) { setEvidenceOpen(true); setFormError(`Case ${created.ticketNumber} is saved. ${failed.length} attachment(s) still need uploading. Retry them below or open the saved case.`); return; }
        finish(created);
      } catch { setFormError(createdRef.current ? "The case is saved. Retry the remaining attachments, or open the case to check them." : "We could not confirm the save. Your entries are still here. Retry from this form so the same request is used."); }
      finally { inFlight.current = false; setPhase("idle"); }
    });
  }
  function addFiles(list: FileList | null) {
    if (!list || pending || createdRef.current) return;
    const checked = checkIntakeFiles(files.map((item) => item.file), Array.from(list)); setFileIssues(checked.issues);
    setFiles((current) => [...current, ...(checked.accepted as File[]).map((file) => ({ id: crypto.randomUUID(), file }))]); setEvidenceOpen(true);
  }
  function field(key: IntakeField, options: { type?: string; optional?: boolean; hint?: string; placeholder?: string; maxLength?: number } = {}) { return <InputField key={key} name={key} value={draft[key]} onChange={(value) => change(key, value)} error={errors[key]} {...options} />; }
  function select(key: IntakeField, items: { value: string; label: string }[], optional = false) {
    return <FieldShell name={key} error={errors[key]} optional={optional}><select id={key} name={key} value={draft[key]} onChange={(event) => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} required={!optional}><option value="">Choose…</option>{items.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></FieldShell>;
  }
  function choice(key: IntakeField, items: { value: string; label: string }[], hint?: string) {
    return <fieldset className="intake-field intake-choice" data-intake-field={key} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined}><legend><span className="intake-label-text">{INTAKE_LABELS[key]}</span><span className="intake-field-status">Required</span></legend>{hint && <small id={`${key}-hint`}>{hint}</small>}<div>{items.map((item) => <label key={item.value}><input className="sr-only" type="radio" name={key} value={item.value} checked={draft[key] === item.value} onChange={() => change(key, item.value)} required /><span>{item.label}</span></label>)}</div>{errors[key] && <p id={`${key}-error`} className="intake-field-error">{errors[key]}</p>}</fieldset>;
  }
  const submitLabel = !ready ? "Preparing form…" : pending ? phase === "uploading" ? "Uploading attachments…" : `Creating ${noun}…` : previewDone ? "Preview completed" : createdCase ? files.length ? "Retry attachments" : "Open saved case" : `Create ${noun}`;
  return <form ref={formRef} onSubmit={onSubmit} noValidate autoComplete="off" className="intake-v3" inert={!ready} aria-busy={!ready || pending}>
    <input type="hidden" name="linked_ticket_id" value={draft.linked_ticket_id} />
    <header className="intake-heading"><div><span className="intake-eyebrow">SUPPORT WORKSPACE</span><h2>Create {noun}</h2><p>Capture the problem. Give the team the context to solve it.</p></div><span className="intake-draft-badge">{createdCase ? "Saved" : "Unsaved draft"}</span></header>
    {linkedTicketId && <p className="intake-saved">New problem linked to case {linkedTicketId.slice(0,8)}…</p>}
    {createdCase && <div className="intake-saved" role="status"><Check size={18} /><div><strong>{createdCase.ticketNumber} is saved.</strong><p>{previewDone ? "Preview completed. No real case was created." : "Attachment retries stay on this same case."}</p></div><button type="button" disabled={pending || Boolean(preview)} onClick={leave}>Open saved case <ArrowUpRight size={14} /></button></div>}
    {configMissing && <p className="intake-alert" role="alert">Source or city options are unavailable. Ask an administrator to check the setup.</p>}
    {formError && <p className="intake-alert" role="alert"><AlertCircle size={16} />{formError}</p>}
    {errorEntries.length > 0 && <div className="intake-error-summary" role="alert"><strong>Check {errorEntries.length} field{errorEntries.length === 1 ? "" : "s"} before creating the {noun}.</strong><div>{errorEntries.map(([key]) => <button type="button" key={key} onClick={() => focusField(key)}>{INTAKE_LABELS[key]} <ArrowUpRight size={11} /></button>)}</div></div>}
    <div className="intake-layout"><fieldset className="intake-main" disabled={pending || Boolean(createdCase)}>
      <section className="intake-panel intake-routing" id="intake-routing"><header><span>01 / REPORTING</span><h3>Source & ownership</h3></header><div className="intake-grid">{sources ? select("source", sources.map(item => ({ value: item.code, label: item.code === "call_center" ? sourceLabel(item.code) : item.name }))) : <div className="intake-field"><span className="intake-fixed-label">Source <Lock size={12} /></span><div className="intake-fixed-source">{sourceLabel(lockedSource)}</div><small>Assigned to your account</small></div>}<div className="intake-date">{field("issue_date", { type: "date" })}<button type="button" onClick={() => change("issue_date", today)}>Use today</button></div></div>{sources?<div className="intake-grid intake-owner-select">{select("reporter_id",eligibleReporters.map(person=>({value:person.id,label:person.full_name})))}<p className="intake-owner"><small>{!source?"Select a source to see its team.":!eligibleReporters.length?"No active team members available for this source.":"Choose who reported this case. Technical Support remains responsible for the solution."}</small></p></div>:<div className="intake-owner"><span>Reporting owner</span><strong>Your signed-in account</strong><small>Your team’s source is applied automatically.</small></div>}</section>
      <section className="intake-panel" id="intake-customer"><header><span>02 / CUSTOMER</span><h3>Customer & account</h3></header><div className="intake-grid">{field("customer_name", { placeholder: "Customer’s full name" })}{field("credentials_username", { optional: true, placeholder: "Email or phone used to sign in", maxLength:160 })}{field("customer_phone", { type: "tel", optional: true, placeholder: "Number to contact the customer" })}{field("customer_email", { type: "email", optional: true, placeholder: "name@example.com" })}{select("end_user_type", END_USER_TYPES.map(type => ({ value: type, label: END_USER_TYPE_LABELS[type] })))}{select("city_id", cities.map(city => ({ value: String(city.id), label: city.name })))}{field("school_name", { optional: !schoolRequired, maxLength:160, placeholder: "School name" })}</div></section>
      <section className="intake-panel" id="intake-issue"><header><span>03 / THE PROBLEM</span><h3>What happened?</h3></header><div className="intake-grid"><FieldShell name="issue_description" error={errors.issue_description} wide hint="Include what happened and what the customer expected."><textarea id="issue_description" name="issue_description" dir="auto" rows={4} value={draft.issue_description} onChange={event => change("issue_description", event.target.value)} aria-invalid={Boolean(errors.issue_description)} aria-describedby={errors.issue_description ? "issue_description-error" : "issue_description-hint"} required placeholder="Describe the customer’s problem…" /></FieldShell></div></section>
      <section className="intake-panel" id="intake-app"><header><span>04 / APP & PAYMENT</span><h3>Technical context</h3><p>Choose Unknown when the customer hasn’t confirmed a detail.</p></header><div className="intake-grid">{choice("platform", PLATFORMS.map(platform => ({ value: platform, label: PLATFORM_LABELS[platform] })))}{choice("is_latest_version", [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }, { value:"unknown", label:"Unknown" }])}{choice("fawry_payment", [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }, { value:"unknown", label:"Unknown" }])}</div></section>
      <details className="intake-panel intake-more" open={moreOpen} onToggle={event => setMoreOpen(event.currentTarget.open)}><summary><Plus size={16} /><div><strong>Additional context</strong><span>Optional · device, app version & steps to reproduce</span></div></summary><div className="intake-grid">{field("device_type", { optional:true, maxLength:80, placeholder:"e.g. Samsung A32" })}{field("app_version", { optional:true, maxLength:20, placeholder:"e.g. 4.2.1" })}{field("page_screen", { optional:true, maxLength:160 })}<FieldShell name="steps" optional wide error={errors.steps}><textarea id="steps" name="steps" rows={3} dir="auto" maxLength={4000} value={draft.steps} onChange={event => change("steps", event.target.value)} aria-invalid={Boolean(errors.steps)} aria-describedby={errors.steps ? "steps-error" : undefined} /></FieldShell></div></details>
    </fieldset>
    <details className="intake-panel intake-evidence" open={evidenceOpen} onToggle={event => setEvidenceOpen(event.currentTarget.open)}><summary><UploadCloud size={18} /><div><strong>Attachments <b>{files.length}</b></strong><span>Optional · images, video, audio, PDF or Excel</span></div></summary><div className="intake-evidence-body"><label className={`intake-dropzone${pending || createdCase ? " is-disabled" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><UploadCloud size={25} /><strong>Drop files here or browse</strong><span>Up to 5 files · Images, audio, PDF & Excel: 10 MB · MP4 / MOV: 50 MB</span><input type="file" aria-label="Attach evidence" multiple accept={ATTACHMENT_RULES.accept} disabled={pending || Boolean(createdCase)} onChange={event => { addFiles(event.target.files); event.target.value=""; }} className="sr-only" /></label>{fileIssues.length > 0 && <ul className="intake-file-issues" role="alert">{fileIssues.map((issue,index) => <li key={index}>{issue}</li>)}</ul>}<div className="attachment-grid">{files.map(item=><LocalAttachmentPreview key={item.id} id={item.id} file={item.file} disabled={pending} remove={()=>setFiles(current=>current.filter(file=>file.id!==item.id))}/>)}</div></div></details>
    <aside className="intake-review"><div><span className="intake-eyebrow">BEFORE YOU SUBMIT</span><h3>{source ? sourceLabel(source) : "Case summary"}</h3><p>{filled} of {required.length} required fields ready</p><progress max={required.length} value={filled} aria-label="Valid required fields" /><ul>{groups.map(group => { const count=group.keys.filter(validField).length; return <li key={group.name}><a href={`#${group.target}`}>{count === group.keys.length ? <Check size={14} /> : <span className="intake-review-dot" />}{group.name}</a><span>{count} / {group.keys.length}</span></li>; })}</ul><dl className="intake-summary"><div><dt>Customer</dt><dd dir="auto">{draft.customer_name || "Not entered"}</dd></div><div><dt>Platform</dt><dd>{PLATFORM_LABELS[draft.platform as keyof typeof PLATFORM_LABELS] || "Not selected"}</dd></div><div><dt>Evidence</dt><dd>{files.length} file{files.length === 1 ? "" : "s"}</dd></div></dl><p className="intake-review-hint"><Lock size={13} />Your draft stays on this page until you leave. Submit to save it.</p>
      <div className="intake-actions"><div className="intake-mobile-progress">{filled} / {required.length} ready</div><button type="submit" className="intake-submit" disabled={!ready || pending || configMissing || previewDone}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{submitLabel}</button><button type="button" className="intake-cancel" disabled={pending || Boolean(preview && createdCase)} onClick={leave}><ArrowLeft size={14} />{createdCase ? "Open saved case" : "Back to queue"}</button></div><small className="intake-save-hint">{createdCase ? "Saved. Retrying never creates a duplicate." : "Required fields are marked. Contact details are optional."}</small>
    </div></aside></div>
  </form>;
}

function FieldShell({ name, children, optional, hint, error, wide }: { name: IntakeField; children: React.ReactNode; optional?: boolean; hint?: string; error?: string; wide?: boolean }) {
  return <div className={`intake-field${wide ? " intake-wide" : ""}`} data-intake-field={name}><label htmlFor={name}><span className="intake-label-text">{name === "credentials_username" ? <>Account credential <span className="intake-label-qualifier">(email or phone number)</span></> : INTAKE_LABELS[name]}</span><span className="intake-field-status">{optional ? "Optional" : "Required"}</span></label>{children}{hint && <small id={`${name}-hint`}>{hint}</small>}{error && <p id={`${name}-error`} className="intake-field-error">{error}</p>}</div>;
}
function InputField({ name, value, onChange, type = "text", error, optional, hint, placeholder, maxLength }: { name: IntakeField; value: string; onChange: (value: string) => void; type?: string; error?: string; optional?: boolean; hint?: string; placeholder?: string; maxLength?: number }) {
  return <FieldShell name={name} error={error} optional={optional} hint={hint}><input id={name} name={name} type={type} dir={type === "text" ? "auto" : "ltr"} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} value={value} onChange={(event) => onChange(event.target.value)} onInput={type === "date" ? (event) => onChange(event.currentTarget.value) : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} required={!optional} placeholder={placeholder} maxLength={maxLength} autoComplete="off" /></FieldShell>;
}
