import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireUser } from "@/lib/auth/session";

export default async function TicketsPage() {
  await requireUser(["support_agent", "manager"]);
  return (
    <>
      <PageHeader title="Tickets" />
      <ComingSoon title="The tickets list" milestone="M3" />
    </>
  );
}
