import { PageHeader } from "@/components/app-shell/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [cities, categories, causes, emails] = await Promise.all([
    supabase.from("cities").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("issue_categories").select("id, name, is_active").order("name"),
    supabase.from("root_causes").select("id, name, is_active").order("name"),
    supabase.from("app_settings").select("value").eq("key", "notification_emails").maybeSingle(),
  ]);

  for (const result of [cities, categories, causes, emails]) {
    if (result.error) throw result.error;
  }

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs
        lists={{
          cities: cities.data ?? [],
          issue_categories: categories.data ?? [],
          root_causes: causes.data ?? [],
        }}
        notificationEmails={(emails.data?.value as string[] | undefined) ?? []}
      />
    </>
  );
}
