"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLockStatus, recordAttempt } from "@/lib/auth/lockout";

export type SignInState = {
  error?: string;
  lockedUntil?: string;
  email?: string;
};

const schema = z.object({
  email: z.email("Enter your work email, e.g. name@selaheltelmeez.com"),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  const email = String(formData.get("email") ?? "").trim();

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, email };
  }

  const lock = await getLockStatus(parsed.data.email);
  if (lock.locked) {
    return { lockedUntil: lock.unlocksAt.toISOString(), email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "user_banned") {
      return { error: "This account is deactivated. Contact the Digital Team.", email };
    }
    await recordAttempt(parsed.data.email, false);
    const after = await getLockStatus(parsed.data.email);
    if (after.locked) return { lockedUntil: after.unlocksAt.toISOString(), email };
    return {
      error:
        after.failuresLeft <= 2
          ? `Email or password is incorrect. ${after.failuresLeft} ${after.failuresLeft === 1 ? "try" : "tries"} left before the account is locked for 15 minutes.`
          : "Email or password is incorrect.",
      email,
    };
  }

  await recordAttempt(parsed.data.email, true);
  redirect("/");
}
