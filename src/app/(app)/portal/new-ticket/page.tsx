import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireUser } from "@/lib/auth/session";
import { PORTAL_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { NewTicketForm } from "./new-ticket-form";
import { cairoDate } from "@/lib/tickets/dashboard-model";

export default async function NewTicketPage({ searchParams }: PageProps<"/portal/new-ticket">) {
  const user = await requireUser([...PORTAL_ROLES]);
  const params = await searchParams;
  const linked = typeof params.linked === "string" && z.uuid().safeParse(params.linked).success ? params.linked : "";
  const supabase = await createClient();
  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="New ticket"
        actions={
          <div className="flex flex-1 items-center justify-between">
            <span className="rounded-full bg-status-awaiting-bg px-2.5 py-0.5 text-xs font-semibold text-status-awaiting">
              Reported by: {ROLE_LABELS[user.role]}
            </span>
            <span className="text-sm text-muted-foreground">All fields are required unless marked optional</span>
          </div>
        }
      />
      <NewTicketForm linkedTicketId={linked} cities={cities ?? []} today={cairoDate(new Date().toISOString())} />
    </>
  );
}
