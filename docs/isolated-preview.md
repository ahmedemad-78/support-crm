# Isolated CRM preview

Preview branch: codex/internal-requests-preview. Production is not a release target.

- Production database: cdtcijbddpirvayanjut (never used by this branch).
- Disposable preview database: vojietqeyfkrfisxcsrs, support-crm-preview, eu-west-1.
- New project quoted at USD 0/month by the connected cost tool. No paid branch created.
- Baseline: 15 existing non-n8n schema migrations applied to the empty preview project. No customer data, users or files copied.
- Public/server/browser clients validate the exact preview hostname and key audience. A missing or production configuration fails before constructing a client.
- Proxy rejects email and integration endpoints. Outbound delivery is blocked for preview runtime before queue reads or transport use.
- Git automatic deployments are disabled for this preview branch in vercel.json. Deploy manually with explicit preview target; do not promote or alter the canonical production alias.

## Credential setup

.env.local is ignored by Git. The URL and publishable key belong to the preview project. The remaining SUPABASE_SECRET_KEY must also belong to the preview project. Never use a production server credential.

The optional scripts/prepare-preview-env.mjs uses the authenticated official Supabase CLI to obtain only this project's keys and save them locally without printing them. If CLI authentication is unavailable, the administrator may enter the preview project's server key directly in .env.local.

## Verification status

- Current production-source baseline plus preview checks: 107 tests pass.
- Isolation checks cover target host, key audience, production rejection, integration route block and no queue/transport access during preview delivery.
- TypeScript passes.
- A functional deployment is not yet certified: server key, synthetic Auth account, Storage write/read and deployment verification still required.
- Business workflow implementation starts only after functional isolation checks. n8n is deferred.

Test commands: npm test; node --test --experimental-test-isolation=none scripts/isolation.test.mjs; npm run typecheck.
