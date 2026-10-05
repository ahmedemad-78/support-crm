"use server";

import { revalidatePath } from "next/cache";
import { isPortalRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsOf,
  portalTicketSchema,
  supportTicketSchema,
  type PortalTicketFieldErrors,
  type PortalTicketInput,
  type SupportTicketInput,
} from "@/lib/tickets/schema";

export type CreateTicketResult =
  | { ok: true; ticketId: string; ticketNumber: string }
  | { ok: false; error?: string; fieldErrors?: PortalTicketFieldErrors };

export async function createPortalTicket(input: PortalTicketInput): Promise<CreateTicketResult> {
  const user = await getCurrentUser();
  if (!user || !isPortalRole(user.role)) {
    return { ok: false, error: "This account can't open a ticket from this form." };
  }

  const parsed = portalTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    // ticket_number, source, status and created_by are set by the database trigger.
    .insert({ ...parsed.data, ticket_number: "pending", source: user.role, created_by: user.id })
    .select("id, ticket_number")
    .single();

  if (error) return { ok: false, error: `The ticket wasn't saved: ${error.message}` };

  revalidatePath("/portal/my-tickets");
  return { ok: true, ticketId: data.id, ticketNumber: data.ticket_number };
}

export async function createSupportTicket(input: SupportTicketInput): Promise<CreateTicketResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "support_agent") {
    return { ok: false, error: "Only Technical Support can open a ticket from here." };
  }

  const parsed = supportTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
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
    .insert({ ...parsed.data, ticket_number: "pending", created_by: user.id })
    .select("id, ticket_number")
    .single();

  if (error) return { ok: false, error: `The ticket wasn't saved: ${error.message}` };

  revalidatePath("/tickets");
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  return { ok: true, ticketId: data.id, ticketNumber: data.ticket_number };
}
