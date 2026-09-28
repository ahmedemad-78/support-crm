# Technical Design — Support Ticketing & WhatsApp CRM System

| Field | Details |
|---|---|
| Based on | BRD v1.0, FRD/SRS v1.0, User Stories v1.0 |
| Version | 0.1 (draft) |
| Date | 2026-09-26 |
| Stack | Next.js (App Router) + Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, Cron) |

---

## 1. Architecture Overview

```
                 ┌────────────────────────────── Vercel ──────────────────────────────┐
 Browser ───────►│ Next.js App Router                                                 │
 (English)       │  • Server Components / Server Actions (all mutations)              │
                 │  • Route Handlers:  /api/webhooks/whatsapp  (Meta → us)            │
                 │                     /api/export/*           (CSV/XLSX/PDF)         │
                 │  • proxy.ts: session refresh + role-based route guard              │
                 └───────────┬──────────────────────────────────────┬─────────────────┘
                             │ supabase-js (user JWT → RLS)         │ Graph API
                             ▼                                      ▼
 ┌──────────────────────── Supabase ─────────────────────┐   WhatsApp Cloud API
 │ Postgres  (RLS on every table, triggers, RPCs)        │   (direct Meta or BSP)
 │ Auth      (email + password)                          │
 │ Realtime  (inbox messages, in-app notifications)      │
 │ Storage   (ticket attachments, WhatsApp media)        │
 │ Edge Fn   process-email-outbox  ──► Email provider    │
 │ pg_cron   email retry sweep, future retention job     │
 └───────────────────────────────────────────────────────┘
```

Principles:

- **RLS is the security boundary.** The UI hides what a role can't use, but every rule in FRD §3 / §7.1 is enforced in Postgres. The `service_role` key is used only in server-side code that has no user context (WhatsApp webhook, email worker).
- **Business rules live in the database** where they must hold regardless of caller: status transitions, Closed lock, audit log, one active ticket per conversation, ticket numbering, notification fan-out.
- **External integrations sit behind adapters** (WhatsApp, email, AI) so providers can be swapped and a mock can be used before Meta/BSP approval.

## 2. Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router, TypeScript | Server Actions + Route Handlers cover UI, webhooks and exports in one app |
| Backend | Supabase | Postgres + Auth + Realtime + Storage out of the box; RLS gives API-layer RBAC |
| Supabase client | `@supabase/ssr` | Cookie-based sessions in Server Components / Actions |
| UI | Tailwind CSS + shadcn/ui | Logical properties (`ms-*`, `pe-*`) make RTL straightforward |
| Forms & validation | react-hook-form + zod | One zod schema shared by client and server |
| Tables | TanStack Table | Filtering/sorting for ticket lists |
| Email | Resend (default; any SMTP/transactional provider fits the adapter) | FRD §6.3 |
| AI (Phase 2) | Vercel AI SDK behind an internal `AiAssistant` interface | Provider-agnostic per FRD §2.4 / §6.2 |
| Charts (Phase 2) | Recharts | |
| Export (Phase 2) | CSV native, XLSX via `exceljs`, PDF via HTML→PDF (headless Chromium) | HTML→PDF renders Arabic shaping/RTL correctly; most JS PDF libs don't |
| Hosting | Vercel (app) + Supabase Cloud, region `eu-central-1` (closest to Egypt) | |
| Local dev | Supabase CLI local stack + migrations in git | |

## 3. Decisions on Gaps in the Requirements

These are defaults adopted to unblock design. Each should be confirmed by the business owner; changing any of them is cheap at this stage.

| # | Gap | Default decision |
|---|---|---|
| D-1 | Dashboard needs "issue type" and "root cause", but no such form fields exist | Add **agent-only** fields on the ticket: `Issue Category`, `Root Cause`, `Action Taken`, `Resolution Notes`. Categories and root causes are admin-managed lookup lists (AR/EN). Issue Category is required before a ticket can move to Resolved. The same category list tags quick replies. |
| D-2 | Mandatory fields for tickets created from WhatsApp are undefined; Email and "Reported By" don't fit | WhatsApp tickets require only: Name (pre-filled), Phone (pre-filled), Issue Description. All other form fields are optional for this source. "Reported By" is replaced by the system field `Source = WhatsApp`. |
| D-3 | No role manages users or lookup lists | Add a **Super Admin** role: manage users/roles, cities, issue categories, root causes, notification distribution list. Manager/Admin stays read-only as specified. |
| D-4 | No ticket assignment; UC-2 mentions "ticket notes" that are never defined | Add optional **Assignee** (Support Agent) and **internal notes** (agents only, never visible to creators). No auto-assignment. |
| D-5 | Allowed status transitions and resolution-time definition unclear | Any transition among the four open statuses is allowed (forward or back). `Closed` is terminal and reachable from any status. Resolution time = `created_at` → last entry into `Resolved`; leaving Resolved clears it. |
| D-6 | Reopen via "new linked ticket" has no data model | `tickets.linked_ticket_id` + a "Create follow-up ticket" action on Closed tickets that copies customer data and links back. |
| D-7 | WhatsApp 24-hour customer-service window not addressed | Track `last_inbound_at` per conversation. Inside 24h: free-form replies. Outside: composer only allows approved **template messages**. Templates are managed in Meta; the app lists and sends them. |
| D-8 | BRD wants cross-channel duplicate prevention; FRD only covers one conversation | Introduce a `customers` record matched by phone (E.164) or email. When creating a ticket, show the customer's other open tickets as a warning (non-blocking). Hard rule remains: one active ticket per WhatsApp conversation. |
| D-9 | Ticket ID format | Human-readable `TKT-YYYY-NNNNN` (per-year counter), plus internal UUID primary key. |
| D-10 | Attachment limits | Max 5 files per ticket; images JPG/PNG ≤ 10 MB; video MP4/MOV ≤ 50 MB. |
| D-11 | Account lockout (5 attempts / 15 min) isn't native in Supabase Auth | Login goes through a Server Action that checks/records attempts in `auth_login_attempts` before calling Supabase Auth. |
| D-12 | "User Name (Credentials)" is sensitive student data | Visible only to agents and to the ticket's creator (RLS). Column-level encryption can be added later without schema redesign. |
| D-13 | Data retention (BRD R-3) — **decided by business owner** | **Nothing is ever deleted.** All tickets, messages, attachments and history are kept indefinitely. No hard deletes anywhere in the app: records that users "remove" (quick replies, lookup values, users) are archived via `archived_at` / `is_active` and hidden from active lists. |
| D-15 | Password recovery — **decided by business owner** | Internal tool with a single owner (Super Admin). **No self-service "forgot password".** The owner creates users, sets their initial password, resets passwords, changes roles and deactivates users from `/admin/users` (Server Actions using the Supabase Admin API with the service-role key, server-side only). Deviation from FRD UC-11 / US-14 "forgot password" criterion. |
| D-16 | Language — **decided by business owner** | **English-only interface.** Drops FRD §7.3 and US-15 (Arabic/English switch, RTL). |
| D-17 | Dashboard — **decided by business owner** | The dashboard (FRD UC-9/UC-10, US-12/US-13) is a Technical Support screen: filters, KPI cards, tickets per day, by source, by status, avg. resolution time per issue category, top root causes, Excel/CSV and PDF export. |
| D-18 | Owner role — **decided by business owner** | No super-admin/owner role. The owner is Technical Support + `is_admin`; Users and Settings live in an Admin section of the same sidebar. Supersedes D-3's Super Admin. Manager sees the dashboard and ticket list, view and export only. No Email Log screen: email retries stay automatic and failures are only written to the server logs. |
| D-19 | Attachment upload path | Files upload from the browser straight to Supabase Storage (`ticket-attachments/{ticket_id}/…`) after the ticket is created, then a `ticket_attachments` row is inserted. Server Actions and Vercel functions cap request bodies (~4.5 MB on Vercel), too small for 50 MB videos. Storage and table policies only allow the creator within 30 minutes of submitting, or Technical Support. |
| D-14 | Budget — **decided by business owner: no budget currently** | Connect **directly to Meta's WhatsApp Cloud API** (no BSP subscription; replies inside the 24h service window are free under Meta's pricing, templates outside it are billed per message). Use free tiers for email (Resend) and hosting until a budget exists. AI provider selection deferred to Phase 2 with preference for low/no-cost options. |

## 4. Roles & Access Matrix

Roles are stored in `public.profiles.role` (never in `user_metadata`, which users can edit), plus a `profiles.is_admin` flag. A `security definer` helper in a non-exposed `private` schema returns the caller's role and admin flag for RLS policies.

There is **no separate owner/super-admin role** (D-18). The owner is a Technical Support user with `is_admin = true`; only that account sees the **Admin** section (Users, Settings). `is_admin` cannot be granted from the UI — it is set once in the database.

| Resource | Technical Support | Technical Support + Admin | Moderation / Call Center / 30 June Schools / Business Development | Manager |
|---|---|---|---|---|
| WhatsApp inbox & messages | Read / send | Read / send | — | — |
| Tickets | Read all, create (WhatsApp), update | same | Create; read **own** only | Read all |
| Ticket form fields after submit | Read | Read | Read own (locked) | Read |
| Agent fields, status, assignee | Update | Update | Read status only | Read |
| Internal notes | Read / write | Read / write | — | Read |
| Status history (audit) | Read | Read | Read own tickets | Read |
| Quick replies (Phase 2) | CRUD | CRUD | — | — |
| Dashboard & export | Yes | Yes | — | Yes (view + export) |
| Users (add, role, password, unlock, deactivate) | — | Yes | — | — |
| Settings (cities, issue categories, root causes, notification email) | — | Yes | — | — |

Post-login landing: Technical Support → `/inbox`, form roles (Moderation, Call Center, 30 June Schools, Business Development) → `/portal/my-tickets`, Manager → `/dashboard`. Form roles share one portal and see only tickets they created. The database stamps `source` from the role, so 30 June Schools and Business Development stay separate from Moderation and Call Center on the dashboard.

## 5. Data Model

### 5.1 Enums

```
user_role        : support_agent | moderation | call_center | june_schools | business_development | manager
                   (support_agent = "Technical Support", june_schools = "30 June Schools", business_development = "Business Development")
ticket_status    : new | in_progress | awaiting_customer | resolved | closed
ticket_source    : whatsapp | moderation | call_center | june_schools | business_development
end_user_type    : student | teacher | parent | other
app_platform     : android | ios | web
msg_direction    : inbound | outbound
msg_type         : text | image | video | document | audio | template
msg_status       : received | queued | sent | delivered | read | failed
outbox_status    : pending | sent | failed
```

### 5.2 Tables

**profiles** — one row per auth user
`id (uuid, PK → auth.users)`, `full_name`, `email`, `role user_role`, `is_admin bool default false`, `is_active`, `created_at`

**Lookup lists** (managed by the admin from Settings)
- `cities (id, name, is_active, sort_order)` — seeded with Egyptian governorates
- `issue_categories (id, name, is_active)`
- `root_causes (id, name, is_active)`

**customers**
`id`, `name`, `phone_e164 (unique, nullable)`, `email (nullable)`, `created_at`
Index on `lower(email)`.

**whatsapp_conversations**
`id`, `customer_id → customers`, `wa_phone`, `last_message_at`, `last_inbound_at`, `unread_count`, `created_at`

**whatsapp_messages**
`id`, `conversation_id`, `wa_message_id (unique — idempotency key)`, `direction`, `type`, `body`, `media_path`, `media_mime`, `template_name`, `status msg_status`, `error`, `sent_by → profiles (nullable)`, `created_at`, `raw jsonb`

**tickets**

| Column group | Columns |
|---|---|
| Identity | `id uuid PK`, `ticket_number text unique` (`TKT-2026-00001`) |
| System | `source`, `status (default new)`, `created_by → profiles`, `created_at`, `updated_at`, `resolved_at`, `closed_at` |
| Links | `customer_id → customers`, `conversation_id → whatsapp_conversations (nullable)`, `linked_ticket_id → tickets (nullable)`, `assignee_id → profiles (nullable)` |
| Form fields (FRD §5) | `customer_email`, `customer_name`, `customer_phone`, `school_name`, `credentials_username`, `issue_date`, `city_id`, `end_user_type`, `fawry_payment bool`, `platform`, `is_latest_version bool`, `app_version`, `device_type`, `page_screen`, `steps`, `issue_description` |
| Agent fields (D-1) | `issue_category_id`, `root_cause_id`, `action_taken`, `resolution_notes` |
| Retention | none — rows are never deleted (D-13) |

Constraints:
- `CHECK (issue_date <= current_date)`
- Source-specific required fields enforced by a `CHECK` that branches on `source` (form sources require all FRD §5 mandatory fields; WhatsApp per D-2).
- One active ticket per conversation:
  ```sql
  create unique index tickets_one_active_per_conversation
    on tickets (conversation_id)
    where conversation_id is not null and status <> 'closed';
  ```

**ticket_attachments** — `id`, `ticket_id`, `storage_path`, `mime`, `size_bytes`, `uploaded_by`, `created_at`

**ticket_status_history** (audit log) — `id`, `ticket_id`, `from_status`, `to_status`, `changed_by`, `changed_at`
Insert-only; written exclusively by trigger; no UPDATE/DELETE policies.

**ticket_notes** — `id`, `ticket_id`, `author_id`, `body`, `created_at`

**quick_replies** — `id`, `title`, `body`, `language ('ar'|'en')`, `category_id → issue_categories`, `created_by`, `updated_at`, `archived_at` ("delete" archives, per D-13)

**notifications** (in-app) — `id`, `recipient_id → profiles`, `ticket_id`, `kind`, `payload jsonb`, `read_at`, `created_at`

**email_outbox** — `id`, `ticket_id`, `to_addresses text[]`, `subject`, `body_html`, `status outbox_status`, `attempts`, `next_attempt_at`, `last_error`, `created_at`, `sent_at`

**ticket_counters** — `year int PK`, `last_value int`

**auth_login_attempts** — `email`, `attempted_at`, `succeeded bool` (private schema)

**app_settings** — key/value, e.g. `support_distribution_list`

### 5.3 Triggers & Functions

| Name | When | Does |
|---|---|---|
| `set_ticket_defaults` | BEFORE INSERT on tickets | Forces `status='new'`, `created_by=auth.uid()`, derives `source` from creator role for form tickets, allocates `ticket_number` from `ticket_counters` (row lock, per year), upserts `customers` |
| `guard_ticket_update` | BEFORE UPDATE on tickets | Rejects any change if OLD status is `closed`; rejects changes to form fields (locked after submit); requires `issue_category_id` when moving to `resolved`; maintains `resolved_at` / `closed_at` / `updated_at` |
| `log_status_change` | AFTER UPDATE OF status | Inserts into `ticket_status_history` |
| `log_initial_status` | AFTER INSERT on tickets | History row `null → new` |
| `fan_out_new_ticket` | AFTER INSERT on tickets | One `notifications` row per active Support Agent + one `email_outbox` row to the distribution list |
| `create_follow_up_ticket(ticket_id)` | RPC | Creates a new ticket linked to a Closed one (D-6) |

All `security definer` functions live in schema `private` and set `search_path = ''`.

### 5.4 RLS Summary

Every table in `public` has RLS enabled. Helper: `private.current_role()` → `user_role` of `auth.uid()` (inactive users return null → no access).

- **tickets**
  - SELECT: role in (agent, manager) **or** `created_by = auth.uid()`
  - INSERT: role in (moderation, call_center, june_schools, business_development, support_agent). `set_ticket_defaults` sets source from the role (form roles keep their own source; support_agent becomes whatsapp).
  - UPDATE: role = agent (triggers enforce the rest)
  - DELETE: none
- **ticket_status_history / ticket_attachments**: SELECT follows ticket visibility (via `exists` on tickets); attachment INSERT by the ticket creator at submit time or by agents.
- **ticket_notes**: agents read/write; manager read.
- **profiles**: users read their own row; agents read names of all users (assignee picker); only `is_admin` writes, through Server Actions using the Admin API.
- **whatsapp_*:** agents only. Webhook writes with service role.
- **quick_replies**: agents, select/insert/update (no DELETE policy — archive instead).
- **No DELETE policies on any table** (D-13).
- **notifications**: recipient reads and marks own rows read.
- **email_outbox, ticket_counters, auth_login_attempts**: no client access (service role / definer functions only).
- **Lookup lists**: all authenticated users read; `is_admin` writes.
- Dashboard aggregates use views created `with (security_invoker = true)` so they inherit ticket RLS.

**Storage buckets** (private):
- `ticket-attachments/{ticket_id}/{file}` — read if the ticket is visible to the caller; write by creator/agent.
- `whatsapp-media/{conversation_id}/{file}` — agents only.

## 6. Key Flows

### 6.1 Create ticket from form (UC-5)
1. Portal form (zod-validated client-side) → Server Action re-validates with the same schema.
2. Insert ticket with the user's session → trigger assigns number, source, status, creator.
3. Upload attachments to `ticket-attachments/{id}/`, insert `ticket_attachments` rows.
4. `fan_out_new_ticket` creates in-app notifications and an email outbox row in the same transaction → no notification is lost if email is down.
5. Redirect to the read-only ticket view showing the Ticket ID.

### 6.2 Notifications (UC-8)
- **In-app:** agents subscribe via Supabase Realtime to `notifications` filtered by `recipient_id`; a bell with unread count + toast.
- **Email:** a Database Webhook on `email_outbox` insert invokes Edge Function `process-email-outbox`, which sends through the email adapter and marks `sent` or increments `attempts` with exponential backoff (`next_attempt_at`). A `pg_cron` job every minute re-invokes the function for due `pending` rows. After 8 attempts → `failed` (logged; no UI page, per D-18).

### 6.3 WhatsApp inbound (US-01/02)
1. Meta POSTs to `/api/webhooks/whatsapp`. Handler verifies `X-Hub-Signature-256` with the app secret (GET handles the verify-token handshake).
2. For each message: upsert customer + conversation by phone, insert message with `on conflict (wa_message_id) do nothing` (Meta retries → idempotent), update `last_inbound_at`, `unread_count`.
3. Media: download via Graph API to `whatsapp-media` (done after responding 200 to keep the webhook fast; failures retried).
4. Status callbacks (sent/delivered/read/failed) update `whatsapp_messages.status`.
5. Agents see new messages through Realtime subscriptions on `whatsapp_messages` / `whatsapp_conversations` (target < 5 s).

### 6.4 WhatsApp outbound
Server Action → checks the 24h window (D-7) → inserts message `queued` → calls Graph API through the `WhatsAppClient` adapter → stores returned `wa_message_id`, sets `sent`; on error sets `failed` and the UI offers "retry".

`WhatsAppClient` has two implementations: `MetaCloudClient` and `MockClient` (simulates inbound messages locally) so the inbox can be built and tested before the number migration (BRD R-1).

### 6.5 Conversation → ticket (UC-1)
"Create Ticket" in the chat header → if an active ticket exists for the conversation, show it with "Open existing" (the partial unique index is the hard guarantee) → otherwise a drawer with name/phone pre-filled and D-2 required fields → insert with `source='whatsapp'`, `conversation_id` set.

### 6.6 Status change (UC-7)
Agent selects a status in the ticket view → Server Action updates `status` → triggers validate, stamp times, write history → Realtime pushes the change to open views; the creator's "My Tickets" reflects it on next load/subscription.

### 6.7 Login (UC-11)
Server Action: if ≥ 5 failed attempts for the email in the last 15 minutes → return "locked" with the remaining cooldown and "contact the system owner". Else `signInWithPassword`; record the attempt. No forgot-password flow (D-15): users are created by the admin only (public sign-up disabled), who also resets passwords, changes roles, deactivates users and can clear a lockout from `/admin/users`. Changing a role or deactivating a user also revokes that user's sessions.

### 6.8 AI assistant (Phase 2)
```ts
interface AiAssistant {
  summarize(messages: ChatMessage[], locale: Locale): Promise<Summary>;          // issue, key facts, sentiment
  suggestReply(messages: ChatMessage[], library: QuickReply[]): Promise<Suggestion | null>;
}
```
Implemented with the Vercel AI SDK so the model/provider is a config value. Before sending text to the provider, redact credentials-like content and phone numbers. Results are shown only; nothing is sent or saved automatically. If the library grows large, add pgvector embeddings for retrieval before the LLM call.

## 7. Application Structure

```
app/
  [locale]/
    (auth)/login
    (agent)/inbox, inbox/[conversationId]
            tickets, tickets/[ticketId]
            quick-replies                      (Phase 2)
    (portal)/portal/new-ticket, portal/my-tickets, portal/my-tickets/[ticketId]
    dashboard                                   (technical support, manager)
    admin/users, admin/settings                 (is_admin only)
  api/
    webhooks/whatsapp/route.ts
    export/[format]/route.ts                    (Phase 2)
lib/
  supabase/ (server.ts, client.ts, admin.ts)
  auth/ (roles, guards)
  tickets/ (schemas.ts — shared zod, actions.ts, queries.ts)
  whatsapp/ (client.ts, meta-client.ts, mock-client.ts, webhook.ts)
  email/ (adapter, templates)
  ai/ (assistant.ts, provider config)     (Phase 2)
messages/ ar.json, en.json
supabase/
  migrations/
  functions/process-email-outbox/
  seed.sql (cities, categories, demo users)
proxy.ts
```

## 8. Language
- **English only** (D-16). No i18n framework, no locale routing, no RTL.
- Customer-entered text (names, descriptions, WhatsApp messages) can still be Arabic; it renders with the browser's Arabic font fallback.

## 9. Non-Functional Coverage

| Requirement | How |
|---|---|
| RBAC at API layer | RLS on every table + storage policies; service role only in webhook/worker |
| No lost messages/tickets | Idempotent webhook (`wa_message_id` unique), transactional outbox for email, retries with backoff |
| Audit log | Trigger-written `ticket_status_history`, insert-only |
| Real-time < 5 s | Supabase Realtime on messages and notifications |
| Password storage | Supabase Auth (bcrypt) |
| HTTPS | Vercel + Supabase defaults |
| Scalability | Volume < 20/day; indexes on `tickets(status, created_at)`, `tickets(created_by)`, `tickets(source)`, `whatsapp_messages(conversation_id, created_at)` |
| Retention | Keep everything indefinitely (D-13); no DELETE policies; archive flags instead of deletes. Storage growth is small at < 20 tickets/day |

## 10. Phase 1 Build Plan

| Milestone | Scope | Stories |
|---|---|---|
| M0 — Foundation | Next.js + TypeScript + Tailwind + shadcn/ui, Supabase local stack, CI (lint, typecheck, migration check), base layout | — |
| M1 — Auth & RBAC | Profiles, roles, RLS helpers, login with lockout, role-based routing, admin user management (create, set/reset password, change role, unlock, deactivate) & Settings lists | US-14 |
| M2 — Portal | Ticket schema + triggers, new-ticket form with attachments, My Tickets list & read-only detail with status history | US-06, US-07 |
| M3 — Agent tickets | All-tickets list with filters, ticket detail, status change + audit, agent fields, assignee, internal notes, follow-up ticket | US-04, US-05 |
| M4 — Notifications | In-app notifications via Realtime, email outbox + Edge Function + cron retry | US-11 |
| M5 — WhatsApp | Adapter + mock, webhook, inbox UI with Realtime, send text/media, 24h window + templates, conversation → ticket | US-01, US-02, US-03 |
| M6 — Hardening | RLS test suite, Supabase advisors, UAT with Support/Moderation/Call Center, parallel run with the old form (BRD R-5) | — |

M5 can run with the mock client while Meta/BSP approval (R-1) is pending; switching to the real number is a configuration change.

## 11. Testing Strategy
- **RLS tests** (SQL, run in CI against the local stack): for each role, assert what it can and cannot select/insert/update, including cross-department isolation between Moderation and Call Center.
- **Trigger tests:** numbering under concurrency, Closed lock, locked form fields, history rows, fan-out.
- **Unit tests:** zod schemas, WhatsApp webhook parsing/signature, 24h window logic.
- **E2E (Playwright):** login per role, submit ticket, agent status change visible to creator, AR/EN switch.

## 12. Open Items (need business decision)

| Item | Blocks |
|---|---|
| ~~Data retention period (BRD R-3)~~ | Decided: keep everything (D-13) |
| ~~BSP vs direct Meta, and budget (R-1, R-2)~~ | Decided: direct Meta, no budget (D-14). Meta Business verification still needed for M5 |
| Hosting plan once a budget exists (Vercel Hobby is non-commercial; Supabase free projects pause after inactivity) | Go-live |
| AI provider | Phase 2 |
| Confirm defaults D-1 … D-12 | Schema finalization in M2/M3 |
| Email provider and sender domain (SPF/DKIM) | M4 |
| Issue categories and root causes initial list (from the current Sheet 1) | M3 seed data |
