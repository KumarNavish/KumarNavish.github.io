import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchProfileApi,
  fetchProjectsApi,
  fetchPublicationsApi,
  type PublicationItem,
} from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface WorkData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface ArcDefinition {
  id: string
  title: string
  lens: string
  tags: string[]
  keywords: string[]
}

const ARC_DEFINITIONS: ArcDefinition[] = [
  {
    id: 'reliable-learning',
    title: 'Reliable Learning',
    lens: 'Mathematical structure for stable optimization and inference.',
    tags: ['continual-learning', 'optimization', 'neural-policies'],
    keywords: ['natural gradients', 'optimization guarantees', 'spectral'],
  },
  {
    id: 'urban-systems',
    title: 'Urban Systems',
    lens: 'Operational AI for sustainable and interpretable logistics.',
    tags: ['urban-ai', 'sustainable-logistics', 'spatial-modeling'],
    keywords: ['urban ai', 'sustainable logistics', 'spatial modeling'],
  },
  {
    id: 'social-resilience',
    title: 'Social Resilience',
    lens: 'Evidence on harmful and protective interaction dynamics.',
    tags: ['social-computing', 'counterspeech', 'moderation-policy'],
    keywords: ['social computing', 'counterspeech', 'hate speech'],
  },
]

const PROJECT_IMPACT_HINTS: Record<string, string> = {
  'CL-PLO':
    'Turns continual-learning ideas into testable optimization behavior.',
  'KumarNavish.github.io':
    'Turns research curation into a reproducible public data product.',
}

function publicationSummary(publication: PublicationItem): string {
  if (publication.summary) {
    return publication.summary
  }
  const venue = publication.venue ?? 'Publication venue'
  return `${venue}${publication.year ? ` (${publication.year})` : ''}`
}

export function WorkPage() {
  const loadWork = useCallback(
    () =>
      Promise.all([fetchProfileApi(), fetchProjectsApi(), fetchPublicationsApi()]).then(
        ([profile, projects, publications]) => ({
          profile,
          projects,
          publications,
        }),
      ),
    [],
  )
  const state = useResource<WorkData>(loadWork)

  const arcCards = useMemo(() => {
    const data = state.data
    if (!data) {
      return []
    }

    return ARC_DEFINITIONS.map((arc) => {
      const projectCount = data.projects.items.filter((project) =>
        arc.tags.some((tag) => project.tags.includes(tag)),
      ).length

      const publicationCount = data.publications.items.filter((publication) => {
        const searchable = `${publication.title} ${(publication.keywords ?? []).join(' ')}`
          .toLowerCase()
        return arc.keywords.some((keyword) => searchable.includes(keyword))
      }).length

      return {
        ...arc,
        projectCount,
        publicationCount,
      }
    })
  }, [state.data])

  const featuredProjects = useMemo(() => {
    if (!state.data) {
      return []
    }

    const fromProfile = state.data.profile.featured.projects
    if (fromProfile.length > 0) {
      return fromProfile.slice(0, 4)
    }

    return state.data.projects.items
      .filter((project) => project.featured)
      .slice(0, 4)
      .map((project) => ({
        name: project.name,
        one_line: project.one_line,
        html_url: project.html_url,
        demo_url: project.demo_url,
        stars: project.stars,
      }))
  }, [state.data])

  const publicationById = useMemo(() => {
    if (!state.data) {
      return new Map<string, PublicationItem>()
    }
    return new Map(
      state.data.publications.items.map((publication) => [publication.id, publication]),
    )
  }, [state.data])

  const highlightedPublications = useMemo(() => {
    if (!state.data) {
      return []
    }

    const fromProfile = state.data.profile.featured.publications
      .slice(0, 4)
      .map((item) => {
        const expanded = item.id ? publicationById.get(item.id) : null
        return {
          ...item,
          summary: expanded ? publicationSummary(expanded) : null,
        }
      })

    if (fromProfile.length > 0) {
      return fromProfile
    }

    return state.data.publications.items
      .slice()
      .sort((left, right) => (right.citation_count ?? 0) - (left.citation_count ?? 0))
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        title: item.title,
        year: item.year,
        venue: item.venue,
        citation_count: item.citation_count,
        url: item.url,
        summary: publicationSummary(item),
      }))
  }, [publicationById, state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading work overview from generated APIs." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load work overview."
        details={state.error ?? 'unknown work page error'}
      />
    )
  }

  const { profile } = state.data

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Work</p>
        <h1>What I build, and why it matters</h1>
        <p className="hero-copy">
          This page is intentionally curated: the main research arcs, the flagship
          systems, and the publications that shaped the trajectory.
        </p>
      </section>

      <section id="arcs" className="panel">
        <header className="panel-header">
          <h2>Research Arcs</h2>
        </header>
        <div className="card-grid">
          {arcCards.map((arc) => (
            <article key={arc.id} className="item-card">
              <h3>{arc.title}</h3>
              <p>{arc.lens}</p>
              <p className="meta-line">
                {arc.projectCount} project signals · {arc.publicationCount} publication signals
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="systems" className="panel">
        <header className="panel-header">
          <h2>Flagship Systems</h2>
        </header>
        <div className="card-grid">
          {featuredProjects.map((project) => (
            <article key={project.name} className="item-card">
              <h3>{project.name}</h3>
              <p>{project.one_line ?? 'Focused technical system with measurable outputs.'}</p>
              <p className="meta-line">
                Why it matters:{' '}
                {PROJECT_IMPACT_HINTS[project.name] ??
                  'Bridges technical ideas to a deployable evaluation surface.'}
              </p>
              <p className="meta-line">
                Stars {formatNumber(project.stars)} ·{' '}
                <a
                  href={project.html_url ?? '/work'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Code
                </a>
                {project.demo_url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={project.demo_url} target="_blank" rel="noreferrer">
                      Live demo
                    </a>
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="papers" className="panel">
        <header className="panel-header">
          <h2>Selected Publications</h2>
        </header>
        <div className="stack-list">
          {highlightedPublications.map((publication) => (
            <article key={publication.id ?? publication.title} className="stack-item">
              <h3>{publication.title}</h3>
              <p className="meta-line">
                {(publication.venue ?? 'Unknown venue') +
                  (publication.year ? ` · ${publication.year}` : '')}
              </p>
              {publication.summary ? (
                <p className="meta-line">Why it matters: {publication.summary}</p>
              ) : null}
              <p className="meta-line">
                Citations {formatNumber(publication.citation_count)}
                {publication.url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={publication.url} target="_blank" rel="noreferrer">
                      Read
                    </a>
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Next Step</h2>
        </header>
        <p className="meta-line">
          If you need full breadth instead of curation, use the complete archives below.
        </p>
        <div className="action-row">
          <Link className="action-link" to="/projects">
            Full project archive
          </Link>
          <Link className="action-link" to="/publications">
            Full publication archive
          </Link>
          <Link className="action-link action-link-primary" to="/proof">
            Verify system proof
          </Link>
        </div>
        <p className="meta-line">
          Last curated sync: {formatDateTime(profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
