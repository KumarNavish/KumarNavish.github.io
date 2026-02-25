import 'katex/dist/katex.min.css'

import { Halfspace, Vec2, normalize, scale, vec } from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer } from './render'
import { ProofFrameUi, UIController } from './ui'

const TRANSITION_MS = 1120
const PROJECTION_TOLERANCE = 1e-6

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
    return 'normal day'
  }
  if (pressure < 0.75) {
    return 'traffic spike'
  }
  return 'incident hour'
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
      reason: `Correction keeps only ${Math.round(retainedValueRatio * 100)}% of the intended gain.`,
    }
  }

  if (
    queueReplay.safeBreachMinutes >= queueReplay.rawBreachMinutes &&
    queueReplay.safeEscalations >= queueReplay.rawEscalations
  ) {
    return {
      ship: false,
      reason: 'Correction is safe but does not reduce production risk enough.',
    }
  }

  return {
    ship: true,
    reason: 'Safe correction keeps useful gain and cuts expected incident pressure.',
  }
}

function toFrameUi(
  scenario: string,
  decision: DeploymentDecision,
  maxViolationProjected: number,
  activeSetSize: number,
  violatedRaw: number,
  violatedSafe: number,
  retainedValueRatio: number,
  replay: QueueReplay,
): ProofFrameUi {
  const peakValueText = `${replay.peakRaw.toLocaleString()} -> ${replay.peakSafe.toLocaleString()}`
  const breachValueText = `${replay.rawBreachMinutes.toLocaleString()} -> ${replay.safeBreachMinutes.toLocaleString()}`
  const escalationValueText = `${replay.rawEscalations.toLocaleString()} -> ${replay.safeEscalations.toLocaleString()}`

  const breachDrop = replay.rawBreachMinutes - replay.safeBreachMinutes
  const escalationDrop = replay.rawEscalations - replay.safeEscalations
  const retainedPercent = Math.round(clamp(retainedValueRatio, 0, 1.4) * 100)

  const problemText = `Problem: under ${scenario} traffic, shipping the raw patch would trigger ${violatedRaw} guardrail violations and ${replay.rawBreachMinutes} breach minutes.`
  const mechanismText = `Method: SafePatch nudges the patch to the nearest safe update (${violatedRaw} -> ${violatedSafe} violations, ${activeSetSize} active constraints) while keeping ${retainedPercent}% of the intended gain.`

  let impactText = `Value: peak queue drops ${replay.peakRaw} -> ${replay.peakSafe}, with ${Math.max(escalationDrop, 0)} fewer escalations in this replay.`
  if (breachDrop > 0) {
    impactText += ` Breach minutes fall by ${breachDrop}.`
  }
  if (!decision.ship) {
    impactText = `Value: deployment is held because ${decision.reason.toLowerCase()}`
  }

  return {
    decisionTone: decision.ship ? 'ship' : 'hold',
    decisionTitle: decision.ship ? 'Ship with SafePatch' : 'Hold this patch',
    decisionDetail: decision.reason,
    problemText,
    mechanismText,
    impactText,
    peakValueText,
    breachValueText,
    escalationValueText,
    guardrailValueText: `${violatedRaw} -> ${violatedSafe}`,
    retainedValueText: `${retainedPercent}%`,
  }
}

function start(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const halfspaces = copyHalfspaces(baseHalfspaces)
  const baseBounds = new Map<string, number>(halfspaces.map((halfspace) => [halfspace.id, halfspace.bound]))

  const renderer = new SceneRenderer(canvas)
  const ui = new UIController()

  let controls = ui.readControlValues()
  let scenarioSignals = scenarioFromControls(controls)
  let queueReplay = buildQueueReplay(controls, 0, 0, 1)
  let projectedStep = computeProjectedStep({
    gradient: scenarioSignals.gradient,
    eta: scenarioSignals.eta,
    halfspaces,
    tolerance: PROJECTION_TOLERANCE,
  })
  let deployment = deploymentDecision(projectedStep.ship, projectedStep.reason, queueReplay, 1)
  let transitionStart = performance.now()
  let latestDecision: Record<string, unknown> = {}

  function applyControls(): void {
    controls = ui.readControlValues()
    scenarioSignals = scenarioFromControls(controls)
    const scenarioLabel = scenarioName(controls.pressure)

    for (const halfspace of halfspaces) {
      const baseBound = baseBounds.get(halfspace.id)
      if (baseBound === undefined) {
        continue
      }
      const scaledBound = baseBound * boundScaleForStrictness(halfspace.id, scenarioSignals.strictnessScale)
      const pressurePenalty = controls.pressure * controls.strictness * (halfspace.id === 'g2' ? 0.24 : 0.2)
      halfspace.bound = scaledBound - pressurePenalty
      halfspace.active = true
    }

    projectedStep = computeProjectedStep({
      gradient: scenarioSignals.gradient,
      eta: scenarioSignals.eta,
      halfspaces,
      tolerance: PROJECTION_TOLERANCE,
    })

    const largestBudget = Math.max(0.1, ...halfspaces.map((halfspace) => Math.abs(halfspace.bound)))
    const rawRiskRatio = Math.max(0, projectedStep.maxViolationStep0) / largestBudget
    const safeRiskRatio = Math.max(0, projectedStep.maxViolationProjected) / largestBudget
    const retainedValueRatio = clamp(projectedStep.descentRetainedRatio, 0, 1.5)

    queueReplay = buildQueueReplay(controls, rawRiskRatio, safeRiskRatio, retainedValueRatio)
    deployment = deploymentDecision(projectedStep.ship, projectedStep.reason, queueReplay, retainedValueRatio)

    const violatedRaw = projectedStep.diagnostics.filter(
      (diagnostic) => diagnostic.active && diagnostic.violationStep0 > PROJECTION_TOLERANCE,
    ).length
    const violatedSafe = projectedStep.diagnostics.filter(
      (diagnostic) => diagnostic.active && diagnostic.violationProjected > PROJECTION_TOLERANCE,
    ).length

    const frameUi = toFrameUi(
      scenarioLabel,
      deployment,
      projectedStep.maxViolationProjected,
      projectedStep.activeSetIds.length,
      violatedRaw,
      violatedSafe,
      retainedValueRatio,
      queueReplay,
    )
    ui.renderFrame(frameUi)

    latestDecision = {
      generated_at: new Date().toISOString(),
      scenario: scenarioLabel,
      controls: {
        pressure: Number(controls.pressure.toFixed(4)),
        urgency: Number(controls.urgency.toFixed(4)),
        strictness: Number(controls.strictness.toFixed(4)),
      },
      decision: deployment.ship ? 'ship' : 'hold',
      reason: deployment.reason,
      replay: {
        threshold: queueReplay.overloadThreshold,
        peak_queue: { raw: queueReplay.peakRaw, safe: queueReplay.peakSafe },
        breach_minutes: { raw: queueReplay.rawBreachMinutes, safe: queueReplay.safeBreachMinutes },
        escalations: { raw: queueReplay.rawEscalations, safe: queueReplay.safeEscalations },
      },
      method_signals: {
        eta: Number(scenarioSignals.eta.toFixed(4)),
        strictness_scale: Number(scenarioSignals.strictnessScale.toFixed(4)),
        raw_risk_ratio: Number(rawRiskRatio.toFixed(4)),
        safe_risk_ratio: Number(safeRiskRatio.toFixed(4)),
        retained_gain_ratio: Number(retainedValueRatio.toFixed(4)),
        active_constraints: projectedStep.activeSetIds,
        max_violation_raw: Number(projectedStep.maxViolationStep0.toFixed(4)),
        max_violation_projected: Number(projectedStep.maxViolationProjected.toFixed(4)),
      },
    }

    transitionStart = performance.now()
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    renderer.render({
      halfspaces: copyHalfspaces(halfspaces),
      step0: projectedStep.step0,
      projectedStep: projectedStep.projectedStep,
      gradient: scenarioSignals.gradient,
      queueRawSeries: queueReplay.rawSeries,
      queueSafeSeries: queueReplay.safeSeries,
      overloadThreshold: queueReplay.overloadThreshold,
      transitionProgress: progress,
      clockMs: now,
    })

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    applyControls()
  })

  ui.onExport(() => {
    exportDecision(latestDecision)
  })

  window.addEventListener('resize', () => {
    renderer.resize()
  })

  renderer.resize()
  ui.setControlValues(controls)
  applyControls()
  requestAnimationFrame(frame)
}

start()
