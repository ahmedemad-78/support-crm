import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { loadWorkRegister, registerParams, workContext } from "@/lib/work/data";
import {
  WORK_STATE_LABELS,
  finishedWork,
  type WorkState,
} from "@/lib/work/types";
import { STATUS_LABELS, type TicketStatus } from "@/lib/tickets/constants";
import { WorkRefresh } from "./refresh";
import "@/app/(app)/work/work.css";
export async function WorkRegister({
  raw,
  portal = false,
}: {
  raw: Record<string, string | string[] | undefined>;
  portal?: boolean;
}) {
  const filters = registerParams(raw);
  const [data, context] = await Promise.all([
    loadWorkRegister(filters),
    workContext(),
  ]);
  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page }))
      if (v && k !== "page") p.set(k, String(v));
    if (page > 1) p.set("page", String(page));
    return "?" + p.toString();
  };
  return (
    <>
      <PageHeader
        title={portal ? "Department tickets" : "Ticket register"}
        actions={
          <Link href="/work/new" className="work-btn">
            Create ticket
          </Link>
        }
      />
      <WorkRefresh />
      <div className="work-page">
        <section className="work-panel">
          <form className="work-filters">
            <label>
              Search
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Number, title, owner…"
                maxLength={120}
              />
            </label>
            <label>
              Audience
              <select
                aria-label="Audience"
                name="domain"
                defaultValue={filters.domain}
              >
                <option value="">All tickets</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </label>
            <label>
              Department
              <select
                aria-label="Department"
                name="department"
                defaultValue={filters.department}
              >
                <option value="">All visible departments</option>
                {context.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kind
              <select aria-label="Kind" name="kind" defaultValue={filters.kind}>
                <option value="">All kinds</option>
                <option value="problem">Problem</option>
                <option value="execution_request">Work request</option>
              </select>
            </label>
            <label>
              Status
              <select
                aria-label="Status"
                name="state"
                defaultValue={filters.state}
              >
                <option value="">All statuses</option>
                <option value="open">All open</option>
                <option value="finished">All finished</option>
                {Object.entries(WORK_STATE_LABELS).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button className="work-btn">Apply</button>
            <Link
              className="work-btn secondary"
              href={portal ? "/portal/my-tickets" : "/tickets"}
            >
              Reset
            </Link>
          </form>
        </section>
        <section className="work-panel">
          <div className="work-meta">
            <strong>{data.total} matching tickets</strong>
            <span>
              Peer department tickets are view-only. Owner actions remain with
              the request owner.
            </span>
            <Link href={"/work/export" + href(1)}>Export CSV</Link>
          </div>
          <div className="work-table-wrap">
            <table className="work-table">
              <thead>
                <tr>
                  <th>Ticket / title</th>
                  <th>Audience / department</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Working on it</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.generation + row.id}>
                    <td className="work-title">
                      <Link
                        href={
                          row.generation === "new"
                            ? "/work/" + row.id
                            : (portal ? "/portal/my-tickets/" : "/tickets/") +
                              row.id
                        }
                      >
                        {row.ticket_number}
                      </Link>
                      <p dir="auto">{row.title}</p>
                      {row.reopen_count > 0 && (
                        <small className="work-muted">
                          Reopened {row.reopen_count} time(s)
                        </small>
                      )}
                    </td>
                    <td>
                      {row.domain === "internal" ? "Internal" : "External"}
                      <p className="work-muted">
                        {row.department_name || "Legacy case"}
                      </p>
                      {row.kind && (
                        <small>
                          {row.kind === "problem" ? "Problem" : "Work request"}
                        </small>
                      )}
                    </td>
                    <td>{row.owner_name || "Recorded owner"}</td>
                    <td>
                      <span className="work-status" data-state={row.state}>
                        {WORK_STATE_LABELS[row.state as WorkState] ||
                          STATUS_LABELS[row.state as TicketStatus] ||
                          row.state}
                      </span>
                    </td>
                    <td>
                      {row.worker_name ||
                        (finishedWork(row.state)
                          ? "Finished"
                          : "Available / not assigned")}
                    </td>
                    <td>
                      <time dateTime={row.updated_at}>
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Africa/Cairo",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(row.updated_at))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.rows.length && (
            <p className="work-notice">No tickets match these filters.</p>
          )}
          <nav className="work-pager" aria-label="Ticket pages">
            <span>
              Page {data.page} of {Math.max(1, Math.ceil(data.total / 25))}
            </span>
            <div className="work-actions">
              {data.page > 1 && (
                <Link className="work-btn secondary" href={href(data.page - 1)}>
                  Previous
                </Link>
              )}
              {data.page * 25 < data.total && (
                <Link className="work-btn secondary" href={href(data.page + 1)}>
                  Next
                </Link>
              )}
            </div>
          </nav>
        </section>
      </div>
    </>
  );
}
