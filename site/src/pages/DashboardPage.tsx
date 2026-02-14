import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchLatestRunApi,
  fetchProfileApi,
  fetchProjectsApi,
  fetchPublicationsApi,
} from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>>
}

interface DirectionCard {
  title: string
  framing: string
  question: string
  keywords: string[]
}

const DIRECTIONS: DirectionCard[] = [
  {
    title: 'Reliable Learning',
    framing: 'Optimization and inference that remain stable during continual updates.',
    question: 'How do we improve reliability without losing learning speed?',
    keywords: ['natural-gradient', 'optimization', 'spectral', 'laplacian'],
  },
  {
    title: 'Urban Decision Systems',
    framing: 'Operational models for logistics transitions in real city constraints.',
    question: 'How do we evaluate sustainable operations with measurable evidence?',
    keywords: ['urban', 'logistics', 'delivery', 'spatial'],
  },
  {
    title: 'Interaction Safety',
    framing: 'Empirical analysis of harmful and protective behavior in online systems.',
    question: 'Which signals separate harm amplification from harm reduction?',
    keywords: ['hate', 'counterspeech', 'social', 'twitter'],
  },
]

function includesAny(value: string, keywords: string[]): boolean {
  const normalized = value.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

export function DashboardPage() {
  const loadDashboard = useCallback(
    () =>
      Promise.all([
        fetchProfileApi(),
        fetchProjectsApi(),
        fetchPublicationsApi(),
        fetchLatestRunApi(),
      ]).then(([profile, projects, publications, latestRun]) => ({
        profile,
        projects,
        publications,
        latestRun,
      })),
    [],
  )

  const state = useResource<DashboardData>(loadDashboard)

  const topPublication = useMemo(() => {
    if (!state.data) {
      return null
    }
    return state.data.publications.items
      .slice()
      .sort((left, right) => (right.citation_count ?? 0) - (left.citation_count ?? 0))[0]
  }, [state.data])

  const latestPublication = useMemo(() => {
    if (!state.data) {
      return null
    }
    return state.data.publications.items
      .slice()
      .sort((left, right) => (right.year ?? 0) - (left.year ?? 0))[0]
  }, [state.data])

  const flagshipProject = useMemo(() => {
    if (!state.data) {
      return null
    }
    const profileFeatured = state.data.profile.featured.projects[0]
    if (profileFeatured) {
      return profileFeatured
    }

    const projectFeatured = state.data.projects.items.find(
      (project) => project.featured || project.pinned,
    )
    if (!projectFeatured) {
      return null
    }

    return {
      name: projectFeatured.name,
      one_line: projectFeatured.one_line,
      html_url: projectFeatured.html_url,
      demo_url: projectFeatured.demo_url,
    }
  }, [state.data])

  const directionEvidence = useMemo(() => {
    const data = state.data
    if (!data) {
      return []
    }

    return DIRECTIONS.map((direction) => {
      const publicationCount = data.publications.items.filter((publication) =>
        includesAny(
          `${publication.title} ${publication.summary ?? ''} ${(publication.keywords ?? []).join(' ')}`,
          direction.keywords,
        ),
      ).length

      const projectCount = data.projects.items.filter((project) =>
        includesAny(
          `${project.name} ${project.description ?? ''} ${(project.tags ?? []).join(' ')}`,
          direction.keywords,
        ),
      ).length

      return {
        ...direction,
        publicationCount,
        projectCount,
      }
    })
  }, [state.data])

  const publicationWindow = useMemo(() => {
    if (!state.data) {
      return 'n/a'
    }
    const years = state.data.publications.items
      .map((publication) => publication.year)
      .filter((year): year is number => typeof year === 'number')
      .sort((left, right) => left - right)

    if (years.length === 0) {
      return 'n/a'
    }

    return years[0] === years[years.length - 1]
      ? String(years[0])
      : `${years[0]}-${years[years.length - 1]}`
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading overview." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load overview."
        details={state.error ?? 'unknown overview error'}
      />
    )
  }

  const { profile, latestRun } = state.data
  const runUrl = latestRun.run.action_run_url

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Overview</p>
        <h1>Research that moves from mathematical framing to deployable systems.</h1>
        <p className="hero-copy">
          I work at the intersection of optimization, real-world operations, and social-system
          safety.
        </p>
        <div className="pill-row" aria-label="Core working style">
          <span className="pill">Think in structures</span>
          <span className="pill">Build executable artifacts</span>
          <span className="pill">Validate on real constraints</span>
        </div>
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            Explore case studies
          </Link>
          <Link className="action-link" to="/proof">
            Verify execution evidence
          </Link>
          <a className="action-link" href={profile.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </section>

      <section className="metric-grid" aria-label="At a glance">
        <article className="metric-card">
          <p className="metric-label">Publications</p>
          <p className="metric-value">{formatNumber(profile.counts.publications)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Citations</p>
          <p className="metric-value">{formatNumber(profile.counts.citations_total)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Projects</p>
          <p className="metric-value">{formatNumber(profile.counts.projects)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Publication Window</p>
          <p className="metric-value">{publicationWindow}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Research Arc</h2>
        </header>
        <div className="direction-grid">
          {directionEvidence.map((direction) => (
            <article key={direction.title} className="direction-card">
              <h3>{direction.title}</h3>
              <p>{direction.framing}</p>
              <p className="meta-line">
                <strong>Driving question:</strong> {direction.question}
              </p>
              <p className="direction-kpi">
                {direction.publicationCount} papers · {direction.projectCount} systems
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Anchor Outputs</h2>
        </header>
        <div className="card-grid">
          {topPublication ? (
            <article className="item-card">
              <p className="eyebrow">Influence</p>
              <h3>{topPublication.title}</h3>
              <p>{topPublication.venue ?? 'Publication venue unavailable'}</p>
              <p className="meta-line">
                {formatNumber(topPublication.citation_count)} citations
                {topPublication.url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={topPublication.url} target="_blank" rel="noreferrer">
                      Read paper
                    </a>
                  </>
                ) : null}
              </p>
            </article>
          ) : null}

          {latestPublication && latestPublication.id !== topPublication?.id ? (
            <article className="item-card">
              <p className="eyebrow">Latest</p>
              <h3>{latestPublication.title}</h3>
              <p>
                {latestPublication.venue ?? 'Publication venue unavailable'}
                {latestPublication.year ? ` · ${latestPublication.year}` : ''}
              </p>
              {latestPublication.url ? (
                <p className="meta-line">
                  <a href={latestPublication.url} target="_blank" rel="noreferrer">
                    Open publication
                  </a>
                </p>
              ) : null}
            </article>
          ) : null}

          {flagshipProject ? (
            <article className="item-card">
              <p className="eyebrow">Flagship Build</p>
              <h3>{flagshipProject.name}</h3>
              <p>{flagshipProject.one_line ?? 'Production-oriented system linked to research.'}</p>
              <p className="meta-line">
                <a
                  href={flagshipProject.demo_url ?? flagshipProject.html_url ?? '/work'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open system
                </a>
              </p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Reading Sequence</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">01</p>
            <h3>Case Studies</h3>
            <p>Start with the compact question-build-evidence breakdown.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">02</p>
            <h3>Archives</h3>
            <p>Open full project and publication records only when needed.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">03</p>
            <h3>Execution Proof</h3>
            <p>Inspect provenance, pipeline runs, and deploy artifacts.</p>
          </article>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Last synchronized {formatDateTime(profile.last_sync.last_run_timestamp)} · Pipeline{' '}
          {latestRun.run.status}
          {runUrl ? (
            <>
              {' '}
              ·{' '}
              <a href={runUrl} target="_blank" rel="noreferrer">
                latest workflow
              </a>
            </>
          ) : null}
        </p>
      </section>
    </div>
  )
}
