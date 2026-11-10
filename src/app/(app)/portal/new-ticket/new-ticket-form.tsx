"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, FileImage, FileVideo, LoaderCircle, Lock, Plus, UploadCloud, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_RULES, ATTACHMENTS_BUCKET, END_USER_TYPE_LABELS, END_USER_TYPES, PLATFORM_LABELS, PLATFORMS } from "@/lib/tickets/constants";
import { APP_FIELDS, CUSTOMER_FIELDS, INTAKE_LABELS, checkIntakeFiles, initialIntakeDraft, uploadIntakeFiles, type IntakeField, type IntakeFile } from "@/lib/tickets/intake";
import { fieldErrorsOf, portalTicketSchema, supportTicketSchema, type PortalTicketFieldErrors, type SupportTicketInput } from "@/lib/tickets/schema";
import { createPortalTicket, createSupportTicket } from "./actions";
import "./intake.css";

type Props = { cities: { id: number; name: string }[]; sources?: { code: string; name: string; reporter_name?: string }[]; linkedTicketId?: string; today: string; cancelHref?: string; preview?: "failure" | "uploads" };
type CreatedCase = { ticketId: string; ticketNumber: string };
const optionalFields: IntakeField[] = ["school_name", "device_type", "app_version", "page_screen", "steps"];

export function NewTicketForm({ cities, sources, today, cancelHref = "/portal/my-tickets", preview, linkedTicketId = "" }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const allowLeave = useRef(false);
  const createdRef = useRef<CreatedCase | null>(null);
  const [initial] = useState(() => ({ ...initialIntakeDraft(today, sources?.length === 1 ? sources[0].code : ""), linked_ticket_id: linkedTicketId }));
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
  const groups = [
    { name: "Customer", keys: CUSTOMER_FIELDS, target: "intake-customer" },
    { name: "The issue", keys: ["issue_date", "issue_description", ...(sources ? ["source"] : [])] as IntakeField[], target: "intake-issue" },
    { name: "App & payment", keys: APP_FIELDS, target: "intake-app" },
  ];
  const required = groups.flatMap((group) => group.keys);
  const filled = required.filter((key) => draft[key].trim()).length;
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
    setDraft((current) => ({ ...current, [key]: value }));
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
      upload: async (path, file) => { const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type }); return { ok: !error, alreadyExists: String((error as { statusCode?: string } | null)?.statusCode) === "409" }; },
      record: async (path, file) => { const { error } = await supabase.from("ticket_attachments").insert({ ticket_id: created.ticketId, storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size }); return !error; },
    });
  }
  function onSubmit(event: FormEvent) {
    event.preventDefault(); if (!ready || inFlight.current || configMissing || previewDone) return;
    setFormError(""); const existing = createdRef.current;
    const submitted = { ...draft, ...Object.fromEntries([...new FormData(formRef.current!).entries()].filter(([, value]) => typeof value === "string")) };
    setDraft(submitted);
    if (!existing) { const check = (sources ? supportTicketSchema : portalTicketSchema).safeParse(submitted); if (!check.success) { showErrors(fieldErrorsOf(check.error)); return; } }
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
    return <fieldset className="intake-field intake-choice" data-intake-field={key} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined}><legend>{INTAKE_LABELS[key]} <span>Required</span></legend>{hint && <small id={`${key}-hint`}>{hint}</small>}<div>{items.map((item) => <label key={item.value}><input className="sr-only" type="radio" name={key} value={item.value} checked={draft[key] === item.value} onChange={() => change(key, item.value)} required /><span>{item.label}</span></label>)}</div>{errors[key] && <p id={`${key}-error`} className="intake-field-error">{errors[key]}</p>}</fieldset>;
  }
  return <form ref={formRef} onSubmit={onSubmit} noValidate autoComplete="off" className="intake-v3" inert={!ready} aria-busy={!ready || pending}>
    <input type="hidden" name="linked_ticket_id" value={draft.linked_ticket_id} /><header className="intake-heading"><span className="intake-eyebrow">WORKSPACE / CREATE A CASE</span><h2>Good support starts here<span>.</span></h2><p>One page. The essential details first. Add more context when it helps.</p></header>
    {linkedTicketId && <p className="intake-saved">New problem linked to case {linkedTicketId.slice(0,8)}… — the original case stays separate.</p>}
    {sources && <p className="intake-review-hint">Reporting owner: <strong>{sources.find(source => source.code === draft.source)?.reporter_name || "Choose a source"}</strong> · Recorded by your signed-in account on their behalf. Notifications go to Ahmed only during rollout.</p>}
    {createdCase && <div className="intake-saved" role="status"><Check size={18} /><div><strong>{createdCase.ticketNumber} is saved.</strong><p>{previewDone ? "Preview completed. No real case was created." : "Attachment retries stay on this same case."}</p></div><button type="button" disabled={pending || Boolean(preview)} onClick={leave}>Open saved case <ArrowUpRight size={14} /></button></div>}
    {configMissing && <p className="intake-alert" role="alert">Required source or city options are unavailable. Ask an administrator to check the setup.</p>}
    {errorEntries.length > 0 && <div className="intake-error-summary" role="alert"><strong>Check {errorEntries.length} field{errorEntries.length === 1 ? "" : "s"} before creating the case.</strong><div>{errorEntries.map(([key]) => <button type="button" key={key} onClick={() => focusField(key)}>{INTAKE_LABELS[key]} <ArrowUpRight size={11} /></button>)}</div></div>}
    <div className="intake-layout"><fieldset className="intake-main" disabled={pending || Boolean(createdCase)}>
      <section className="intake-panel" id="intake-customer"><header><span>01 / THE PERSON</span><h3>Who needs help?</h3><p>Customer details only. Phone is optional; the account username helps the team find the right account.</p></header><div className="intake-grid">{field("customer_name", { placeholder: "Customer’s full name" })}{field("customer_email", { type: "email", placeholder: "name@example.com" })}{field("customer_phone", { type: "tel", optional: true, placeholder: "e.g. 0100 123 4567" })}{field("credentials_username", { hint: "Username only. Never enter a password.", placeholder: "Student / teacher account username" })}{select("end_user_type", END_USER_TYPES.map((type) => ({ value: type, label: END_USER_TYPE_LABELS[type] })))}{select("city_id", cities.map((city) => ({ value: String(city.id), label: city.name })))}</div></section>
      <section className="intake-panel" id="intake-issue"><header><span>02 / THE ISSUE</span><h3>What happened?</h3><p>Capture the source, reported date and the customer’s actual problem.</p></header><div className="intake-grid">{sources && select("source", sources.map((source) => ({ value: source.code, label: source.name })))}{select("contact_channel", [{value:"unspecified",label:"Not recorded"},{value:"email",label:"Email"},{value:"phone",label:"Phone"},{value:"whatsapp",label:"WhatsApp"},{value:"form",label:"Form"},{value:"google_play",label:"Google Play"}], true)}<div className="intake-date">{field("issue_date", { type: "date" })}<button type="button" onClick={() => change("issue_date", today)}>Use today</button></div><FieldShell name="issue_description" error={errors.issue_description} wide hint="Describe the symptom and what the customer expected."><textarea id="issue_description" name="issue_description" dir="auto" rows={5} value={draft.issue_description} onChange={(event) => change("issue_description", event.target.value)} aria-invalid={Boolean(errors.issue_description)} aria-describedby={errors.issue_description ? "issue_description-error" : "issue_description-hint"} required /><small className="intake-character-note">{draft.issue_description.trim().length} characters · minimum 5</small></FieldShell></div></section>
      <section className="intake-panel" id="intake-app"><header><span>03 / APP & PAYMENT</span><h3>A little context goes a long way.</h3><p>Choose what was confirmed. Fawry is a case flag, not a payment verification.</p></header><div className="intake-grid">{choice("platform", PLATFORMS.map((platform) => ({ value: platform, label: PLATFORM_LABELS[platform] })))}{choice("is_latest_version", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }])}{choice("fawry_payment", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }])}</div></section>
      <details className="intake-panel intake-more" open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)}><summary><Plus size={16} /><div><strong>More details</strong><span>Optional · school, device, app version & reproduction steps</span></div></summary><div className="intake-grid">{field("school_name", { optional: true, maxLength: 160 })}{field("device_type", { optional: true, maxLength: 80, placeholder: "e.g. Samsung A32, iPhone 12" })}{field("app_version", { optional: true, maxLength: 20, placeholder: "e.g. 4.2.1" })}{field("page_screen", { optional: true, maxLength: 160, placeholder: "e.g. Subscriptions → Payment status" })}<FieldShell name="steps" optional wide error={errors.steps}><textarea id="steps" name="steps" rows={4} dir="auto" maxLength={4000} value={draft.steps} onChange={(event) => change("steps", event.target.value)} aria-invalid={Boolean(errors.steps)} aria-describedby={errors.steps ? "steps-error" : undefined} /></FieldShell></div></details>
    </fieldset>
    <details className="intake-panel intake-evidence" open={evidenceOpen} onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}><summary><UploadCloud size={18} /><div><strong>Attachments <b>{files.length}</b></strong><span>Optional · screenshots or short videos</span></div></summary><div className="intake-evidence-body"><label className={`intake-dropzone${pending || createdCase ? " is-disabled" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><UploadCloud size={25} /><strong>Drop files here or browse</strong><span>Up to 5 files · JPG / PNG: 10 MB · MP4 / MOV: 50 MB</span><input type="file" aria-label="Attach evidence" multiple accept={ATTACHMENT_RULES.accept} disabled={pending || Boolean(createdCase)} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} className="sr-only" /></label>{fileIssues.length > 0 && <ul className="intake-file-issues" role="alert">{fileIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}<ul className="intake-file-list">{files.map((item) => <li key={item.id}>{item.file.type.startsWith("video/") ? <FileVideo size={16} /> : <FileImage size={16} />}<div><strong>{item.file.name}</strong><span>{formatSize(item.file.size)} · {createdCase ? "Needs upload" : "Ready to attach"}</span></div><button type="button" disabled={pending} aria-label={`Remove ${item.file.name}`} onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}><X size={15} /></button></li>)}</ul></div></details>
<aside className="intake-review"><div><span className="intake-eyebrow">READY TO HAND OVER</span><h3>Keep it clear.</h3><p>{filled} of {required.length} required fields filled.</p><progress max={required.length} value={filled} aria-label="Required fields filled" /><ul>{groups.map((group) => { const count = group.keys.filter((key) => draft[key].trim()).length; return <li key={group.name}><a href={`#${group.target}`}>{count === group.keys.length ? <Check size={13} /> : <span className="intake-review-dot" />}{group.name}</a><span>{count} / {group.keys.length}</span></li>; })}</ul><p className="intake-review-hint"><Lock size={13} />Your entries stay in this page until you leave. They are not saved as a case until you submit.</p>
      {formError && <p className="intake-alert" role="alert"><AlertCircle size={14} />{formError}</p>}
      <button type="submit" className="intake-submit" disabled={!ready || pending || configMissing || previewDone}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{!ready ? "Preparing form…" : pending ? phase === "uploading" ? "Uploading attachments…" : "Creating case…" : previewDone ? "Preview completed" : createdCase ? files.length ? "Retry attachments" : "Open saved case" : "Create case"}</button><button type="button" className="intake-cancel" disabled={pending || Boolean(preview && createdCase)} onClick={leave}><ArrowLeft size={13} />{createdCase ? "Open saved case" : "Back to queue"}</button><small className="intake-save-hint">{createdCase ? "Case already created. Retrying never opens a second case." : dirty ? "Draft not submitted" : "No new case created yet"}</small>
    </div></aside>
    </div>
  </form>;
}
function FieldShell({ name, children, optional, hint, error, wide }: { name: IntakeField; children: React.ReactNode; optional?: boolean; hint?: string; error?: string; wide?: boolean }) {
  return <div className={`intake-field${wide ? " intake-wide" : ""}`} data-intake-field={name}><label htmlFor={name}>{INTAKE_LABELS[name]}<span>{optional ? "Optional" : "Required"}</span></label>{hint && <small id={`${name}-hint`}>{hint}</small>}{children}{error && <p id={`${name}-error`} className="intake-field-error">{error}</p>}</div>;
}
function InputField({ name, value, onChange, type = "text", error, optional, hint, placeholder, maxLength }: { name: IntakeField; value: string; onChange: (value: string) => void; type?: string; error?: string; optional?: boolean; hint?: string; placeholder?: string; maxLength?: number }) {
  return <FieldShell name={name} error={error} optional={optional} hint={hint}><input id={name} name={name} type={type} dir={type === "text" ? "auto" : "ltr"} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} value={value} onChange={(event) => onChange(event.target.value)} onInput={type === "date" ? (event) => onChange(event.currentTarget.value) : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} required={!optional} placeholder={placeholder} maxLength={maxLength} autoComplete="off" /></FieldShell>;
}
function formatSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`; }
