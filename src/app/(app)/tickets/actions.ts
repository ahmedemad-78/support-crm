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
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({
      issue_category_id: category ? Number(category) : null,
      root_cause_id: cause ? Number(cause) : null,
      action_taken: actionTaken || null,
      resolution_notes: resolutionNotes || null,
    })
    .eq("id", id);

  revalidatePath(`/tickets/${id}`);
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
