import { useCallback } from 'react'

import {
  fetchLatestRunApi,
  fetchProfileApi,
  fetchProvenanceApi,
  fetchSearchIndexApi,
  fetchStatusApi,
} from '../lib/api'
import { formatDateTime, formatDuration } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface ValuePageData {
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>>
  provenance: Awaited<ReturnType<typeof fetchProvenanceApi>>
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  status: Awaited<ReturnType<typeof fetchStatusApi>>
  search: Awaited<ReturnType<typeof fetchSearchIndexApi>>
}

const CORE_ENDPOINTS = [
  '/api/v1/profile.json',
  '/api/v1/projects.json',
  '/api/v1/publications.json',
  '/api/v1/metrics.json',
]

const TRUST_ENDPOINTS = ['/ops/latest-run.json', '/ops/provenance.json']

const ARTIFACT_ENDPOINTS = ['/artifacts/resume.pdf', '/api/v1/search-index.json']

export function SystemProofPage() {
  const loadProof = useCallback(
    () =>
      Promise.all([
        fetchLatestRunApi(),
        fetchProvenanceApi(),
        fetchProfileApi(),
        fetchStatusApi(),
        fetchSearchIndexApi(),
      ]).then(([latestRun, provenance, profile, status, search]) => ({
        latestRun,
        provenance,
        profile,
        status,
        search,
      })),
    [],
  )

  const state = useResource<ValuePageData>(loadProof)

  if (state.loading) {
    return <LoadingBlock label="Loading practical-value evidence." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load practical-value evidence."
        details={state.error ?? 'unknown practical-value error'}
      />
    )
  }

  const { latestRun, provenance, profile, status, search } = state.data
  const runUrl = latestRun.run.action_run_url ?? provenance.action_run_url
  const warningCount = latestRun.tasks.reduce(
    (count, task) =>
      count +
      task.logs.filter((log) => log.level === 'warning' || log.level === 'error').length,
    0,
  )

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Practical Value</p>
        <h1>Infrastructure here serves one purpose: dependable, reusable research outputs.</h1>
        <p className="hero-copy">
          The system is not a demo artifact. It keeps the portfolio fresh, verifiable, and easy to
          reuse in collaboration, hiring, and downstream tooling.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Where It Helps</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">01</p>
            <h3>Hiring Review</h3>
            <p>A lead can assess depth, recency, and execution quality without digging through repos.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">02</p>
            <h3>Collaboration Handoff</h3>
            <p>Projects and publications are exported in structured form for immediate team onboarding.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">03</p>
            <h3>Reusable Data Surface</h3>
            <p>Public JSON endpoints can feed dashboards, lab pages, and internal tooling directly.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Current Reliability Snapshot</h2>
          {runUrl ? (
            <a href={runUrl} target="_blank" rel="noreferrer">
              Open workflow run
            </a>
          ) : null}
        </header>
        <div className="kv-grid">
          <p>
            <span>Pipeline status</span>
            <strong>{latestRun.run.status}</strong>
          </p>
          <p>
            <span>Last update</span>
            <strong>{formatDateTime(profile.last_sync.last_run_timestamp)}</strong>
          </p>
          <p>
            <span>Run duration</span>
            <strong>{formatDuration(latestRun.run.duration_seconds)}</strong>
          </p>
          <p>
            <span>Trigger</span>
            <strong>{provenance.environment.github_event_name ?? 'local/manual'}</strong>
          </p>
          <p>
            <span>Warnings</span>
            <strong>{warningCount}</strong>
          </p>
          <p>
            <span>Searchable records</span>
            <strong>{search.document_count}</strong>
          </p>
          <p>
            <span>Git SHA</span>
            <strong>{latestRun.run.git_sha.slice(0, 12)}</strong>
          </p>
          <p>
            <span>Status message</span>
            <strong>{status.message}</strong>
          </p>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Use the Outputs Directly</h2>
        </header>
        <div className="surface-grid">
          <article className="stack-item">
            <h3>Core Portfolio Data</h3>
            <ul className="endpoint-list compact-list">
              {CORE_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}>
                  <a href={endpoint} target="_blank" rel="noreferrer">
                    {endpoint}
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <article className="stack-item">
            <h3>Trust and Provenance</h3>
            <ul className="endpoint-list compact-list">
              {TRUST_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}>
                  <a href={endpoint} target="_blank" rel="noreferrer">
                    {endpoint}
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <article className="stack-item">
            <h3>Portable Artifacts</h3>
            <ul className="endpoint-list compact-list">
              {ARTIFACT_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}>
                  <a href={endpoint} target="_blank" rel="noreferrer">
                    {endpoint}
                  </a>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Data provenance: projects from {profile.source_provenance.projects_source ?? 'unknown'} ·
          publications from {profile.source_provenance.publications_source ?? 'unknown'} · generated{' '}
          {formatDateTime(status.generated_at)}
        </p>
      </section>
    </div>
  )
}
