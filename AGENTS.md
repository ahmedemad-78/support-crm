<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent environment

Local development is Next.js plus the Supabase CLI stack. Docker and the Supabase CLI are part of the environment image.

- Install dependencies with `npm ci`.
- On boot, `/usr/local/bin/support-crm-start` (same contents as `scripts/cloud-agent-start.sh`) starts Docker and `supabase start`, writes `.env.local` from `supabase status -o env`, and runs `npm run dev`.
- App: http://127.0.0.1:3000. Sign-in lands Technical Support on `/inbox`. Settings at `/admin/settings` reads seeded cities, issue categories, and root causes.
- Local admin email: `dev-admin@example.com`. The password is generated on first boot and stored in `/home/ubuntu/.support-crm-dev-admin-password`.
- `npm run create-admin -- --email … --name … --password …` creates another owner login. `is_admin` is granted only in the database: `update public.profiles set is_admin = true where id = '<user-id>';`
- Checks: `npm run lint`, `npm run typecheck`.
