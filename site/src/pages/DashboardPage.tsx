import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { fetchProfileApi, fetchProjectsApi, fetchPublicationsApi } from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface FocusArea {
  title: string
  lens: string
  decision: string
}

const FOCUS_AREAS: FocusArea[] = [
  {
    title: 'Reliable Learning Systems',
    lens: 'Stability-first optimization under shifting objectives.',
    decision: 'How to update models over time without degrading reliability.',
  },
  {
    title: 'Urban Logistics Decisions',
    lens: 'Micro-region performance modeling from observed city behavior.',
    decision: 'Where cargo-bike transitions should start for highest operational fit.',
  },
  {
    title: 'Interaction Safety',
    lens: 'Behavioral dynamics between harmful and protective online actors.',
    decision: 'Which intervention patterns are likely to de-escalate harm.',
  },
]

export function DashboardPage() {
  const loadDashboard = useCallback(
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

    const featured = state.data.profile.featured.projects[0]
    if (featured) {
      return featured
    }

    const fallback = state.data.projects.items.find((project) => project.featured || project.pinned)
    if (!fallback) {
      return null
    }

    return {
      name: fallback.name,
      one_line: fallback.one_line,
      html_url: fallback.html_url,
      demo_url: fallback.demo_url,
    }
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

  const { profile } = state.data

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Overview</p>
        <h1>I build research that can be used to make better decisions.</h1>
        <p className="hero-copy">
          The structure is simple: decision context, implementation, and evidence. You can scan it
          quickly and verify details only where needed.
        </p>
        <div className="pill-row" aria-label="Working principles">
          <span className="pill">Precise framing</span>
          <span className="pill">Executable systems</span>
          <span className="pill">Applied outcomes</span>
        </div>
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            Review case studies
          </Link>
          <Link className="action-link" to="/proof">
            See impact cases
          </Link>
          <a className="action-link" href={profile.links.github} target="_blank" rel="noreferrer">
            View GitHub
          </a>
        </div>
      </section>

      <section className="metric-grid" aria-label="Snapshot">
        <article className="metric-card">
          <p className="metric-label">Papers</p>
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
          <p className="metric-label">Publication span</p>
          <p className="metric-value">{publicationWindow}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Research Focus</h2>
        </header>
        <div className="direction-grid">
          {FOCUS_AREAS.map((area) => (
            <article key={area.title} className="direction-card">
              <h3>{area.title}</h3>
              <p>{area.lens}</p>
              <p className="meta-line">
                <strong>Decision supported:</strong> {area.decision}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Evidence at a Glance</h2>
        </header>
        <div className="card-grid">
          {topPublication ? (
            <article className="item-card">
              <p className="eyebrow">Most cited paper</p>
              <h3>{topPublication.title}</h3>
              <p>{topPublication.venue ?? 'Venue unavailable'}</p>
              <p className="meta-line">
                {formatNumber(topPublication.citation_count)} citations
                {topPublication.url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={topPublication.url} target="_blank" rel="noreferrer">
                      Read
                    </a>
                  </>
                ) : null}
              </p>
            </article>
          ) : null}

          {latestPublication && latestPublication.id !== topPublication?.id ? (
            <article className="item-card">
              <p className="eyebrow">Latest paper</p>
              <h3>{latestPublication.title}</h3>
              <p>
                {latestPublication.venue ?? 'Venue unavailable'}
                {latestPublication.year ? ` · ${latestPublication.year}` : ''}
              </p>
              {latestPublication.url ? (
                <p className="meta-line">
                  <a href={latestPublication.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </p>
              ) : null}
            </article>
          ) : null}

          {flagshipProject ? (
            <article className="item-card">
              <p className="eyebrow">Flagship system</p>
              <h3>{flagshipProject.name}</h3>
              <p>{flagshipProject.one_line ?? 'Research implementation with reproducible setup.'}</p>
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
          <h2>Fast Review Path</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">01</p>
            <h3>Case studies</h3>
            <p>See how each problem is translated into a built system and evidence.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">02</p>
            <h3>Archives</h3>
            <p>Open full project and publication records when you need detail.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">03</p>
            <h3>Impact</h3>
            <p>See who can use the work, what they can decide, and why it matters.</p>
          </article>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Last refresh {formatDateTime(profile.last_sync.last_run_timestamp)} · Data sources:{' '}
          {profile.source_provenance.projects_source ?? 'unknown projects source'} /{' '}
          {profile.source_provenance.publications_source ?? 'unknown publications source'}
        </p>
      </section>
    </div>
  )
}
