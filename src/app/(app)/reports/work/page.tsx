import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/app-shell/page-header";
import { loadWorkRegister, registerParams, workContext } from "@/lib/work/data";
import { WORK_STATE_LABELS, type WorkState } from "@/lib/work/types";
import { STATUS_LABELS, type TicketStatus } from "@/lib/tickets/constants";
import "../../work/work.css";
export default async function WorkReports({
  searchParams,
}: PageProps<"/reports/work">) {
  const user = await requireUser(["support_agent", "manager"]);
  const params = registerParams(await searchParams);
  const [data, context] = await Promise.all([
    loadWorkRegister({ ...params, page: 1 }, true),
    workContext(),
  ]);
  const rows = data.rows;
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.state, (counts.get(row.state) || 0) + 1);
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const name = row.department_name || "Legacy — department not recorded";
    grouped.set(name, (grouped.get(name) || 0) + 1);
  }
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v && k !== "page") query.set(k, String(v));
  const allLink = "/tickets?" + query.toString();
  return (
    <>
      <PageHeader
        title="Work reports"
        actions={
          <Link href={allLink} className="work-btn secondary">
            Open matching tickets
          </Link>
        }
      />
      <div className="work-page">
        <section className="work-panel">
          <form className="work-filters">
            <label>
              Audience
              <select name="domain" defaultValue={params.domain}>
                <option value="">All</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </label>
            <label>
              Department
              <select name="department" defaultValue={params.department}>
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
              <select name="kind" defaultValue={params.kind}>
                <option value="">All</option>
                <option value="problem">Problem</option>
                <option value="execution_request">Work request</option>
              </select>
            </label>
            <button className="work-btn">Apply</button>
            <Link href="/reports/work" className="work-btn secondary">
              Reset
            </Link>
          </form>
        </section>
        <div className="work-summary">
          {[
            ["All tickets", rows.length],
            ["Internal", rows.filter((r) => r.domain === "internal").length],
            ["Resolved / completed", counts.get("resolved") || 0],
            [
              "Open",
              rows.filter(
                (r) =>
                  ![
                    "resolved",
                    "cancelled",
                    "closed",
                    "closed_no_response",
                  ].includes(r.state),
              ).length,
            ],
          ].map(([label, n]) => (
            <article key={label}>
              <span className="work-muted">{label}</span>
              <strong>{n}</strong>
            </article>
          ))}
        </div>
        <div className="work-grid">
          <section className="work-panel">
            <h2>By status</h2>
            <table className="work-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {[...counts].map(([state, count]) => (
                  <tr key={state}>
                    <td>
                      {WORK_STATE_LABELS[state as WorkState] ||
                        STATUS_LABELS[state as TicketStatus] ||
                        state}
                    </td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="work-panel">
            <h2>By department</h2>
            <table className="work-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {[...grouped]
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>
        <section className="work-panel">
          <h2>Export & detailed analysis</h2>
          <div className="work-actions">
            <Link
              href={"/work/export?" + query.toString()}
              className="work-btn secondary"
            >
              Export matching tickets
            </Link>
            {(user.isAdmin || user.role === "manager") && (
              <Link href="/reports/performance" className="work-btn secondary">
                Individual performance (admin / managers)
              </Link>
            )}
            <Link href="/dashboard" className="work-btn secondary">
              Legacy case analysis
            </Link>
          </div>
          <p className="work-muted mt-3">
            Legacy tickets keep their recorded classification and original
            rules. Department, request kind and measured work duration are not
            fabricated for historical records.
          </p>
        </section>
      </div>
    </>
  );
}
