
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
    <NotificationBell key={`${user.id}:${items[0]?.id || "empty"}:${unreadCount}`}
      userId={user.id}
      hrefBase={portal ? "/portal/my-tickets" : "/tickets"}
      initial={items}
      unreadCount={unreadCount}
      hint={portal ? "Support replies and status changes on your tickets appear here." : "New cases, reporter replies and reopened cases appear here."}
    />
  );
}
