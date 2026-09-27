# UI/UX Spec — Support Ticketing & WhatsApp CRM (Phase 1)

Design target: Wonder canvas, desktop 1440×900, **English only** (no Arabic UI, no RTL).

## 1. Visual Direction — "Clean SaaS" on the Selah El Telmeez brand

Brand: **Selah El Telmeez (سلاح التلميذ)** — logo `docs/brand/logo-selah-el-telmeez.jpg`, mascot `docs/brand/mascot.jpg`.

Register: product surface → clarity over decoration. One accent (brand green), information on surfaces, tight/balanced density. The mascot appears only on empty states and the sign-in screen, never inside working screens.

| Role | Value | Notes |
|---|---|---|
| Ground | `#FFFFFF` | Main content surface |
| Subtle surface | `#F6F7F9` | App background behind panels, table header, sidebar |
| Border | `#E4E6EB` | Hairlines, inputs |
| Text primary | `#15171C` | Headings, body |
| Text secondary | `#5A5F6B` | Meta, labels (≥ 4.5:1 on white) |
| Brand green | `#159D49` | Sampled from the logo. Logo, large brand moments, icons, active indicators |
| Brand green (action) | `#0F7A39` | Primary buttons and links — white text on `#159D49` is only 3.5:1, so text-bearing actions use the darker step (5.4:1) |
| Brand tint | `#E6F5EC` | Selected rows, active nav background |
| Mascot red | `#D7282F` | Danger / errors (taken from the mascot's tie and shoes) |
| Mascot yellow | `#F2C200` | Sparingly: highlights such as the unread dot on the sign-in illustration; never as text |

Ticket status colors (badge = tinted background + dark text of the same hue):

| Status | Dot / text | Background |
|---|---|---|
| New | `#2447D6` (blue — keeps "new" distinct from the green brand) | `#EBEFFD` |
| In Progress | `#A15C00` | `#FDF1DE` |
| Awaiting Customer | `#6B3FC4` | `#F1EBFC` |
| Resolved | `#1E7A46` | `#E4F4EA` |
| Closed | `#4B5060` | `#EEEFF2` |

Source tags: WhatsApp (green icon), Moderation (shield icon), Call Center (headset icon) — neutral chip with a colored icon, so they never compete with status colors.

Typography: **IBM Plex Sans**, with IBM Plex Mono for ticket numbers.
Scale: 24/32 semibold (page title) · 16/24 semibold (section) · 14/20 regular (body/table) · 13/18 medium (labels, meta). Ticket numbers in IBM Plex Mono 13.

Radii: 8px controls, 12px panels. Shadows only on overlays (drawers, menus, modals).

## 2. App Shell

- **Sidebar** (240px, `#F6F7F9`): logo, role-specific nav, language switch (EN / ع), user menu at the bottom.
- **Top bar** (56px): page title, global ticket search (agents), notifications bell with unread count.
- Content area on white.

Navigation per role:

| Role | Nav items |
|---|---|
| Technical Support | Inbox · Tickets · Dashboard (Phase 2: Quick Replies) |
| Technical Support + Admin (the owner) | same, plus an **Admin** section: Users · Settings |
| Moderation / Call Center | New Ticket · My Tickets |
| Manager | Dashboard · Tickets (view and export only) |

> No separate owner role and no Email Log screen (D-18).

## 3. Screen Inventory (Phase 1)

### Auth
| # | Screen | States |
|---|---|---|
| A1 | Sign in | default, account locked (5 failed attempts, 15-min countdown + "contact the system owner"). No forgot-password flow — the owner resets passwords from X1 |

### Moderation / Call Center portal
| # | Screen | States |
|---|---|---|
| P1 | New Ticket form | default, inline validation errors, uploading attachments |
| P2 | Ticket submitted | confirmation with Ticket ID + "View ticket" / "Create another" |
| P3 | My Tickets | populated list (ID, customer, issue, status, date), empty state |
| P4 | My Ticket detail | read-only fields, attachments, status timeline |

Form layout (P1) — grouped into 4 sections instead of 17 flat fields:
1. **Customer** — Name, Email, User Type, User Name (Credentials, marked sensitive), School Name (optional), City
2. **Device & App** — Platform, Device Type, Latest Version (Yes/No), Version Number, Fawry Payment (Yes/No)
3. **Issue** — Date of Issue, Page / Screen, Steps / Scenario, Issue Description
4. **Attachments** — drag & drop, JPG/PNG ≤ 10 MB, MP4/MOV ≤ 50 MB, max 5 files

"Reported By" is shown as a read-only chip (auto from role), not a field.

### Support Agent
| # | Screen | States |
|---|---|---|
| S1 | Inbox | 3 columns: conversation list (search, unread badges) · chat thread + composer · customer panel (details, linked ticket, other open tickets) |
| S2 | Inbox — outside 24h window | composer replaced by "Send template" picker with explanation |
| S3 | Create ticket from chat (drawer) | pre-filled name/phone; warning variant when an active ticket already exists ("Open TKT-2026-00412") |
| S4 | All Tickets | table with filters (status, source, date, city, assignee), saved quick tabs (All / New / Mine / Awaiting), empty/no-results state |
| S5 | Ticket detail | header (ID, status select, assignee), form data (read-only), agent fields (Issue Category, Root Cause, Action Taken, Resolution Notes), internal notes, status history timeline, linked conversation; Closed variant (locked + "Create follow-up ticket") |
| S6 | Notifications panel | dropdown list from the bell: new ticket items with ID, source, summary; empty state |

### Admin (Technical Support account with admin permission)
| # | Screen | States |
|---|---|---|
| X1 | Users | table (name, email, role, status, last sign-in); role changed inline; "Add user" and "Edit user" panel with role select + set new password (generate / show) ; unlock a locked account; deactivate / reactivate (no delete) |
| X2 | Settings | tabs: Cities · Issue Categories · Root Causes · Notification email; archive instead of delete |

### Cross-cutting
- Technical Support dashboard (D-17): filters, KPI cards, tickets per day, by source/status, resolution time per category, top root causes, Excel/CSV + PDF export.
- Toasts: ticket created, status changed, message failed (retry).

## 4. Key Interaction Rules
- Status change is a single select in the ticket header; moving to **Resolved** requires Issue Category (inline prompt if empty); moving to **Closed** asks for confirmation ("Close TKT-2026-00412? Closed tickets can't be edited." → "Close ticket" / "Keep open").
- Creators never see agent fields, internal notes, or the chat.
- Nothing is deleted anywhere in the UI — actions read "Archive" / "Deactivate".
- Sensitive field (Credentials) shows a lock icon and is masked by default with a "Show" toggle for agents.

## 5. Build Order on Canvas
1. Foundations: color/type tokens (**approved** — created as Wonder variables), app shell (sidebar + top bar) as a reusable component, core components (button, input, select, badge, table row, chip).
2. Portal: P1 → P2 → P3 → P4.
3. Agent: S1 → S3 → S4 → S5 → S2 → S6.
4. Auth: A1 (+ locked).
5. Admin: X1 → X2.
6. Dashboard.

## UI polish and responsive behavior

The interface keeps the green action color, English UI, and existing role permissions. Sign-in uses a forest-green brand panel on large screens and a focused single-column layout on phones. Password visibility is optional and errors are announced to assistive technology.

Below 1024px, navigation moves into a keyboard-accessible drawer. Ticket form sections stack on smaller screens, ticket details move the status timeline below the content, and tables scroll horizontally rather than squeezing their columns. The Users screen includes a keyboard-accessible edit action.

Hover feedback uses short color and position transitions. Page entry animations and decorative sign-in motion respect `prefers-reduced-motion`. Keyboard users have visible focus indicators, a skip-to-content link, and focus on the first invalid ticket field.

GitHub Actions runs lint, a production build, and TypeScript checks. CI uses placeholder public Supabase configuration only for compilation; authenticated end-to-end testing requires a configured Supabase project and test account.
