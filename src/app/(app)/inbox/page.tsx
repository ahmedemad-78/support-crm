import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";

export default async function InboxPage() {
  await requireUser(["support_agent"]);
  return <AgentFrame title="Conversations"><div className="conversation-workspace">
    <div className="queue-heading"><div><span className="cs-report-label">WORKSPACE / CONVERSATIONS</span><h2>Conversations</h2><p>Your conversation workspace is coming soon.</p></div><span className="connection-state">Coming soon</span></div>
    <section className="conversation-offline"><div className="conversation-symbol"><MessageCircle size={40} strokeWidth={1.3} /></div><div><span className="cs-report-label">COMING SOON</span><h3>A dedicated space for conversations.</h3><p>We’re preparing this workspace. In the meantime, continue managing cases and following up with your team in the case register.</p><div className="mt-6 flex flex-wrap gap-3"><Link className="queue-create" href="/tickets">Open case register <ArrowUpRight size={15} /></Link><Link className="inline-flex items-center px-3 py-2 text-sm font-medium text-brand-action underline underline-offset-4" href="/dashboard">Back to Analytics</Link></div></div></section>
  </div></AgentFrame>;
}
