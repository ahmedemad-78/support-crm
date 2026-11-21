# Support CRM user stories and acceptance criteria

Manual-intake release · 21 November 2026 · Companion to the [BRD](brd.md)

Each story names the person doing the work, the reason for it and an observable acceptance check. BR numbers refer to section 7 of the BRD. Use synthetic accounts and cases to exercise the scenarios. These are acceptance criteria, not a record of a new test run.

## Access and accountability

### US-01 · Enter the right workspace
As an active employee, I want to land where I work so I can act within my role. **BR-01, BR-02, BR-03, BR-17**
- With valid credentials, Support reaches the register, a Manager reaches the dashboard and each portal reporter reaches their own list.
- Try a direct dashboard or admin URL with a portal account. Access is denied. Repeated failed sign-ins trigger the lock policy. An administrator can unlock the account.

### US-02 · Maintain team access
As the Support administrator, I need to create staff accounts, set roles, reset passwords and deactivate departed staff while preserving attribution. **BR-01, BR-03, BR-04**
- Deactivate a synthetic reporter after they create a case. A fresh sign-in is blocked and the case still identifies the original reporter. A Manager cannot administer the account.

## Intake and ownership

### US-03 · Report an issue from a portal
As a reporting employee, I want one reference for the issue so I can follow the response. **BR-05, BR-06, BR-09**
- Submit a valid form. A numbered case appears in my list with my role’s source, my reporting identity, its status and timestamps.
- A second account with the same role cannot open the case by number or by direct link. Intake facts stay locked after submission.

### US-04 · Record a manually received issue
As Technical Support, I want to enter a report on behalf of its source so that the right person can follow it. **BR-05, BR-07, BR-09**
- Select a source and an eligible reporting owner. The saved case distinguishes the person entering it from its reporting owner and Support assignee.
- For a portal-bound source the owner comes from that source team. For a source without a portal role, use an eligible Support account. The original reporting owner remains attached when follow-up responsibility changes.

### US-05 · Capture the facts relevant to the source
As a reporter, I want the form to collect what Support needs for my type of case. **BR-05, BR-06, BR-09, BR-20**
- On standard intake, submit a customer name, type, city, platform, valid issue date and description. A future Cairo date is rejected. Web skips the installed-version question. Fawry can be Unknown.
- For B2B, omitting the school name prevents submission. For 30 June, omitting the school name, issue type or MySchool answer prevents creation. Repeat each June check against the database in a test environment.
- For an unlisted June school, enter the school name and supply its city. The school becomes the customer. Affected IDs are optional. The stored Fawry No is a system default.

### US-06 · Share private evidence
As a reporter or agent, I want to attach evidence so the other authorized participant can understand the issue. **BR-06, BR-09, BR-14** and BRD section 6
- Try five supported files, then a sixth. Check the 50 MB per-video limit and 10 MB limit for other supported formats. Unsupported types and over-limit submissions are rejected.
- Open evidence as a permitted participant, then as an unrelated reporter. Only the permitted participant can retrieve it. Retrying a failed conversation submission preserves the draft and avoids duplicate messages.

## Working and finishing a case

### US-07 · Follow a case and keep internal notes
As Support, I want to share progress with the reporter and keep investigation notes private. **BR-07, BR-13, BR-14**
- Post one shared reply and one internal note. The owner sees the reply, Support and the Manager can read the note, and the owner cannot. Posting a reply alone leaves status unchanged.

### US-08 · Close with the correct outcome
As Support, I want resolution and closure without a customer response recorded separately so managers can explain outcomes. **BR-09, BR-10, BR-19**
- Attempt resolution with a short response or any of request type, topic, cause, action or outcome missing. The case stays in its prior state.
- Supply all five and a meaningful response of at least five characters. The case becomes Resolved & closed. On a different case, Closed - No Response can be saved without those five values and counts separately.

### US-09 · Distinguish a recurrence from a new issue
As Support, I want recurring problems to keep their history and different problems to receive their own number. **BR-11, BR-12, BR-19**
- Reopen a finished case with a reason. The same case keeps its number and earlier resolution snapshot. Repeating the same request increments the counter only once. A blank reason cannot reopen it.
- Record a different issue as a linked case. It gets its own number, source context and lifecycle. The original case retains its history.

### US-10 · Know who needs to respond
As a participant, I want in-app notices for relevant updates so follow-up reaches the responsible person. **BR-13, BR-14, BR-15, BR-16**
- A Support reply reaches the active reporting owner. A reporter reply reaches the active assigned agent or configured central fallback. The actor receives no self-notice. Internal notes generate no reporter notice.
- Opening the portal list leaves unread replies untouched. Viewing the conversation acknowledges the loaded replies. A status-only notice does not increase its unread-reply count. Mailbox delivery is deferred.

## Management and administration

### US-11 · Inspect cases without changing them
As a Manager, I need case detail and supporting context to review the team's work. **BR-08, BR-13, BR-17**
- Inspect cases belonging to different reporters, including their customer account identifier and activity. An attempted case edit is denied. The Manager can open the dashboard and export.

### US-12 · Explain the workload
As a Manager, I want to distinguish current workload, completed outcomes and repeat work. **BR-17, BR-18, BR-19, BR-20, BR-22**
- Start with all cases. Select a date period and source, then drill into a chart selection. The register retains the intersection. Missing values remain explicit.
- Resolve a case, reopen it and resolve it again. It contributes one distinct case, one reopened case and two recorded resolution events across both cycles. A case closed without response contributes zero resolutions unless it has a separate earlier resolution event.

### US-13 · Deliver the selected register
As a Manager or Support agent, I want a shareable register that represents the entire selection. **BR-08, BR-18, BR-21, BR-22**
- Filter a register spanning multiple pages. CSV and the print report include all matching case numbers, each once, even when the visible page changes.
- Check the CSV for exclusion of sign-in secrets, internal notes and private file links. An unrelated portal account cannot use the register-export route.

### US-14 · Keep classification consistent across seasons
As the administrator, I want to maintain lists while preserving the meaning of older cases. **BR-23, BR-24**
- Add a lookup value and use it on a new case. Deactivate it. It remains visible on that case and is unavailable on a subsequent new case.
