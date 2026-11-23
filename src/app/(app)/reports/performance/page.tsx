import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app-shell/page-header";
import { WORK_STATE_LABELS, type WorkState } from "@/lib/work/types";
import "../../work/work.css";
type Performance = {
  id: string;
  name: string;
  solved: number;
  participated: number;
  working_seconds: number;
  waiting_seconds: number;
};
const duration = (n: number) =>
  Math.floor(n / 3600) + "h " + Math.floor((n % 3600) / 60) + "m";
type MemberTicket = {
  id: string;
  number: string;
  title: string;
  state: WorkState;
  solved: boolean;
  working_seconds: number;
  waiting_seconds: number;
};
export default async function PerformancePage({
  searchParams,
}: PageProps<"/reports/performance">) {
  const user = await requireUser(["support_agent", "manager"]);
  if (!user.isAdmin && user.role !== "manager") redirect("/tickets");
  const db = await createClient();
  const { data, error } = await db.rpc("work_performance");
  if (error) throw error;
  const rows = data as Performance[];
  const params = await searchParams;
  const selected = rows.find((r) => r.id === params.member);
  let detail: MemberTicket[] = [];
  if (selected) {
    const result = await db.rpc("work_member_performance", {
      member: selected.id,
    });
    if (result.error) throw result.error;
    detail = result.data as MemberTicket[];
  }
  return (
    <>
      <PageHeader
        title="Individual performance"
        actions={
          <Link href="/reports/work" className="work-btn secondary">
            Work reports
          </Link>
        }
      />
      <div className="work-page">
        <p className="work-notice">
          Measured work on new-workflow tickets. Working time excludes waiting
          for the owner and time before starting. Elapsed time includes nights,
          weekends and holidays. Legacy durations are not recorded.
        </p>
        <section className="work-panel">
          <div className="work-table-wrap">
            <table className="work-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Currently resolved tickets</th>
                  <th>Participated in</th>
                  <th>Working time</th>
                  <th>Waiting for owner</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={"?member=" + r.id}>{r.name}</Link>
                    </td>
                    <td>{r.solved}</td>
                    <td>{r.participated}</td>
                    <td>{duration(Number(r.working_seconds))}</td>
                    <td>{duration(Number(r.waiting_seconds))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="work-muted mt-4">
            A ticket is counted once for the final solver. Reopened tickets stay
            in participation history; previous resolution cycles do not inflate
            the current solved count.
          </p>
        </section>
        {selected && (
          <section className="work-panel">
            <h2>Tickets — {selected.name}</h2>
            <p className="work-muted">
              Select a member above to see their solved tickets and
              participation time on each ticket.
            </p>
            <div className="work-table-wrap">
              <table className="work-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Status</th>
                    <th>Credit</th>
                    <th>Working time</th>
                    <th>Waiting for owner</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={"/work/" + t.id}>{t.number}</Link>
                        <p dir="auto">{t.title}</p>
                      </td>
                      <td>{WORK_STATE_LABELS[t.state]}</td>
                      <td>
                        {t.solved
                          ? "Final solver"
                          : "Participation / previous cycle"}
                      </td>
                      <td>{duration(Number(t.working_seconds))}</td>
                      <td>{duration(Number(t.waiting_seconds))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!detail.length && (
              <p className="work-notice">No measured participation yet.</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
