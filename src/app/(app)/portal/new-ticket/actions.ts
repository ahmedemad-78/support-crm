"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsOf,
  portalTicketSchema,
  type PortalTicketFieldErrors,
  type PortalTicketInput,
} from "@/lib/tickets/schema";

export type CreateTicketResult =
  | { ok: true; ticketId: string; ticketNumber: string }
  | { ok: false; error?: string; fieldErrors?: PortalTicketFieldErrors };

export async function createPortalTicket(input: PortalTicketInput): Promise<CreateTicketResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "moderation" && user.role !== "call_center")) {
    return { ok: false, error: "Only Moderation and Call Center can use this form." };
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
