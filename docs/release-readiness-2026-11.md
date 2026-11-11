# Support CRM — presentation release review

Review date: 11 November 2026 (Africa/Cairo). Audience: Digital Director and Software Team.

## Release definition

The target is a reviewed demonstration and technical handover of the current manual-intake workflow. Company infrastructure acceptance, historical data correction and working email delivery are separate gates. This document does not certify an unconditional production launch or completed migration.

## Verified scope

- Existing production identity: support-crm / support-crm-emad25.vercel.app; Supabase project cdtcijbddpirvayanjut.
- 54 application regression tests pass, covering reporting filters, dates, CSV, duplicate creation, stale writes, actor validation, resolution fields, attachment validation/retry, comments, reopening and mail adapter behavior.
- 43 local PostgreSQL lifecycle assertions pass, including reporting ownership, RLS, two resolution cycles, idempotency, snapshots and central-only routing.
- Production lifecycle test from the preceding release ran inside a transaction and rolled back; it is historical evidence, not a new browser write test today.
- Current production read-only review: 64 cases (61 resolved, 2 closed without response, 1 new), six active sources with their expected reporting owners, zero committed workflow events and seven legacy email jobs.
- Dashboard matches the aggregate counts. Follow-up filter selects the single open case; reset restores all 64. Intake source Call displays Kabany without submitting a case.
- Production attachment bucket is private, with authenticated read/insert policies and a 50 MiB object limit. One stored attachment is recorded. Fresh upload/download against real production Storage is not newly certified by this review.
- Security advisors: three intentionally server-only RLS tables have no client policies; no public policy was added. Existing leaked-password protection warning remains; no paid feature enabled.

## Changes for this review

- Settings now show the actual central notification address from workflow_notifications; obsolete unused recipient editing and outdated owner-email behavior were removed.
- Mail test copy refers to the mailbox rather than assuming Outlook. Sender setup remains deferred; no email test or backlog dispatch is part of this review.
- Added one application regression command and one local database verification command.
- Updated setup instructions to avoid an unattended production migration push or re-seeding.
- Added demo and migration handover instructions.

## Explicit exclusions and decisions

| Item | Status | Next owner/action |
|---|---|---|
| SMTP delivery | Deferred by Ahmed; most recent test rejected credentials | Configure approved sender later and verify recipient Inbox, not merely SMTP acceptance |
| Current email routing | Ahmed only, temporary Gmail destination | Preserve until Ahmed approves company mailbox cutover |
| Historical corrections | Deferred by Ahmed | Import plan, mapping, deduplication and signed-off dry run later |
| Historical reporting completeness | 28 cases lack topic/root-cause data | Keep missing values visible; do not claim complete business outcomes |
| Reopen/resolution-event reports | Zero recorded events since rollout | Demonstrate using synthetic local fixtures; do not fabricate history |
| WhatsApp / B2B email / sheets automation | Not integrated | Current supported intake is manual |
| Company hosting | Not provisioned or tested | IT supplies platform, DB engine/version, domain, network and operator |
| Backup restoration | Not rehearsed on company infrastructure | Mandatory before cutover |
| Migration baseline | Historical migration IDs differ from source filenames | Compare live schema/history before running migration commands |
| Load / penetration testing | Not completed | Size workload and review with Software Team before broad launch |

## Demonstration acceptance

Show login, intake ownership, queue, case workspace, resolution/reopen lifecycle using synthetic fixtures, and dashboard drill-downs. State current manual intake and deferred email explicitly. Do not edit an existing customer case for demonstration or claim a measured productivity gain without a baseline.

## Company launch acceptance

Company-target build and restore pass; all six roles are exercised on the target; attachments and backups restore; scheduler and approved mail sender are verified if included; data totals and source/status counts reconcile; rollback is rehearsed; IT and business owner accept the deployment.
