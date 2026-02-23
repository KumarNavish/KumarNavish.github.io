import katex from 'katex'
import 'katex/dist/katex.min.css'

import {
  Halfspace,
  Polygon,
  Vec2,
  lerp,
  normalize,
  scale,
  vec,
  worldBoundsFromHalfspaces,
  intersectHalfspaces,
} from './geometry'
import { computeProjectedStep } from './qp'
import { SceneRenderer, paletteForConstraints } from './render'
import { UIController } from './ui'

const GRADIENT_NEW: Vec2 = vec(-1.58, 0.38)
const TRANSITION_MS = 1240
const RAW_PHASE_CUT = 0.38

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'g1',
    normal: normalize(vec(1, 0)),
    bound: 0.74,
    active: true,
  },
  {
    id: 'g2',
    label: 'g2',
    normal: normalize(vec(0, 1)),
    bound: 0.68,
    active: true,
  },
  {
    id: 'g3',
    label: 'g3',
    normal: normalize(vec(-1, 0)),
    bound: 0.46,
    active: true,
  },
  {
    id: 'g4',
    label: 'g4',
    normal: normalize(vec(0, -1)),
    bound: 0.30,
    active: true,
  },
  {
    id: 'g5',
    label: 'g5',
    normal: normalize(vec(0.82, -0.57)),
    bound: 0.46,
    active: true,
  },
]

const STRICTNESS_SENSITIVITY: Record<string, number> = {
  g1: 0.7,
  g2: 0.55,
  g3: 0.5,
  g4: 0.8,
  g5: 1.35,
}

const AUTOPLAY_STEPS = [
  { eta: 1.35, strictness: 0.8 },
  { eta: 1.35, strictness: 1.25 },
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
  const sensitivity = STRICTNESS_SENSITIVITY[id] ?? 0.7
  return clamp(1 + sensitivity * (strictness - 1), 0.52, 1.62)
}

function phaseStory(progress: number, ship: boolean): string {
  if (progress < RAW_PHASE_CUT) {
    return 'Raw step grows first (red).'
  }
  if (progress < 0.98) {
    return 'Projection snaps into the ship zone (blue).'
  }
  return ship ? 'Blue is the shippable update.' : 'No feasible safe update under current limits.'
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

  let eta = 1.0
  let strictness = 1.0

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
      }, 500 + index * 2150)

      autoplayTimers.push(timer)
    })
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)
    const rawReveal = easeOutCubic(progress / RAW_PHASE_CUT)
    const correctionProgress = easeInOutCubic((progress - RAW_PHASE_CUT) / (1 - RAW_PHASE_CUT))

    const rawTarget = projection.step0
    const safeTarget = projection.ship ? projection.projectedStep : projection.step0

    const rawStep = scale(rawTarget, rawReveal)
    const safeStep = projection.ship && correctionProgress > 0 ? lerp(rawTarget, safeTarget, correctionProgress) : vec(0, 0)

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
      correctionProgress,
      transitionProgress: progress,
    })

    ui.renderFrame({
      ship: projection.ship,
      reason: projection.ship ? 'Projected update is inside all guardrails.' : projection.reason,
      phaseText: phaseStory(progress, projection.ship),
      maxViolationRaw: projection.maxViolationStep0,
      maxViolationSafe: projection.maxViolationProjected,
      descentRetainedRatio: projection.descentRetainedRatio,
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
