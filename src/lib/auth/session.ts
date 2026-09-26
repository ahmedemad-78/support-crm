import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathFor, type CurrentUser, type Role } from "./roles";

type SessionState =
  | { status: "signed_out" }
  | { status: "inactive" }
  | { status: "active"; user: CurrentUser };

const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { status: "signed_out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_admin, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.is_active) return { status: "inactive" };

  return {
    status: "active",
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as Role,
      isAdmin: profile.role === "support_agent" && profile.is_admin,
    },
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getSessionState();
  return state.status === "active" ? state.user : null;
}

/** For pages: redirects instead of throwing. */
export async function requireUser(allowed?: Role[]): Promise<CurrentUser> {
  const state = await getSessionState();
  if (state.status === "signed_out") redirect("/login");
  if (state.status === "inactive") redirect("/auth/signout?reason=inactive");
  const { user } = state;
  if (allowed && !allowed.includes(user.role)) redirect(homePathFor(user));
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser(["support_agent"]);
  if (!user.isAdmin) redirect(homePathFor(user));
  return user;
}

/** For server actions: throws so the action never runs for the wrong user. */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new Error("Not allowed");
  return user;
}
