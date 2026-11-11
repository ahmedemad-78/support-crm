import { PageHeader } from "@/components/app-shell/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SettingsTabs } from "./settings-tabs";
import { mailConfigured } from "@/lib/email/send";
import { MailTestPanel } from "./mail-test-panel";

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: deliveryPolicy, error: deliveryPolicyError } = await supabase.from("app_settings").select("value").eq("key", "workflow_notifications").maybeSingle();
  if (deliveryPolicyError) throw deliveryPolicyError;

  const [cities, categories, causes, requestTypes, topics, trackerCauses, trackerActions, outcomes, sources] =
    await Promise.all([
      supabase.from("cities").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("issue_categories").select("id, name, is_active").order("name"),
      supabase.from("root_causes").select("id, name, is_active").order("name"),
      supabase.from("request_types").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("topics").select("id, name, is_active").order("name"),
      supabase.from("tracker_causes").select("id, name, is_active").order("name"),
      supabase.from("tracker_actions").select("id, name, is_active").order("name"),
      supabase.from("outcomes").select("id, name, is_active").order("name"),
      supabase.from("ticket_sources").select("code, name, is_active, bound_role").order("sort_order").order("name"),
    ]);

  for (const result of [cities, categories, causes, requestTypes, topics, trackerCauses, trackerActions, outcomes, sources]) {
    if (result.error) throw result.error;
  }

  return (
    <>
      <PageHeader title="Settings" />
      <MailTestPanel configured={mailConfigured()} recipient={String(deliveryPolicy?.value?.email || "")} />
      <SettingsTabs
        lists={{
          cities: cities.data ?? [],
          issue_categories: categories.data ?? [],
          root_causes: causes.data ?? [],
          request_types: requestTypes.data ?? [],
          topics: topics.data ?? [],
          tracker_causes: trackerCauses.data ?? [],
          tracker_actions: trackerActions.data ?? [],
          outcomes: outcomes.data ?? [],
        }}
        sources={sources.data ?? []}
        notificationRecipient={String(deliveryPolicy?.value?.email || "")}
      />
    </>
  );
}
