# Reporting workspace: My tickets and case details

## What changed

- My tickets now shows an All tickets total and separates open work, waiting for the reporting owner, tickets with unread Support replies, historical reopening and finished tickets. Summary counts cover all owned tickets; search/view result counts cover the selected filter.
- Desktop uses a readable table; narrow workspaces use cards. Every row/card shows current status, unread reply count, reopen count and latest actual workflow activity. A finished ticket can still show its historical reopen count.
- Search covers ticket number, customer and issue text. Sorting and 25-row server pagination retain URL context. The old silent 200-row limit is removed.
- Portal details now separate issue/evidence, customer/account, Support response, shared conversation and collapsed status history. Previous responses are identified when a case has reopened. Credentials stay masked by default. Internal support notes remain private.
- Classification & follow-up was removed from employee pages by user request, and its fields/relations are no longer selected by the portal detail query. The Technical Support tracker/editor remains unchanged. Shared status badges now use quiet outline icons instead of colored dots.
- Reporting owner and recorded-by identity remain distinct. The reporting account cannot change status or select a resolution assignee.

## Reply/read semantics

“New replies” counts unread notifications linked to comment/resolved workflow events. Status-only notices remain in the notification bell but do not inflate reply counts. Summary count is **tickets** with unread replies; each row shows the number of replies.

Replies are acknowledged only when the conversation becomes visible, not on list load or server prefetch. The server acknowledges the exact event IDs loaded for that ticket and recipient (maximum 500 per batch). A later, not-yet-loaded reply is not accidentally cleared. Failed acknowledgements offer retry and never claim success. Bell and list read state share the same notification records. The list refreshes on own notification changes and window focus, with a manual refresh fallback.

## Database and privacy

Migration `20261111200033_portal_ticket_workspace.sql` adds two security-invoker RPCs and indexes; historical ticket/notification rows are not rewritten. Both RPCs derive the owner from auth.uid(), restrict active portal roles, retain RLS and deny anonymous execution. No arbitrary recipient/user ID parameter is accepted.

Production read-only checks at release preparation: Call Center 36 tickets, Moderation 9; no foreign-owner rows returned. Existing records were all finished and had no unread replies at that moment. These are observations, not seeded or hardcoded UI totals. Workflow email remains disabled.

## Verification

- 79 application tests and 209 PostgreSQL/PGlite assertions passed: permissions for same-role peers, literal/Arabic search, filters, safe return links, counts beyond 200 records, page clamping, status-only versus reply notices, exact-event read marking, repeated reads, late replies and no email dispatch.
- TypeScript, scoped lint and production Webpack build passed.
- Browser QA uses the real shared components with synthetic data for desktop/mobile, search/empty results, pagination, role-specific headings, image previews, finished/reopened cases and read-marker visibility/failure/retry/late-reply behavior. No production tickets or messages were created for QA. Fresh browser sign-in as real reporting accounts was not performed; actual production RLS was tested in read-only role-scoped transactions.
- Supabase's advisor endpoint timed out during review; explicit live invoker/anonymous-permission checks and PostgreSQL RLS tests completed successfully.

Dev-only fixtures: `/login/preview-my-tickets/call_center`, `/login/preview-my-tickets/moderation`, `/login/preview-portal-ticket?role=moderation&status=resolved`, `/login/preview-lifecycle?mode=reply-read`. Fixtures return 404 in production.

Screenshots under untracked `audit/`: `my-tickets-desktop.png`, `my-tickets-mobile.png`, `portal-ticket-mobile.png`, `portal-ticket-desktop.png`.

Email integration, historical data reconciliation and custom 30 June questions remain deferred. No paid services were introduced.
