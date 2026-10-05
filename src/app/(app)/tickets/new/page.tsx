import { PageHeader } from "@/components/app-shell/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewTicketForm } from "../../portal/new-ticket/new-ticket-form";

export default async function SupportNewTicketPage() {
  await requireUser(["support_agent"]);
  const supabase = await createClient();
  const [cities, sources] = await Promise.all([
    supabase.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("ticket_sources").select("code, name").eq("is_active", true).order("sort_order").order("name"),
  ]);
  if (cities.error) throw cities.error;
  if (sources.error) throw sources.error;

  return (
    <>
      <PageHeader
        title="New ticket"
        actions={<span className="text-sm text-muted-foreground">Same form for every source. Fawry payment is required.</span>}
      />
      <NewTicketForm cities={cities.data ?? []} sources={sources.data ?? []} cancelHref="/tickets" />
    </>
  );
}
