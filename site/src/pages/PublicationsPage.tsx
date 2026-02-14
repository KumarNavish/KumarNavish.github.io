import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchMetricsApi, fetchPublicationsApi } from '../lib/api'
import { formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface PublicationsData {
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
}

function CitationsChart({
  points,
}: {
  points: Array<{ year: number; citations: number }>
}) {
  const width = 740
  const height = 180
  const barGap = 8
  const barWidth = Math.max(
    8,
    Math.floor((width - barGap * (points.length + 1)) / points.length),
  )
  const maxValue = Math.max(...points.map((point) => point.citations), 1)

  return (
    <svg
      role="img"
      aria-label="Citations by year"
      viewBox={`0 0 ${width} ${height}`}
      className="citations-chart"
    >
      {points.map((point, index) => {
        const x = barGap + index * (barWidth + barGap)
        const barHeight = Math.max(1, Math.round((point.citations / maxValue) * (height - 38)))
        const y = height - barHeight - 22
        return (
          <g key={point.year}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={2} />
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle">
              {point.year}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function summarizeAuthors(authors: string[]): string {
  if (authors.length <= 3) {
    return authors.join(', ')
  }
  return `${authors.slice(0, 3).join(', ')}, et al.`
}

export function PublicationsPage() {
  const loadPublications = useCallback(
    () =>
      Promise.all([fetchPublicationsApi(), fetchMetricsApi()]).then(
        ([publications, metrics]) => ({
          publications,
          metrics,
        }),
      ),
    [],
  )

  const state = useResource<PublicationsData>(loadPublications)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!state.data) {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()
    return state.data.publications.items
      .filter((publication) => {
        if (!normalizedQuery) {
          return true
        }
        return (
          publication.title.toLowerCase().includes(normalizedQuery) ||
          (publication.venue ?? '').toLowerCase().includes(normalizedQuery) ||
          publication.keywords.some((keyword) =>
            keyword.toLowerCase().includes(normalizedQuery),
          )
        )
      })
      .sort(
        (left, right) =>
          (right.citation_count ?? 0) - (left.citation_count ?? 0) ||
          (right.year ?? 0) - (left.year ?? 0) ||
          left.title.localeCompare(right.title),
      )
  }, [query, state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading publication archive." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load publications."
        details={state.error ?? 'unknown publications error'}
      />
    )
  }

  const { publications, metrics } = state.data
  const topThemes = metrics.topics.slice(0, 6)

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Publications Archive</p>
        <h1>Publication record</h1>
        <p className="hero-copy">
          A concise, searchable record for citation checks, topic coverage, and publication context.
        </p>
        <div className="action-row">
          <Link className="action-link" to="/work">
            Back to case studies
          </Link>
          <Link className="action-link action-link-primary" to="/proof">
            Practical value
          </Link>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Papers</p>
          <p className="metric-value">{formatNumber(metrics.works_count)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Citations</p>
          <p className="metric-value">{formatNumber(metrics.citations_total)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Topics tracked</p>
          <p className="metric-value">{formatNumber(topThemes.length)}</p>
        </article>
      </section>

      {metrics.citations_by_year.length > 0 ? (
        <section className="panel">
          <header className="panel-header">
            <h2>Citation Trend</h2>
          </header>
          <CitationsChart points={metrics.citations_by_year} />
        </section>
      ) : null}

      <section className="controls-panel controls-panel-compact">
        <label>
          Filter publications
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="title, venue, or keyword"
          />
        </label>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Publications ({filtered.length})</h2>
        </header>
        <div className="stack-list">
          {filtered.map((publication) => (
            <article key={publication.id} className="stack-item">
              <h3>{publication.title}</h3>
              <p className="meta-line">
                {(publication.venue ?? 'Venue unavailable') +
                  (publication.year ? ` · ${publication.year}` : '')}
              </p>
              {publication.summary ? <p className="meta-line">{publication.summary}</p> : null}
              <p className="meta-line">
                {formatNumber(publication.citation_count)} citations · {summarizeAuthors(publication.authors)}
              </p>
              <p className="meta-line">
                {publication.keywords.slice(0, 4).join(' · ')}
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

      <section className="panel panel-note">
        <p className="meta-line">
          Source: {publications.source}
          {publications.warning ? ` · ${publications.warning}` : ''}
        </p>
      </section>
    </div>
  )
}
