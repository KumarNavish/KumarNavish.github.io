import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchProfileApi, fetchProjectsApi, fetchPublicationsApi } from '../lib/api'
import {
  CHALLENGE_OPTIONS,
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  RISK_OPTIONS,
  createDecisionBlueprint,
  type ChallengeId,
  type GoalId,
  type HorizonId,
  type RiskId,
} from '../lib/decisionEngine'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

export function DashboardPage() {
  const [challenge, setChallenge] = useState<ChallengeId>('continual_reliability')
  const [goal, setGoal] = useState<GoalId>('pilot')
  const [horizon, setHorizon] = useState<HorizonId>('6w')
  const [risk, setRisk] = useState<RiskId>('balanced')
  const [context, setContext] = useState('')

  const loadDashboard = useCallback(
    () =>
      Promise.all([fetchProfileApi(), fetchProjectsApi(), fetchPublicationsApi()]).then(
        ([profile, projects, publications]) => ({
          profile,
          projects,
          publications,
        }),
      ),
    [],
  )

  const state = useResource<DashboardData>(loadDashboard)

  const blueprint = useMemo(() => {
    if (!state.data) {
      return null
    }

    return createDecisionBlueprint(
      {
        challenge,
        goal,
        horizon,
        risk,
        context,
      },
      {
        projects: state.data.projects.items,
        publications: state.data.publications.items,
      },
    )
  }, [challenge, context, goal, horizon, risk, state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading live demo." />
  }

  if (!state.data || state.error || !blueprint) {
    return (
      <ErrorBlock
        label="Unable to load live demo."
        details={state.error ?? 'unknown dashboard error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Overview</p>
        <h1>Experience the kind of systems work I build.</h1>
        <p className="hero-copy">
          Define a real decision context. The page generates a concrete strategy, automation loop,
          and delivery plan in real time.
        </p>
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/proof">
            Open live lab
          </Link>
          <Link className="action-link" to="/work">
            See case studies
          </Link>
        </div>
      </section>

      <section className="metric-grid" aria-label="Snapshot">
        <article className="metric-card">
          <p className="metric-label">Projects</p>
          <p className="metric-value">{formatNumber(state.data.profile.counts.projects)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Publications</p>
          <p className="metric-value">{formatNumber(state.data.profile.counts.publications)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Citations</p>
          <p className="metric-value">{formatNumber(state.data.profile.counts.citations_total)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Featured systems</p>
          <p className="metric-value">{formatNumber(state.data.profile.counts.featured_projects)}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Live Capability Demo</h2>
        </header>

        <div className="track-row" role="tablist" aria-label="Challenge selection">
          {CHALLENGE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === challenge ? 'track-chip track-chip-active' : 'track-chip'}
              onClick={() => setChallenge(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="controls-panel workbench-controls">
          <label>
            Goal
            <select value={goal} onChange={(event) => setGoal(event.target.value as GoalId)}>
              {GOAL_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Time horizon
            <select
              value={horizon}
              onChange={(event) => setHorizon(event.target.value as HorizonId)}
            >
              {HORIZON_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Risk mode
            <select value={risk} onChange={(event) => setRisk(event.target.value as RiskId)}>
              {RISK_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="controls-panel controls-panel-compact workbench-controls">
          <label>
            Context (optional)
            <input
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="example: rising false positives after policy shift"
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Generated Blueprint</h2>
        </header>

        <div className="card-grid">
          <article className="item-card decision-output-card">
            <p className="eyebrow">Decision focus</p>
            <h3>{blueprint.challengeTitle}</h3>
            <p>{blueprint.decisionQuestion}</p>
            <p className="meta-line">{blueprint.valueStatement}</p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">System direction</p>
            <h3>{blueprint.systemDirection}</h3>
            <p className="meta-line">{blueprint.automationLoop}</p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Success signal</p>
            <h3>{blueprint.successMetric}</h3>
            <p className="meta-line">This signal is used as the go / no-go criterion.</p>
          </article>
        </div>

        <div className="sequence-grid plan-sequence">
          {blueprint.executionPlan.map((step) => (
            <article key={step.phase} className="sequence-step">
              <p className="sequence-index">{step.phase}</p>
              <h3>{step.objective}</h3>
              <p>{step.deliverable}</p>
            </article>
          ))}
        </div>

        <div className="card-grid">
          <article className="item-card">
            <p className="matrix-label">Best starting system</p>
            {blueprint.matchedProject ? (
              <>
                <h3>{blueprint.matchedProject.name}</h3>
                <p>{blueprint.matchedProject.one_line ?? blueprint.matchedProject.description}</p>
                <p className="meta-line">
                  <a
                    href={blueprint.matchedProject.demo_url ?? blueprint.matchedProject.html_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open implementation
                  </a>
                </p>
              </>
            ) : (
              <p>No matching implementation surfaced.</p>
            )}
          </article>

          <article className="item-card">
            <p className="matrix-label">Best evidence anchor</p>
            {blueprint.matchedPublication ? (
              <>
                <h3>{blueprint.matchedPublication.title}</h3>
                <p className="meta-line">
                  {formatNumber(blueprint.matchedPublication.citation_count)} citations
                  {blueprint.matchedPublication.year ? ` · ${blueprint.matchedPublication.year}` : ''}
                </p>
                {blueprint.matchedPublication.url ? (
                  <p className="meta-line">
                    <a href={blueprint.matchedPublication.url} target="_blank" rel="noreferrer">
                      Read publication
                    </a>
                  </p>
                ) : null}
              </>
            ) : (
              <p>No matching publication surfaced.</p>
            )}
          </article>
        </div>

        <div className="panel panel-note">
          <p className="matrix-label">Delivery handoff checklist</p>
          <ul className="checklist-list">
            {blueprint.handoffChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">Updated {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}</p>
      </section>
    </div>
  )
}
