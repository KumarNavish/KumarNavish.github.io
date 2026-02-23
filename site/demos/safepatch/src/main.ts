import katex from 'katex'
import 'katex/dist/katex.min.css'

import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  dot,
  intersectHalfspaces,
  lerp,
  norm,
  normalize,
  scale,
  vec,
  worldBoundsFromHalfspaces,
} from './geometry'
import { ProjectionResult, computeProjectedStep } from './qp'
import { CorrectionVisual, SceneRenderer, paletteForConstraints } from './render'
import { UIController } from './ui'

const GRADIENT_NEW: Vec2 = vec(1.45, -1.12)

const TOTAL_ANIMATION_MS = 2000
const RAW_END = 0.26
const SCAN_END = 0.5
const CORRECTION_END = 0.86

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'λ1',
    normal: normalize(vec(-1.0, 0.03)),
    bound: 0.05,
    active: true,
  },
  {
    id: 'g2',
    label: 'λ2',
    normal: normalize(vec(0.02, 1.0)),
    bound: 0.24,
    active: true,
  },
  {
    id: 'g3',
    label: 'λ3',
    normal: normalize(vec(0.86, 0.51)),
    bound: 1.05,
    active: true,
  },
  {
    id: 'g4',
    label: 'λ4',
    normal: normalize(vec(0.56, -0.83)),
    bound: 0.82,
    active: true,
  },
]

const MATH_FORMULAS = {
  primal: String.raw`\begin{aligned}
\Delta_0 &= -\eta\,g_{\text{new}} \\
\Delta^* &= \operatorname*{arg\,min}_{\Delta}\;\langle g_{\text{new}}, \Delta \rangle + \frac{1}{2\eta}\lVert \Delta \rVert^2 \\
\text{s.t.}\;&\langle g_k,\Delta\rangle \le \varepsilon_k,\;\forall k
\end{aligned}`,
  dual: String.raw`\Delta^*=\Delta_0-\eta\sum_k \lambda_k g_k,\qquad \lambda_k \ge 0`,
}

interface AnimatedCorrection extends CorrectionVisual {
  lambda: number
}

interface VisualSnapshot {
  zone: Polygon
  step0: Vec2
  projectedStep: Vec2
}

function copyHalfspaces(halfspaces: Halfspace[]): Halfspace[] {
  return halfspaces.map((halfspace) => ({ ...halfspace, normal: { ...halfspace.normal } }))
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

function phaseFromProgress(progress: number): number {
  if (progress < RAW_END) {
    return 0
  }
  if (progress < SCAN_END) {
    return 1
  }
  if (progress < CORRECTION_END) {
    return 2
  }
  return 3
}

function phaseCaption(phase: number, ship: boolean): string {
  if (!ship) {
    if (phase === 0) {
      return 'Raw step is computed.'
    }
    if (phase === 1) {
      return 'Guardrail check finds violations.'
    }
    if (phase === 2) {
      return 'Projection fails with current budgets.'
    }
    return 'HOLD: relax budgets or disable a guardrail.'
  }

  if (phase === 0) {
    return 'Raw unconstrained update.'
  }
  if (phase === 1) {
    return 'Violations are measured against each guardrail.'
  }
  if (phase === 2) {
    return 'Dual forces sequentially bend the step back.'
  }
  return 'Certified projected step is ready to ship.'
}

function correctionProgress(globalProgress: number, index: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  const local = globalProgress * total - index
  return easeInOutCubic(clamp(local))
}

function buildTargetCorrections(
  projection: ProjectionResult,
  halfspaces: Halfspace[],
  colorById: Record<string, string>,
): AnimatedCorrection[] {
  return halfspaces
    .filter((halfspace) => halfspace.active)
    .map((halfspace) => ({
      id: halfspace.id,
      vector: projection.correctionById[halfspace.id] ?? vec(0, 0),
      color: colorById[halfspace.id],
      progress: 0,
      lambda: projection.lambdaById[halfspace.id] ?? 0,
    }))
    .filter((correction) => norm(correction.vector) > 1e-8)
    .sort((a, b) => b.lambda - a.lambda)
}

function applyAnimatedCorrections(step0: Vec2, corrections: AnimatedCorrection[]): Vec2 {
  let totalCorrection = vec(0, 0)
  for (const correction of corrections) {
    totalCorrection = add(totalCorrection, scale(correction.vector, correction.progress))
  }
  return add(step0, totalCorrection)
}

function violationsForStep(step: Vec2, halfspaces: Halfspace[]): Record<string, number> {
  const violations: Record<string, number> = {}
  for (const halfspace of halfspaces) {
    violations[halfspace.id] = halfspace.active ? dot(halfspace.normal, step) - halfspace.bound : 0
  }
  return violations
}

function maxViolation(violationById: Record<string, number>, halfspaces: Halfspace[]): number {
  let max = -Infinity
  for (const halfspace of halfspaces) {
    if (!halfspace.active) {
      continue
    }
    max = Math.max(max, violationById[halfspace.id] ?? 0)
  }
  return Number.isFinite(max) ? max : 0
}

function renderMathBlock(elementId: string, expression: string): void {
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

function start(): void {
  renderMathBlock('math-primal', MATH_FORMULAS.primal)
  renderMathBlock('math-dual', MATH_FORMULAS.dual)

  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const renderer = new SceneRenderer(canvas)
  const halfspaces = copyHalfspaces(baseHalfspaces)
  const colorById = paletteForConstraints(halfspaces)
  const ui = new UIController(halfspaces)

  let eta = 0.72
  let zone: Polygon = { vertices: [], isEmpty: true }
  let projection: ProjectionResult = computeProjectedStep({
    gradient: GRADIENT_NEW,
    eta,
    halfspaces,
  })

  let targetCorrections: AnimatedCorrection[] = []
  let previousSnapshot: VisualSnapshot | null = null
  let animationStart = performance.now()
  let changeStart = performance.now()
  let initialized = false

  function applyControls(restartAnimation = true, capturePrevious = true): void {
    if (capturePrevious && initialized) {
      previousSnapshot = {
        zone: copyPolygon(zone),
        step0: { ...projection.step0 },
        projectedStep: projection.ship ? { ...projection.projectedStep } : { ...projection.step0 },
      }
    }

    const controls = ui.readControlValues()
    eta = controls.eta

    for (const halfspace of halfspaces) {
      halfspace.bound = controls.epsById[halfspace.id]
      halfspace.active = halfspace.id === 'g4' ? controls.guardrailEnabled : true
    }

    zone = intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))
    projection = computeProjectedStep({
      gradient: GRADIENT_NEW,
      eta,
      halfspaces,
    })

    targetCorrections = projection.ship ? buildTargetCorrections(projection, halfspaces, colorById) : []

    if (restartAnimation) {
      animationStart = performance.now()
    }

    changeStart = performance.now()
    initialized = true
  }

  function frame(now: number): void {
    const elapsed = now - animationStart
    const progress = clamp(elapsed / TOTAL_ANIMATION_MS)
    const changeBlend = clamp((now - changeStart) / 780)
    const phase = phaseFromProgress(progress)

    const step0 = projection.step0
    const stepTarget = projection.ship ? projection.projectedStep : projection.step0

    let stepCurrent = step0
    let animatedCorrections: AnimatedCorrection[] = targetCorrections.map((correction) => ({ ...correction }))

    if (progress < RAW_END) {
      const t = easeInOutCubic(progress / RAW_END)
      stepCurrent = scale(step0, t)
      animatedCorrections = animatedCorrections.map((correction) => ({ ...correction, progress: 0 }))
    } else if (progress < SCAN_END || !projection.ship) {
      stepCurrent = step0
      animatedCorrections = animatedCorrections.map((correction) => ({ ...correction, progress: 0 }))
    } else {
      const correctionGlobal = clamp((progress - SCAN_END) / (CORRECTION_END - SCAN_END))
      animatedCorrections = animatedCorrections.map((correction, index) => {
        const fraction = correctionProgress(correctionGlobal, index, animatedCorrections.length)
        return {
          ...correction,
          progress: fraction,
        }
      })

      stepCurrent = applyAnimatedCorrections(step0, animatedCorrections)

      if (progress >= CORRECTION_END) {
        const settle = easeInOutCubic((progress - CORRECTION_END) / (1 - CORRECTION_END))
        stepCurrent = lerp(stepCurrent, stepTarget, settle)
      }
    }

    const lambdasCurrent: Record<string, number> = {}
    for (const halfspace of halfspaces) {
      lambdasCurrent[halfspace.id] = 0
    }
    for (const correction of animatedCorrections) {
      const targetLambda = projection.lambdaById[correction.id] ?? 0
      lambdasCurrent[correction.id] = targetLambda * correction.progress
    }

    const violationCurrentById = violationsForStep(stepCurrent, halfspaces)
    const maxViolationCurrent = maxViolation(violationCurrentById, halfspaces)
    const activeSetCurrent = Object.entries(lambdasCurrent)
      .filter(([, lambda]) => lambda > 1e-4)
      .map(([id]) => id)

    const reason = projection.ship
      ? 'Blue endpoint is feasible for all active guardrails.'
      : projection.reason ?? 'No feasible projected step under current budgets.'

    renderer.render({
      halfspaces,
      diagnostics: projection.diagnostics,
      zone,
      step0,
      stepCurrent,
      stepTarget,
      corrections: animatedCorrections,
      violationById: violationCurrentById,
      phaseLabel: phaseCaption(phase, projection.ship),
      ship: projection.ship,
      phaseIndex: phase,
      previous: previousSnapshot,
      changeBlend,
    })

    ui.renderFrame({
      phaseIndex: phase,
      phaseCaption: phaseCaption(phase, projection.ship),
      ship: projection.ship,
      reason,
      step0,
      stepCurrent,
      lambdas: lambdasCurrent,
      maxViolationStep0: projection.maxViolationStep0,
      maxViolationCurrent,
      activeSetIds: activeSetCurrent,
      colorById,
    })

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    applyControls(true, true)
  })

  ui.onReplay(() => {
    applyControls(true, false)
  })

  window.addEventListener('resize', () => {
    renderer.resize()
  })

  renderer.resize()
  applyControls(true, false)
  requestAnimationFrame(frame)
}

start()
