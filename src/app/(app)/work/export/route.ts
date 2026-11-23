import { requireUser } from "@/lib/auth/session";
import { loadWorkRegister, registerParams } from "@/lib/work/data";
import { csvCell } from "@/lib/tickets/analytics";
export async function GET(request: Request) {
  await requireUser();
  const filters = registerParams(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const { rows } = await loadWorkRegister({ ...filters, page: 1 }, true);
  const lines = [
    [
      "Ticket",
      "Title",
      "Description",
      "Audience",
      "Department",
      "Kind",
      "Source",
      "Customer",
      "Owner",
      "Status",
      "Worker",
      "Created",
      "Updated",
    ],
    ...rows.map((r) => [
      r.ticket_number,
      r.title,
      r.description,
      r.domain,
      r.department_name || "",
      r.kind || "",
      r.source_code || "",
      r.customer_name || "",
      r.owner_name || "",
      r.state,
      r.worker_name || "",
      r.created_at,
      r.updated_at,
    ]),
  ];
  return new Response(
    "\uFEFF" +
      lines.map((line) => line.map(csvCell).join(",")).join("\r\n") +
      "\r\n",
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tickets.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
