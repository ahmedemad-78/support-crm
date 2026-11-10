"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deliverPendingEmails } from "@/lib/email/deliver";

export async function submitCaseFollowup(_previous: { error: string; success: string }, form: FormData) {
  const user = await getCurrentUser();
  if (!user || !["support_agent", "moderation", "call_center", "june_schools", "business_development"].includes(user.role)) return { error: "This account cannot send case follow-up.", success: "" };
  const parsed = z.object({ ticketId: z.uuid(), mode: z.enum(["comment", "reopen"]), body: z.string().trim().min(2).max(4000), requestId: z.uuid(), version: z.iso.datetime({ offset: true }) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check your message and refresh this case before trying again.", success: "" };
  const input = parsed.data;
  if (input.mode === "reopen" && input.body.length < 5) return { error: "Explain why this same problem continues (at least 5 characters).", success: "" };
  try {
    const supabase = await createClient();
    const { error } = input.mode === "reopen"
      ? await supabase.rpc("reopen_case", { case_id: input.ticketId, expected_version: input.version, reason: input.body })
      : await supabase.rpc("comment_on_case", { case_id: input.ticketId, body: input.body, request_id: input.requestId });
    if (error) return { error: error.message, success: "" };
  } catch { return { error: "Could not confirm the update. Your message is still here. Refresh the activity before retrying.", success: "" }; }
  try { await deliverPendingEmails(); } catch { /* Durable outbox keeps the notification pending. */ }
  revalidatePath(`/tickets/${input.ticketId}`);
  revalidatePath(`/portal/my-tickets/${input.ticketId}`);
  revalidatePath("/tickets"); revalidatePath("/portal/my-tickets"); revalidatePath("/dashboard");
  return { error: "", success: input.mode === "reopen" ? "Case reopened. Support has been notified." : "Comment added. The case status is unchanged." };
}
