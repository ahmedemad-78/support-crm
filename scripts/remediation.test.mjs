import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = join(root, ".remediation-test");
const files = [
  "src/lib/http/session-boundary.ts",
  "src/lib/email/messages.ts",
  "src/lib/email/outbox.ts",
  "src/lib/tickets/constants.ts",
  "src/lib/tickets/dashboard-model.ts",
  "src/lib/tickets/analytics.ts",
  "src/lib/tickets/overview.ts",
  "src/lib/tickets/filters.ts",
  "src/lib/tickets/schema.ts",
];

for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  const output = join(directory, file.replace(/^src\//, "").replace(/\.ts$/, ".js"));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
      },
    }).outputText,
  );
}

const require = createRequire(join(root, "package.json"));
const boundary = require(join(directory, "lib/http/session-boundary.js"));
const outbox = require(join(directory, "lib/email/outbox.js"));
const analytics = require(join(directory, "lib/tickets/analytics.js"));
const overview = require(join(directory, "lib/tickets/overview.js"));
const filters = require(join(directory, "lib/tickets/filters.js"));
const schema = require(join(directory, "lib/tickets/schema.js"));

after(() => rmSync(directory, { recursive: true, force: true }));

const ticket = (overrides = {}) => ({
  id: "1",
  number: "T1",
  subject: "A case",
  status: "new",
  source: "whatsapp",
  createdAt: "2026-09-01T00:00:00Z",
  createdOn: "2026-09-01",
  reportedOn: "2026-09-01",
  resolvedAt: null,
  cityId: "",
  categoryId: "",
  category: "",
  cause: "",
  platform: "",
  assigneeId: "",
  assignee: "",
  requestType: "",
  topic: "",
  trackerCause: "",
  trackerAction: "",
  outcome: "",
  fawry: "",
  customerName: "Ada",
  customerEmail: "ada@example.com",
  customerPhone: "",
  schoolName: "",
  updatedOn: "2026-09-01",
  ...overrides,
});

test("the email dispatch path is the only session exemption", () => {
  assert.equal(boundary.skipsBrowserSession("/api/email/dispatch"), true);
  assert.equal(boundary.skipsBrowserSession("/api/email/dispatch/"), false);
  assert.equal(boundary.skipsBrowserSession("/api/email/dispatch/extra"), false);
  assert.equal(boundary.skipsBrowserSession("/api"), false);
  assert.equal(boundary.skipsBrowserSession("/dashboard"), false);
});

test("impossible calendar dates are rejected and real dates pass", () => {
  assert.equal(analytics.validDay("2026-02-31"), false);
  assert.equal(analytics.validDay("2026-04-31"), false);
  assert.equal(analytics.validDay("2025-02-29"), false);
  assert.equal(analytics.validDay("2024-02-29"), true);
  assert.equal(analytics.validDay("2026-02-28"), true);
  const parsed = schema.portalTicketSchema.safeParse(intake({ issue_date: "2026-02-31" }));
  assert.equal(parsed.success, false);
});

test("a supplied phone is kept and a blank phone stays empty", () => {
  const kept = schema.portalTicketSchema.parse(intake({ customer_phone: "+20 100 123 4567" }));
  assert.equal(kept.customer_phone, "+20 100 123 4567");
  const blank = schema.portalTicketSchema.parse(intake({ customer_phone: "   " }));
  assert.equal(blank.customer_phone, null);
  const missing = schema.portalTicketSchema.safeParse(intake({ customer_phone: "12" }));
  assert.equal(missing.success, false);
});

test("follow-up navigation keeps the reported-date population", () => {
  const rows = [
    ticket({ id: "open-old", number: "A", status: "new", reportedOn: "2026-09-01" }),
    ticket({ id: "open-new", number: "B", status: "in_progress", reportedOn: "2026-09-20" }),
    ticket({ id: "resolved", number: "C", status: "resolved", reportedOn: "2026-09-10" }),
    ticket({ id: "outside", number: "D", status: "new", reportedOn: "2026-08-01" }),
  ];
  const selection = {
    from: "2026-09-01",
    to: "2026-09-30",
    source: "",
    status: "",
    city: "",
    category: "",
    userType: "",
  };
  const population = overview.dashboardPopulation(rows, selection, "2026-10-08");
  const followup = population.filter((row) => overview.statusGroup(row.status) === "followup");
  assert.deepEqual(followup.map((row) => row.number), ["A", "B"]);
  const href = filtersMod(selection);
  assert.match(href, /scope=followup/);
  assert.match(href, /from=2026-09-01/);
  assert.match(href, /to=2026-09-30/);
  assert.equal(href.startsWith("/tickets?"), true);
  assert.equal(filters.dashboardListHref({ ...selection, view: "created" }, "followup").includes("view="), false);
});

test("legacy csv neutralizes formulas and uses the same population", () => {
  const rows = [ticket({ number: "=CMD", subject: "hello", customerName: "Ada" })];
  const csv = overview.casesCsv(rows);
  assert.equal(csv.startsWith("\ufeff"), true);
  assert.match(csv, /"'=CMD"/);
  assert.doesNotMatch(csv, /(^|,)=CMD/);
});

test("return targets stay inside the app", () => {
  assert.equal(filters.safeAppReturn("/tickets?scope=followup&from=2026-09-01"), "/tickets?scope=followup&from=2026-09-01");
  assert.equal(filters.safeAppReturn("/dashboard?from=2026-09-01"), "/dashboard?from=2026-09-01");
  assert.equal(filters.safeAppReturn("//evil.example"), null);
  assert.equal(filters.safeAppReturn("https://evil.example"), null);
  assert.equal(filters.safeAppReturn("/login"), null);
});

test("a claimed row is sent once and a failed acknowledgement is not a success", async () => {
  const row = {
    id: "m1",
    to_address: "ada@example.com",
    subject: "Ticket is now In Progress",
    body_text: "problem",
    ticket_path: "/tickets/m1",
    attempts: 0,
    last_error: null,
    created_at: "2026-11-09T12:00:00.000Z",
  };
  let sends = 0;
  const claimed = new Set();
  const result = await outbox.deliverOutbox({
    now: new Date("2026-11-09T12:00:00.000Z"),
    rows: [row, { ...row, id: "m2" }],
    configured: true,
    claim: async (job) => {
      if (claimed.has(job.id)) return false;
      claimed.add(job.id);
      return job.id === "m1";
    },
    send: async () => {
      sends += 1;
    },
    acknowledge: async () => false,
    markMissing: async () => {},
    markUnacknowledged: async () => {},
    markFailed: async () => {},
  });
  assert.equal(sends, 1);
  assert.deepEqual(result, { sent: 0, unacknowledged: 1, failed: 0 });
});

test("historical missing-mail rows are not dispatched", async () => {
  let sends = 0;
  const result = await outbox.deliverOutbox({
    now: new Date("2026-11-09T12:00:00.000Z"),
    rows: [{
      id: "old",
      to_address: "ada@example.com",
      subject: "old",
      body_text: "old",
      ticket_path: "/tickets/old",
      attempts: 0,
      last_error: "Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD (Gmail or Outlook) or RESEND_API_KEY",
      created_at: "2026-10-21T00:00:00.000Z",
    }],
    configured: true,
    claim: async () => true,
    send: async () => {
      sends += 1;
    },
    acknowledge: async () => true,
    markMissing: async () => {},
    markUnacknowledged: async () => {},
    markFailed: async () => {},
  });
  assert.equal(sends, 0);
  assert.equal(result.sent, 0);
});

function intake(overrides) {
  return {
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    customer_phone: "",
    school_name: "",
    credentials_username: "ada",
    issue_date: "2026-09-01",
    city_id: "1",
    end_user_type: "student",
    platform: "android",
    is_latest_version: "yes",
    fawry_payment: "no",
    app_version: "",
    device_type: "",
    page_screen: "",
    steps: "",
    issue_description: "The lesson will not open",
    ...overrides,
  };
}

function filtersMod(value) {
  return filters.dashboardListHref(value, "followup");
}

test("queue defaults retain historical open cases and explicit recent dates round-trip", () => {
  assert.equal(filters.parseTicketListFilters({}).range, "all");
  const parsed = filters.parseTicketListFilters({ view: "open", range: "30", sort: "updated", page: "2" });
  assert.equal(parsed.view, "open"); assert.equal(parsed.range, "30"); assert.equal(parsed.sort, "updated");
  const query = new URLSearchParams(filters.ticketListQuery(parsed, { scope: "dashboard", from: "2026-09-01", topic: "Login" }));
  assert.equal(query.get("range"), "30"); assert.equal(query.get("sort"), "updated"); assert.equal(query.get("page"), "2");
  assert.equal(query.get("scope"), "dashboard"); assert.equal(query.get("topic"), "Login");
  assert.equal(filters.parseTicketListFilters({ sort: "DROP", view: "invalid", page: "-5" }).sort, "newest");
});
