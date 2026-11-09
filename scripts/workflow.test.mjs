// Exercise actual server actions with synthetic adapters; no network or customer writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const realRequire = createRequire(import.meta.url);
function loadWith(mocks) {
  const cache = new Map();
  function load(relative) {
    const file = resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} };
    cache.set(file, compiled);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        let path = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name);
        if (!existsSync(path)) path += ".ts";
        return load(path);
      }
      return realRequire(name);
    };
    new Function("require", "module", "exports", code)(require, compiled, compiled.exports);
    return compiled.exports;
  }
  return load;
}

const caseId = "11111111-1111-4111-8111-111111111111";
const agentId = "22222222-2222-4222-8222-222222222222";
const initialVersion = "2026-11-09T12:00:00.000Z";
function form(overrides = {}) {
  const data = new FormData();
  Object.entries({ ticketId: caseId, updatedAt: initialVersion, status: "in_progress", assigneeId: "", returnTo: "/dashboard?from=2026-11-01", ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}
function redirect(url) { throw Object.assign(new Error("redirect"), { destination: url }); }
async function destination(action) {
  try { await action(); assert.fail("Expected action redirect"); }
  catch (error) { if (!error.destination) throw error; return new URL(error.destination, "https://fixture.invalid"); }
}
function caseHarness({ role = "support_agent", version = initialVersion, activeAgent = true } = {}) {
  const record = { id: caseId, status: "new", assignee_id: null, updated_at: version };
  let emails = 0;
  let writes = 0;
  const client = { from(table) {
    let patch;
    const conditions = {};
    const query = {
      select() { return query; },
      update(value) { patch = value; return query; },
      eq(key, value) { conditions[key] = value; return query; },
      maybeSingle: async () => ({ data: activeAgent ? { id: agentId } : null, error: null }),
      then(done, fail) {
        if (table !== "tickets") throw new Error(`Unexpected table ${table}`);
        const matches = Object.entries(conditions).every(([key, value]) => record[key] === value);
        if (matches) { Object.assign(record, patch, { updated_at: "2026-11-09T12:01:00.000Z" }); writes += 1; }
        return Promise.resolve({ data: matches ? [{ id: record.id }] : [], error: null }).then(done, fail);
      },
    };
    return query;
  } };
  const load = loadWith({
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect },
    "@/lib/auth/session": { getCurrentUser: async () => role ? { id: agentId, role } : null },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/email/deliver": { deliverPendingEmails: async () => { emails += 1; } },
  });
  return { actions: load("src/app/(app)/tickets/actions.ts"), record, emails: () => emails, writes: () => writes };
}

test("a stale case form cannot overwrite a newer status or trigger mail", async () => {
  const h = caseHarness({ version: "2026-11-09T12:00:01.000Z" });
  const result = await destination(() => h.actions.updateTicketHeader(form()));
  assert.match(result.searchParams.get("error"), /changed since/);
  assert.equal(result.searchParams.get("saved"), null);
  assert.equal(h.record.status, "new"); assert.equal(h.writes(), 0); assert.equal(h.emails(), 0);
});
test("successful save retains the dashboard return context and confirms the write", async () => {
  const h = caseHarness();
  const result = await destination(() => h.actions.updateTicketHeader(form()));
  assert.equal(h.record.status, "in_progress"); assert.equal(h.writes(), 1);
  assert.equal(result.searchParams.get("saved"), "1");
  assert.equal(result.searchParams.get("returnTo"), "/dashboard?from=2026-11-01");
});
test("managers and unauthenticated callers cannot update cases", async () => {
  for (const role of ["manager", null]) {
    const h = caseHarness({ role });
    const result = await destination(() => h.actions.updateTicketHeader(form()));
    assert.match(result.searchParams.get("error"), /Only Technical Support/);
    assert.equal(h.writes(), 0); assert.equal(h.emails(), 0);
  }
});
test("inactive assignees are rejected before a case update", async () => {
  const h = caseHarness({ activeAgent: false });
  const result = await destination(() => h.actions.updateTicketHeader(form({ assigneeId: agentId })));
  assert.match(result.searchParams.get("error"), /active Technical Support/);
  assert.equal(h.writes(), 0);
});
test("malformed tracker IDs never reach a case update", async () => {
  const h = caseHarness();
  const result = await destination(() => h.actions.saveTracker(form({ outcomeId: "-2" })));
  assert.match(result.searchParams.get("error"), /valid tracker/);
  assert.equal(h.writes(), 0);
});
test("tracker and classification forms also reject stale versions", async () => {
  for (const name of ["saveTracker", "saveResolution"]) {
    const h = caseHarness({ version: "2026-11-09T12:00:01.000Z" });
    const result = await destination(() => h.actions[name](form()));
    assert.match(result.searchParams.get("error"), /changed since/);
    assert.equal(h.writes(), 0);
  }
});
test("sign-in infrastructure failure returns a useful error and preserves email", async () => {
  const load = loadWith({
    "next/navigation": { redirect },
    "@/lib/auth/lockout": { getLockStatus: async () => { throw new Error("database offline"); } },
    "@/lib/supabase/server": { createClient: async () => { throw new Error("must not reach auth"); } },
  });
  const data = new FormData(); data.set("email", "fixture@example.test"); data.set("password", "synthetic-only");
  const result = await load("src/app/login/actions.ts").signIn({}, data);
  assert.match(result.error, /temporarily unavailable/); assert.equal(result.email, "fixture@example.test");
  assert.equal(JSON.stringify(result).includes("synthetic-only"), false);
});
