# Support dashboard

The dashboard uses authenticated Supabase access and the existing ticket RLS policies.
It refreshes every 30 seconds while visible, and on returning to the tab. This is
polling, not a Supabase Realtime subscription. Failed refreshes preserve the last
successful snapshot and display an error. Cursor pagination removes silent row caps.
For large datasets, replace the full snapshot with server-side aggregation before
scaling polling to many simultaneous users.

- Received: tickets created within the selected Cairo calendar dates.
- Resolved: currently resolved/closed tickets whose recorded resolution date falls
  within those dates. Reopened tickets are excluded; this is not event-history reporting.
- Open: current new, in-progress and awaiting-customer tickets, across all creation dates.
- Resolution time: median elapsed hours of valid resolutions in the period, with sample
  size. Negative/missing durations are excluded. No business-hours or SLA assumption.
- Prior comparison: preceding period of equal inclusive length. No percentage when
  the prior count is zero.
- Source, status, city, category, recorded root cause, platform, assignee and user-type filters intersect across the dashboard.
  Received/resolved/open selects the cohort for distribution charts and ticket lists.
  Age selections narrow that open-ticket list; headline period metrics keep their
  stated scope. The activity chart always compares period arrivals and resolutions.
- Missing root causes are a data-quality indicator, not an inferred cause ranking.
- Pareto uses all selected tickets as its denominator. The line remains below 100% when only the leading categories are shown. The category/cause matrix includes recorded causes only; missing causes are shown separately. Selecting a chart value applies its dimensions to all panels and the ticket table.
- A resolved ticket can have a cause but no valid duration. Per-category median displays its sample size. The ticket table links to details with a return path that keeps dashboard filters.
- CSV exports the current matching cohort; PDF uses the browser print dialog.

Run `npm run test:analytics`, `npm run lint`, `npm run typecheck`, and `npm run build`.
In development, `/login/preview` displays synthetic data without reading customer
records. It returns 404 in production. Real authentication, RLS and refresh behavior
must also be checked with configured Supabase credentials in staging.
