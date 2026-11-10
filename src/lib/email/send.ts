import "server-only";
import type { ConnectionOptions } from "node:tls";
import { createTransport } from "nodemailer";
import { MISSING_MAIL_CONFIG } from "@/lib/email/messages";

export { MISSING_MAIL_CONFIG };

const RESEND_FROM = "Support Center <onboarding@resend.dev>";

export class MailNotConfiguredError extends Error {
  constructor() {
    super(MISSING_MAIL_CONFIG);
    this.name = "MailNotConfiguredError";
  }
}

export type MailEnv = Record<string, string | undefined>;

export function graphConfigured(env: MailEnv = process.env) {
  return Boolean(env.GRAPH_TENANT_ID && env.GRAPH_CLIENT_ID && env.GRAPH_CLIENT_SECRET && env.GRAPH_SENDER);
}

export function mailConfigured(env: MailEnv = process.env) {
  return graphConfigured(env) || smtpConfigured(env) || Boolean(env.RESEND_API_KEY);
}

export function smtpConfigured(env: MailEnv = process.env) {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

export function mailFrom(env: MailEnv = process.env) {
  if (env.EMAIL_FROM) return env.EMAIL_FROM;
  if (smtpConfigured(env)) return env.SMTP_USER as string;
  return RESEND_FROM;
}

export function smtpPort(env: MailEnv = process.env) {
  const parsed = Number(env.SMTP_PORT);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
  return 587;
}

export function smtpTransportOptions(env: MailEnv = process.env, tls?: ConnectionOptions) {
  const port = smtpPort(env);
  const secure = port === 465;
  return {
    host: env.SMTP_HOST,
    port,
    secure,
    // 587 is STARTTLS. 465 is implicit TLS. Other ports may upgrade if the server offers it.
    requireTLS: port === 587,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    ...(tls ? { tls } : {}),
  };
}

export type OutboundMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendOptions = {
  env?: MailEnv;
  tls?: ConnectionOptions;
  fetchImpl?: typeof fetch;
};

export async function sendOutbound(message: OutboundMessage, options: SendOptions = {}) {
  const env = options.env ?? process.env;
  if (graphConfigured(env)) {
    await sendGraph(message, env, options.fetchImpl ?? fetch);
    return { provider: "microsoft-graph" as const };
  }
  if (smtpConfigured(env)) {
    const transporter = createTransport(smtpTransportOptions(env, options.tls));
    await transporter.sendMail({
      from: mailFrom(env),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { provider: "smtp" as const };
  }

  const apiKey = env.RESEND_API_KEY;
  if (apiKey) {
    await sendResend(message, env, apiKey, options.fetchImpl ?? fetch);
    return { provider: "resend" as const };
  }

  throw new MailNotConfiguredError();
}

async function sendGraph(message: OutboundMessage, env: MailEnv, fetchImpl: typeof fetch) {
  const tokenResponse = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(env.GRAPH_TENANT_ID!)}/oauth2/v2.0/token`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GRAPH_CLIENT_ID!, client_secret: env.GRAPH_CLIENT_SECRET!, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!tokenResponse.ok) throw new Error(`Microsoft sender authorization failed (${tokenResponse.status}). Check the company app configuration.`);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Microsoft did not return a sender token.");
  const response = await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.GRAPH_SENDER!)}/sendMail`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: message.subject, body: { contentType: "HTML", content: message.html }, toRecipients: [{ emailAddress: { address: message.to } }] }, saveToSentItems: true }),
  });
  if (response.status !== 202) throw new Error(`Microsoft did not accept the email (${response.status}). Check the sender mailbox permission.`);
}

async function sendResend(message: OutboundMessage, env: MailEnv, apiKey: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(env),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(detail || `Email provider returned ${response.status}`);
  }
}

export function outboxFailurePatch(attempts: number, message: string, now = Date.now()) {
  if (message === MISSING_MAIL_CONFIG) {
    return { last_error: MISSING_MAIL_CONFIG };
  }
  const nextAttempts = attempts + 1;
  const delayMinutes = Math.min(60, 2 ** nextAttempts);
  return {
    attempts: nextAttempts,
    status: nextAttempts >= 8 ? ("failed" as const) : ("pending" as const),
    next_attempt_at: new Date(now + delayMinutes * 60_000).toISOString(),
    last_error: message.slice(0, 500),
  };
}

export function publicMailError(error: unknown, env: MailEnv = process.env) {
  if (error instanceof MailNotConfiguredError) return MISSING_MAIL_CONFIG;
  let message = error instanceof Error ? error.message : "Email delivery failed";
  for (const secret of [env.SMTP_PASSWORD, env.GRAPH_CLIENT_SECRET, env.RESEND_API_KEY]) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  return message.slice(0, 500);
}
