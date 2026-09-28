import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileImage, FileVideo, Lock } from "lucide-react";
import { UserNotifications } from "@/components/app-shell/user-notifications";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PORTAL_ROLES } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ATTACHMENTS_BUCKET,
  END_USER_TYPE_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  type TicketStatus,
} from "@/lib/tickets/constants";

export default async function PortalTicketPage({ params }: PageProps<"/portal/my-tickets/[ticketId]">) {
  const user = await requireUser([...PORTAL_ROLES]);
  const { ticketId } = await params;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, ticket_number, status, created_at, customer_name, customer_email, school_name, credentials_username, issue_date, end_user_type, fawry_payment, platform, is_latest_version, app_version, device_type, page_screen, steps, issue_description, cities(name)",
    )
    .eq("id", ticketId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: history }, { data: attachments }] = await Promise.all([
    supabase
      .from("ticket_status_history")
      .select("id, to_status, changed_at")
      .eq("ticket_id", ticket.id)
      .order("changed_at", { ascending: false }),
    supabase.from("ticket_attachments").select("id, file_name, mime_type, storage_path").eq("ticket_id", ticket.id),
  ]);

  const signed = attachments?.length
    ? await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrls(attachments.map((a) => a.storage_path), 60 * 10)
    : { data: [] };
  const urlByPath = new Map(signed.data?.map((s) => [s.path, s.signedUrl]));

  const city = (ticket.cities as unknown as { name: string } | null)?.name ?? "—";
  const fields: [string, string][] = [
    ["Customer name", ticket.customer_name],
    ["Email", ticket.customer_email ?? "—"],
    ["User type", ticket.end_user_type ? END_USER_TYPE_LABELS[ticket.end_user_type as keyof typeof END_USER_TYPE_LABELS] : "—"],
    ["User name", ticket.credentials_username ?? "—"],
    ["School", ticket.school_name ?? "—"],
    ["City", city],
    ["Platform", ticket.platform ? PLATFORM_LABELS[ticket.platform as keyof typeof PLATFORM_LABELS] : "—"],
    ["Device", ticket.device_type ?? "—"],
    ["App version", `${ticket.app_version ?? "—"}${ticket.is_latest_version === false ? " (not latest)" : ""}`],
    ["Fawry payment", ticket.fawry_payment == null ? "—" : ticket.fawry_payment ? "Yes" : "No"],
    ["Date of issue", ticket.issue_date ? formatDate(ticket.issue_date) : "—"],
    ["Page / screen", ticket.page_screen ?? "—"],
  ];

  const status = ticket.status as TicketStatus;
  const reached = new Map((history ?? []).map((h) => [h.to_status as TicketStatus, h.changed_at]));
  const nextStep: TicketStatus | null = status === "resolved" || status === "closed" ? null : "resolved";

  return (
    <>
      <header className="flex flex-col gap-3 border-b bg-background px-8 py-5">
        <div className="flex items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 text-[13px]">
          <Link href="/portal/my-tickets" className="font-medium text-muted-foreground hover:text-foreground">
            My tickets
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span className="font-mono font-medium">{ticket.ticket_number}</span>
        </nav>
        <UserNotifications />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold tracking-tight">{ticket.issue_description}</h1>
          <StatusBadge status={status} size="lg" />
        </div>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Lock className="size-3.5" />
          Submitted {formatDateTime(ticket.created_at)} · read-only. The Support team updates the status.
        </p>
      </header>

      <div className="flex flex-1 flex-col items-stretch gap-6 px-4 py-6 sm:px-8 xl:flex-row xl:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl border bg-background p-6">
          <h2 className="text-base font-semibold">What you submitted</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 2xl:grid-cols-3">
            {fields.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <hr />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Steps to reproduce</p>
            <p className="max-w-2xl text-sm leading-[22px] whitespace-pre-wrap">{ticket.steps}</p>
          </div>
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {attachments.map((a) => {
                const Icon = a.mime_type.startsWith("video/") ? FileVideo : FileImage;
                return (
                  <a
                    key={a.id}
                    href={urlByPath.get(a.storage_path) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium hover:bg-muted"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {a.file_name}
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex w-full shrink-0 xl:w-[300px] flex-col gap-4 rounded-xl border bg-background p-5">
          <h2 className="text-base font-semibold">Status updates</h2>
          {nextStep && <TimelineStep status={nextStep} meta="Waiting" done={false} />}
          {(history ?? []).map((h) => (
            <TimelineStep
              key={h.id}
              status={h.to_status as TicketStatus}
              meta={formatDateTime(h.changed_at)}
              done
            />
          ))}
          {reached.size === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
          <p className="pt-1 text-xs leading-[18px] text-muted-foreground">
            Agent names and internal notes stay with the Support team.
          </p>
        </aside>
      </div>
    </>
  );
}

function TimelineStep({ status, meta, done }: { status: TicketStatus; meta: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-[5px] size-2.5 shrink-0 rounded-full",
          done ? STATUS_STYLES[status].dot : "border-2 border-border bg-background",
        )}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
    </div>
  );
}
