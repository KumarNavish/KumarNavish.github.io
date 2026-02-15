import { useCallback, useMemo, useRef, useState } from 'react'
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

type ClPloPresetId = 'quick' | 'default' | 'stress'

const CL_PLO_WORKSPACE_URL = 'https://kumarnavish.github.io/CL-PLO/#workspace'
const CL_PLO_PRESET_BUTTON_IDS: Record<ClPloPresetId, string> = {
  quick: 'apply-quick',
  default: 'apply-proposal',
  stress: 'apply-stress',
}

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
  const [copyStatus, setCopyStatus] = useState('')
  const [clPloStatus, setClPloStatus] = useState('Loading live CL-PLO workspace...')
  const [activeClPloPreset, setActiveClPloPreset] = useState<ClPloPresetId>('default')
  const clPloFrameRef = useRef<HTMLIFrameElement | null>(null)
  const clPloAutoRunRef = useRef(false)

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
  }

  function triggerClPloPreset(preset: ClPloPresetId, attempt = 0) {
    const frame = clPloFrameRef.current
    const frameWindow = frame?.contentWindow

    if (!frameWindow) {
      setClPloStatus('Workspace not ready yet. Try again in a moment.')
      return
    }

    try {
      const frameDocument = frameWindow.document
      const presetButton = frameDocument.getElementById(CL_PLO_PRESET_BUTTON_IDS[preset])
      const runButton = frameDocument.getElementById('run-demo')

      if (!presetButton || !runButton) {
        if (attempt >= 8) {
          setClPloStatus('Use the controls inside the workspace if auto-trigger is unavailable.')
          return
        }
        window.setTimeout(() => triggerClPloPreset(preset, attempt + 1), 220)
        return
      }

      ;(presetButton as HTMLElement).click()
      ;(runButton as HTMLElement).click()
      setActiveClPloPreset(preset)
      setClPloStatus(`Running ${preset === 'stress' ? 'Stress+' : preset} scenario...`)
    } catch {
      setClPloStatus('Interactive controls are available inside the workspace.')
    }
  }

  function handleClPloFrameLoad() {
    if (clPloAutoRunRef.current) {
      setClPloStatus('Workspace ready. Choose Quick, Default, or Stress+.')
      return
    }

    clPloAutoRunRef.current = true
    setClPloStatus('Workspace loaded. Running default scenario...')
    window.setTimeout(() => triggerClPloPreset('default'), 260)
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
          This is a working planning surface. Define the operating pressure, then inspect how decisions,
          controls, and evidence anchors change.
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

      <section className="panel clplo-panel" aria-label="Live CL-PLO run">
        <header className="panel-header">
          <h2>Live CL-PLO run</h2>
          <a className="action-link" href={CL_PLO_WORKSPACE_URL} target="_blank" rel="noreferrer">
            Open full workspace
          </a>
        </header>
        <p className="meta-line">
          Start immediately. Choose a mode and the run executes in place with updated charts and decision
          outputs.
        </p>
        <div className="clplo-toolbar" role="group" aria-label="CL-PLO run modes">
          <button
            type="button"
            className={activeClPloPreset === 'quick' ? 'track-chip track-chip-active' : 'track-chip'}
            onClick={() => triggerClPloPreset('quick')}
          >
            Quick
          </button>
          <button
            type="button"
            className={activeClPloPreset === 'default' ? 'track-chip track-chip-active' : 'track-chip'}
            onClick={() => triggerClPloPreset('default')}
          >
            Default
          </button>
          <button
            type="button"
            className={activeClPloPreset === 'stress' ? 'track-chip track-chip-active' : 'track-chip'}
            onClick={() => triggerClPloPreset('stress')}
          >
            Stress+
          </button>
        </div>
        <p className="clplo-status">{clPloStatus}</p>
        <iframe
          ref={clPloFrameRef}
          src={CL_PLO_WORKSPACE_URL}
          title="CL-PLO interactive workspace"
          className="clplo-frame"
          loading="lazy"
          onLoad={handleClPloFrameLoad}
        />
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
