# How Support CRM operates

Business handover · Manual-intake release · 21 November 2026

## From an incoming report to a case

A customer contacts a team outside the CRM. A staff member enters one case per issue. WhatsApp, Google Play and Marketing Team identify where an issue originated. Selecting a source does not retrieve a message from that channel. The CRM is the working register for new cases.

| Reporting source | Who enters it | Whose queue matters |
| --- | --- | --- |
| Call Center, Moderation | The signed-in reporter, or Support acting on behalf of an eligible reporter | The reporting account follows its own case. A colleague sharing the role has a separate queue. |
| B2B Schools | Its portal reporter or Support on behalf of the source | The school name connects the issue to the B2B school. Standard customer and platform questions still apply. |
| 30 June Schools | Its portal reporter or Support on behalf of the source | The school is the customer. Record issue type, MySchool update answer, affected group, platform and description. Supply the city when the school selection cannot fill it. |
| WhatsApp, Google Play, Marketing Team | Technical Support enters the issue manually and selects an eligible owner | The selected reporting owner follows the case. Consult the configured source owners when selecting the account. |

**Recorded by** identifies who entered the report. **Reporting owner** identifies whose case it is for portal access and follow-up. **Assigned Support agent** identifies who is working it. **Contact channel** describes how contact took place. For example, if Support enters a Call Center report received by phone, the source remains Call Center and the creator remains the Support employee.

## Decisions during follow-up

| Situation | Staff action | Lasting record |
| --- | --- | --- |
| New issue needs investigation | Create a case, review evidence and begin work | Stable case number, original intake, reporting owner and creation time |
| Support needs more information | Send a shared question and choose Awaiting Customer Reply when appropriate | The reporter sees the question. Status changes are explicit. |
| Support needs to discuss the investigation internally | Add an internal note | Support and the Manager can review it. It stays outside the reporter conversation. |
| A solution has been provided | Enter request type, topic, cause, action, outcome and the response, then resolve | A completed resolution cycle and the response shared with the owner |
| Customer follow-up ends without a response | Choose Closed - No Response | A finished case counted separately from a resolution |
| The same problem returns | Reopen the case with a reason | Original number, previous resolution, new activity and an increased reopen count |
| The customer reports a different problem | Create a linked new case | Separate case number and outcome, with a link to the original |

## How management should read the figures

| Measure | Business interpretation |
| --- | --- |
| Total / open / finished | Count distinct case numbers in the selected population. Open includes New, In Progress and Awaiting Customer Reply. Finished comprises resolved and closed without response. |
| Currently resolved | Count cases whose present status is Resolved & closed. Reopening a case takes it out of this group. |
| Resolution events | Count recorded resolution events in the selected event period. One case can contribute more than once. Historical cases can lack event history. |
| Reopened cases / reopen events | The first counts distinct cases with a recurrence. The second counts occurrences. A case reopened twice contributes one case and two events. |
| Fawry | A recorded intake answer. Standard intake supports Yes, No and Unknown. June intake automatically stores No. The value cannot establish revenue or settlement. |
| Geography | A marker represents an aggregate at a reference location. Unknown locations and recorded places without a reference cannot be interpreted as mapped customer addresses. |
| Missing classification or ownership | Leave missing facts visible. Assigning an inferred cause or substituting the creator for the missing owner would change the business meaning. |

## Worked example

A June school reports missing classes. The reporter selects the school, records the affected group and platform, selects the issue type, answers the MySchool question and describes the missing classes. Support investigates and requests a screenshot in the shared conversation. A separate internal note records the investigation. After correcting the classes, Support records the five classifications and its response, then resolves the case. If the same classes disappear again, Support reopens that number with a reason. A later login issue receives a linked new number. Management can now distinguish two customer issues from multiple attempts to resolve the first.

## Release boundaries

Current intake is manual. In-app routing uses the reporting owner and the assigned or fallback Support recipient. Earlier release notes describe an older central-only route. Outbound email, connected messaging, historical cleanup and acceptance of a company-hosted deployment are separate delivery decisions. The [readiness record](release-readiness-2026-11.md) and [transfer runbook](company-transfer-runbook.md) describe operational evidence and outstanding work.
