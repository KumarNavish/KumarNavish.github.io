import { useCallback, useMemo } from 'react'

import {
  fetchLatestRunApi,
  fetchMetricsApi,
  fetchProfileApi,
  fetchProjectsApi,
  type ProjectItem,
} from '../lib/api'
import {
  compactList,
  formatDateTime,
  formatDuration,
  formatNumber,
} from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
}

function uniqueProjectTopics(projects: ProjectItem[]): string[] {
  const seen = new Set<string>()
  const topics: string[] = []
  for (const project of projects) {
    for (const tag of project.tags) {
      if (seen.has(tag)) {
        continue
      }
      seen.add(tag)
      topics.push(tag)
    }
  }
  return topics
}

export function DashboardPage() {
  const loadDashboard = useCallback(
    () =>
      Promise.all([
        fetchProfileApi(),
        fetchMetricsApi(),
        fetchLatestRunApi(),
        fetchProjectsApi(),
      ]).then(([profile, metrics, latestRun, projects]) => ({
        profile,
        metrics,
        latestRun,
        projects,
      })),
    [],
  )
  const state = useResource<DashboardData>(loadDashboard)

  const warningCount = useMemo(() => {
    if (!state.data) {
      return 0
    }
    return state.data.latestRun.tasks.reduce(
      (count, task) =>
        count +
        task.logs.filter((log) => log.level === 'warning' || log.level === 'error')
          .length,
      0,
    )
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading dashboard from generated APIs." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load dashboard APIs."
        details={state.error ?? 'unknown dashboard error'}
      />
    )
  }

  const { profile, metrics, latestRun, projects } = state.data
  const featured = profile.featured.projects.length
    ? profile.featured.projects
    : projects.items.filter((project) => project.featured).slice(0, 4)
  const focusTopics = uniqueProjectTopics(projects.items).slice(0, 8)
  const runUrl = latestRun.run.action_run_url

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Portfolio as a system</p>
        <h1>{profile.site_title ?? 'Research Portfolio'}</h1>
        <p className="hero-copy">
          Structured sources are ingested, normalized, measured, indexed, and
          published as machine-readable APIs. The interface below renders only
          those artifacts.
        </p>
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
          <p className="metric-label">Run Warnings</p>
          <p className="metric-value">{formatNumber(warningCount)}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Latest Pipeline Run</h2>
          {runUrl ? (
            <a href={runUrl} target="_blank" rel="noreferrer">
              Open workflow
            </a>
          ) : null}
        </header>
        <div className="kv-grid">
          <p>
            <span>Status</span>
            <strong>{latestRun.run.status}</strong>
          </p>
          <p>
            <span>Finished</span>
            <strong>{formatDateTime(latestRun.run.finished_at)}</strong>
          </p>
          <p>
            <span>Duration</span>
            <strong>{formatDuration(latestRun.run.duration_seconds)}</strong>
          </p>
          <p>
            <span>Git SHA</span>
            <strong>{latestRun.run.git_sha.slice(0, 12)}</strong>
          </p>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Featured Projects</h2>
        </header>
        <div className="card-grid">
          {featured.map((project) => (
            <article key={project.name} className="item-card">
              <h3>{project.name}</h3>
              <p>{project.one_line ?? 'No summary available.'}</p>
              <p className="meta-line">
                Stars {formatNumber(project.stars)}{' '}
                {project.demo_url ? (
                  <>
                    ·{' '}
                    <a href={project.demo_url} target="_blank" rel="noreferrer">
                      Demo
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
          <h2>Current Focus Tags</h2>
        </header>
        <p className="tag-cloud">{compactList(focusTopics, 12)}</p>
      </section>
    </div>
  )
}
