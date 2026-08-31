import fs from 'node:fs/promises'
import path from 'node:path'

const reportPath = path.resolve(process.argv[2] || 'qa-artifacts/lighthouse.json')
const outputPath = path.resolve(process.argv[3] || 'qa-artifacts/lighthouse-summary.json')
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))

const thresholds = {
  performance: 0.8,
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.9,
}

const categories = Object.fromEntries(
  Object.entries(thresholds).map(([key, threshold]) => {
    const score = report.categories?.[key]?.score
    if (typeof score !== 'number') throw new Error(`Lighthouse category ${key} is missing`)
    return [key, { score, threshold, pass: score >= threshold }]
  }),
)

const metrics = {
  firstContentfulPaintMs: report.audits?.['first-contentful-paint']?.numericValue ?? null,
  largestContentfulPaintMs: report.audits?.['largest-contentful-paint']?.numericValue ?? null,
  totalBlockingTimeMs: report.audits?.['total-blocking-time']?.numericValue ?? null,
  cumulativeLayoutShift: report.audits?.['cumulative-layout-shift']?.numericValue ?? null,
  speedIndexMs: report.audits?.['speed-index']?.numericValue ?? null,
}

const summary = {
  generatedAt: new Date().toISOString(),
  requestedUrl: report.requestedUrl,
  finalUrl: report.finalUrl,
  categories,
  metrics,
  pass: Object.values(categories).every((item) => item.pass),
}

await fs.writeFile(outputPath, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (!summary.pass) process.exitCode = 1
