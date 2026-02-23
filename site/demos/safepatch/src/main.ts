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
import { ProjectionResult, computeProjectedStep } from './qp'
import { SceneRenderer, paletteForConstraints } from './render'
import { UIController } from './ui'

const GRADIENT_NEW: Vec2 = vec(0.24, -1.62)
const TRANSITION_MS = 1160
const RAW_PHASE_CUT = 0.42

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'lambda1',
    normal: normalize(vec(1, 0)),
    bound: 0.34,
    active: true,
  },
  {
    id: 'g2',
    label: 'lambda2',
    normal: normalize(vec(0, 1)),
    bound: 0.37,
    active: true,
  },
  {
    id: 'g3',
    label: 'lambda3',
    normal: normalize(vec(-1, 0)),
    bound: 0.32,
    active: true,
  },
  {
    id: 'g4',
    label: 'lambda4',
    normal: normalize(vec(0, -1)),
    bound: 0.44,
    active: true,
  },
  {
    id: 'g5',
    label: 'lambda5',
    normal: normalize(vec(-0.72, 1)),
    bound: 0.18,
    active: true,
  },
]

const AUTOPLAY_STEPS = [
  { eta: 1.24, strictness: 0.83 },
  { eta: 0.82, strictness: 1.19 },
  { eta: 0.95, strictness: 1.0 },
]

const CORE_MATH = String.raw`\Delta^* = \Pi_{\mathcal S}\!\left(-\eta\,g_{\mathrm{new}}\right),\quad \mathcal S=\{\Delta:\langle g_k,\Delta\rangle\le\varepsilon_k\}`

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

function safeStepOf(projection: ProjectionResult): Vec2 {
  return projection.ship ? projection.projectedStep : projection.step0
}

function scaleForStrictness(id: string, strictness: number): number {
  if (id === 'g5') {
    return 0.05 + 0.95 * strictness
  }
  return 0.2 + 0.8 * strictness
}

function phaseStory(progress: number, ship: boolean): string {
  if (progress < RAW_PHASE_CUT) {
    return '1/2 Raw optimizer proposes delta0 (red).'
  }
  if (progress < 0.98) {
    return '2/2 SafePatch projects to delta* (blue) inside guardrails.'
  }
  return ship ? 'Ship this blue step: feasible and closest to optimizer intent.' : 'Hold: current limits make a safe projection unavailable.'
}

function renderMathBlock(elementId: string, expression: string, displayMode = true): void {
  const node = document.getElementById(elementId)
  if (!node) {
    return
  }

  try {
    katex.render(expression, node, {
      throwOnError: true,
      displayMode,
      strict: 'warn',
    })
  } catch {
    node.textContent = expression
  }
}

function start(): void {
  renderMathBlock('math-core', CORE_MATH, true)

  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const halfspaces = copyHalfspaces(baseHalfspaces)
  const baseBoundById = new Map<string, number>(halfspaces.map((halfspace) => [halfspace.id, halfspace.bound]))

  const colorById = paletteForConstraints(halfspaces)
  const renderer = new SceneRenderer(canvas)
  const ui = new UIController(halfspaces)

  let eta = 0.95
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
      const baseBound = baseBoundById.get(halfspace.id)
      if (baseBound === undefined) {
        continue
      }
      halfspace.bound = baseBound * scaleForStrictness(halfspace.id, strictness)
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

  function blendLambdas(progress: number): Record<string, number> {
    const output: Record<string, number> = {}

    for (const halfspace of halfspaces) {
      output[halfspace.id] = (projection.lambdaById[halfspace.id] ?? 0) * progress
    }

    return output
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
      }, 420 + index * 2050)

      autoplayTimers.push(timer)
    })
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)
    const rawReveal = easeOutCubic(progress / RAW_PHASE_CUT)
    const correctionProgress = easeInOutCubic((progress - RAW_PHASE_CUT) / (1 - RAW_PHASE_CUT))

    const rawTarget = projection.step0
    const safeTarget = safeStepOf(projection)

    const rawStep = scale(rawTarget, rawReveal)
    const safeStep = correctionProgress > 0 ? lerp(rawTarget, safeTarget, correctionProgress) : vec(0, 0)

    renderer.render({
      halfspaces,
      zone,
      previousZone,
      rawStep,
      safeStep,
      rawTarget,
      safeTarget,
      colorById,
      activeSetIds: projection.activeSetIds,
      violationRaw: projection.maxViolationStep0,
      violationSafe: projection.maxViolationProjected,
      correctionProgress,
      transitionProgress: progress,
    })

    ui.renderFrame({
      ship: projection.ship,
      reason: projection.ship ? 'Projected update is inside all guardrails.' : projection.reason,
      phaseText: phaseStory(progress, projection.ship),
      rawStep: rawTarget,
      safeStep: safeTarget,
      lambdas: blendLambdas(correctionProgress),
      maxViolationRaw: projection.maxViolationStep0,
      maxViolationSafe: projection.maxViolationProjected,
      descentRetainedRatio: projection.descentRetainedRatio,
      colorById,
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
