"use server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { mailConfigured, publicMailError, sendOutbound } from "@/lib/email/send";
import { z } from "zod";

/** No caller-supplied address or content; never dispatches the outbox. */
export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user?.isAdmin || user.role !== "support_agent") return { ok: false, message: "Only a Support administrator can test notifications." };
  if (!mailConfigured()) return { ok: false, message: "Email sending is not configured on this deployment yet." };
  try {
    const db = await createClient();
    const { data, error } = await db.from("app_settings").select("value").eq("key", "workflow_notifications").single();
    const policy = z.object({ mode: z.literal("central_only"), recipient_id: z.uuid(), email: z.email() }).safeParse(data?.value);
    if (error || !policy.success || policy.data.recipient_id !== user.id) return { ok: false, message: "This test is restricted to the central notification owner." };
    const result = await sendOutbound({
      to: policy.data.email,
      subject: "Support CRM · Notification connection test",
      text: "This is a single connection test from Support CRM. No ticket was created or changed, and no queued messages were dispatched.\n\nNotifications are currently routed to Ahmed only.\n\nOpen the workspace: https://support-crm-emad25.vercel.app",
      html: '<h2>Support CRM notification test</h2><p>This is a single connection test. No ticket was created or changed, and no queued messages were dispatched.</p><p>Notifications are currently routed to Ahmed only.</p><p><a href="https://support-crm-emad25.vercel.app">Open the workspace</a></p>',
    });
    return { ok: true, message: `Test message accepted by ${result.provider}. Check the central recipient’s Outlook Inbox and Junk folders to confirm delivery.` };
  } catch (error) { return { ok: false, message: publicMailError(error) }; }
}
