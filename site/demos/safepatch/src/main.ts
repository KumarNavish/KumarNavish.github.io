import {
  Halfspace,
  Vec2,
  norm,
  normalize,
  scale,
  sub,
  vec,
} from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer } from './render'
import { UIController } from './ui'

const TRANSITION_MS = 1600

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
    label: 'copyright wall',
    normal: normalize(vec(-0.56, -0.83)),
    bound: 0.54,
    active: true,
  },
  {
    id: 'g5',
    label: 'style drift wall',
    normal: normalize(vec(0.76, -0.65)),
    bound: 0.37,
    active: true,
  },
]

const STRICTNESS_SENSITIVITY: Record<string, number> = {
  g1: 0.7,
  g2: 0.95,
  g3: 0.64,
  g4: 0.58,
  g5: 1.62,
}

const AUTOPLAY_STEPS = [{ pressure: 0.25 }, { pressure: 0.9 }, { pressure: 0.55 }]

interface QueueReplay {
  rawSeries: number[]
  safeSeries: number[]
  overloadThreshold: number
  peakRaw: number
  peakSafe: number
  avoidedEscalations: number
  rawBreachMinutes: number
  safeBreachMinutes: number
  rawOverloadMinute: number | null
  safeOverloadMinute: number | null
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
  const eta = 0.46 + t * 2.3
  const strictness = 1.36 - t * 0.92
  const angle = degreesToRadians(176 + t * 158)
  const gradientMagnitude = 0.66 + t * 1.82
  const gradient = scale(normalize(vec(Math.cos(angle), Math.sin(angle))), gradientMagnitude)

  return { eta, strictness, gradient }
}

function boundScaleForStrictness(id: string, strictness: number): number {
  const sensitivity = STRICTNESS_SENSITIVITY[id] ?? 0.7
  return clamp(1 + sensitivity * (strictness - 1), 0.34, 1.86)
}

function firstOverloadMinute(series: number[], threshold: number): number | null {
  const index = series.findIndex((value) => value > threshold)
  return index >= 0 ? index : null
}

function buildQueueReplay(
  pressure: number,
  rawRiskRatio: number,
  safeRiskRatio: number,
  retainedValueRatio: number,
): QueueReplay {
  const minutes = 15
  const overloadThreshold = 520
  const initialQueue = 200 + Math.round(pressure * 110)

  const baseArrival = 350 + pressure * 100
  const serviceBase = 372 + retainedValueRatio * 102
  const rawPenalty = 255 * rawRiskRatio + 54 * pressure
  const safePenalty = 62 * safeRiskRatio + 18 * pressure

  const rawSeries: number[] = [initialQueue]
  const safeSeries: number[] = [initialQueue]

  for (let minute = 1; minute < minutes; minute += 1) {
    const pulse = 26 * Math.exp(-((minute - 6) ** 2) / 10)

    const rawPrev = rawSeries[minute - 1]
    const safePrev = safeSeries[minute - 1]

    const rawNext = Math.max(65, rawPrev + baseArrival + rawPenalty + pulse - serviceBase)
    const safeNext = Math.max(58, safePrev + baseArrival + safePenalty + pulse - (serviceBase - 6))

    rawSeries.push(rawNext)
    safeSeries.push(safeNext)
  }

  const peakRaw = Math.round(Math.max(...rawSeries))
  const peakSafe = Math.round(Math.max(...safeSeries))

  const rawBreachMinutes = rawSeries.filter((value) => value > overloadThreshold).length
  const safeBreachMinutes = safeSeries.filter((value) => value > overloadThreshold).length

  const rawEscalations =
    rawBreachMinutes * 32 + Math.max(0, peakRaw - overloadThreshold) / 13 + rawRiskRatio * 230
  const safeEscalations =
    safeBreachMinutes * 18 + Math.max(0, peakSafe - overloadThreshold) / 28 + safeRiskRatio * 180

  return {
    rawSeries,
    safeSeries,
    overloadThreshold,
    peakRaw,
    peakSafe,
    avoidedEscalations: Math.max(0, Math.round(rawEscalations - safeEscalations)),
    rawBreachMinutes,
    safeBreachMinutes,
    rawOverloadMinute: firstOverloadMinute(rawSeries, overloadThreshold),
    safeOverloadMinute: firstOverloadMinute(safeSeries, overloadThreshold),
  }
}

function phaseStatus(progress: number, queueReplay: QueueReplay): string {
  if (progress < 0.36) {
    return 'Replaying raw deployment.'
  }
  if (progress < 0.66) {
    return queueReplay.rawOverloadMinute === null
      ? 'Raw deployment stays below SLA threshold.'
      : `Raw deployment breaches SLA at minute ${queueReplay.rawOverloadMinute}.`
  }
  if (progress < 0.9) {
    return 'Replaying SafePatch deployment.'
  }

  return queueReplay.safeOverloadMinute === null
    ? 'SafePatch deployment stays below SLA threshold.'
    : `SafePatch still breaches SLA at minute ${queueReplay.safeOverloadMinute}.`
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
  let projection = computeProjectedStep({
    gradient: scenarioFromPressure(pressure).gradient,
    eta: scenarioFromPressure(pressure).eta,
    halfspaces,
  })

  let rawRiskRatio = 0
  let safeRiskRatio = 0
  let retainedValueRatio = 1
  let correctionRatio = 0
  let queueReplay = buildQueueReplay(pressure, 0, 0, 1)

  let transitionStart = performance.now()
  let autoplayEnabled = true
  const autoplayTimers: number[] = []
  let latestDecision: Record<string, unknown> = {}

  function clearAutoplay(): void {
    while (autoplayTimers.length > 0) {
      const timer = autoplayTimers.pop()
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
  }

  function applyControls(): void {
    const controls = ui.readControlValues()
    pressure = controls.pressure

    const scenario = scenarioFromPressure(pressure)
    const { eta, strictness, gradient } = scenario

    ui.renderPressureModel(pressure, eta, strictness)

    for (const halfspace of halfspaces) {
      const baseBound = baseBounds.get(halfspace.id)
      if (baseBound === undefined) {
        continue
      }

      halfspace.bound = baseBound * boundScaleForStrictness(halfspace.id, strictness)
      halfspace.active = true
    }

    projection = computeProjectedStep({
      gradient,
      eta,
      halfspaces,
    })

    const largestBudget = Math.max(0.15, ...halfspaces.map((halfspace) => halfspace.bound))
    rawRiskRatio = Math.max(0, projection.maxViolationStep0) / largestBudget
    safeRiskRatio = Math.max(0, projection.maxViolationProjected) / largestBudget
    retainedValueRatio = clamp(projection.descentRetainedRatio)

    const safeTarget = projection.ship ? projection.projectedStep : projection.step0
    correctionRatio = norm(sub(projection.step0, safeTarget)) / Math.max(0.08, norm(projection.step0))

    queueReplay = buildQueueReplay(pressure, rawRiskRatio, safeRiskRatio, retainedValueRatio)

    latestDecision = {
      scenario: pressure < 0.38 ? 'low_traffic' : pressure < 0.75 ? 'peak_hour' : 'incident_surge',
      ship: projection.ship,
      queue: {
        threshold: queueReplay.overloadThreshold,
        raw_peak: queueReplay.peakRaw,
        safe_peak: queueReplay.peakSafe,
        raw_breach_minutes: queueReplay.rawBreachMinutes,
        safe_breach_minutes: queueReplay.safeBreachMinutes,
      },
      impact: {
        peak_queue_reduction: Math.max(0, queueReplay.peakRaw - queueReplay.peakSafe),
        breach_minutes_avoided: Math.max(0, queueReplay.rawBreachMinutes - queueReplay.safeBreachMinutes),
        critical_escalations_avoided: queueReplay.avoidedEscalations,
      },
      method_signals: {
        raw_risk_ratio: Number(rawRiskRatio.toFixed(4)),
        safe_risk_ratio: Number(safeRiskRatio.toFixed(4)),
        retained_gain_ratio: Number(retainedValueRatio.toFixed(4)),
        correction_ratio: Number(correctionRatio.toFixed(4)),
      },
    }

    transitionStart = performance.now()
  }

  function scheduleAutoplay(): void {
    clearAutoplay()

    AUTOPLAY_STEPS.forEach((step, index) => {
      const timer = window.setTimeout(() => {
        if (!autoplayEnabled) {
          return
        }

        ui.setControlValues({ pressure: step.pressure })
        applyControls()
      }, 360 + index * 2380)

      autoplayTimers.push(timer)
    })
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    renderer.render({
      queueRawSeries: queueReplay.rawSeries,
      queueSafeSeries: queueReplay.safeSeries,
      overloadThreshold: queueReplay.overloadThreshold,
      rawOverloadMinute: queueReplay.rawOverloadMinute,
      safeOverloadMinute: queueReplay.safeOverloadMinute,
      transitionProgress: progress,
    })

    const statusText = phaseStatus(progress, queueReplay)

    const rawOutcomeText = queueReplay.rawOverloadMinute === null
      ? 'No on-call page triggered.'
      : `On-call page at minute ${queueReplay.rawOverloadMinute}.`

    const safeOutcomeText = queueReplay.safeOverloadMinute === null
      ? 'No on-call page. Queue remains under SLA.'
      : `Still pages on-call at minute ${queueReplay.safeOverloadMinute}.`

    const peakQueueReduction = Math.max(0, queueReplay.peakRaw - queueReplay.peakSafe)
    const breachMinutesAvoided = Math.max(0, queueReplay.rawBreachMinutes - queueReplay.safeBreachMinutes)

    const decisionText = projection.ship
      ? `Ship SafePatch: avoids ${breachMinutesAvoided} SLA-breach minutes and ${queueReplay.avoidedEscalations.toLocaleString()} critical escalations tonight.`
      : 'Hold deployment: no feasible safe correction for this patch size.'

    ui.renderFrame({
      ship: projection.ship,
      statusText,
      decisionText,
      rawOutcomeText,
      safeOutcomeText,
      peakQueueReduction,
      breachMinutesAvoided,
      avoidedEscalations: queueReplay.avoidedEscalations,
    })

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    autoplayEnabled = false
    clearAutoplay()
    applyControls()
  })

  ui.onReplay(() => {
    autoplayEnabled = false
    clearAutoplay()
    transitionStart = performance.now()
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
  scheduleAutoplay()
  requestAnimationFrame(frame)
}

start()
