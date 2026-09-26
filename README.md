# Support Center — Selah El Telmeez

Internal ticketing and WhatsApp inbox for the Technical Support team. Next.js 16 (App Router) + Supabase.

Design docs: `docs/technical-design.md`, `docs/ui-ux-spec.md`. UI designs live in the Wonder file "Selah El Telmeez – Support CRM".

## Setup

1. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in the URL, publishable key and secret key.
2. Apply the database schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`, and run `supabase/seed.sql` once in the SQL editor for the starter lists.
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
