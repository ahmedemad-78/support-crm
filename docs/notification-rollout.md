# Case conversation and notification rollout

## Current behavior

- Support replies and status changes notify the active reporting owner, unless the actor is also that owner.
- Reporter replies, new tickets and reopened tickets notify the active assigned support agent, falling back to the configured central support recipient. Self-notifications are skipped.
- Internal support notes remain private and never notify reporting users.
- Source-bound portal accounts always create for themselves with their account's source. Technical Support can choose an active reporting owner belonging to the selected source team. Sources without a bound portal role use Technical Support accounts.
- Conversation attachments are private. Images, MP4/MOV, audio, PDF and Excel support preview where the browser can decode the format, plus download. Up to five files per intake submission or conversation message; video 50 MB, other supported files 10 MB.
- Files upload directly to private storage before the atomic message RPC. A failed RPC preserves the draft. The same request UUID cannot duplicate a reply, attachment record, notification or reopen count. Abandoned staged objects are not public; automated orphan cleanup is a future housekeeping task.
- Historical cases, attachment records, notifications and queued email are not backfilled or rewritten.

## Email deferred for final release

`workflow_notifications.email_enabled` is false. No new workflow email jobs are created, and the email dispatcher returns before reading or sending queued mail. Do not enable it during UI work.

Before final enablement:

1. Confirm sender mailbox and verified recipient addresses for each active account. Do not assume the company Outlook routing issue is resolved.
2. Define email recipients separately from in-app recipients: reporter for support replies/status changes; assigned/fallback support for new cases, reporter replies and reopening.
3. Include ticket number, sender display name/title, concise update and an authenticated link. Keep private notes, credentials and file contents out of email.
4. Deduplicate by event and recipient; test delivery, retry, failure visibility and notification preferences. Do not replay historical or stale queued jobs automatically.
5. Keep credentials in server-side sensitive environment variables and use existing free infrastructure only.

## Verification

Application tests exercise media formats/limits, server-action validation and deferred email. PostgreSQL integration tests exercise source/team ownership, notification recipients, private storage access, actual uploaded metadata, atomicity and idempotent reopening. Browser QA uses synthetic local drafts for uploads/failure recovery and read-only production checks.
