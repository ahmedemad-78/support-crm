export const ROLES = [
  "support_agent",
  "moderation",
  "call_center",
  "june_schools",
  "business_development",
  "manager",
  "department_member",
] as const;
export type Role = (typeof ROLES)[number];

/** Department portal; legacy tickets retain their existing visibility rules. */
export const PORTAL_ROLES = [
  "moderation",
  "call_center",
  "june_schools",
  "business_development",
  "department_member",
] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export function isPortalRole(role: Role): role is PortalRole {
  return (PORTAL_ROLES as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  support_agent: "Technical Team",
  moderation: "Moderation",
  call_center: "Call Center",
  june_schools: "30 June Schools",
  business_development: "B2B Schools",
  manager: "Manager",
  department_member: "Department representative",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  support_agent: "Inbox, all tickets, status changes, dashboard",
  moderation: "Department tickets; owner actions on your own requests",
  call_center: "Department tickets; owner actions on your own requests",
  june_schools: "Department tickets; owner actions on your own requests",
  business_development:
    "Department tickets; owner actions on your own requests",
  manager: "All tickets and reports; owner actions on your own requests",
  department_member: "Department tickets; owner actions on your own requests",
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
      return "/tickets";
    case "manager":
      return "/dashboard";
    default:
      return "/portal/my-tickets";
  }
}
