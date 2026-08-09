import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const BASE_URL = (process.env.BASE_URL || 'https://casepath-v1203-preview.onrender.com').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
const EXPECTED_LOADER_RELEASE = process.env.EXPECTED_LOADER_RELEASE || '12.0.4';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30000);
const OUT = path.resolve('qa-out');

const checks = [];
const details = {};

function record(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
  if (!passed) throw new Error(`${name}: ${detail || 'failed'}`);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      ...options,
      signal: controller.signal,
      headers: {
        'user-agent': 'CasePath-public-release-gate/12.0.4',
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url) {
  const response = await request(url);
  const text = await response.text();
  record(`HTTP 200 ${url}`, response.status === 200, `status=${response.status}`);
  return { response, text };
}

async function getJson(url, options = {}) {
  const response = await request(url, options);
  const text = await response.text();
  record(`${options.method || 'GET'} ${url}`, response.ok, `status=${response.status}; body=${text.slice(0, 240)}`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}; body=${text.slice(0, 240)}`);
  }
}

function decodeRelease(parts) {
  const encoded = parts.join('').replace(/[^A-Za-z0-9+/]/g, '');
  if (!encoded) throw new Error('Release payload is empty');
  if (encoded.length % 4 === 1) throw new Error(`Impossible base64 length: ${encoded.length}`);
  const compressed = Buffer.from(encoded, 'base64');
  record('Release payload has gzip signature', compressed[0] === 0x1f && compressed[1] === 0x8b, `bytes=${compressed.length}`);
  const html = gunzipSync(compressed).toString('utf8');
  record('Decoded document is HTML', /^\s*<!doctype html>/i.test(html), html.slice(0, 80));
  record('Decoded document contains CasePath', html.includes('CasePath'));
  record('Decoded document contains flagship bootstrap', html.includes('flagship-v12-bootstrap'));
  record('Decoded document is not another loader', !html.includes('casepath-payload') && !html.includes("Failed to execute 'atob'"));
  return { encoded, compressed, html };
}

async function waitForRun(runId) {
  const deadline = Date.now() + 90000;
  let last;
  while (Date.now() < deadline) {
    last = await getJson(`${API_URL}/api/runs/${runId}`);
    if (last.status === 'complete' || last.status === 'failed') return last;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Run ${runId} did not finish; last=${JSON.stringify(last).slice(0, 500)}`);
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const rootUrl = `${BASE_URL}/?qa=${Date.now()}`;
  const { text: loader } = await getText(rootUrl);
  record('Loader identifies the repaired release', loader.includes(`data-casepath-loader-release="${EXPECTED_LOADER_RELEASE}"`));
  record('Loader requests exactly three bundle files', loader.includes('const PARTS = [0,1,2]'));
  record('Loader does not call atob', !loader.includes('atob('));
  record('Loader includes manual base64 validation', loader.includes('function decodeBase64'));

  const partPaths = [0, 1, 2].map(index => `assets/bundle-v12-${String(index).padStart(3, '0')}.txt`);
  const parts = [];
  for (const partPath of partPaths) {
    const { text } = await getText(`${BASE_URL}/${partPath}?qa=${Date.now()}`);
    record(`${partPath} is non-empty`, text.trim().length > 1000, `chars=${text.trim().length}`);
    parts.push(text);
  }
  const decoded = decodeRelease(parts);
  details.encodedCharacters = decoded.encoded.length;
  details.compressedBytes = decoded.compressed.length;
  details.decodedBytes = Buffer.byteLength(decoded.html);

  const linked = [...decoded.html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
  const localAssets = [...new Set(linked.filter(value => !/^(?:https?:|data:|#|mailto:)/.test(value)))];
  details.localAssets = localAssets;
  for (const asset of localAssets) {
    const clean = asset.split(/[?#]/, 1)[0].replace(/^\//, '');
    if (!clean) continue;
    const response = await request(`${BASE_URL}/${clean}?qa=${Date.now()}`);
    record(`Asset ${clean}`, response.status === 200, `status=${response.status}`);
  }

  const health = await getJson(`${API_URL}/healthz`);
  record('API health is ok', health.status === 'ok', JSON.stringify(health));
  const ready = await getJson(`${API_URL}/readyz`);
  record('API is ready', ready.status === 'ready', JSON.stringify(ready));
  const demo = await getJson(`${API_URL}/api/demo`);
  record('Demo claim is available', Boolean(demo.demo_claim_id && demo.claim), JSON.stringify(demo).slice(0, 240));
  record('Demo claim contains attachments', Array.isArray(demo.claim.attachments) && demo.claim.attachments.length > 0, `attachments=${demo.claim.attachments?.length}`);

  const attachment = demo.claim.attachments[0];
  if (attachment?.artifact_id) {
    const artifactResponse = await request(`${API_URL}/api/artifacts/${attachment.artifact_id}`);
    record('First source attachment opens', artifactResponse.status === 200, `status=${artifactResponse.status}; type=${artifactResponse.headers.get('content-type')}`);
    const extraction = await getJson(`${API_URL}/api/artifacts/${attachment.artifact_id}/extraction`);
    record('Machine extraction is separately available', extraction.artifact_id === attachment.artifact_id || extraction.id === attachment.artifact_id, JSON.stringify(extraction).slice(0, 200));
  }

  await getJson(`${API_URL}/api/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const created = await getJson(`${API_URL}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claim_id: demo.demo_claim_id }),
  });
  record('Analysis run was created', Boolean(created.run_id), JSON.stringify(created));
  const run = await waitForRun(created.run_id);
  record('Analysis run completed', run.status === 'complete', JSON.stringify(run).slice(0, 400));
  record('Analysis produced pipeline events', Array.isArray(run.events) && run.events.length >= 4, `events=${run.events?.length}`);
  record('Analysis produced a process', Boolean(run.result?.process || run.result?.process_graph || run.result?.current_blocker), JSON.stringify(run.result).slice(0, 320));
  record('Analysis produced evidence requirements', Boolean(run.result?.checklist || run.result?.evidence || run.result?.documents), JSON.stringify(run.result).slice(0, 320));
  record('Analysis returned three precedents', Array.isArray(run.result?.precedents) && run.result.precedents.length === 3, `precedents=${run.result?.precedents?.length}`);

  const review = await getJson(`${API_URL}/api/runs/${created.run_id}/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve_with_edit',
      building_envelope_mode: 'conditional',
      confidence: 0.91,
      justification: 'Public release gate: keep broader testing conditional on the neutral inspection.',
    }),
  });
  record('Expert review was accepted', Boolean(review), JSON.stringify(review).slice(0, 320));
  const knowledge = await getJson(`${API_URL}/api/knowledge`);
  record('Reviewed knowledge is readable', Boolean(knowledge), JSON.stringify(knowledge).slice(0, 320));
  const proof = await getJson(`${API_URL}/api/learning-proof`);
  record('Later-claim learning proof is available', Boolean(proof), JSON.stringify(proof).slice(0, 320));

  const report = {
    status: 'passed',
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiUrl: API_URL,
    expectedLoaderRelease: EXPECTED_LOADER_RELEASE,
    passed: checks.filter(check => check.passed).length,
    failed: checks.filter(check => !check.passed).length,
    checks,
    details,
    runId: created.run_id,
    demoClaimId: demo.demo_claim_id,
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>CasePath public release gate</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:0 20px;color:#142033}li{margin:8px 0}.ok{color:#087443}code{background:#f3f5f8;padding:2px 5px;border-radius:4px}</style><h1>CasePath public release gate: passed</h1><p><strong>${report.passed}</strong> checks passed against <code>${BASE_URL}</code> and <code>${API_URL}</code>.</p><ul>${checks.map(check => `<li class="ok">✓ ${check.name}</li>`).join('')}</ul>`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async error => {
  await fs.mkdir(OUT, { recursive: true });
  const report = {
    status: 'failed',
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiUrl: API_URL,
    expectedLoaderRelease: EXPECTED_LOADER_RELEASE,
    passed: checks.filter(check => check.passed).length,
    failed: checks.filter(check => !check.passed).length + 1,
    checks,
    error: error instanceof Error ? error.stack : String(error),
    details,
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(report.error);
  process.exitCode = 1;
});
