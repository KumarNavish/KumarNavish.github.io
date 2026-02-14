import { useCallback } from 'react'

import {
  fetchLatestRunApi,
  fetchProfileApi,
  fetchProvenanceApi,
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
}

const VALUE_ENDPOINTS = [
  {
    path: '/api/v1/profile.json',
    purpose: 'Portable profile summary for websites, CV tooling, and identity sync.',
  },
  {
    path: '/api/v1/projects.json',
    purpose: 'Structured project metadata for filtering, portfolio widgets, and team review.',
  },
  {
    path: '/api/v1/publications.json',
    purpose: 'Publication metadata and summaries for bibliography and research pages.',
  },
  {
    path: '/api/v1/metrics.json',
    purpose: 'Roll-up metrics for quick evaluation and reporting.',
  },
  {
    path: '/ops/latest-run.json',
    purpose: 'Freshness and run-health signal for trust and monitoring.',
  },
]

export function SystemProofPage() {
  const loadProof = useCallback(
    () =>
      Promise.all([
        fetchLatestRunApi(),
        fetchProvenanceApi(),
        fetchProfileApi(),
        fetchStatusApi(),
      ]).then(([latestRun, provenance, profile, status]) => ({
        latestRun,
        provenance,
        profile,
        status,
      })),
    [],
  )

  const state = useResource<ValuePageData>(loadProof)

  if (state.loading) {
    return <LoadingBlock label="Loading applied-value evidence." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load applied-value evidence."
        details={state.error ?? 'unknown applied-value error'}
      />
    )
  }

  const { latestRun, provenance, profile, status } = state.data
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
        <p className="eyebrow">Applied Value</p>
        <h1>The infrastructure exists to keep this portfolio useful, current, and reusable.</h1>
        <p className="hero-copy">
          The goal is practical: faster hiring review, cleaner collaboration handoff, and
          machine-readable outputs that other tools can consume without scraping.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Practical Use Cases</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">01</p>
            <h3>Hiring review</h3>
            <p>Evaluate trajectory, implementation depth, and recency in one pass.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">02</p>
            <h3>Collaboration setup</h3>
            <p>Share structured project and publication data for faster onboarding.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">03</p>
            <h3>System integration</h3>
            <p>Reuse JSON endpoints directly in lab pages, dashboards, or internal tools.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Reliability Snapshot</h2>
          {runUrl ? (
            <a href={runUrl} target="_blank" rel="noreferrer">
              Open workflow run
            </a>
          ) : null}
        </header>
        <div className="kv-grid">
          <p>
            <span>Status</span>
            <strong>{latestRun.run.status}</strong>
          </p>
          <p>
            <span>Last refresh</span>
            <strong>{formatDateTime(profile.last_sync.last_run_timestamp)}</strong>
          </p>
          <p>
            <span>Run duration</span>
            <strong>{formatDuration(latestRun.run.duration_seconds)}</strong>
          </p>
          <p>
            <span>Warnings</span>
            <strong>{warningCount}</strong>
          </p>
          <p>
            <span>Trigger</span>
            <strong>{provenance.environment.github_event_name ?? 'local/manual'}</strong>
          </p>
          <p>
            <span>Git SHA</span>
            <strong>{latestRun.run.git_sha.slice(0, 12)}</strong>
          </p>
          <p>
            <span>Status message</span>
            <strong>{status.message}</strong>
          </p>
          <p>
            <span>Generated at</span>
            <strong>{formatDateTime(status.generated_at)}</strong>
          </p>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Public Data Contracts</h2>
        </header>
        <div className="stack-list">
          {VALUE_ENDPOINTS.map((endpoint) => (
            <article key={endpoint.path} className="stack-item">
              <h3>
                <a href={endpoint.path} target="_blank" rel="noreferrer">
                  {endpoint.path}
                </a>
              </h3>
              <p className="meta-line">{endpoint.purpose}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Source provenance: projects from {profile.source_provenance.projects_source ?? 'unknown'}
          {' · '}publications from {profile.source_provenance.publications_source ?? 'unknown'}
        </p>
      </section>
    </div>
  )
}
