import {
  Halfspace,
  Polygon,
  Vec2,
  intersectHalfspaces,
  lerp,
  normalize,
  vec,
  worldBoundsFromHalfspaces,
} from './geometry'
import { computeProjectedStep, ProjectionResult } from './qp'
import { SceneRenderer } from './render'
import { UIController } from './ui'

const GRADIENT_NEW: Vec2 = vec(1.18, -0.76)
const ANIMATION_MS = 400

interface AnimationState {
  startedAt: number
  fromStep: Vec2
  toStep: Vec2
  fromLambdas: Record<string, number>
  toLambdas: Record<string, number>
}

interface FrameValues {
  step: Vec2
  lambdas: Record<string, number>
  progress: number
}

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

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function blendLambdas(from: Record<string, number>, to: Record<string, number>, t: number): Record<string, number> {
  const output: Record<string, number> = {}
  const keys = new Set<string>([...Object.keys(from), ...Object.keys(to)])
  for (const key of keys) {
    const a = from[key] ?? 0
    const b = to[key] ?? 0
    output[key] = a + (b - a) * t
  }
  return output
}

function createZeroLambdas(halfspaces: Halfspace[]): Record<string, number> {
  const values: Record<string, number> = {}
  for (const halfspace of halfspaces) {
    values[halfspace.id] = 0
  }
  return values
}

function start(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const renderer = new SceneRenderer(canvas)
  const ui = new UIController(baseHalfspaces)

  const halfspaces = copyHalfspaces(baseHalfspaces)
  let zone: Polygon = { vertices: [], isEmpty: true }
  let projection: ProjectionResult = computeProjectedStep({
    gradient: GRADIENT_NEW,
    eta: 0.55,
    halfspaces,
  })

  let animation: AnimationState = {
    startedAt: performance.now(),
    fromStep: projection.step0,
    toStep: projection.projectedStep,
    fromLambdas: createZeroLambdas(halfspaces),
    toLambdas: projection.lambdaById,
  }

  function applyControls(resetAnimation = true): void {
    const controls = ui.readControlValues()

    for (const halfspace of halfspaces) {
      halfspace.bound = controls.epsById[halfspace.id]
      halfspace.active = halfspace.id === 'g4' ? controls.guardrailEnabled : true
    }

    zone = intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))

    projection = computeProjectedStep({
      gradient: GRADIENT_NEW,
      eta: controls.eta,
      halfspaces,
    })

    ui.setShipState(projection.ship, projection.reason)
    ui.setObjectiveDelta(projection.objectiveProjected - projection.objective0)
    ui.setActiveSet(projection.activeSetIds)

    if (resetAnimation) {
      animation = {
        startedAt: performance.now(),
        fromStep: projection.step0,
        toStep: projection.projectedStep,
        fromLambdas: createZeroLambdas(halfspaces),
        toLambdas: projection.lambdaById,
      }
    }
  }

  function computeFrame(now: number): FrameValues {
    const elapsed = now - animation.startedAt
    const rawProgress = Math.min(Math.max(elapsed / ANIMATION_MS, 0), 1)
    const eased = easeOutCubic(rawProgress)

    return {
      step: lerp(animation.fromStep, animation.toStep, eased),
      lambdas: blendLambdas(animation.fromLambdas, animation.toLambdas, eased),
      progress: rawProgress,
    }
  }

  function phaseLabel(progress: number): string {
    if (!projection.ship) {
      return 'HOLD • solver could not certify this move'
    }

    const hasProjectionGap =
      Math.abs(projection.step0.x - projection.projectedStep.x) + Math.abs(projection.step0.y - projection.projectedStep.y) > 1e-5

    if (progress < 1 && hasProjectionGap) {
      return 'Projecting Δ0 onto ship zone'
    }

    if (!hasProjectionGap) {
      return 'Δ0 already inside ship zone'
    }

    return 'Projected step certified for ship'
  }

  function frame(now: number): void {
    const animated = computeFrame(now)

    renderer.render({
      halfspaces,
      zone,
      step0: projection.step0,
      projectedStep: animated.step,
      projectedTarget: projection.projectedStep,
      ship: projection.ship,
      phaseLabel: phaseLabel(animated.progress),
    })

    ui.renderLambdas(animated.lambdas, halfspaces)
    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => applyControls(true))
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
