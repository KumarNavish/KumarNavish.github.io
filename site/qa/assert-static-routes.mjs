import fs from 'node:fs/promises'
import path from 'node:path'

const distDirectory = path.resolve(process.argv[2] || 'dist')
const outputPath = path.resolve(process.argv[3] || 'qa-artifacts/static-routes.json')
const manifest = JSON.parse(await fs.readFile(path.join(distDirectory, 'route-manifest.json'), 'utf8'))
const registry = JSON.parse(await fs.readFile(path.join(distDirectory, 'data/work-registry.json'), 'utf8'))
const sitemap = await fs.readFile(path.join(distDirectory, 'sitemap.xml'), 'utf8')

const results = []
for (const route of manifest.routes) {
  const documentPath = path.join(distDirectory, route.path.replace(/^\//, ''), 'index.html')
  const html = await fs.readFile(documentPath, 'utf8')
  const canonical = `https://kumarnavish.github.io${route.canonicalPath}`
  const checks = {
    file: true,
    title: html.includes(`<title>${route.title.replaceAll('&', '&amp;')}</title>`) || /<title>[^<]+<\/title>/.test(html),
    description: /<meta name="description" content=".{40,}" \/>/.test(html),
    canonical: html.includes(`<link rel="canonical" href="${canonical}" />`),
    openGraph: html.includes(`property="og:url" content="${canonical}"`),
    socialImage: /property="og:image" content="https:\/\/kumarnavish\.github\.io\/social\/[^" ]+\.svg"/.test(html),
    structuredData: html.includes('id="portfolio-static-jsonld"'),
    applicationEntry: /<script[^>]+type="module"[^>]+src="\/assets\//.test(html),
  }
  results.push({ route: route.path, canonicalPath: route.canonicalPath, documentPath, checks, pass: Object.values(checks).every(Boolean) })
}

const canonicalRoutes = manifest.routes.filter((route) => route.path === route.canonicalPath)
const sitemapMissing = canonicalRoutes
  .filter((route) => !sitemap.includes(`<loc>https://kumarnavish.github.io${route.path}</loc>`))
  .map((route) => route.path)
const registryRoutes = new Set(registry.works.map((work) => work.route))
const manifestRoutes = new Set(manifest.routes.map((route) => route.path))
const registryMissing = [...registryRoutes].filter((route) => !manifestRoutes.has(route))
const duplicateRoutes = manifest.routes
  .map((route) => route.path)
  .filter((route, index, routes) => routes.indexOf(route) !== index)

const summary = {
  generatedAt: new Date().toISOString(),
  routeCount: manifest.routes.length,
  registryWorkCount: registry.works.length,
  results,
  sitemapMissing,
  registryMissing,
  duplicateRoutes: [...new Set(duplicateRoutes)],
  pass:
    results.every((result) => result.pass) &&
    sitemapMissing.length === 0 &&
    registryMissing.length === 0 &&
    duplicateRoutes.length === 0,
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (!summary.pass) process.exitCode = 1
