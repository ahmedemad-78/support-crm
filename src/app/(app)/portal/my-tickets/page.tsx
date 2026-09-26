import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/tickets/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/lib/tickets/constants";
import { formatRelative } from "@/lib/format";

export default async function MyTicketsPage({ searchParams }: PageProps<"/portal/my-tickets">) {
  const user = await requireUser(["moderation", "call_center"]);
  const { submitted } = await searchParams;

  const supabase = await createClient();
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, ticket_number, issue_description, customer_name, status, created_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="My tickets"
        actions={
          <Link href="/portal/new-ticket" className={buttonVariants({ size: "lg", className: "h-9 px-3.5" })}>
            <Plus />
            New ticket
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-5 bg-background px-8 py-5">
        {typeof submitted === "string" && (
          <div className="flex items-center gap-3 rounded-xl border border-[#bfe3cd] bg-brand-tint px-4 py-3.5">
            <CheckCircle2 className="size-5 shrink-0 text-brand-action" />
            <div className="flex flex-col">
              <p className="text-sm font-semibold">Ticket {submitted} submitted</p>
              <p className="text-[13px] text-muted-foreground">
                The Support team has been notified. You&apos;ll see status updates here.
              </p>
            </div>
          </div>
        )}

        {tickets && tickets.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="w-40 px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="w-48 px-4 py-3">Customer</th>
                    <th className="w-44 px-4 py-3">Status</th>
                    <th className="w-32 px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-muted/60">
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/portal/my-tickets/${t.id}`}
                          className="font-mono text-[13px] font-medium text-brand-action hover:underline"
                        >
                          {t.ticket_number}
                        </Link>
                      </td>
                      <td className="max-w-0 truncate px-4 py-3.5">{t.issue_description}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{t.customer_name}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={t.status as TicketStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{formatRelative(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Only tickets you submitted are shown. Status is updated by the Support team.
            </p>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Image
              src="/brand/mascot.jpg"
              alt=""
              width={200}
              height={174}
              className="h-[174px] w-auto object-contain mix-blend-multiply"
            />
            <h2 className="text-lg font-semibold">No tickets yet</h2>
            <p className="text-sm text-muted-foreground">Report a customer&apos;s problem and track it here.</p>
            <Link href="/portal/new-ticket" className={buttonVariants({ className: "mt-2" })}>
              Create your first ticket
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
