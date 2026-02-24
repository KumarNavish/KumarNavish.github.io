import katex from 'katex'
import 'katex/dist/katex.min.css'

import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  lerp,
  norm,
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
    label: 'g1',
    normal: normalize(vec(1, 0)),
    bound: 0.45,
    active: true,
  },
  {
    id: 'g2',
    label: 'g2',
    normal: normalize(vec(0, 1)),
    bound: 0.36,
    active: true,
  },
  {
    id: 'g3',
    label: 'g3',
    normal: normalize(vec(-1, 0)),
    bound: 0.58,
    active: true,
  },
  {
    id: 'g4',
    label: 'g4',
    normal: normalize(vec(0, -1)),
    bound: 0.32,
    active: true,
  },
  {
    id: 'g5',
    label: 'g5',
    normal: normalize(vec(0.88, 0.62)),
    bound: 0.46,
    active: true,
  },
]

const STRICTNESS_SENSITIVITY: Record<string, number> = {
  g1: 0.78,
  g2: 0.74,
  g3: 0.62,
  g4: 0.58,
  g5: 1.95,
}

const AUTOPLAY_STEPS = [{ pressure: 0.1 }, { pressure: 0.92 }, { pressure: 0.56 }]

const CORE_EQUATION = String.raw`\Delta^*=\operatorname{Proj}_{\mathcal S}(\Delta_0),\qquad \Delta_0=-\eta g_{new}`

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
  const eta = 0.42 + t * 1.9
  const strictness = 1.4 - t * 0.86
  const angle = degreesToRadians(-220 + t * 220)
  const gradientMagnitude = 0.62 + t * 1.7
  const gradient = scale(normalize(vec(Math.cos(angle), Math.sin(angle))), gradientMagnitude)

  return { eta, strictness, gradient }
}

function renderMathInline(elementId: string, expression: string): void {
  const node = document.getElementById(elementId)
  if (!node) {
    return
  }

  try {
    katex.render(expression, node, {
      throwOnError: true,
      displayMode: false,
      strict: 'warn',
    })
  } catch {
    node.textContent = expression
  }
}

function renderMathDisplay(elementId: string, expression: string): void {
  const node = document.getElementById(elementId)
  if (!node) {
    return
  }

  try {
    katex.render(expression, node, {
      throwOnError: true,
      displayMode: true,
      strict: 'warn',
    })
  } catch {
    node.textContent = expression
  }
}

function boundScaleForStrictness(id: string, strictness: number): number {
  const sensitivity = STRICTNESS_SENSITIVITY[id] ?? 0.7
  return clamp(1 + sensitivity * (strictness - 1), 0.42, 1.86)
}

function phaseStory(progress: number, ship: boolean): string {
  if (progress < 0.22) {
    return '1/3 Feasible region appears.'
  }
  if (progress < 0.54) {
    return '2/3 Raw step breaches it.'
  }
  if (progress < 0.98) {
    return '3/3 Projection returns nearest safe step.'
  }
  return ship ? 'SHIP: minimal correction, fully feasible.' : 'HOLD: no feasible step under current limits.'
}

function start(): void {
  renderMathInline('legend-raw', String.raw`\Delta_0`)
  renderMathInline('legend-safe', String.raw`\Delta^*`)
  renderMathDisplay('equation-main', CORE_EQUATION)

  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const halfspaces = copyHalfspaces(baseHalfspaces)
  const baseBounds = new Map<string, number>(halfspaces.map((halfspace) => [halfspace.id, halfspace.bound]))

  const colorById = paletteForConstraints(halfspaces)
  const renderer = new SceneRenderer(canvas)
  const ui = new UIController()

  let pressure = 0.48
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

    if (!projection.ship) {
      renderMathInline('equation-secondary', String.raw`\mathcal{S}=\varnothing\ \Rightarrow\ \text{HOLD}`)
    } else if (projection.activeSetIds.length === 0) {
      renderMathInline('equation-secondary', String.raw`\Delta^*=\Delta_0\quad(\text{already feasible})`)
    } else {
      const distance = norm(sub(projection.projectedStep, projection.step0))
      renderMathInline(
        'equation-secondary',
        String.raw`\|\Delta^*-\Delta_0\|_2=${distance.toFixed(3)}\quad\text{(minimum correction)}`,
      )
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

    renderer.render({
      halfspaces,
      zone,
      previousZone,
      rawStep,
      safeStep,
      rawTarget,
      safeTarget,
      colorById,
      constraintForceById,
      violationRaw: projection.maxViolationStep0,
      zoneReveal,
      rawReveal: rawScale,
      safeReveal: safeLinear,
      correctionProgress,
      transitionProgress: progress,
    })

    ui.renderFrame({
      ship: projection.ship,
      reason: projection.ship
        ? 'Projected step satisfies every guardrail.'
        : projection.reason?.toLowerCase().includes('empty')
          ? 'Guardrails conflict. No shippable step.'
          : 'Raw step breaches guardrails.',
      phaseText: phaseStory(progress, projection.ship),
      maxViolationRaw: projection.maxViolationStep0,
      maxViolationSafe: projection.maxViolationProjected,
      correctionSize: norm(sub(rawTarget, safeTarget)),
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
