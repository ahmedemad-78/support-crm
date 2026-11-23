import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/app-shell/page-header";
import { AttachmentPreview } from "@/components/tickets/attachment-preview";
import { WorkActions } from "@/components/work/actions";
import { WorkReadMarker, WorkRefresh } from "@/components/work/refresh";
import { loadWorkTicket } from "@/lib/work/data";
import { WORK_STATE_LABELS } from "@/lib/work/types";
import "../work.css";
export default async function WorkTicketPage({
  params,
}: PageProps<"/work/[ticketId]">) {
  const user = await requireUser();
  const { ticketId } = await params;
  if (!z.uuid().safeParse(ticketId).success) notFound();
  const data = await loadWorkTicket(ticketId);
  if (!data) notFound();
  const { ticket, context, events, files, catalogs, controls, resolutions } =
    data;
  const name = (id: string | null) =>
    context.people.find((p) => p.id === id)?.name ||
    data.people.find((p) => p.id === id)?.name ||
    "Team member";
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  const detailLabels: Record<string, string> = {
    customer_name: "Customer",
    customer_email: "Contact email",
    customer_phone: "Contact phone",
    city_name: "City",
    end_user_type: "Customer type",
    fawry_payment: "Fawry payment",
    is_latest_version: "Latest app version",
    school_name: "School",
    credentials_username: "Account identifier",
    issue_date: "Reported date",
    platform: "Platform",
    app_version: "App version",
    device_type: "Device",
    page_screen: "Page / screen",
    steps: "Steps to reproduce",
    city_other: "City / country",
    school_issue_area: "School issue area",
    school_update_requested: "Update requested",
    school_code: "School code",
    school_user_ids: "School user identifiers",
  };
  const externalDetails = {
    ...ticket.external_data,
    city_name: data.cityName,
  } as Record<string, unknown>;
  const externalValue = (key: string) =>
    ["fawry_payment", "is_latest_version"].includes(key)
      ? externalDetails[key] == null
        ? "Unknown / not applicable"
        : externalDetails[key]
          ? "Yes"
          : "No"
      : String(externalDetails[key]);
  return (
    <>
      <PageHeader
        title={ticket.ticket_number}
        actions={
          <Link
            className="work-btn secondary"
            href={
              user.role === "support_agent" || user.role === "manager"
                ? "/tickets"
                : "/portal/my-tickets"
            }
          >
            Back to tickets
          </Link>
        }
      />
      <WorkRefresh />
      <div className="work-page">
        <section className="work-panel">
          <p className="work-original">
            Original request · {ticket.domain} ·{" "}
            {ticket.kind === "problem" ? "Problem" : "Work request"}
          </p>
          <h1 className="text-2xl font-semibold mt-2 mb-3" dir="auto">
            {ticket.title}
          </h1>
          <div className="work-meta">
            <span>
              Owner: <strong>{name(ticket.owner_id)}</strong>
            </span>
            <span>
              Department:{" "}
              <strong>
                {
                  context.departments.find((d) => d.id === ticket.department_id)
                    ?.name
                }
              </strong>
            </span>
            <span>
              Recorded by: <strong>{name(ticket.recorded_by_id)}</strong>
            </span>
            <span>Created: {stamp(ticket.created_at)}</span>
          </div>
          <div className="work-actions">
            <span className="work-status" data-state={ticket.state}>
              {WORK_STATE_LABELS[ticket.state]}
            </span>
            <span className="work-muted">
              {ticket.current_worker_id
                ? "Working: " + name(ticket.current_worker_id)
                : ticket.pending_worker_id
                  ? "Awaiting start: " + name(ticket.pending_worker_id)
                  : "Available / finished"}
            </span>
            {ticket.reopen_count > 0 && (
              <span className="work-muted">
                Reopened {ticket.reopen_count} time(s)
              </span>
            )}
          </div>
          <p className="work-description mt-5" dir="auto">
            {ticket.description}
          </p>
          {typeof ticket.optional_details.details === "string" && (
            <p className="work-description mt-4" dir="auto">
              {ticket.optional_details.details}
            </p>
          )}
          {ticket.domain === "external" && (
            <dl className="work-pairs">
              {Object.entries(detailLabels).flatMap(([key, label]) =>
                (externalDetails[key] != null ||
                  ["fawry_payment", "is_latest_version"].includes(key)) &&
                externalDetails[key] !== ""
                  ? [
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd dir="auto">{externalValue(key)}</dd>
                      </div>,
                    ]
                  : [],
              )}
            </dl>
          )}
        </section>
        <WorkActions
          ticket={ticket}
          context={context}
          catalogs={catalogs}
          controls={controls}
          user={user}
        />
        <section className="work-panel">
          <h2>Conversation & activity</h2>
          <WorkReadMarker ids={data.noticeIds} />
          {events.map((event) => (
            <article
              className="work-event"
              data-private={event.visibility === "internal"}
              key={event.id}
            >
              <header>
                <strong>{name(event.actor_id)}</strong>
                <span>
                  {event.kind === "controls"
                    ? "Team planning updated"
                    : event.visibility === "internal"
                      ? "Internal note"
                      : event.kind.replaceAll("_", " ")}
                </span>
                <time dateTime={event.created_at}>
                  {stamp(event.created_at)}
                </time>
              </header>
              {event.body && (
                <p className="work-description" dir="auto">
                  {event.body}
                </p>
              )}
              {event.from_state !== event.to_state && (
                <p className="work-muted">
                  {event.from_state
                    ? WORK_STATE_LABELS[
                        event.from_state as keyof typeof WORK_STATE_LABELS
                      ]
                    : ""}{" "}
                  →{" "}
                  {event.to_state
                    ? WORK_STATE_LABELS[
                        event.to_state as keyof typeof WORK_STATE_LABELS
                      ]
                    : ""}
                </p>
              )}
              <div className="work-media">
                {files
                  .filter((f) => f.event_id === event.id)
                  .map((f) => (
                    <AttachmentPreview key={f.id} attachment={f} />
                  ))}
              </div>
            </article>
          ))}
        </section>
        {resolutions.length > 0 && (
          <details className="work-panel">
            <summary className="cursor-pointer font-semibold">
              Resolution history ({resolutions.length})
            </summary>
            {resolutions.map((r) => (
              <article key={r.id} className="mt-5">
                <p className="work-muted">
                  Cycle {r.cycle + 1} · Credited to {name(r.resolver_credit_id)}{" "}
                  · {stamp(r.created_at)}
                </p>
                <p className="work-description" dir="auto">
                  {r.response}
                </p>
                <dl className="work-pairs">
                  {Object.entries(r.classification).map(([key, v]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>{v.name}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </details>
        )}
      </div>
    </>
  );
}
