import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { workContext } from "@/lib/work/data";
import { DepartmentAdmin } from "@/components/work/departments";
import { PageHeader } from "@/components/app-shell/page-header";
import "../../work/work.css";
export default async function DepartmentsPage() {
  await requireAdmin();
  const db = await createClient();
  const [context, sources] = await Promise.all([
    workContext(),
    db
      .from("ticket_sources")
      .select("code,name")
      .eq("is_active", true)
      .order("name"),
  ]);
  if (sources.error) throw sources.error;
  return (
    <>
      <PageHeader title="Departments & membership" />
      <DepartmentAdmin context={context} sources={sources.data ?? []} />
    </>
  );
}
