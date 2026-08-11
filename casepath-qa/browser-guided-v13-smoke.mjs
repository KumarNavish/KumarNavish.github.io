import fs from 'node:fs/promises';

process.env.BASE_URL = 'https://casepath-swiss-claim-lab.onrender.com';

const sourceUrl = new URL('./browser-focused-v20.mjs', import.meta.url);
const runtimeUrl = new URL('./browser-focused-v20-production-runtime.mjs', import.meta.url);
const source = (await fs.readFile(sourceUrl, 'utf8'))
  .replace('data-kind="still-needed"', 'data-kind="needed"')
  .replace(
    "await page.waitForFunction(() => document.body.dataset.casepathRelease === '20.0.0', null, { timeout: 120000 });",
    "await page.waitForFunction(() => document.querySelector('meta[name=\"casepath-release\"]')?.content === '20.0.0' && document.querySelector('link[href$=\"live-v20-focus.css\"]'), null, { timeout: 120000 });",
  )
  .replace(
    "check('CasePath v20 is loaded', await page.evaluate(() => window.CASEPATH_EXPERIENCE_RELEASE === '20.0.0'));",
    "check('CasePath v20 is loaded', await page.evaluate(() => document.querySelector('meta[name=\"casepath-release\"]')?.content === '20.0.0' && Boolean(document.querySelector('link[href$=\"live-v20-focus.css\"]'))));",
  )
  .replace(
    '.decision-inspector[data-inspector-node="causation"]',
    '.decision-inspector[data-inspector-node]',
  );
await fs.writeFile(runtimeUrl, source);
await import(runtimeUrl.href);
