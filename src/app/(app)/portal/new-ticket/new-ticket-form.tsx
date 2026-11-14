"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, LoaderCircle, Lock, Plus, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_RULES, ATTACHMENTS_BUCKET, END_USER_TYPE_LABELS, END_USER_TYPES, PLATFORM_LABELS, PLATFORMS, sourceLabel } from "@/lib/tickets/constants";
import { INTAKE_LABELS, attachmentMime, checkIntakeFiles, initialIntakeDraft, uploadIntakeFiles, type IntakeField, type IntakeFile } from "@/lib/tickets/intake";
import { intakeDraftErrors, needsSchool, type PortalTicketFieldErrors, type SupportTicketInput } from "@/lib/tickets/schema";
import { createPortalTicket, createSupportTicket } from "./actions";
import "./intake.css";
import { SCHOOL_ISSUE_AREAS, SCHOOL_IMPACTS } from "@/lib/tickets/school-context";
import { LocalAttachmentPreview } from "@/components/tickets/attachment-preview";

type Props = { cities: { id: number; name: string }[]; lockedSource?: string; sources?: { code: string; name: string; reporter_name?: string; default_reporter_id?:string|null; bound_role?:string|null }[]; reporters?:{id:string;full_name:string;role:string}[]; linkedTicketId?: string; today: string; cancelHref?: string; preview?: "failure" | "uploads" | "success" };
type CreatedCase = { ticketId: string; ticketNumber: string };
const optionalFields: IntakeField[] = [ "device_type", "app_version", "page_screen", "steps"];

export function NewTicketForm({ cities, sources, reporters=[], lockedSource = "call_center", today, cancelHref = "/portal/my-tickets", preview, linkedTicketId = "" }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const allowLeave = useRef(false);
  const createdRef = useRef<CreatedCase | null>(null);
  const [initial,setInitial] = useState(() => ({ ...initialIntakeDraft(today, sources?.length === 1 ? sources[0].code : ""), reporter_id:sources?.length===1?sources[0].default_reporter_id||"":"", linked_ticket_id: linkedTicketId }));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<PortalTicketFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [fileIssues, setFileIssues] = useState<string[]>([]);
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [createdCase, setCreatedCase] = useState<CreatedCase | null>(null);
  const submitMode=useRef<"open"|"another">("open");
  const [batchMessage,setBatchMessage]=useState("");
  const [contactOpen,setContactOpen]=useState(false);
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
  const invalid=intakeDraftErrors(draft,source,Boolean(sources));
  const validField=(key:IntakeField)=>Boolean(draft[key]?.trim())&&!invalid[key];
  const june=source==="june_schools";
  const groups=[
    {name:"Reporting",keys:["issue_date",...(sources?["source","reporter_id"]:[])] as IntakeField[],target:"intake-routing"},
    {name:"The problem",keys:["issue_description"] as IntakeField[],target:"intake-issue"},
    {name:"Customer",keys:["customer_name","end_user_type","city_id",...(schoolRequired&&!june?["school_name"]:[])] as IntakeField[],target:"intake-customer"},
    ...(june?[{name:"30 June school",keys:["school_name"] as IntakeField[],target:"intake-school"}]:[]),
    {name:"Technical context",keys:["platform",...(draft.platform==="web"?[]:["is_latest_version"]),"fawry_payment"] as IntakeField[],target:"intake-app"},
  ];
  const required = groups.flatMap((group) => group.keys);
  const filled = required.filter((key) => validField(key)).length;
  const configMissing = !cities.length || (sources !== undefined && !sources.length);
  const order:IntakeField[]=["source","reporter_id","issue_date","issue_description","customer_name","end_user_type","city_id","credentials_username","customer_phone","customer_email","school_name","school_code","school_user_ids","school_issue_area","school_impact","school_section","school_expected_grade","school_shown_grade","school_subject","platform","is_latest_version","fawry_payment",...optionalFields];
  const errorEntries=(Object.entries(errors) as [IntakeField,string][]).sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));
  const missing=required.filter(key=>!validField(key));

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
    setErrors((current) => { const next = { ...current }; delete next[key]; if(key==="source"){delete next.reporter_id;delete next.school_name;}if(key==="platform")delete next.is_latest_version; return next; }); setFormError("");
  }
  function focusField(key: IntakeField) {
    if (optionalFields.includes(key)) setMoreOpen(true);
    if (key==="customer_email"||(key==="school_name"&&!schoolRequired))setContactOpen(true);
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>(`[data-intake-field="${key}"]`);
      field?.querySelector<HTMLElement>("input,textarea,select")?.focus({ preventScroll: true });
      field?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    });
  }
  function showErrors(next: PortalTicketFieldErrors) { setErrors(next); const first=order.find(key=>next[key]); if (first) focusField(first); }
  const savedHref = (created: CreatedCase) => sources ? `/tickets/${created.ticketId}?returnTo=${encodeURIComponent(cancelHref)}` : `/portal/my-tickets/${created.ticketId}`;
  function finish(created: CreatedCase) {
    if(submitMode.current==="another"){
      const seed={...initialIntakeDraft(today,source),reporter_id:draft.reporter_id,issue_date:draft.issue_date};
      setInitial(seed);setDraft(seed);setFiles([]);setErrors({});setFormError("");setFileIssues([]);setCreatedCase(null);createdRef.current=null;requestId.current=null;setPreviewDone(false);setContactOpen(false);setMoreOpen(false);setEvidenceOpen(false);allowLeave.current=false;
      setBatchMessage(preview?"Preview complete. Ready for another case; no record was created.":created.ticketNumber+" created. Ready for another case.");
      requestAnimationFrame(()=>document.getElementById("issue_description")?.focus());return;
    }
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
    if(!existing){const next=intakeDraftErrors(submitted,source,Boolean(sources));if(Object.keys(next).length){showErrors(next);return;}submitMode.current=(event.nativeEvent as SubmitEvent).submitter?.getAttribute("value")==="another"?"another":"open";setBatchMessage("");}
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
  function select(key: IntakeField, items: readonly { value: string; label: string }[], optional = false, disabled=false) {
    return <FieldShell name={key} error={errors[key]} optional={optional}><select id={key} name={key} value={draft[key]} disabled={disabled} onChange={(event) => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} required={!optional}><option value="">Choose…</option>{items.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></FieldShell>;
  }
  function choice(key: IntakeField, items: { value: string; label: string }[], hint?: string) {
    return <fieldset className="intake-field intake-choice" data-intake-field={key} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined}><legend><span className="intake-label-text">{INTAKE_LABELS[key]}</span><span className="intake-field-status">Required</span></legend>{hint && <small id={`${key}-hint`}>{hint}</small>}<div>{items.map((item) => <label key={item.value}><input className="sr-only" type="radio" name={key} value={item.value} checked={draft[key] === item.value} onChange={() => change(key, item.value)} required /><span>{item.label}</span></label>)}</div>{errors[key] && <p id={`${key}-error`} className="intake-field-error">{errors[key]}</p>}</fieldset>;
  }
  const submitLabel = !ready ? "Preparing form…" : pending ? phase === "uploading" ? "Uploading attachments…" : `Creating ${noun}…` : previewDone ? "Preview completed" : createdCase ? files.length ? "Retry attachments" : "Open saved case" : `Create ${noun}`;
  return <form ref={formRef} onSubmit={onSubmit} noValidate autoComplete="off" className="intake-v3 intake-v4" inert={!ready} aria-busy={!ready || pending}>
    <input type="hidden" name="linked_ticket_id" value={draft.linked_ticket_id}/>
    <header className="intake-heading"><div><span className="intake-eyebrow">SUPPORT WORKSPACE</span><h2>Create {noun}</h2><p>Record the problem. Keep the next step clear.</p></div><span className="intake-draft-badge">{createdCase?"Saved":"Not saved"}</span></header>
    {batchMessage&&<p className="intake-saved" role="status"><Check size={17}/>{batchMessage}</p>}
    {linkedTicketId&&<p className="intake-saved">New problem linked to case {linkedTicketId.slice(0,8)}…</p>}
    {createdCase&&<div className="intake-saved" role="status"><Check size={18}/><div><strong>{createdCase.ticketNumber} is saved.</strong><p>{previewDone?"Preview complete. No real record was created.":"Attachment retries use this same case."}</p></div><button type="button" disabled={pending||Boolean(preview)} onClick={leave}>Open saved {noun}<ArrowUpRight size={14}/></button></div>}
    {configMissing&&<p className="intake-alert" role="alert">Source or city options are unavailable. Ask an administrator to check the setup.</p>}
    {formError&&<p className="intake-alert" role="alert"><AlertCircle size={16}/>{formError}</p>}
    {errorEntries.length>0&&<div className="intake-error-summary" role="alert"><strong>Check {errorEntries.length} field{errorEntries.length===1?"":"s"} before creating the {noun}.</strong><div>{errorEntries.map(([key,message])=><button type="button" key={key} onClick={()=>focusField(key)} aria-label={`${INTAKE_LABELS[key]}: ${message}`}>{INTAKE_LABELS[key]}<ArrowUpRight size={11}/></button>)}</div></div>}
    <fieldset className="intake-panel intake-routing" id="intake-routing" disabled={pending||Boolean(createdCase)}><legend className="sr-only">Reporting details</legend><div className="intake-grid intake-routing-grid">
      {sources?select("source",sources.map(item=>({value:item.code,label:item.code==="call_center"?sourceLabel(item.code):item.name}))):<div className="intake-field"><span className="intake-fixed-label">Source <Lock size={12}/></span><div className="intake-fixed-source">{sourceLabel(lockedSource)}</div><small>Fixed to your account</small></div>}
      {sources?select("reporter_id",eligibleReporters.map(person=>({value:person.id,label:person.full_name})),false,!source):<div className="intake-field"><span className="intake-fixed-label">Reported by <Lock size={12}/></span><div className="intake-fixed-source">Your signed-in account</div></div>}
      <div className="intake-date">{field("issue_date",{type:"date"})}<button type="button" disabled={pending||Boolean(createdCase)} onClick={()=>change("issue_date",today)}>Today</button></div>
    </div><p className="intake-routing-hint">{sources?!source?"Choose the source to see its reporting team.":!eligibleReporters.length?"No active reporting owners are available for this source.":`Reported by ${eligibleReporters.find(person=>person.id===draft.reporter_id)?.full_name||"the selected team member"}. Resolution team: Technical Support.`:"Your source and reporting owner are applied automatically. Technical Support handles the solution."}</p></fieldset>
    <div className="intake-layout"><fieldset className="intake-main" disabled={pending||Boolean(createdCase)}>
      <section className="intake-panel" id="intake-issue"><header><span>01 / THE PROBLEM</span><h3>What happened?</h3></header><div className="intake-grid"><FieldShell name="issue_description" error={errors.issue_description} wide hint="What happened, and what did the customer expect?"><textarea id="issue_description" name="issue_description" dir="auto" rows={3} maxLength={8000} value={draft.issue_description} onChange={event=>change("issue_description",event.target.value)} aria-invalid={Boolean(errors.issue_description)} aria-describedby={errors.issue_description?"issue_description-error":"issue_description-hint"} required placeholder="Describe the problem…"/></FieldShell></div>
        <details className="intake-evidence" open={evidenceOpen} onToggle={event=>setEvidenceOpen(event.currentTarget.open)}><summary><UploadCloud size={17}/><div><strong>Attachments <b>{files.length}</b></strong><span>Images · video · audio · PDF · Excel</span></div></summary><div className="intake-evidence-body"><label className={`intake-dropzone${pending||createdCase?" is-disabled":""}`} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();addFiles(event.dataTransfer.files);}}><UploadCloud size={22}/><strong>Add files or drop them here</strong><span>Up to 5 files · Images, audio, PDF & Excel: 10 MB · Video: 50 MB</span><input type="file" aria-label="Attach evidence" multiple accept={ATTACHMENT_RULES.accept} disabled={pending||Boolean(createdCase)} onChange={event=>{addFiles(event.target.files);event.target.value="";}} className="sr-only"/></label>{fileIssues.length>0&&<ul className="intake-file-issues" role="alert">{fileIssues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>}<div className="attachment-grid">{files.map(item=><LocalAttachmentPreview key={item.id} id={item.id} file={item.file} disabled={pending} remove={()=>setFiles(current=>current.filter(file=>file.id!==item.id))}/>)}</div></div></details>
      </section>
      <section className="intake-panel" id="intake-customer"><header><span>02 / CUSTOMER</span><h3>Customer & account</h3></header><div className="intake-grid">{field("customer_name",{placeholder:"Customer’s name"})}{select("end_user_type",END_USER_TYPES.map(type=>({value:type,label:END_USER_TYPE_LABELS[type]})))}{select("city_id",cities.map(city=>({value:String(city.id),label:city.name})))}{field("credentials_username",{optional:true,placeholder:"Email or phone used to sign in",maxLength:160})}{field("customer_phone",{type:"tel",optional:true,placeholder:"Number to reach the customer"})}{schoolRequired&&!june&&field("school_name",{maxLength:160,placeholder:"School name"})}</div>
        <details className="intake-more intake-contact" open={contactOpen} onToggle={event=>setContactOpen(event.currentTarget.open)}><summary><Plus size={15}/><div><strong>Extra contact details</strong><span>Optional · contact email{!schoolRequired?" & school":""}</span></div></summary><div className="intake-grid">{field("customer_email",{type:"email",optional:true,placeholder:"name@example.com"})}{!schoolRequired&&field("school_name",{optional:true,maxLength:160,placeholder:"School name"})}</div></details>
      </section>
      {june&&<section className="intake-panel intake-school" id="intake-school"><header><span>30 JUNE / MYSCHOOL</span><h3>School case details</h3><p>Use the school and MySchool account codes. Add only details you have confirmed.</p></header><div className="intake-grid">
        {field("school_name",{maxLength:160,placeholder:"School’s full name"})}{field("school_code",{optional:true,maxLength:80,placeholder:"e.g. 110"})}
        {field("school_user_ids",{optional:true,maxLength:600,placeholder:"One ID or several IDs separated by commas"})}{select("school_impact",SCHOOL_IMPACTS,true)}
        {select("school_issue_area",SCHOOL_ISSUE_AREAS,true)}{field("school_section",{optional:true,maxLength:80,placeholder:"Arabic / Languages / school section"})}
        {draft.school_issue_area==="grade"&&<>{field("school_expected_grade",{optional:true,maxLength:80,placeholder:"The grade the account should show"})}{field("school_shown_grade",{optional:true,maxLength:80,placeholder:"The grade currently shown"})}</>}
        {["content","assessment"].includes(draft.school_issue_area)&&<>{field("school_expected_grade",{optional:true,maxLength:80,placeholder:"Affected grade / stage"})}{field("school_subject",{optional:true,maxLength:160,placeholder:"Subject, lesson or assessment"})}</>}
      </div></section>}
      <section className="intake-panel" id="intake-app"><header><span>03 / TECHNICAL CONTEXT</span><h3>App & payment</h3></header><div className="intake-grid">{choice("platform",PLATFORMS.map(platform=>({value:platform,label:PLATFORM_LABELS[platform]})))}{draft.platform==="web"?<p className="intake-not-applicable">Web selected · installed app version does not apply.</p>:choice("is_latest_version",[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"Unknown"}])}{choice("fawry_payment",[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"Unknown"}])}</div>
        <details className="intake-more" open={moreOpen} onToggle={event=>setMoreOpen(event.currentTarget.open)}><summary><Plus size={15}/><div><strong>Device & reproduction details</strong><span>Optional · device, version, screen & steps</span></div></summary><div className="intake-grid">{field("device_type",{optional:true,maxLength:80,placeholder:"e.g. Samsung A32"})}{draft.platform!=="web"&&field("app_version",{optional:true,maxLength:20,placeholder:"e.g. 4.2.1"})}{field("page_screen",{optional:true,maxLength:160,placeholder:"Affected page or screen"})}<FieldShell name="steps" optional wide error={errors.steps}><textarea id="steps" name="steps" rows={3} dir="auto" maxLength={4000} value={draft.steps} onChange={event=>change("steps",event.target.value)} aria-invalid={Boolean(errors.steps)}/></FieldShell></div></details>
      </section>
    </fieldset>
    <aside className="intake-review"><div><span className="intake-eyebrow">READY TO CREATE?</span><h3>{source?sourceLabel(source):"Case review"}</h3><p>{filled} / {required.length} required fields ready</p><progress max={required.length} value={filled} aria-label="Valid required fields"/><ul>{groups.map(group=>{const count=group.keys.filter(validField).length;return <li key={group.name}><a href={`#${group.target}`}>{count===group.keys.length?<Check size={13}/>:<span className="intake-review-dot"/>}{group.name}</a><span>{count} / {group.keys.length}</span></li>;})}</ul>
      {missing.length>0&&<div className="intake-missing"><span>Still needed</span>{missing.slice(0,4).map(key=><button type="button" key={key} onClick={()=>focusField(key)}>{INTAKE_LABELS[key]}<ArrowUpRight size={12}/></button>)}{missing.length>4&&<small>+{missing.length-4} more required fields</small>}</div>}
      <p className="intake-review-hint"><Lock size={13}/>Not saved until you submit. Your entries stay here if saving fails.</p>
      <div className="intake-actions"><div className="intake-mobile-progress">{filled} / {required.length} ready</div><button type="submit" value="open" className="intake-submit" disabled={!ready||pending||configMissing||previewDone}>{pending?<LoaderCircle size={16} className="animate-spin"/>:<Plus size={16}/>} {submitLabel}</button><button type="button" className="intake-cancel" disabled={pending||Boolean(preview&&createdCase)} onClick={leave}><ArrowLeft size={14}/>{createdCase?`Open saved ${noun}`:"Back to cases"}</button></div>
      {sources&&!createdCase&&<button className="intake-create-another" type="submit" value="another" disabled={!ready||pending||configMissing}>Create & add another</button>}
      <small className="intake-save-hint">{createdCase?"Retries use the saved case.":"Account and contact details are optional."}</small>
    </div></aside></div>
  </form>;

}

function FieldShell({ name, children, optional, hint, error, wide }: { name: IntakeField; children: React.ReactNode; optional?: boolean; hint?: string; error?: string; wide?: boolean }) {
  return <div className={`intake-field${wide ? " intake-wide" : ""}`} data-intake-field={name}><label htmlFor={name}><span className="intake-label-text">{name === "credentials_username" ? <>Account identifier <span className="intake-label-qualifier">(email or phone number)</span></> : INTAKE_LABELS[name]}</span><span className="intake-field-status">{optional ? "Optional" : "Required"}</span></label>{children}{hint && <small id={`${name}-hint`}>{hint}</small>}{error && <p id={`${name}-error`} className="intake-field-error">{error}</p>}</div>;
}
function InputField({ name, value, onChange, type = "text", error, optional, hint, placeholder, maxLength }: { name: IntakeField; value: string; onChange: (value: string) => void; type?: string; error?: string; optional?: boolean; hint?: string; placeholder?: string; maxLength?: number }) {
  return <FieldShell name={name} error={error} optional={optional} hint={hint}><input id={name} name={name} type={type} dir={type === "text" ? "auto" : "ltr"} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} value={value} onChange={(event) => onChange(event.target.value)} onInput={type === "date" ? (event) => onChange(event.currentTarget.value) : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} required={!optional} placeholder={placeholder} maxLength={maxLength} autoComplete="off" /></FieldShell>;
}
