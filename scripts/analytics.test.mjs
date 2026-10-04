import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const directory = mkdtempSync(join(tmpdir(), "crm-analytics-test-"));
for (const name of ["constants", "dashboard-model", "analytics"]) {
  const source = readFileSync(
    new URL(`../src/lib/tickets/${name}.ts`, import.meta.url),
    "utf8",
  );
  writeFileSync(
    join(directory, `${name}.js`),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
  );
}
const require = createRequire(import.meta.url);
const a = require(join(directory, "analytics.js"));
const { cairoDate } = require(join(directory, "dashboard-model.js"));
after(() => rmSync(directory, { recursive: true, force: true }));
const ticket = (overrides = {}) => ({
  id: "1",
  number: "T1",
  subject: "Test",
  status: "new",
  source: "whatsapp",
  createdAt: "2026-01-01T00:00:00Z",
  createdOn: "2026-01-01",
  resolvedAt: null,
  cityId: "1",
  categoryId: "1",
  category: "Account",
  cause: "",
  endUserType: "student",
  ...overrides,
});

test("old open tickets survive date filters; resolutions use resolution dates", () => {
  const open = ticket();
  const resolved = ticket({
    id: "2",
    status: "resolved",
    resolvedAt: "2026-09-02T12:00:00Z",
  });
  const reopened = ticket({
    id: "3",
    status: "in_progress",
    resolvedAt: "2026-09-02T12:00:00Z",
  });
  const rows = [open, resolved, reopened];
  assert.deepEqual(a.cohort(rows, "created", "2026-09-01", "2026-09-30"), []);
  assert.deepEqual(a.cohort(rows, "resolved", "2026-09-01", "2026-09-30"), [
    resolved,
  ]);
  assert.deepEqual(a.cohort(rows, "open", "2026-09-01", "2026-09-30"), [
    open,
    reopened,
  ]);
});
test("median and durations exclude invalid and reopened resolutions", () => {
  assert.equal(a.median([1, 2, 100]), 2);
  assert.equal(a.median([1, 3]), 2);
  assert.equal(a.median([]), null);
  assert.equal(
    a.durationHours(
      ticket({ status: "resolved", resolvedAt: "2025-12-31T00:00:00Z" }),
    ),
    null,
  );
  assert.equal(
    a.durationHours(ticket({ resolvedAt: "2026-01-02T00:00:00Z" })),
    null,
  );
  assert.equal(
    a.durationHours(
      ticket({ status: "closed", resolvedAt: "2026-01-02T00:00:00Z" }),
    ),
    24,
  );
});
test("Cairo dates respect summer offset and trends retain empty dates", () => {
  assert.equal(cairoDate("2026-09-01T21:30:00Z"), "2026-09-02");
  assert.equal(cairoDate("2026-01-01T21:30:00Z"), "2026-01-01");
  const rows = a.trend([ticket()], "2026-01-01", "2026-01-03");
  assert.deepEqual(
    rows.map((r) => r.created),
    [1, 0, 0],
  );
  assert.deepEqual(a.previousPeriod("2026-03-01", "2026-03-03"), {
    from: "2026-02-26",
    to: "2026-02-28",
  });
  assert.equal(a.validDay("2026-02-30"), false);
});
test("dimensions intersect and age boundaries are unambiguous", () => {
  const rows = [
    ticket(),
    ticket({ cityId: "2" }),
    ticket({ source: "call_center" }),
  ];
  assert.equal(
    a.scopeTickets(rows, { city: "1", source: "whatsapp" }).length,
    1,
  );
  for (const [days, expected] of [
    [0, 0],
    [1, 1],
    [3, 2],
    [7, 3],
  ]) {
    assert.equal(
      a.ageBand(ticket(), Date.parse("2026-01-01T00:00:00Z") + days * 86400000),
      expected,
    );
  }
});
test("CSV preserves multiline values and neutralizes spreadsheet formulas", () => {
  assert.equal(a.csvCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const value of ["=1+1", " +cmd", "@SUM(A1)", "-1", "\t=1"])
    assert.ok(a.csvCell(value).startsWith("\"'"));
});

test("Pareto uses the whole selected cohort and matrix only counts recorded causes", () => {
  const rows = [
    ticket({ id: "1", categoryId: "1", category: "Access", cause: "Version" }),
    ticket({ id: "2", categoryId: "1", category: "Access", cause: "" }),
    ticket({ id: "3", categoryId: "2", category: "Content", cause: "Publishing" }),
    ticket({ id: "4", categoryId: "", category: "", cause: "" }),
  ];
  const pareto = a.issuePareto(rows);
  assert.deepEqual(pareto.map(r => [r.key, r.value, r.cumulative]), [["1", 2, 50], ["2", 1, 75], ["__missing__", 1, 100]]);
  const matrix = a.causeMatrix(rows);
  assert.deepEqual(matrix.causes, ["Publishing", "Version"]);
  assert.deepEqual(matrix.cells[0], [0, 1]);
  assert.equal(matrix.cells.flat().reduce((sum, value) => sum + value, 0), 2);
});

test("drill-down filters intersect and missing values remain explicit", () => {
  const rows = [
    ticket({ id: "1", cause: "Version", platform: "android", assigneeId: "agent" }),
    ticket({ id: "2", cause: "", platform: "android", assigneeId: "", cityId: "", endUserType: "" }),
    ticket({ id: "3", cause: "Version", platform: "ios", assigneeId: "" }),
  ];
  assert.deepEqual(a.scopeTickets(rows, { cause: "Version", platform: "android", assignee: "agent" }).map(t => t.id), ["1"]);
  assert.deepEqual(a.scopeTickets(rows, { cause: "__missing__", assignee: "__missing__" }).map(t => t.id), ["2"]);
  assert.deepEqual(a.scopeTickets(rows, { city: "__missing__", userType: "__missing__" }).map(t => t.id), ["2"]);
});

test("long reporting periods use calendar quarters without losing boundary events", () => {
  const rows = [
    ticket({ createdOn: "2023-02-12" }),
    ticket({ createdOn: "2023-03-31" }),
    ticket({ createdOn: "2023-04-01", status: "resolved", resolvedAt: "2024-01-01T12:00:00Z" }),
    ticket({ createdOn: "2026-09-30", status: "closed", resolvedAt: null }),
  ];
  const buckets = a.trend(rows, "2023-02-01", "2026-09-30");
  assert.equal(buckets[0].interval, "quarter");
  assert.equal(buckets[0].to, "2023-03-31");
  assert.equal(buckets[1].from, "2023-04-01");
  assert.equal(buckets[0].created, 2);
  assert.equal(buckets.reduce((n,b)=>n+b.created,0), 4);
  assert.equal(buckets.reduce((n,b)=>n+b.resolved,0), 1);
  assert.equal(buckets.at(-1).to, "2026-09-30");
  assert.ok(buckets.some(b=>!b.created&&!b.resolved));
  assert.equal(a.trend(rows,"2025-01-01","2026-09-30")[0].interval,"month");
});
