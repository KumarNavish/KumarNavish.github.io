import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'https://casepath-swiss-claim-lab.onrender.com').replace(/\/$/, '');
const API = (process.env.API_URL || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
const OUT = path.resolve('guided-v13-smoke-out');
const checks = [];
const failures = { console: [], page: [], request: [] };
const runIds = [];
let browser;
let context;
let page;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail = '') {
  const item = { name, passed: Boolean(condition), detail };
  checks.push(item);
  if (!item.passed) throw new Error(`${name}: ${detail || 'failed'}`);
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: ${response.status}`);
  return response.json();
}

async function waitVisible(selector, timeout = 180000) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

async function waitHidden(selector, timeout = 30000) {
  await page.locator(selector).first().waitFor({ state: 'hidden', timeout });
}

async function waitText(selector, pattern, timeout = 180000) {
  await page.waitForFunction(({ selector, source, flags }) => {
    const node = document.querySelector(selector);
    return node && new RegExp(source, flags).test(node.textContent || '');
  }, { selector, source: pattern.source, flags: pattern.flags }, { timeout });
}

async function screenshot(name, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage });
}

async function awaitRun(runId) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const run = await getJson(`${API}/api/runs/${encodeURIComponent(runId)}`);
    if (run.status === 'complete') return run;
    if (run.status === 'failed') throw new Error(run.error || 'run failed');
    await sleep(250);
  }
  throw new Error(`run ${runId} timed out`);
}

async function horizontalOverflow() {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, 'video-tmp'), { recursive: true });

  const health = await getJson(`${API}/healthz`);
  check('API is healthy', health.status === 'ok' && health.pipeline_release === '15.0.0', JSON.stringify(health));
  const reset = await getJson(`${API}/api/demo/reset`, { method: 'POST' });
  check('Demo starts from playbook v3', reset.active_playbook === 'mould-playbook-v3', JSON.stringify(reset));

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(OUT, 'video-tmp'), size: { width: 1440, height: 900 } },
  });
  page = await context.newPage();
  const video = page.video();

  page.on('console', message => {
    if (message.type() === 'error') failures.console.push(`${message.text()} @ ${message.location().url || ''}:${message.location().lineNumber || 0}`);
  });
  page.on('pageerror', error => failures.page.push(String(error)));
  page.on('requestfailed', request => {
    if (request.url().startsWith(BASE) || request.url().startsWith(API)) failures.request.push(`${request.failure()?.errorText || 'failed'} ${request.url()}`);
  });
  page.on('response', async response => {
    try {
      const url = new URL(response.url());
      if (response.request().method() === 'POST' && url.origin === new URL(API).origin && url.pathname === '/api/runs' && response.ok()) {
        const value = await response.json();
        if (value.run_id && !runIds.includes(value.run_id)) runIds.push(value.run_id);
      }
    } catch (_) {}
  });

  const response = await page.goto(`${BASE}/?api=${encodeURIComponent(API)}&qa=${Date.now()}`, {
    waitUntil: 'domcontentloaded', timeout: 120000,
  });
  const sourceHtml = await response.text();
  check('Public product returns HTTP 200', response.status() === 200, `status=${response.status()}`);
  check('First paint contains an intentional claim shell', sourceHtml.includes('v20-source-skeleton') && sourceHtml.includes('Opening claim…'));
  check('The broken loading phrase is absent', !sourceHtml.includes('Loading claim…'));

  await page.waitForFunction(() => document.body.dataset.casepathRelease === '20.0.0', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll('.attachment-row').length === 6, null, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#runCasePath')?.disabled, null, { timeout: 120000 });
  check('CasePath v20 is loaded', await page.evaluate(() => window.CASEPATH_EXPERIENCE_RELEASE === '20.0.0'));
  check('Original message and six attachments are visible', await page.locator('#customerEmail .email-body').isVisible() && await page.locator('.attachment-row').count() === 6);
  check('Start state asks one operational question', /What should CasePath do with this claim/i.test(await page.locator('#startState').innerText()));
  check('Start state has one concise action', await page.locator('#runCasePath').count() === 1 && /Analyse claim/i.test(await page.locator('#runCasePath').innerText()));
  check('Marketing journey copy is absent from the start viewport', await page.locator('#startState .start-flow:visible').count() === 0 && await page.locator('#startState .start-copy p:visible').count() === 0);
  await screenshot('01-focused-start.png');

  await page.locator('[data-artifact-id="art_lease"]').click();
  await waitVisible('#sourceViewer[open]');
  await waitVisible('#documentPage');
  check('Actual source PDF remains inspectable', await page.locator('.page-thumb').count() === 6);
  await page.locator('#closeSourceViewer').click();

  await page.locator('#runCasePath').click();
  await waitVisible('#liveWorkspace');
  await waitText('#stageCanvas', /original submission is in the shared claim context/i);
  await waitVisible('.v18-progress-focus[data-active-stage="read"]');
  check('Active analysis shows one current specialist', await page.locator('.v18-progress-focus').isVisible());
  check('Permanent multi-agent rail is removed', await page.locator('.v19-team-rail').isHidden());
  check('Source claim remains visible while agents work', await page.locator('.submission-pane').isVisible());
  check('Reading exposes real source-level events', await page.locator('#stageCanvas .event-row').count() >= 6);
  await screenshot('02-agents-working.png');

  await waitText('#stageCanvas', /complete handling process is taking shape/i);
  await waitVisible('body[data-casepath-moment="process"]');
  await waitVisible('.v20-artifact-header[data-moment="process"]');
  await waitVisible('.process-layout');
  check('Process becomes the dominant artifact', await page.locator('#stageCanvas .process-node').count() === 11);
  check('Agent chrome recedes after producing the process', await page.locator('.orchestrator-bar').isHidden() && await page.locator('.agent-progress').isHidden());
  check('Report framing is removed from the process moment', await page.locator('.stage-title:visible,.stage-intro:visible,.v17-build-state:visible,.v18-handoff:visible').count() === 0);
  check('Current claim position remains explicit', await page.locator('.process-node.current').count() === 1 && await page.locator('.process-node.blocked').count() >= 2);
  await screenshot('03-process-is-the-product.png');

  await waitText('#stageCanvas', /Evidence now follows directly from the process/i);
  await waitVisible('body[data-casepath-moment="evidence"]');
  await page.waitForFunction(() => document.querySelectorAll('.v19-node-signal[data-kind="evidence"]').length >= 5, null, { timeout: 30000 });
  check('Evidence status lives directly on process decisions', await page.locator('.v19-node-signal[data-kind="evidence"]').count() >= 5);
  check('Standalone evidence-model explanation is hidden', await page.locator('.v17-evidence-chain:visible').count() === 0);
  check('Selected decision uses direct claim-handler language', /What we know/i.test(await page.locator('.decision-inspector').innerText()) && /Evidence that could resolve this/i.test(await page.locator('.decision-inspector').innerText()));
  await screenshot('04-evidence-inside-process.png');

  await waitText('#stageCanvas', /Previous cases are helping with the difficult decision/i);
  await waitVisible('body[data-casepath-moment="experience"]');
  check('Reviewed experience appears at the selected decision', await page.locator('.precedent-mini').count() === 3 && /Previous experience that may help/i.test(await page.locator('.precedent-inline').innerText()));
  check('Separate experience explanation is hidden', await page.locator('.v17-experience-note:visible').count() === 0);

  await waitText('#journeyNext', /Review the proposed playbook/i);
  await waitVisible('body[data-casepath-moment="ready"]');
  await waitVisible('.v20-artifact-header[data-moment="ready"]');
  await waitVisible('[data-v20-open-documents]');
  check('Completed analysis remains graph-first', await page.locator('.process-layout').isVisible());
  check('Summary cards and permanent checklist are absent', await page.locator('.v18-ready-artifacts:visible,.artifact-summary:visible,.v17-derived-checklist:visible').count() === 0);
  await page.locator('[data-v20-open-documents]').click();
  await waitVisible('.v20-document-sheet');
  check('Documents are a derived operational view', /Derived from the process/i.test(await page.locator('.v20-document-sheet').innerText()));
  const requiredItem = page.locator('.v20-document-body .v17-checklist-group[data-kind="still-needed"] .v17-checklist-item').first();
  check('Derived document items retain process links', Boolean(await requiredItem.getAttribute('data-v20-node-id')));
  await requiredItem.click();
  await waitHidden('.v20-document-sheet');
  check('Document need returns to its process decision', await page.locator('.decision-inspector[data-inspector-node="causation"]').count() === 1);
  await screenshot('05-playbook-ready.png');

  await page.locator('#journeyNext').click();
  await waitVisible('body[data-casepath-moment="review"]');
  await waitVisible('.v20-artifact-header[data-moment="review"]');
  check('Expert review happens beside the graph', await page.locator('.review-graph .process-layout').count() === 1);
  check('Review exposes only the consequential choice and delta', await page.locator('.review-choice').count() === 2 && await page.locator('.review-impact-row').count() === 3);
  check('Generic review prose and note field are removed', await page.locator('.review-panel>p:visible,.review-note:visible').count() === 0);
  await page.locator('input[value="required_now"]').check();
  await waitVisible('.v19-review-branch-preview[data-mode="required_now"]');
  await page.locator('input[value="conditional"]').check();
  await waitVisible('.v19-review-branch-preview[data-mode="conditional"]');
  await screenshot('06-review-on-the-graph.png');

  await page.locator('#reviewForm button[type="submit"]').click();
  await waitVisible('.v20-learning-summary');
  await waitVisible('body[data-casepath-learning-ready="true"]');
  check('Learning clears the interface to three useful outcomes', await page.locator('.v20-learning-row').count() === 3);
  check('Legacy governance report is no longer primary', await page.locator('.knowledge-flow:visible,.knowledge-release:visible,.knowledge-delta:visible,.v19-support-meter:visible').count() === 0);
  check('Learning distinguishes reviewed memory, expert correction, and shared rule', /Reviewed case saved/i.test(await page.locator('.v20-learning-summary').innerText()) && /Expert correction captured/i.test(await page.locator('.v20-learning-summary').innerText()) && /Shared playbook change/i.test(await page.locator('.v20-learning-summary').innerText()));
  await screenshot('07-what-casepath-learned.png');

  await page.locator('#journeyNext').click();
  await waitText('#journeyNext', /Restart the demo/i);
  await waitVisible('body[data-casepath-moment="later-result"]');
  await waitVisible('.v20-later-heading');
  check('The second claim ends on a meaningful before-and-after', await page.locator('#laterResult .before-after').isVisible());
  check('Working trace recedes after the later result', await page.locator('.later-agent-stream').isHidden());
  check('Reuse remains traceable to memory, playbook, process, and evidence', await page.locator('.v17-reuse-thread article').count() === 4);
  await screenshot('08-next-claim-improved.png', true);

  check('Public UI created two real claim runs', runIds.length === 2, JSON.stringify(runIds));
  const flagship = await awaitRun(runIds[0]);
  const later = await awaitRun(runIds[1]);
  check('Flagship produced the complete eleven-stage spine', flagship.result?.process?.main_spine?.length === 11);
  check('Evidence remains process-grounded', flagship.result?.checklist?.items?.length >= 20 && flagship.result.checklist.items.every(item => item.node_id && item.fact_id && item.why));
  check('Expert review released the reviewed v4 playbook', flagship.candidate?.new_version === 'mould-playbook-v4');
  check('Later claim used the reviewed playbook', later.result?.playbook?.version === 'mould-playbook-v4');
  check('Later claim made broader testing conditional', later.result?.checklist?.items?.some(item => item.item_id === 'building_envelope' && item.status === 'conditional'));

  for (const viewport of [
    { width: 390, height: 844, name: '390' },
    { width: 320, height: 700, name: '320' },
  ]) {
    await page.setViewportSize(viewport);
    await sleep(450);
    const overflow = await horizontalOverflow();
    check(`${viewport.name}px has no page-level horizontal overflow`, overflow <= 1, `overflow=${overflow}`);
    check(`${viewport.name}px keeps the source claim available`, await page.locator('.submission-pane').isVisible());
    check(`${viewport.name}px keeps one next action`, await page.locator('#journeyNext').count() === 1);
    await screenshot(`09-mobile-${viewport.name}.png`, true);
  }

  check('Skip link remains present', await page.locator('.skip-link').count() === 1);
  check('Visible icon controls have accessible names', await page.evaluate(() => [...document.querySelectorAll('button.icon-button:not([hidden]),a.icon-button:not([hidden])')].every(node => node.getAttribute('aria-label') || node.textContent.trim())));
  check('No browser console errors', failures.console.length === 0, JSON.stringify(failures.console));
  check('No page errors', failures.page.length === 0, JSON.stringify(failures.page));
  check('No public request failures', failures.request.length === 0, JSON.stringify(failures.request));

  await context.close();
  context = null;
  await sleep(150);
  check('No late browser console errors after context shutdown', failures.console.length === 0, JSON.stringify(failures.console));
  const resetAfterRun = await getJson(`${API}/api/demo/reset`, { method: 'POST' });
  check('Demo resets after QA', resetAfterRun.active_playbook === 'mould-playbook-v3');

  const videoPath = await video.path();
  await fs.copyFile(videoPath, path.join(OUT, 'uninterrupted-focused-demo.webm'));
  await browser.close();
  browser = null;

  const report = {
    status: 'passed', release: '20.0.0', checkedAt: new Date().toISOString(),
    baseUrl: BASE, apiUrl: API, passed: checks.length, failed: 0, checks, failures, runIds,
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const images = ['01-focused-start.png','02-agents-working.png','03-process-is-the-product.png','04-evidence-inside-process.png','05-playbook-ready.png','06-review-on-the-graph.png','07-what-casepath-learned.png','08-next-claim-improved.png','09-mobile-390.png','09-mobile-320.png'];
  await fs.writeFile(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CasePath v20 focused QA</title><style>body{font:15px system-ui;max-width:1160px;margin:40px auto;padding:0 20px;color:#15171a}li{margin:6px 0;color:#18744f}img{max-width:100%;border:1px solid #dde2e7;margin:8px 0 34px}code{background:#f1f3f5;padding:2px 5px;border-radius:4px}</style><h1>CasePath v20 focused production QA: passed</h1><p><strong>${checks.length}</strong> checks passed against <code>${BASE}</code> and <code>${API}</code>.</p><p><a href="uninterrupted-focused-demo.webm">Open uninterrupted focused demo</a></p><ul>${checks.map(item => `<li>✓ ${item.name}</li>`).join('')}</ul>${images.map(image => `<h2>${image}</h2><img src="${image}" alt="${image}">`).join('')}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async error => {
  await fs.mkdir(OUT, { recursive: true });
  if (page) await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true }).catch(() => null);
  const report = {
    status: 'failed', release: '20.0.0', checkedAt: new Date().toISOString(),
    baseUrl: BASE, apiUrl: API, passed: checks.filter(item => item.passed).length,
    failed: 1, checks, failures, runIds, error: error instanceof Error ? error.stack : String(error),
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(report.error);
  if (context) await context.close().catch(() => null);
  if (browser) await browser.close().catch(() => null);
  process.exitCode = 1;
});
