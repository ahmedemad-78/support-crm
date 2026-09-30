import { notFound } from "next/navigation";
import { DashboardBoard } from "@/app/(app)/dashboard/analytics-dashboard";
import { Sidebar } from "@/components/app-shell/sidebar";
import { navFor } from "@/components/app-shell/nav";
import { cairoDate } from "@/lib/tickets/dashboard-model";
import type { AnalyticsTicket } from "@/lib/tickets/analytics";
import { TICKET_SOURCES, TICKET_STATUSES } from "@/lib/tickets/constants";

// Development-only, synthetic fixture. Never reads Supabase or real ticket data.
export default function DashboardPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const asOf = new Date().toISOString();
  const now = Date.parse(asOf);
  const categories = [
    "Account & profile",
    "Subscriptions",
    "Learning content",
    "App performance",
    "Payments",
  ];
  const subjects = [
    "Unable to access the learning account",
    "Subscription has not been activated",
    "Video lesson is not loading",
    "App closes when opening a lesson",
    "Payment confirmation is missing",
  ];
  const tickets: AnalyticsTicket[] = Array.from({ length: 96 }, (_, i) => {
    const createdAt = new Date(
      now - ((i * 13) % 56) * 86400000 - (i % 15) * 3600000,
    ).toISOString();
    const status = i % 9 < 6 ? "resolved" : TICKET_STATUSES[i % 3];
    return {
      id: `sample-${i}`,
      number: `TKT-DEMO-${String(i + 1).padStart(4, "0")}`,
      subject: subjects[i % 5],
      status,
      source: TICKET_SOURCES[i % 5],
      createdAt,
      createdOn: cairoDate(createdAt),
      resolvedAt:
        status === "resolved"
          ? new Date(
              Math.min(now, Date.parse(createdAt) + (2 + (i % 38)) * 3600000),
            ).toISOString()
          : null,
      categoryId: String((i % 5) + 1),
      category: categories[i % 5],
      cityId: i % 2 ? "1" : "2",
      endUserType: i % 3 ? "student" : "parent",
      cause: i % 4 ? "Configuration needs review" : "",
    };
  });
  const user = {
    id: "preview",
    email: "preview@example.com",
    fullName: "Preview Agent",
    role: "support_agent" as const,
    isAdmin: true,
  };
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <Sidebar
        user={user}
        sections={navFor(user).map((s) => ({
          ...s,
          items: s.items.map((i) => ({
            ...i,
            href:
              i.icon === "dashboard" ? "/login/preview" : `#preview-${i.icon}`,
          })),
        }))}
      />
      <main className="workspace-main min-w-0 flex-1 bg-muted">
        <header className="no-print flex h-16 items-center border-b bg-white px-8 text-sm">
          <span className="mr-2 text-muted-foreground">Support /</span>
          <strong>Support analytics</strong>
          <span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
            Design preview · sample data
          </span>
        </header>
        <DashboardBoard
          preview
          initialSnapshot={{ tickets, asOf }}
          initialFilters={{
            from: "",
            to: "",
            source: "",
            status: "",
            category: "",
            city: "",
            userType: "",
          }}
          cities={[
            { id: "1", name: "Cairo" },
            { id: "2", name: "Alexandria" },
          ]}
          categories={categories.map((name, i) => ({
            id: String(i + 1),
            name,
          }))}
        />
      </main>
    </div>
  );
}
