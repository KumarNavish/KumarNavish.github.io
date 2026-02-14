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

type OutputView = 'plan' | 'kpis' | 'risks'

interface CapabilityTrack {
  challenge: ChallengeId
  title: string
  statement: string
}

const CAPABILITY_TRACKS: CapabilityTrack[] = [
  {
    challenge: 'continual_reliability',
    title: 'Continual Learning Reliability',
    statement: 'Policy design for stable sequential model updates.',
  },
  {
    challenge: 'online_safety',
    title: 'Online Safety Intervention',
    statement: 'Interaction-driven trigger design for earlier moderation action.',
  },
  {
    challenge: 'urban_transition',
    title: 'Urban Transition Sequencing',
    statement: 'Evidence-based rollout ordering under operational constraints.',
  },
]

function briefFileName(challenge: ChallengeId, horizon: HorizonId): string {
  return `decision-brief-${challenge}-${horizon}.md`
}

function labelFor<T extends string>(options: Array<{ id: T; label: string }>, id: T): string {
  return options.find((option) => option.id === id)?.label ?? id
}

export function DashboardPage() {
  const [challenge, setChallenge] = useState<ChallengeId>('continual_reliability')
  const [goal, setGoal] = useState<GoalId>('pilot')
  const [horizon, setHorizon] = useState<HorizonId>('6w')
  const [risk, setRisk] = useState<RiskId>('balanced')
  const [context, setContext] = useState('')
  const [view, setView] = useState<OutputView>('plan')
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

  const capabilityAnchors = useMemo(() => {
    const data = state.data
    if (!data) {
      return []
    }

    return CAPABILITY_TRACKS.map((track) => {
      const anchor = createDecisionBlueprint(
        {
          challenge: track.challenge,
          goal: 'pilot',
          horizon: '6w',
          risk: 'balanced',
          context: '',
        },
        {
          projects: data.projects.items,
          publications: data.publications.items,
        },
      )

      return {
        ...track,
        project: anchor.matchedProject,
        publication: anchor.matchedPublication,
        decisionQuestion: anchor.decisionQuestion,
      }
    })
  }, [state.data])

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

  const selectedChallengeLabel = labelFor(CHALLENGE_OPTIONS, challenge)
  const selectedGoalLabel = labelFor(GOAL_OPTIONS, goal)
  const selectedHorizonLabel = labelFor(HORIZON_OPTIONS, horizon)
  const selectedRiskLabel = labelFor(RISK_OPTIONS, risk)

  return (
    <div className="page builder-page">
      <section className="hero hero-primary builder-hero">
        <p className="eyebrow">Decision Builder</p>
        <h1>Evidence-backed systems design, from first decision to delivery brief.</h1>
        <p className="hero-copy">
          This page combines prior systems work with a live planning utility. A visitor can see what
          has been built and generate what should be built next.
        </p>
        <div className="builder-stat-row" aria-label="Profile snapshot">
          <article className="builder-stat">
            <p className="builder-stat-label">Projects</p>
            <p className="builder-stat-value">{formatNumber(state.data.profile.counts.projects)}</p>
          </article>
          <article className="builder-stat">
            <p className="builder-stat-label">Publications</p>
            <p className="builder-stat-value">{formatNumber(state.data.profile.counts.publications)}</p>
          </article>
          <article className="builder-stat">
            <p className="builder-stat-label">Citations</p>
            <p className="builder-stat-value">{formatNumber(state.data.profile.counts.citations_total)}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Built Systems Track Record</h2>
        </header>
        <div className="capability-grid">
          {capabilityAnchors.map((track) => (
            <article key={track.challenge} className="capability-card">
              <p className="matrix-label">{track.title}</p>
              <h3>{track.statement}</h3>
              <p className="meta-line">{track.decisionQuestion}</p>
              <p className="meta-line">
                Build:{' '}
                {track.project ? (
                  <a
                    href={track.project.demo_url ?? track.project.html_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {track.project.name}
                  </a>
                ) : (
                  'unavailable'
                )}
              </p>
              <p className="meta-line">
                Evidence:{' '}
                {track.publication ? (
                  track.publication.url ? (
                    <a href={track.publication.url} target="_blank" rel="noreferrer">
                      {track.publication.title}
                    </a>
                  ) : (
                    track.publication.title
                  )
                ) : (
                  'unavailable'
                )}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="builder-layout" aria-label="Decision workflow">
        <aside className="panel builder-config-panel">
          <header className="panel-header">
            <h2>1. Configure</h2>
          </header>
          <p className="meta-line">
            Define one practical decision context and the operating constraints around it.
          </p>

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
              Horizon
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
                rows={4}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Describe the immediate operating issue and decision pressure."
              />
            </label>
          </div>

          <div className="builder-selection-strip">
            <p className="matrix-label">Current setup</p>
            <p>
              {selectedChallengeLabel} · {selectedGoalLabel} · {selectedHorizonLabel} ·{' '}
              {selectedRiskLabel}
            </p>
          </div>
        </aside>

        <section className="panel builder-output-panel">
          <header className="panel-header">
            <h2>2. Execution Brief</h2>
          </header>

          <p className="builder-output-lead">{blueprint.valueStatement}</p>

          <div className="builder-summary-grid">
            <article className="builder-summary-card">
              <p className="matrix-label">Decision</p>
              <h3>{blueprint.decisionQuestion}</h3>
            </article>
            <article className="builder-summary-card">
              <p className="matrix-label">System move</p>
              <h3>{blueprint.systemDirection}</h3>
            </article>
            <article className="builder-summary-card">
              <p className="matrix-label">Automation cadence</p>
              <h3>{blueprint.automationLoop}</h3>
            </article>
            <article className="builder-summary-card">
              <p className="matrix-label">Success gate</p>
              <h3>{blueprint.successMetric}</h3>
            </article>
          </div>

          <div className="builder-view-tabs" role="tablist" aria-label="Brief views">
            <button
              type="button"
              className={view === 'plan' ? 'builder-view-tab builder-view-tab-active' : 'builder-view-tab'}
              onClick={() => setView('plan')}
            >
              Plan
            </button>
            <button
              type="button"
              className={view === 'kpis' ? 'builder-view-tab builder-view-tab-active' : 'builder-view-tab'}
              onClick={() => setView('kpis')}
            >
              KPIs
            </button>
            <button
              type="button"
              className={view === 'risks' ? 'builder-view-tab builder-view-tab-active' : 'builder-view-tab'}
              onClick={() => setView('risks')}
            >
              Risks
            </button>
          </div>

          {view === 'plan' ? (
            <div className="builder-plan-columns">
              <article className="builder-block">
                <p className="matrix-label">Next 72 Hours</p>
                <ol className="builder-ordered-list">
                  {blueprint.immediateActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </article>

              <article className="builder-block">
                <p className="matrix-label">Timeline</p>
                <div className="builder-timeline">
                  {blueprint.executionPlan.map((step) => (
                    <article key={step.phase} className="builder-timeline-step">
                      <p className="sequence-index">{step.phase}</p>
                      <h3>{step.objective}</h3>
                      <p>{step.deliverable}</p>
                    </article>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          {view === 'kpis' ? (
            <div className="builder-plan-columns">
              <article className="builder-block">
                <p className="matrix-label">KPI Set</p>
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

              <article className="builder-block">
                <p className="matrix-label">Implementation + Evidence</p>
                {blueprint.matchedProject ? (
                  <p className="meta-line">
                    Build anchor:{' '}
                    <a
                      href={blueprint.matchedProject.demo_url ?? blueprint.matchedProject.html_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {blueprint.matchedProject.name}
                    </a>
                  </p>
                ) : (
                  <p className="meta-line">Build anchor unavailable.</p>
                )}
                {blueprint.matchedPublication ? (
                  <p className="meta-line">
                    Evidence anchor:{' '}
                    {blueprint.matchedPublication.url ? (
                      <a href={blueprint.matchedPublication.url} target="_blank" rel="noreferrer">
                        {blueprint.matchedPublication.title}
                      </a>
                    ) : (
                      blueprint.matchedPublication.title
                    )}
                  </p>
                ) : (
                  <p className="meta-line">Evidence anchor unavailable.</p>
                )}
              </article>
            </div>
          ) : null}

          {view === 'risks' ? (
            <div className="builder-plan-columns">
              <article className="builder-block">
                <p className="matrix-label">Risk Controls</p>
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

              <article className="builder-block">
                <p className="matrix-label">Handoff Checklist</p>
                <ul className="checklist-list">
                  {blueprint.handoffChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          ) : null}

          <div className="action-row builder-actions">
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
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Updated {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
