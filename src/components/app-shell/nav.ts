import type { CurrentUser } from "@/lib/auth/roles";

export type NavIcon = "inbox" | "tickets" | "dashboard" | "users" | "settings" | "new-ticket" | "my-tickets";
export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { heading: string; items: NavItem[] };

export function navFor(user: CurrentUser): NavSection[] {
  switch (user.role) {
    case "support_agent": {
      const sections: NavSection[] = [
        {
          heading: "Support",
          items: [
            { href: "/inbox", label: "Inbox", icon: "inbox" },
            { href: "/tickets", label: "Tickets", icon: "tickets" },
            { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
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
      return [
        {
          heading: user.role === "moderation" ? "Moderation" : "Call Center",
          items: [
            { href: "/portal/new-ticket", label: "New ticket", icon: "new-ticket" },
            { href: "/portal/my-tickets", label: "My tickets", icon: "my-tickets" },
          ],
        },
      ];
  }
}
