"use server";

import { deliverPendingEmails } from "@/lib/email/deliver";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isPortalRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsOf,
  portalTicketSchemaFor,
  supportTicketSchema,
  type PortalTicketFieldErrors,
  type PortalTicketInput,
  type SupportTicketInput,
} from "@/lib/tickets/schema";

export type CreateTicketResult =
  | { ok: true; ticketId: string; ticketNumber: string }
  | { ok: false; error?: string; fieldErrors?: PortalTicketFieldErrors };

export async function createPortalTicket(input: PortalTicketInput, requestId?: string): Promise<CreateTicketResult> {
  const user = await getCurrentUser();
  if (!user || !isPortalRole(user.role)) {
    return { ok: false, error: "This account can't open a ticket from this form." };
  }

  if (requestId && !z.uuid().safeParse(requestId).success) return { ok: false, error: "Start a new form before trying again." };
  const parsed = portalTicketSchemaFor(user.role).safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  if (requestId) { const existing = await findRequest(supabase, requestId, user.id); if (existing) return existing; }
  const { data, error } = await supabase
    .from("tickets")
    // ticket_number, source, status and created_by are set by the database trigger.
    .insert({ ...(requestId ? { id: requestId } : {}), ...parsed.data, contact_channel: "unspecified", ticket_number: "pending", source: user.role, created_by: user.id })
    .select("id, ticket_number")
    .single();

  if (error?.code === "23505" && requestId) { const existing = await findRequest(supabase, requestId, user.id); return existing || { ok: false, error: "This request could not be confirmed. Check the case queue before trying a new form." }; }
  if (error) return { ok: false, error: `The ticket wasn't saved: ${error.message}` };

  try { await deliverPendingEmails(); } catch { /* Notification remains in the outbox. */ }
  revalidatePath("/portal/my-tickets");
  return { ok: true, ticketId: data.id, ticketNumber: data.ticket_number };
}

export async function createSupportTicket(input: SupportTicketInput, requestId?: string): Promise<CreateTicketResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "support_agent") {
    return { ok: false, error: "Only Technical Support can open a ticket from here." };
  }

  if (requestId && !z.uuid().safeParse(requestId).success) return { ok: false, error: "Start a new form before trying again." };
  const parsed = supportTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  if (requestId) { const existing = await findRequest(supabase, requestId, user.id); if (existing) return existing; }
  const { data: source, error: sourceError } = await supabase
    .from("ticket_sources")
    .select("code")
    .eq("code", parsed.data.source)
    .eq("is_active", true)
    .maybeSingle();
  if (sourceError) return { ok: false, error: sourceError.message };
  if (!source) return { ok: false, fieldErrors: { source: "Choose an active source." } };

  const { data, error } = await supabase
    .from("tickets")
    .insert({ ...(requestId ? { id: requestId } : {}), ...parsed.data, ticket_number: "pending", created_by: user.id })
    .select("id, ticket_number")
    .single();

  if (error?.code === "23505" && requestId) { const existing = await findRequest(supabase, requestId, user.id); return existing || { ok: false, error: "This request could not be confirmed. Check the case queue before trying a new form." }; }
  if (error) return { ok: false, error: `The ticket wasn't saved: ${error.message}` };

  try { await deliverPendingEmails(); } catch { /* Notification remains in the outbox. */ }
  revalidatePath("/tickets");
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  return { ok: true, ticketId: data.id, ticketNumber: data.ticket_number };
}

async function findRequest(supabase: Awaited<ReturnType<typeof createClient>>, requestId: string, userId: string): Promise<CreateTicketResult | null> {
  const { data, error } = await supabase.from("tickets").select("id, ticket_number").eq("id", requestId).eq("created_by", userId).maybeSingle();
  if (error) return { ok: false, error: "We could not confirm this request. Your entries are still here; retry using this form." };
  return data ? { ok: true, ticketId: data.id, ticketNumber: data.ticket_number } : null;
}
