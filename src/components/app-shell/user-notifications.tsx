import { isPortalRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { loadNotifications } from "@/lib/notifications/load";
import { NotificationBell } from "./notification-bell";

export async function UserNotifications() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { items, unreadCount } = await loadNotifications(user.id, user.role);
  const portal = isPortalRole(user.role);
  return (
    <NotificationBell
      userId={user.id}
      hrefBase={portal ? "/portal/my-tickets" : "/tickets"}
      initial={items}
      unreadCount={unreadCount}
      hint={
        portal
          ? "A status change on your ticket also sends you an email."
          : "New tickets appear here. Status changes are emailed to the person who opened the ticket."
      }
    />
  );
}
