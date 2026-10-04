import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Runs only against the development-only synthetic preview. No customer credentials.
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '3100'], { stdio: 'inherit' });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await page.goto('http://localhost:3100/login/preview?scenario=unclassified', { waitUntil: 'networkidle', timeout: 90000 }); break; }
    catch (error) { if (attempt === 39) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  await page.getByRole('button', { name: 'Last year to date', exact: true }).click();
  const total = page.locator('.bi-kpi').nth(0).locator('strong');
  assert.equal(await total.textContent(), '47');
  assert.equal(await page.locator('.bi-kpi').nth(1).locator('strong').textContent(), '43');
  assert.equal(await page.locator('.bi-kpi').nth(2).locator('strong').textContent(), '4');
  await page.locator('.bi-kpi').nth(3).click();
  assert.equal(await page.locator('.bi-result-count').textContent(), '2', 'Median must drill into its valid timestamp sample');
  await page.locator('.bi-kpi').nth(2).click();
  assert.equal(await total.textContent(), '47', 'Drilldown must not change report population');
  assert.equal(await page.locator('.bi-result-count').textContent(), '4');
  assert.match(await page.locator('.bi-status-layout').textContent(), /47/);
  assert.match(await page.locator('.bi-quality-empty').first().textContent(), /47/);
  await page.getByRole('button', { name: 'Clear chart selection' }).click();
  assert.equal(await page.locator('.bi-result-count').textContent(), '47');
  const from = page.locator('input[type=date]').first();
  await from.fill('2022-01-01');
  assert.match(await page.locator('.bi-flow-summary').textContent(), /quarter/);
  const receivedColumn = page.locator('.bi-flow svg [role=button]').filter({ hasText: /received/ }).last();
  await receivedColumn.click();
  assert.equal(await from.inputValue(), '2022-01-01', 'Chart clicks must preserve reporting dates');
  assert.equal(await total.textContent(), '47');
  await page.getByRole('button', { name: 'Clear chart selection' }).click();
  await page.evaluate(() => window.scrollTo(0,0));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width:390,height:844 });
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), 'Mobile page must not overflow');
  await page.setViewportSize({width:1440,height:1100});
  await page.goto('http://localhost:3100/login/preview', {waitUntil:'networkidle'});
  await page.getByRole('button', {name:'Last year to date',exact:true}).click();
  assert.equal(await total.textContent(), '96');
  await page.screenshot({path:'artifacts/dashboard-classified.png',fullPage:true});
  assert.deepEqual(errors, []);
  console.log('Dashboard cohort, incomplete data, date drilldown and mobile checks passed.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
