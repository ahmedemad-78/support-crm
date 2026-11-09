"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-md bg-brand-action px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending && <LoaderCircle size={15} className="animate-spin" />}{pending ? "Saving…" : children}</button>;
}
