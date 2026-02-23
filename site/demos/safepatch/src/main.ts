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

const GRADIENT_NEW: Vec2 = vec(-1.08, 0.31)
const TRANSITION_MS = 1320

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'g1',
    normal: normalize(vec(1, 0)),
    bound: 0.78,
    active: true,
  },
  {
    id: 'g2',
    label: 'g2',
    normal: normalize(vec(0, 1)),
    bound: 0.64,
    active: true,
  },
  {
    id: 'g3',
    label: 'g3',
    normal: normalize(vec(-1, 0)),
    bound: 0.5,
    active: true,
  },
  {
    id: 'g4',
    label: 'g4',
    normal: normalize(vec(0, -1)),
    bound: 0.34,
    active: true,
  },
  {
    id: 'g5',
    label: 'g5',
    normal: normalize(vec(0.78, -0.62)),
    bound: 0.72,
    active: true,
  },
]

const STRICTNESS_SENSITIVITY: Record<string, number> = {
  g1: 0.68,
  g2: 0.52,
  g3: 0.5,
  g4: 0.72,
  g5: 1.55,
}

const AUTOPLAY_STEPS = [
  { eta: 1.22, strictness: 0.84 },
  { eta: 1.22, strictness: 1.23 },
  { eta: 0.95, strictness: 1.0 },
]

const CORE_EQUATION = String.raw`\Delta^* = \Pi_{\mathcal S}(\Delta_0)`

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

function boundScaleForStrictness(id: string, strictness: number): number {
  const sensitivity = STRICTNESS_SENSITIVITY[id] ?? 0.65
  return clamp(1 + sensitivity * (strictness - 1), 0.5, 1.7)
}

function phaseStory(progress: number, ship: boolean): string {
  if (progress < 0.2) {
    return '1/3 Build ship zone from active guardrails.'
  }
  if (progress < 0.53) {
    return '2/3 Raw optimizer update shoots out (red).'
  }
  if (progress < 0.98) {
    return '3/3 Projection pulls to nearest feasible step (blue).'
  }
  return ship ? 'Ship the blue step: policy-safe and closest to optimizer intent.' : 'Hold: no feasible projection under current limits.'
}

function start(): void {
  renderMathInline('equation-chip', CORE_EQUATION)

  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const halfspaces = copyHalfspaces(baseHalfspaces)
  const baseBounds = new Map<string, number>(halfspaces.map((halfspace) => [halfspace.id, halfspace.bound]))

  const colorById = paletteForConstraints(halfspaces)
  const renderer = new SceneRenderer(canvas)
  const ui = new UIController()

  let eta = 1.22
  let strictness = 0.84

  let zone = intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))
  let previousZone: Polygon | null = null

  let projection = computeProjectedStep({
    gradient: GRADIENT_NEW,
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
    eta = controls.eta
    strictness = controls.strictness

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
      gradient: GRADIENT_NEW,
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

        ui.setControlValues(step)
        applyControls(true)
      }, 420 + index * 2250)

      autoplayTimers.push(timer)
    })
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)

    const zoneReveal = easeOutCubic(progress / 0.22)
    const rawReveal = easeOutBack((progress - 0.14) / 0.39)
    const safeReveal = projection.ship ? easeOutBack((progress - 0.53) / 0.47) : 0

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

    const correctionProgress = easeInOutCubic((progress - 0.53) / 0.47)

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
      reason: projection.ship ? 'Projected update is inside all guardrails.' : projection.reason,
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
  ui.setControlValues({ eta, strictness })
  applyControls(false)
  scheduleAutoplay()
  requestAnimationFrame(frame)
}

start()
