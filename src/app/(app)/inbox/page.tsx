import { MessageCircle, Search, Send } from "lucide-react";
import { AgentFrame } from "@/components/app-shell/agent-frame";
import { requireUser } from "@/lib/auth/session";
import { InboxDrawer } from "./inbox-drawer";

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  await requireUser(["support_agent"]);
  const { state } = await searchParams;
  const expired = state === "expired";

  return (
    <AgentFrame title="Inbox">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="flex flex-col border-r bg-background">
          <div className="flex items-center justify-between px-4 py-4">
            <h2 className="text-base font-semibold">Inbox</h2>
            <span className="text-xs font-medium text-muted-foreground">0 unread</span>
          </div>
          <div className="mx-4 mb-3 flex h-9 items-center gap-2 rounded-lg border bg-muted px-3">
            <Search className="size-4 text-muted-foreground" />
            <input placeholder="Search name or number" className="w-full bg-transparent text-sm outline-none" disabled />
          </div>
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No WhatsApp conversations yet. The number connects in a later step.
          </p>
        </aside>

        <section className="flex min-h-[480px] flex-col bg-muted">
          <div className="flex items-center gap-3 border-b bg-background px-5 py-4">
            <MessageCircle className="size-5 text-brand-action" />
            <div>
              <p className="text-sm font-semibold">Conversation</p>
              <p className="text-xs text-muted-foreground">
                {expired ? "The 24-hour window has expired" : "Select a conversation"}
              </p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {expired
              ? "Free-form replies are closed until the customer messages again. Send an approved template, or open a ticket from the details you already have."
              : "Messages will appear here once WhatsApp is connected."}
          </div>
          {expired ? (
            <div className="border-t bg-background p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Send template</p>
              <p className="mt-1 text-sm">Choose a template. The customer has to reply before a normal message can be sent.</p>
              <button type="button" disabled className="mt-3 h-9 rounded-lg bg-muted px-3 text-sm font-semibold text-muted-foreground">
                Templates unlock with WhatsApp
              </button>
            </div>
          ) : (
            <form className="flex items-center gap-2 border-t bg-background p-4">
              <input disabled placeholder="Write a message" className="h-10 flex-1 rounded-lg border bg-muted px-3 text-sm" />
              <button type="button" disabled className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-action text-white opacity-50" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
          )}
        </section>

        <aside className="flex flex-col gap-4 border-l bg-background p-4">
          <div>
            <h2 className="text-sm font-semibold">Customer</h2>
            <p className="mt-2 text-sm text-muted-foreground">Name, number, and linked tickets show up with the conversation.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Open tickets</h3>
            <p className="mt-2 text-sm text-muted-foreground">None linked.</p>
          </div>
          <InboxDrawer />
        </aside>
      </div>
    </AgentFrame>
  );
}
