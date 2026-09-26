export const ROLES = ["support_agent", "moderation", "call_center", "manager"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  support_agent: "Technical Support",
  moderation: "Moderation",
  call_center: "Call Center",
  manager: "Manager",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  support_agent: "Inbox, all tickets, status changes, dashboard",
  moderation: "New ticket form and own tickets",
  call_center: "New ticket form and own tickets",
  manager: "Dashboard and tickets, view only",
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isAdmin: boolean;
};

export function homePathFor(user: Pick<CurrentUser, "role">): string {
  switch (user.role) {
    case "support_agent":
      return "/inbox";
    case "manager":
      return "/dashboard";
    default:
      return "/portal/my-tickets";
  }
}
