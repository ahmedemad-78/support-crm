// CLI-driven, isolated browser contexts; never opens the user's browser session.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const base = "http://127.0.0.1:3017";
const accounts = JSON.parse(
  readFileSync(".vercel/preview-accounts.json", "utf8"),
);
mkdirSync(".vercel/screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pages = [];
const errors = [];
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
async function login(handle) {
  const account = accounts.find(
    (a) => a.email === "preview-" + handle + "@example.test",
  );
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  pages.push(page);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.getByLabel("Work email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });
  return page;
}
try {
  const qa = await login("qa");
  await qa.goto(base + "/work/new");
  await qa
    .getByRole("heading", { name: "Create ticket", exact: true })
    .waitFor();
  await qa.getByLabel("Request work", { exact: true }).check();
  const title = "CLI UI request " + randomUUID().slice(0, 8);
  await qa.getByLabel("Title *", { exact: true }).fill(title);
  await qa
    .getByLabel("Describe the requested work *", { exact: true })
    .fill("Synthetic request from the UI to verify the new workflow.");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
    "base64",
  );
  await qa.locator("input[type=file]").setInputFiles({
    name: "preview-ui.png",
    mimeType: "image/png",
    buffer: png,
  });
  await qa.getByRole("button", { name: "Create ticket", exact: true }).click();
  await qa.waitForURL(/\/work\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const ticketUrl = qa.url();
  await qa.getByRole("heading", { name: title, exact: true }).waitFor();
  check(
    (await qa.getByText("preview-ui.png", { exact: true }).count()) > 0,
    "Original attachment visible",
  );
  await qa.screenshot({
    path: ".vercel/screenshots/owner-ticket.png",
    fullPage: true,
  });
  console.log("Owner intake and attachment verified.");
  const peer = await login("qa-peer");
  await peer.goto(ticketUrl);
  await peer.getByRole("heading", { name: title, exact: true }).waitFor();
  check(
    (await peer
      .getByRole("button", { name: "Send public reply", exact: true })
      .count()) === 0,
    "Peer cannot reply",
  );
  check(
    (await peer.getByText("Team-only planning", { exact: true }).count()) === 0,
    "Peer cannot see planning",
  );
  const worker = await login("worker");
  await worker.goto(ticketUrl);
  await worker.getByRole("button", { name: "Start work", exact: true }).click();
  await worker.locator(".work-status[data-state=in_progress]").waitFor();
  await worker.getByLabel("Action", { exact: true }).selectOption("note");
  await worker
    .getByLabel("Internal note — technical team only *", { exact: true })
    .fill("Synthetic private investigation note");
  await worker
    .getByRole("button", { name: "Add internal note", exact: true })
    .click();
  await worker
    .getByText("Synthetic private investigation note", { exact: true })
    .waitFor();
  await worker.getByLabel("Action", { exact: true }).selectOption("wait");
  await worker
    .getByLabel("Information needed from the owner *", { exact: true })
    .fill("Please confirm the test version");
  await worker
    .getByRole("button", { name: "Ask owner for information", exact: true })
    .click();
  await worker.locator(".work-status[data-state=awaiting_owner]").waitFor();
  await qa.reload();
  check(
    (await qa
      .getByText("Synthetic private investigation note", { exact: true })
      .count()) === 0,
    "Owner cannot see internal note",
  );
  await qa
    .getByLabel("Public reply *", { exact: true })
    .fill("The test version is confirmed");
  await qa
    .getByRole("button", { name: "Send public reply", exact: true })
    .click();
  await qa.locator(".work-status[data-state=in_progress]").waitFor();
  await worker.reload();
  await worker.getByLabel("Action", { exact: true }).selectOption("resolve");
  await worker
    .getByLabel("Solution / completed work *", { exact: true })
    .fill("Completed and verified through the isolated UI.");
  for (const label of [
    "Request type *",
    "Topic *",
    "Request reason *",
    "Action taken *",
    "Outcome *",
  ])
    await worker.getByLabel(label, { exact: true }).selectOption({ index: 1 });
  await worker
    .getByRole("button", { name: "Complete request & close", exact: true })
    .click();
  await worker.locator(".work-status[data-state=resolved]").waitFor();
  console.log("Worker / wait / owner reply / completion verified.");
  const manager = await login("manager");
  await manager.goto(ticketUrl);
  await manager.getByRole("heading", { name: title, exact: true }).waitFor();
  check(
    (await manager
      .getByRole("button", { name: "Send public reply", exact: true })
      .count()) === 0,
    "Manager cannot act on someone else’s ticket",
  );
  check(
    (await manager
      .getByText("Synthetic private investigation note", { exact: true })
      .count()) === 0,
    "Manager cannot see internal note",
  );
  check(
    (await manager.getByText("Team-only planning", { exact: true }).count()) ===
      0,
    "Manager cannot see private planning",
  );
  await manager.goto(base + "/reports/performance");
  await manager
    .getByRole("heading", { name: "Individual performance", exact: true })
    .waitFor();
  check(
    (await manager
      .getByRole("cell", { name: "Preview Backend", exact: true })
      .count()) > 0,
    "Manager can view performance",
  );
  await manager
    .getByRole("link", { name: "Preview Backend", exact: true })
    .click();
  await manager
    .getByRole("heading", { name: "Tickets — Preview Backend", exact: true })
    .waitFor();
  check(
    (await manager
      .getByRole("cell", { name: "Final solver", exact: true })
      .count()) > 0,
    "Member report lists solved tickets",
  );
  check(
    (await manager.getByRole("link", { name: /^WRK-/ }).count()) > 0,
    "Member report links each measured ticket",
  );
  await worker.goto(base + "/reports/performance");
  await worker.waitForURL(base + "/tickets");
  check(
    new URL(worker.url()).pathname === "/tickets",
    "Nonadmin worker is denied performance",
  );
  await worker.setViewportSize({ width: 390, height: 844 });
  await worker.goto(base + "/tickets");
  await worker
    .getByRole("heading", { name: "Ticket register", exact: true })
    .waitFor();
  check(
    await worker.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile has no horizontal page overflow",
  );
  await worker.screenshot({
    path: ".vercel/screenshots/register-mobile.png",
    fullPage: true,
  });
  await worker.setViewportSize({ width: 1440, height: 1050 });
  await worker.goto(base + "/tickets?page=99999");
  await worker
    .getByRole("heading", { name: "Ticket register", exact: true })
    .waitFor();
  check(
    (await worker.locator(".work-table tbody tr").count()) > 0,
    "Out of range page clamps to actual last page",
  );
  await worker.screenshot({
    path: ".vercel/screenshots/register-desktop.png",
    fullPage: true,
  });
  const csv = await worker.request.get(
    base + "/work/export?domain=internal&kind=execution_request",
  );
  check(csv.ok(), "CSV export succeeds");
  check(
    (await csv.text()).includes("Description"),
    "CSV contains full description column",
  );
  check(
    !(await csv.text()).includes("Synthetic private investigation note"),
    "CSV does not leak internal notes",
  );
  const b2b = await login("b2b");
  await b2b.goto(base + "/work/new");
  await b2b.getByLabel("External customer case", { exact: true }).check();
  check(
    (await b2b.getByLabel("Title *", { exact: true }).count()) === 0,
    "External form adds no required title",
  );
  await b2b
    .getByLabel("Describe the problem *", { exact: true })
    .fill("Synthetic external customer registration issue");
  await b2b
    .getByLabel("Customer name *", { exact: true })
    .fill("Synthetic B2B customer");
  await b2b
    .getByLabel("City *", { exact: true })
    .selectOption({ label: "Cairo" });
  await b2b
    .getByLabel("Customer type *", { exact: true })
    .selectOption("teacher");
  await b2b.getByLabel("App platform *", { exact: true }).selectOption("web");
  await b2b
    .getByLabel("Related to a Fawry payment? *", { exact: true })
    .selectOption("unknown");
  await b2b
    .getByLabel("School name *", { exact: true })
    .fill("Synthetic Preview School");
  await b2b.getByRole("button", { name: "Create ticket", exact: true }).click();
  await b2b.waitForURL(/\/work\/[0-9a-f-]{36}$/, { timeout: 60000 });
  check(
    (await b2b
      .getByRole("heading", {
        name: "Synthetic external customer registration issue",
        exact: true,
      })
      .count()) > 0,
    "External intake saves",
  );
  await b2b.goto(ticketUrl);
  check(
    (await b2b.getByRole("heading", { name: title, exact: true }).count()) ===
      0,
    "Other department cannot read owner ticket",
  );
  check(errors.length === 0, "No browser runtime errors: " + errors.join("; "));
  const result = {
    assertions,
    ticketUrl,
    status: "passed",
    screenshots: [
      "owner-ticket.png",
      "register-desktop.png",
      "register-mobile.png",
    ],
  };
  writeFileSync(
    ".vercel/workflow-ui-evidence.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
