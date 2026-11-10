"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return <span className="desk-copy-wrap"><button type="button" className="desk-copy" aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(value); setState("copied"); } catch { setState("failed"); } }}>{state === "copied" ? <Check size={13} /> : <Copy size={13} />}</button><span role="status">{state === "copied" ? "Copied" : state === "failed" ? "Select and copy manually" : ""}</span></span>;
}
