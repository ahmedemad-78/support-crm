"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-5 px-6 py-16" role="alert"><span className="cs-report-label">WORKSPACE / UNAVAILABLE</span><h2 className="text-3xl font-medium tracking-tight">We couldn’t load this view.</h2><p className="text-sm leading-7 text-muted-foreground">The request could not be completed. Try loading it again. If your session has expired, sign in and return to your work.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={reset} className="queue-create"><RefreshCw size={15} /> Try again</button><Link href="/login" className="rounded-md border bg-white px-4 py-3 text-sm">Go to sign in</Link></div></div>;
}
