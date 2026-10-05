"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deliverPendingEmails } from "@/lib/email/deliver";
import { TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";

async function supportAgent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "support_agent") return null;
  return user;
}

function ticketPath(id: string, error?: string) {
  return error ? `/tickets/${id}?error=${encodeURIComponent(error)}` : `/tickets/${id}`;
}

export async function updateTicketHeader(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  if (!user) redirect(ticketPath(id, "Only Technical Support can update a ticket."));

  const status = String(formData.get("status") ?? "");
  const assignee = String(formData.get("assigneeId") ?? "");
  if (!TICKET_STATUSES.includes(status as TicketStatus)) redirect(ticketPath(id, "Pick a valid status."));

  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({
      status,
      assignee_id: assignee || null,
    })
    .eq("id", id);

  if (!error) {
    try {
      await deliverPendingEmails();
    } catch {
      // The status change is saved. Delivery retries from the outbox.
    }
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  redirect(ticketPath(id, error?.message));
}

export async function saveResolution(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  if (!user) redirect(ticketPath(id, "Only Technical Support can update a ticket."));

  const category = String(formData.get("issueCategoryId") ?? "");
  const cause = String(formData.get("rootCauseId") ?? "");
  const actionTaken = String(formData.get("actionTaken") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({
      issue_category_id: category ? Number(category) : null,
      root_cause_id: cause ? Number(cause) : null,
      action_taken: actionTaken || null,
    })
    .eq("id", id);

  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  redirect(ticketPath(id, error?.message));
}

export async function saveTracker(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  if (!user) redirect(ticketPath(id, "Only Technical Support can update a ticket."));

  const idOf = (name: string) => {
    const raw = String(formData.get(name) ?? "");
    return raw ? Number(raw) : null;
  };
  const textOf = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({
      request_type_id: idOf("requestTypeId"),
      topic_id: idOf("topicId"),
      tracker_cause_id: idOf("trackerCauseId"),
      tracker_action_id: idOf("trackerActionId"),
      outcome_id: idOf("outcomeId"),
      tracker_notes: textOf("trackerNotes"),
      resolution_notes: textOf("resolutionNotes"),
      follow_up_notes: textOf("followUpNotes"),
    })
    .eq("id", id);

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/portal/my-tickets/${id}`);
  revalidatePath("/dashboard");
  redirect(ticketPath(id, error?.message));
}

export async function addTicketNote(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  if (!user) redirect(ticketPath(id, "Only Technical Support can add a note."));

  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect(ticketPath(id, "Write a note before saving it."));

  const supabase = await createClient();
  const { error } = await supabase.from("ticket_notes").insert({
    ticket_id: id,
    author_id: user.id,
    body,
  });

  revalidatePath(`/tickets/${id}`);
  redirect(ticketPath(id, error?.message));
}
