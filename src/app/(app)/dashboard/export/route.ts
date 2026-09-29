import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cairoDayBound } from "@/lib/tickets/dashboard-model";
import { parseDashboardFilters } from "@/lib/tickets/filters";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "support_agent" && user.role !== "manager")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseDashboardFilters(Object.fromEntries(url.searchParams.entries()));
  const supabase = await createClient();
  let query = supabase
    .from("tickets")
    .select("ticket_number, source, status, customer_name, issue_description, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (filters.from) query = query.gte("created_at", cairoDayBound(filters.from, false));
  if (filters.to) query = query.lte("created_at", cairoDayBound(filters.to, true));
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.city) query = query.eq("city_id", filters.city);
  if (filters.category) query = query.eq("issue_category_id", filters.category);
  if (filters.userType) query = query.eq("end_user_type", filters.userType);

  const { data, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });

  const header = ["Ticket", "Source", "Status", "Customer", "Issue", "Created", "Resolved"];
  const lines = [header, ...(data ?? []).map((row) => [
    row.ticket_number,
    row.source,
    row.status,
    row.customer_name,
    row.issue_description,
    row.created_at,
    row.resolved_at ?? "",
  ])];
  const csv = lines.map((line) => line.map(escapeCsv).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=tickets.csv",
    },
  });
}

function escapeCsv(value: string) {
  const text = value.replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}
