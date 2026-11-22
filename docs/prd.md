# Support CRM product requirements

**Manual-intake release · 21 November 2026 · Product, Support, Engineering and QA**

A reporting employee needs a case number they can follow. Technical Support needs one place to investigate the issue and record the outcome. A manager needs to see workload and distinguish solved problems from cases closed without a customer response. This document specifies what each person can see and do, what constitutes a successful operation, and how to recover when an operation fails.

The [BRD](brd.md) defines the business rules. The [operating guide](business-workflow.md) explains ownership and metrics. The [user stories](user-stories.md) supply acceptance scenarios. The scope here is the user-facing manual-intake application on the handover branch. Development previews are fixtures for demonstrating those screens. Email delivery and company deployment have separate rollout decisions.

## 1. Access and navigation

| Active account | Landing screen | Case scope | Permitted actions |
| --- | --- | --- | --- |
| Technical Support | Case register | All cases | Create on behalf of a source, assign work, edit classification and status, reply, add private notes, reopen, link cases, report and export |
| Technical Support with administration | Case register | All cases | All Support actions plus Users and Settings. The database administration flag grants these additional privileges. |
| Manager | Dashboard | All cases, including internal notes and customer account identifier | Read case details, filter reports, export and print. Case creation, assignment, replies, notes and lifecycle edits are unavailable. |
| Moderation | My tickets | Own reporting account | Create a Moderation case, read it, attach evidence, reply, reopen the same issue or create a linked case |
| Call Center | My tickets | Own reporting account | Same portal actions, using the Call Center source |
| B2B Schools | My tickets | Own reporting account | Same portal actions, with a school name required on standard intake |
| 30 June Schools | My tickets | Own reporting account | Same portal actions, using the dedicated school form described below |

A portal role determines the source; the reporting account determines visibility. A colleague with the same role has a separate queue. For older cases without a reporting owner, the portal detail lookup falls back to the original creator. Portal users cannot assign work, classify cases, resolve them, read internal notes or open organization-wide exports. Permission checks apply to direct URLs and server actions as well as navigation.

## 2. Sign-in, home and sign-out

**Screens:** `/login`, `/`. **Session action:** `/auth/signout`. **Stories:** US-01, US-02.

1. Enter a work email and password. Invalid email syntax or an empty password produces feedback beside the affected field.
2. Successful sign-in opens the role’s landing screen. The home URL makes the same decision for an existing session. Signing out returns to login.
3. An incorrect credential pair consumes an attempt. Five counted failures in a rolling fifteen-minute window lock the account until the oldest counted failure expires. An administrator can unlock it. Provider rate limits and temporary service failures have separate messages and do not consume a password attempt.
4. A deactivated or unactivated account receives account-specific guidance. A signed-out visitor opening a protected page returns to login. An active user entering a page outside their role returns to their own landing screen. A protected CSV download denies unauthorized access with HTTP 403.

## 3. Case register

**Screen:** `/tickets`. **Roles:** Support and Manager. **Stories:** US-04, US-08, US-11, US-13.

Open on All cases, including finished work. Search and filter the register to find a case, identify unassigned work or inspect the records behind a dashboard figure. Display the matching cases with their case number, status and ownership. A dashboard drill-down carries its selection into the register. Opening a case leads to its detail screen. Only Support sees the create action.

A successful filter or page change shows matching authorized rows. A valid selection with zero matches is an empty result; clearing filters broadens the search. A data-load failure is a failed request: retry loading before using the result for reporting. No filter, navigation or export operation changes a case.

## 4. Create case and Create ticket

**Screens:** Support `/tickets/new`; portal `/portal/new-ticket`. **Stories:** US-03 through US-06.

| Decision | Support entry | Portal entry |
| --- | --- | --- |
| Who reported it? | Choose an active source and eligible reporting owner. A bound source uses its team; an unbound source uses a Support account. | Source and reporting owner come from the signed-in account. |
| Who recorded it? | The signed-in agent, even when another person is the reporter. | The signed-in reporter. |
| What happens after saving? | Open the saved case, or choose Create & add another for successive entries. | Open the saved ticket and follow it from My tickets. |

**Standard form.** Record issue date, customer name and type, city, platform and issue description. Use a listed city or type a place. Customer name requires at least two characters. Description accepts 5–8,000 characters. Issue date must be a real date no later than today in Cairo. Contact details, account identifier, device, screen and reproduction steps are optional; entered email and phone must pass validation. Installed apps require a Yes, No or Unknown latest-version answer. Web skips installed-version details. Fawry accepts Yes, No or Unknown. B2B additionally requires the school name.

**30 June form.** Pick a school or enter an unlisted school. A known school supplies its city when available; otherwise supply the city. Capture issue date, affected group, platform, problem description, issue type and whether a MySchool update was requested (Yes, No or Not sure). School code and affected user IDs are optional. The school supplies the customer name. Personal contact and app-version questions are omitted; the system stores Fawry as No. A missing school name, issue type or MySchool answer prevents creation, including direct database writes.

**Evidence and submission outcomes**

| Outcome | What the user sees and does |
| --- | --- |
| Ready | Review the required fields and submit. Optional evidence supports up to five files per submission. Video is limited to 50 MB per file; supported images, audio, PDF and Excel are limited to 10 MB each. |
| Invalid or incomplete | Required-field feedback or file validation identifies what to correct. Missing source configuration or an ineligible owner prevents a valid Support submission. |
| Saved | A numbered case records the supplied facts, source, reporting owner and original creator. The intake facts lock. Subsequent clarification belongs in activity. |
| Save outcome uncertain | Entries remain on the form. Retry there using the same request. Starting a fresh form would lose that request identity. |
| Case saved, some evidence failed | The saved case remains available. Retry the remaining attachments or open the case to check the evidence. The retry targets the existing case number. |

## 5. Support and Manager case detail

**Screen:** `/tickets/[ticketId]`. **Stories:** US-06 through US-11.

Read the original issue, reporter, creator, customer and school context, evidence, shared activity, status history and earlier resolutions. Support works in the case controls; the Manager inspects the same case in read-only mode.

| Operation | Successful result | Failure and recovery |
| --- | --- | --- |
| Assign and update | Save the selected active Support agent or leave the case unassigned. Save status, tracker and response through the case workspace. | Invalid assignees, classifications or statuses are rejected. When the record version is stale, reload and reconcile with the latest saved work. |
| Resolve & close | Save a meaningful response of at least five characters and all five fields: request type, topic, cause, action and outcome. The owner can see the response. | Missing requirements are listed; the draft remains available. An unsuccessful save cannot be counted as a resolution. |
| Close without response | Record Closed - No Response when follow-up ends without a customer response. The five resolution fields are optional for this outcome. | Invalid or stale updates follow the same save checks. Check the current status before retrying. |
| Add internal note | A private note of 2–4,000 characters becomes available to Support and the Manager. | Validation or storage failure leaves the note unsaved. The agent can correct or retry the draft. |
| Send a shared reply | The committed message and its private attachments appear in shared activity. A regular reply leaves status unchanged, including on a finished case. | Invalid files or a rejected send produce feedback. If confirmation is lost, retain the message, refresh activity and reuse the request to avoid duplicates. |
| Reopen the same issue | Explicit reopening of a finished case with a reason returns it to In Progress, increments the reopen count once and preserves the earlier outcome. | A reason shorter than five characters or a stale/conflicting request cannot start another cycle. Check activity before retrying. |
| Record a different issue | Open linked intake and submit it to create a separate numbered case linked to the accessible original. | The new record must pass its own intake checks. Leaving the form without submitting creates no related case. |

## 6. Reporting portal

**My tickets — `/portal/my-tickets`.** All four portal roles see their own queue, with an all-tickets total and views for open work, waiting, unread replies, historical reopening and finished cases. Search by case number, customer or issue text. Sorting and pagination retain the selection. Summary indicators cover all owned cases; the result count reflects the selected filter. Desktop rows and mobile cards open the same ticket. No matches can mean the filter is too narrow. Opening the list alone leaves replies unread. **Stories:** US-03, US-10.

**Ticket detail — `/portal/my-tickets/[ticketId]`.** Show issue and evidence, customer context, Support response, conversation and status history. The reporter can reply, supply attachments, explicitly reopen a finished case with a reason or start a linked case. The reply, reopen and attachment outcomes in section 5 apply. Internal notes and the Support classification editor stay private. A malformed, missing or foreign case ID returns a not-found page. Opening an attachment requires authorized access. A failed read acknowledgement offers retry; only the loaded reply events for that recipient can be marked read. **Stories:** US-03, US-06, US-07, US-09, US-10.

## 7. Notification bell and Conversations

**Notification bell.** An active user opens their own notices, follows a case and can mark an item or all their notices read. Support replies and status updates go to the active reporting owner. New cases, reporter replies and reopening go to the active assigned agent or configured fallback. Exclude the actor from self-notifications. Internal notes do not notify the reporter. A status-only notice does not increase the unread-reply count. If a read update is unconfirmed, refresh the list to establish the saved state. Marking a notice read does not change case status. In-app notification is independent of outbound email. **Story:** US-10.

**Conversations — `/inbox`.** Support only. This screen displays Coming soon and offers links to the case register and Analytics. Shared case replies are sent inside the case detail screen. There is no live WhatsApp connection, inbound-message processing or delivery confirmation on this screen. Opening it under another role follows the role redirect.

## 8. Dashboard, export and print

**Dashboard — `/dashboard`.** Support and Manager start with all cases. Select a period, source or other available dimension; the filters intersect. Read total, open, resolved, closed without response and ever-reopened cases. Inspect volume by source, problem classification, resolution outcomes, workload and geographic distribution. Selecting a supported chart segment or map location narrows the selection; opening matching cases carries that scope to the register. Missing values remain explicit. The open-follow-up section has its own date scope. For metric definitions, see the [operating guide](business-workflow.md). **Stories:** US-11, US-12.

A successful refresh updates the figures under the existing filters. A failed background refresh retains the last successful snapshot and reports the failure. Zero matching cases is a valid selection. Egypt and World map views aggregate by recorded location; the bundled fallback renders if the external basemap cannot load.

| Output | Successful result | Failure or boundary |
| --- | --- | --- |
| Dashboard CSV, `/dashboard/export` | Download cases matching the dashboard selection. | An unauthorized session receives HTTP 403. A load failure cannot confirm a complete export. |
| Register CSV, `/tickets/export` | Download every matching authorized row across all pages, with Arabic and multiline text supported. Exclude internal notes, sign-in secrets and private media links. | An unauthorized session receives HTTP 403. A failed query must not be interpreted as an empty register. |
| Register print screen, `/tickets/print` | Review the full filtered landscape report, then use the browser print dialog to print or save a PDF. | Cancelling the browser dialog creates no PDF. If report loading fails, reload the report before printing. The action has no effect on cases. |

**Story:** US-13. For acceptance, choose a filter spanning multiple register pages and compare case numbers across the register, CSV and print report.

## 9. Administration

**Users — `/admin/users`.** Support with administration only. Create a staff login, choose its role, reset a password, unlock sign-in, or deactivate/reactivate the account. The administration flag is controlled separately from role selection. **Stories:** US-01, US-02.

| Action | On success | On failure |
| --- | --- | --- |
| Create account | A login and active profile exist with the selected role. | Invalid fields and duplicate emails are reported. If login creation succeeds but profile setup fails, the system attempts suspension. Repair that account before use; do not create a duplicate. |
| Change role or password | Save the requested change and apply the required session handling. | Changing the administrator’s own role is blocked. If profile and login settings diverge or session revocation fails, the result identifies the partial change for review before retry. |
| Unlock | Clear the temporary sign-in lock for that email. | Invalid input or a failed operation does not confirm an unlock. |
| Deactivate or restore | Update profile availability and sign-in restrictions. Deactivation preserves historical attribution and revokes existing sessions. | Self-deactivation is blocked. If a restriction or session revocation fails after the profile changes, report the incomplete step and reconcile access. |

**Settings — `/admin/settings`.** Support with administration only. Maintain sources, cities and classification lists. Add or rename values, archive unused choices and restore them when needed. Previously typed places can be reviewed for addition to the city list. Successful changes update the available choices. An archived value remains meaningful on historical records. Invalid names, duplicate values and persistence errors produce feedback so the administrator can correct the entry. **Story:** US-14.

The mail area reports configuration and supports a single administrative test when configured. On provider acceptance, check the mailbox for receipt. If confirmation is uncertain, inspect the mailbox before retrying. A test does not enable general workflow email. Routine delivery remains deferred for this release.

## 10. Acceptance and handover

Use synthetic cases and separate accounts for Support, Manager, each portal role, an administrator and an unrelated reporter sharing a portal role. Record the case number, actor, input, expected outcome, observed outcome and evidence for each run.

| Walkthrough | Acceptance observation | User stories |
| --- | --- | --- |
| Sign in and follow protected links | Each role lands correctly; another reporter’s record and unauthorized downloads remain inaccessible. | US-01, US-03, US-11 |
| Submit standard, B2B and 30 June intake | Each source enforces its own fields. Retrying an attachment on a saved case retains one case number. | US-03–US-06 |
| Work a case through two cycles | Internal notes stay private, replies preserve status, reopening retains the first resolution and a different issue has its own number. | US-07–US-10 |
| Filter and hand over a report | Resolved and closed-without-response remain distinct. Matching register, CSV and print populations agree across pages. | US-11–US-13 |
| Administer an account and a lookup | Deactivation preserves attribution. Archived values disappear from new selections. A partial account update is surfaced for repair. | US-02, US-14 |

These are acceptance criteria for the receiving team. Historical test evidence and outstanding deployment decisions are recorded in the [release-readiness document](release-readiness-2026-11.md).
