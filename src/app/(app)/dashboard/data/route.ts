import { getCurrentUser } from "@/lib/auth/session";
import { loadAnalytics } from "@/lib/tickets/load-analytics";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["support_agent", "manager"].includes(user.role))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    return Response.json(await loadAnalytics(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      {
        error: "Refresh failed. Your last successful data is still displayed.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
