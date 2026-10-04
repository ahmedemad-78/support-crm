# Support dashboard

The dashboard uses authenticated Supabase access and the existing ticket RLS policies.
It refreshes every 30 seconds while visible, and on returning to the tab. This is
polling, not a Supabase Realtime subscription. Failed refreshes preserve the last
successful snapshot and display an error. Cursor pagination removes silent row caps.
For large datasets, replace the full snapshot with server-side aggregation before
scaling polling to many simultaneous users.

- Received: tickets created within the selected Cairo calendar dates.
- Resolved / closed headline: current terminal statuses among period arrivals, even if no resolution timestamp was recorded. Still open uses the same arrival population, so the three headline counts reconcile.
- Recorded resolutions in the activity chart: currently resolved/closed tickets whose recorded resolution date falls
  within those dates. Reopened tickets are excluded; this is not event-history reporting.
- Open: current new, in-progress and awaiting-customer tickets, across all creation dates.
- Resolution time: median elapsed hours among resolved/closed period arrivals with valid timestamps, with sample
  size. Negative/missing durations are excluded. No business-hours or SLA assumption.
- Source, status, city, category, recorded root cause, platform, assignee and user-type filters intersect across the dashboard.
  Report charts always describe period arrivals. Chart and KPI clicks change only the ticket explorer; report dates, totals and distributions remain stable. The open workload panel explicitly covers all creation dates, and its age bands select that live queue in the explorer.
  The activity chart compares arrivals and recorded resolutions by event date using grouped columns: days for up to 31 days, weeks up to 90, months up to 730, and calendar quarters beyond that. Empty intervals remain, partial edge intervals are clipped, and labels include years for months/quarters. It does not infer a historical backlog or a resolution rate from those two series.
- Missing root causes are a data-quality indicator, not an inferred cause ranking.
- City and user-type breakdowns live in the expandable analysis section; selecting a value filters the ticket table, including records where those fields were not captured.
- Pareto uses all period arrivals as its denominator. A single category is described as a count, without drawing a misleading comparison chart. Missing classifications and missing resolution dates are disclosed. The category/cause matrix includes recorded causes only; missing causes are shown separately. Selecting a chart value applies its dimensions only to the ticket explorer.
- A resolved ticket can have a cause but no valid duration. The median card displays its sample size. The ticket table links to details with a return path that keeps dashboard filters.
- CSV exports the current matching cohort; PDF uses the browser print dialog.

Run `npm run test:analytics`, `npm run lint`, `npm run typecheck`, and `npm run build`.
In development, `/login/preview` displays synthetic data without reading customer
records. It returns 404 in production. Real authentication, RLS and refresh behavior
must also be checked with configured Supabase credentials in staging.
