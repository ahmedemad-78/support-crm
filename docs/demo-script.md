# Demonstration script — Digital Director and Software Team

Suggested duration: 12–15 minutes. Present screenshots or synthetic fixtures for write operations; use production only for authorized read-only reporting. No customer record is disposable demo data.

1. Business context (1 minute): issues arrive through Call Center, Moderation, B2B, 30 June Schools, WhatsApp and Google Play. Today they are entered manually. A case brings the reporting owner, Support response and follow-up into one traceable workspace.
2. Login / navigation (1 minute): explain role-based landing pages and private access; do not show credentials or the user administration email list.
3. Intake (2 minutes): select Call and show its reporting owner, separate contact channel, required fields and optional evidence. Use synthetic customer details. Do not submit into production for presentation.
4. Queue / case file (2 minutes): search and filter, open context, one unified status/tracker save, internal notes versus public comments and previous activity.
5. Lifecycle (3 minutes): synthetic create, five tracker values and a meaningful Support solution, resolve and close directly, reopen the same problem with a reason, show count/history. A different problem gets a linked new case. A comment alone does not reopen.
6. Dashboard (2 minutes): total versus follow-up versus resolved versus closed without response, date/source intersection and drill-down. Explain that Fawry is a recorded flag, not payment settlement or revenue. Unknown values are visible. Current 61 resolved records are not 61 newly journaled resolution events.
7. Handover (2–4 minutes): test evidence, deferred email/history, destination choices, backup/restore and cutover acceptance. Ask the Software Team to nominate the deployment/DB owner and confirm infrastructure constraints.

## Expected questions

- Automatic integrations? Not in the current scope: manual intake is supported; Conversations is not a connected WhatsApp inbox.
- Email working? No. Configuration/delivery is deferred by the owner; in-app central notifications are implemented. Do not click Send test during this demo.
- All old cases clean? No. Historical correction/backfill is deferred. Missing tracker/contact data remains explicit.
- Can it move to company servers? Yes, via self-hosted Supabase or a separately scoped replacement of the Supabase data/auth layer. The target has not yet been provisioned or validated.
- Is it 100% ready? State the actual gate: reviewed demo plus transfer plan. Company-wide launch additionally needs target acceptance, restore rehearsal and operator sign-off.
