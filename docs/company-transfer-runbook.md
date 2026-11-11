# Company transfer runbook

Prepared: 11 November 2026. Planning document, not an executed transfer.

## Decisions required from the Software Team

Record OS and version, container availability, database engine/version, DNS/HTTPS ownership, internal/VPN/public access, backup destination and retention, expected concurrent users, monitoring owner and release owner. Confirm where the code repository will live. Keep credentials out of this document.

Two different destinations are possible:
- Self-hosted Supabase: retain Auth, PostgREST, PostgreSQL functions/RLS and Storage interfaces. Confirm supported Postgres versions, extensions, roles and JWT configuration against the exact chosen distribution. Self-hosting transfers operational responsibility to the company.
- Company-native database: replace the Supabase-specific data and authentication layer. PostgreSQL alone does not provide Supabase Auth or Storage APIs; SQL Server/MySQL also require schema, function and query conversion. Do not estimate this as a connection-string-only change.

## Inventory to transfer

1. Entire Git repository and history, lockfile, migration files and exact tested release SHA. GitHub is not a runtime dependency; mirror into the approved internal Git service and verify branches/tags before removal.
2. Database schema and data: public tables, private functions, triggers, indexes, grants, enums, RLS policies, sequences/counters and migration history. Preserve UUID ownership relationships and event snapshots.
3. Auth users and supported password hashes/configuration. Export securely using the official migration workflow; confirm target sign-in behavior and plan session reauthentication. Do not copy production signing secrets into a presentation.
4. Storage objects and their metadata/policies. A database dump does not by itself transfer file bytes. Reconcile object count, byte sizes and representative checksums.
5. Configuration names from .env.example: public Supabase endpoint/key, server-only Supabase credential, application origin, mail provider settings if enabled and scheduler secret. Inject through the company's secret store. Public NEXT_PUBLIC values must match the target at build time.
6. Vercel schedule replacement: vercel.json currently requests email dispatch at 06:00 UTC daily. Use the company scheduler with the same authenticated endpoint only after mail rollout is accepted. Do not accidentally dispatch historical jobs.

## Build and operate

- Use the reviewed Node release supported by the installed Next.js version and test in the same runtime used for deployment. Current hosted configuration previously reported Node 24; confirm the target explicitly.
- On a clean checkout with a real node_modules directory, run npm ci, npm test, npm run build and npm start. This Windows checkout uses a shared node_modules junction and was validated with next build --webpack; that workspace workaround is not a production dependency.
- Put a reverse proxy and HTTPS in front of Next.js. Keep database and server-only credentials off the public network/client bundle. Confirm proxy origin/host handling for Server Actions and cookie security.
- Configure restart-on-failure, startup after reboot, monitoring, disk alerts and rotated logs without secrets/customer payloads.
- Set NEXT_PUBLIC_APP_URL to the approved company origin. Review remaining fixed links, including the administrative test email, when enabling mail on the company target.
- Do not use static export: the application needs server rendering, authenticated server actions and API handlers.

## Migration rehearsal

1. Take an encrypted export and retain the current deployment configuration separately in the company secret store.
2. Compare source/target schema and extensions, restore into an isolated company test database, migrate Storage separately and configure Auth URLs.
3. Reconcile totals by source/status, reporting ownership, attachments, sequence/counter values and workflow events. Current review snapshot is 64 cases, not a permanent expected count.
4. Test Support/Admin, Support without Admin, Manager and each reporting role. Verify both allowed actions and unrelated-user denial.
5. Exercise synthetic create → classify → resolve → public comment → reopen with reason → second resolution. Verify one case, preserved snapshots and accurate reopen count; test duplicate submissions and stale saves.
6. Verify private attachment upload/read and unauthorized rejection, dashboard/export parity, sign-out, inactive account behavior and backup restoration.

## Cutover and rollback

Freeze edits on the old application for an agreed window; record final counts and take a final database/object export. Restore the final changes to the target and verify integrity before enabling company access. Keep the old environment inaccessible to writes so users cannot create split histories.

Retain the old deployment and encrypted final export until the business owner accepts the new target. Define rollback criteria and who decides. If new-target writes have occurred, reconcile/export those writes before rollback; switching DNS alone can lose work.

Only decommission Vercel, Supabase Cloud and the external Git remote after accepted operation, a successful restore rehearsal, verified repository mirror and documented recovery ownership. Revoke superseded credentials after the retention decision.

## Official references

- https://nextjs.org/docs/app/guides/self-hosting
- https://supabase.com/docs/guides/self-hosting
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
