import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const API_URL = (process.env.API_URL || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
const EXPECTED_PRIMARY_SHA256 = '6a3f2cbeb270c21628f0d814d852895dbcff5e0cc8cf04502ca7d5cd7dfba732';
const OUT = 'photo-qa-out';

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const demoResponse = await fetch(`${API_URL}/api/demo?photoqa=${Date.now()}`, { cache: 'no-store' });
  if (!demoResponse.ok) throw new Error(`Demo request returned ${demoResponse.status}`);
  const demo = await demoResponse.json();
  const artifacts = demo.claim?.artifacts || demo.claim?.attachments || [];
  const primary = artifacts.find(item => item.artifact_id === 'art_photo');
  const laterDemo = await fetch(`${API_URL}/api/claims/DEMO-MOULD-002?photoqa=${Date.now()}`, { cache: 'no-store' });
  const laterPayload = laterDemo.ok ? await laterDemo.json() : null;
  const laterArtifacts = laterPayload?.claim?.artifacts || laterPayload?.artifacts || [];
  const later = laterArtifacts.find(item => item.artifact_id === 'art_later_photo');
  if (!primary) throw new Error(`art_photo was not present in the demo claim: ${JSON.stringify(artifacts)}`);

  async function inspect(item) {
    const response = await fetch(`${API_URL}/api/artifacts/${item.artifact_id}?photoqa=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${item.artifact_id} returned ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return {
      artifact_id: item.artifact_id,
      filename: item.filename,
      content_type: response.headers.get('content-type'),
      size_bytes: bytes.length,
      sha256,
      jpeg_signature: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9,
    };
  }

  const primaryResult = await inspect(primary);
  if (primaryResult.sha256 !== EXPECTED_PRIMARY_SHA256) {
    throw new Error(`The deployed flagship photograph is not the verified photographic source. expected=${EXPECTED_PRIMARY_SHA256} actual=${primaryResult.sha256}`);
  }
  if (!primaryResult.jpeg_signature || primaryResult.size_bytes < 100000) {
    throw new Error(`The deployed flagship evidence is not a substantial JPEG: ${JSON.stringify(primaryResult)}`);
  }

  let laterResult = null;
  if (later) {
    laterResult = await inspect(later);
    if (!laterResult.jpeg_signature || laterResult.size_bytes < 80000) {
      throw new Error(`The later-claim evidence is not a substantial JPEG: ${JSON.stringify(laterResult)}`);
    }
    if (laterResult.sha256 === primaryResult.sha256) {
      throw new Error('The later-claim photograph is byte-identical to the flagship evidence.');
    }
  }

  const report = {
    status: 'passed',
    checked_at: new Date().toISOString(),
    api_url: API_URL,
    primary: primaryResult,
    later: laterResult,
  };
  await fs.writeFile(`${OUT}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><title>CasePath photographic evidence gate</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 24px;color:#142033}code{background:#f3f5f8;padding:2px 5px;border-radius:4px}</style><h1>Photographic evidence gate: passed</h1><p>The deployed flagship image matches the verified photographic source.</p><pre>${JSON.stringify(report, null, 2)}</pre>`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async error => {
  await fs.mkdir(OUT, { recursive: true });
  const report = { status: 'failed', checked_at: new Date().toISOString(), api_url: API_URL, error: error.stack || String(error) };
  await fs.writeFile(`${OUT}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.error(report.error);
  process.exitCode = 1;
});
