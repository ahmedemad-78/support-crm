# Business Analytics release — 2026-11-12

## Scope
Replaced Analytics with Overview, Operations and Problem analysis. Secondary timing, relationships and data-confidence analysis stays collapsed. Charts use real cases and recorded tracker fields; optional customer/device/version data is context filtering rather than decorative charts.

## Data contract
Each case counts once. Resolved and closed-without-response remain separate. Unique reopened cases and lifetime reopen events are separate measures. Missing classification and reporting ownership remain explicit; creator is not substituted for reporter. Timing and fourteen-day stability require complete native event history and eligible observation windows. Historical imports are never assigned invented events or durations.

Authenticated, RLS-bound snapshot loading independently paginates cases and workflow events. Filters, chart selections, case-register drilldown and CSV share the same model. Operations follow-up uses current open cases independently of the arrivals period. All data is the default period. Selected tab and filter state survive navigation.

## Updates and motion
Visible pages refresh every 15 seconds, on focus/online/visibility, and on the current user's notification inserts. Requests are single-flight, timeout and retry safely, and retain the last successful snapshot on error. No database publication changes were made. Filtering uses short chart/card transitions, animated counts and line changes, with reduced-motion support. Selects include contextual counts and keyboard support.

## Verification
92 application/model tests passed, including independent pagination of 1001 cases and 1201 events, Cairo date ranges, reopen denominators, reconstructed backlog, native-history eligibility and safe CSV. TypeScript and scoped ESLint passed. Synthetic browser verification covered incoming-case automatic updates while retaining a source filter, resolution, refresh failure/recovery, action filtering, keyboard tabs and responsive layouts at 320px and 390px without horizontal document overflow.

No new paid service, package, database migration, historical-data rewrite or email activation. PDF uses browser printing of the current visible report; no downloaded PDF artifact was asserted in QA.
