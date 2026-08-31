import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import App from './App.tsx'
import { WORK_REGISTRY, type WorkRegistryEntry } from './data/workRegistry'

const SITE_URL = 'https://kumarnavish.github.io'

interface RouteMeta {
  title: string
  description: string
  image: string
}

const STATIC_META: Record<string, RouteMeta> = {
  '/': {
    title: 'Navish Kumar | Machine-Learning Researcher and Systems Builder',
    description:
      'The motion-native portfolio of Navish Kumar: mathematical learning, continual adaptation, evidence-grounded agents, and spatial intelligence.',
    image: '/social/root.svg',
  },
  '/trajectory': {
    title: 'Research Trajectory | Navish Kumar',
    description:
      'Explore Navish Kumar’s intellectual trajectory from interaction evidence and spectral structure to continual learning, inspectable agents, and persistent worlds.',
    image: '/social/trajectory.svg',
  },
  '/work': {
    title: 'Complete Work | Navish Kumar',
    description:
      'The complete body of work of Navish Kumar, with verified status, native motion previews, direct evidence, and full project routes.',
    image: '/social/research.svg',
  },
  '/research': {
    title: 'Research Record | Navish Kumar',
    description:
      'Published, accepted, preprint, under-review, under-revision, and ongoing research by Navish Kumar, presented with explicit evidence boundaries.',
    image: '/social/research.svg',
  },
  '/systems': {
    title: 'Systems and Product Evidence | Navish Kumar',
    description:
      'Evidence-grounded systems, deterministic gates, inspectable agents, deployment architecture, and product work by Navish Kumar.',
    image: '/social/casepath.svg',
  },
  '/frontier': {
    title: 'Frontier Work | Navish Kumar',
    description:
      'Ongoing work on time-continual language models, replay value, persistent spatial worlds, and situated agents.',
    image: '/social/spatial.svg',
  },
  '/about': {
    title: 'About and Contact | Navish Kumar',
    description:
      'Navish Kumar is a machine-learning researcher and systems builder in Basel, Switzerland, working across optimization, continual learning, reliable agents, and spatial interfaces.',
    image: '/social/root.svg',
  },
  '/work/gain-graphs': {
    title: 'Interactive Gain-Graph Instrument | Navish Kumar',
    description:
      'Operate a complex unit gain graph and watch its cycles, Hermitian Laplacians, spectrum, eigenmodes, diffusion, and frustration certificate change together.',
    image: '/social/gain-graphs.svg',
  },
}

function socialImageForWork(work: WorkRegistryEntry): string {
  if (work.id.includes('gain-laplacian')) return '/social/gain-graphs.svg'
  if (work.id === 'experience-replay-optimization') return '/social/replay.svg'
  if (work.id === 'rank-feasibility') return '/social/rank.svg'
  if (work.id === 'ticlm-replay-value') return '/social/ticlm.svg'
  if (work.id === 'casepath') return '/social/casepath.svg'
  if (work.id === 'spatial-intelligence') return '/social/spatial.svg'
  return '/social/research.svg'
}

function metaForPath(pathname: string): RouteMeta {
  const staticMeta = STATIC_META[pathname]
  if (staticMeta) return staticMeta
  const work = WORK_REGISTRY.find((candidate) => candidate.route === pathname)
  if (work) {
    return {
      title: `${work.shortTitle} | Navish Kumar`,
      description: `${work.question} ${work.contribution}`,
      image: socialImageForWork(work),
    }
  }
  return STATIC_META['/']
}

function setMeta(selector: string, attributes: Record<string, string>, value: string): void {
  let node = document.head.querySelector<HTMLMetaElement>(selector)
  if (!node) {
    node = document.createElement('meta')
    for (const [name, attributeValue] of Object.entries(attributes)) node.setAttribute(name, attributeValue)
    document.head.appendChild(node)
  }
  node.setAttribute('content', value)
}

function setCanonical(url: string): void {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = url
}

function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Navish Kumar',
    url: SITE_URL,
    email: 'mailto:navish.kumar@unibas.ch',
    homeLocation: { '@type': 'Place', name: 'Basel, Switzerland' },
    jobTitle: 'Machine-Learning Researcher and Systems Builder',
    sameAs: [
      'https://github.com/KumarNavish',
      'https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en',
      'https://openreview.net/profile?id=~Navish_Kumar1',
    ],
    knowsAbout: [
      'Machine learning',
      'Optimization',
      'Continual learning',
      'Spectral graph theory',
      'Evidence-grounded agents',
      'Spatial computing',
    ],
  }
}

function workJsonLd(work: WorkRegistryEntry) {
  const type = work.type === 'paper' ? 'ScholarlyArticle' : work.type === 'system' ? 'SoftwareApplication' : 'CreativeWork'
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: work.title,
    headline: work.question,
    description: work.contribution,
    datePublished: work.date,
    dateModified: work.updatedAt,
    url: `${SITE_URL}${work.route}`,
    author: [
      { '@type': 'Person', name: 'Navish Kumar', url: SITE_URL },
      ...work.coauthors.map((name) => ({ '@type': 'Person', name })),
    ],
    isPartOf: { '@type': 'WebSite', name: 'Navish Kumar Portfolio', url: SITE_URL },
    sameAs: work.evidence.filter((item) => item.public).map((item) => item.url),
    keywords: work.themes.join(', '),
  }
}

function pageJsonLd(pathname: string) {
  const work = WORK_REGISTRY.find((candidate) => candidate.route === pathname)
  if (work) return [personJsonLd(), workJsonLd(work)]
  if (pathname === '/') {
    return [
      personJsonLd(),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Major work by Navish Kumar',
        itemListElement: WORK_REGISTRY.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE_URL}${item.route}`,
          name: item.title,
        })),
      },
    ]
  }
  return [
    personJsonLd(),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: metaForPath(pathname).title,
      description: metaForPath(pathname).description,
      url: `${SITE_URL}${pathname}`,
      isPartOf: { '@type': 'WebSite', name: 'Navish Kumar Portfolio', url: SITE_URL },
    },
  ]
}

function updateRouteMetadata(pathname: string): void {
  const meta = metaForPath(pathname)
  const canonicalUrl = `${SITE_URL}${pathname === '/' ? '/' : pathname}`
  const imageUrl = `${SITE_URL}${meta.image}`
  document.title = meta.title
  document.documentElement.lang = 'en'
  setMeta('meta[name="description"]', { name: 'description' }, meta.description)
  setMeta('meta[property="og:type"]', { property: 'og:type' }, pathname.startsWith('/work/') ? 'article' : 'website')
  setMeta('meta[property="og:title"]', { property: 'og:title' }, meta.title)
  setMeta('meta[property="og:description"]', { property: 'og:description' }, meta.description)
  setMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
  setMeta('meta[property="og:image"]', { property: 'og:image' }, imageUrl)
  setMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image')
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, meta.title)
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, meta.description)
  setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, imageUrl)
  setCanonical(canonicalUrl)

  let structuredData = document.getElementById('portfolio-route-jsonld') as HTMLScriptElement | null
  if (!structuredData) {
    structuredData = document.createElement('script')
    structuredData.id = 'portfolio-route-jsonld'
    structuredData.type = 'application/ld+json'
    document.head.appendChild(structuredData)
  }
  structuredData.textContent = JSON.stringify(pageJsonLd(pathname))
}

export function RoutedApplication() {
  const location = useLocation()

  useEffect(() => {
    updateRouteMetadata(location.pathname)
    const queryChapter = new URLSearchParams(location.search).get('chapter')
    const targetId = location.hash ? location.hash.slice(1) : queryChapter
    const frame = window.requestAnimationFrame(() => {
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.pathname, location.search])

  return <App />
}
