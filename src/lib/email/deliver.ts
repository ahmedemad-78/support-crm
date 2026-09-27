import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM = process.env.EMAIL_FROM ?? "Support Center <onboarding@resend.dev>";

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await admin
      .from("email_outbox")
      .update({ last_error: "RESEND_API_KEY is not set" })
      .in(
        "id",
        rows.map((row) => row.id),
      );
    return { sent: 0 };
  }

  let sent = 0;
  for (const row of rows) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [row.to_address],
        subject: row.subject,
        html: messageHtml(row),
      }),
    });

    if (response.ok) {
      sent += 1;
      await admin
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      continue;
    }

    const attempts = row.attempts + 1;
    const detail = (await response.text()).slice(0, 500);
    const delayMinutes = Math.min(60, 2 ** attempts);
    await admin
      .from("email_outbox")
      .update({
        attempts,
        status: attempts >= 8 ? "failed" : "pending",
        next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: detail || `Email provider returned ${response.status}`,
      })
      .eq("id", row.id);
  }

  return { sent };
}
