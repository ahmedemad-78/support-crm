# Case lifecycle release — prepared, not deployed

Approved workflow:
- Support records on behalf of the reporting owner. The original creator remains unchanged.
- Call → Kabany; Moderation → Sonia; B2B → Olaa; 30 June → Yasser; WhatsApp / Google Play → Ahmed.
- Portal submissions belong to the signed-in reporter; their role determines the source.
- `resolved` means resolved and closed. `closed` remains closed without customer response.
- A clear Support response and the five tracker values are required to resolve.
- Reopen is a constrained, version-checked transaction with a required reason. It increments the counter once and preserves earlier resolution snapshots.
- Public comments do not change the ticket status. Internal notes remain separate.
- New workflow notifications and email jobs target Ahmed only, at ahmed.emad@selaheltelmeez.com. Legacy pending jobs are excluded from delivery.
- Related issues are separate cases linked to an accessible original case.
- Dashboard adds unique reopened cases, lifetime reopen events, resolution events by event date, missing tracker data, recorded contact channels and zero-volume sources.

Validation completed:
- Production build and TypeScript pass.
- 23 changed TS/TSX files: zero ESLint errors or warnings.
- 50 application regression tests pass.
- 43 assertions against real local PostgreSQL via PGlite pass, including RLS, all source mappings, comments, duplicate attempts, two solution cycles, snapshots and central-only routing.
- Local browser checks: explicit reopen selection and Arabic reason survive failed submission; recorded source owner and contact channel remain independent; mobile layout has no horizontal overflow at 390px; no console errors/warnings observed.
- Production read-only verification: 64 tickets (61 resolved, 2 closed, 1 new), lifecycle schema not applied.

Release blockers:
1. Supabase mutation confirmations expired on the transaction validation attempt and both migration application attempts. No migration was applied. The dashboard browser fallback requires a Supabase sign-in. Do not deploy code that reads the new schema before applying the migration.
2. No SMTP / Resend delivery settings exist in Vercel. An Outlook destination address does not itself authorize or configure a sender. No real message delivery has been verified. Use an approved existing company sender without adding a paid service.

Next release steps:
1. Apply `supabase/migrations/20261110150000_case_lifecycle.sql` through the authenticated Supabase connection after its confirmation succeeds.
2. Verify live schema, routing configuration, six source owners and unchanged legacy ticket counts. Run security advisors.
3. Push this prepared branch and deploy its exact commit to the existing production project.
4. Smoke-test an explicitly marked synthetic ticket end-to-end through the UI, including the reporting account's permissions, resolution, comment and reopen. Do not modify historical customer cases.
5. Connect the approved sender and verify one email to Ahmed only. Do not release legacy queued mail or notify reporting owners during rollout.

Local database test setup (no hosted environment):
`npm install --prefix audit/db-test --no-package-lock --ignore-scripts @electric-sql/pglite`
`node scripts/lifecycle-db.test.mjs`

Local UI preview: http://localhost:3101/login/preview-lifecycle (development only).
