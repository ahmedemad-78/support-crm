import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type LockStatus = { locked: false; failuresLeft: number } | { locked: true; unlocksAt: Date };

/**
 * Locked when the last 5 attempts inside the window all failed. A successful sign-in,
 * or an admin unlock (recorded as a successful attempt), resets the count.
 */
export async function getLockStatus(email: string): Promise<LockStatus> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();

  const { data, error } = await admin
    .from("auth_login_attempts")
    .select("succeeded, attempted_at")
    .eq("email", email.toLowerCase())
    .gte("attempted_at", since)
    .order("attempted_at", { ascending: false })
    .limit(MAX_FAILED_ATTEMPTS);

  if (error) throw error;

  const attempts = data ?? [];
  const consecutiveFailures = attempts.findIndex((a) => a.succeeded);
  const failures = consecutiveFailures === -1 ? attempts.length : consecutiveFailures;

  if (failures >= MAX_FAILED_ATTEMPTS) {
    const lastFailure = new Date(attempts[0].attempted_at);
    return { locked: true, unlocksAt: new Date(lastFailure.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { locked: false, failuresLeft: MAX_FAILED_ATTEMPTS - failures };
}

export async function recordAttempt(email: string, succeeded: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("auth_login_attempts")
    .insert({ email: email.toLowerCase(), succeeded });
  if (error) throw error;
}

export async function clearLock(email: string) {
  await recordAttempt(email, true);
}
