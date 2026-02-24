import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  dot,
  lerp,
  normalize,
  scale,
  sub,
  vec,
  worldBoundsFromHalfspaces,
  intersectHalfspaces,
} from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer, paletteForConstraints } from './render'
import { UIController } from './ui'

const TRANSITION_MS = 1320

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

const AUTOPLAY_STEPS = [{ pressure: 0.08 }, { pressure: 0.95 }, { pressure: 0.5 }]

interface QueueReplay {
  rawSeries: number[]
  safeSeries: number[]
  overloadThreshold: number
  peakRaw: number
  peakSafe: number
  overloadAvoidedRatio: number
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function easeInOutCubic(value: number): number {
  const t = clamp(value)
  if (t < 0.5) {
    return 4 * t * t * t
  }
  return 1 - ((-2 * t + 2) ** 3) / 2
}

function easeOutCubic(value: number): number {
  const t = clamp(value)
  return 1 - (1 - t) ** 3
}

function easeOutBack(value: number): number {
  const t = clamp(value)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function copyHalfspaces(halfspaces: Halfspace[]): Halfspace[] {
  return halfspaces.map((halfspace) => ({
    ...halfspace,
    normal: { ...halfspace.normal },
  }))
}

function copyPolygon(polygon: Polygon): Polygon {
  return {
    isEmpty: polygon.isEmpty,
    vertices: polygon.vertices.map((vertex) => ({ ...vertex })),
  }
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

function firstBreachPoint(step: Vec2, halfspaces: Halfspace[]): Vec2 | null {
  let tMin = Number.POSITIVE_INFINITY

  for (const halfspace of halfspaces) {
    if (!halfspace.active) {
      continue
    }
    const projected = dot(halfspace.normal, step)
    if (projected <= halfspace.bound + 1e-8) {
      continue
    }

    const t = halfspace.bound / Math.max(1e-8, projected)
    if (t >= 0 && t < tMin) {
      tMin = t
    }
  }

  if (!Number.isFinite(tMin) || tMin >= 1) {
    return null
  }

  return scale(step, Math.max(0, tMin))
}

function buildQueueReplay(
  pressure: number,
  rawRiskRatio: number,
  safeRiskRatio: number,
  retainedValueRatio: number,
): QueueReplay {
  const minutes = 14
  const overloadThreshold = 520
  const initialQueue = 180 + Math.round(pressure * 90)

  const baseArrival = 360 + pressure * 70
  const baseService = 370
  const serviceGain = 42 * retainedValueRatio
  const rawPenalty = 140 * rawRiskRatio
  const safePenalty = 140 * safeRiskRatio

  const rawSeries: number[] = [initialQueue]
  const safeSeries: number[] = [initialQueue]

  for (let minute = 1; minute < minutes; minute += 1) {
    const demandWave = 20 * Math.sin((minute / (minutes - 1)) * Math.PI)
    const rawPrev = rawSeries[minute - 1]
    const safePrev = safeSeries[minute - 1]

    const rawNext = Math.max(0, rawPrev + baseArrival + rawPenalty + demandWave - (baseService + serviceGain))
    const safeNext = Math.max(0, safePrev + baseArrival + safePenalty + demandWave - (baseService + serviceGain))

    rawSeries.push(rawNext)
    safeSeries.push(safeNext)
  }

  const peakRaw = Math.round(Math.max(...rawSeries))
  const peakSafe = Math.round(Math.max(...safeSeries))
  const overloadRaw = Math.max(0, peakRaw - overloadThreshold)
  const overloadSafe = Math.max(0, peakSafe - overloadThreshold)

  return {
    rawSeries,
    safeSeries,
    overloadThreshold,
    peakRaw,
    peakSafe,
    overloadAvoidedRatio: overloadRaw > 1 ? (overloadRaw - overloadSafe) / overloadRaw : 1,
  }
}

function phaseState(progress: number, ship: boolean): string {
  if (progress < 0.22) {
    return 'A hotfix patch is generated from new support failures.'
  }
  if (progress < 0.52) {
    return 'Raw deploy breaches safety and starts queue pressure.'
  }
  if (progress < 0.86) {
    return 'SafePatch computes the nearest shippable correction.'
  }
  return ship
    ? 'Corrected deploy stabilizes queue minute-by-minute.'
    : 'No feasible correction under current guardrails.'
}

function start(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const halfspaces = copyHalfspaces(baseHalfspaces)
  const baseBounds = new Map<string, number>(halfspaces.map((halfspace) => [halfspace.id, halfspace.bound]))

  const colorById = paletteForConstraints(halfspaces)
  const renderer = new SceneRenderer(canvas)
  const ui = new UIController()

  let pressure = 0.5
  let eta = scenarioFromPressure(pressure).eta
  let strictness = scenarioFromPressure(pressure).strictness
  let gradientNew = scenarioFromPressure(pressure).gradient

  let zone = intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))
  let previousZone: Polygon | null = null

  let projection = computeProjectedStep({
    gradient: gradientNew,
    eta,
    halfspaces,
  })

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

  function applyControls(capturePrevious: boolean): void {
    if (capturePrevious) {
      previousZone = copyPolygon(zone)
    }

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

    zone = intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))
    projection = computeProjectedStep({
      gradient: gradientNew,
      eta,
      halfspaces,
    })

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
        applyControls(true)
      }, 360 + index * 2280)

      autoplayTimers.push(timer)
    })
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    const zoneReveal = easeOutCubic(progress / 0.2)
    const rawReveal = easeOutBack((progress - 0.12) / 0.37)
    const safeReveal = projection.ship ? easeOutBack((progress - 0.5) / 0.5) : 0

    const rawTarget = projection.step0
    const safeTarget = projection.ship ? projection.projectedStep : projection.step0

    const rawScale = clamp(rawReveal, 0, 1.05)
    const rawStep = scale(rawTarget, rawScale)

    const safeBlend = clamp(safeReveal, 0, 1.08)
    const safeLinear = clamp(safeBlend, 0, 1)

    let safeStep = vec(0, 0)
    if (projection.ship && safeReveal > 0.01) {
      safeStep = lerp(rawTarget, safeTarget, safeLinear)
      if (safeBlend > 1) {
        const overshoot = safeBlend - 1
        const direction = sub(safeTarget, rawTarget)
        safeStep = add(safeStep, scale(direction, overshoot * 0.1))
      }
    }

    const correctionProgress = easeInOutCubic((progress - 0.5) / 0.5)

    const lambdaMax = Math.max(1e-8, ...halfspaces.map((halfspace) => projection.lambdaById[halfspace.id] ?? 0))
    const constraintForceById: Record<string, number> = {}

    for (const halfspace of halfspaces) {
      const lambda = projection.lambdaById[halfspace.id] ?? 0
      constraintForceById[halfspace.id] = projection.ship ? (lambda / lambdaMax) * correctionProgress : 0
    }

    const largestBudget = Math.max(0.15, ...halfspaces.map((halfspace) => halfspace.bound))
    const rawRiskRatio = Math.max(0, projection.maxViolationStep0) / largestBudget
    const safeRiskRatio = Math.max(0, projection.maxViolationProjected) / largestBudget
    const queueReplay = buildQueueReplay(pressure, rawRiskRatio, safeRiskRatio, projection.descentRetainedRatio)

    renderer.render({
      halfspaces,
      zone,
      previousZone,
      rawStep,
      safeStep,
      rawTarget,
      safeTarget,
      breachPoint: firstBreachPoint(rawTarget, halfspaces),
      colorById,
      constraintForceById,
      violationRaw: projection.maxViolationStep0,
      rawRiskRatio,
      safeRiskRatio,
      retainedValueRatio: projection.descentRetainedRatio,
      queueRawSeries: queueReplay.rawSeries,
      queueSafeSeries: queueReplay.safeSeries,
      queueOverloadThreshold: queueReplay.overloadThreshold,
      zoneReveal,
      rawReveal: rawScale,
      safeReveal: safeLinear,
      correctionProgress,
      transitionProgress: progress,
    })

    const phaseText = phaseState(progress, projection.ship)

    ui.renderFrame({
      ship: projection.ship,
      reason: projection.ship
        ? 'Deployment recommendation ready.'
        : projection.reason?.toLowerCase().includes('empty')
          ? 'No feasible ship zone under current guardrails.'
          : 'Unsafe patch blocked.',
      phaseText,
      rawRiskRatio,
      retainedValueRatio: projection.descentRetainedRatio,
      safeRiskRatio,
      rawPeakQueue: queueReplay.peakRaw,
      safePeakQueue: queueReplay.peakSafe,
      overloadAvoidedRatio: queueReplay.overloadAvoidedRatio,
    })

    if (progress > 0.995 && previousZone) {
      previousZone = null
    }

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    autoplayEnabled = false
    clearAutoplay()
    applyControls(true)
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
  applyControls(false)
  scheduleAutoplay()
  requestAnimationFrame(frame)
}

start()
