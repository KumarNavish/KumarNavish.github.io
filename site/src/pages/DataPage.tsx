import { useCallback, useMemo } from 'react'

import {
  fetchProfileApi,
  fetchSearchIndexApi,
  fetchStatusApi,
} from '../lib/api'
import { formatDateTime } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DataPageState {
  status: Awaited<ReturnType<typeof fetchStatusApi>>
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  search: Awaited<ReturnType<typeof fetchSearchIndexApi>>
}

const ENDPOINTS = [
  '/api/v1/status.json',
  '/api/v1/projects.json',
  '/api/v1/publications.json',
  '/api/v1/metrics.json',
  '/api/v1/search-index.json',
  '/api/v1/profile.json',
  '/ops/latest-run.json',
  '/ops/dag.json',
  '/ops/provenance.json',
  '/artifacts/github/repos.raw.json',
  '/artifacts/semantic-scholar/publications.raw.json',
]

export function DataPage() {
  const loadDataPage = useCallback(
    () =>
      Promise.all([fetchStatusApi(), fetchProfileApi(), fetchSearchIndexApi()]).then(
        ([status, profile, search]) => ({
          status,
          profile,
          search,
        }),
      ),
    [],
  )
  const state = useResource<DataPageState>(loadDataPage)

  const generatedAt = useMemo(
    () => (state.data ? formatDateTime(state.data.status.generated_at) : 'n/a'),
    [state.data],
  )

  if (state.loading) {
    return <LoadingBlock label="Loading data endpoint descriptors." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load data endpoint descriptors."
        details={state.error ?? 'unknown data page error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Data Surface</p>
        <h1>Public API Endpoints</h1>
        <p className="hero-copy">
          Every page in this frontend consumes generated JSON. Links below
          expose the same artifacts directly for automation and downstream use.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Snapshot Metadata</h2>
        </header>
        <div className="kv-grid">
          <p>
            <span>Site title</span>
            <strong>{state.data.profile.site_title ?? 'n/a'}</strong>
          </p>
          <p>
            <span>Last generated</span>
            <strong>{generatedAt}</strong>
          </p>
          <p>
            <span>Search docs</span>
            <strong>{state.data.search.document_count}</strong>
          </p>
          <p>
            <span>Status message</span>
            <strong>{state.data.status.message}</strong>
          </p>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Endpoint Links</h2>
        </header>
        <ul className="endpoint-list">
          {ENDPOINTS.map((endpoint) => (
            <li key={endpoint}>
              <a href={endpoint} target="_blank" rel="noreferrer">
                {endpoint}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
