"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { STATUS_LABELS, STATUS_STYLES, type TicketStatus } from "@/lib/tickets/constants";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(app)/notifications/actions";
import type { AppNotification, NotificationKind } from "@/lib/notifications/types";

type Row = {
  id: string;
  kind: NotificationKind;
  ticket_id: string;
  ticket_number: string;
  summary: string;
  status: TicketStatus;
  created_at: string;
};

export function NotificationBell({
  userId,
  hrefBase,
  initial,
  unreadCount,
  hint,
}: {
  userId: string;
  hrefBase: string;
  initial: AppNotification[];
  unreadCount: number;
  hint: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(unreadCount);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Row;
          const href = row.kind === "status_changed" ? `${hrefBase}/${row.ticket_id}` : `/tickets/${row.ticket_id}`;
          setItems((current) => [
            {
              id: row.id,
              kind: row.kind,
              ticketId: row.ticket_id,
              ticketNumber: row.ticket_number,
              summary: row.summary,
              status: row.status,
              createdAt: row.created_at,
              readAt: null,
              href,
            },
            ...current.filter((item) => item.id !== row.id),
          ].slice(0, 20));
          setUnread((count) => count + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hrefBase, userId]);

  function markRead(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
    setUnread((count) => Math.max(0, count - 1));
    void markNotificationRead(id);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 hover:bg-muted"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-30 w-[min(92vw,400px)] overflow-hidden rounded-xl border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-brand-action"
                onClick={() => {
                  setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
                  setUnread(0);
                  void markAllNotificationsRead();
                }}
              >
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className="border-b last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.readAt) markRead(item.id);
                    }}
                    className="flex gap-3 px-4 py-3 hover:bg-muted"
                  >
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : STATUS_STYLES[item.status].dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {item.kind === "new_ticket"
                          ? `${item.ticketNumber} · New ticket`
                          : `${item.ticketNumber} · ${STATUS_LABELS[item.status]}`}
                      </span>
                      <span className="block truncate text-[13px] text-muted-foreground">{item.summary}</span>
                      <span className="block text-xs text-muted-foreground">{formatRelative(item.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
      )}
    </div>
  );
}
