import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MailNotConfiguredError,
  MISSING_MAIL_CONFIG,
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

type OutboxRow = {
  id: string;
  to_address: string;
  subject: string;
  body_text: string;
  ticket_path: string;
  attempts: number;
};

function messageHtml(row: OutboxRow) {
  const status = row.subject.replace(/^.* is now /, "");
  const summary = escapeHtml(row.body_text).replaceAll("\n", "<br />");
  const link = `${appOrigin()}${row.ticket_path}`;
  return `<p>Ticket status is now <strong>${escapeHtml(status)}</strong>.</p><p><strong>Problem</strong><br />${summary}</p><p><a href="${link}">Open the ticket</a></p>`;
}

function messageText(row: OutboxRow) {
  const status = row.subject.replace(/^.* is now /, "");
  return `Ticket status is now ${status}.\n\nProblem\n${row.body_text}\n\nOpen the ticket: ${appOrigin()}${row.ticket_path}`;
}

export async function deliverPendingEmails() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("email_outbox")
    .select("id, to_address, subject, body_text, ticket_path, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) return { sent: 0 };

  if (!smtpConfigured() && !process.env.RESEND_API_KEY) {
    await admin
      .from("email_outbox")
      .update({ last_error: MISSING_MAIL_CONFIG })
      .in(
        "id",
        rows.map((row) => row.id),
      );
    return { sent: 0 };
  }

  let sent = 0;
  for (const row of rows) {
    try {
      await sendOutbound({
        to: row.to_address,
        subject: row.subject,
        html: messageHtml(row),
        text: messageText(row),
      });
      sent += 1;
      await admin
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
    } catch (error) {
      const message = publicMailError(error);
      const patch =
        error instanceof MailNotConfiguredError
          ? { last_error: MISSING_MAIL_CONFIG }
          : outboxFailurePatch(row.attempts, message);
      await admin.from("email_outbox").update(patch).eq("id", row.id);
    }
  }

  return { sent };
}
