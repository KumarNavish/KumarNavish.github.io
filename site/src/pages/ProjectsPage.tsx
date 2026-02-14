import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchProjectsApi } from '../lib/api'
import { formatDate } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

function buildThemeSummary(values: string[]): string[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) {
      continue
    }
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([value, count]) => `${value} (${count})`)
}

export function ProjectsPage() {
  const state = useResource(fetchProjectsApi)
  const [showArchive, setShowArchive] = useState(false)
  const [query, setQuery] = useState('')

  const featured = useMemo(() => {
    if (!state.data) {
      return []
    }
    return state.data.items
      .filter((project) => project.featured || project.pinned)
      .sort((left, right) => right.stars - left.stars || left.name.localeCompare(right.name))
  }, [state.data])

  const archive = useMemo(() => {
    if (!state.data) {
      return []
    }
    const normalizedQuery = query.trim().toLowerCase()
    return state.data.items
      .filter((project) => !project.featured && !project.pinned)
      .filter((project) => {
        if (!normalizedQuery) {
          return true
        }
        return (
          project.name.toLowerCase().includes(normalizedQuery) ||
          project.description.toLowerCase().includes(normalizedQuery) ||
          (project.one_line ?? '').toLowerCase().includes(normalizedQuery)
        )
      })
      .sort(
        (left, right) =>
          new Date(right.last_push ?? 0).getTime() -
            new Date(left.last_push ?? 0).getTime() ||
          left.name.localeCompare(right.name),
      )
  }, [query, state.data])

  const themeSummary = useMemo(
    () => buildThemeSummary(featured.flatMap((project) => project.tags)),
    [featured],
  )

  if (state.loading) {
    return <LoadingBlock label="Loading project archive." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load projects."
        details={state.error ?? 'unknown projects error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Projects Archive</p>
        <h1>Systems and experiments</h1>
        <p className="hero-copy">
          Curated systems are shown first. Expand only when you need complete historical coverage.
        </p>
        <div className="action-row">
          <Link className="action-link" to="/work">
            Back to curated work
          </Link>
          <Link className="action-link action-link-primary" to="/proof">
            Verify pipeline proof
          </Link>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Curated Systems ({featured.length})</h2>
        </header>
        {themeSummary.length > 0 ? <p className="tag-cloud">{themeSummary.join(' · ')}</p> : null}
        <div className="card-grid">
          {featured.map((project) => (
            <article key={project.name} className="item-card">
              <h3>{project.name}</h3>
              <p>{(project.one_line ?? project.description) || 'No summary available.'}</p>
              <p className="meta-line">Last push {formatDate(project.last_push)}</p>
              <p className="meta-line">
                <a href={project.html_url} target="_blank" rel="noreferrer">
                  Repository
                </a>
                {project.demo_url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={project.demo_url} target="_blank" rel="noreferrer">
                      Live demo
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
          <h2>Full Archive</h2>
          <button
            type="button"
            className="action-link"
            onClick={() => setShowArchive((value) => !value)}
          >
            {showArchive ? 'Hide archive' : 'Show archive'}
          </button>
        </header>
        {showArchive ? (
          <>
            <div className="controls-panel controls-panel-compact">
              <label>
                Search archive
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="project name or summary"
                />
              </label>
            </div>
            <div className="card-grid">
              {archive.map((project) => (
                <article key={project.name} className="item-card">
                  <h3>{project.name}</h3>
                  <p>{(project.one_line ?? project.description) || 'No summary available.'}</p>
                  <p className="meta-line">Last push {formatDate(project.last_push)}</p>
                  <p className="meta-line">
                    <a href={project.html_url} target="_blank" rel="noreferrer">
                      Repository
                    </a>
                  </p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="meta-line">
            Hidden by default to keep focus on the strongest systems.
          </p>
        )}
      </section>
    </div>
  )
}
