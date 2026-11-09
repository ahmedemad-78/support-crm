import Link from "next/link";
import { ArrowUpRight, MessageCircle, Unplug } from "lucide-react";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";

export default async function InboxPage() {
  await requireUser(["support_agent"]);
  return <AgentFrame title="Conversations"><div className="conversation-workspace">
    <div className="queue-heading"><div><span className="cs-report-label">WORKSPACE / CONVERSATIONS</span><h2>A conversation starts<br />with a connection.</h2><p>WhatsApp is not connected to this workspace yet.</p></div><span className="connection-state"><Unplug size={14} /> Not connected</span></div>
    <section className="conversation-offline"><div className="conversation-symbol"><MessageCircle size={40} strokeWidth={1.3} /></div><div><span className="cs-report-label">WHATSAPP INBOX</span><h3>The case queue is ready for work.</h3><p>Keep recording requests, assigning owners, and following up in Cases. Conversations will become available after the WhatsApp integration is configured.</p><div className="mt-6 flex flex-wrap gap-3"><Link className="queue-create" href="/tickets">Open case queue <ArrowUpRight size={15} /></Link><Link className="inline-flex items-center px-3 py-2 text-sm font-medium text-brand-action underline underline-offset-4" href="/tickets/new">Record a request</Link></div></div></section>
    <p className="text-xs leading-6 text-muted-foreground">For WhatsApp connection setup, contact the workspace administrator or Digital Team.</p>
  </div></AgentFrame>;
}
