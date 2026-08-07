import { chromium } from 'playwright';
import fs from 'node:fs';

const root = process.env.CASEPATH_URL || 'https://casepath-swiss-claim-lab.onrender.com';
const outDir = 'casepath/reports/v7-live';
fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const errors = [];
const record = (name, passed, detail = '') => checks.push({ name, passed: Boolean(passed), detail });
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(`console:${m.text()}`); });
  page.on('pageerror', e => errors.push(`pageerror:${e.message}`));
  const go = async hash => {
    const response = await page.goto(`${root}/?v=7.0.0${hash || ''}`, { waitUntil: 'networkidle', timeout: 120000 });
    record(`HTTP 200 ${hash || '/'}`, response?.status() === 200, String(response?.status()));
  };

  await go('#/new');
  record('Minimal navigation', (await page.locator('.global-nav button').count()) === 3);
  record('One primary intake action', (await page.locator('form .btn.primary').count()) === 1);
  await page.screenshot({ path: `${outDir}/01-new-claim-1440x900.png` });

  await page.getByRole('button', { name: 'Analyse claim' }).click();
  await page.getByRole('heading', { name: 'Recurring mould after renovation' }).waitFor({ timeout: 20000 });
  record('Blocker visible', (await page.getByText('blocked because the cause of the recurring mould is not yet supported.').count()) === 1);
  record('Process prominence', (await page.getByRole('heading', { name: 'Where it is blocked' }).count()) === 1);
  record('Current process question', (await page.getByText('What caused the recurring mould?', { exact: true }).count()) === 1);
  record('No old sidebar', (await page.locator('.sidebar,.side').count()) === 0);
  record('No repeated Inspect buttons', (await page.getByRole('button', { name: 'Inspect', exact: true }).count()) === 0);
  await page.screenshot({ path: `${outDir}/02-workspace-1440x900.png` });

  await page.locator('[data-process="1"]').click();
  record('Contextual process detail', (await page.getByText('Is urgent protective action needed?', { exact: true }).count()) === 1);
  await page.locator('[data-process="4"]').click();
  await page.getByRole('button', { name: 'Why?' }).first().click();
  record('Evidence-to-process explanation', (await page.getByRole('heading', { name: 'Why Independent inspection report?' }).count()) === 1);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Audit trail' }).click();
  record('Unified audit trail', (await page.getByText('Deterministic validation', { exact: true }).count()) === 1);
  await page.screenshot({ path: `${outDir}/03-audit-trail.png` });
  await page.keyboard.press('Escape');

  await page.locator('[data-scroll="review"]').click();
  await page.getByRole('button', { name: 'Review result' }).click();
  await page.locator('#reviewNote').fill('Keep medical evidence conditional until symptoms are supported.');
  await page.getByRole('button', { name: 'Save review' }).click();
  record('Review remains case-local', (await page.getByText('Review saved for this claim. Shared knowledge has not changed.').count()) === 1);

  await page.locator('[data-route="claims"]').first().click();
  record('Calm inbox', (await page.locator('.claim-row:not(.header)').count()) === 8);
  await page.screenshot({ path: `${outDir}/04-claims-inbox.png` });
  await page.locator('#claimSearch').fill('heating');
  record('Inbox search', (await page.locator('.claim-row:not(.header)').count()) === 1);

  await page.locator('[data-route="knowledge"]').first().click();
  record('Knowledge surface', (await page.locator('.knowledge-section').count()) === 3);
  await page.locator('[data-route="system"]').first().click();
  record('System contracts', (await page.locator('.module-row').count()) === 7);

  await go('#/state/offline');
  record('Offline state', (await page.getByRole('heading', { name: 'You are offline' }).count()) === 1);
  await go('#/state/quota');
  record('Quota state', (await page.getByRole('heading', { name: 'Today’s live-analysis limit is reached' }).count()) === 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await go('#/claim/NEW-BS-2026-001');
  const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record('390px no overflow', overflow390 <= 1, String(overflow390));
  record('Mobile navigation', await page.locator('.mobile-bottom').isVisible());
  await page.screenshot({ path: `${outDir}/05-workspace-390x844.png` });

  await page.setViewportSize({ width: 320, height: 700 });
  await go('#/claim/NEW-BS-2026-001');
  const overflow320 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record('320px no overflow', overflow320 <= 1, String(overflow320));
  await page.screenshot({ path: `${outDir}/06-workspace-320x700.png` });
  record('No browser errors', errors.length === 0, errors.join('; '));
} catch (error) {
  errors.push(error?.stack || String(error));
} finally {
  if (browser) await browser.close();
  const report = {
    url: root,
    release: '7.0.0',
    verifiedAt: new Date().toISOString(),
    passed: checks.filter(x => x.passed).length,
    failed: checks.filter(x => !x.passed).length,
    checks,
    errors
  };
  fs.writeFileSync(`${outDir}/browser-qa.json`, JSON.stringify(report, null, 2));
}
