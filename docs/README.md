# Support CRM documentation

The [business requirements](brd.md) describe the manual-intake release reviewed on 21 November 2026. Use the [PDF edition](brd.pdf) for circulation. Its editable layout is in [brd.typ](brd.typ).

| Business question | Documents |
| --- | --- |
| Who records a case, who can see it, and what counts as resolved? | [Business requirements, sections 4–7](brd.md#4-users-and-access) · [Case lifecycle](case-lifecycle-release.md) |
| What can reporting teams do after submitting? | [Portal workspace](portal-workspace-release.md) · [Portal journey checks](portal-journey-qa.md) |
| Which cases count in a report or export? | [Reporting requirements](brd.md#74-reporting) · [Register and export](case-register-export.md) · [Map data](map-data.md) |
| How do alerts work, and what does email rollout require? | [Notifications](notification-rollout.md) · [Company Outlook setup](company-outlook-email.md) |
| What was tested, and what is needed for handover? | [Readiness record](release-readiness-2026-11.md) · [Transfer runbook](company-transfer-runbook.md) · [Demo script](demo-script.md) |

## Design and release history

The [technical design](technical-design.md) and [UI specification](ui-ux-spec.md) preserve the original design. The [dashboard specification](dashboard-analytics.md), [analytics business release](analytics-business-release.md) and [single-page analytics release](single-page-analytics-release.md) record successive iterations. Counts and QA results in those notes refer to the review that produced them.

## Sources for this revision

The [intake schema](../src/lib/tickets/schema.ts), [school defaults](../src/lib/tickets/school-context.ts) and [database rule](../supabase/migrations/20261117084458_june_school_required_context.sql) establish which facts reporters enter and which the system supplies. The [map implementation](../src/app/(app)/dashboard/case-map.tsx) defines the current Egypt and World views.
