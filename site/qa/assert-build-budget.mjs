import fs from 'node:fs/promises'
import path from 'node:path'

const distDirectory = path.resolve(process.argv[2] || 'dist')
const outputPath = path.resolve(process.argv[3] || 'qa-artifacts/build-budget.json')
const assetsDirectory = path.join(distDirectory, 'assets')

const entries = await fs.readdir(assetsDirectory, { withFileTypes: true })
const files = await Promise.all(
  entries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const filePath = path.join(assetsDirectory, entry.name)
      const stat = await fs.stat(filePath)
      return {
        name: entry.name,
        bytes: stat.size,
        kind: entry.name.endsWith('.js') ? 'javascript' : entry.name.endsWith('.css') ? 'css' : 'asset',
      }
    }),
)

const javascript = files.filter((file) => file.kind === 'javascript')
const css = files.filter((file) => file.kind === 'css')
const totals = {
  javascriptBytes: javascript.reduce((sum, file) => sum + file.bytes, 0),
  cssBytes: css.reduce((sum, file) => sum + file.bytes, 0),
  largestJavascriptChunkBytes: Math.max(0, ...javascript.map((file) => file.bytes)),
  largestCssChunkBytes: Math.max(0, ...css.map((file) => file.bytes)),
}

const limits = {
  javascriptBytes: 1_600_000,
  cssBytes: 500_000,
  largestJavascriptChunkBytes: 900_000,
  largestCssChunkBytes: 350_000,
}

const checks = Object.fromEntries(
  Object.entries(limits).map(([key, limit]) => [key, { value: totals[key], limit, pass: totals[key] <= limit }]),
)

const summary = {
  generatedAt: new Date().toISOString(),
  totals,
  limits,
  checks,
  files: files.sort((left, right) => right.bytes - left.bytes),
  pass: Object.values(checks).every((item) => item.pass),
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (!summary.pass) process.exitCode = 1
