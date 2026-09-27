import type { TicketStatus } from "@/lib/tickets/constants";

export type NotificationKind = "new_ticket" | "status_changed";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  ticketId: string;
  ticketNumber: string;
  summary: string;
  status: TicketStatus;
  createdAt: string;
  readAt: string | null;
  href: string;
};
