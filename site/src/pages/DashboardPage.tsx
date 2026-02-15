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
import { runClPloProof, type ClPloProofConfig, type ProofStrategyId } from '../lib/clploProof'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface ScenarioPreset {
  id: string
  label: string
  challenge: ChallengeId
  goal: GoalId
  horizon: HorizonId
  risk: RiskId
  context: string
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'drift',
    label: 'Model drift after updates',
    challenge: 'continual_reliability',
    goal: 'pilot',
    horizon: '6w',
    risk: 'balanced',
    context: 'Recent updates improved latest-task score but retained-task quality is dropping.',
  },
  {
    id: 'moderation',
    label: 'Escalation before intervention',
    challenge: 'online_safety',
    goal: 'diagnose',
    horizon: '2w',
    risk: 'conservative',
    context: 'High-risk threads escalate faster than current moderation trigger thresholds.',
  },
  {
    id: 'rollout',
    label: 'Transition rollout sequencing',
    challenge: 'urban_transition',
    goal: 'production',
    horizon: '12w',
    risk: 'balanced',
    context: 'City regions have uneven readiness and service quality drops during rushed transitions.',
  },
]

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

function briefFileName(challenge: ChallengeId, horizon: HorizonId): string {
  return `decision-brief-${challenge}-${horizon}.md`
}

function labelFor<T extends string>(options: Array<{ id: T; label: string }>, id: T): string {
  return options.find((option) => option.id === id)?.label ?? id
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

function mapScenarioToProofPreset(presetId: string): ProofPresetId {
  if (presetId === 'moderation') {
    return 'stress'
  }
  if (presetId === 'rollout') {
    return 'quick'
  }
  return 'default'
}

export function DashboardPage() {
  const [challenge, setChallenge] = useState<ChallengeId>('continual_reliability')
  const [goal, setGoal] = useState<GoalId>('pilot')
  const [horizon, setHorizon] = useState<HorizonId>('6w')
  const [risk, setRisk] = useState<RiskId>('balanced')
  const [context, setContext] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [proofPreset, setProofPreset] = useState<ProofPresetId>('default')
  const [proofRunVersion, setProofRunVersion] = useState(0)

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

  const activePresetId = useMemo(
    () =>
      SCENARIO_PRESETS.find(
        (preset) =>
          preset.challenge === challenge &&
          preset.goal === goal &&
          preset.horizon === horizon &&
          preset.risk === risk &&
          preset.context.trim() === context.trim(),
      )?.id ?? null,
    [challenge, context, goal, horizon, risk],
  )

  function applyPreset(preset: ScenarioPreset) {
    setChallenge(preset.challenge)
    setGoal(preset.goal)
    setHorizon(preset.horizon)
    setRisk(preset.risk)
    setContext(preset.context)
    setCopyStatus('')
    setProofPreset(mapScenarioToProofPreset(preset.id))
    setProofRunVersion((value) => value + 1)
  }

  async function handleCopyBrief() {
    if (!briefMarkdown) {
      return
    }

    try {
      await navigator.clipboard.writeText(briefMarkdown)
      setCopyStatus('Brief copied to clipboard.')
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
    return <LoadingBlock label="Loading overview." />
  }

  if (!state.data || state.error || !blueprint) {
    return (
      <ErrorBlock
        label="Unable to load overview."
        details={state.error ?? 'unknown overview error'}
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
        <p className="eyebrow">Overview</p>
        <h1>Turn one concrete problem statement into an execution-ready strategy.</h1>
        <p className="hero-copy">
          Define the operating pressure, then move from decision framing to live validation in a single
          flow.
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
          <h2>Fast scenario presets</h2>
        </header>
        <div className="track-row" role="tablist" aria-label="Scenario presets">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={preset.id === activePresetId ? 'track-chip track-chip-active' : 'track-chip'}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="builder-layout" aria-label="Decision workflow">
        <aside className="panel builder-config-panel">
          <header className="panel-header">
            <h2>1. Input</h2>
          </header>
          <p className="meta-line">
            Keep input narrow: one decision, one operational context, one risk posture.
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
                rows={5}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Describe what is breaking, where risk is rising, and what decision is blocked."
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
            <h2>2. Generated strategy</h2>
          </header>

          <article className="builder-primary-card">
            <p className="matrix-label">Decision now</p>
            <h3>{blueprint.decisionQuestion}</h3>
            <p className="meta-line">{blueprint.valueStatement}</p>
          </article>

          <div className="builder-summary-grid">
            <article className="builder-summary-card">
              <p className="matrix-label">Operating priority</p>
              <h3>{blueprint.operatingPriority}</h3>
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

          <section className="builder-signal-panel" aria-label="Detected operating signals">
            <p className="matrix-label">Detected operating signals</p>
            <div className="pill-row">
              {blueprint.contextSignals.map((signal) => (
                <span key={signal} className="pill">
                  {signal}
                </span>
              ))}
            </div>
          </section>

          <section className="builder-validation-shell" aria-label="In-context CL-PLO proof">
            <div className="builder-validation-head">
              <div>
                <p className="matrix-label">3. Validate in context</p>
                <h3>Interactive CL-PLO proof</h3>
              </div>
              <a href={CL_PLO_PROJECT_URL} target="_blank" rel="noreferrer" className="builder-inline-link">
                Full CL-PLO project
              </a>
            </div>
            <p className="meta-line">
              Same regime path, three update rules. Switch mode and compare return, drawdown, and stress
              behavior instantly.
            </p>

            <div className="clplo-toolbar" role="group" aria-label="Proof modes">
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
              <svg viewBox="0 0 680 220" className="proof-line-chart" role="img" aria-label="CL-PLO value paths">
                <line x1="0" y1="0" x2="0" y2="220" className="proof-grid-line" />
                <line x1="0" y1="220" x2="680" y2="220" className="proof-grid-line" />
                {proofResult.strategies.map((strategy) => (
                  <path
                    key={strategy.id}
                    d={linePath(strategy.values, 680, 220, proofRange.min, proofRange.max)}
                    stroke={STRATEGY_COLORS[strategy.id]}
                    strokeWidth={strategy.id === proofResult.winner.id ? 2.6 : 1.9}
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

            <div className="proof-metric-grid" aria-label="Proof metrics">
              {proofResult.strategies.map((strategy) => (
                <article
                  key={strategy.id}
                  className={
                    strategy.id === proofResult.winner.id
                      ? 'proof-metric-card proof-metric-card-active'
                      : 'proof-metric-card'
                  }
                >
                  <p className="matrix-label">{strategy.label}</p>
                  <p className="proof-metric-main">{formatPercent(strategy.metrics.total_return)}</p>
                  <p className="meta-line">max drawdown {formatPercent(strategy.metrics.max_drawdown)}</p>
                  <p className="meta-line">stress sharpe {strategy.metrics.stress_sharpe.toFixed(2)}</p>
                </article>
              ))}
            </div>

            <p className="proof-decision-line">
              <strong>{proofResult.winner.label} is recommended on this run.</strong> {proofResult.decision_note}
            </p>
          </section>

          <div className="builder-plan-columns">
            <article className="builder-block">
              <p className="matrix-label">Next 72 hours</p>
              <ol className="builder-ordered-list">
                {blueprint.immediateActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </article>

            <article className="builder-block">
              <p className="matrix-label">Implementation + evidence anchors</p>
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

          <article className="builder-block">
            <p className="matrix-label">Execution timeline</p>
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

          <div className="builder-plan-columns">
            <article className="builder-block">
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

            <article className="builder-block">
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

          <article className="builder-block">
            <p className="matrix-label">Handoff checklist</p>
            <ul className="checklist-list">
              {blueprint.handoffChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

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
        <p className="meta-line">Updated {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}</p>
      </section>
    </div>
  )
}
