"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type SignInState } from "./actions";

const readClock = () => Math.floor(Date.now() / 1000) * 1000;
const serverClock = () => 0;
const noClock = () => () => {};
function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, 1000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => { clearInterval(timer); window.removeEventListener("focus", onChange); document.removeEventListener("visibilitychange", onChange); };
}

export function LoginForm({ deactivated, initialState = {} }: { deactivated: boolean; initialState?: SignInState }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, initialState);
  const clock = useSyncExternalStore(state.lockedUntil ? subscribeClock : noClock, state.lockedUntil ? readClock : serverClock, serverClock);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(state.email ?? "");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const sameEmail = state.email === undefined || state.email.toLowerCase() === email.trim().toLowerCase();
  const seconds = state.lockedUntil ? Math.max(0, Math.ceil((Date.parse(state.lockedUntil) - clock) / 1000)) : 0;
  const locked = sameEmail && Boolean(state.lockedUntil) && (!clock || seconds > 0);
  const fieldErrors = sameEmail ? state.fieldErrors : undefined;
  const error = sameEmail ? state.error : undefined;

  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus();
    else if (state.fieldErrors?.password) passwordRef.current?.focus();
    else if (state.error || state.lockedUntil) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="auth-form" onSubmit={() => setShowPassword(false)}>
      {deactivated && !error && <Notice title="Account deactivated" body="Contact Ahmed Emad to request access again." />}
      <fieldset disabled={pending} className="auth-fields">
        <div className="auth-field">
          <Label htmlFor="email">Work email</Label>
          <div className="auth-input-wrap">
            <Mail aria-hidden="true" className="auth-input-icon" />
            <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="you@company.com" required spellCheck={false} autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(fieldErrors?.email) || undefined} aria-describedby={fieldErrors?.email ? "email-error" : undefined} />
          </div>
          {fieldErrors?.email && <p id="email-error" role="alert" className="auth-field-error">{fieldErrors.email}</p>}
        </div>
        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
          <div className="auth-input-wrap">
            <LockKeyhole aria-hidden="true" className="auth-input-icon" />
            <Input ref={passwordRef} id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" className="auth-password-input" aria-describedby={fieldErrors?.password ? "password-error" : undefined} aria-invalid={Boolean(fieldErrors?.password) || undefined} />
            <button type="button" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
          </div>
          {fieldErrors?.password && <p id="password-error" role="alert" className="auth-field-error">{fieldErrors.password}</p>}
        </div>
      </fieldset>
      {(error || locked) && <div ref={errorRef} tabIndex={-1} className="auth-error-summary">
        {error && <Notice title={state.kind === "credentials" ? "Check your sign-in details" : state.kind === "rate_limited" ? "Please wait a moment" : state.kind === "deactivated" ? "Account access" : "We could not connect"} body={error} />}
        {locked && <><Notice title="Temporarily locked" body="Too many incorrect passwords. Wait for the timer or email Ahmed Emad for help." /><p role="timer" aria-live="off" className="auth-lock-timer">Try again in <strong>{clock ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "…"}</strong></p></>}
      </div>}
      <Button type="submit" className="auth-submit" disabled={pending || locked}>
        <span>{pending ? "Signing in…" : "Sign in"}</span>
        <span className="auth-submit-icon" aria-hidden="true">{pending ? <LoaderCircle className="auth-spinner" /> : <ArrowRight />}</span>
      </Button>
      <span className="sr-only" role="status">{pending ? "Checking your sign-in details." : ""}</span>
    </form>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return <div role="alert" className="auth-notice"><CircleAlert aria-hidden="true" /><div><p className="auth-notice-title">{title}</p><p>{body}</p></div></div>;
}
