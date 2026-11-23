// Integration assertions against the disposable preview only; no production requests.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== "https://vojietqeyfkrfisxcsrs.supabase.co")
  throw Error("Refusing non-preview target");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const accounts = JSON.parse(
  readFileSync(".vercel/preview-accounts.json", "utf8"),
);
const clients = {};
let assertions = 0;
const check = (actual, expected) => {
  assert.deepEqual(actual, expected);
  assertions++;
};
for (const handle of ["admin", "worker", "qa", "qa-peer", "b2b", "manager"]) {
  const account = accounts.find(
    (a) => a.email === "preview-" + handle + "@example.test",
  );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await db.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (auth.error) throw auth.error;
  clients[handle] = { db, id: account.id };
}
const invoke = (handle, operation, t, data = {}, request = randomUUID()) =>
  clients[handle].db.rpc("work_command", {
    operation,
    ticket: t.id,
    revision: t.revision ?? 0,
    request_id: request,
    data,
  });
const success = async (promise) => {
  const r = await promise;
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const denied = async (promise) => {
  const r = await promise;
  assert.ok(r.error, "Operation should be denied");
  assertions++;
  return r.error;
};
const make = (handle, extra = {}) =>
  success(
    invoke(
      handle,
      "create",
      { id: randomUUID(), revision: 0 },
      {
        domain: "internal",
        kind: "execution_request",
        title: "Synthetic API workflow check",
        description: "Synthetic test only — registration request",
        ...extra,
      },
    ),
  );
try {
  let t = await make("qa");
  check(t.state, "new");
  const ticketId = t.id;
  const count = await success(
    clients["qa-peer"].db.from("work_tickets").select("id").eq("id", t.id),
  );
  check(count.length, 1);
  const other = await success(
    clients.b2b.db.from("work_tickets").select("id").eq("id", t.id),
  );
  check(other.length, 0);
  await denied(invoke("qa-peer", "reply", t, { body: "Peer cannot reply" }));
  await denied(
    invoke("manager", "reply", t, { body: "Manager cannot reply to others" }),
  );
  await denied(
    invoke(
      "worker",
      "create",
      { id: randomUUID(), revision: 0 },
      {
        domain: "internal",
        kind: "problem",
        title: "Denied on behalf",
        description: "Synthetic permission check",
        owner_id: clients.qa.id,
      },
    ),
  );
  await denied(
    invoke(
      "qa",
      "create",
      { id: randomUUID(), revision: 0 },
      {
        domain: "external",
        kind: "problem",
        title: "Denied external",
        description: "Synthetic permission check",
      },
    ),
  );
  const notices = await success(
    clients.admin.db
      .from("work_notifications")
      .select("recipient_id")
      .eq("ticket_id", t.id),
  );
  check(notices.length, 1); // Each user can read only their own notice.
  check(
    (
      await success(
        clients.qa.db
          .from("work_ticket_controls")
          .select("*")
          .eq("ticket_id", t.id),
      )
    ).length,
    0,
  );
  await denied(invoke("qa", "controls", t, { priority: "urgent" }));
  await denied(
    clients.qa.db
      .from("work_tickets")
      .update({ description: "Attempted rewrite" })
      .eq("id", t.id),
  );
  console.log("Access boundaries checked.");
  const raced = await Promise.all([
    invoke("admin", "start", t),
    invoke("worker", "start", t),
  ]);
  check(raced.filter((r) => !r.error).length, 1);
  const current = raced[0].error ? "worker" : "admin";
  const next = current === "worker" ? "admin" : "worker";
  t = raced.find((r) => !r.error).data;
  check(t.state, "in_progress");
  if (next !== "admin")
    await denied(
      invoke(next, "note", t, { body: "Another person cannot work here" }),
    );
  t = await success(
    invoke(current, "note", t, { body: "Internal investigation notes" }),
  );
  check(
    (
      await success(
        clients.qa.db
          .from("work_ticket_events")
          .select("id")
          .eq("ticket_id", t.id)
          .eq("visibility", "internal"),
      )
    ).length,
    0,
  );
  await denied(
    invoke("qa", "cancel", t, { body: "Cannot self-cancel after first start" }),
  );
  t = await success(
    invoke(current, "wait", t, { body: "Please confirm the target version" }),
  );
  check(t.state, "awaiting_owner");
  await denied(
    invoke("qa-peer", "reply", t, { body: "Peer cannot resume work" }),
  );
  t = await success(invoke("qa", "reply", t, { body: "Version confirmed" }));
  check(t.state, "in_progress");
  let row = await success(
    clients.admin.db
      .from("work_tickets")
      .select("current_worker_id")
      .eq("id", t.id)
      .single(),
  );
  check(row.current_worker_id, clients[current].id);
  t = await success(
    invoke(current, "transfer", t, { worker_id: clients[next].id }),
  );
  check(t.state, "assigned_pending");
  await denied(invoke(next, "return", t));
  t = await success(invoke(next, "start", t));
  check(t.state, "in_progress");
  await denied(
    invoke(next, "resolve", t, { body: "Implemented and verified" }),
  );
  const classification = {};
  for (const [k, table] of Object.entries({
    request_type_id: "request_types",
    topic_id: "topics",
    cause_id: "tracker_causes",
    action_id: "tracker_actions",
    outcome_id: "outcomes",
  })) {
    const r = await success(
      clients.admin.db
        .from(table)
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single(),
    );
    classification[k] = r.id;
  }
  const resolutionId = randomUUID();
  const beforeResolve = t;
  const resolutionData = {
    body: "Implemented and verified with synthetic data",
    ...classification,
  };
  t = await success(invoke(next, "resolve", t, resolutionData, resolutionId));
  check(t.state, "resolved");
  const repeated = await success(
    invoke(next, "resolve", beforeResolve, resolutionData, resolutionId),
  );
  check(repeated, t);
  const resolution = await success(
    clients.admin.db
      .from("work_ticket_resolutions")
      .select("resolver_credit_id,action_actor_id")
      .eq("ticket_id", t.id)
      .single(),
  );
  check(resolution.resolver_credit_id, clients[next].id);
  t = await success(
    invoke("qa", "reply", t, { body: "Thanks for the update" }),
  );
  check(t.state, "resolved");
  const formerReply = await success(
    invoke(next, "reply", t, { body: "You are welcome" }),
  );
  check(formerReply.state, "resolved");
  t = formerReply;
  t = await success(
    invoke("qa", "reopen", t, {
      body: "The requested setup still needs a correction",
    }),
  );
  check(t.state, "available");
  row = await success(
    clients.admin.db
      .from("work_tickets")
      .select("current_worker_id,pending_worker_id,reopen_count")
      .eq("id", t.id)
      .single(),
  );
  check(row, {
    current_worker_id: null,
    pending_worker_id: null,
    reopen_count: 1,
  });
  t = await success(invoke("worker", "start", t));
  t = await success(
    invoke("worker", "close_no_response", t, {
      body: "No response after manual follow-up",
    }),
  );
  check(t.state, "closed_no_response");
  t = await success(
    invoke("qa", "reopen", t, { body: "Ready to provide details" }),
  );
  check(t.state, "available");
  let managerTicket = await make("manager");
  managerTicket = await success(
    invoke("manager", "reply", managerTicket, {
      body: "Additional details from the owner",
    }),
  );
  managerTicket = await success(
    invoke("manager", "cancel", managerTicket, { body: "No longer needed" }),
  );
  check(managerTicket.state, "cancelled");
  managerTicket = await success(
    invoke("manager", "reopen", managerTicket, {
      body: "The request is needed again",
    }),
  );
  check(managerTicket.state, "available");
  await denied(clients.worker.db.rpc("work_performance"));
  await denied(clients.qa.db.rpc("work_performance"));
  check(
    Array.isArray(await success(clients.manager.db.rpc("work_performance"))),
    true,
  );
  const ownTicket = await make("worker");
  const ownStart = await success(invoke("worker", "start", ownTicket));
  const adminClosed = await success(
    invoke("admin", "resolve", ownStart, {
      body: "Admin verified completion for the worker",
      ...classification,
    }),
  );
  check(adminClosed.state, "resolved");
  const credited = await success(
    clients.admin.db
      .from("work_ticket_resolutions")
      .select("resolver_credit_id,action_actor_id")
      .eq("ticket_id", ownTicket.id)
      .single(),
  );
  check(credited.resolver_credit_id, clients.worker.id);
  check(credited.action_actor_id, clients.admin.id);
  await denied(
    clients.worker.db.rpc("work_member_performance", {
      member: clients.worker.id,
    }),
  );
  await denied(
    clients.qa.db.rpc("work_member_performance", { member: clients.worker.id }),
  );
  const memberReport = await success(
    clients.manager.db.rpc("work_member_performance", {
      member: clients.worker.id,
    }),
  );
  check(memberReport.find((t) => t.id === ownTicket.id)?.solved, true);
  check(
    memberReport.every((t) => t.working_seconds >= 0 && t.waiting_seconds >= 0),
    true,
  );
  const legacy = await clients.admin.db.from("tickets").insert({
    ticket_number: "pending",
    source: "whatsapp",
    customer_name: "Synthetic stale form",
    issue_description: "Should not enter legacy model",
  });
  check(Boolean(legacy.error), true);
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  await denied(anonymous.rpc("work_context"));
  const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const city = await success(
    clients.admin.db.from("cities").select("id").eq("name", "Cairo").single(),
  );
  const external = {
    customer_name: "Synthetic B2B customer",
    issue_date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
    }).format(new Date()),
    city_id: city.id,
    end_user_type: "teacher",
    platform: "web",
    is_latest_version: null,
    fawry_payment: null,
    school_name: "Synthetic Preview School",
  };
  for (const field of [
    "customer_name",
    "issue_date",
    "city_id",
    "end_user_type",
    "platform",
    "fawry_payment",
    "school_name",
  ]) {
    const invalid = { ...external };
    delete invalid[field];
    await denied(
      invoke(
        "b2b",
        "create",
        { id: randomUUID(), revision: 0 },
        {
          domain: "external",
          kind: "problem",
          title: "Denied missing external data",
          description: "Synthetic external validation check",
          external_data: invalid,
        },
      ),
    );
  }
  await denied(
    invoke(
      "b2b",
      "create",
      { id: randomUUID(), revision: 0 },
      {
        domain: "external",
        kind: "problem",
        title: "Denied invalid version answer",
        description: "Synthetic external validation check",
        external_data: {
          ...external,
          platform: "android",
          is_latest_version: "unknown",
        },
      },
    ),
  );
  let mediaTicket = await success(
    invoke(
      "worker",
      "create",
      { id: randomUUID(), revision: 0 },
      {
        domain: "external",
        kind: "problem",
        title: "Synthetic media and source check",
        description: "Synthetic external media privacy check",
        owner_id: clients.b2b.id,
        source_code: "whatsapp",
        external_data: external,
      },
    ),
  );
  const persisted = await success(
    clients.admin.db
      .from("work_tickets")
      .select("source_code,external_data,recorded_by_id")
      .eq("id", mediaTicket.id)
      .single(),
  );
  check(persisted.source_code, "business_development");
  check(persisted.external_data.fawry_payment, null);
  check(persisted.recorded_by_id, clients.worker.id);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
    "base64",
  );
  async function media(handle, ticket, event, name) {
    const path = ticket.id + "/" + randomUUID() + "-" + name;
    const upload = await clients[handle].db.storage
      .from("work-ticket-attachments")
      .upload(path, png, { contentType: "image/png" });
    if (upload.error) throw upload.error;
    await success(
      clients[handle].db.rpc("work_files", {
        ticket: ticket.id,
        event,
        files: [{ path, name }],
      }),
    );
    return path;
  }
  const originalPath = await media(
    "worker",
    mediaTicket,
    mediaTicket.event_id,
    "original.png",
  );
  check(
    (
      await success(
        clients.b2b.db
          .from("work_ticket_attachments")
          .select("id")
          .eq("storage_path", originalPath),
      )
    ).length,
    1,
  );
  mediaTicket = await success(invoke("worker", "start", mediaTicket));
  mediaTicket = await success(
    invoke("worker", "note", mediaTicket, {
      body: "Synthetic private note with private media",
    }),
  );
  const privatePath = await media(
    "worker",
    mediaTicket,
    mediaTicket.event_id,
    "private-note.png",
  );
  check(
    (
      await success(
        clients.b2b.db
          .from("work_ticket_attachments")
          .select("id")
          .eq("storage_path", privatePath),
      )
    ).length,
    0,
  );
  check(
    (
      await success(
        clients.manager.db
          .from("work_ticket_attachments")
          .select("id")
          .eq("storage_path", privatePath),
      )
    ).length,
    0,
  );
  check(
    Boolean(
      (
        await clients.b2b.db.storage
          .from("work-ticket-attachments")
          .createSignedUrl(privatePath, 60)
      ).error,
    ),
    true,
  );
  const publicLink = await clients.b2b.db.storage
    .from("work-ticket-attachments")
    .createSignedUrl(originalPath, 60);
  check(Boolean(publicLink.error), false);
  const broadcast = await success(
    service
      .from("work_notifications")
      .select("recipient_id")
      .eq("ticket_id", mediaTicket.id)
      .order("created_at")
      .eq(
        "event_id",
        (
          await success(
            clients.admin.db
              .from("work_ticket_events")
              .select("id")
              .eq("ticket_id", mediaTicket.id)
              .eq("kind", "created")
              .single(),
          )
        ).id,
      ),
  );
  const activeTeam = await success(
    service
      .from("profiles")
      .select("id")
      .eq("role", "support_agent")
      .eq("is_active", true),
  );
  check(
    broadcast.map((n) => n.recipient_id).sort(),
    activeTeam.map((p) => p.id).sort(),
  );
  mediaTicket = await success(
    invoke("worker", "reply", mediaTicket, { body: "Synthetic public update" }),
  );
  const recipients = await success(
    service
      .from("work_notifications")
      .select("recipient_id")
      .eq("event_id", mediaTicket.event_id),
  );
  check(
    recipients.map((n) => n.recipient_id).sort(),
    [clients.worker.id, clients.b2b.id].sort(),
  );
  mediaTicket = await success(
    invoke("worker", "controls", mediaTicket, {
      priority: "urgent",
      due_at: "2026-12-01T12:00:00Z",
    }),
  );
  check(
    (
      await success(
        clients.manager.db
          .from("work_ticket_controls")
          .select("*")
          .eq("ticket_id", mediaTicket.id),
      )
    ).length,
    0,
  );
  check(
    (
      await success(
        clients.b2b.db
          .from("work_ticket_controls")
          .select("*")
          .eq("ticket_id", mediaTicket.id),
      )
    ).length,
    0,
  );
  const publicEvents = await success(
    clients.b2b.db
      .from("work_ticket_events")
      .select("*")
      .eq("ticket_id", mediaTicket.id),
  );
  check(JSON.stringify(publicEvents).includes("urgent"), false);
  check(JSON.stringify(publicEvents).includes("Synthetic private note"), false);
  check(
    publicEvents.some((e) => e.kind === "controls"),
    false,
  );
  const managerEvents = await success(
    clients.manager.db
      .from("work_ticket_events")
      .select("id,kind")
      .eq("ticket_id", mediaTicket.id),
  );
  check(
    managerEvents.some((e) => e.kind === "controls"),
    false,
  );
  const controlNotices = await success(
    service
      .from("work_notifications")
      .select("id")
      .eq("event_id", mediaTicket.event_id),
  );
  check(controlNotices.length, 0);
  const staleRevision = mediaTicket.revision - 1;
  await denied(
    invoke(
      "worker",
      "reply",
      { ...mediaTicket, revision: staleRevision },
      { body: "Stale write denied" },
    ),
  );
  const segments = await success(
    clients.admin.db
      .from("work_ticket_segments")
      .select("ticket_id,ended_at")
      .is("ended_at", null),
  );
  const grouped = new Map();
  for (const s of segments)
    grouped.set(s.ticket_id, (grouped.get(s.ticket_id) || 0) + 1);
  check(
    [...grouped.values()].every((n) => n === 1),
    true,
  );
  console.log(
    "External intake, fixed source, private media, notification routing and stale writes checked.",
  );
  const result = {
    assertions,
    project: "vojietqeyfkrfisxcsrs",
    ticketId,
    status: "passed",
  };
  writeFileSync(
    ".vercel/workflow-v2-api-evidence.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await Promise.all(Object.values(clients).map((c) => c.db.auth.signOut()));
}
