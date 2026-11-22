import { cairoDate } from "@/lib/tickets/dashboard-model";
import type { BusinessEvent, BusinessTicket, Snapshot } from "@/lib/tickets/business-analytics";
import type { TicketSource, TicketStatus } from "@/lib/tickets/constants";

// Synthetic cases shaped like a small live register: uneven sources, sparse
// classification, mostly unassigned work and few recorded locations.
export const REALISTIC_CITIES = [
  { id: "1", name: "Cairo" },
  { id: "3", name: "Alexandria" },
  { id: "7", name: "Asyut" },
  { id: "9", name: "Damietta" },
  { id: "12", name: "Qalyubia" },
  { id: "28", name: "Not recorded" },
  { id: "29", name: "Kuwait" },
];

const SOURCES: [TicketSource, number][] = [["call_center", 30], ["whatsapp", 12], ["moderation", 8], ["june_schools", 7], ["marketing_team", 4], ["business_development", 3], ["google_play", 2]];
const REPORTERS: Record<TicketSource, string> = { call_center: "Call Center desk", whatsapp: "", moderation: "Moderation desk", june_schools: "Schools coordinator", marketing_team: "Marketing desk", business_development: "B2B coordinator", google_play: "" };
const TYPES = ["Inquiry", "Technical Issue", "Complaint", "Inquiry", "Technical Issue", "Subscription Request"];
const TOPICS = ["Subscription Payment", "Content Availability", "Login / Verification", "Subscription Payment", "Video Playback", "Content Availability", "App Performance", "Account Data"];
const CAUSES = ["Content Delay", "Payment Sync", "Content Delay", "User Error", "App Bug", "Content Delay", "Device Compatibility", "Payment Sync"];
const ACTIONS = ["Answer Inquiry", "Escalate to Technical Team", "Activate Subscription", "Answer Inquiry", "Publish Content", "Guide User"];
const OUTCOMES = ["Information Provided", "Fixed by Technical Team", "Subscription Activated", "Information Provided", "Fixed by Technical Team", "Information Provided"];
const SUBJECTS = ["العميل دفع الاشتراك والمحتوى لسه مقفول", "Lesson video stops after a few seconds", "كود التفعيل لا يعمل على التطبيق", "Cannot sign in after changing the phone", "الدرس غير متاح للصف الثالث الإعدادي", "Payment confirmed but subscription inactive"];
const CITY_IDS = ["1", "1", "3", "1", "7", "1", "9", "3", "12", "1", "29", "1"];

export function realisticSnapshot(asOf: string): Snapshot & { cities: typeof REALISTIC_CITIES } {
  const now = Date.parse(asOf);
  const hour = 3600000;
  const day = 24 * hour;
  let index = 0;
  const tickets: BusinessTicket[] = SOURCES.flatMap(([source, count]) =>
    Array.from({ length: count }, (_, n): BusinessTicket => {
      const i = index++;
      const age = (i * 37) % 9 < 5 ? (i * 7) % 24 : 24 + ((i * 11) % 60);
      const createdAt = new Date(now - age * day - ((i * 5) % 9) * hour).toISOString();
      const open: TicketStatus[] = ["new", "in_progress", "awaiting_customer"];
      const status: TicketStatus = i % 13 === 4 ? "closed" : age < 9 && i % 2 === 0 ? open[i % 3] : i % 17 === 9 ? "in_progress" : "resolved";
      const historical = age > 30 && i % 3 !== 0;
      const classified = source === "call_center" ? n % 5 === 0 : i % 6 !== 5;
      const caused = classified && i % 4 !== 3;
      const reopenCount = i % 19 === 6 ? 1 : i % 31 === 12 ? 2 : 0;
      const firstResolution = new Date(Date.parse(createdAt) + (4 + (i % 30)) * hour).toISOString();
      const reopenedAt = new Date(Date.parse(firstResolution) + 2 * day).toISOString();
      const finalAt = new Date(Math.min(now - hour, Date.parse(reopenedAt) + 5 * hour)).toISOString();
      const resolvedAt = status === "resolved" ? (reopenCount ? finalAt : firstResolution) : null;
      const events: BusinessEvent[] = historical
        ? []
        : [
            { id: `${i}-created`, kind: "created", created_at: createdAt, to_status: "new", actorRole: "call_center" },
            ...(status !== "new" ? [{ id: `${i}-reply`, kind: "comment", created_at: new Date(Date.parse(createdAt) + hour).toISOString(), actorRole: "support_agent" }] : []),
            ...(status === "resolved" || reopenCount ? [{ id: `${i}-resolved`, kind: "resolved", created_at: firstResolution, to_status: "resolved", actorRole: "support_agent" }] : []),
            ...(reopenCount ? [{ id: `${i}-reopened`, kind: "reopened", created_at: reopenedAt, to_status: "in_progress", actorRole: "call_center" }] : []),
            ...(reopenCount && status === "resolved" ? [{ id: `${i}-again`, kind: "resolved", created_at: finalAt, to_status: "resolved", actorRole: "support_agent" }] : []),
          ];
      if (!historical && events.filter((e) => e.to_status).at(-1)?.to_status !== status) {
        events.push({ id: `${i}-state`, kind: "status_changed", created_at: new Date(Date.parse(events.at(-1)!.created_at) + hour).toISOString(), to_status: status, actorRole: "support_agent" });
      }
      const located = i % 5 === 0;
      const assigned = i % 9 === 2;
      return {
        id: `realistic-${i}`,
        number: `TKT-DEMO-${String(i + 1).padStart(4, "0")}`,
        subject: SUBJECTS[i % SUBJECTS.length],
        source,
        status,
        createdAt,
        createdOn: cairoDate(createdAt),
        reportedOn: cairoDate(createdAt),
        updatedOn: cairoDate(events.at(-1)?.created_at || createdAt),
        updatedAt: events.at(-1)?.created_at || createdAt,
        resolvedAt,
        categoryId: "1",
        category: "App",
        cause: "",
        cityId: located ? CITY_IDS[(i / 5) % CITY_IDS.length] : i % 2 ? "28" : "",
        endUserType: i % 3 ? "student" : "parent",
        requestType: classified ? TYPES[i % TYPES.length] : "",
        topic: classified || i % 4 === 1 ? TOPICS[i % TOPICS.length] : "",
        trackerCause: caused ? CAUSES[i % CAUSES.length] : "",
        trackerAction: classified && status === "resolved" ? ACTIONS[i % ACTIONS.length] : "",
        outcome: status !== "resolved" || !classified ? "" : i % 23 === 8 ? "Issue Persists" : OUTCOMES[i % OUTCOMES.length],
        fawry: i % 5 === 0 ? "" : i % 2 ? "yes" : "no",
        reopenCount,
        lastReopenedAt: reopenCount ? reopenedAt : "",
        workflowEvents: events,
        isHistorical: historical,
        reporterId: REPORTERS[source] ? `reporter-${source}` : "",
        reporter: REPORTERS[source],
        creatorId: "recorder",
        creator: "Demo recorder",
        assigneeId: assigned ? "support-a" : "",
        assignee: assigned ? "Demo Support" : "",
        customerName: `Customer ${i + 1}`,
        schoolName: source === "june_schools" || source === "business_development" ? "Demo School" : "",
        appVersion: i % 3 ? "4.3" : "",
        latestVersion: i % 4 === 0 ? null : i % 2 === 0,
      };
    }),
  );
  return { tickets, asOf, cities: REALISTIC_CITIES };
}
