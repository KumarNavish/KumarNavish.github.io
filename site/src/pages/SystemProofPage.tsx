import { useCallback } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchLatestRunApi,
  fetchProvenanceApi,
  fetchSearchIndexApi,
  fetchStatusApi,
} from '../lib/api'
import { formatDateTime, formatDuration } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface SystemProofData {
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>>
  provenance: Awaited<ReturnType<typeof fetchProvenanceApi>>
  status: Awaited<ReturnType<typeof fetchStatusApi>>
  search: Awaited<ReturnType<typeof fetchSearchIndexApi>>
}

const API_ENDPOINTS = [
  '/api/v1/profile.json',
  '/api/v1/projects.json',
  '/api/v1/publications.json',
  '/api/v1/metrics.json',
  '/api/v1/search-index.json',
]

const OPS_ENDPOINTS = ['/ops/latest-run.json', '/ops/dag.json', '/ops/provenance.json']

const ARTIFACT_ENDPOINTS = [
  '/artifacts/resume.pdf',
  '/artifacts/github/repos.raw.json',
  '/artifacts/semantic-scholar/publications.raw.json',
]

export function SystemProofPage() {
  const loadProof = useCallback(
    () =>
      Promise.all([
        fetchLatestRunApi(),
        fetchProvenanceApi(),
        fetchStatusApi(),
        fetchSearchIndexApi(),
      ]).then(([latestRun, provenance, status, search]) => ({
        latestRun,
        provenance,
        status,
        search,
      })),
    [],
  )
  const state = useResource<SystemProofData>(loadProof)

  if (state.loading) {
    return <LoadingBlock label="Loading system proof from ops and API artifacts." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load system proof page."
        details={state.error ?? 'unknown system proof error'}
      />
    )
  }

  const { latestRun, provenance, status, search } = state.data
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
        <p className="eyebrow">System Proof</p>
        <h1>Evidence that this portfolio runs as a production system</h1>
        <p className="hero-copy">
          The frontend is generated from machine-readable artifacts. The run below
          proves the data pipeline, quality gates, and deployment workflow are active.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Execution Sequence</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">01</p>
            <h3>Ingest</h3>
            <p>Registry YAML + GitHub + publication sources are fetched and validated.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">02</p>
            <h3>Normalize</h3>
            <p>Projects and publications are standardized and metrics/search index are computed.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">03</p>
            <h3>Publish</h3>
            <p>Static JSON APIs, ops telemetry, and build artifacts are deployed to Pages.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Latest Automated Run</h2>
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
            <span>Finished</span>
            <strong>{formatDateTime(latestRun.run.finished_at)}</strong>
          </p>
          <p>
            <span>Duration</span>
            <strong>{formatDuration(latestRun.run.duration_seconds)}</strong>
          </p>
          <p>
            <span>Warnings</span>
            <strong>{warningCount}</strong>
          </p>
          <p>
            <span>Task count</span>
            <strong>{latestRun.run.task_count}</strong>
          </p>
          <p>
            <span>Trigger</span>
            <strong>{provenance.environment.github_event_name ?? 'local/manual'}</strong>
          </p>
          <p>
            <span>Search docs</span>
            <strong>{search.document_count}</strong>
          </p>
          <p>
            <span>Git SHA</span>
            <strong>{latestRun.run.git_sha.slice(0, 12)}</strong>
          </p>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Public Output Surface</h2>
        </header>
        <div className="surface-grid">
          <article className="stack-item">
            <h3>Portfolio APIs</h3>
            <ul className="endpoint-list compact-list">
              {API_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}>
                  <a href={endpoint} target="_blank" rel="noreferrer">
                    {endpoint}
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <article className="stack-item">
            <h3>Ops Telemetry</h3>
            <ul className="endpoint-list compact-list">
              {OPS_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}>
                  <a href={endpoint} target="_blank" rel="noreferrer">
                    {endpoint}
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <article className="stack-item">
            <h3>Artifacts</h3>
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

      <section className="panel">
        <header className="panel-header">
          <h2>Deep Inspection</h2>
        </header>
        <div className="action-row">
          <Link className="action-link" to="/ops/console">
            Full ops console
          </Link>
          <Link className="action-link" to="/artifacts">
            Artifact explorer
          </Link>
          <Link className="action-link" to="/data">
            Raw data index
          </Link>
        </div>
        <p className="meta-line">
          Status endpoint message: {status.message} · Generated {formatDateTime(status.generated_at)}
        </p>
      </section>
    </div>
  )
}
