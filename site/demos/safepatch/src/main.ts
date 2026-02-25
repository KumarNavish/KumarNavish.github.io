import 'katex/dist/katex.min.css'

import { Halfspace, Vec2, normalize, scale, vec } from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer } from './render'
import { ProofFrameUi, UIController } from './ui'

const TRANSITION_MS = 1120
const PROJECTION_TOLERANCE = 1e-6

const DEFAULT_CONTROLS: ControlSnapshot = {
  pressure: 0.56,
  urgency: 0.58,
  strictness: 0.62,
}

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'toxicity budget',
    normal: normalize(vec(0.94, 0.34)),
    bound: 0.44,
    active: true,
  },
  {
    id: 'g2',
    label: 'hallucination budget',
    normal: normalize(vec(0.24, 1)),
    bound: 0.39,
    active: true,
  },
  {
    id: 'g3',
    label: 'privacy guardrail',
    normal: normalize(vec(-0.92, 0.38)),
    bound: 0.54,
    active: true,
  },
  {
    id: 'g4',
    label: 'style drift guardrail',
    normal: normalize(vec(0.76, -0.65)),
    bound: 0.42,
    active: true,
  },
]

const BASE_BOUNDS = new Map<string, number>(baseHalfspaces.map((halfspace) => [halfspace.id, halfspace.bound]))

const STRICTNESS_SENSITIVITY: Record<string, number> = {
  g1: 0.9,
  g2: 1.1,
  g3: 0.75,
  g4: 1.4,
}

interface QueueReplay {
  rawSeries: number[]
  safeSeries: number[]
  overloadThreshold: number
  peakRaw: number
  peakSafe: number
  rawBreachMinutes: number
  safeBreachMinutes: number
  rawEscalations: number
  safeEscalations: number
}

interface ControlSnapshot {
  pressure: number
  urgency: number
  strictness: number
}

interface ScenarioSignals {
  eta: number
  gradient: Vec2
  strictnessScale: number
}

interface DeploymentDecision {
  ship: boolean
  reason: string
}

interface ScenarioEvaluation {
  controls: ControlSnapshot
  scenarioLabel: string
  halfspaces: Halfspace[]
  scenarioSignals: ScenarioSignals
  projectedStep: ReturnType<typeof computeProjectedStep>
  queueReplay: QueueReplay
  deployment: DeploymentDecision
  violatedRaw: number
  violatedSafe: number
  retainedValueRatio: number
  rawRiskRatio: number
  safeRiskRatio: number
  readinessScore: number
  readinessNote: string
}

interface GuidanceBundle {
  recommendedControlsText: string
  actionItems: string[]
  memoText: string
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function copyHalfspaces(halfspaces: Halfspace[]): Halfspace[] {
  return halfspaces.map((halfspace) => ({
    ...halfspace,
    normal: { ...halfspace.normal },
  }))
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

function percent(value: number): string {
  return `${Math.round(clamp(value) * 100)}%`
}

function scenarioFromControls(controls: ControlSnapshot): ScenarioSignals {
  const pressure = clamp(controls.pressure)
  const urgency = clamp(controls.urgency)
  const strictness = clamp(controls.strictness)

  const eta = 0.45 + 2.35 * urgency + 0.78 * pressure
  const strictnessScale = 1.42 - 1.08 * strictness
  const angle = degreesToRadians(206 + pressure * 122 + urgency * 30 - strictness * 20)
  const magnitude = 0.84 + pressure * 1.65 + urgency * 1.12
  const gradient = scale(normalize(vec(Math.cos(angle), Math.sin(angle))), magnitude)

  return { eta, strictnessScale, gradient }
}

function boundScaleForStrictness(id: string, strictnessScale: number): number {
  const sensitivity = STRICTNESS_SENSITIVITY[id] ?? 0.7
  return clamp(1 + sensitivity * (strictnessScale - 1), 0.24, 1.95)
}

function scenarioName(pressure: number): string {
  if (pressure < 0.38) {
    return 'normal traffic'
  }
  if (pressure < 0.75) {
    return 'spike traffic'
  }
  return 'incident traffic'
}

function buildQueueReplay(
  controls: ControlSnapshot,
  rawRiskRatio: number,
  safeRiskRatio: number,
  retainedValueRatio: number,
): QueueReplay {
  const minutes = 18
  const overloadThreshold = 520
  const pressure = clamp(controls.pressure)
  const urgency = clamp(controls.urgency)
  const initialQueue = Math.round(185 + pressure * 132 + urgency * 42)

  const rawSeries: number[] = [initialQueue]
  const safeSeries: number[] = [initialQueue]

  for (let minute = 1; minute < minutes; minute += 1) {
    const pulse = 34 * Math.exp(-((minute - 8) ** 2) / 9)
    const arrivals = 318 + pressure * 176 + urgency * 58 + pulse

    const rawCapacity = 392 + retainedValueRatio * 86 - rawRiskRatio * 238 - pressure * 21
    const safeCapacity = 392 + retainedValueRatio * 73 - safeRiskRatio * 88 - pressure * 14

    const rawPrev = rawSeries[minute - 1]
    const safePrev = safeSeries[minute - 1]

    rawSeries.push(Math.max(66, rawPrev + arrivals - rawCapacity))
    safeSeries.push(Math.max(58, safePrev + arrivals - safeCapacity))
  }

  const peakRaw = Math.round(Math.max(...rawSeries))
  const peakSafe = Math.round(Math.max(...safeSeries))
  const rawBreachMinutes = rawSeries.filter((value) => value > overloadThreshold).length
  const safeBreachMinutes = safeSeries.filter((value) => value > overloadThreshold).length

  const rawOverflow = rawSeries.reduce((sum, value) => sum + Math.max(0, value - overloadThreshold), 0)
  const safeOverflow = safeSeries.reduce((sum, value) => sum + Math.max(0, value - overloadThreshold), 0)

  return {
    rawSeries,
    safeSeries,
    overloadThreshold,
    peakRaw,
    peakSafe,
    rawBreachMinutes,
    safeBreachMinutes,
    rawEscalations: Math.round(rawBreachMinutes * 16 + rawOverflow / 34),
    safeEscalations: Math.round(safeBreachMinutes * 16 + safeOverflow / 34),
  }
}

function exportDecision(payload: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  link.href = url
  link.download = `safepatch-decision-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function deploymentDecision(
  projectedShipPossible: boolean,
  projectedReason: string | null,
  queueReplay: QueueReplay,
  retainedValueRatio: number,
): DeploymentDecision {
  if (!projectedShipPossible) {
    return {
      ship: false,
      reason: projectedReason ?? 'No safe correction exists under the current policy limits.',
    }
  }

  if (retainedValueRatio < 0.42) {
    return {
      ship: false,
      reason: `Correction keeps only ${Math.round(retainedValueRatio * 100)}% of intended gain, so value is too low.`,
    }
  }

  if (
    queueReplay.safeBreachMinutes >= queueReplay.rawBreachMinutes &&
    queueReplay.safeEscalations >= queueReplay.rawEscalations
  ) {
    return {
      ship: false,
      reason: 'Correction is safe but does not lower production risk enough.',
    }
  }

  return {
    ship: true,
    reason: 'Safe correction keeps value and lowers expected incident pressure.',
  }
}

function scoreReadiness(
  deployment: DeploymentDecision,
  replay: QueueReplay,
  safeRiskRatio: number,
  retainedValueRatio: number,
  violatedSafe: number,
): number {
  const escalationDropRatio =
    (replay.rawEscalations - replay.safeEscalations) / Math.max(replay.rawEscalations, 1)
  const breachDropRatio =
    (replay.rawBreachMinutes - replay.safeBreachMinutes) / Math.max(replay.rawBreachMinutes, 1)
  const peakDropRatio = (replay.peakRaw - replay.peakSafe) / Math.max(replay.peakRaw, 1)

  const riskClearance = clamp(1 - safeRiskRatio * 2.2)
  const retentionScore = clamp(retainedValueRatio)

  let score =
    100 *
    (0.34 * riskClearance +
      0.24 * clamp(escalationDropRatio, 0, 1) +
      0.14 * clamp(breachDropRatio, 0, 1) +
      0.08 * clamp(peakDropRatio, 0, 1) +
      0.2 * retentionScore)

  if (!deployment.ship) {
    score *= 0.72
  }

  if (violatedSafe > 0) {
    score = Math.min(score, 44)
  }

  return Math.round(clamp(score, 0, 100))
}

function describeReadiness(
  score: number,
  deployment: DeploymentDecision,
  violatedSafe: number,
  replay: QueueReplay,
): string {
  if (violatedSafe > 0) {
    return 'Not ready: projected patch still crosses at least one guardrail.'
  }

  if (!deployment.ship) {
    return 'Not ready: keep deployment on hold and revise operating point.'
  }

  if (score >= 82) {
    return `High confidence: replay shows ${replay.rawEscalations - replay.safeEscalations} fewer escalations.`
  }

  if (score >= 66) {
    return 'Conditional ship: rollout via canary and monitor queue alarms.'
  }

  return 'Borderline ship: proceed only with strict rollback triggers.'
}

function evaluateScenario(controls: ControlSnapshot): ScenarioEvaluation {
  const normalizedControls: ControlSnapshot = {
    pressure: clamp(controls.pressure),
    urgency: clamp(controls.urgency),
    strictness: clamp(controls.strictness),
  }

  const scenarioSignals = scenarioFromControls(normalizedControls)
  const halfspaces = copyHalfspaces(baseHalfspaces)

  for (const halfspace of halfspaces) {
    const baseBound = BASE_BOUNDS.get(halfspace.id)
    if (baseBound === undefined) {
      continue
    }
    const scaledBound = baseBound * boundScaleForStrictness(halfspace.id, scenarioSignals.strictnessScale)
    const pressurePenalty =
      normalizedControls.pressure * normalizedControls.strictness * (halfspace.id === 'g2' ? 0.24 : 0.2)
    halfspace.bound = scaledBound - pressurePenalty
    halfspace.active = true
  }

  const projectedStep = computeProjectedStep({
    gradient: scenarioSignals.gradient,
    eta: scenarioSignals.eta,
    halfspaces,
    tolerance: PROJECTION_TOLERANCE,
  })

  const largestBudget = Math.max(0.1, ...halfspaces.map((halfspace) => Math.abs(halfspace.bound)))
  const rawRiskRatio = Math.max(0, projectedStep.maxViolationStep0) / largestBudget
  const safeRiskRatio = Math.max(0, projectedStep.maxViolationProjected) / largestBudget
  const retainedValueRatio = clamp(projectedStep.descentRetainedRatio, 0, 1.5)

  const queueReplay = buildQueueReplay(normalizedControls, rawRiskRatio, safeRiskRatio, retainedValueRatio)
  const deployment = deploymentDecision(projectedStep.ship, projectedStep.reason, queueReplay, retainedValueRatio)

  const violatedRaw = projectedStep.diagnostics.filter(
    (diagnostic) => diagnostic.active && diagnostic.violationStep0 > PROJECTION_TOLERANCE,
  ).length
  const violatedSafe = projectedStep.diagnostics.filter(
    (diagnostic) => diagnostic.active && diagnostic.violationProjected > PROJECTION_TOLERANCE,
  ).length

  const readinessScore = scoreReadiness(deployment, queueReplay, safeRiskRatio, retainedValueRatio, violatedSafe)
  const readinessNote = describeReadiness(readinessScore, deployment, violatedSafe, queueReplay)

  return {
    controls: normalizedControls,
    scenarioLabel: scenarioName(normalizedControls.pressure),
    halfspaces,
    scenarioSignals,
    projectedStep,
    queueReplay,
    deployment,
    violatedRaw,
    violatedSafe,
    retainedValueRatio,
    rawRiskRatio,
    safeRiskRatio,
    readinessScore,
    readinessNote,
  }
}

function optimizationObjective(evaluation: ScenarioEvaluation): number {
  const escalationsSaved = evaluation.queueReplay.rawEscalations - evaluation.queueReplay.safeEscalations
  const breachSaved = evaluation.queueReplay.rawBreachMinutes - evaluation.queueReplay.safeBreachMinutes
  const peakSaved = evaluation.queueReplay.peakRaw - evaluation.queueReplay.peakSafe

  const shipBonus = evaluation.deployment.ship ? 18 : 0
  const violationPenalty = evaluation.violatedSafe > 0 ? 36 : 0
  const retentionPenalty = Math.max(0, 0.55 - evaluation.retainedValueRatio) * 48

  return (
    evaluation.readinessScore +
    shipBonus +
    escalationsSaved * 0.11 +
    breachSaved * 1.4 +
    peakSaved * 0.03 -
    violationPenalty -
    retentionPenalty
  )
}

function findBestControls(pressure: number, current: ControlSnapshot): ScenarioEvaluation {
  let best = evaluateScenario(current)
  let bestScore = optimizationObjective(best)
  let bestDistance = 0

  for (let urgencyStep = 24; urgencyStep <= 96; urgencyStep += 4) {
    for (let strictnessStep = 24; strictnessStep <= 96; strictnessStep += 4) {
      const candidateControls: ControlSnapshot = {
        pressure,
        urgency: urgencyStep / 100,
        strictness: strictnessStep / 100,
      }

      const candidate = evaluateScenario(candidateControls)
      const candidateScore = optimizationObjective(candidate)
      const candidateDistance =
        Math.abs(candidate.controls.urgency - current.urgency) +
        Math.abs(candidate.controls.strictness - current.strictness)

      const better = candidateScore > bestScore + 0.0001
      const tieBreak = Math.abs(candidateScore - bestScore) <= 0.0001 && candidateDistance < bestDistance

      if (better || tieBreak) {
        best = candidate
        bestScore = candidateScore
        bestDistance = candidateDistance
      }
    }
  }

  return best
}

function buildGuidance(current: ScenarioEvaluation, recommended: ScenarioEvaluation): GuidanceBundle {
  const nearRecommendation =
    Math.abs(current.controls.urgency - recommended.controls.urgency) < 0.02 &&
    Math.abs(current.controls.strictness - recommended.controls.strictness) < 0.02

  const recommendationText = nearRecommendation
    ? `Current settings are already close to the best operating point for ${current.scenarioLabel}.`
    : `Recommended for ${current.scenarioLabel}: urgency ${percent(recommended.controls.urgency)}, strictness ${percent(recommended.controls.strictness)} (readiness ${recommended.readinessScore}/100).`

  const actionItems: string[] = []

  if (!current.deployment.ship && recommended.deployment.ship) {
    actionItems.push(
      `Click Auto-tune, then run urgency ${percent(recommended.controls.urgency)} and strictness ${percent(recommended.controls.strictness)} to move this patch to ship-ready.`,
    )
  } else if (!current.deployment.ship) {
    actionItems.push('Do not ship in this traffic profile. Keep hold, then reduce load or revise the patch objective.')
  } else {
    actionItems.push(
      `Ship projected patch through a 20% canary. Replay predicts escalations ${current.queueReplay.rawEscalations} -> ${current.queueReplay.safeEscalations}.`,
    )
  }

  if (current.queueReplay.safeBreachMinutes > 0) {
    actionItems.push(
      `Set rollback trigger: queue above ${current.queueReplay.overloadThreshold} for 2 consecutive minutes during canary.`,
    )
  } else {
    actionItems.push(`Keep queue alarm at ${current.queueReplay.overloadThreshold}. Safe replay shows zero breach minutes.`)
  }

  actionItems.push(
    `Attach decision export to release ticket (guardrail violations ${current.violatedRaw} -> ${current.violatedSafe}, retained gain ${Math.round(current.retainedValueRatio * 100)}%).`,
  )

  const memoText = [
    `SafePatch ${current.deployment.ship ? 'SHIP' : 'HOLD'} recommendation for ${current.scenarioLabel}.`,
    `Current controls: urgency ${percent(current.controls.urgency)}, strictness ${percent(current.controls.strictness)}.`,
    `Projection clears guardrails ${current.violatedRaw} -> ${current.violatedSafe} and retains ${Math.round(current.retainedValueRatio * 100)}% of intended gain.`,
    `Queue replay: peak ${current.queueReplay.peakRaw} -> ${current.queueReplay.peakSafe}, breach minutes ${current.queueReplay.rawBreachMinutes} -> ${current.queueReplay.safeBreachMinutes}, escalations ${current.queueReplay.rawEscalations} -> ${current.queueReplay.safeEscalations}.`,
    `Reason: ${current.deployment.reason}`,
    `Recommended point: urgency ${percent(recommended.controls.urgency)}, strictness ${percent(recommended.controls.strictness)} (readiness ${recommended.readinessScore}/100).`,
  ].join(' ')

  return {
    recommendedControlsText: recommendationText,
    actionItems,
    memoText,
  }
}

function toFrameUi(evaluation: ScenarioEvaluation, guidance: GuidanceBundle): ProofFrameUi {
  const replay = evaluation.queueReplay
  const retainedPercent = Math.round(clamp(evaluation.retainedValueRatio, 0, 1.4) * 100)

  const problemText = `Problem: under ${evaluation.scenarioLabel}, the raw patch creates ${evaluation.violatedRaw} guardrail violations and ${replay.rawBreachMinutes} queue breach minutes.`
  const mechanismText = `Method: SafePatch projects the raw patch to the nearest safe point (${evaluation.violatedRaw} -> ${evaluation.violatedSafe} violations) while retaining ${retainedPercent}% of intended gain.`

  const impactText = evaluation.deployment.ship
    ? `Impact: replay predicts peak queue ${replay.peakRaw} -> ${replay.peakSafe} and escalations ${replay.rawEscalations} -> ${replay.safeEscalations}.`
    : `Impact: hold deployment. ${evaluation.deployment.reason}`

  return {
    decisionTone: evaluation.deployment.ship ? 'ship' : 'hold',
    decisionTitle: evaluation.deployment.ship ? 'Ship projected patch' : 'Hold this patch',
    decisionDetail: `${evaluation.deployment.reason} Readiness ${evaluation.readinessScore}/100.`,
    problemText,
    mechanismText,
    impactText,
    peakValueText: `${replay.peakRaw.toLocaleString()} -> ${replay.peakSafe.toLocaleString()}`,
    breachValueText: `${replay.rawBreachMinutes.toLocaleString()} -> ${replay.safeBreachMinutes.toLocaleString()}`,
    escalationValueText: `${replay.rawEscalations.toLocaleString()} -> ${replay.safeEscalations.toLocaleString()}`,
    guardrailValueText: `${evaluation.violatedRaw} -> ${evaluation.violatedSafe}`,
    retainedValueText: `${retainedPercent}%`,
    readinessScoreText: `${evaluation.readinessScore}`,
    readinessNote: evaluation.readinessNote,
    recommendedControlsText: guidance.recommendedControlsText,
    actionItems: guidance.actionItems,
    memoText: guidance.memoText,
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  const normalized = text.trim()
  if (!normalized) {
    return false
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(normalized)
      return true
    } catch {
      // Continue to DOM copy fallback.
    }
  }

  const helper = document.createElement('textarea')
  helper.value = normalized
  helper.setAttribute('readonly', 'true')
  helper.style.position = 'fixed'
  helper.style.opacity = '0'
  document.body.appendChild(helper)
  helper.focus()
  helper.select()

  let succeeded = false
  try {
    succeeded = document.execCommand('copy')
  } catch {
    succeeded = false
  }

  document.body.removeChild(helper)
  return succeeded
}

function start(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const renderer = new SceneRenderer(canvas)
  const ui = new UIController()

  let currentEvaluation = evaluateScenario(DEFAULT_CONTROLS)
  let recommendedEvaluation = findBestControls(currentEvaluation.controls.pressure, currentEvaluation.controls)
  let guidance = buildGuidance(currentEvaluation, recommendedEvaluation)
  let transitionStart = performance.now()
  let latestDecision: Record<string, unknown> = {}

  function applyControls(): void {
    const controls = ui.readControlValues()
    currentEvaluation = evaluateScenario(controls)
    recommendedEvaluation = findBestControls(currentEvaluation.controls.pressure, currentEvaluation.controls)
    guidance = buildGuidance(currentEvaluation, recommendedEvaluation)

    ui.renderFrame(toFrameUi(currentEvaluation, guidance))

    latestDecision = {
      generated_at: new Date().toISOString(),
      scenario: currentEvaluation.scenarioLabel,
      controls: {
        pressure: Number(currentEvaluation.controls.pressure.toFixed(4)),
        urgency: Number(currentEvaluation.controls.urgency.toFixed(4)),
        strictness: Number(currentEvaluation.controls.strictness.toFixed(4)),
      },
      decision: currentEvaluation.deployment.ship ? 'ship' : 'hold',
      reason: currentEvaluation.deployment.reason,
      readiness: {
        score: currentEvaluation.readinessScore,
        note: currentEvaluation.readinessNote,
      },
      recommendation: {
        urgency: Number(recommendedEvaluation.controls.urgency.toFixed(4)),
        strictness: Number(recommendedEvaluation.controls.strictness.toFixed(4)),
        decision: recommendedEvaluation.deployment.ship ? 'ship' : 'hold',
        readiness_score: recommendedEvaluation.readinessScore,
      },
      actions: guidance.actionItems,
      replay: {
        threshold: currentEvaluation.queueReplay.overloadThreshold,
        peak_queue: { raw: currentEvaluation.queueReplay.peakRaw, safe: currentEvaluation.queueReplay.peakSafe },
        breach_minutes: {
          raw: currentEvaluation.queueReplay.rawBreachMinutes,
          safe: currentEvaluation.queueReplay.safeBreachMinutes,
        },
        escalations: {
          raw: currentEvaluation.queueReplay.rawEscalations,
          safe: currentEvaluation.queueReplay.safeEscalations,
        },
      },
      method_signals: {
        eta: Number(currentEvaluation.scenarioSignals.eta.toFixed(4)),
        strictness_scale: Number(currentEvaluation.scenarioSignals.strictnessScale.toFixed(4)),
        raw_risk_ratio: Number(currentEvaluation.rawRiskRatio.toFixed(4)),
        safe_risk_ratio: Number(currentEvaluation.safeRiskRatio.toFixed(4)),
        retained_gain_ratio: Number(currentEvaluation.retainedValueRatio.toFixed(4)),
        active_constraints: currentEvaluation.projectedStep.activeSetIds,
        max_violation_raw: Number(currentEvaluation.projectedStep.maxViolationStep0.toFixed(4)),
        max_violation_projected: Number(currentEvaluation.projectedStep.maxViolationProjected.toFixed(4)),
      },
    }

    transitionStart = performance.now()
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    renderer.render({
      halfspaces: copyHalfspaces(currentEvaluation.halfspaces),
      step0: currentEvaluation.projectedStep.step0,
      projectedStep: currentEvaluation.projectedStep.projectedStep,
      gradient: currentEvaluation.scenarioSignals.gradient,
      queueRawSeries: currentEvaluation.queueReplay.rawSeries,
      queueSafeSeries: currentEvaluation.queueReplay.safeSeries,
      overloadThreshold: currentEvaluation.queueReplay.overloadThreshold,
      transitionProgress: progress,
      clockMs: now,
    })

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    applyControls()
  })

  ui.onAutoTune(() => {
    const tuned = findBestControls(currentEvaluation.controls.pressure, currentEvaluation.controls)
    ui.setControlValues({ urgency: tuned.controls.urgency, strictness: tuned.controls.strictness })
    applyControls()
  })

  ui.onReset(() => {
    ui.setControlValues(DEFAULT_CONTROLS)
    applyControls()
  })

  ui.onReplay(() => {
    transitionStart = performance.now()
  })

  ui.onCopyMemo((memoText) => copyToClipboard(memoText))

  ui.onExport(() => {
    exportDecision(latestDecision)
  })

  window.addEventListener('resize', () => {
    renderer.resize()
  })

  renderer.resize()
  ui.setControlValues(DEFAULT_CONTROLS)
  applyControls()
  requestAnimationFrame(frame)
}

start()
