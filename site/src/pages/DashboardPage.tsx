import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'
import { fetchProfileApi, fetchProjectsApi, fetchPublicationsApi } from '../lib/api'
import { runRolloutProof, runSafetyProof } from '../lib/capabilityProofs'
import { runClPloProof, type ClPloProofConfig, type ProofStrategyId } from '../lib/clploProof'
import {
  createDecisionBlueprint,
  type ChallengeId,
  type GoalId,
  type HorizonId,
  type RiskId,
} from '../lib/decisionEngine'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

type ScenarioPresetId = 'drift' | 'moderation' | 'rollout'

type ProofPresetId = 'quick' | 'default' | 'stress'

interface ScenarioPreset {
  id: ScenarioPresetId
  label: string
  claim: string
  context: string
  challenge: ChallengeId
  goal: GoalId
  horizon: HorizonId
  risk: RiskId
  proof_preset: ProofPresetId
  safety: {
    threshold: number
    budget: number
  }
  rollout: {
    readiness_weight: number
    cost_weight: number
    risk_weight: number
  }
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'drift',
    label: 'Model drift after updates',
    claim: 'Stabilize sequential updates without sacrificing retained performance.',
    context:
      'Recent updates improved latest-task quality, but retained-task reliability is slipping across the last three cycles.',
    challenge: 'continual_reliability',
    goal: 'pilot',
    horizon: '6w',
    risk: 'balanced',
    proof_preset: 'default',
    safety: {
      threshold: 0.62,
      budget: 0.24,
    },
    rollout: {
      readiness_weight: 0.5,
      cost_weight: 0.25,
      risk_weight: 0.25,
    },
  },
  {
    id: 'moderation',
    label: 'Escalation before intervention',
    claim: 'Tune moderation policy to reduce harmful escalation with explicit precision/recall tradeoffs.',
    context:
      'High-risk interactions escalate before intervention in a subset of conversations that currently fall below policy thresholds.',
    challenge: 'online_safety',
    goal: 'diagnose',
    horizon: '2w',
    risk: 'conservative',
    proof_preset: 'stress',
    safety: {
      threshold: 0.58,
      budget: 0.3,
    },
    rollout: {
      readiness_weight: 0.4,
      cost_weight: 0.2,
      risk_weight: 0.4,
    },
  },
  {
    id: 'rollout',
    label: 'Transition rollout sequencing',
    claim: 'Prioritize rollout order under readiness, cost, and risk constraints.',
    context:
      'Regions have uneven transition readiness, and service quality degrades when rollout starts in low-stability zones.',
    challenge: 'urban_transition',
    goal: 'production',
    horizon: '12w',
    risk: 'balanced',
    proof_preset: 'quick',
    safety: {
      threshold: 0.63,
      budget: 0.2,
    },
    rollout: {
      readiness_weight: 0.45,
      cost_weight: 0.35,
      risk_weight: 0.2,
    },
  },
]

const INITIAL_SCENARIO = SCENARIO_PRESETS[0]

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

function getScenarioById(id: ScenarioPresetId): ScenarioPreset {
  return SCENARIO_PRESETS.find((preset) => preset.id === id) ?? INITIAL_SCENARIO
}

function createDecisionMemo(input: {
  scenario: ScenarioPreset
  winnerLabel: string
  winnerReturn: number
  winnerDrawdown: number
  recommendation: string
  topActions: string[]
  topSequence: string[]
  projectAnchor: string | null
  publicationAnchor: string | null
}): string {
  const lines = [
    `Scenario: ${input.scenario.label}`,
    `Claim: ${input.scenario.claim}`,
    `Winning strategy: ${input.winnerLabel}`,
    `Return: ${formatPercent(input.winnerReturn)} | Drawdown: ${formatPercent(input.winnerDrawdown)}`,
    `Safety recommendation: ${input.recommendation}`,
    `Rollout sequence: ${input.topSequence.join(' -> ')}`,
    '',
    'First actions:',
    ...input.topActions.map((action, index) => `${index + 1}. ${action}`),
  ]

  if (input.projectAnchor) {
    lines.push('', `Build anchor: ${input.projectAnchor}`)
  }

  if (input.publicationAnchor) {
    lines.push(`Evidence anchor: ${input.publicationAnchor}`)
  }

  return `${lines.join('\n')}\n`
}

export function DashboardPage() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioPresetId>(INITIAL_SCENARIO.id)
  const [proofPreset, setProofPreset] = useState<ProofPresetId>(INITIAL_SCENARIO.proof_preset)
  const [proofRunVersion, setProofRunVersion] = useState(0)
  const [copyStatus, setCopyStatus] = useState('')

  const activeScenario = useMemo(() => getScenarioById(activeScenarioId), [activeScenarioId])

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
        challenge: activeScenario.challenge,
        goal: activeScenario.goal,
        horizon: activeScenario.horizon,
        risk: activeScenario.risk,
        context: activeScenario.context,
      },
      {
        projects: state.data.projects.items,
        publications: state.data.publications.items,
      },
    )
  }, [activeScenario, state.data])

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

  const safetyProof = useMemo(
    () =>
      runSafetyProof({
        threshold: activeScenario.safety.threshold,
        intervention_budget: activeScenario.safety.budget,
      }),
    [activeScenario],
  )

  const rolloutProof = useMemo(
    () =>
      runRolloutProof({
        readiness_weight: activeScenario.rollout.readiness_weight,
        cost_weight: activeScenario.rollout.cost_weight,
        risk_weight: activeScenario.rollout.risk_weight,
      }),
    [activeScenario],
  )

  const decisionMemo = useMemo(() => {
    if (!blueprint) {
      return ''
    }

    return createDecisionMemo({
      scenario: activeScenario,
      winnerLabel: proofResult.winner.label,
      winnerReturn: proofResult.winner.metrics.total_return,
      winnerDrawdown: proofResult.winner.metrics.max_drawdown,
      recommendation: safetyProof.recommendation,
      topActions: blueprint.immediateActions.slice(0, 3),
      topSequence: rolloutProof.top_sequence,
      projectAnchor: blueprint.matchedProject?.name ?? null,
      publicationAnchor: blueprint.matchedPublication?.title ?? null,
    })
  }, [activeScenario, blueprint, proofResult.winner, rolloutProof.top_sequence, safetyProof.recommendation])

  function applyScenario(preset: ScenarioPreset) {
    setActiveScenarioId(preset.id)
    setProofPreset(preset.proof_preset)
    setProofRunVersion((value) => value + 1)
    setCopyStatus('')
  }

  async function handleCopyMemo() {
    if (!decisionMemo) {
      return
    }

    try {
      await navigator.clipboard.writeText(decisionMemo)
      setCopyStatus('Decision memo copied.')
    } catch {
      setCopyStatus('Clipboard unavailable on this browser.')
    }
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

  return (
    <div className="page builder-page overview-flow">
      <section className="hero hero-primary builder-hero overview-hero">
        <p className="eyebrow">Overview</p>
        <h1>I build decision systems that stay useful under change.</h1>
        <p className="hero-copy">
          Choose a live scenario, run one core proof, then inspect the operational implications.
        </p>

        <div className="overview-fact-row" aria-label="Portfolio context">
          <article className="overview-fact">
            <p className="matrix-label">Featured builds</p>
            <p>{formatNumber(state.data.profile.counts.featured_projects)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Publications</p>
            <p>{formatNumber(state.data.profile.counts.publications)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Live mode</p>
            <p>Interactive proof + actionable memo</p>
          </article>
        </div>
      </section>

      <section className="panel narrative-path-panel">
        <header className="panel-header">
          <h2>Interaction Path</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">Step 1</p>
            <h3>Frame the operating pressure</h3>
            <p>Use scenario presets to anchor the problem in real constraints.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">Step 2</p>
            <h3>Validate with one core proof</h3>
            <p>Run CL-PLO under drift and stress to compare decision policy behavior.</p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">Step 3</p>
            <h3>Move to deployment context</h3>
            <p>
              Carry implications into the case layer, including the in-context logistics simulator.
            </p>
          </article>
        </div>
      </section>

      <section className="panel scenario-panel">
        <header className="panel-header">
          <h2>Start with a scenario</h2>
        </header>

        <div className="track-row" role="tablist" aria-label="Scenario presets">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={preset.id === activeScenario.id ? 'track-chip track-chip-active' : 'track-chip'}
              onClick={() => applyScenario(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <p className="scenario-claim">{activeScenario.claim}</p>
        <p className="scenario-context">{activeScenario.context}</p>
      </section>

      <section className="panel proof-focus-panel" aria-label="Primary proof">
        <header className="proof-focus-header">
          <p className="matrix-label">Primary proof · CL-PLO</p>
          <h2>Policy comparison under drift and stress</h2>
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

      <section className="implication-grid" aria-label="Scenario implications">
        <article className="proof-module proof-module-tight implication-card">
          <p className="matrix-label">Implication 1 · Safety posture</p>
          <h2>Intervention profile for this scenario</h2>
          <div className="proof-metric-grid">
            <article className="proof-metric-card">
              <p className="matrix-label">Precision</p>
              <p className="proof-metric-main">{formatPercent(safetyProof.precision)}</p>
            </article>
            <article className="proof-metric-card">
              <p className="matrix-label">Recall</p>
              <p className="proof-metric-main">{formatPercent(safetyProof.recall)}</p>
            </article>
            <article className="proof-metric-card">
              <p className="matrix-label">Intercepted escalations</p>
              <p className="proof-metric-main">{formatNumber(safetyProof.prevented_harmful)}</p>
            </article>
          </div>
          <p className="proof-claim-line">{safetyProof.recommendation}</p>
        </article>

        <article className="proof-module proof-module-tight implication-card">
          <p className="matrix-label">Implication 2 · Rollout sequence</p>
          <h2>First-wave order under current constraints</h2>
          <ol className="proof-rank-list">
            {rolloutProof.top_sequence.map((regionName) => (
              <li key={regionName}>{regionName}</li>
            ))}
          </ol>
          <p className="proof-claim-line">
            Stability score {formatPercent(rolloutProof.stability_score)} with expected cost pressure{' '}
            {formatPercent(rolloutProof.expected_cost_pressure)}.
          </p>
          <p className="meta-line">
            Need deeper operational planning?{' '}
            <Link to="/work#case-urban-transition-planning" className="builder-inline-link">
              Open the in-context logistics simulator
            </Link>
            .
          </p>
        </article>
      </section>

      <section className="panel outcome-panel" aria-label="Actionable synthesis">
        <header className="panel-header">
          <h2>Recommended next move</h2>
          <button type="button" className="action-link" onClick={handleCopyMemo}>
            Copy decision memo
          </button>
        </header>

        <article className="builder-primary-card">
          <p className="matrix-label">Decision now</p>
          <h3>{blueprint.decisionQuestion}</h3>
          <p className="meta-line">{blueprint.valueStatement}</p>
        </article>

        <div className="outcome-grid">
          <article className="builder-block">
            <p className="matrix-label">First actions</p>
            <ol className="builder-ordered-list">
              {blueprint.immediateActions.slice(0, 3).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </article>

          <article className="builder-block">
            <p className="matrix-label">Anchors</p>
            {blueprint.matchedProject ? (
              <p className="meta-line">
                Build:{' '}
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
                Evidence:{' '}
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

        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            See applied case studies
          </Link>
          <Link className="action-link" to="/projects">
            Browse archive
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
