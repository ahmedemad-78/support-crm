import { notFound } from "next/navigation";
import { LoginScreen } from "../login-screen";
import type { SignInState } from "../actions";

/** Visual QA only: synthetic initial states, no account or database reads. */
export default async function AuthPreview({ searchParams }: PageProps<"/login/preview-auth">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { state, until } = await searchParams;
  let initialState: SignInState = {};
  if (state === "locked" && typeof until === "string" && Number.isFinite(Date.parse(until))) initialState = { email: "fixture@example.test", lockedUntil: until };
  if (state === "error") initialState = { email: "fixture@example.test", error: "Email or password is incorrect. Please check both and try again.", kind: "credentials" };
  if (state === "offline") initialState = { email: "fixture@example.test", error: "Sign-in is temporarily unavailable. Please try again in a moment.", kind: "unavailable" };
  return <LoginScreen deactivated={state === "inactive"} initialState={initialState} />;
}
