import { useCallback, useMemo } from 'react'

import {
  fetchLatestRunApi,
  fetchProvenanceApi,
  fetchStatusApi,
} from '../lib/api'
import { formatDateTime, formatDuration } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface ArtifactsData {
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>>
  provenance: Awaited<ReturnType<typeof fetchProvenanceApi>>
  status: Awaited<ReturnType<typeof fetchStatusApi>>
}

interface ArtifactLink {
  name: string
  kind: string
  path: string
}

const EXTRA_ARTIFACTS: ArtifactLink[] = [
  { name: 'Projects API', kind: 'api', path: '/api/v1/projects.json' },
  { name: 'Publications API', kind: 'api', path: '/api/v1/publications.json' },
  { name: 'Metrics API', kind: 'api', path: '/api/v1/metrics.json' },
  { name: 'Search Index API', kind: 'api', path: '/api/v1/search-index.json' },
  { name: 'Profile API', kind: 'api', path: '/api/v1/profile.json' },
  { name: 'Status API', kind: 'api', path: '/api/v1/status.json' },
  { name: 'Resume PDF', kind: 'artifact', path: '/artifacts/resume.pdf' },
  {
    name: 'GitHub Raw Ingest',
    kind: 'artifact',
    path: '/artifacts/github/repos.raw.json',
  },
  {
    name: 'Semantic Scholar Raw Ingest',
    kind: 'artifact',
    path: '/artifacts/semantic-scholar/publications.raw.json',
  },
]

export function ArtifactsPage() {
  const loadArtifacts = useCallback(
    () =>
      Promise.all([fetchLatestRunApi(), fetchProvenanceApi(), fetchStatusApi()]).then(
        ([latestRun, provenance, status]) => ({
          latestRun,
          provenance,
          status,
        }),
      ),
    [],
  )
  const state = useResource<ArtifactsData>(loadArtifacts)

  const artifacts = useMemo(() => {
    if (!state.data) {
      return []
    }

    const fromProvenance = Object.entries(state.data.provenance.artifacts).map(
      ([name, path]) => ({
        name,
        kind: 'ops',
        path: path.startsWith('/') ? path : `/${path}`,
      }),
    )

    const byPath = new Map<string, ArtifactLink>()
    for (const artifact of [...fromProvenance, ...EXTRA_ARTIFACTS]) {
      byPath.set(artifact.path, artifact)
    }
    return Array.from(byPath.values())
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading artifacts and build metadata." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load artifact metadata."
        details={state.error ?? 'unknown artifacts error'}
      />
    )
  }

  const { latestRun, provenance, status } = state.data
  const runUrl = latestRun.run.action_run_url ?? provenance.action_run_url

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Artifacts</p>
        <h1>Build Outputs and Metadata</h1>
        <p className="hero-copy">
          Public artifacts are emitted by the pipeline and exposed as static JSON
          endpoints. This page lists the output surface and run provenance.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Build Metadata</h2>
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
            <span>Generated</span>
            <strong>{formatDateTime(status.generated_at)}</strong>
          </p>
          <p>
            <span>Run duration</span>
            <strong>{formatDuration(latestRun.run.duration_seconds)}</strong>
          </p>
          <p>
            <span>Git SHA</span>
            <strong>{provenance.git_sha.slice(0, 12)}</strong>
          </p>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Downloadable Artifacts</h2>
        </header>
        <div className="artifact-list">
          {artifacts.map((artifact) => (
            <article key={artifact.path} className="artifact-item">
              <p className="artifact-name">{artifact.name}</p>
              <p className="artifact-path">{artifact.path}</p>
              <p>
                <span className="badge">{artifact.kind}</span>
              </p>
              <p className="artifact-open">
                <a href={artifact.path} target="_blank" rel="noreferrer">
                  Open
                </a>
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
