// Source for docs/brd.pdf. Wording matches docs/brd.md.
#let ink = rgb("#1b2430")
#let muted = rgb("#3e4854")
#let brass = rgb("#8d7044")
#let cream = rgb("#f6f3ec")
#let hairline = rgb("#e3dcd0")
#let paper = rgb("#fbfaf7")

#set document(
  title: "Support CRM — Business Requirements",
  author: "Support CRM",
  description: "Final business requirements for the manual-intake release. 17 November 2026.",
  date: datetime(year: 2026, month: 11, day: 17),
)

#set text(font: "Liberation Serif", size: 10.5pt, fill: ink, lang: "en", region: "US", hyphenate: false)
#set par(justify: false, leading: 0.62em, spacing: 0.62em)
#set list(spacing: 0.38em, indent: 12pt, marker: text(fill: brass, size: 8pt)[■])
#set enum(spacing: 0.42em, indent: 14pt, body-indent: 8pt)

#show heading.where(level: 1): it => {
  set text(font: "Inter", size: 16pt, weight: "semibold", fill: ink, hyphenate: false)
  set par(justify: false)
  block(breakable: false, above: 12pt, below: 7pt)[
    #it
    #v(3pt)
    #line(length: 100%, stroke: 0.7pt + brass)
  ]
}

#show heading.where(level: 2): it => {
  set text(font: "Inter", size: 12pt, weight: "semibold", fill: ink, hyphenate: false)
  set par(justify: false)
  block(breakable: false, above: 10pt, below: 5pt, it)
}

#let label-text(body) = text(font: "Inter", size: 8pt, fill: muted, weight: "medium", tracking: 0.4pt, body)
#let kicker(body) = text(font: "Inter", size: 8.5pt, fill: brass, weight: "semibold", tracking: 1.6pt, body)

#let kv-table(rows) = {
  set par(justify: false)
  table(
    columns: (42mm, 1fr),
    stroke: none,
    inset: (x: 0pt, y: 5.5pt),
    ..rows
      .map(((k, v)) => (
        table.cell(stroke: (bottom: 0.4pt + hairline))[#label-text[#k]],
        table.cell(stroke: (bottom: 0.4pt + hairline))[#text(size: 10.5pt)[#v]],
      ))
      .flatten(),
  )
}

#let band-table(columns: none, headers: (), rows: ()) = {
  set par(justify: false)
  set text(size: 9.2pt)
  show table.cell: it => {
    set text(hyphenate: false)
    it
  }
  table(
    columns: columns,
    stroke: (x, y) => (
      bottom: 0.45pt + if y == 0 { ink } else { hairline },
    ),
    fill: (x, y) => if y == 0 { ink } else if calc.odd(y) { cream } else { white },
    inset: (x: 7pt, y: 4.6pt),
    align: (x, y) => if y == 0 { left + horizon } else { left + top },
    table.header(..headers.map(h => text(
      font: "Inter",
      size: 8pt,
      weight: "semibold",
      fill: white,
      h,
    ))),
    ..rows.flatten(),
  )
}

#let aside(title, body) = block(
  width: 100%,
  fill: cream,
  stroke: (left: 2.4pt + brass),
  inset: (left: 12pt, right: 12pt, y: 9pt),
  breakable: true,
)[
  #set par(justify: false)
  #text(font: "Inter", size: 8.5pt, weight: "semibold", fill: brass)[#title]
  #v(3pt)
  #body
]

// Cover
#page(
  margin: (left: 22mm, right: 18mm, top: 18mm, bottom: 16mm),
  header: none,
  footer: none,
  background: place(top + left, rect(width: 7.5mm, height: 297mm, fill: ink)),
)[
  #set par(justify: false)
  #v(6mm)
  #kicker[SUPPORT CRM]

  #v(16mm)
  #set par(leading: 0.86em)
  #text(font: "Inter", size: 38pt, weight: "semibold", fill: ink, tracking: -0.6pt)[
    Business \
    Requirements
  ]

  #v(7mm)
  #line(length: 34mm, stroke: 1.6pt + brass)

  #v(8mm)
  #text(size: 13pt)[The manual-intake release of the customer-support register.]

  #v(4mm)
  #text(size: 10.5pt, fill: muted)[
    This document describes the system as built and accepted for the current scope. Behavior that is not stated here is not a requirement of this release.
  ]

  #v(12mm)
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 10pt,
    block(inset: (top: 8pt), stroke: (top: 0.8pt + brass))[
      #text(font: "Inter", size: 18pt, weight: "semibold")[6]
      #v(1pt)
      #label-text[Roles with an account]
    ],
    block(inset: (top: 8pt), stroke: (top: 0.8pt + brass))[
      #text(font: "Inter", size: 18pt, weight: "semibold")[7]
      #v(1pt)
      #label-text[Case sources]
    ],
    block(inset: (top: 8pt), stroke: (top: 0.8pt + brass))[
      #text(font: "Inter", size: 18pt, weight: "semibold")[1]
      #v(1pt)
      #label-text[Register: this system]
    ],
  )

  #v(1fr)

  #grid(
    columns: (1fr, 1fr),
    gutter: 16pt,
    [
      #label-text[PREPARED FOR]
      #v(4pt)
      #text(size: 11pt)[Digital Director, Support, and the Software Team]
    ],
    [
      #label-text[DOCUMENT]
      #v(4pt)
      #text(size: 11pt)[Version 1.0]
      #linebreak()
      #text(size: 10.5pt, fill: muted)[Final for the manual-intake release]
      #linebreak()
      #text(size: 10.5pt)[17 November 2026 · Africa/Cairo]
    ],
  )

  #v(8mm)
  #line(length: 100%, stroke: 0.4pt + hairline)
  #v(4mm)
  #text(size: 9.5pt, fill: muted)[
    Supersedes the September 2026 draft on connected WhatsApp and the external tracker file.
  ]
]

#set page(
  paper: "a4",
  margin: (top: 20mm, bottom: 18mm, left: 18mm, right: 18mm),
  header: context {
    set text(font: "Inter", size: 8pt, fill: muted, hyphenate: false)
    set par(justify: false)
    grid(
      columns: (1fr, auto),
      align: (left, right),
      [Business Requirements],
      [Support CRM],
    )
    v(5pt)
    line(length: 100%, stroke: 0.45pt + hairline)
  },
  footer: context {
    set text(font: "Inter", size: 8pt, fill: muted, hyphenate: false)
    set par(justify: false)
    line(length: 100%, stroke: 0.45pt + hairline)
    v(6pt)
    grid(
      columns: (1fr, auto),
      align: (left, right),
      [Version 1.0 · 17 November 2026 · Africa/Cairo],
      [#counter(page).display()],
    )
  },
)
#counter(page).update(1)
#set heading(numbering: "1.1")

#outline(
  title: [Contents],
  depth: 2,
  indent: 1.1em,
)

#v(4pt)
#text(font: "Inter", size: 13pt, weight: "semibold")[Document control]
#v(2pt)
#kv-table((
  ([Document], [Final business requirements]),
  ([Product], [Support CRM]),
  ([Version], [1.0]),
  ([Status], [Final for the manual-intake release]),
  ([Date], [17 November 2026]),
  ([Time zone], [Africa/Cairo]),
  ([Audience], [Digital Director, Support, and the Software Team]),
  ([Supersedes], [The September 2026 draft on connected WhatsApp and the external tracker file]),
))

= Purpose

Collect customer issues for the learning platform in one register, from the moment an issue arrives until it is resolved or closed, with a clear record of who opened it, who follows it, what was done, and when.

From the date of this document, the system is the only register of cases. The old tracker file, whether Excel or Google Sheets, is no longer a place to record cases and is not a source to import from. No connection to it, and no import of new rows from it, is required.

= Problem

Issues arrived from several teams and were written down outside the system. That split the reporting owner from Support's response, made the customer's current state hard to see, and left reporting dependent on a file that could be edited or copied.

The system keeps each issue as one case with a number, a source, a reporting owner, a classification, a response, and a history. Access rules keep each team to the cases it is allowed to see.

#block(breakable: false)[
= Scope of this release

#text(font: "Inter", size: 9.5pt, weight: "semibold")[In scope]

- Manual registration by a team that has an account, or by Technical Support on behalf of a source that has no account.
- Follow-up until the case is resolved or closed without a response.
- Reopening the same problem with a reason, or opening a linked new case for a different problem.
- Internal notes kept apart from the reply the reporting owner can see.
- In-app notifications.
- A reporting dashboard for the Manager and Technical Support, with export.
- User administration and lookup lists for the account that has administration rights.
]

#v(2pt)
#aside(
  [Outside this release, and to be decided separately],
  [
    #set list(spacing: 0.42em)
    - Outbound email. In-app notification works. Delivery to a mailbox is deferred. The current destination is a temporary Gmail mailbox, and the last connection test rejected the sign-in details.
    - Correction of older cases that are missing classification. They stay visible as recorded and are not rewritten in this release.
    - A connected WhatsApp inbox, intake from B2B email, and any automation from an external file.
    - Company hosting, a backup-restore rehearsal, and a load test. Those are the next preparation step after this document, not acceptance criteria of this release.
  ],
)

= Users and access

Sign-in is by email and password. There is no self-service password reset. The administrator creates the user, sets the role, resets the password, unlocks the account, and deactivates it. Deactivation removes the person from work and keeps their history.

#v(2pt)
#band-table(
  columns: (34mm, 1.15fr, 0.95fr),
  headers: ([Role], [Can], [Cannot]),
  rows: (
    (
      [Technical Support],
      [See every case, create a case for a source with no account, change status, classification, and the response, write internal notes, and use the dashboard],
      [—],
    ),
    (
      [Technical Support with administration],
      [Everything Technical Support can do, plus users and settings],
      [Grant the administration flag from the screen. It is set once in the database],
    ),
    (
      [Moderation],
      [Create its own cases and see only those cases],
      [See other teams' cases, or edit a case after it is submitted],
    ),
    (
      [Call Center],
      [The same limits as Moderation, on its own cases],
      [The same restriction],
    ),
    (
      [30 June Schools],
      [The same portal, with the school fields required],
      [Save a case without the school name, the issue type, or the MySchool answer],
    ),
    (
      [B2B Schools],
      [The same portal, with the school name required],
      [Save a case without a school name],
    ),
    (
      [Manager],
      [Read every case and all of its data, including the customer account identifier, and use the dashboard and export],
      [Change the status or any submitted case data],
    ),
  ),
)

After sign-in, Technical Support opens the case register, the Manager opens the dashboard, and portal teams open their own case list.

The source of a portal case comes from the signed-in role. Technical Support chooses the source when recording on behalf of a team. Approved reporting owners for the sources that have accounts: Call Center is Kabany, Moderation is Sonia, B2B is Olaa, and 30 June is Yasser. WhatsApp and Google Play are opened by Ahmed in Technical Support. Any source without a portal account is opened by Technical Support, who selects the source.

= Case journey

+ The issue arrives from one source: WhatsApp, Moderation, Call Center, Marketing Team, 30 June Schools, B2B Schools, or Google Play.
+ The matching account, or Technical Support on its behalf, records the case. The system assigns a number and stores who created it and who the reporting owner is. The reporting owner does not change later.
+ Intake details lock after save. Later correction is a note, a reply, or a linked new case, not an edit of the original intake.
+ Technical Support classifies the case while it is being worked: request type, topic, cause, action, and outcome.
+ Open statuses are New, In Progress, and Awaiting Customer Reply.
+ Resolved & closed is accepted only with a clear response of at least five characters and with all five classification fields.
+ Closed - No Response does not require the five fields. It means the customer was not followed through to a response. It is not a resolution.
+ Reopening the same problem requires a reason, increases the reopen count once, and keeps a snapshot of the earlier resolution.
+ A different problem is a new case linked to the original. It does not overwrite it.
+ A comment visible to the reporting owner does not change status by itself. An internal note is hidden from reporting teams.

Nothing in the case history is deleted. A user or a lookup value is deactivated instead of removed.

= Case data

Required on every new case: reported date, city, customer type, platform, and issue description. School name is required for both school sources. Fawry payment is recorded as yes or no on new cases. It is a flag on the case, not proof of collection.

Additional 30 June fields, required on the form and in the database:

- School name.
- Issue type: no active subscription, cannot log in or the account is not activated, classes missing or duplicated, grade not promoted, subject or questions missing, or other.
- Whether a MySchool update was already requested: yes, no, or not sure.

School code and affected user IDs may be recorded. These facts lock with the rest of the intake. A status change does not clear them. A direct write, not only the form, rejects a 30 June case when any of the three required facts is missing.

The customer account identifier, the email or mobile number used to sign in to the platform, is visible to Technical Support, to the case owner, and to the Manager. The Manager can see it and cannot edit it. Other portal teams cannot browse cases that are not theirs.

Attachments are optional: up to five files on a submission or a message. Images, short video, audio, PDF, and Excel are allowed. Video is up to 50 MB. Other allowed types are up to 10 MB. Files are private and are not public links.

#block(breakable: false)[
= Functional requirements

== Sign-in and accounts

#band-table(
  columns: (18mm, 1fr),
  headers: ([ID], [Requirement]),
  rows: (
    ([BR-01], [Only an active account with the correct password can sign in.]),
    ([BR-02], [Failed attempts are recorded, and the account locks for a period after repeated failures.]),
    ([BR-03], [The Manager does not administer users. Administration belongs to the Technical Support account that has the administration flag.]),
    ([BR-04], [Deactivating a user blocks sign-in and keeps that person's name on historical cases.]),
  ),
)
]

#block(breakable: false)[
== Registration and follow-up

#band-table(
  columns: (18mm, 1fr),
  headers: ([ID], [Requirement]),
  rows: (
    ([BR-05], [Every case has a visible number, a source, a status, and created and updated times.]),
    ([BR-06], [A portal team sees only its own cases and opens a new case from its form.]),
    ([BR-07], [Technical Support sees every case and can create one for a source that has no account.]),
    ([BR-08], [The Manager sees every case for reading and export. Editing the case is closed.]),
    ([BR-09], [After save, the issue description, customer details, school details, and account identifier are not rewritten.]),
    ([BR-10], [Resolution requires the response and the five classification fields. Closure without a response does not.]),
    ([BR-11], [Reopening requires a reason, and the previous resolution snapshot is kept.]),
    ([BR-12], [A new problem is linked to an existing case and does not replace it.]),
    ([BR-13], [Internal notes are for Technical Support and the Manager. The reporting owner does not see them.]),
    ([BR-14], [A reply visible to the reporting owner is stored as activity and does not change status by itself.]),
  ),
)
]

== Notification

#band-table(
  columns: (18mm, 1fr),
  headers: ([ID], [Requirement]),
  rows: (
    ([BR-15], [An in-app notice goes to the reporting owner when Support updates the case, and to Support when a case is new, the reporting owner replies, or the case is reopened. The person who performed the action is not notified of their own action.]),
    ([BR-16], [Email is not an acceptance condition of this release. Notification is not treated as delivered to a mailbox until sending is tested and accepted in a later decision.]),
  ),
)

== Reporting

#band-table(
  columns: (18mm, 1fr),
  headers: ([ID], [Requirement]),
  rows: (
    ([BR-17], [The dashboard is for Technical Support and the Manager. Portal teams do not have the general dashboard.]),
    ([BR-18], [The default period is all cases. It can be narrowed by period, source, or another dimension, and filters intersect.]),
    ([BR-19], [Figures keep the total, what is still open, what was resolved, what was closed without a response, and what was reopened apart. Closed without a response is not counted as resolved.]),
    ([BR-20], [A missing value stays visible and is not inferred. The Fawry flag is not revenue and is not payment settlement.]),
    ([BR-21], [Export uses the same selected population. The CSV contains no sign-in secrets, no internal notes, and no file links.]),
    ([BR-22], [Choosing part of a chart narrows the period or the dimension and does not change how a case is counted.]),
  ),
)

== Settings

#band-table(
  columns: (18mm, 1fr),
  headers: ([ID], [Requirement]),
  rows: (
    ([BR-23], [Request type, topic, cause, action, outcome, and city lists can be extended in settings. They start from the current season's values.]),
    ([BR-24], [Deactivating a lookup value hides it from new cases and leaves it on older cases.]),
  ),
)

#block(breakable: false)[
= Rules with no exception

- The system, not the sheet, is where a new case is recorded.
- Cases, attachments, and activity history are not deleted.
- There is no resolution without a clear response and the five classification fields.
- There is no 30 June case without a school name, an issue type, and a MySchool answer, on any write path.
- The original intake is not edited after it is submitted.
- The Manager reads every case field and does not write it.
- A portal team sees only the cases it opened.
- Older cases with missing classification stay as recorded until a later decision rewrites them.
]

#block(breakable: false)[
= Acceptance

This release is accepted when the following can be done with accounts for all six roles:

+ Each role signs in and reaches only its own screens.
+ Moderation, Call Center, B2B, and 30 June each create a case, see that case, and do not see another team's case.
+ A 30 June case is rejected without the school name, without the issue type, or without the MySchool answer, from the form and from a direct write.
+ A B2B case is rejected without a school name and is accepted without the two 30 June answers.
+ Technical Support resolves one case after the response and classification, closes another without a response, reopens the first with a reason, and opens a linked case for a different problem.
+ The Manager sees the account identifier and the rest of the case, finds no edit control, and is not sent back from the report to a narrower session.
+ The dashboard keeps resolved apart from closed without a response, and export matches that selection.
+ Deactivating a user blocks sign-in and leaves the name on existing cases.

#aside(
  [Not part of accepting this document],
  [An email test, correction of the older cases missing classification, a WhatsApp or B2B email connection, and the hosting, backup, and load rehearsal are not part of accepting this document.],
)
]

= What changed from the old draft

The September draft assumed a connected WhatsApp inbox and an external file as the source of classification. This release fixes two decisions:

- New cases are recorded in the system. There is no pull from the sheet, from WhatsApp, or from B2B email.
- WhatsApp, Google Play, and Marketing are sources chosen when a case is created. They are not automatic channels.

= Terms

#band-table(
  columns: (40mm, 1fr),
  headers: ([Term], [Meaning]),
  rows: (
    ([Case], [One customer issue, with its number and history]),
    ([Source], [The team or channel the issue came from]),
    ([Reporting owner], [The account responsible for that source]),
    ([Account identifier], [The email or mobile number the customer uses on the platform]),
    ([Resolved & closed], [Support finished the problem and wrote the response]),
    ([Closed - No Response], [Closed because the customer was not followed through. It is not a resolution]),
    ([Internal note], [A note between Support and the Manager. Hidden from the reporting team]),
    ([MySchool], [The 30 June question: was a school-data update already requested]),
  ),
)
