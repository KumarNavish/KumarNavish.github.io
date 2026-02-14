import { useMemo, useState } from 'react'

import { fetchProjectsApi } from '../lib/api'
import { formatDate, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

type SortMode = 'featured' | 'stars' | 'recent' | 'name'

function buildCounts(values: string[]): Array<{ value: string; count: number }> {
  const map = new Map<string, number>()
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function ProjectsPage() {
  const state = useResource(fetchProjectsApi)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('all')
  const [sort, setSort] = useState<SortMode>('featured')

  const topicCounts = useMemo(() => {
    if (!state.data) {
      return []
    }
    const topics = state.data.items.flatMap((project) => project.tags)
    return buildCounts(topics)
  }, [state.data])

  const languageCounts = useMemo(() => {
    if (!state.data) {
      return []
    }
    const languages = state.data.items.flatMap((project) =>
      Object.keys(project.language_breakdown),
    )
    return buildCounts(languages)
  }, [state.data])

  const filtered = useMemo(() => {
    if (!state.data) {
      return []
    }
    const normalizedQuery = query.trim().toLowerCase()
    const candidates = state.data.items.filter((project) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.description.toLowerCase().includes(normalizedQuery) ||
        (project.one_line ?? '').toLowerCase().includes(normalizedQuery) ||
        project.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      const matchesTopic = topic === 'all' || project.tags.includes(topic)
      return matchesQuery && matchesTopic
    })

    return candidates.sort((left, right) => {
      if (sort === 'name') {
        return left.name.localeCompare(right.name)
      }
      if (sort === 'stars') {
        return right.stars - left.stars || left.name.localeCompare(right.name)
      }
      if (sort === 'recent') {
        return (
          new Date(right.last_push ?? 0).getTime() -
            new Date(left.last_push ?? 0).getTime() ||
          left.name.localeCompare(right.name)
        )
      }
      return (
        Number(right.featured) - Number(left.featured) ||
        right.stars - left.stars ||
        left.name.localeCompare(right.name)
      )
    })
  }, [query, sort, state.data, topic])

  if (state.loading) {
    return <LoadingBlock label="Loading projects API." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load projects API."
        details={state.error ?? 'unknown projects error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Projects</p>
        <h1>Build Surface</h1>
        <p className="hero-copy">
          Repository metadata is merged with curated registry fields. Filters
          and rankings below are computed client-side from generated JSON.
        </p>
      </section>

      <section className="controls-panel">
        <label>
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="project name, tag, summary"
          />
        </label>
        <label>
          Topic
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="all">All topics</option>
            {topicCounts.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.value} ({entry.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            <option value="featured">Featured</option>
            <option value="stars">Stars</option>
            <option value="recent">Recent push</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Language Breakdown</h2>
        </header>
        <p className="tag-cloud">
          {languageCounts.map((entry) => `${entry.value} (${entry.count})`).join(' · ')}
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Filtered Projects ({filtered.length})</h2>
        </header>
        <div className="card-grid">
          {filtered.map((project) => (
            <article key={project.name} className="item-card">
              <h3>
                {project.name}{' '}
                {project.featured ? <span className="badge">featured</span> : null}
              </h3>
              <p>
                {(project.one_line ?? project.description) || 'No summary available.'}
              </p>
              <p className="meta-line">
                Stars {formatNumber(project.stars)} · Forks {formatNumber(project.forks)} ·
                Last push {formatDate(project.last_push)}
              </p>
              <p className="meta-line">{project.tags.join(' · ')}</p>
              <p className="meta-line">
                <a href={project.html_url} target="_blank" rel="noreferrer">
                  Repository
                </a>
                {project.demo_url ? (
                  <>
                    {' '}
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
    </div>
  )
}
