# Internal requests and external cases: Preview review

## Scope and isolation

The approved system changes run on `codex/internal-requests-preview` against the separate Free Supabase project `support-crm-preview` (`vojietqeyfkrfisxcsrs`). No Production users, tickets, files or credentials were copied. No paid branch or additional paid service was created. This is a review environment, with synthetic fixtures and outbound delivery disabled.

Production is currently restored to its existing source, database, lifecycle and canonical alias. New migrations have only been applied to Preview. The Preview branch contains a fail-closed backend pin and must not be promoted directly.

## Hosting status and recovered alias incident

The first same-project `staging` deployment (`dpl_JDmfQyBH8VcvCwvngJ4yQsBoQqGF`, preparation commit `8168ebd`) unexpectedly acquired the canonical `support-crm-emad25.vercel.app` alias. A subsequent verification discovered this. The in-progress business deployment `dpl_2QnuZ2Ry9YMUV9FvZXKj279qzkVF` was canceled before completion; the canonical alias was restored to original Production deployment `dpl_ELY9teECCDC4aGGbiuK6LfuhjnGm` (commit `06e144924e550c0bffc17b79a6a1aec6faf2d145`). Both Production aliases were rechecked against that deployment, and the original login page was fetched successfully without the Preview banner. Production database writes/migrations were never performed.

Do not publish this branch into the shared hosting project again. The intended destination is a new, separate `support-crm-isolated-preview` Vercel project. Its creation was denied by the connector (403); the installed CLI is logged out. Automatic approval also rejected transferring the Preview server key to that new project without explicit authorization for that destination. No new Vercel project or credential transfer was completed. Remote publication remains blocked pending the user's Vercel login and explicit permission for the Preview-only credentials. The optimized local build is available at `http://127.0.0.1:3017` for review, using only the isolated Preview database.

## Implemented behavior

- One register combines historical external cases and new internal/external tickets, with audience, department, kind, status and search filters and a complete matching CSV export.
- Internal problems and work requests require a title and description. Other details and files are optional. Reporter and department come from the account. There are no school/account master records or prescribed request menus.
- External customer intake retains the original contact, city, date, platform and applicable school fields. The department supplies a fixed external source; the database validates required fields and rejects spoofed source values.
- Admins manage departments, external-intake permission, source, individual accounts and membership. One account belongs to one department. Internal on-behalf creation and ownership changes are admin-only.
- Representatives read their department's new tickets; only the owner can reply, cancel before first start or reopen with a reason. Original submitted text is immutable. Legacy records retain their original rules.
- Technical workers see all cases. Exactly one worker starts a new/available ticket. Transfers create an untimed pending assignment; the recipient starts work before transferring/returning it. Owner replies resume the same worker from waiting.
- Completion requires meaningful solution/completed-work text and five active catalog choices. The cause label changes for work requests. Catalogs use the existing admin-managed settings. Cancellation and no-response closure use a separate reason, rather than a false resolution.
- Reopening is explicit and makes the ticket available to the team. A comment on a closed ticket leaves it closed. Owner cancellation stops after the first work start, even if later returned to the team.
- Public replies are visible to the department. Internal notes and their private files are restricted to the technical team/admin. Priority and due date are isolated in a separate team-only table and omitted from public exports and notification text.
- Managers read all cases and reports and create tickets; they have owner actions only on their own new tickets. They cannot see private notes/planning or perform team actions on someone else's ticket.
- Creation notifies the active technical team in the system. Subsequent conversation/status notifications are scoped to the owner and responsible participants; starting work does not broadcast to the rest of the team. Admin audit events are recorded for future automation.
- The combined report covers both audiences and new kinds/departments. Historical analytical dashboards remain available and explicitly marked as legacy case analysis.
- Admins and managers alone can view member performance and click a member to list their solved tickets and per-ticket participation. Working time excludes owner waiting and pending assignment; it otherwise measures elapsed time, including nights/holidays. Final solver receives credit; other workers retain their measured participation. Admin closure preserves the current worker's credit and records the actual actor.

## Review scenarios

1. Sign in as the synthetic admin and inspect Departments & membership. Add a department and account, enabling external cases only where appropriate.
2. Sign in as QA, create a free-text request with an optional attachment. QA Peer can read it without replying; B2B cannot read it.
3. Sign in as Preview Backend, start the request, add a private note and ask the owner for information. Reply as QA; the request returns to the same worker.
4. Transfer to another worker; verify the pending assignment and explicit start. Return it to the team, then let a worker start it again.
5. Complete it with the five catalog choices and a solution. An ordinary owner reply keeps it closed; explicit reopening requires a reason and returns it to the team.
6. Check owner cancellation before start, cancellation request after start, and no-response closure. Reopen each finished case as its owner.
7. Sign in as Manager and inspect both audiences and individual performance, including the member's ticket list. Confirm that other people's actions and private notes/planning are unavailable.
8. Try external intake as B2B and Schools; check fixed source and retained required fields. Check register/report filters and CSV output.
9. Review a legacy synthetic case. It opens the existing detail screen and uses the existing lifecycle.

## Verification evidence

Results live in ignored `.vercel/*evidence.json` files and logs; fixture credentials and authenticated browser state are not release artifacts.

| Check | Result |
|---|---|
| Existing application + isolation unit suite | 107 passed |
| Legacy lifecycle, real PostgreSQL WASM | 209 assertions passed |
| New workflow against actual Preview Auth/DB/Storage | 70 assertions passed |
| Main UI flow in fresh headless Edge contexts | 20 assertions passed; desktop/mobile screenshots retained locally |
| Admin department and account provisioning through UI | 6 assertions passed |
| Full repository lint | Passed |
| TypeScript | Passed |
| Optimized Next.js build (webpack) | Passed |

Security advisors found no new error-level issues. Server-only receipt/outbox/counter tables intentionally have no client RLS policy. The Free test project's optional leaked-password protection remains disabled; see [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). New-table relationship indexes and notification/membership RLS initialization were improved after advisor review.

## Deliberately deferred

n8n workflows, company-mail capability verification, Telegram event summaries and management menus, Gemini suggestions, approved knowledge retrieval, voice understanding, confirmation of bot actions and `AGENT AI` attribution belong to the next phase. The CRM records immutable events, revision numbers, actual actors, resolution snapshots and idempotent commands for that integration; this Preview does not execute customer-application changes or send external notifications.

Before any Production release, review this Preview with the user, obtain explicit release confirmation, prepare the Production configuration/cutover and assign existing users to departments. Do not alter historical ticket data or invent work durations for legacy tickets.
