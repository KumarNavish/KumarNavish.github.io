import { useCallback, useMemo, useState } from 'react'

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
  if (points.length === 0) {
    return <p className="meta-line">No citation-by-year series available.</p>
  }

  const width = 740
  const height = 180
  const barGap = 8
  const barWidth = Math.max(8, Math.floor((width - barGap * (points.length + 1)) / points.length))
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
  const [yearFilter, setYearFilter] = useState('all')

  const yearOptions = useMemo(() => {
    if (!state.data) {
      return []
    }
    return Array.from(
      new Set(
        state.data.publications.items
          .map((item) => item.year)
          .filter((year): year is number => typeof year === 'number'),
      ),
    ).sort((a, b) => b - a)
  }, [state.data])

  const filtered = useMemo(() => {
    if (!state.data) {
      return []
    }
    const normalizedQuery = query.trim().toLowerCase()
    const selectedYear = yearFilter === 'all' ? null : Number(yearFilter)
    return state.data.publications.items.filter((publication) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        publication.title.toLowerCase().includes(normalizedQuery) ||
        (publication.venue ?? '').toLowerCase().includes(normalizedQuery) ||
        publication.keywords.some((keyword) =>
          keyword.toLowerCase().includes(normalizedQuery),
        )
      const matchesYear =
        selectedYear === null ||
        (typeof publication.year === 'number' && publication.year === selectedYear)
      return matchesQuery && matchesYear
    })
  }, [query, state.data, yearFilter])

  if (state.loading) {
    return <LoadingBlock label="Loading publications and metrics APIs." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load publications APIs."
        details={state.error ?? 'unknown publications error'}
      />
    )
  }

  const { publications, metrics } = state.data

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Publications</p>
        <h1>Research Output</h1>
        <p className="hero-copy">
          The list and charts are generated from normalized publication and
          metrics endpoints. Filtering here does not require manual edits.
        </p>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Works</p>
          <p className="metric-value">{formatNumber(metrics.works_count)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Citations</p>
          <p className="metric-value">{formatNumber(metrics.citations_total)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Venues</p>
          <p className="metric-value">{formatNumber(metrics.top_venues.length)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Topics</p>
          <p className="metric-value">{formatNumber(metrics.topics.length)}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Citations by Year</h2>
        </header>
        <CitationsChart points={metrics.citations_by_year} />
      </section>

      <section className="controls-panel">
        <label>
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="title, venue, keyword"
          />
        </label>
        <label>
          Year
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
          >
            <option value="all">All years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Filtered Publications ({filtered.length})</h2>
        </header>
        <div className="stack-list">
          {filtered.map((publication) => (
            <article key={publication.id} className="stack-item">
              <h3>{publication.title}</h3>
              <p className="meta-line">
                {(publication.venue ?? 'Unknown venue') +
                  (publication.year ? ` · ${publication.year}` : '')}
              </p>
              <p className="meta-line">
                Citations {formatNumber(publication.citation_count)} · Authors{' '}
                {publication.authors.slice(0, 4).join(', ')}
              </p>
              <p className="meta-line">{publication.keywords.join(' · ')}</p>
              {publication.url ? (
                <p className="meta-line">
                  <a href={publication.url} target="_blank" rel="noreferrer">
                    Open publication
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Top Venues</h2>
        </header>
        <p className="tag-cloud">
          {metrics.top_venues.map((venue) => `${venue.venue} (${venue.works})`).join(' · ')}
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Top Topics</h2>
        </header>
        <p className="tag-cloud">
          {metrics.topics.map((topic) => `${topic.topic} (${topic.count})`).join(' · ')}
        </p>
      </section>

      <section className="panel panel-note">
        <p>Publication source: {publications.source}</p>
        {publications.warning ? <p>{publications.warning}</p> : null}
      </section>
    </div>
  )
}
