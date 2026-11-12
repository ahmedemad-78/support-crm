# Single-page Support Intelligence — 2026-11-13

Approved scope: consolidate the three Analytics tabs into one report, retaining real filters and case-register drilldowns; add an Area chart, clustered source/request columns, a resolution-outcome donut and a free geographic concentration map. Keep historical records unchanged and email deferred.

## Analytical contract

Five compact KPIs use the selected case cohort: total, currently open, marked resolved, closed without response, unique ever-reopened. Lifetime reopen-event counts remain distinct. The source comparison includes top recorded request types, a lossless Other group and missing classification. Other groups are not falsely offered as a single-value filter. Problem ranking preserves all exact topic labels behind Show all. Pareto bars show actual top labels; the cumulative line uses all recorded cases, excluding missing values, so a truncated top-five line need not end at 100%.

Handling and donut use currently resolved cases only. The action table reports tied most-frequent results as mixed, avoiding a false winner. Resolved + Issue Persists is explicitly flagged for review; no records are reopened or reclassified automatically. Completeness is presence of all five tracker fields, not confirmation that the classification is correct. Historical dates are never treated as native arrival timestamps or invented service duration.

Open follow-up is shown independently of report date range, within the other filters. Its scope is visibly labeled. Empty open-work sections use a compact message rather than multiple empty charts.

## Interaction and motion

Selected Select triggers have a blue selected state and an independent clear button. All selected dimensions, date range, search and nondefault date basis appear as removable chips with one Clear all action. Chart/source/location selections use the same shared filter model. Query state survives navigation; exports and matching-case links retain the cohort. Input and cancellation update immediately. Chart-only motion animates Area geometry, column changes, donut segments and counts, respecting reduced-motion preferences. Area interpolation returns the exact original coordinates at the end, preserving peaks.

Existing authenticated, RLS-bound snapshot loading and single-flight 15-second visible-page refresh remain in place. No realtime publication, database schema, auth role, email setting, external service or package dependency was changed.

## Geography

Boundary and reference data are bundled locally; see map-data.md and world-atlas-LICENSE.txt. Fit locations starts with Egypt and extends to include known foreign locations, including the existing Kuwait record. World view is available. Heat marks encode counts at city/area/country reference points, not customer coordinates or a continuous observed density surface. Unknown and recorded-but-unmapped locations remain separate from mapped counts; new names are never silently assigned to Egypt. Current read-only production baseline: 12 mapped + 53 unknown = 65; Egypt11 / Kuwait1. The 53 unknown records include 23 null city IDs and 30 linked to the explicit Not recorded lookup.

## Verification

95 application/model tests passed, including 1001-case / 1201-event pagination, date bases, reopen denominators, safe exports, lossless clustered series, map missing/unmapped/international coverage and record-review flags. TypeScript, scoped ESLint and production build passed. Local synthetic browser checks covered 96→97 incoming-case automatic refresh with the Call Center filter retained (14→15), source×type selection (5 cases), custom Select menus and selected chips, desktop and 390px/320px layouts. Global document overflow at320px was found and corrected. A rapid-cancellation issue during whole-page view transitions was corrected by using immediate state updates with chart-local animation. The fixture seed is deterministic for SSR hydration, and duplicated Natural Earth disputed IDs use unique rendering keys. Date-line polygon rings are unwrapped and rendered with appropriate wrap copies.

The browser connector disconnected mid-verification; native fallback discovered a locked Windows desktop. Final post-deployment visual verification must be recorded after the user unlocks the desktop. Do not claim that last check was completed until it has actually been observed.
