import { notFound } from "next/navigation";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  ATTACHMENTS_BUCKET,
  sourceLabel,
  type TicketStatus,
} from "@/lib/tickets/constants";
import { safeAppReturn } from "@/lib/tickets/filters";
import { CaseWorkspace } from "@/components/tickets/case-workspace";
import { ReplyReadMarker } from "@/components/tickets/reply-read-marker";
import { CaseFollowup } from "@/components/tickets/case-followup";
import { loadCaseWorkflow } from "@/lib/tickets/workflow";
import { z } from "zod";

export default async function AgentTicketPage({
  params,
  searchParams,
}: PageProps<"/tickets/[ticketId]">) {
  const user = await requireUser(["support_agent", "manager"]);
  const { ticketId } = await params;
  const { error: errorMessage, returnTo, saved } = await searchParams;
  const backHref = safeAppReturn(typeof returnTo === "string" ? returnTo : undefined) ?? "/tickets";
  if (!z.uuid().safeParse(ticketId).success) notFound();
  const supabase = await createClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select(
      `id, ticket_number, status, source, created_at, updated_at, customer_name, customer_email, customer_phone, school_name,
       school_context, credentials_username, issue_date, end_user_type, platform, is_latest_version, app_version,
       device_type, page_screen, steps, issue_description, assignee_id, issue_category_id, root_cause_id,
       action_taken, resolution_notes, follow_up_notes, tracker_notes, fawry_payment,
       request_type_id, topic_id, tracker_cause_id, tracker_action_id, outcome_id, cities(name),
       creator:profiles!tickets_created_by_fkey(full_name)`,
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketError) throw ticketError;
  if (!ticket) notFound();

  const [history, attachments, notes, agents, categories, causes, requestTypes, topics, trackerCauses, trackerActions, outcomes] = await Promise.all([
    supabase
      .from("ticket_status_history")
      .select("id, from_status, to_status, changed_at, actor:profiles!ticket_status_history_changed_by_fkey(full_name)")
      .eq("ticket_id", ticket.id)
      .order("changed_at", { ascending: false }),
    supabase.from("ticket_attachments").select("id, file_name, mime_type, storage_path").eq("ticket_id", ticket.id).is("event_id",null),
    supabase
      .from("ticket_notes")
      .select("id, body, created_at, author:profiles!ticket_notes_author_id_fkey(full_name)")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("role", "support_agent").eq("is_active", true).order("full_name"),
    supabase.from("issue_categories").select("id, name, is_active").order("name"),
    supabase.from("root_causes").select("id, name, is_active").order("name"),
    supabase.from("request_types").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("topics").select("id, name, is_active").order("name"),
    supabase.from("tracker_causes").select("id, name, is_active").order("name"),
    supabase.from("tracker_actions").select("id, name, is_active").order("name"),
    supabase.from("outcomes").select("id, name, is_active").order("name"),
  ]);
  for (const result of [history, attachments, notes, agents, categories, causes, requestTypes, topics, trackerCauses, trackerActions, outcomes]) {
    if (result.error) throw result.error;
  }

  const signed = attachments.data?.length
    ? await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(
        attachments.data.map((file) => file.storage_path),
        60 * 10,
      )
    : { data: [] };
  const urlByPath = new Map(signed.data?.map((file) => [file.path, file.signedUrl]));

  const workflow = await loadCaseWorkflow(ticket.id);
  const status = ticket.status as TicketStatus;
  const { data: ticketSource } = await supabase.from("ticket_sources").select("name").eq("code", ticket.source).maybeSingle();
  const canEdit = user.role === "support_agent";
  const city = nameOf(ticket.cities);
  const creator = nameOf(ticket.creator);
  const idValue = (value: number | null) => value == null ? "" : String(value);
  return <AgentFrame title="Case file"><CaseWorkspace
    ticket={{ ...ticket, status }} sourceName={ticketSource?.name || sourceLabel(ticket.source)} city={city} creator={creator} reporterName={workflow.reporter_id ? workflow.reporterName : undefined} reopenCount={workflow.reopen_count} backHref={backHref}
    saved={saved === "1"} error={typeof errorMessage === "string" ? errorMessage : undefined}
    attachments={(attachments.data ?? []).map((file) => ({ ...file, url: urlByPath.get(file.storage_path) }))}
    notes={(notes.data ?? []).map((note) => ({ ...note, author: nameOf(note.author) }))}
    history={(history.data ?? []).map((entry) => ({ ...entry, actor: nameOf(entry.actor) }))}
    editor={{ ticketId: ticket.id, updatedAt: ticket.updated_at, returnTo: backHref, userId: user.id, canEdit, agents: agents.data ?? [],
      initial: { status, assigneeId: ticket.assignee_id || "", requestTypeId: idValue(ticket.request_type_id), topicId: idValue(ticket.topic_id), trackerCauseId: idValue(ticket.tracker_cause_id), trackerActionId: idValue(ticket.tracker_action_id), outcomeId: idValue(ticket.outcome_id), issueCategoryId: idValue(ticket.issue_category_id), rootCauseId: idValue(ticket.root_cause_id), resolutionNotes: ticket.resolution_notes || "", followUpNotes: ticket.follow_up_notes || "", trackerNotes: ticket.tracker_notes || "", actionTaken: ticket.action_taken || "" },
      options: { requestTypes: requestTypes.data ?? [], topics: topics.data ?? [], causes: trackerCauses.data ?? [], actions: trackerActions.data ?? [], outcomes: outcomes.data ?? [], categories: categories.data ?? [], rootCauses: causes.data ?? [] }
    }}
    conversation={<><ReplyReadMarker ticketId={ticket.id} eventIds={workflow.unreadReplyEvents}/><CaseFollowup perspective="support" reporterName={workflow.reporter_id ? workflow.reporterName : undefined} ticketId={ticket.id} version={ticket.updated_at} status={status} count={workflow.reopen_count} events={workflow.events} unreadEventIds={workflow.unreadReplyEvents} canReply={canEdit} relatedHref={`/tickets/new?linked=${ticket.id}`} />{workflow.linked_ticket_id && <p>Related case: <a href={`/tickets/${workflow.linked_ticket_id}`}>Open related case ↗</a></p>}</>} /></AgentFrame>;
}

function nameOf(value: unknown): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row && typeof row.name === "string") return row.name;
  if (row && typeof row === "object" && "full_name" in row && typeof row.full_name === "string") return row.full_name;
  return "";
}
