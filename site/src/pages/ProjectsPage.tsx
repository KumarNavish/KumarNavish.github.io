import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ArcNarrative } from '../components/ArcNarrative'
import { ArcThread } from '../components/ArcThread'
import { fetchProjectsApi, type ProjectItem } from '../lib/api'
import { runClPloProof, type ClPloProofConfig, type ProofStrategyId } from '../lib/clploProof'
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

function summarizeProject(project: ProjectItem): string | null {
  const oneLine = project.one_line?.trim()
  if (oneLine) {
    return oneLine
  }
  const description = project.description?.trim()
  if (description) {
    return description
  }
  return null
}

type ProofPresetId = 'quick' | 'default' | 'stress'

const CL_PLO_PROJECT_URL = 'https://github.com/KumarNavish/CL-PLO'

const PROOF_PRESETS: Record<ProofPresetId, ClPloProofConfig> = {
  quick: {
    steps: 40,
    stress_probability: 0.2,
    anchor_weight: 0.33,
    projection_limit: 0.65,
    seed: 12,
  },
  default: {
    steps: 72,
    stress_probability: 0.35,
    anchor_weight: 0.4,
    projection_limit: 0.6,
    seed: 23,
  },
  stress: {
    steps: 84,
    stress_probability: 0.58,
    anchor_weight: 0.48,
    projection_limit: 0.56,
    seed: 31,
  },
}

const STRATEGY_COLORS: Record<ProofStrategyId, string> = {
  naive: '#8e4a3f',
  replay: '#4b637f',
  hybrid: '#1d4a43',
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function linePath(values: number[], width: number, height: number, min: number, max: number): string {
  if (values.length === 0) {
    return ''
  }

  const span = Math.max(max - min, 1e-9)
  const stepX = values.length > 1 ? width / (values.length - 1) : width

  return values
    .map((value, index) => {
      const x = index * stepX
      const y = height - ((value - min) / span) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function ProjectsPage() {
  const state = useResource(fetchProjectsApi)
  const [showArchive, setShowArchive] = useState(false)
  const [query, setQuery] = useState('')
  const [proofPreset, setProofPreset] = useState<ProofPresetId>('default')
  const [proofRunVersion, setProofRunVersion] = useState(0)

  const featured = useMemo(() => {
    if (!state.data) {
      return []
    }
    return state.data.items
      .filter((project) => project.featured || project.pinned)
      .sort(
        (left, right) =>
          new Date(right.last_push ?? 0).getTime() -
            new Date(left.last_push ?? 0).getTime() ||
          left.name.localeCompare(right.name),
      )
  }, [state.data])

  const archive = useMemo(() => {
    if (!state.data) {
      return []
    }
    const normalizedQuery = query.trim().toLowerCase()
    return state.data.items
      .filter((project) => !project.featured && !project.pinned)
      .filter((project) => summarizeProject(project) !== null)
      .filter((project) => {
        if (!normalizedQuery) {
          return true
        }
        const summary = summarizeProject(project) ?? ''
        return (
          project.name.toLowerCase().includes(normalizedQuery) ||
          summary.toLowerCase().includes(normalizedQuery)
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

  const proofConfig = useMemo(() => {
    const preset = PROOF_PRESETS[proofPreset]
    return {
      ...preset,
      seed: preset.seed + proofRunVersion * 19,
    }
  }, [proofPreset, proofRunVersion])

  const proofResult = useMemo(() => runClPloProof(proofConfig), [proofConfig])

  const proofRange = useMemo(() => {
    const values = proofResult.strategies.flatMap((strategy) => strategy.values)
    const min = Math.min(...values)
    const max = Math.max(...values)

    return {
      min: min * 0.995,
      max: max * 1.005,
    }
  }, [proofResult.strategies])

  const stressShare = useMemo(() => {
    if (proofResult.regimes.length === 0) {
      return 0
    }

    const stressCount = proofResult.regimes.filter((regime) => regime === 'stress').length
    return stressCount / proofResult.regimes.length
  }, [proofResult.regimes])

  if (state.loading) {
    return <LoadingBlock label="Loading skills." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load skills."
        details={state.error ?? 'unknown skills error'}
      />
    )
  }

  return (
    <div className="page builder-page overview-flow">
      <section className="hero hero-primary">
        <p className="eyebrow">Skills</p>
        <h1>I demonstrate skills through systems you can inspect, test, and stress.</h1>
        <p className="hero-copy">
          This layer focuses on reliability under drift through modeling, optimization, and
          implementation discipline.
        </p>
        <div className="action-row">
          <Link className="action-link" to="/">
            Back to Motivation
          </Link>
          <Link className="action-link action-link-primary" to="/work">
            Continue to Impact
          </Link>
        </div>
      </section>

      <ArcThread current="skills" />
      <ArcNarrative current="skills" />

      <section className="panel proof-focus-panel" aria-label="Skill proof">
        <header className="proof-focus-header">
          <p className="matrix-label">Skill proof · Continual reliability</p>
          <h2>Policy stability under drift and stress</h2>
        </header>

        <div className="clplo-toolbar" role="group" aria-label="CL-PLO modes">
          <button
            type="button"
            className={proofPreset === 'quick' ? 'track-chip track-chip-active' : 'track-chip'}
            onClick={() => {
              setProofPreset('quick')
              setProofRunVersion((value) => value + 1)
            }}
          >
            Quick
          </button>
          <button
            type="button"
            className={proofPreset === 'default' ? 'track-chip track-chip-active' : 'track-chip'}
            onClick={() => {
              setProofPreset('default')
              setProofRunVersion((value) => value + 1)
            }}
          >
            Default
          </button>
          <button
            type="button"
            className={proofPreset === 'stress' ? 'track-chip track-chip-active' : 'track-chip'}
            onClick={() => {
              setProofPreset('stress')
              setProofRunVersion((value) => value + 1)
            }}
          >
            Stress+
          </button>
        </div>

        <div className="proof-chart-card">
          <svg viewBox="0 0 560 180" className="proof-line-chart" role="img" aria-label="CL-PLO value paths">
            <line x1="0" y1="0" x2="0" y2="180" className="proof-grid-line" />
            <line x1="0" y1="180" x2="560" y2="180" className="proof-grid-line" />
            {proofResult.strategies.map((strategy) => (
              <path
                key={strategy.id}
                d={linePath(strategy.values, 560, 180, proofRange.min, proofRange.max)}
                stroke={STRATEGY_COLORS[strategy.id]}
                strokeWidth={strategy.id === proofResult.winner.id ? 2.6 : 1.8}
                fill="none"
              />
            ))}
          </svg>
          <div className="proof-legend">
            {proofResult.strategies.map((strategy) => (
              <span key={strategy.id} className="proof-legend-item">
                <i style={{ backgroundColor: STRATEGY_COLORS[strategy.id] }} />
                {strategy.label}
              </span>
            ))}
          </div>
        </div>

        <div className="proof-stat-grid" aria-label="CL-PLO outcomes">
          <article className="proof-stat-card">
            <p className="matrix-label">Winner</p>
            <p className="proof-stat-main">{proofResult.winner.label}</p>
          </article>
          <article className="proof-stat-card">
            <p className="matrix-label">Return</p>
            <p className="proof-stat-main">{formatPercent(proofResult.winner.metrics.total_return)}</p>
          </article>
          <article className="proof-stat-card">
            <p className="matrix-label">Max drawdown</p>
            <p className="proof-stat-main">{formatPercent(proofResult.winner.metrics.max_drawdown)}</p>
          </article>
          <article className="proof-stat-card">
            <p className="matrix-label">Stress share</p>
            <p className="proof-stat-main">{formatPercent(stressShare)}</p>
          </article>
        </div>

        <p className="proof-claim-line">{proofResult.decision_note}</p>
        <a href={CL_PLO_PROJECT_URL} target="_blank" rel="noreferrer" className="builder-inline-link">
          Explore full CL-PLO project
        </a>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Inspectable Build Surface</h2>
        </header>
        {themeSummary.length > 0 ? <p className="tag-cloud">{themeSummary.join(' · ')}</p> : null}
        <div className="card-grid">
          {featured.map((project) => (
            <article key={project.name} className="item-card">
              <h3>{project.name}</h3>
              <p>{summarizeProject(project) ?? 'Repository artifact with reproducible code.'}</p>
              <p className="meta-line">Updated {formatDate(project.last_push)}</p>
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
          <h2>Extended Build Archive</h2>
          <button
            type="button"
            className="action-link"
            onClick={() => setShowArchive((value) => !value)}
          >
            {showArchive ? 'Hide full archive' : 'Show full archive'}
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
                  placeholder="name or summary"
                />
              </label>
            </div>
            <div className="card-grid">
              {archive.map((project) => (
                <article key={project.name} className="item-card">
                  <h3>{project.name}</h3>
                  <p>{summarizeProject(project)}</p>
                  <p className="meta-line">Updated {formatDate(project.last_push)}</p>
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
          <p className="meta-line">Hidden by default to keep this layer focused.</p>
        )}
      </section>
    </div>
  )
}
