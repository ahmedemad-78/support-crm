"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type SignInState } from "./actions";

export function LoginForm({ deactivated }: { deactivated: boolean }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});
  const minutesLeft = useMinutesUntil(state.lockedUntil);
  const locked = minutesLeft > 0;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} aria-busy={pending} className="flex flex-col gap-5">
      {deactivated && !state.error && (
        <Notice title="Your account is deactivated" body="Contact the Digital Team to reactivate it." />
      )}
      {locked && (
        <Notice
          title="Account temporarily locked"
          body={`Too many wrong passwords. Try again in ${minutesLeft} ${minutesLeft === 1 ? "minute" : "minutes"}, or contact the Digital Team to unlock it now.`}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Work email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            defaultValue={state.email}
            className="h-11 pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className="h-11 pr-12 pl-9"
            aria-describedby={state.error ? "signin-error" : undefined}
            aria-invalid={Boolean(state.error) || undefined}
          />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-brand-action">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {state.error && <p id="signin-error" role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
      </div>

      <Button type="submit" size="lg" className="h-11 text-[15px] font-semibold" disabled={pending || locked}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign in to workspace"}
        {!pending && <ArrowRight className="ml-auto transition-transform group-hover/button:translate-x-1" />}
      </Button>
    </form>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-lg border border-[#f3c7c9] bg-[#fdecec] p-3.5">
      <Lock className="mt-0.5 size-[18px] shrink-0 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[13px] leading-5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function useMinutesUntil(iso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}
