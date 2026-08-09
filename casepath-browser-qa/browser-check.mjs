import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'https://casepath-swiss-claim-lab.onrender.com').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
const OUT = path.resolve('casepath-browser-qa/out');
const checks = [];
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
let page;
let browser;

function check(name, passed, detail = '') {
  const item = { name, passed: Boolean(passed), detail };
  checks.push(item);
  if (!item.passed) throw new Error(`${name}: ${detail || 'failed'}`);
}

async function visibleText(selector) {
  return (await page.locator(selector).innerText()).trim();
}

async function waitForVisible(selector, timeout = 90000) {
  await page.locator(selector).waitFor({ state: 'visible', timeout });
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  await fetch(`${API_URL}/api/demo/reset`, { method: 'POST' }).catch(() => null);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => {
    const url = request.url();
    if (!url.includes('favicon')) requestFailures.push({ url, error: request.failure()?.errorText || 'unknown' });
  });

  const response = await page.goto(`${BASE_URL}/?fresh-browser-qa=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120000 });
  check('Canonical page returned HTTP 200', response?.status() === 200, `status=${response?.status()}`);
  check('Canonical URL did not redirect away', page.url().startsWith(`${BASE_URL}/`), page.url());
  await waitForVisible('#runDemo');
  check('Flagship claim heading is visible', (await page.locator('h1').innerText()).includes('Recurring mould'));
  check('Broken loader is absent', !(await page.locator('body').innerText()).includes('CasePath could not open'));
  check('Original customer message is visible', (await visibleText('#customerMessage')).length > 80);
  await page.waitForFunction(() => document.querySelectorAll('#attachmentsGrid button').length > 0, null, { timeout: 90000 });
  const attachmentCount = await page.locator('#attachmentsGrid button').count();
  check('Source attachments are visible', attachmentCount > 0, `attachments=${attachmentCount}`);
  await page.screenshot({ path: path.join(OUT, '01-fresh-desktop.png'), fullPage: true });

  await page.locator('#attachmentsGrid button').first().click();
  await page.waitForFunction(() => document.querySelector('#artifactDialog')?.open === true, null, { timeout: 30000 });
  check('Source-document dialog opens', await page.locator('#artifactDialog').isVisible());
  check('Original attachment view is available', (await visibleText('#artifactTitle')).length > 0);
  const originalTab = page.locator('#artifactOriginalTab');
  check('Original and extraction are separate views', await originalTab.count() === 1 && await page.locator('#artifactExtractionTab').count() === 1);
  await page.locator('#closeArtifact').click();

  await page.locator('#runDemo').click();
  await page.waitForFunction(() => document.querySelector('#analysisStage') && !document.querySelector('#analysisStage').hidden, null, { timeout: 30000 });
  check('Visible analysis starts', await page.locator('#analysisStage').isVisible());
  await page.waitForFunction(() => document.querySelectorAll('#analysisStages .stage-row, #analysisStages > *').length >= 4, null, { timeout: 90000 });
  check('Multiple specialist stages become visible', await page.locator('#analysisStages > *').count() >= 4);
  await page.waitForFunction(() => document.querySelector('#resultsStage') && !document.querySelector('#resultsStage').hidden, null, { timeout: 150000 });
  await waitForVisible('#processGraph', 30000);
  check('Claim-specific process graph renders', (await visibleText('#processGraph')).length > 120);
  check('Current process question is visible', /cause|caused|moisture/i.test(await visibleText('#processGraph')));
  check('Process-derived evidence renders', (await visibleText('#evidenceColumn')).length > 120);
  check('Facts are source-linked', (await visibleText('#factsList')).length > 80);
  check('Legal basis is visible', (await visibleText('#legalList')).length > 80);
  const precedentButtons = await page.locator('#precedentsList button').count();
  check('Three historical precedents render', precedentButtons === 3, `precedents=${precedentButtons}`);
  await page.screenshot({ path: path.join(OUT, '02-analysis-result.png'), fullPage: true });

  await page.locator('#openAuditTop').click();
  await page.waitForFunction(() => {
    const drawer = document.querySelector('#auditDrawer');
    return drawer && (drawer.getAttribute('aria-hidden') === 'false' || drawer.classList.contains('is-open') || drawer.classList.contains('open'));
  }, null, { timeout: 30000 });
  check('Unified audit trail opens', (await visibleText('#auditContent')).length > 100);
  await page.locator('#closeAudit').click();

  await page.locator('#reviewStage').scrollIntoViewIfNeeded();
  const form = page.locator('#reviewForm');
  check('Expert review form is visible', await form.isVisible());
  const textarea = form.locator('textarea').first();
  if (await textarea.count()) await textarea.fill('Fresh-browser acceptance: keep broader testing conditional on the neutral inspection.');
  const conditional = form.locator('input[value="conditional"]').first();
  if (await conditional.count()) await conditional.check();
  const submit = form.locator('button[type="submit"]').first();
  check('Expert review has one clear submit action', await submit.count() === 1);
  await submit.click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#reviewStatus');
    return status && /saved|review|knowledge|available|approved/i.test(status.innerText || '');
  }, null, { timeout: 90000 });
  check('Expert correction is saved', /saved|review|knowledge|available|approved/i.test(await visibleText('#reviewStatus')));
  await page.waitForFunction(() => {
    const stage = document.querySelector('#learningStage');
    return stage && !stage.hidden && (stage.innerText || '').trim().length > 60;
  }, null, { timeout: 90000 });
  check('Knowledge impact is displayed', (await visibleText('#learningContent')).length > 60);
  await page.screenshot({ path: path.join(OUT, '03-review-learning.png'), fullPage: true });

  for (const viewport of [{ width: 390, height: 844, name: '390' }, { width: 320, height: 700, name: '320' }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(350);
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    check(`${viewport.name}px layout has no page-level horizontal overflow`, overflow <= 1, `overflow=${overflow}`);
    check(`${viewport.name}px keeps the main action reachable`, await page.locator('#runDemo').count() === 1);
    await page.screenshot({ path: path.join(OUT, `04-mobile-${viewport.name}.png`), fullPage: true });
  }

  check('No browser console errors', consoleErrors.length === 0, JSON.stringify(consoleErrors));
  check('No page errors', pageErrors.length === 0, JSON.stringify(pageErrors));
  check('No relevant request failures', requestFailures.length === 0, JSON.stringify(requestFailures));

  const report = {
    status: 'passed',
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiUrl: API_URL,
    passed: checks.filter(item => item.passed).length,
    failed: checks.filter(item => !item.passed).length,
    checks,
    consoleErrors,
    pageErrors,
    requestFailures,
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>CasePath fresh-browser QA</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 20px;color:#142033}li{margin:8px 0;color:#087443}code{background:#f3f5f8;padding:2px 5px;border-radius:4px}</style><h1>CasePath fresh-browser QA: passed</h1><p><strong>${report.passed}</strong> checks passed against <code>${BASE_URL}</code>.</p><ul>${checks.map(item => `<li>✓ ${item.name}</li>`).join('')}</ul>`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async error => {
  await fs.mkdir(OUT, { recursive: true });
  if (page) await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true }).catch(() => null);
  const report = {
    status: 'failed',
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiUrl: API_URL,
    passed: checks.filter(item => item.passed).length,
    failed: checks.filter(item => !item.passed).length + 1,
    checks,
    consoleErrors,
    pageErrors,
    requestFailures,
    error: error instanceof Error ? error.stack : String(error),
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(report.error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => null);
});
