import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchLatestRunApi,
  fetchMetricsApi,
  fetchProfileApi,
  fetchProvenanceApi,
  fetchProjectsApi,
  fetchPublicationsApi,
} from '../lib/api'
import { formatDateTime, formatDuration, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>>
  provenance: Awaited<ReturnType<typeof fetchProvenanceApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

const INTELLECTUAL_POSITIONING = [
  'I approach research as system design: assumptions are explicit, outputs are testable.',
  'I build tooling around ideas so progress is reproducible and inspectable.',
  'I prioritize methods that survive contact with real operational constraints.',
]

export function DashboardPage() {
  const loadDashboard = useCallback(
    () =>
      Promise.all([
        fetchProfileApi(),
        fetchMetricsApi(),
        fetchLatestRunApi(),
        fetchProvenanceApi(),
        fetchProjectsApi(),
        fetchPublicationsApi(),
      ]).then(([profile, metrics, latestRun, provenance, projects, publications]) => ({
        profile,
        metrics,
        latestRun,
        provenance,
        projects,
        publications,
      })),
    [],
  )
  const state = useResource<DashboardData>(loadDashboard)

  const quickSnapshots = useMemo(() => {
    if (!state.data) {
      return []
    }

    const featuredProjects = state.data.profile.featured.projects.slice(0, 2).map((project) => ({
      id: `project:${project.name}`,
      title: project.name,
      detail: project.one_line ?? 'Flagship technical system.',
      link: project.demo_url ?? project.html_url ?? '/work',
      meta: `Project · ${formatNumber(project.stars)} stars`,
    }))

    const publicationById = new Map(
      state.data.publications.items.map((publication) => [publication.id, publication]),
    )

    const featuredPublications = state.data.profile.featured.publications
      .slice(0, 2)
      .map((publication) => {
        const expanded = publication.id ? publicationById.get(publication.id) : null
        return {
          id: `publication:${publication.id ?? publication.title}`,
          title: publication.title,
          detail:
            expanded?.summary ??
            `${publication.venue ?? 'Publication venue'}${
              publication.year ? ` (${publication.year})` : ''
            }`,
          link: publication.url ?? '/work#papers',
          meta: `Publication · ${formatNumber(publication.citation_count)} citations`,
        }
      })

    return [...featuredProjects, ...featuredPublications]
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading overview from generated APIs." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load overview."
        details={state.error ?? 'unknown overview error'}
      />
    )
  }

  const { profile, metrics, latestRun, provenance } = state.data
  const runUrl = latestRun.run.action_run_url ?? provenance.action_run_url
  const hasRunIssues = latestRun.summary.failed > 0

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Overview</p>
        <h1>{profile.site_title ?? 'Navish Kumar'}</h1>
        <p className="hero-copy">
          I build research as deployable systems: each idea is connected to code,
          metrics, and reproducible outputs.
        </p>
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            Explore curated work
          </Link>
          <Link className="action-link" to="/proof">
            Validate system proof
          </Link>
          <a className="action-link" href={profile.links.github} target="_blank" rel="noreferrer">
            Open GitHub
          </a>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>How to read this site</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">01</p>
            <h3>Understand the arc</h3>
            <p>Start with the research arcs and why each line of work exists.</p>
            <Link to="/work#arcs">Go to arcs</Link>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">02</p>
            <h3>Inspect flagship builds</h3>
            <p>See how ideas were translated into systems, experiments, and tools.</p>
            <Link to="/work#systems">Go to systems</Link>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">03</p>
            <h3>Verify execution quality</h3>
            <p>Check generated APIs, run telemetry, and deployment automation.</p>
            <Link to="/proof">Go to proof</Link>
          </article>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Projects</p>
          <p className="metric-value">{formatNumber(profile.counts.projects)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Publications</p>
          <p className="metric-value">{formatNumber(metrics.works_count)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Citations</p>
          <p className="metric-value">{formatNumber(metrics.citations_total)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Pipeline status</p>
          <p className="metric-value">{latestRun.run.status}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Intellectual posture</h2>
        </header>
        <div className="stack-list">
          {INTELLECTUAL_POSITIONING.map((line) => (
            <article key={line} className="stack-item">
              <p>{line}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Flagship snapshots</h2>
        </header>
        <div className="card-grid">
          {quickSnapshots.map((item) => (
            <article key={item.id} className="item-card">
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <p className="meta-line">{item.meta}</p>
              <p className="meta-line">
                {item.link.startsWith('http') ? (
                  <a href={item.link} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : (
                  <Link to={item.link}>Open</Link>
                )}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel-note">
        <header className="panel-header">
          <h2>Latest run</h2>
          {runUrl ? (
            <a href={runUrl} target="_blank" rel="noreferrer">
              Open workflow
            </a>
          ) : null}
        </header>
        <p className="meta-line">
          Finished {formatDateTime(latestRun.run.finished_at)} · Duration{' '}
          {formatDuration(latestRun.run.duration_seconds)} · Commit{' '}
          {latestRun.run.git_sha.slice(0, 12)}
        </p>
        <p className="meta-line">
          {hasRunIssues
            ? 'Latest run has failures. Inspect System Proof before trusting outputs.'
            : 'Latest run is healthy and publishing machine-readable artifacts.'}
        </p>
      </section>
    </div>
  )
}
