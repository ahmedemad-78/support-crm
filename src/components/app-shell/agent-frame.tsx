import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { UserNotifications } from "./user-notifications";

export async function AgentFrame({ title, children }: { title: string; children: React.ReactNode }) {
  await requireUser(["support_agent", "manager"]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-5 sm:px-8">
        <h1 className="shrink-0 text-xl font-semibold tracking-tight">{title}</h1>
        <form action="/tickets" className="ml-auto hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted px-3 sm:flex">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            name="q"
            placeholder="Search by ticket ID, name, phone…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
        <div className="ml-auto sm:ml-0">
          <UserNotifications />
        </div>
      </header>
      {children}
    </>
  );
}
