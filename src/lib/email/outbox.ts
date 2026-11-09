import { MISSING_MAIL_CONFIG, SENT_UNACKNOWLEDGED } from "./messages";

export { SENT_UNACKNOWLEDGED };
export const CLAIM_LEASE_MS = 10 * 60 * 1000;
/** Rows already stuck on the missing-mail error before delivery was repaired. */
export const PARKED_MAIL_BEFORE = "2026-11-09T00:00:00.000Z";

export type OutboxJob = {
  id: string;
  to_address: string;
  subject: string;
  body_text: string;
  ticket_path: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

export type DeliveryCounts = {
  sent: number;
  unacknowledged: number;
  failed: number;
};

export function isDispatchable(row: { last_error: string | null; created_at: string }) {
  if (row.last_error === SENT_UNACKNOWLEDGED) return false;
  if (row.last_error === MISSING_MAIL_CONFIG && row.created_at < PARKED_MAIL_BEFORE) return false;
  return true;
}

export async function deliverOutbox(input: {
  now: Date;
  rows: OutboxJob[];
  configured: boolean;
  claim: (row: OutboxJob, until: string) => Promise<boolean>;
  send: (row: OutboxJob) => Promise<void>;
  acknowledge: (id: string) => Promise<boolean>;
  markMissing: (ids: string[]) => Promise<void>;
  markUnacknowledged: (id: string) => Promise<void>;
  markFailed: (row: OutboxJob, error: unknown) => Promise<void>;
}): Promise<DeliveryCounts> {
  const due = input.rows.filter(isDispatchable);
  if (!input.configured) {
    const fresh = due.filter((row) => row.last_error !== MISSING_MAIL_CONFIG);
    if (fresh.length) await input.markMissing(fresh.map((row) => row.id));
    return { sent: 0, unacknowledged: 0, failed: 0 };
  }

  const until = new Date(input.now.getTime() + CLAIM_LEASE_MS).toISOString();
  let sent = 0;
  let unacknowledged = 0;
  let failed = 0;
  for (const row of due) {
    if (!(await input.claim(row, until))) continue;
    try {
      await input.send(row);
    } catch (error) {
      failed += 1;
      await input.markFailed(row, error);
      continue;
    }
    if (await input.acknowledge(row.id)) {
      sent += 1;
    } else {
      unacknowledged += 1;
      await input.markUnacknowledged(row.id);
    }
  }
  return { sent, unacknowledged, failed };
}
