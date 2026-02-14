import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchProfileApi, fetchProjectsApi, fetchPublicationsApi } from '../lib/api'
import {
  CHALLENGE_OPTIONS,
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  RISK_OPTIONS,
  createDecisionBlueprint,
  renderDecisionBriefMarkdown,
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

function briefFileName(challenge: ChallengeId, horizon: HorizonId): string {
  return `decision-brief-${challenge}-${horizon}.md`
}

export function DashboardPage() {
  const [challenge, setChallenge] = useState<ChallengeId>('continual_reliability')
  const [goal, setGoal] = useState<GoalId>('pilot')
  const [horizon, setHorizon] = useState<HorizonId>('6w')
  const [risk, setRisk] = useState<RiskId>('balanced')
  const [context, setContext] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

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

  const briefMarkdown = useMemo(() => {
    if (!blueprint) {
      return ''
    }
    return renderDecisionBriefMarkdown(
      {
        challenge,
        goal,
        horizon,
        risk,
        context,
      },
      blueprint,
    )
  }, [blueprint, challenge, goal, horizon, risk, context])

  async function handleCopyBrief() {
    if (!briefMarkdown) {
      return
    }

    try {
      await navigator.clipboard.writeText(briefMarkdown)
      setCopyStatus('Execution brief copied to clipboard.')
    } catch {
      setCopyStatus('Clipboard unavailable. Use download instead.')
    }
  }

  function handleDownloadBrief() {
    if (!briefMarkdown) {
      return
    }

    const blob = new Blob([briefMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = briefFileName(challenge, horizon)
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (state.loading) {
    return <LoadingBlock label="Loading decision builder." />
  }

  if (!state.data || state.error || !blueprint) {
    return (
      <ErrorBlock
        label="Unable to load decision builder."
        details={state.error ?? 'unknown dashboard error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Decision Builder</p>
        <h1>One tool: turn a problem into a usable execution brief.</h1>
        <p className="hero-copy">
          Define your operating context, then get an actionable plan you can hand directly to a
          team.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>1. Configure The Decision</h2>
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
            Current situation
            <textarea
              rows={3}
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Describe what is failing or what decision needs to be made now."
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>2. Generated Execution Brief</h2>
        </header>

        <div className="card-grid">
          <article className="item-card decision-output-card">
            <p className="eyebrow">Decision</p>
            <h3>{blueprint.decisionQuestion}</h3>
            <p>{blueprint.systemDirection}</p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Next 72 hours</p>
            <ul className="checklist-list">
              {blueprint.immediateActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Automation loop</p>
            <h3>{blueprint.automationLoop}</h3>
            <p>{blueprint.successMetric}</p>
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
            <p className="matrix-label">KPI set</p>
            <ul className="checklist-list">
              {blueprint.kpis.map((kpi) => (
                <li key={kpi.metric}>
                  <strong>{kpi.metric}</strong>
                  <br />
                  target: {kpi.target}
                  <br />
                  cadence: {kpi.cadence}
                </li>
              ))}
            </ul>
          </article>

          <article className="item-card">
            <p className="matrix-label">Risk controls</p>
            <ul className="checklist-list">
              {blueprint.risks.map((riskItem) => (
                <li key={riskItem.risk}>
                  <strong>{riskItem.risk}</strong>
                  <br />
                  trigger: {riskItem.trigger}
                  <br />
                  guardrail: {riskItem.guardrail}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="card-grid">
          <article className="item-card">
            <p className="matrix-label">Implementation anchor</p>
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
            <p className="matrix-label">Evidence anchor</p>
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
          <p className="matrix-label">Handoff checklist</p>
          <ul className="checklist-list">
            {blueprint.handoffChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="action-row">
          <button type="button" className="action-link action-link-primary" onClick={handleCopyBrief}>
            Copy brief
          </button>
          <button type="button" className="action-link" onClick={handleDownloadBrief}>
            Download markdown
          </button>
          <Link className="action-link" to="/work">
            Case studies
          </Link>
        </div>
        {copyStatus ? <p className="meta-line">{copyStatus}</p> : null}
      </section>

      <section className="panel panel-note">
        <p className="meta-line">Updated {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}</p>
      </section>
    </div>
  )
}
