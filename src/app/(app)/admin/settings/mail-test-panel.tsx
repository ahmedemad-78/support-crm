"use client";
import { useState, useTransition } from "react";
import { sendTestNotification } from "./mail-test-actions";

export function MailTestPanel({ configured, recipient }: { configured: boolean; recipient: string }) {
  const [result, setResult] = useState<{ok:boolean;message:string} | null>(null);
  const [pending, startTransition] = useTransition();
  return <section className="mx-4 my-5 rounded-xl border bg-background p-5 sm:mx-8" aria-labelledby="mail-test-title">
    <h2 id="mail-test-title" className="text-base font-semibold">Notification delivery test</h2>
    <p className="mt-2 text-sm text-muted-foreground">Rollout recipient: <strong>{recipient || "Not configured"}</strong>. Sends one test message without creating a case or processing queued mail.</p>
    <p className="mt-2 text-xs text-muted-foreground">{configured ? "An email provider is configured on this deployment." : "Email delivery is not configured. Contact the workspace administrator."}</p>
    <button type="button" className="mt-4 min-h-11 rounded-md bg-brand-action px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!configured || pending || Boolean(result?.ok)} onClick={()=>{setResult(null);startTransition(async()=>{try{setResult(await sendTestNotification());}catch{setResult({ok:false,message:"Could not confirm the send. Check your mailbox before trying again."});}});}}>{pending ? "Sending one test…" : result?.ok ? "Test sent — check your mailbox" : "Send one test email"}</button>
    {result && <p role={result.ok ? "status" : "alert"} className={`mt-3 text-sm break-words ${result.ok ? "text-brand-action" : "text-destructive"}`}>{result.message}</p>}
  </section>;
}
