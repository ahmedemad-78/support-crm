import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireUser } from "@/lib/auth/session";

export default async function InboxPage() {
  await requireUser(["support_agent"]);
  return (
    <>
      <PageHeader title="Inbox" />
      <ComingSoon title="The WhatsApp inbox" milestone="M5" />
    </>
  );
}
