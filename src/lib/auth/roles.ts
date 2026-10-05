export const ROLES = [
  "support_agent",
  "moderation",
  "call_center",
  "june_schools",
  "business_development",
  "manager",
] as const;
export type Role = (typeof ROLES)[number];

/** Same portal: new-ticket form and their own tickets only. */
export const PORTAL_ROLES = ["moderation", "call_center", "june_schools", "business_development"] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export function isPortalRole(role: Role): role is PortalRole {
  return (PORTAL_ROLES as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  support_agent: "Technical Support",
  moderation: "Moderation",
  call_center: "Call Center",
  june_schools: "30 June Schools",
  business_development: "B2B Schools",
  manager: "Manager",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  support_agent: "Inbox, all tickets, status changes, dashboard",
  moderation: "New ticket form and own tickets",
  call_center: "New ticket form and own tickets",
  june_schools: "New ticket form and own tickets",
  business_development: "New ticket form and own tickets",
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
