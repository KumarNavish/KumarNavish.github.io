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

const GRADIENT_NEW: Vec2 = vec(1.18, -0.76)

const TOTAL_ANIMATION_MS = 2200
const SEGMENT_UNCONSTRAINED_END = 0.24
const SEGMENT_VIOLATION_END = 0.5
const SEGMENT_DUAL_END = 0.74

const baseHalfspaces: Halfspace[] = [
  {
    id: 'g1',
    label: 'λ1',
    normal: normalize(vec(1.0, 0.16)),
    bound: 0.94,
    active: true,
  },
  {
    id: 'g2',
    label: 'λ2',
    normal: normalize(vec(-0.72, 0.74)),
    bound: 0.88,
    active: true,
  },
  {
    id: 'g3',
    label: 'λ3',
    normal: normalize(vec(-0.62, -0.81)),
    bound: 0.9,
    active: true,
  },
  {
    id: 'g4',
    label: 'λ4',
    normal: normalize(vec(0.18, -1.0)),
    bound: 0.76,
    active: true,
  },
]

function copyHalfspaces(halfspaces: Halfspace[]): Halfspace[] {
  return halfspaces.map((halfspace) => ({ ...halfspace, normal: { ...halfspace.normal } }))
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

function blendLambdas(target: Record<string, number>, scaleFactor: number): Record<string, number> {
  const values: Record<string, number> = {}
  for (const [id, lambda] of Object.entries(target)) {
    values[id] = lambda * scaleFactor
  }
  return values
}

function phaseFromProgress(progress: number): number {
  if (progress < SEGMENT_UNCONSTRAINED_END) {
    return 0
  }
  if (progress < SEGMENT_VIOLATION_END) {
    return 1
  }
  if (progress < SEGMENT_DUAL_END) {
    return 2
  }
  return 3
}

function localPhaseProgress(progress: number): number {
  const phase = phaseFromProgress(progress)
  if (phase === 0) {
    return clamp(progress / SEGMENT_UNCONSTRAINED_END)
  }
  if (phase === 1) {
    return clamp((progress - SEGMENT_UNCONSTRAINED_END) / (SEGMENT_VIOLATION_END - SEGMENT_UNCONSTRAINED_END))
  }
  if (phase === 2) {
    return clamp((progress - SEGMENT_VIOLATION_END) / (SEGMENT_DUAL_END - SEGMENT_VIOLATION_END))
  }
  return clamp((progress - SEGMENT_DUAL_END) / (1 - SEGMENT_DUAL_END))
}

function correctionScale(progress: number): number {
  if (progress < SEGMENT_VIOLATION_END) {
    return 0
  }
  if (progress >= SEGMENT_DUAL_END) {
    return 1
  }
  const t = (progress - SEGMENT_VIOLATION_END) / (SEGMENT_DUAL_END - SEGMENT_VIOLATION_END)
  return easeInOutCubic(t)
}

function unconstrainedGrowth(progress: number): number {
  if (progress >= SEGMENT_UNCONSTRAINED_END) {
    return 1
  }
  return easeInOutCubic(progress / SEGMENT_UNCONSTRAINED_END)
}

function violationEmphasis(progress: number): number {
  if (progress < SEGMENT_UNCONSTRAINED_END) {
    return 0
  }
  if (progress < SEGMENT_VIOLATION_END) {
    return easeInOutCubic((progress - SEGMENT_UNCONSTRAINED_END) / (SEGMENT_VIOLATION_END - SEGMENT_UNCONSTRAINED_END))
  }
  if (progress < SEGMENT_DUAL_END) {
    return 1
  }

  const t = clamp((progress - SEGMENT_DUAL_END) / (1 - SEGMENT_DUAL_END))
  return 1 - easeInOutCubic(t)
}

function dualEmphasis(progress: number): number {
  if (progress < SEGMENT_VIOLATION_END) {
    return 0
  }
  if (progress >= SEGMENT_DUAL_END) {
    return 1
  }
  const t = (progress - SEGMENT_VIOLATION_END) / (SEGMENT_DUAL_END - SEGMENT_VIOLATION_END)
  return easeInOutCubic(t)
}

function certifyEmphasis(progress: number): number {
  if (progress < SEGMENT_DUAL_END) {
    return 0
  }
  return easeInOutCubic((progress - SEGMENT_DUAL_END) / (1 - SEGMENT_DUAL_END))
}

function objectiveValue(gradient: Vec2, eta: number, step: Vec2): number {
  return dot(gradient, step) + dot(step, step) / (2 * eta)
}

function stationarityResidual(step: Vec2, eta: number, gradient: Vec2, halfspaces: Halfspace[], lambdas: Record<string, number>): number {
  let residual = add(scale(step, 1 / eta), gradient)
  for (const halfspace of halfspaces) {
    if (!halfspace.active) {
      continue
    }
    const lambda = lambdas[halfspace.id] ?? 0
    residual = add(residual, scale(halfspace.normal, lambda))
  }
  return norm(residual)
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

function phaseCaption(phase: number, ship: boolean): string {
  if (!ship) {
    if (phase === 0) {
      return 'Phase 1 · Compute the unconstrained patch Δ0 = -η g_new.'
    }
    if (phase === 1) {
      return 'Phase 2 · Guardrails detect infeasibility via positive violations.'
    }
    if (phase === 2) {
      return 'Phase 3 · Dual solver attempts correction but cannot certify a feasible point.'
    }
    return 'Phase 4 · HOLD: adjust budgets/guardrails before shipping this patch.'
  }

  if (phase === 0) {
    return 'Phase 1 · Unconstrained gradient step.'
  }
  if (phase === 1) {
    return 'Phase 2 · Violation scan: v_k = <g_k, Δ0> - ε_k.'
  }
  if (phase === 2) {
    return 'Phase 3 · Dual correction: Δ = Δ0 - η Σ λ_k g_k.'
  }
  return 'Phase 4 · Certified patch: feasibility, stationarity, and complementarity align.'
}

function start(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const renderer = new SceneRenderer(canvas)
  const halfspaces = copyHalfspaces(baseHalfspaces)
  const colorById = paletteForConstraints(halfspaces)
  const ui = new UIController(halfspaces)

  let eta = 0.55
  let zone: Polygon = { vertices: [], isEmpty: true }
  let projection: ProjectionResult = computeProjectedStep({
    gradient: GRADIENT_NEW,
    eta,
    halfspaces,
  })

  let animationStart = performance.now()

  function applyControls(restartAnimation = true): void {
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

    if (restartAnimation) {
      animationStart = performance.now()
    }
  }

  function frame(now: number): void {
    const elapsed = now - animationStart
    const progress = clamp(elapsed / TOTAL_ANIMATION_MS)
    const phase = phaseFromProgress(progress)
    const phaseProgress = localPhaseProgress(progress)

    const growth = unconstrainedGrowth(progress)
    const correctionProgress = projection.ship ? correctionScale(progress) : 0

    const step0 = projection.step0
    const stepTarget = projection.ship ? projection.projectedStep : projection.step0

    let stepCurrent: Vec2
    if (progress < SEGMENT_UNCONSTRAINED_END) {
      stepCurrent = scale(step0, growth)
    } else if (progress < SEGMENT_VIOLATION_END) {
      stepCurrent = step0
    } else {
      stepCurrent = lerp(step0, stepTarget, correctionProgress)
    }

    const lambdasCurrent = blendLambdas(projection.lambdaById, correctionProgress)

    const correctionChain: CorrectionVisual[] = halfspaces
      .filter((halfspace) => halfspace.active)
      .map((halfspace) => ({
        id: halfspace.id,
        vector: scale(halfspace.normal, -eta * (lambdasCurrent[halfspace.id] ?? 0)),
        color: colorById[halfspace.id],
      }))
      .filter((entry) => norm(entry.vector) > 1e-7)

    const violationCurrentById = violationsForStep(stepCurrent, halfspaces)
    const maxViolationCurrent = maxViolation(violationCurrentById, halfspaces)

    const stationarityCurrent = stationarityResidual(stepCurrent, eta, GRADIENT_NEW, halfspaces, lambdasCurrent)
    const descentLinearCurrent = -dot(GRADIENT_NEW, stepCurrent)
    const descentRetainedRatio = projection.descentLinear0 > 1e-8 ? descentLinearCurrent / projection.descentLinear0 : 1

    const objectiveCurrent = objectiveValue(GRADIENT_NEW, eta, stepCurrent)
    const activeSetCurrent = Object.entries(lambdasCurrent)
      .filter(([, lambda]) => lambda > 1e-4)
      .map(([id]) => id)

    renderer.render({
      halfspaces,
      diagnostics: projection.diagnostics,
      zone,
      step0,
      stepCurrent,
      stepTarget,
      correctionChain,
      violationById: violationCurrentById,
      phaseLabel: phaseCaption(phase, projection.ship),
      ship: projection.ship,
      violationEmphasis: violationEmphasis(progress),
      dualEmphasis: dualEmphasis(progress),
      certifyEmphasis: certifyEmphasis(progress),
    })

    ui.renderFrame({
      phaseIndex: phase,
      phaseCaption: `${phaseCaption(phase, projection.ship)} (${Math.round(phaseProgress * 100)}%)`,
      ship: projection.ship,
      reason: projection.reason,
      step0,
      stepCurrent,
      lambdas: lambdasCurrent,
      diagnostics: projection.diagnostics,
      violationCurrentById,
      stationarityResidual: stationarityCurrent,
      descentRetainedRatio,
      objectiveDeltaCurrent: objectiveCurrent - projection.objective0,
      activeSetIds: activeSetCurrent,
      maxViolationStep0: projection.maxViolationStep0,
      maxViolationCurrent,
      colorById,
    })

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    applyControls(true)
  })

  ui.onReplay(() => {
    applyControls(true)
  })

  window.addEventListener('resize', () => {
    renderer.resize()
  })

  renderer.resize()
  applyControls(true)
  requestAnimationFrame(frame)
}

start()
