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
function caseHarness({ role = "support_agent", version = initialVersion, activeAgent = true, databaseFailure = false } = {}) {
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
    "@/lib/supabase/server": { createClient: async () => { if (databaseFailure) throw new Error("network unavailable"); return client; } },
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

function fullCaseForm(overrides = {}) {
  return form({ requestTypeId: "1", topicId: "2", trackerCauseId: "3", trackerActionId: "4", outcomeId: "5", issueCategoryId: "6", rootCauseId: "7", resolutionNotes: "  Payment checked; activation confirmed.  ", followUpNotes: "Next check tomorrow", trackerNotes: "Internal tracker context", actionTaken: "Verified payment", ...overrides });
}
test("unified case save writes status, tracker, response and classification once", async () => {
  const h = caseHarness();
  const result = await destination(() => h.actions.saveCaseWorkspace({ error: "" }, fullCaseForm({ status: "resolved", assigneeId: agentId })));
  assert.equal(h.writes(), 1); assert.equal(h.emails(), 1);
  assert.equal(h.record.status, "resolved"); assert.equal(h.record.assignee_id, agentId);
  assert.equal(h.record.topic_id, 2); assert.equal(h.record.root_cause_id, 7);
  assert.equal(h.record.resolution_notes, "Payment checked; activation confirmed.");
  assert.equal(result.searchParams.get("saved"), "1");
  assert.equal(result.searchParams.get("returnTo"), "/dashboard?from=2026-11-01");
});
test("unified case save rejects conflicts without partial writes or mail", async () => {
  const h = caseHarness({ version: "2026-11-09T12:02:00Z" });
  const result = await h.actions.saveCaseWorkspace({ error: "" }, fullCaseForm());
  assert.match(result.error, /changed since/); assert.equal(h.writes(), 0); assert.equal(h.emails(), 0);
});
test("unified resolution requires every tracker field before a database write", async () => {
  for (const key of ["requestTypeId", "topicId", "trackerCauseId", "trackerActionId", "outcomeId"]) {
    const h = caseHarness(); const result = await h.actions.saveCaseWorkspace({ error: "" }, fullCaseForm({ status: "resolved", [key]: "" }));
    assert.match(result.error, /before marking this case Resolved/); assert.equal(h.writes(), 0);
  }
});
test("unified save enforces actor, active owner and numeric classification", async () => {
  for (const role of ["manager", null]) {
    const h = caseHarness({ role }); const result = await h.actions.saveCaseWorkspace({ error: "" }, fullCaseForm());
    assert.match(result.error, /Only Technical Support/); assert.equal(h.writes(), 0);
  }
  const inactive = caseHarness({ activeAgent: false });
  assert.match((await inactive.actions.saveCaseWorkspace({ error: "" }, fullCaseForm({ assigneeId: agentId }))).error, /active Technical Support/);
  assert.equal(inactive.writes(), 0);
  const invalid = caseHarness();
  assert.match((await invalid.actions.saveCaseWorkspace({ error: "" }, fullCaseForm({ rootCauseId: "-1" }))).error, /valid tracker and classification/);
  assert.equal(invalid.writes(), 0);
});
test("unified save returns an infrastructure error to the existing draft", async () => {
  const h = caseHarness({ databaseFailure: true });
  const result = await h.actions.saveCaseWorkspace({ error: "" }, fullCaseForm());
  assert.match(result.error, /Your draft is still here/); assert.equal(h.writes(), 0);
});

const intakeInput = { source: "whatsapp", customer_name: "Demo Customer", customer_email: " demo@example.com ", customer_phone: "", school_name: "", credentials_username: "demo.student", issue_date: "2026-10-01", city_id: "1", end_user_type: "parent", platform: "android", is_latest_version: "yes", fawry_payment: "no", app_version: "", device_type: "", page_screen: "", steps: "", issue_description: "Subscription could not be activated" };
function intakeHarness({ role = "support_agent", activeSource = true } = {}) {
  const records = new Map(); let writes = 0;
  const client = { from(table) {
    const where = {}; let values;
    const query = { select() { return query; }, eq(key, value) { where[key] = value; return query; }, insert(value) { values = value; return query; },
      async maybeSingle() {
        if (table === "ticket_sources") return { data: activeSource ? { code: "whatsapp" } : null, error: null };
        const row = records.get(where.id);
        return { data: row && row.created_by === where.created_by ? row : null, error: null };
      },
      async single() {
        if (records.has(values.id)) return { data: null, error: { code: "23505", message: "duplicate" } };
        const row = { ...values, ticket_number: "TKT-FIXTURE-0001" }; records.set(row.id, row); writes++;
        return { data: row, error: null };
      },
    }; return query;
  } };
  const load = loadWith({ "@/lib/email/deliver": { deliverPendingEmails: async () => {} }, "next/cache": { revalidatePath() {} }, "@/lib/auth/session": { getCurrentUser: async () => role ? { id: agentId, role } : null }, "@/lib/supabase/server": { createClient: async () => client } });
  return { actions: load("src/app/(app)/portal/new-ticket/actions.ts"), records, writes: () => writes };
}
test("creation retries reuse the original case and trim pasted email", async () => {
  const h = intakeHarness(); const first = await h.actions.createSupportTicket(intakeInput, caseId); const retry = await h.actions.createSupportTicket(intakeInput, caseId);
  assert.equal(first.ok, true); assert.deepEqual(retry, first); assert.equal(first.ticketId, caseId); assert.equal(h.writes(), 1);
  assert.equal(h.records.get(caseId).customer_email, "demo@example.com");
});
test("concurrent creation attempts with one request ID produce one case", async () => {
  const h = intakeHarness(); const results = await Promise.all([h.actions.createSupportTicket(intakeInput, caseId), h.actions.createSupportTicket(intakeInput, caseId)]);
  assert.ok(results.every((result) => result.ok)); assert.equal(h.writes(), 1); assert.equal(h.records.size, 1);
});
test("creation checks role, source, request ID and input before inserting", async () => {
  for (const role of ["manager", "moderation", null]) { const h = intakeHarness({ role }); assert.equal((await h.actions.createSupportTicket(intakeInput, caseId)).ok, false); assert.equal(h.writes(), 0); }
  const inactive = intakeHarness({ activeSource: false }); assert.equal((await inactive.actions.createSupportTicket(intakeInput, caseId)).fieldErrors.source, "Choose an active source."); assert.equal(inactive.writes(), 0);
  const invalid = intakeHarness(); assert.equal((await invalid.actions.createSupportTicket(intakeInput, "bad-id")).ok, false); assert.equal((await invalid.actions.createSupportTicket({ ...intakeInput, customer_name: "" }, caseId)).ok, false); assert.equal(invalid.writes(), 0);
});
test("portal creation retains its role source and the same request on retry", async () => {
  const h = intakeHarness({ role: "moderation" }); const input = { ...intakeInput }; delete input.source;
  assert.equal((await h.actions.createPortalTicket(input, caseId)).ok, true); assert.equal((await h.actions.createPortalTicket(input, caseId)).ok, true);
  assert.equal(h.records.get(caseId).source, "moderation"); assert.equal(h.writes(), 1);
});
test("a creation request never returns another user's existing case", async () => {
  const h = intakeHarness(); h.records.set(caseId, { id: caseId, created_by: "someone-else", ticket_number: "PRIVATE" });
  const result = await h.actions.createSupportTicket(intakeInput, caseId); assert.equal(result.ok, false); assert.equal(JSON.stringify(result).includes("PRIVATE"), false); assert.equal(h.writes(), 0);
});

test("follow-up actions validate role and input before calling a constrained RPC", async () => {
  for (const role of [null,"manager","support_agent","call_center"]) {
    const calls=[];
    const load=loadWith({"next/cache":{revalidatePath(){}},"@/lib/auth/session":{getCurrentUser:async()=>role?{id:agentId,role}:null},"@/lib/supabase/server":{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:null};}})},"@/lib/email/deliver":{deliverPendingEmails:async()=>{}}});
    const action=load("src/app/(app)/tickets/lifecycle-actions.ts").submitCaseFollowup;
    const data=form({mode:"reopen",body:"The subscription still does not appear.",requestId:caseId,version:initialVersion});
    const result=await action({error:"",success:""},data);
    if(role===null||role==="manager"){assert.ok(result.error);assert.equal(calls.length,0);}else{assert.equal(result.error,"");assert.equal(calls[0].name,"reopen_case");assert.equal(calls[0].args.case_id,caseId);assert.equal(calls[0].args.expected_version,initialVersion);}
    data.set("body","x");const invalid=await action({error:"",success:""},data);assert.ok(invalid.error);
  }
});

test("central email delivery excludes all legacy jobs and other recipients", async () => {
  const central="ahmed.emad@selaheltelmeez.com",sent=[];
  const rows=[
    {id:"legacy-other",event_id:null,to_address:"other@example.com"},
    {id:"legacy-central",event_id:null,to_address:central},
    {id:"new-other",event_id:"event-2",to_address:"other@example.com"},
    {id:"new-central",event_id:"event-3",to_address:central},
  ].map(row=>({...row,status:"pending",subject:"TKT-FIXTURE · Resolved & closed",body_text:"Cause: Sync delay. Action: Resync. Outcome: Fixed.",ticket_path:"/tickets/fixture",attempts:0,last_error:null,created_at:"2026-11-10T12:00:00Z",next_attempt_at:"2026-01-01T00:00:00Z"}));
  const admin={from(table){const predicates=[];let patch;const q={select(){return q;},eq(key,value){predicates.push(row=>row[key]===value);return q;},not(key,op,value){assert.equal(op,"is");assert.equal(value,null);predicates.push(row=>row[key]!=null);return q;},lte(key,value){predicates.push(row=>row[key]<=value);return q;},order(){return q;},limit(){return q;},update(value){patch=value;return q;},in(key,values){predicates.push(row=>values.includes(row[key]));return q;},async single(){assert.equal(table,"app_settings");return {data:{value:{mode:"central_only",email:central}},error:null};},then(resolve){const matching=rows.filter(row=>predicates.every(p=>p(row)));if(patch)for(const row of matching)Object.assign(row,patch);return Promise.resolve({data:matching,error:null}).then(resolve);}};return q;}};
  const load=loadWith({"server-only":{},"@/lib/supabase/admin":{createAdminClient:()=>admin},"@/lib/email/send":{mailConfigured:()=>true,sendOutbound:async message=>sent.push(message),MailNotConfiguredError:class extends Error{},publicMailError:()=>"failed",outboxFailurePatch:()=>({})}});
  const result=await load("src/lib/email/deliver.ts").deliverPendingEmails();
  assert.equal(result.sent,1);assert.equal(sent.length,1);assert.equal(sent[0].to,central);assert.match(sent[0].text,/Cause: Sync delay/);assert.match(sent[0].subject,/Resolved & closed/);
  assert.equal(rows[0].status,"pending");assert.equal(rows[1].status,"pending");assert.equal(rows[2].status,"pending");assert.equal(rows[3].status,"sent");
});

test("resolution requires a meaningful Support response before a database write",async()=>{
  const h=caseHarness();const result=await h.actions.saveCaseWorkspace({error:""},fullCaseForm({status:"resolved",resolutionNotes:"  "}));assert.match(result.error,/clear Support response/);assert.equal(h.writes(),0);
});

test("Microsoft Graph uses app-only OAuth and sends through the configured mailbox",async()=>{
  const load=loadWith({"server-only":{},nodemailer:{createTransport(){throw Error("SMTP must not run");}}});const mail=load("src/lib/email/send.ts");const calls=[];
  const env={GRAPH_TENANT_ID:"tenant-fixture",GRAPH_CLIENT_ID:"client-fixture",GRAPH_CLIENT_SECRET:"secret-fixture",GRAPH_SENDER:"support@example.com"};
  const result=await mail.sendOutbound({to:"ahmed@example.com",subject:"Case resolved",html:"<p>Cause and solution</p>"},{env,fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?{ok:true,json:async()=>({access_token:"test-token"})}:{status:202};}});
  assert.equal(result.provider,"microsoft-graph");assert.match(calls[0].url,/oauth2\/v2.0\/token$/);assert.equal(calls[0].options.body.get("grant_type"),"client_credentials");assert.equal(calls[0].options.body.get("scope"),"https://graph.microsoft.com/.default");assert.match(calls[1].url,/users\/support%40example.com\/sendMail$/);const body=JSON.parse(calls[1].options.body);assert.deepEqual(body.message.toRecipients,[{emailAddress:{address:"ahmed@example.com"}}]);assert.equal(body.saveToSentItems,true);
});
test("Graph authorization and send failures never acknowledge delivery",async()=>{
  const load=loadWith({"server-only":{},nodemailer:{}});const mail=load("src/lib/email/send.ts");const env={GRAPH_TENANT_ID:"fixture",GRAPH_CLIENT_ID:"fixture",GRAPH_CLIENT_SECRET:"test-secret",GRAPH_SENDER:"support@example.com"};
  await assert.rejects(()=>mail.sendOutbound({to:"a@example.com",subject:"Fixture",html:"Fixture"},{env,fetchImpl:async()=>({ok:false,status:401})}),/authorization failed/);
  let count=0;await assert.rejects(()=>mail.sendOutbound({to:"a@example.com",subject:"Fixture",html:"Fixture"},{env,fetchImpl:async()=>++count===1?{ok:true,json:async()=>({access_token:"test-token"})}:{status:403}}),/did not accept/);
  assert.doesNotMatch(mail.publicMailError(new Error("failed test-secret"),env),/test-secret/);
});
