// Synthetic admin provisioning through the real UI, isolated from production.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
const base = "http://127.0.0.1:3017";
const accounts = JSON.parse(
  readFileSync(".vercel/preview-accounts.json", "utf8"),
);
const fixture = {
  email: `preview-ui-${randomUUID().slice(0, 8)}@example.test`,
  name: "Synthetic UI Representative",
  password: randomBytes(18).toString("base64url"),
  role: "department_member",
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
let assertions = 0;
const check = (v, m) => {
  assert.ok(v, m);
  assertions++;
};
async function login(a) {
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto(base + "/login", { waitUntil: "networkidle" });
  await p.getByLabel("Work email", { exact: true }).fill(a.email);
  await p.getByLabel("Password", { exact: true }).fill(a.password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  return p;
}
try {
  const admin = await login(
    accounts.find((a) => a.email === "preview-admin@example.test"),
  );
  await admin.goto(base + "/api/preview/status");
  check(
    (await admin.locator("body").innerText()).includes("vojietqeyfkrfisxcsrs"),
    "Preview database verified before admin writes",
  );
  await admin.goto(base + "/admin/departments");
  const dept = "Synthetic UI Department " + randomUUID().slice(0, 8);
  await admin.getByLabel("Department name *", { exact: true }).fill(dept);
  await admin
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await admin.getByRole("cell", { name: dept, exact: true }).waitFor();
  check(true, "Admin created department");
  await admin.goto(base + "/admin/users");
  await admin.getByRole("button", { name: "Add user", exact: true }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Full name", { exact: true }).fill(fixture.name);
  await dialog.getByLabel("Work email", { exact: true }).fill(fixture.email);
  await dialog
    .getByRole("radio", { name: /Department representative/ })
    .check();
  await dialog.getByLabel("Password", { exact: true }).fill(fixture.password);
  await dialog
    .getByLabel("Department", { exact: true })
    .selectOption({ label: dept });
  await dialog.getByRole("button", { name: "Add user", exact: true }).click();
  await dialog.waitFor({ state: "hidden", timeout: 60000 });
  await admin.getByText(fixture.email, { exact: true }).waitFor();
  check(true, "Admin created active account with department");
  // Store synthetic credentials only in ignored local test fixtures.
  accounts.push(fixture);
  writeFileSync(
    ".vercel/preview-accounts.json",
    JSON.stringify(accounts, null, 2),
  );
  const representative = await login(fixture);
  await representative.goto(base + "/work/new");
  await representative
    .getByRole("heading", { name: "Create ticket", exact: true })
    .waitFor();
  check(
    await representative
      .getByLabel("External customer case", { exact: true })
      .isDisabled(),
    "Internal-only department cannot select external intake",
  );
  await representative
    .getByLabel("Title *", { exact: true })
    .fill("Provisioned account test");
  await representative
    .getByLabel("Describe the problem *", { exact: true })
    .fill("Synthetic problem from a newly provisioned representative.");
  await representative
    .getByRole("button", { name: "Create ticket", exact: true })
    .click();
  await representative.waitForURL(/\/work\/[0-9a-f-]{36}$/, { timeout: 60000 });
  check(
    (await representative.getByText(dept, { exact: true }).count()) > 0,
    "Ticket uses the account department automatically",
  );
  await representative.goto(base + "/admin/departments");
  await representative.waitForURL((u) => !u.pathname.startsWith("/admin"), {
    timeout: 30000,
  });
  check(
    !new URL(representative.url()).pathname.startsWith("/admin"),
    "Representative cannot administer departments",
  );
  const result = { status: "passed", assertions };
  writeFileSync(
    ".vercel/workflow-admin-ui-evidence.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
