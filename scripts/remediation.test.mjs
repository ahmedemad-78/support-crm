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
  "src/lib/tickets/intake.ts",
  "src/lib/tickets/resolution.ts",
  "src/lib/tickets/queue.ts",
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
const intakeHelpers = require(join(directory, "lib/tickets/intake.js"));
const resolution = require(join(directory, "lib/tickets/resolution.js"));
const queue = require(join(directory, "lib/tickets/queue.js"));
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
  assert.equal(new URL(filters.dashboardListHref({ ...selection, view: "created" }, "followup"), "https://example.test").searchParams.get("view"), "all");
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

const fakeFile = (name = "evidence.png", type = "image/png", size = 200) => ({ name, type, size, lastModified: 1 });
test("intake files reject duplicates, unsupported types, size and count overflow", () => {
  const file = fakeFile(); assert.equal(intakeHelpers.checkIntakeFiles([file], [file]).accepted.length, 0);
  assert.equal(intakeHelpers.checkIntakeFiles([], [fakeFile("bad.exe", "application/octet-stream")]).accepted.length, 0);
  assert.equal(intakeHelpers.checkIntakeFiles([], [fakeFile("big.png", "image/png", 11 * 1024 * 1024)]).accepted.length, 0);
  assert.equal(intakeHelpers.checkIntakeFiles([], Array.from({ length: 6 }, (_, index) => fakeFile(index + ".png"))).accepted.length, 5);
});
test("upload retries preserve paths and skip already uploaded objects", async () => {
  let uploads = 0, records = 0; const paths = [];
  const transport = { hasRecord: async () => ({ exists: false, failed: false }), upload: async (path) => { uploads++; paths.push(path); return { ok: true }; }, record: async (path) => { paths.push(path); return ++records > 1; } };
  const failed = await intakeHelpers.uploadIntakeFiles("case", [{ id: "stable", file: fakeFile() }], transport);
  assert.equal(failed.length, 1); assert.equal(failed[0].uploaded, true);
  assert.equal((await intakeHelpers.uploadIntakeFiles("case", failed, transport)).length, 0); assert.equal(uploads, 1); assert.equal(new Set(paths).size, 1);
});
test("confirmed files and duplicate-object acknowledgements are handled safely", async () => {
  let uploads = 0, records = 0; const item = { id: "stable", file: fakeFile() };
  const transport = { hasRecord: async () => ({ exists: true, failed: false }), upload: async () => { uploads++; return { ok: false, alreadyExists: true }; }, record: async () => { records++; return true; } };
  assert.equal((await intakeHelpers.uploadIntakeFiles("case", [item], transport)).length, 0); assert.equal(uploads, 0); assert.equal(records, 0);
  transport.hasRecord = async () => ({ exists: false, failed: false });
  assert.equal((await intakeHelpers.uploadIntakeFiles("case", [item], transport)).length, 0); assert.equal(uploads, 1); assert.equal(records, 1);
});
test("one failed file never removes another successfully saved attachment", async () => {
  const items = [{ id: "a", file: fakeFile("a.png") }, { id: "b", file: fakeFile("b.png") }];
  const failed = await intakeHelpers.uploadIntakeFiles("case", items, { hasRecord: async () => ({ exists: false, failed: false }), upload: async (_path, file) => { if (file.name === "a.png") throw new Error("offline"); return { ok: true }; }, record: async () => true });
  assert.equal(failed.length, 1); assert.equal(failed[0].id, "a");
});


test("optional contacts and genuine unknown answers survive intake validation", () => {
  const result=schema.portalTicketSchema.parse(intake({customer_email:"",customer_phone:"",credentials_username:"",is_latest_version:"unknown",fawry_payment:"unknown"}));
  assert.equal(result.customer_email,null);assert.equal(result.credentials_username,null);assert.equal(result.customer_phone,null);
  assert.equal(result.is_latest_version,null);assert.equal(result.fawry_payment,null);
  assert.equal(schema.portalTicketSchema.safeParse(intake({customer_email:"bad"})).success,false);
  assert.equal(schema.portalTicketSchema.safeParse(intake({is_latest_version:""})).success,false);
});
test("school sources require school on support and portal forms", () => {
  assert.equal(schema.supportTicketSchema.safeParse(intake({source:"june_schools"})).success,false);
  assert.equal(schema.portalTicketSchemaFor("business_development").safeParse(intake({school_name:"Demo school"})).success,true);
  assert.equal(schema.portalTicketSchemaFor("business_development").safeParse(intake({school_name:" "})).success,false);
  assert.equal(schema.portalTicketSchemaFor("call_center").safeParse(intake()).success,true);
});
test("PDF and Excel are bounded attachments, including missing browser MIME", () => {
  for(const [name,mime] of [["case.pdf","application/pdf"],["case.xls","application/vnd.ms-excel"],["case.xlsx",""]]) {
    const f=fakeFile(name,mime);assert.equal(intakeHelpers.checkIntakeFiles([],[f]).accepted.length,1);
    assert.equal(intakeHelpers.checkIntakeFiles([],[{...f,size:10485761}]).accepted.length,0);
  }
  assert.equal(intakeHelpers.checkIntakeFiles([],[fakeFile("bad.html","text/html")]).accepted.length,0);
  assert.equal(intakeHelpers.checkIntakeFiles([],[fakeFile("empty.pdf","application/pdf",0)]).accepted.length,0);
});

test("queue separates open reopened work from resolved history and other assignments",()=>{
  const rows=[{status:"in_progress",reopenCount:2,assigneeId:"me"},{status:"resolved",reopenCount:3,assigneeId:"me"},{status:"closed",reopenCount:1,assigneeId:"me"},{status:"new",reopenCount:0,assigneeId:"other"}];
  assert.deepEqual(rows.filter(row=>queue.inQueueView(row,"reopened","me")),[rows[0]]);
  assert.deepEqual(rows.filter(row=>queue.inQueueView(row,"mine","me")),[rows[0]]);
  assert.equal(rows.filter(row=>queue.inQueueView(row,"all","me")).length,4);
  assert.equal(rows.filter(row=>queue.inQueueView(row,"open","me")).length,2);
});
test("queue defaults and links keep dashboard cohorts and explicit all-case selections",()=>{
  assert.equal(filters.parseTicketListFilters({}).view,"open");
  assert.equal(filters.parseTicketListFilters({scope:"dashboard"}).view,"all");
  for(const view of ["open","all","reopened"]){const input=filters.parseTicketListFilters({view,source:"call_center",sort:"stale",pageSize:"50",page:"2"});const params=Object.fromEntries(new URLSearchParams(filters.ticketListQuery(input,{scope:"dashboard"})));const result=filters.parseTicketListFilters(params);assert.equal(result.view,view);assert.equal(result.pageSize,50);assert.equal(result.source,"call_center");assert.equal(result.sort,"stale");assert.equal(result.page,2);}
  assert.equal(filters.parseTicketListFilters({pageSize:"99999"}).pageSize,25);
});
test("resolution readiness includes a meaningful response as the sixth requirement",()=>{
  const values={requestTypeId:"1",topicId:"2",trackerCauseId:"3",trackerActionId:"4",outcomeId:"5",resolutionNotes:"  "};
  let result=resolution.resolutionReadiness(values);assert.equal(result.filter(field=>field.ready).length,5);assert.equal(result.find(field=>!field.ready).key,"resolutionNotes");
  result=resolution.resolutionReadiness({...values,resolutionNotes:"Fixed the account sync."});assert.equal(result.every(field=>field.ready),true);
  assert.equal(resolution.resolutionReadiness({...values,topicId:"-1"})[1].ready,false);
});
