import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileImage, FileVideo, Lock, Shield } from "lucide-react";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  ATTACHMENTS_BUCKET,
  END_USER_TYPE_LABELS,
  PLATFORM_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type TicketSource,
  type TicketStatus,
} from "@/lib/tickets/constants";
import { addTicketNote, saveResolution } from "../actions";
import { CopyTicketNumber, CredentialsValue, TicketControls } from "./ticket-controls";

export default async function AgentTicketPage({
  params,
  searchParams,
}: PageProps<"/tickets/[ticketId]">) {
  const user = await requireUser(["support_agent", "manager"]);
  const { ticketId } = await params;
  const { error: errorMessage } = await searchParams;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      `id, ticket_number, status, source, created_at, customer_name, customer_email, customer_phone, school_name,
       credentials_username, issue_date, end_user_type, fawry_payment, platform, is_latest_version, app_version,
       device_type, page_screen, steps, issue_description, assignee_id, issue_category_id, root_cause_id,
       action_taken, resolution_notes, cities(name),
       creator:profiles!tickets_created_by_fkey(full_name)`,
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) notFound();

  const [history, attachments, notes, agents, categories, causes] = await Promise.all([
    supabase
      .from("ticket_status_history")
      .select("id, from_status, to_status, changed_at, actor:profiles!ticket_status_history_changed_by_fkey(full_name)")
      .eq("ticket_id", ticket.id)
      .order("changed_at", { ascending: false }),
    supabase.from("ticket_attachments").select("id, file_name, mime_type, storage_path").eq("ticket_id", ticket.id),
    supabase
      .from("ticket_notes")
      .select("id, body, created_at, author:profiles!ticket_notes_author_id_fkey(full_name)")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("role", "support_agent").eq("is_active", true).order("full_name"),
    supabase.from("issue_categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("root_causes").select("id, name").eq("is_active", true).order("name"),
  ]);
  for (const result of [history, attachments, notes, agents, categories, causes]) {
    if (result.error) throw result.error;
  }

  const signed = attachments.data?.length
    ? await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(
        attachments.data.map((file) => file.storage_path),
        60 * 10,
      )
    : { data: [] };
  const urlByPath = new Map(signed.data?.map((file) => [file.path, file.signedUrl]));

  const status = ticket.status as TicketStatus;
  const locked = status === "closed" || user.role !== "support_agent";
  const city = nameOf(ticket.cities);
  const creator = nameOf(ticket.creator);
  const version = `${ticket.app_version ?? "—"}${ticket.is_latest_version === false ? " (not latest)" : ""}`;

  const fields: [string, React.ReactNode][] = [
    ["Customer name", ticket.customer_name],
    ["Email", ticket.customer_email ?? "—"],
    ["User type", ticket.end_user_type ? END_USER_TYPE_LABELS[ticket.end_user_type as keyof typeof END_USER_TYPE_LABELS] : "—"],
    ["School", ticket.school_name ?? "—"],
    ["City", city || "—"],
    ["Date of issue", ticket.issue_date ? formatDate(ticket.issue_date) : "—"],
    ["Platform", ticket.platform ? PLATFORM_LABELS[ticket.platform as keyof typeof PLATFORM_LABELS] : "—"],
    ["Device", ticket.device_type ?? "—"],
    ["App version", version],
    ["Fawry payment", ticket.fawry_payment == null ? "—" : ticket.fawry_payment ? "Yes" : "No"],
    ["Page / screen", ticket.page_screen ?? "—"],
    ["Phone", ticket.customer_phone ?? "—"],
  ];

  return (
    <AgentFrame title="Ticket details">
      <div className="flex flex-col gap-4 border-b bg-background px-5 py-4 sm:px-8">
        <nav className="flex items-center gap-1.5 text-[13px]">
          <Link href="/tickets" className="font-medium text-muted-foreground hover:text-foreground">Tickets</Link>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span className="font-mono font-medium">{ticket.ticket_number}</span>
          <CopyTicketNumber value={ticket.ticket_number} />
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">{ticket.issue_description}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="size-3.5 text-status-awaiting" />
                {SOURCE_LABELS[ticket.source as TicketSource]}
                {creator ? ` · by ${creator}` : ""}
              </span>
              <span>Created {formatDateTime(ticket.created_at)}</span>
            </p>
          </div>
          {user.role === "support_agent" ? (
            <TicketControls
              ticketId={ticket.id}
              ticketNumber={ticket.ticket_number}
              status={status}
              assigneeId={ticket.assignee_id}
              agents={agents.data ?? []}
              locked={status === "closed"}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{STATUS_LABELS[status]} · read-only</p>
          )}
        </div>
        {typeof errorMessage === "string" && (
          <p role="alert" className="rounded-lg border border-[#f3c7c9] bg-[#fdecec] px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {status === "closed" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            Closed tickets can&apos;t be edited. Create a follow-up ticket instead.
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_320px] sm:px-8">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border bg-background p-6">
            <h3 className="text-base font-semibold">Reported details</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {fields.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Lock className="size-3" /> User name (sensitive)
                </dt>
                <dd>
                  {ticket.credentials_username ? <CredentialsValue value={ticket.credentials_username} /> : "—"}
                </dd>
              </div>
            </dl>
            <hr className="my-5" />
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Issue description</p>
              <p className="text-sm leading-6 whitespace-pre-wrap">{ticket.issue_description}</p>
            </div>
            {ticket.steps && (
              <div className="mt-4 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Steps</p>
                <p className="text-sm leading-6 whitespace-pre-wrap">{ticket.steps}</p>
              </div>
            )}
            {attachments.data && attachments.data.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {attachments.data.map((file) => {
                  const Icon = file.mime_type.startsWith("video/") ? FileVideo : FileImage;
                  return (
                    <a
                      key={file.id}
                      href={urlByPath.get(file.storage_path) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium hover:bg-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {file.file_name}
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-background p-6">
            <h3 className="text-base font-semibold">Internal notes</h3>
            <p className="mt-1 text-xs text-muted-foreground">Only the Support team can see these.</p>
            <ul className="mt-4 flex flex-col gap-3">
              {(notes.data ?? []).map((note) => (
                <li key={note.id} className="rounded-lg bg-muted px-3 py-2.5">
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nameOf(note.author) || "Support"} · {formatRelative(note.created_at)}
                  </p>
                </li>
              ))}
              {notes.data?.length === 0 && <li className="text-sm text-muted-foreground">No internal notes yet.</li>}
            </ul>
            {user.role === "support_agent" && !locked && (
              <form action={addTicketNote} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Add an internal note"
                  className="rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                />
                <button type="submit" className="h-9 self-start rounded-lg bg-brand-action px-3 text-sm font-semibold text-white">
                  Add note
                </button>
              </form>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border bg-background p-5">
            <h3 className="text-base font-semibold">Resolution</h3>
            <form action={saveResolution} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Field label="Issue category">
                <select name="issueCategoryId" defaultValue={ticket.issue_category_id ?? ""} disabled={locked} className="h-9 rounded-lg border bg-background px-3 text-sm">
                  <option value="">Select</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Root cause">
                <select name="rootCauseId" defaultValue={ticket.root_cause_id ?? ""} disabled={locked} className="h-9 rounded-lg border bg-background px-3 text-sm">
                  <option value="">Select</option>
                  {(causes.data ?? []).map((cause) => (
                    <option key={cause.id} value={cause.id}>{cause.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Action taken">
                <textarea name="actionTaken" defaultValue={ticket.action_taken ?? ""} disabled={locked} rows={3} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Resolution notes">
                <textarea name="resolutionNotes" defaultValue={ticket.resolution_notes ?? ""} disabled={locked} rows={3} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>
              {!locked && (
                <button type="submit" className="h-9 rounded-lg bg-brand-action text-sm font-semibold text-white">
                  Save changes
                </button>
              )}
            </form>
          </section>

          <section className="rounded-xl border bg-background p-5">
            <h3 className="text-base font-semibold">Status history</h3>
            <ol className="mt-4 flex flex-col gap-3">
              {(history.data ?? []).map((entry) => (
                <li key={entry.id} className="border-l-2 border-brand-tint pl-3">
                  <p className="text-sm font-medium">
                    {entry.from_status ? `${STATUS_LABELS[entry.from_status as TicketStatus]} → ` : ""}
                    {STATUS_LABELS[entry.to_status as TicketStatus]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(entry.actor) || "System"} · {formatDateTime(entry.changed_at)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </AgentFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function nameOf(value: unknown): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row && typeof row.name === "string") return row.name;
  if (row && typeof row === "object" && "full_name" in row && typeof row.full_name === "string") return row.full_name;
  return "";
}
