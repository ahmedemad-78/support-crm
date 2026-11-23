import { isPortalRole, ROLE_LABELS, type CurrentUser } from "@/lib/auth/roles";

export type NavIcon = "inbox" | "tickets" | "dashboard" | "users" | "settings" | "new-ticket" | "my-tickets";
export type NavItem = { href: string; label: string; icon: NavIcon; badge?: string };
export type NavSection = { heading: string; items: NavItem[] };

export function navItemActive(pathname: string, href: string, hrefs: string[]) {
  if (pathname === href) return true;
  if (!href || !pathname.startsWith(`${href}/`)) return false;
  return !hrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

export function navFor(user: CurrentUser): NavSection[] {
  switch (user.role) {
    case "support_agent": {
      const sections: NavSection[] = [
        {
          heading: "Support",
          items: [
            { href: "/tickets", label: "Ticket register", icon: "tickets" },
            { href: "/dashboard", label: "Legacy analysis", icon: "dashboard" },
            { href: "/work/new", label: "Create ticket", icon: "new-ticket" },
            { href: "/reports/work", label: "Work reports", icon: "dashboard" },
            { href: "/inbox", label: "Conversations", icon: "inbox", badge: "Soon" },
          ],
        },
      ];
      if (user.isAdmin) {
        sections.push({
          heading: "Admin",
          items: [
            { href: "/admin/users", label: "Users", icon: "users" },
            { href: "/admin/departments", label: "Departments", icon: "users" },
            { href: "/reports/performance", label: "Team performance", icon: "dashboard" },
            { href: "/admin/settings", label: "Settings", icon: "settings" },
          ],
        });
      }
      return sections;
    }
    case "manager":
      return [
        {
          heading: "Reports",
          items: [
            { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
            { href: "/tickets", label: "Tickets", icon: "tickets" },
            { href: "/work/new", label: "Create ticket", icon: "new-ticket" },
            { href: "/reports/work", label: "Work reports", icon: "dashboard" },
            { href: "/reports/performance", label: "Team performance", icon: "dashboard" },
          ],
        },
      ];
    default:
      if (!isPortalRole(user.role)) return [];
      return [
        {
          heading: ROLE_LABELS[user.role],
          items: [
            { href: "/work/new", label: "Create ticket", icon: "new-ticket" },
            { href: "/portal/my-tickets", label: "Department tickets", icon: "my-tickets" },
          ],
        },
      ];
  }
}
