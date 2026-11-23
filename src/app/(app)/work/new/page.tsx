import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { workContext } from "@/lib/work/data";
import { PageHeader } from "@/components/app-shell/page-header";
import { WorkIntake } from "@/components/work/intake";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import "../work.css";
export default async function CreateWorkPage() {
  const user = await requireUser();
  const db = await createClient();
  const [context, cities] = await Promise.all([
    workContext(),
    db
      .from("cities")
      .select("id,name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);
  if (cities.error) throw cities.error;
  return (
    <>
      <PageHeader title="Create ticket" />
      <WorkIntake
        user={user}
        context={context}
        cities={cities.data ?? []}
        today={cairoDate(new Date().toISOString())}
      />
    </>
  );
}
