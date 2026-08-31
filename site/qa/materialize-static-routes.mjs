import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const SITE_URL = 'https://kumarnavish.github.io'
const siteDirectory = path.resolve(process.cwd())
const distDirectory = path.join(siteDirectory, 'dist')
const registrySourcePath = path.join(siteDirectory, 'src/data/workRegistry.ts')
const rootHtmlPath = path.join(distDirectory, 'index.html')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;')
}

function absoluteUrl(route) {
  return `${SITE_URL}${route === '/' ? '/' : route}`
}

function socialImageForWork(work) {
  if (work.id.includes('gain-laplacian')) return '/social/gain-graphs.svg'
  if (work.id === 'experience-replay-optimization') return '/social/replay.svg'
  if (work.id === 'rank-feasibility') return '/social/rank.svg'
  if (work.id === 'ticlm-replay-value') return '/social/ticlm.svg'
  if (work.id === 'casepath') return '/social/casepath.svg'
  if (work.id === 'spatial-intelligence') return '/social/spatial.svg'
  return '/social/research.svg'
}

async function loadRegistry() {
  const source = await fs.readFile(registrySourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    fileName: registrySourcePath,
    reportDiagnostics: true,
  })
  const errors = (transpiled.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  )
  if (errors.length) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => siteDirectory,
      getNewLine: () => '\n',
    })
    throw new Error(`Unable to transpile work registry:\n${formatted}`)
  }
  const temporaryModule = path.join(siteDirectory, '.work-registry.build.mjs')
  await fs.writeFile(temporaryModule, transpiled.outputText)
  try {
    const module = await import(`${pathToFileURL(temporaryModule).href}?v=${Date.now()}`)
    if (!Array.isArray(module.WORK_REGISTRY)) throw new Error('WORK_REGISTRY export is missing')
    return module.WORK_REGISTRY
  } finally {
    await fs.rm(temporaryModule, { force: true })
  }
}

function replaceMeta(html, attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapedKey}["'][^>]*>`, 'i')
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function replaceCanonical(html, value) {
  const tag = `<link rel="canonical" href="${escapeHtml(value)}" />`
  const pattern = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function renderRouteHtml(rootHtml, route) {
  const canonical = absoluteUrl(route.canonicalPath || route.path)
  const image = `${SITE_URL}${route.image}`
  let html = rootHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`)
  html = replaceMeta(html, 'name', 'description', route.description)
  html = replaceMeta(html, 'property', 'og:type', route.kind === 'work' ? 'article' : 'website')
  html = replaceMeta(html, 'property', 'og:url', canonical)
  html = replaceMeta(html, 'property', 'og:title', route.title)
  html = replaceMeta(html, 'property', 'og:description', route.description)
  html = replaceMeta(html, 'property', 'og:image', image)
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image')
  html = replaceMeta(html, 'name', 'twitter:title', route.title)
  html = replaceMeta(html, 'name', 'twitter:description', route.description)
  html = replaceMeta(html, 'name', 'twitter:image', image)
  html = replaceCanonical(html, canonical)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': route.kind === 'work' ? route.schemaType : 'WebPage',
    name: route.title,
    headline: route.question || route.title,
    description: route.description,
    url: canonical,
    datePublished: route.date,
    dateModified: route.updatedAt,
    author: { '@type': 'Person', name: 'Navish Kumar', url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: 'Navish Kumar Portfolio', url: SITE_URL },
    sameAs: route.sameAs || [],
    keywords: route.themes?.join(', '),
  }
  html = html.replace(
    '</head>',
    `    <script id="portfolio-static-jsonld" type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>\n  </head>`,
  )
  return html
}

function workRoute(work) {
  return {
    path: work.route,
    canonicalPath: work.route,
    kind: 'work',
    schemaType:
      work.type === 'paper'
        ? 'ScholarlyArticle'
        : work.type === 'system'
          ? 'SoftwareApplication'
          : 'CreativeWork',
    title: `${work.shortTitle} | Navish Kumar`,
    description: `${work.question} ${work.contribution}`,
    question: work.question,
    image: socialImageForWork(work),
    date: work.date,
    updatedAt: work.updatedAt,
    themes: work.themes,
    sameAs: work.evidence.filter((item) => item.public).map((item) => item.url),
  }
}

const staticRoutes = [
  {
    path: '/trajectory',
    title: 'Research Trajectory | Navish Kumar',
    description:
      'Explore Navish Kumar’s intellectual trajectory from interaction evidence and spectral structure to continual learning, inspectable agents, and persistent worlds.',
    image: '/social/trajectory.svg',
  },
  {
    path: '/work',
    title: 'Complete Work | Navish Kumar',
    description:
      'The complete body of work of Navish Kumar, with verified status, native motion previews, direct evidence, and full project routes.',
    image: '/social/research.svg',
  },
  {
    path: '/research',
    title: 'Research Record | Navish Kumar',
    description:
      'Published, accepted, preprint, under-review, under-revision, and ongoing research by Navish Kumar, presented with explicit evidence boundaries.',
    image: '/social/research.svg',
  },
  {
    path: '/systems',
    title: 'Systems and Product Evidence | Navish Kumar',
    description:
      'Evidence-grounded systems, deterministic gates, inspectable agents, deployment architecture, and product work by Navish Kumar.',
    image: '/social/casepath.svg',
  },
  {
    path: '/frontier',
    title: 'Frontier Work | Navish Kumar',
    description:
      'Ongoing work on time-continual language models, replay value, persistent spatial worlds, and situated agents.',
    image: '/social/spatial.svg',
  },
  {
    path: '/about',
    title: 'About and Contact | Navish Kumar',
    description:
      'Navish Kumar is a machine-learning researcher and systems builder in Basel, Switzerland, working across optimization, continual learning, reliable agents, and spatial interfaces.',
    image: '/social/root.svg',
  },
  {
    path: '/work/gain-graphs',
    kind: 'work',
    schemaType: 'SoftwareApplication',
    title: 'Interactive Gain-Graph Instrument | Navish Kumar',
    description:
      'Operate a complex unit gain graph and watch its cycles, Hermitian Laplacians, spectrum, eigenmodes, diffusion, and frustration certificate change together.',
    question: 'How does one phase perturbation propagate through an entire gain-graph operator?',
    image: '/social/gain-graphs.svg',
    themes: ['spectral graph theory', 'interactive scientific computing'],
  },
]

const aliasTargets = {
  '/research/graph-laplacians': '/work/gain-graphs',
  '/research/natural-gradient-vi': '/work/square-root-natural-gradient',
  '/research/experience-replay-optimization': '/work/experience-replay-optimization',
  '/research/rank-feasibility': '/work/rank-feasibility',
  '/research/ticlm': '/work/ticlm-replay-value',
  '/research/urban-logistics': '/work/urban-microregion-logistics',
  '/research/counterspeech': '/work/counterspeech-dynamics',
  '/systems/casepath': '/work/casepath',
  '/research/spatial-intelligence': '/work/spatial-intelligence',
  '/projects': '/work',
  '/publications': '/research',
  '/experience': '/trajectory',
}

const registry = await loadRegistry()
const routeRecords = [...staticRoutes, ...registry.map(workRoute)]
const canonicalByPath = new Map(routeRecords.map((route) => [route.path, route]))
const aliases = Object.entries(aliasTargets).map(([pathName, target]) => ({
  ...(canonicalByPath.get(target) || {
    title: 'Navish Kumar | Research and Systems',
    description: 'Motion-native research explanations and evidence-backed systems by Navish Kumar.',
    image: '/social/root.svg',
  }),
  path: pathName,
  canonicalPath: target,
  kind: 'page',
}))
const allRoutes = [...routeRecords, ...aliases]
const rootHtml = await fs.readFile(rootHtmlPath, 'utf8')

for (const route of allRoutes) {
  const directory = path.join(distDirectory, route.path.replace(/^\//, ''))
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'index.html'), renderRouteHtml(rootHtml, route))
}

const publicRegistry = registry.map((work) => ({
  id: work.id,
  route: work.route,
  title: work.title,
  shortTitle: work.shortTitle,
  date: work.date,
  dateLabel: work.dateLabel,
  year: work.year,
  period: work.period,
  type: work.type,
  researchStatus: work.researchStatus,
  researchStatusLabel: work.researchStatusLabel,
  experienceStatus: work.experienceStatus,
  experienceStatusLabel: work.experienceStatusLabel,
  question: work.question,
  contribution: work.contribution,
  limitation: work.limitation,
  nextQuestion: work.nextQuestion,
  themes: work.themes,
  relations: work.relations,
  evidence: work.evidence.filter((item) => item.public),
  updatedAt: work.updatedAt,
}))
await fs.mkdir(path.join(distDirectory, 'data'), { recursive: true })
await fs.writeFile(
  path.join(distDirectory, 'data/work-registry.json'),
  JSON.stringify({ schema: 'portfolio-work-registry/v1', works: publicRegistry }, null, 2),
)
await fs.writeFile(
  path.join(distDirectory, 'route-manifest.json'),
  JSON.stringify(
    {
      schema: 'portfolio-route-manifest/v1',
      routes: allRoutes.map((route) => ({
        path: route.path,
        canonicalPath: route.canonicalPath || route.path,
        title: route.title,
        description: route.description,
      })),
    },
    null,
    2,
  ),
)

const sitemapRoutes = ['/', ...routeRecords.map((route) => route.path)]
const updatedAtByRoute = new Map(registry.map((work) => [work.route, work.updatedAt]))
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes
  .map((route) => {
    const lastmod = updatedAtByRoute.get(route)
    return `  <url><loc>${escapeXml(absoluteUrl(route))}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}</url>`
  })
  .join('\n')}\n</urlset>\n`
await fs.writeFile(path.join(distDirectory, 'sitemap.xml'), sitemap)

console.log(`Materialized ${allRoutes.length} static route documents and ${registry.length} registry records.`)
