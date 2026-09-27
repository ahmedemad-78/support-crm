import "server-only";
import type { ConnectionOptions } from "node:tls";
import { createTransport } from "nodemailer";

export const MISSING_MAIL_CONFIG =
  "Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD (Gmail or Outlook) or RESEND_API_KEY";

const RESEND_FROM = "Support Center <onboarding@resend.dev>";

export class MailNotConfiguredError extends Error {
  constructor() {
    super(MISSING_MAIL_CONFIG);
    this.name = "MailNotConfiguredError";
  }
}

export type MailEnv = Record<string, string | undefined>;

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
  const secret = env.SMTP_PASSWORD;
  if (secret) message = message.split(secret).join("[redacted]");
  return message.slice(0, 500);
}
