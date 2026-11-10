"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SaveButton({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-md bg-brand-action px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{pending && <LoaderCircle size={15} className="animate-spin" />}{pending ? "Saving…" : children}</button>;
}
