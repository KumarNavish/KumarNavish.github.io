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

interface LabData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface Preset {
  id: string
  label: string
  challenge: ChallengeId
  goal: GoalId
  horizon: HorizonId
  risk: RiskId
  context: string
}

const PRESETS: Preset[] = [
  {
    id: 'model-regression',
    label: 'Model regression risk',
    challenge: 'continual_reliability',
    goal: 'pilot',
    horizon: '6w',
    risk: 'balanced',
    context: 'performance drift after each scheduled update',
  },
  {
    id: 'moderation-escalation',
    label: 'Moderation escalation',
    challenge: 'online_safety',
    goal: 'diagnose',
    horizon: '2w',
    risk: 'conservative',
    context: 'harmful threads escalate before intervention triggers fire',
  },
  {
    id: 'rollout-sequencing',
    label: 'Rollout sequencing',
    challenge: 'urban_transition',
    goal: 'production',
    horizon: '12w',
    risk: 'balanced',
    context: 'multiple city regions with uneven transition readiness',
  },
]

function describeReadiness(goal: GoalId, horizon: HorizonId, risk: RiskId): string {
  if (goal === 'production' && horizon === '12w' && risk !== 'aggressive') {
    return 'High deployment readiness with controlled scale-up.'
  }
  if (goal === 'pilot') {
    return 'Practical pilot readiness with measurable go / no-go criteria.'
  }
  if (risk === 'aggressive') {
    return 'Fast learning mode with explicit containment boundaries.'
  }
  return 'Focused discovery mode aimed at fast decision clarity.'
}

export function SystemProofPage() {
  const [challenge, setChallenge] = useState<ChallengeId>('continual_reliability')
  const [goal, setGoal] = useState<GoalId>('pilot')
  const [horizon, setHorizon] = useState<HorizonId>('6w')
  const [risk, setRisk] = useState<RiskId>('balanced')
  const [context, setContext] = useState('')

  const loadLab = useCallback(
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

  const state = useResource<LabData>(loadLab)

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
    return <LoadingBlock label="Loading live lab." />
  }

  if (!state.data || state.error || !blueprint) {
    return (
      <ErrorBlock
        label="Unable to load live lab."
        details={state.error ?? 'unknown live lab error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Live Lab</p>
        <h1>Turn a real problem into a delivery-ready plan.</h1>
        <p className="hero-copy">
          Choose a scenario or define your own. The lab returns a practical operating plan with
          implementation and evidence anchors.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Scenario Presets</h2>
        </header>

        <div className="track-row" role="tablist" aria-label="Scenario presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="track-chip"
              onClick={() => {
                setChallenge(preset.challenge)
                setGoal(preset.goal)
                setHorizon(preset.horizon)
                setRisk(preset.risk)
                setContext(preset.context)
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Build Your Plan</h2>
        </header>

        <div className="track-row" role="tablist" aria-label="Challenge type">
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
            Risk
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
            Context
            <input
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Describe the current operating pain point"
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Delivery Output</h2>
        </header>

        <div className="card-grid">
          <article className="item-card decision-output-card">
            <p className="eyebrow">Primary decision</p>
            <h3>{blueprint.decisionQuestion}</h3>
            <p>{blueprint.systemDirection}</p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Automation loop</p>
            <h3>{blueprint.automationLoop}</h3>
            <p>{blueprint.successMetric}</p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Readiness signal</p>
            <h3>{describeReadiness(goal, horizon, risk)}</h3>
            <p>{blueprint.valueStatement}</p>
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
      </section>

      <section className="panel">
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            Case studies
          </Link>
          <Link className="action-link" to="/projects">
            Projects archive
          </Link>
          <Link className="action-link" to="/publications">
            Publications archive
          </Link>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">Updated {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}</p>
      </section>
    </div>
  )
}
