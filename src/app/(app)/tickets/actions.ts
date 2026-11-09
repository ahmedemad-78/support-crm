"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deliverPendingEmails } from "@/lib/email/deliver";
import { TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { safeAppReturn } from "@/lib/tickets/filters";
import { z } from "zod";

function validUpdate(id: string, version: string) {
  return z.uuid().safeParse(id).success && Number.isFinite(Date.parse(version));
}

function numericId(value: FormDataEntryValue | null) {
  return value == null || value === "" || z.coerce.number().int().positive().safeParse(value).success;
}

async function supportAgent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "support_agent") return null;
  return user;
}

function ticketPath(id: string, error?: string, returnTo?: string | null) {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  else params.set("saved", "1");
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `/tickets/${id}?${query}` : `/tickets/${id}`;
}

function requestedReturn(formData: FormData) {
  return safeAppReturn(String(formData.get("returnTo") ?? ""));
}

function updateResult(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  if (result.error) return result.error.message;
  if (!result.data?.length) return "This case changed since you opened it, or this account can no longer update it. Review the latest values before saving again.";
  return undefined;
}

export async function updateTicketHeader(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  const updatedAt = String(formData.get("updatedAt") ?? "");
  if (!validUpdate(id, updatedAt)) redirect(ticketPath(id, "Reload this case before saving.", requestedReturn(formData)));
  if (!user) redirect(ticketPath(id, "Only Technical Support can update a ticket."));

  const status = String(formData.get("status") ?? "");
  const assignee = String(formData.get("assigneeId") ?? "");
  if (!TICKET_STATUSES.includes(status as TicketStatus)) redirect(ticketPath(id, "Pick a valid status."));

  const supabase = await createClient();
  if (assignee) {
    if (!z.uuid().safeParse(assignee).success) redirect(ticketPath(id, "Choose a valid Support assignee.", requestedReturn(formData)));
    const { data: agent, error: agentError } = await supabase.from("profiles").select("id").eq("id", assignee).eq("role", "support_agent").eq("is_active", true).maybeSingle();
    if (agentError || !agent) redirect(ticketPath(id, "Choose an active Technical Support assignee.", requestedReturn(formData)));
  }
  const failure = updateResult(await supabase
    .from("tickets")
    .update({
      status,
      assignee_id: assignee || null,
    })
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .select("id"));

  if (!failure) {
    try {
      await deliverPendingEmails();
    } catch {
      // The status change is saved. Delivery retries from the outbox.
    }
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  redirect(ticketPath(id, failure, requestedReturn(formData)));
}

export async function saveResolution(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  const updatedAt = String(formData.get("updatedAt") ?? "");
  if (!validUpdate(id, updatedAt)) redirect(ticketPath(id, "Reload this case before saving.", requestedReturn(formData)));
  if (!user) redirect(ticketPath(id, "Only Technical Support can update a ticket."));

  const category = String(formData.get("issueCategoryId") ?? "");
  const cause = String(formData.get("rootCauseId") ?? "");
  const actionTaken = String(formData.get("actionTaken") ?? "").trim();
  if (!numericId(formData.get("issueCategoryId")) || !numericId(formData.get("rootCauseId"))) redirect(ticketPath(id, "Choose valid classification values.", requestedReturn(formData)));

  const supabase = await createClient();
  const failure = updateResult(await supabase
    .from("tickets")
    .update({
      issue_category_id: category ? Number(category) : null,
      root_cause_id: cause ? Number(cause) : null,
      action_taken: actionTaken || null,
    })
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .select("id"));

  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  redirect(ticketPath(id, failure, requestedReturn(formData)));
}

export async function saveTracker(formData: FormData) {
  const user = await supportAgent();
  const id = String(formData.get("ticketId") ?? "");
  const updatedAt = String(formData.get("updatedAt") ?? "");
  if (!validUpdate(id, updatedAt)) redirect(ticketPath(id, "Reload this case before saving.", requestedReturn(formData)));
  if (!user) redirect(ticketPath(id, "Only Technical Support can update a ticket."));

  if (["requestTypeId", "topicId", "trackerCauseId", "trackerActionId", "outcomeId"].some((key) => !numericId(formData.get(key)))) redirect(ticketPath(id, "Choose valid tracker values.", requestedReturn(formData)));

  const idOf = (name: string) => {
    const raw = String(formData.get(name) ?? "");
    return raw ? Number(raw) : null;
  };
  const textOf = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const supabase = await createClient();
  const failure = updateResult(await supabase
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
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .select("id"));

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/portal/my-tickets/${id}`);
  revalidatePath("/dashboard");
  redirect(ticketPath(id, failure, requestedReturn(formData)));
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
  redirect(ticketPath(id, error?.message, requestedReturn(formData)));
}
