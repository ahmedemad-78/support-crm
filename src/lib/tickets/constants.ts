export const TICKET_STATUSES = ["new", "in_progress", "awaiting_customer", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  awaiting_customer: "Awaiting Customer Reply",
  resolved: "Resolved",
  closed: "Closed - No Response",
};

export const STATUS_STYLES: Record<TicketStatus, { chip: string; dot: string }> = {
  new: { chip: "bg-status-new-bg text-status-new", dot: "bg-status-new" },
  in_progress: { chip: "bg-status-progress-bg text-status-progress", dot: "bg-status-progress" },
  awaiting_customer: { chip: "bg-status-awaiting-bg text-status-awaiting", dot: "bg-status-awaiting" },
  resolved: { chip: "bg-status-resolved-bg text-status-resolved", dot: "bg-status-resolved" },
  closed: { chip: "bg-status-closed-bg text-status-closed", dot: "bg-status-closed" },
};

export const TICKET_SOURCES = [
  "whatsapp",
  "moderation",
  "call_center",
  "marketing_team",
  "june_schools",
  "business_development",
  "google_play",
] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];
export const SOURCE_LABELS: Record<TicketSource, string> = {
  whatsapp: "WhatsApp",
  moderation: "Moderation",
  call_center: "Call",
  marketing_team: "Marketing Team",
  june_schools: "30 June Schools",
  business_development: "B2B Schools",
  google_play: "Google Play",
};

export function sourceLabel(code: string): string {
  return (SOURCE_LABELS as Record<string, string>)[code] ?? code;
}

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
