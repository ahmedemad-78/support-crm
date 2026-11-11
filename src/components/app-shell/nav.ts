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
            { href: "/tickets", label: "Case queue", icon: "tickets" },
            { href: "/dashboard", label: "Analytics", icon: "dashboard" },
            { href: "/tickets/new", label: "Create case", icon: "new-ticket" },
            { href: "/inbox", label: "Conversations", icon: "inbox", badge: "Offline" },
          ],
        },
      ];
      if (user.isAdmin) {
        sections.push({
          heading: "Admin",
          items: [
            { href: "/admin/users", label: "Users", icon: "users" },
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
          ],
        },
      ];
    default:
      if (!isPortalRole(user.role)) return [];
      return [
        {
          heading: ROLE_LABELS[user.role],
          items: [
            { href: "/portal/new-ticket", label: "Create ticket", icon: "new-ticket" },
            { href: "/portal/my-tickets", label: "My tickets", icon: "my-tickets" },
          ],
        },
      ];
  }
}
