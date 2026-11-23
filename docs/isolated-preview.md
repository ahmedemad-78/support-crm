# Isolated CRM preview

Preview branch: codex/internal-requests-preview. Production is not a release target.

- Production database: cdtcijbddpirvayanjut (never used by this branch).
- Disposable preview database: vojietqeyfkrfisxcsrs, support-crm-preview, eu-west-1.
- New project quoted at USD 0/month by the connected cost tool. No paid branch created.
- Baseline: 15 existing non-n8n schema migrations applied to the empty preview project. No customer data, users or files copied.
- Public/server/browser clients validate the exact preview hostname and key audience. A missing or production configuration fails before constructing a client.
- Proxy rejects email and integration endpoints. Outbound delivery is blocked for preview runtime before queue reads or transport use.
- Git automatic deployments are disabled for this preview branch in vercel.json. Use a separate hosting project for further publication; the shared project's staging deployment unexpectedly changed the canonical alias and has been recovered. Do not publish again into the Production hosting project.

## Credential setup

.env.local is ignored by Git. The URL and publishable key belong to the preview project. The remaining SUPABASE_SECRET_KEY must also belong to the preview project. Never use a production server credential.

The optional scripts/prepare-preview-env.mjs uses the authenticated official Supabase CLI to obtain only this project's keys and save them locally without printing them. If CLI authentication is unavailable, the administrator may enter the preview project's server key directly in .env.local.

## Verification status

- Current production-source baseline plus preview checks: 107 tests pass.
- Isolation checks cover target host, key audience, production rejection, integration route block and no queue/transport access during preview delivery.
- TypeScript passes.
- Preview server credentials, synthetic Auth sign-in, private Storage upload/read, RLS and the deployed baseline health endpoint were verified successfully before business changes.
- New workflow migrations are applied only to the disposable Preview database. All accounts, tickets and attachments used for testing are synthetic.
- `scripts/workflow-v2-api.test.mjs`: 70 integration assertions, including concurrent starts, optimistic concurrency, idempotency, ownership, department boundaries, private media, final-solver credit and notification recipients.
- `scripts/workflow-v2-ui.test.mjs`: end-to-end intake, media, work/wait/reply/resolve, manager visibility, member reports, export and responsive layout.
- `scripts/workflow-v2-admin-ui.test.mjs`: six checks covering actual admin department/account provisioning, automatic department assignment and restricted administration.
- Legacy PostgreSQL regression suite: 209 assertions. Full lint, TypeScript and optimized build pass. Remote publication is pending separate Vercel project access; see the incident and hosting status in workflow-preview-review.md.
- n8n, Telegram, AI and company-email integration are deferred. Outbound transports remain blocked.

## Local review accounts

Synthetic fixture credentials are in the ignored local file `.vercel/preview-accounts.json`. Start with `preview-admin@example.test`; representative, worker and manager fixtures are available in the same file. Passwords must not be committed or pasted into deployment logs.

## Release boundary

This branch intentionally rejects any backend other than the isolated Preview project. It is **not ready to promote to Production**. A separately reviewed release must select the Production configuration, review and apply the additive migrations, assign existing accounts to departments, and explicitly approve the cutover. No such Production operation has been performed.

See [workflow-preview-review.md](workflow-preview-review.md) for review scenarios and operational limits.

Test commands: npm test; node --test --experimental-test-isolation=none scripts/isolation.test.mjs; npm run typecheck.
