"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLockStatus, recordAttempt } from "@/lib/auth/lockout";

export type SignInState = {
  error?: string;
  kind?: "credentials" | "unavailable" | "rate_limited" | "deactivated";
  fieldErrors?: { email?: string; password?: string };
  lockedUntil?: string;
  email?: string;
};

const schema = z.object({
  email: z.email("Enter a valid work email address."),
  password: z.string().min(1, "Enter your password."),
});
const unavailable = "Sign-in is temporarily unavailable. Please try again in a moment.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = schema.safeParse({ email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { email: fields.email?.[0], password: fields.password?.[0] }, email };
  }

  try {
    const lock = await getLockStatus(email);
    if (lock.locked) return { lockedUntil: lock.unlocksAt.toISOString(), email };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (error.code === "user_banned") return { kind: "deactivated", error: "This account is deactivated. Contact Ahmed Emad for help.", email };
      if (error.status === 429 || error.code === "over_request_rate_limit") return { kind: "rate_limited", error: "Too many sign-in requests. Wait a moment before trying again.", email };
      if (error.code === "email_not_confirmed") return { kind: "deactivated", error: "Your account needs activation. Contact Ahmed Emad for help.", email };
      // Only a confirmed credentials rejection consumes a password attempt.
      // Network errors, service outages and unknown provider errors never do.
      if (error.code !== "invalid_credentials") return { kind: "unavailable", error: unavailable, email };
      await recordAttempt(email, false);
      const after = await getLockStatus(email);
      if (after.locked) return { lockedUntil: after.unlocksAt.toISOString(), email };
      return {
        kind: "credentials",
        error: after.failuresLeft <= 2
          ? `Email or password is incorrect. ${after.failuresLeft} ${after.failuresLeft === 1 ? "try" : "tries"} left before a temporary lock.`
          : "Email or password is incorrect. Please check both and try again.",
        email,
      };
    }
    await recordAttempt(email, true);
  } catch {
    return { kind: "unavailable", error: unavailable, email };
  }
  redirect("/");
}
