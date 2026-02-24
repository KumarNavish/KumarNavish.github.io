import {
  Halfspace,
  Vec2,
  intersectHalfspaces,
  norm,
  normalize,
  scale,
  sub,
  vec,
  worldBoundsFromHalfspaces,
} from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer } from './render'
import { UIController } from './ui'

const TRANSITION_MS = 1500

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

const AUTOPLAY_STEPS = [{ pressure: 0.1 }, { pressure: 0.92 }, { pressure: 0.52 }]

interface QueueReplay {
  rawSeries: number[]
  safeSeries: number[]
  overloadThreshold: number
  peakRaw: number
  peakSafe: number
  avoidedEscalations: number
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
  const initialQueue = 210 + Math.round(pressure * 120)

  const baseArrival = 350 + pressure * 95
  const serviceBase = 370 + retainedValueRatio * 110
  const rawPenalty = 260 * rawRiskRatio + 46 * pressure
  const safePenalty = 70 * safeRiskRatio + 12 * pressure

  const rawSeries: number[] = [initialQueue]
  const safeSeries: number[] = [initialQueue]

  for (let minute = 1; minute < minutes; minute += 1) {
    const incidentPulse = 28 * Math.exp(-((minute - 6) ** 2) / 12)

    const rawPrev = rawSeries[minute - 1]
    const safePrev = safeSeries[minute - 1]

    const rawNext = Math.max(70, rawPrev + baseArrival + rawPenalty + incidentPulse - serviceBase)
    const safeNext = Math.max(55, safePrev + baseArrival + safePenalty + incidentPulse - (serviceBase - 10))

    rawSeries.push(rawNext)
    safeSeries.push(safeNext)
  }

  const peakRaw = Math.round(Math.max(...rawSeries))
  const peakSafe = Math.round(Math.max(...safeSeries))

  const rawOverloadMinute = firstOverloadMinute(rawSeries, overloadThreshold)
  const safeOverloadMinute = firstOverloadMinute(safeSeries, overloadThreshold)

  const rawOverloadSpan = rawSeries.filter((value) => value > overloadThreshold).length
  const safeOverloadSpan = safeSeries.filter((value) => value > overloadThreshold).length

  const rawEscalations = Math.round(
    rawRiskRatio * 230 +
      rawOverloadSpan * 34 +
      Math.max(0, peakRaw - overloadThreshold) / 15,
  )
  const safeEscalations = Math.round(
    safeRiskRatio * 190 +
      safeOverloadSpan * 20 +
      Math.max(0, peakSafe - overloadThreshold) / 28,
  )

  return {
    rawSeries,
    safeSeries,
    overloadThreshold,
    peakRaw,
    peakSafe,
    avoidedEscalations: Math.max(0, rawEscalations - safeEscalations),
    rawOverloadMinute,
    safeOverloadMinute,
  }
}

function phaseStatus(progress: number, ship: boolean, queueReplay: QueueReplay): string {
  if (progress < 0.34) {
    return 'Simulating raw deployment minute-by-minute.'
  }
  if (progress < 0.62) {
    return queueReplay.rawOverloadMinute === null
      ? 'Raw deployment remains below overload threshold.'
      : `Raw deployment crosses overload threshold at minute ${queueReplay.rawOverloadMinute}.`
  }
  if (progress < 0.88) {
    return 'Applying SafePatch correction and replaying incident.'
  }

  if (!ship) {
    return 'No feasible safe correction found for this patch size.'
  }

  return queueReplay.safeOverloadMinute === null
    ? 'SafePatch keeps queue below overload threshold.'
    : `SafePatch reduces overload pressure, first crossing at minute ${queueReplay.safeOverloadMinute}.`
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

  let pressure = 0.5
  let eta = scenarioFromPressure(pressure).eta
  let strictness = scenarioFromPressure(pressure).strictness
  let gradientNew = scenarioFromPressure(pressure).gradient

  let projection = computeProjectedStep({
    gradient: gradientNew,
    eta,
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

    eta = scenario.eta
    strictness = scenario.strictness
    gradientNew = scenario.gradient
    ui.renderPressureModel(eta, strictness)

    for (const halfspace of halfspaces) {
      const baseBound = baseBounds.get(halfspace.id)
      if (baseBound === undefined) {
        continue
      }

      halfspace.bound = baseBound * boundScaleForStrictness(halfspace.id, strictness)
      halfspace.active = true
    }

    intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))

    projection = computeProjectedStep({
      gradient: gradientNew,
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
      }, 320 + index * 2300)

      autoplayTimers.push(timer)
    })
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    renderer.render({
      queueRawSeries: queueReplay.rawSeries,
      queueSafeSeries: queueReplay.safeSeries,
      queueOverloadThreshold: queueReplay.overloadThreshold,
      rawRiskRatio,
      safeRiskRatio,
      retainedValueRatio,
      correctionRatio,
      transitionProgress: progress,
    })

    const statusText = phaseStatus(progress, projection.ship, queueReplay)

    const decisionText = projection.ship
      ? `Ship SafePatch: peak queue ${queueReplay.peakSafe.toLocaleString()} vs ${queueReplay.peakRaw.toLocaleString()} raw, avoiding ${queueReplay.avoidedEscalations.toLocaleString()} critical escalations tonight.`
      : `Hold deployment: no safe correction found for this patch size.`

    ui.renderFrame({
      ship: projection.ship,
      statusText,
      decisionText,
      peakRawQueue: queueReplay.peakRaw,
      peakSafeQueue: queueReplay.peakSafe,
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
