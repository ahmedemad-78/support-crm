import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireUser } from "@/lib/auth/session";
import { PORTAL_ROLES } from "@/lib/auth/roles";
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
        title="Create ticket"
      />
      <NewTicketForm lockedSource={user.role} linkedTicketId={linked} cities={cities ?? []} today={cairoDate(new Date().toISOString())} />
    </>
  );
}
