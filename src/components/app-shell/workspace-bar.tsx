"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Mail, Search } from "lucide-react";
import { SOURCE_LABELS, type TicketSource } from "@/lib/tickets/constants";
import { formatRelative } from "@/lib/format";

export type TicketAlert = {
  id: string;
  ticketNumber: string;
  source: TicketSource;
  summary: string;
  createdAt: string;
};

export function WorkspaceBar({ title, alerts }: { title: string; alerts: TicketAlert[] }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-5 sm:px-8">
      <h1 className="shrink-0 text-xl font-semibold tracking-tight">{title}</h1>
      <form action="/tickets" className="ml-auto hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted px-3 sm:flex">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          name="q"
          placeholder="Search by ticket ID, name, phone…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-label={alerts.length ? `Notifications, ${alerts.length} new tickets` : "Notifications"}
          onClick={() => setOpen((value) => !value)}
          className="relative rounded-lg p-2 hover:bg-muted"
        >
          <Bell className="size-5" />
          {alerts.length > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {alerts.length}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute top-12 right-0 z-30 w-[min(92vw,400px)] overflow-hidden rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <span className="text-xs font-medium text-muted-foreground">New tickets</span>
            </div>
            {alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No new tickets.</p>
            ) : (
              <ul>
                {alerts.map((alert) => (
                  <li key={alert.id} className="border-b last:border-b-0">
                    <Link
                      href={`/tickets/${alert.id}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 hover:bg-muted"
                    >
                      <span className="mt-0.5 size-2 shrink-0 rounded-full bg-status-new" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {alert.ticketNumber} · {SOURCE_LABELS[alert.source]}
                        </span>
                        <span className="block truncate text-[13px] text-muted-foreground">{alert.summary}</span>
                        <span className="block text-xs text-muted-foreground">{formatRelative(alert.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-2 border-t bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
              <Mail className="mt-0.5 size-3.5 shrink-0" />
              Each new ticket is also emailed to support@selaheltelmeez.com
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
