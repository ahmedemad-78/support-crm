export const TICKET_STATUSES = ["new", "in_progress", "awaiting_customer", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  awaiting_customer: "Awaiting Customer",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_STYLES: Record<TicketStatus, { chip: string; dot: string }> = {
  new: { chip: "bg-status-new-bg text-status-new", dot: "bg-status-new" },
  in_progress: { chip: "bg-status-progress-bg text-status-progress", dot: "bg-status-progress" },
  awaiting_customer: { chip: "bg-status-awaiting-bg text-status-awaiting", dot: "bg-status-awaiting" },
  resolved: { chip: "bg-status-resolved-bg text-status-resolved", dot: "bg-status-resolved" },
  closed: { chip: "bg-status-closed-bg text-status-closed", dot: "bg-status-closed" },
};

export type TicketSource = "whatsapp" | "moderation" | "call_center";
export const SOURCE_LABELS: Record<TicketSource, string> = {
  whatsapp: "WhatsApp",
  moderation: "Moderation",
  call_center: "Call Center",
};

export const END_USER_TYPES = ["student", "teacher", "parent", "other"] as const;
export const END_USER_TYPE_LABELS: Record<(typeof END_USER_TYPES)[number], string> = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
  other: "Other",
};

export const PLATFORMS = ["android", "ios", "huawei", "web"] as const;
export const PLATFORM_LABELS: Record<(typeof PLATFORMS)[number], string> = {
  android: "Android",
  ios: "iOS",
  huawei: "Huawei",
  web: "Web",
};

export const ATTACHMENT_RULES = {
  maxFiles: 5,
  types: {
    "image/jpeg": 10 * 1024 * 1024,
    "image/png": 10 * 1024 * 1024,
    "video/mp4": 50 * 1024 * 1024,
    "video/quicktime": 50 * 1024 * 1024,
  } as Record<string, number>,
  accept: "image/jpeg,image/png,video/mp4,video/quicktime",
};

export const ATTACHMENTS_BUCKET = "ticket-attachments";
