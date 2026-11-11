# Support Center — Selah El Telmeez

Internal support ticketing and reporting workspace. Next.js 16 (App Router) + Supabase. Intake is manual; the Conversations page is a disconnected placeholder, not a live WhatsApp integration.

Current delivery and transfer documents:
- `docs/release-readiness-2026-11.md`: tested scope, exclusions and release gates.
- `docs/company-transfer-runbook.md`: inventory, migration choices, cutover and recovery.
- `docs/demo-script.md`: presentation flow and demonstration boundaries.

Run `npm test` for application regression checks. `npm run test:lifecycle` exercises database lifecycle rules using the separately installed local PGlite test dependency; see `docs/case-lifecycle-release.md`.

Design docs: `docs/technical-design.md`, `docs/ui-ux-spec.md`. UI designs live in the Wonder file "Selah El Telmeez – Support CRM".

## Setup

1. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in the URL, publishable key and secret key.
2. For a fresh disposable database, apply the reviewed schema and starter lists. For the existing production database, first reconcile actual schema and migration history: historical version names differ from checked-in filenames. Do not run an unattended database push or starter seed against production. See the transfer runbook.
3. In Supabase → Authentication → Sign In / Providers, turn off "Allow new users to sign up". Only the admin creates accounts.
4. Create the owner account: `npm run create-admin -- --email you@company.com --name "Your Name" --password "..."`, then run the SQL it prints.
5. `npm run dev` and open http://localhost:3000.

## Roles

| Role | Sees |
|---|---|
| Technical Support | Inbox, all tickets, dashboard |
| Technical Support + Admin (the owner) | same, plus Users and Settings |
| Moderation / Call Center | New ticket form and their own tickets |
| Manager | Dashboard and tickets, view only |

Permissions are enforced in Postgres with row-level security, not only in the UI.
