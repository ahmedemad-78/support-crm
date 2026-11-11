# Call Center and Moderation journey review

Reviewed 2026-11-11. Email remains deferred. No production ticket, message, notification or account was created or modified by the review.

## Permission checks on the deployed database

Read-only transactions evaluated the real RLS policies as each existing reporting account, then rolled back. At review time:

| Account role | Visible tickets | Visible notifications | Other owners' tickets/notifications |
| --- | ---: | ---: | ---: |
| Call Center | 36 | 4 | 0 / 0 |
| Moderation | 9 | 2 | 0 / 0 |

Visible attachments and workflow events all belonged to visible tickets. These counts are point-in-time observations, not hardcoded application totals. Production has one active account in each of these teams, so additional same-team colleagues were tested locally.

## Complete database journeys using synthetic identities

`scripts/lifecycle-db.test.mjs` runs the actual migrations and PostgreSQL RLS/functions in PGlite. It now has 166 assertions, including a full independent journey for both roles:

- Creating a ticket ignores spoofed source, reporter and recorded-by identity and uses the authenticated account.
- A different employee of the **same role** cannot read the ticket, events, attachments or notifications, reply, reopen, or mark its notification read.
- Intake attachment is visible to Support. Both parties can exchange five-file messages containing image, video, audio, PDF and Excel metadata. Receiver cannot read staged drafts before send; after atomic send the receiver can read all five committed files.
- Retrying the same message creates one event, one set of files and one recipient notification. Regular replies retain status, including a reply with an attachment after resolution.
- Support resolution notifies the reporting owner. Reopening the same resolved ticket changes status, increments the reopen count once and notifies Support. A repeated request is idempotent. A second resolution retains both resolution events.
- Reading one's own notification works; trying to read/mark another employee's notification has no effect.
- No workflow email jobs are created during these journeys; deployed `workflow_notifications.email_enabled` is still false.

Storage tests verify RLS and uploaded-object metadata; the synthetic database does not decode real video/audio bytes. Browser media rendering/download checks complement these tests.

## Browser checks and fix

Development fixtures use the actual shared intake, follow-up and attachment components without customer writes. Both role sources are fixed; source/reporter selectors and Contact channel are absent. Intake accepts optional blank contacts and explicit Unknown answers. Call Center partial attachment upload can retry the same saved case. Reporter follow-up distinguishes comment from reopen and preserves failed drafts.

Fixed attachment preview recovery: failure state now belongs to the failed URL rather than the attachment forever. Renewing a signed URL recovers the same mounted attachment. Image/video/audio refs also catch failures that happened before hydration. The development recovery fixture deliberately fails its first image URL and then proves a valid replacement loads.

Production account passwords were not changed or requested. This review did not perform a fresh browser sign-in as the real reporting users: production authorization was tested with read-only database role simulation, and browser interaction used synthetic fixtures.

## Run again

```powershell
node scripts/lifecycle-db.test.mjs
node --test --experimental-test-isolation=none scripts/analytics.test.mjs scripts/remediation.test.mjs scripts/workflow.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Development browser fixtures: `/login/preview-intake?portal=1&role=call_center&scenario=uploads`, the same with `role=moderation`, `/login/preview-lifecycle?mode=reporter`, and `/login/preview-lifecycle?mode=media-recovery`. These return 404 in production.
