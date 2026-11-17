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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  async function openPreview(query = '') {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        await page.goto(`http://localhost:3100/login/preview${query}`, { waitUntil: 'networkidle', timeout: 90000 });
        await page.getByRole('heading', { name: 'Support overview' }).waitFor({ timeout: 20000 });
        return;
      } catch (error) {
        if (attempt === 39) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async function figure(label) {
    const card = page.locator('.ov-kpi').filter({ has: page.locator('.ov-kpi-label', { hasText: new RegExp(`^${label}$`) }) });
    return card.locator('strong [aria-label]').getAttribute('aria-label');
  }

  async function assertReadableDates() {
    await page.locator('.ov-area').waitFor();
    await page.waitForFunction(() => (document.querySelector('.ov-area')?.getBoundingClientRect().width ?? 0) > 400);
    const labels = await page.locator('.ov-area text:not(.ov-value)').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { text: (node.textContent || '').trim(), top: rect.top, left: rect.left, right: rect.right };
    }));
    const dates = labels.filter(label => label.text && !/^\d+$/.test(label.text));
    const row = dates.filter(label => Math.abs(label.top - dates[0].top) < 8).sort((a, b) => a.left - b.left);
    for (let i = 1; i < row.length; i++) assert.ok(row[i].left + 1 >= row[i - 1].right, 'Timeline date labels must not overlap');
  }

  await openPreview('?scenario=unclassified');
  assert.equal(await figure('Total cases'), '47');
  assert.equal(await figure('Needs follow-up'), '4');
  assert.equal(await figure('Marked resolved'), '2');
  assert.equal(await figure('Closed, no response'), '41');
  const incomplete = page.locator('.ov-attention > *').filter({ hasText: 'Classification incomplete' });
  assert.equal((await incomplete.locator('b').textContent())?.replaceAll(',', ''), '47');

  await page.getByRole('button', { name: /Marked resolved/ }).click();
  assert.equal(await figure('Total cases'), '2', 'A status filter narrows the selection');
  await page.getByRole('button', { name: 'Clear all' }).click();
  assert.equal(await figure('Total cases'), '47');

  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  const from = page.locator('input[type=date]').first();
  await from.fill('2022-01-01');
  assert.equal(await figure('Total cases'), '47', 'A range covering every sample keeps the population');
  await page.locator('.ov-area-hit').click();
  const focused = Number((await figure('Total cases'))?.replaceAll(',', ''));
  assert.ok(focused < 47, 'Choosing one volume period narrows the selection');
  assert.notEqual(await from.inputValue(), '2022-01-01');
  await page.locator('.ov-dates').getByRole('button', { name: 'Clear period' }).click();
  assert.equal(await figure('Total cases'), '47');

  await page.evaluate(() => window.scrollTo(0, 0));
  await mkdir('artifacts', { recursive: true });
  await assertReadableDates();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page must not overflow');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openPreview();
  assert.equal(await figure('Total cases'), '96');
  await assertReadableDates();
  await page.screenshot({ path: 'artifacts/dashboard-classified.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Dashboard cohort, incomplete data, period filter and mobile checks passed.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
