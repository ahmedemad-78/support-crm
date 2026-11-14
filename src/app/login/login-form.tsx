"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ArrowBigUpDash, LoaderCircle, LockKeyhole, Mail, CircleAlert } from "lucide-react";
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
  const [capsLock, setCapsLock] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [email, setEmail] = useState(state.email ?? "");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const eyeRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<CanvasRenderingContext2D | null>(null);
  const lookTimer = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sameEmail = state.email === undefined || state.email.toLowerCase() === email.trim().toLowerCase();
  const seconds = state.lockedUntil ? Math.max(0, Math.ceil((Date.parse(state.lockedUntil) - clock) / 1000)) : 0;
  const locked = sameEmail && Boolean(state.lockedUntil) && (!clock || seconds > 0);
  const fieldErrors = sameEmail ? state.fieldErrors : undefined;
  const error = sameEmail ? state.error : undefined;

  useEffect(() => () => { if (lookTimer.current !== null) clearTimeout(lookTimer.current); }, []);

  function lookAtCaret(input: HTMLInputElement, up = false) {
    const eye = eyeRef.current;
    measureRef.current ??= document.createElement("canvas").getContext("2d");
    const ctx = measureRef.current;
    if (!eye || !ctx) return;
    const style = getComputedStyle(input);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const typed = input.value.slice(0, input.selectionStart ?? input.value.length);
    const caret = parseFloat(style.paddingLeft) + ctx.measureText(input.type === "password" ? "\u2022".repeat(typed.length) : typed).width - input.scrollLeft;
    const distance = Math.min(1, Math.max(0, (input.clientWidth - 30 - caret) / (input.clientWidth * 0.75)));
    eye.style.setProperty("--look-x", `${(-4.4 * distance).toFixed(2)}px`);
    eye.style.setProperty("--look-y", up ? "-1.6px" : ".7px");
    eye.dataset.looking = "true";
    if (lookTimer.current !== null) clearTimeout(lookTimer.current);
    lookTimer.current = window.setTimeout(() => { delete eye.dataset.looking; }, 900);
  }

  const progress = /^\S+@\S+\.\S+$/.test(email.trim()) ? (hasPassword ? 2 : 1) : 0;
  useEffect(() => {
    const stage = formRef.current?.closest<HTMLElement>(".login-v2");
    if (!stage) return;
    stage.dataset.progress = String(progress);
    if (pending) stage.dataset.stage = "submitting";
    else if (stage.dataset.stage === "submitting") delete stage.dataset.stage;
  }, [progress, pending]);

  useEffect(() => {
    setHasPassword(Boolean(passwordRef.current?.value));
    if (state.kind !== "credentials" && !state.lockedUntil) return;
    const stage = formRef.current?.closest<HTMLElement>(".login-v2");
    const eye = eyeRef.current;
    if (stage) stage.dataset.stage = "rejected";
    if (eye) eye.dataset.reject = "true";
    const timer = window.setTimeout(() => {
      if (stage?.dataset.stage === "rejected") delete stage.dataset.stage;
      if (eye) delete eye.dataset.reject;
    }, 700);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus();
    else if (state.fieldErrors?.password) passwordRef.current?.focus();
    else if (state.error || state.lockedUntil) errorRef.current?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} noValidate aria-busy={pending} className="auth-form" onSubmit={() => setShowPassword(false)}>
      {deactivated && !error && <Notice title="Account deactivated" body="Contact Ahmed Emad to request access again." />}
      <fieldset disabled={pending} className="auth-fields">
        <div className="auth-field">
          <Label htmlFor="email">Work email</Label>
          <div className="auth-input-wrap">
            <Mail aria-hidden="true" className="auth-input-icon" />
            <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="you@company.com" required spellCheck={false} autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} onInput={(event) => lookAtCaret(event.currentTarget, true)} onFocus={(event) => lookAtCaret(event.currentTarget, true)} aria-invalid={Boolean(fieldErrors?.email) || undefined} aria-describedby={fieldErrors?.email ? "email-error" : undefined} />
          </div>
          {fieldErrors?.email && <p id="email-error" role="alert" className="auth-field-error">{fieldErrors.email}</p>}
        </div>
        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
          <div className="auth-input-wrap">
            <LockKeyhole aria-hidden="true" className="auth-input-icon" />
            <Input ref={passwordRef} id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" className="auth-password-input" aria-describedby={[fieldErrors?.password && "password-error", capsLock && "password-caps"].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(fieldErrors?.password) || undefined} onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))} onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))} onInput={(event) => setHasPassword(Boolean(event.currentTarget.value))} onSelect={(event) => lookAtCaret(event.currentTarget)} onBlur={() => setCapsLock(false)} />
            <button ref={eyeRef} type="button" className="auth-password-toggle" data-open={showPassword} data-caps={capsLock} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><PasswordEye /></button>
          </div>
          {capsLock && <p id="password-caps" aria-live="polite" className="auth-caps-warning"><ArrowBigUpDash aria-hidden="true" />Caps Lock is on.</p>}
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

function PasswordEye() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="auth-eye">
    <g className="auth-eye-open"><g className="auth-eye-blink">
      <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12Z" />
      <g className="auth-eye-iris"><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none" /><circle cx="13.2" cy="10.8" r="1" fill="#fff" stroke="none" /></g>
    </g></g>
    <g className="auth-eye-closed">
      <path d="M3 10.5c2.5 3.4 5.6 5.1 9 5.1s6.5-1.7 9-5.1" />
      <path d="M6.3 14.2 5 16.3M12 15.6v2.5M17.7 14.2l1.3 2.1" />
    </g>
  </svg>;
}
