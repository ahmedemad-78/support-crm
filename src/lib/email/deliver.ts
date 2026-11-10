import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverOutbox, isDispatchable, SENT_UNACKNOWLEDGED, type OutboxJob } from "@/lib/email/outbox";
import { MISSING_MAIL_CONFIG } from "@/lib/email/messages";
import {
  MailNotConfiguredError,
  outboxFailurePatch,
  publicMailError,
  sendOutbound,
  smtpConfigured,
} from "@/lib/email/send";

function appOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://support-crm-emad25.vercel.app";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function messageHtml(row: OutboxJob) {
  const status = row.subject;
  const summary = escapeHtml(row.body_text).replaceAll("\n", "<br />");
  const link = `${appOrigin()}${row.ticket_path}`;
  return `<p>Case update: <strong>${escapeHtml(status)}</strong>.</p><p><strong>Case details</strong><br />${summary}</p><p><a href="${link}">Open the ticket</a></p>`;
}

function messageText(row: OutboxJob) {
  const status = row.subject;
  return `Case update: ${status}.\n\nCase details\n${row.body_text}\n\nOpen the ticket: ${appOrigin()}${row.ticket_path}`;
}

export async function deliverPendingEmails() {
  const admin = createAdminClient();
  const { data: setting, error: policyError } = await admin.from("app_settings").select("value").eq("key", "workflow_notifications").single();
  if(policyError || setting?.value?.mode !== "central_only") throw new Error("Central notification routing is unavailable");
  const centralEmail = String(setting.value.email);
  const now = new Date();
  const { data, error } = await admin
    .from("email_outbox")
    .select("id, to_address, subject, body_text, ticket_path, attempts, last_error, created_at")
    .eq("status", "pending")
    .not("event_id", "is", null)
    .eq("to_address", centralEmail)
    .lte("next_attempt_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  const rows = ((data ?? []) as OutboxJob[]).filter(isDispatchable).slice(0, 20);

  return deliverOutbox({
    now,
    rows,
    configured: smtpConfigured() || Boolean(process.env.RESEND_API_KEY),
    claim: async (row, until) => {
      const { data: claimed, error: claimError } = await admin
        .from("email_outbox")
        .update({ next_attempt_at: until })
        .eq("id", row.id)
        .eq("status", "pending")
        .lte("next_attempt_at", now.toISOString())
        .select("id");
      if (claimError) throw claimError;
      return (claimed?.length ?? 0) > 0;
    },
    send: async (row) => {
      await sendOutbound({
        to: centralEmail,
        subject: row.subject,
        html: messageHtml(row),
        text: messageText(row),
      });
    },
    acknowledge: async (id) => {
      const { data: saved, error: saveError } = await admin
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      return !saveError && (saved?.length ?? 0) > 0;
    },
    markMissing: async (ids) => {
      const { error: markError } = await admin
        .from("email_outbox")
        .update({ last_error: MISSING_MAIL_CONFIG })
        .in("id", ids);
      if (markError) throw markError;
    },
    markUnacknowledged: async (id) => {
      await admin
        .from("email_outbox")
        .update({
          last_error: SENT_UNACKNOWLEDGED,
          next_attempt_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending");
    },
    markFailed: async (row, failure) => {
      const message = publicMailError(failure);
      const patch =
        failure instanceof MailNotConfiguredError
          ? { last_error: MISSING_MAIL_CONFIG }
          : outboxFailurePatch(row.attempts, message);
      await admin.from("email_outbox").update(patch).eq("id", row.id);
    },
  });
}
