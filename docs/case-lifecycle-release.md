# Case lifecycle release

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
- Production migration applied after connector confirmation; six source owners and central routing verified.
- A real production transaction exercised creation, owner visibility, unrelated-user denial, resolution, comment idempotency, reopen, duplicate reopen refusal and a second resolution, then rolled back completely. Counts remain 64 tickets and no committed workflow events from QA.

Email connection pending:
- Microsoft Graph app-only sender is implemented and covered by transport tests. See `docs/company-outlook-email.md` for the scoped company-mailbox setup. No sender credentials or company app permissions have been configured. Actual Outlook delivery is not yet verified.
- Supabase security advisors reported no new workflow-table RLS issue. Existing server-only tables intentionally have no client policies; the pre-existing leaked-password-protection warning remains. No paid feature was enabled.

Release procedure:
- Deploy the exact tested commit to the existing support-crm production project, then verify the canonical site. Production smoke-test evidence and deployment ID are recorded separately in audit.

Local database test setup (no hosted environment):
`npm install --prefix audit/db-test --no-package-lock --ignore-scripts @electric-sql/pglite`
`node scripts/lifecycle-db.test.mjs`

Local UI preview: http://localhost:3101/login/preview-lifecycle (development only).
