import { createAdminClient } from "@/lib/supabase/admin";
import { isPortalRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { loadNotifications } from "@/lib/notifications/load";
import { NotificationBell } from "./notification-bell";

export async function UserNotifications() {
  const user = await getCurrentUser();
  if (!user) return null;
  const {data: policy} = await createAdminClient().from("app_settings").select("value").eq("key","workflow_notifications").maybeSingle();
  if(policy?.value?.mode === "central_only" && policy.value.recipient_id !== user.id) return null;
  const { items, unreadCount } = await loadNotifications(user.id, user.role);
  const portal = isPortalRole(user.role);
  return (
    <NotificationBell key={`${user.id}:${items[0]?.id || "empty"}:${unreadCount}`}
      userId={user.id}
      hrefBase={portal ? "/portal/my-tickets" : "/tickets"}
      initial={items}
      unreadCount={unreadCount}
      hint={
        portal
          ? "A status change on your ticket also sends you an email."
          : "Rollout mode: new cases, solutions, comments and reopened cases notify Ahmed only."
      }
    />
  );
}
