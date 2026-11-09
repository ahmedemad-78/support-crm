import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import { parseDashboardFilters } from "@/lib/tickets/filters";
import { loadAnalytics } from "@/lib/tickets/load-analytics";
import { casesCsv, dashboardPopulation, statusGroup } from "@/lib/tickets/overview";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "support_agent" && user.role !== "manager")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseDashboardFilters(Object.fromEntries(url.searchParams.entries()));
  const { tickets, asOf } = await loadAnalytics();
  const today = cairoDate(asOf);
  let rows = dashboardPopulation(tickets, filters, today);
  if (url.searchParams.get("scope") === "followup") {
    rows = rows.filter((ticket) => statusGroup(ticket.status) === "followup");
  }

  return new NextResponse(casesCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=support-cases-${filters.from || "all"}-${filters.to || "today"}.csv`,
    },
  });
}
