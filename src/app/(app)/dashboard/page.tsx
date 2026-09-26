import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  await requireUser(["support_agent", "manager"]);
  return (
    <>
      <PageHeader title="Dashboard" />
      <ComingSoon title="The dashboard" milestone="a later milestone, once tickets exist" />
    </>
  );
}
