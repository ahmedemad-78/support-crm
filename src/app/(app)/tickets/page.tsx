import { TicketQueue } from "@/components/tickets/ticket-queue";
import "./workspace.css";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { dashboardQuery } from "@/lib/tickets/filters";
import { loadCaseRegister } from "@/lib/tickets/load-case-register";
export default async function TicketsPage({searchParams}: PageProps<"/tickets">) {
  const user=await requireUser(["support_agent","manager"]);
  const data=await loadCaseRegister(await searchParams,user);
  return <AgentFrame title="Case register" hideTicketSearch><TicketQueue {...data} canCreate={user.role==="support_agent"} reportHref={data.scope ? `/dashboard${dashboardQuery(data.dashboardFilters)}` : undefined}/></AgentFrame>;
}
