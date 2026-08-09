import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const FRONTEND = 'https://casepath-swiss-claim-lab.onrender.com';
const API = 'https://casepath-agentic-api.onrender.com';
const RELEASE = '12.0.2';
const FLAGSHIP = 'BS-DEF-2026-041';
const LATER = 'BS-DEF-2026-057';
const OUT = path.resolve('casepath/reports/public-v12.0.2');
fs.mkdirSync(OUT, { recursive: true });

const report = {
  release: RELEASE,
  frontend: FRONTEND,
  api: API,
  started_at: new Date().toISOString(),
  environment: { browser: 'chromium', browser_plugin: 'not available; Playwright fallback used' },
  assertions: [],
  http: {},
  api_flow: {},
  browser: {},
  errors: [],
};

function record(name, passed, detail = '') {
  report.assertions.push({ name, passed: Boolean(passed), detail });
  if (!passed) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchResponse(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { cache: 'no-store', ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function json(url, options = {}, timeout = 30000) {
  const response = await fetchResponse(url, options, timeout);
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text.slice(0, 300)}`);
  return payload;
}

async function waitForDeployment() {
  const deadline = Date.now() + 18 * 60 * 1000;
  let last = {};
  while (Date.now() < deadline) {
    try {
      const [frontRes, releaseRes, health, ready, deployed, demo] = await Promise.all([
        fetchResponse(`${FRONTEND}/?acceptance=${Date.now()}`, {}, 30000),
        fetchResponse(`${FRONTEND}/release.json?acceptance=${Date.now()}`, {}, 30000),
        json(`${API}/healthz?acceptance=${Date.now()}`, {}, 30000),
        json(`${API}/readyz?acceptance=${Date.now()}`, {}, 30000),
        json(`${API}/deployment-health?acceptance=${Date.now()}`, {}, 30000),
        json(`${API}/api/demo?acceptance=${Date.now()}`, {}, 30000),
      ]);
      const front = await frontRes.text();
      const releaseText = await releaseRes.text();
      const release = JSON.parse(releaseText);
      last = { front_status: frontRes.status, release_status: releaseRes.status, release, health, ready, deployed, demo_claim_id: demo.demo_claim_id };
      const readyNow = frontRes.ok && releaseRes.ok &&
        !front.includes('Waiting for the v12.0.1 workspace') &&
        !front.includes("SOURCE=API+'/frontend/index.html'") &&
        release.release === RELEASE && health.release === RELEASE && deployed.release === RELEASE &&
        deployed.frontend_release === RELEASE && deployed.api_release === RELEASE &&
        deployed.data_module === 'data_v12' && deployed.pipeline_module === 'pipeline_v12' &&
        ready.claims === 4 && demo.demo_claim_id === FLAGSHIP;
      if (readyNow) {
        report.http.deployment = last;
        return;
      }
    } catch (error) {
      last = { error: String(error) };
    }
    await sleep(10000);
  }
  report.http.deployment = last;
  throw new Error(`Deployment did not converge to ${RELEASE}: ${JSON.stringify(last)}`);
}

function findArrays(value, predicate, found = []) {
  if (Array.isArray(value)) {
    if (predicate(value)) found.push(value);
    for (const item of value) findArrays(item, predicate, found);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) findArrays(item, predicate, found);
  }
  return found;
}

function findObjects(value, predicate, found = []) {
  if (value && typeof value === 'object') {
    if (!Array.isArray(value) && predicate(value)) found.push(value);
    for (const item of Object.values(value)) findObjects(item, predicate, found);
  }
  return found;
}

async function verifySourceArtifacts() {
  const demo = await json(`${API}/api/demo`);
  const claim = demo.claim;
  const attachments = claim.attachments || claim.artifacts || [];
  record('Flagship claim is the v12 source-grounded claim', demo.demo_claim_id === FLAGSHIP, demo.demo_claim_id);
  record('Flagship claim exposes at least ten source attachments', attachments.length >= 10, String(attachments.length));

  let pdfCount = 0;
  let imageCount = 0;
  const checked = [];
  for (const attachment of attachments) {
    const id = attachment.artifact_id || attachment.id;
    const media = attachment.media_type || attachment.mime_type || '';
    const raw = await fetchResponse(`${API}/api/artifacts/${encodeURIComponent(id)}`);
    record(`Attachment opens: ${attachment.filename || id}`, raw.ok, String(raw.status));
    const bytes = new Uint8Array(await raw.arrayBuffer());
    record(`Attachment has substantive bytes: ${attachment.filename || id}`, bytes.byteLength > 100, String(bytes.byteLength));
    checked.push({ id, filename: attachment.filename, media, bytes: bytes.byteLength });

    if (media === 'application/pdf') {
      pdfCount += 1;
      const pageCount = attachment.page_count || 1;
      for (const page of [...new Set([1, pageCount])]) {
        const rendered = await fetchResponse(`${API}/api/artifacts/${encodeURIComponent(id)}/pages/${page}`);
        const pageBytes = new Uint8Array(await rendered.arrayBuffer());
        record(`Rendered PDF page ${page}: ${attachment.filename || id}`, rendered.ok && rendered.headers.get('content-type')?.includes('image/png'), rendered.headers.get('content-type') || '');
        record(`Rendered PDF page ${page} is non-empty`, pageBytes.byteLength > 1000, String(pageBytes.byteLength));
      }
      const extraction = await json(`${API}/api/artifacts/${encodeURIComponent(id)}/extraction`);
      record(`PDF extraction is separate and page-based: ${attachment.filename || id}`, Array.isArray(extraction.pages) && extraction.pages.length >= 1);
    }
    if (media.startsWith('image/')) {
      imageCount += 1;
      record(`Photograph is served as an image: ${attachment.filename || id}`, raw.headers.get('content-type')?.startsWith('image/'), raw.headers.get('content-type') || '');
      record(`Photograph is not a tiny placeholder: ${attachment.filename || id}`, bytes.byteLength > 15000, String(bytes.byteLength));
    }
  }
  record('The package includes real rendered PDFs', pdfCount >= 3, String(pdfCount));
  record('The package includes multiple photographic files', imageCount >= 3, String(imageCount));
  report.http.attachments = checked;
}

async function waitRun(runId, timeout = 120000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await json(`${API}/api/runs/${runId}`);
    if (last.status === 'complete') return last;
    if (last.status === 'failed') throw new Error(`Run failed: ${JSON.stringify(last)}`);
    await sleep(500);
  }
  throw new Error(`Run ${runId} did not complete: ${JSON.stringify(last)}`);
}

async function verifyApiJourney() {
  await json(`${API}/api/demo/reset`, { method: 'POST' });
  const created = await json(`${API}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claim_id: FLAGSHIP }),
  });
  const run = await waitRun(created.run_id);
  const eventLabels = (run.events || []).map(event => `${event.stage || ''}:${event.label || ''}`);
  record('Analysis emits multiple real stage events', eventLabels.length >= 7, eventLabels.join(' | '));
  record('Terminal audit event exists before completion is observed', (run.events || []).some(event => event.stage === 'complete'));
  record('Completed run contains a result', Boolean(run.result));

  const processArrays = findArrays(run.result, array => array.length >= 6 && array.every(item => item && typeof item === 'object') && array.some(item => 'question' in item || 'node_id' in item || 'status' in item));
  record('Claim-specific process graph is present', processArrays.length >= 1, String(processArrays.map(a => a.length)));

  const checklistArrays = findArrays(run.result, array => array.length >= 4 && array.every(item => item && typeof item === 'object') && array.some(item => 'document' in item || 'evidence' in item || 'requirement' in item));
  record('Process-derived evidence checklist is present', checklistArrays.length >= 1, String(checklistArrays.map(a => a.length)));

  const precedentArrays = findArrays(run.result, array => array.length === 3 && array.every(item => item && typeof item === 'object' && ('claim_id' in item || 'case_id' in item)));
  record('Exactly three historical precedents are returned', precedentArrays.length >= 1, String(precedentArrays.length));
  const precedents = precedentArrays[0] || [];
  record('The active claim cannot retrieve itself', !JSON.stringify(precedents).includes(FLAGSHIP));

  const before = JSON.stringify(run.result);
  const review = await json(`${API}/api/runs/${created.run_id}/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve_with_edit',
      building_envelope_mode: 'conditional',
      confidence: 0.94,
      justification: 'Begin with one neutral inspection. Request a broader building-envelope assessment only if the first causal assessment remains inconclusive.',
    }),
  });
  const afterRun = await json(`${API}/api/runs/${created.run_id}`);
  const after = JSON.stringify(afterRun.result || review);
  record('Expert review changes the accepted operational result', before !== after || JSON.stringify(review).includes('conditional'));

  const knowledge = await json(`${API}/api/knowledge?acceptance=${Date.now()}`);
  record('Reviewed case memory is persisted and readable', JSON.stringify(knowledge).includes(FLAGSHIP));
  const proof = await json(`${API}/api/learning-proof?acceptance=${Date.now()}`);
  const proofText = JSON.stringify(proof);
  record('Later-claim proof identifies the unseen later claim', proofText.includes(LATER));
  record('Later claim retrieves the reviewed flagship memory', proofText.includes(FLAGSHIP));

  report.api_flow = {
    run_id: created.run_id,
    events: eventLabels,
    process_candidates: processArrays.map(array => array.length),
    checklist_candidates: checklistArrays.map(array => array.length),
    precedents,
    review,
    knowledge,
    learning_proof: proof,
  };
}

async function collectBrowser(context, label, viewport, fullJourney) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || '' }));

  await page.goto(`${FRONTEND}/?acceptance=${Date.now()}-${label}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /BS-DEF-2026-041|Recurring mould|What the customer sent/i.test(text) && !/Waiting for the v12\.0\.1 workspace/i.test(text);
  }, null, { timeout: 90000 });
  await page.waitForTimeout(1000);

  const bodyText = await page.locator('body').innerText();
  record(`${label}: direct application rendered`, /BS-DEF-2026-041|Recurring mould/i.test(bodyText));
  record(`${label}: broken loader is absent`, !/Waiting for the v12\.0\.1 workspace|Attempt \d+: HTTP 404/i.test(bodyText));
  record(`${label}: no framework error overlay`, !/Unhandled Runtime Error|Application error|Vite|Webpack|Next\.js/i.test(bodyText));

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  record(`${label}: no page-level horizontal overflow`, Math.max(dimensions.scrollWidth, dimensions.bodyScrollWidth) <= dimensions.innerWidth + 1, JSON.stringify(dimensions));

  await page.screenshot({ path: path.join(OUT, `${label}-01-loaded.png`), fullPage: false });

  const attachmentRoot = page.locator('#attachmentList, .attachment-list').first();
  await attachmentRoot.waitFor({ state: 'visible', timeout: 30000 });
  const attachmentControls = attachmentRoot.locator('button, [role="button"], a');
  const attachmentCount = await attachmentControls.count();
  record(`${label}: attachment controls are visible`, attachmentCount >= 10, String(attachmentCount));

  if (fullJourney) {
    let pdfControl = attachmentControls.filter({ hasText: /lease|tenancy|rental|miet|pdf/i }).first();
    if (await pdfControl.count() === 0) pdfControl = attachmentControls.first();
    await pdfControl.click();
    await page.waitForTimeout(800);
    const viewer = page.locator('[role="dialog"], dialog, .artifact-dialog, .artifact-viewer, .source-viewer').filter({ visible: true }).first();
    await viewer.waitFor({ state: 'visible', timeout: 20000 });
    const viewerText = await viewer.innerText().catch(() => '');
    const renderedPages = viewer.locator('img[src*="/pages/"], img[alt*="page" i], canvas, iframe');
    record('Desktop: PDF viewer opens with page content', (await renderedPages.count()) >= 1 || /page\s*1|1\s*of\s*\d+/i.test(viewerText), viewerText.slice(0, 300));
    await page.screenshot({ path: path.join(OUT, 'desktop-02-pdf.png'), fullPage: false });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    let photoControl = attachmentControls.filter({ hasText: /photo|photograph|mould|image|jpg|jpeg/i }).first();
    if (await photoControl.count() > 0) {
      await photoControl.click();
      await page.waitForTimeout(800);
      const photoViewer = page.locator('[role="dialog"], dialog, .artifact-dialog, .artifact-viewer, .source-viewer').filter({ visible: true }).first();
      await photoViewer.waitFor({ state: 'visible', timeout: 20000 });
      const natural = await photoViewer.locator('img').evaluateAll(images => images.map(image => ({ width: image.naturalWidth, height: image.naturalHeight, src: image.currentSrc })).filter(item => item.width > 0));
      record('Desktop: photograph opens at substantive resolution', natural.some(item => item.width >= 800 && item.height >= 500), JSON.stringify(natural));
      await page.screenshot({ path: path.join(OUT, 'desktop-03-photo.png'), fullPage: false });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    await json(`${API}/api/demo/reset`, { method: 'POST' });
    const analyse = page.locator('#analyseBtn, button').filter({ hasText: /Analyse claim/i }).first();
    await analyse.click();
    await page.waitForTimeout(900);
    const stageRoot = page.locator('#stageList, .stage-list').first();
    await stageRoot.waitFor({ state: 'visible', timeout: 20000 });
    const initialStages = await stageRoot.locator('li, [data-stage], .stage').count();
    record('Desktop: visible pipeline stages appear', initialStages >= 6, String(initialStages));
    await page.screenshot({ path: path.join(OUT, 'desktop-04-processing.png'), fullPage: false });

    const result = page.locator('#result, .result-section').first();
    await page.waitForFunction(() => {
      const node = document.querySelector('#result, .result-section');
      return node && !node.hidden && getComputedStyle(node).display !== 'none';
    }, null, { timeout: 120000 });
    await result.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const processText = await page.locator('#processPath, .process-path, .decision-graph').first().innerText();
    const evidenceText = await page.locator('#evidenceColumn, .evidence-column, .evidence-panel').first().innerText();
    record('Desktop: claim-specific process renders', processText.length > 120 && /cause|question|mould|notify|scope/i.test(processText), processText.slice(0, 250));
    record('Desktop: process-bound evidence renders', evidenceText.length > 100 && /needed|available|evidence|inspection|assessment/i.test(evidenceText), evidenceText.slice(0, 250));

    const precedentRoot = page.locator('#precedentList, .precedent-list').first();
    const precedentCards = precedentRoot.locator('article, .precedent-card, [data-precedent-id], details');
    const precedentCount = await precedentCards.count();
    record('Desktop: exactly three precedents render', precedentCount === 3, String(precedentCount));
    for (let index = 0; index < precedentCount; index += 1) {
      const card = precedentCards.nth(index);
      const details = card.locator('summary, button, a').first();
      if (await details.count()) {
        await details.click().catch(() => {});
        await page.waitForTimeout(150);
      }
      const cardText = await card.innerText();
      record(`Desktop: precedent ${index + 1} explains relevance`, cardText.length > 80 && /why|relevant|question|evidence|lesson|similar/i.test(cardText), cardText.slice(0, 200));
    }
    await page.screenshot({ path: path.join(OUT, 'desktop-05-result.png'), fullPage: false });

    const review = page.locator('#review, .review-section').first();
    await review.scrollIntoViewIfNeeded();
    const reason = page.locator('#reviewReason, textarea[name*="reason" i], textarea').first();
    if (await reason.count()) {
      await reason.fill('Start with one neutral inspection. Request broader building-envelope testing only if the initial causal assessment remains inconclusive.');
    }
    const submit = page.locator('#reviewForm button[type="submit"], #review button').filter({ hasText: /Save|Approve|Submit|Apply/i }).first();
    record('Desktop: expert review submit control is available', (await submit.count()) === 1);
    await submit.click();
    await page.waitForFunction(() => /saved|available immediately|case memory|shared knowledge has not changed|reviewed precedent/i.test(document.body.innerText), null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const reviewedBody = await page.locator('body').innerText();
    record('Desktop: review result is visibly recomputed or saved', /saved|conditional|case memory|available immediately/i.test(reviewedBody));
    await page.screenshot({ path: path.join(OUT, 'desktop-06-review-memory.png'), fullPage: false });

    const knowledge = await json(`${API}/api/knowledge?browser=${Date.now()}`);
    record('Browser review persisted to the API knowledge store', JSON.stringify(knowledge).includes(FLAGSHIP));

    const laterButton = page.locator('button, a').filter({ hasText: /See this knowledge used|later claim|another claim/i }).first();
    if (await laterButton.count()) {
      await laterButton.click();
      await page.waitForFunction(later => document.body.innerText.includes(later), LATER, { timeout: 30000 });
      const laterText = await page.locator('body').innerText();
      record('Desktop: later claim opens', laterText.includes(LATER));
      record('Desktop: later claim visibly uses reviewed memory', /reviewed|precedent|neutral inspection|conditional|BS-DEF-2026-041/i.test(laterText));
      await page.screenshot({ path: path.join(OUT, 'desktop-07-later-claim.png'), fullPage: false });
    } else {
      const proof = await json(`${API}/api/learning-proof?browser=${Date.now()}`);
      record('Desktop fallback: later-claim proof remains available', JSON.stringify(proof).includes(LATER) && JSON.stringify(proof).includes(FLAGSHIP));
    }
  }

  await page.waitForTimeout(500);
  const relevantFailed = failedRequests.filter(item => !/favicon\.ico/.test(item.url));
  record(`${label}: zero console errors`, consoleErrors.length === 0, JSON.stringify(consoleErrors));
  record(`${label}: zero page errors`, pageErrors.length === 0, JSON.stringify(pageErrors));
  record(`${label}: zero relevant request failures`, relevantFailed.length === 0, JSON.stringify(relevantFailed));

  const result = { viewport, dimensions, consoleErrors, consoleWarnings, pageErrors, failedRequests: relevantFailed };
  await page.close();
  return result;
}

async function verifyBrowserJourney() {
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const mobile390 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const mobile320 = await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 1 });
    report.browser.desktop = await collectBrowser(desktop, 'desktop', { width: 1440, height: 900 }, true);
    report.browser.mobile390 = await collectBrowser(mobile390, 'mobile-390', { width: 390, height: 844 }, false);
    report.browser.mobile320 = await collectBrowser(mobile320, 'mobile-320', { width: 320, height: 700 }, false);
    await mobile390.pages()[0]?.screenshot({ path: path.join(OUT, 'mobile-390.png'), fullPage: false }).catch(() => {});
    await mobile320.pages()[0]?.screenshot({ path: path.join(OUT, 'mobile-320.png'), fullPage: false }).catch(() => {});
    await desktop.close();
    await mobile390.close();
    await mobile320.close();
  } finally {
    await browser.close();
  }
}

try {
  await waitForDeployment();
  record('Static application and API report the same release', report.http.deployment.release.release === RELEASE && report.http.deployment.deployed.release === RELEASE);
  await verifySourceArtifacts();
  await verifyApiJourney();
  await verifyBrowserJourney();
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.errors.push({ message: String(error), stack: error?.stack || '' });
} finally {
  report.finished_at = new Date().toISOString();
  report.passed = report.assertions.filter(item => item.passed).length;
  report.failed = report.assertions.filter(item => !item.passed).length + (report.status === 'failed' && report.assertions.every(item => item.passed) ? 1 : 0);
  fs.writeFileSync(path.join(OUT, 'acceptance.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'STATUS.txt'), `${report.status.toUpperCase()}\nrelease=${RELEASE}\npassed=${report.passed}\nfailed=${report.failed}\nfinished_at=${report.finished_at}\n`);
}

if (report.status !== 'passed') {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: report.status, passed: report.passed, failed: report.failed, report: path.join(OUT, 'acceptance.json') }, null, 2));
