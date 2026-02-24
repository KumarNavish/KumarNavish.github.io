import {
  Halfspace,
  Vec2,
  normalize,
  scale,
  vec,
} from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer } from './render'
import { ProofFrameUi, UIController } from './ui'

const TRANSITION_MS = 980

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'toxicity ceiling',
    normal: normalize(vec(0.94, 0.34)),
    bound: 0.4,
    active: true,
  },
  {
    id: 'g2',
    label: 'hallucination ceiling',
    normal: normalize(vec(0.24, 1)),
    bound: 0.35,
    active: true,
  },
  {
    id: 'g3',
    label: 'privacy wall',
    normal: normalize(vec(-0.92, 0.38)),
    bound: 0.5,
    active: true,
  },
  {
    id: 'g4',
    label: 'style drift wall',
    normal: normalize(vec(0.76, -0.65)),
    bound: 0.37,
    active: true,
  },
]

const STRICTNESS_SENSITIVITY: Record<string, number> = {
  g1: 0.7,
  g2: 0.9,
  g3: 0.62,
  g4: 1.45,
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

function scenarioFromPressure(pressure: number): { eta: number; strictness: number; gradient: Vec2 } {
  const t = clamp(pressure)
  const eta = 0.72 + 2.15 * t
  const strictness = 1.24 - 0.78 * t
  const angle = degreesToRadians(230 + t * 124)
  const gradientMagnitude = 0.9 + t * 2
  const gradient = scale(normalize(vec(Math.cos(angle), Math.sin(angle))), gradientMagnitude)
  return { eta, strictness, gradient }
}

function boundScaleForStrictness(id: string, strictness: number): number {
  const sensitivity = STRICTNESS_SENSITIVITY[id] ?? 0.7
  return clamp(1 + sensitivity * (strictness - 1), 0.36, 1.85)
}

function scenarioName(pressure: number): string {
  if (pressure < 0.38) {
    return 'Low traffic'
  }
  if (pressure < 0.75) {
    return 'Peak hour'
  }
  return 'Incident surge'
}

function buildQueueReplay(
  pressure: number,
  rawRiskRatio: number,
  safeRiskRatio: number,
  retainedValueRatio: number,
): QueueReplay {
  const minutes = 16
  const overloadThreshold = 520
  const initialQueue = Math.round(205 + pressure * 118)

  const rawSeries: number[] = [initialQueue]
  const safeSeries: number[] = [initialQueue]

  for (let minute = 1; minute < minutes; minute += 1) {
    const pulse = 22 * Math.exp(-((minute - 7) ** 2) / 8)
    const arrivals = 338 + pressure * 122 + pulse

    const rawCapacity = 364 + retainedValueRatio * 84 - rawRiskRatio * 185
    const safeCapacity = 364 + retainedValueRatio * 76 - safeRiskRatio * 82

    const rawPrev = rawSeries[minute - 1]
    const safePrev = safeSeries[minute - 1]

    rawSeries.push(Math.max(70, rawPrev + arrivals - rawCapacity))
    safeSeries.push(Math.max(62, safePrev + arrivals - safeCapacity))
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
    rawEscalations: Math.round(rawBreachMinutes * 18 + rawOverflow / 44),
    safeEscalations: Math.round(safeBreachMinutes * 18 + safeOverflow / 44),
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

function toFrameUi(
  scenario: string,
  ship: boolean,
  replay: QueueReplay,
): ProofFrameUi {
  const peakValueText = `${replay.peakRaw.toLocaleString()} -> ${replay.peakSafe.toLocaleString()}`
  const breachValueText = `${replay.rawBreachMinutes.toLocaleString()} -> ${replay.safeBreachMinutes.toLocaleString()}`
  const escalationValueText = `${replay.rawEscalations.toLocaleString()} -> ${replay.safeEscalations.toLocaleString()}`

  let recommendationText = `${scenario}: `
  if (!ship) {
    recommendationText += 'Hold deployment. No feasible safe correction exists under current guardrails.'
  } else if (replay.rawBreachMinutes > replay.safeBreachMinutes) {
    recommendationText += `Ship SafePatch. SLA-breach minutes drop from ${replay.rawBreachMinutes} to ${replay.safeBreachMinutes}.`
  } else if (replay.peakRaw > replay.peakSafe) {
    recommendationText += `Ship SafePatch. Peak queue drops by ${(replay.peakRaw - replay.peakSafe).toLocaleString()} without extra breaches.`
  } else {
    recommendationText += 'Ship SafePatch. Stability remains equivalent while respecting guardrails.'
  }

  return {
    recommendationText,
    peakValueText,
    breachValueText,
    escalationValueText,
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

  let pressure = 0.55
  let queueReplay = buildQueueReplay(pressure, 0, 0, 1)
  let transitionStart = performance.now()
  let latestDecision: Record<string, unknown> = {}

  function applyControls(): void {
    pressure = ui.readControlValues().pressure

    const scenario = scenarioFromPressure(pressure)
    const scenarioLabel = scenarioName(pressure)

    for (const halfspace of halfspaces) {
      const baseBound = baseBounds.get(halfspace.id)
      if (baseBound === undefined) {
        continue
      }
      halfspace.bound = baseBound * boundScaleForStrictness(halfspace.id, scenario.strictness)
      halfspace.active = true
    }

    const projection = computeProjectedStep({
      gradient: scenario.gradient,
      eta: scenario.eta,
      halfspaces,
    })

    const largestBudget = Math.max(0.15, ...halfspaces.map((halfspace) => halfspace.bound))
    const rawRiskRatio = Math.max(0, projection.maxViolationStep0) / largestBudget
    const safeRiskRatio = Math.max(0, projection.maxViolationProjected) / largestBudget
    const retainedValueRatio = clamp(projection.descentRetainedRatio)

    queueReplay = buildQueueReplay(pressure, rawRiskRatio, safeRiskRatio, retainedValueRatio)

    const frameUi = toFrameUi(scenarioLabel, projection.ship, queueReplay)
    ui.renderFrame(frameUi)

    latestDecision = {
      scenario: scenarioLabel,
      decision: projection.ship ? 'ship' : 'hold',
      replay: {
        threshold: queueReplay.overloadThreshold,
        peak_queue: { raw: queueReplay.peakRaw, safe: queueReplay.peakSafe },
        breach_minutes: { raw: queueReplay.rawBreachMinutes, safe: queueReplay.safeBreachMinutes },
        escalations: { raw: queueReplay.rawEscalations, safe: queueReplay.safeEscalations },
      },
      method_signals: {
        eta: Number(scenario.eta.toFixed(4)),
        strictness: Number(scenario.strictness.toFixed(4)),
        raw_risk_ratio: Number(rawRiskRatio.toFixed(4)),
        safe_risk_ratio: Number(safeRiskRatio.toFixed(4)),
        retained_gain_ratio: Number(retainedValueRatio.toFixed(4)),
      },
    }

    transitionStart = performance.now()
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    renderer.render({
      queueRawSeries: queueReplay.rawSeries,
      queueSafeSeries: queueReplay.safeSeries,
      overloadThreshold: queueReplay.overloadThreshold,
      transitionProgress: progress,
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
  ui.setControlValues({ pressure })
  applyControls()
  requestAnimationFrame(frame)
}

start()
