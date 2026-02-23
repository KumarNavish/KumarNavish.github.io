import katex from 'katex'
import 'katex/dist/katex.min.css'

import {
  Halfspace,
  Polygon,
  Vec2,
  lerp,
  normalize,
  vec,
  worldBoundsFromHalfspaces,
  intersectHalfspaces,
} from './geometry'
import { ProjectionResult, computeProjectedStep } from './qp'
import { SceneRenderer, paletteForConstraints } from './render'
import { UIController } from './ui'

const GRADIENT_NEW: Vec2 = vec(1.45, -1.12)
const TRANSITION_MS = 920

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

const MATH = {
  primal: String.raw`\begin{aligned}
\Delta_0 &= -\eta\,g_{\mathrm{new}} \\
\Delta^* &= \operatorname*{arg\,min}_{\Delta}\;\langle g_{\mathrm{new}},\Delta\rangle + \frac{1}{2\eta}\lVert\Delta\rVert^2 \\
\text{s.t.}\;&\langle g_k,\Delta\rangle \le \varepsilon_k\;\forall k
\end{aligned}`,
  dual: String.raw`\Delta^*=\Delta_0-\eta\sum_k\lambda_k g_k,\qquad \lambda_k\ge0`,
  eta: String.raw`\Delta_0=-\eta g_{\mathrm{new}}`,
  g1: String.raw`-\Delta_x\le\varepsilon_1`,
  g2: String.raw`\Delta_y\le\varepsilon_2`,
  g3: String.raw`\langle g_3,\Delta\rangle\le\varepsilon_3`,
  g4: String.raw`\langle g_4,\Delta\rangle\le\varepsilon_4`,
}

interface Snapshot {
  halfspaces: Halfspace[]
  zone: Polygon
  rawStep: Vec2
  safeStep: Vec2
  lambdas: Record<string, number>
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

function safeStepOf(projection: ProjectionResult): Vec2 {
  return projection.ship ? projection.projectedStep : projection.step0
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

function blendLambdas(
  previous: Record<string, number>,
  next: Record<string, number>,
  ids: string[],
  blend: number,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of ids) {
    const from = previous[id] ?? 0
    const to = next[id] ?? 0
    out[id] = from + (to - from) * blend
  }
  return out
}

function storyLine(transitionProgress: number): string {
  if (transitionProgress < 0.98) {
    return 'Gray traces show the previous policy. Blue/red vectors are morphing to the new setting from your knob change.'
  }
  return 'Adjust η or any εk. Red shows what the model wants to do; blue shows what is safe to ship.'
}

function start(): void {
  renderMathBlock('math-primal', MATH.primal, true)
  renderMathBlock('math-dual', MATH.dual, true)
  renderMathBlock('knob-eta-math', MATH.eta, false)
  renderMathBlock('knob-g1-math', MATH.g1, false)
  renderMathBlock('knob-g2-math', MATH.g2, false)
  renderMathBlock('knob-g3-math', MATH.g3, false)
  renderMathBlock('knob-g4-math', MATH.g4, false)

  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('Missing canvas #scene-canvas')
  }

  const renderer = new SceneRenderer(canvas)
  const halfspaces = copyHalfspaces(baseHalfspaces)
  const colorById = paletteForConstraints(halfspaces)
  const ui = new UIController(halfspaces)

  let eta = 0.72
  let zone = intersectHalfspaces(halfspaces, worldBoundsFromHalfspaces(halfspaces))
  let projection = computeProjectedStep({
    gradient: GRADIENT_NEW,
    eta,
    halfspaces,
  })

  let previous: Snapshot | null = null
  let transitionStart = performance.now()
  let initialized = false

  function currentSnapshot(): Snapshot {
    return {
      halfspaces: copyHalfspaces(halfspaces),
      zone: copyPolygon(zone),
      rawStep: { ...projection.step0 },
      safeStep: { ...safeStepOf(projection) },
      lambdas: { ...projection.lambdaById },
    }
  }

  function applyControls(capturePrevious = true): void {
    if (capturePrevious && initialized) {
      previous = currentSnapshot()
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

    transitionStart = performance.now()
    initialized = true
  }

  function frame(now: number): void {
    const progress = clamp((now - transitionStart) / TRANSITION_MS)
    const blend = easeInOutCubic(progress)

    const targetRaw = projection.step0
    const targetSafe = safeStepOf(projection)

    const previousRaw = previous?.rawStep ?? targetRaw
    const previousSafe = previous?.safeStep ?? targetSafe

    const rawDisplay = lerp(previousRaw, targetRaw, blend)
    const safeDisplay = lerp(previousSafe, targetSafe, blend)

    const ids = halfspaces.map((halfspace) => halfspace.id)
    const lambdasDisplay = blendLambdas(previous?.lambdas ?? {}, projection.lambdaById, ids, blend)

    const shipReason = projection.ship
      ? 'Projected step is inside all active guardrails.'
      : projection.reason ?? 'No feasible projected step under current limits.'

    renderer.render({
      halfspaces,
      zone,
      rawStep: rawDisplay,
      safeStep: safeDisplay,
      rawTarget: targetRaw,
      safeTarget: targetSafe,
      violationRaw: projection.maxViolationStep0,
      violationSafe: projection.maxViolationProjected,
      previous: previous
        ? {
            halfspaces: previous.halfspaces,
            zone: previous.zone,
            rawStep: previous.rawStep,
            safeStep: previous.safeStep,
          }
        : null,
      changeProgress: progress,
    })

    ui.renderFrame({
      ship: projection.ship,
      reason: shipReason,
      story: storyLine(progress),
      rawStep: targetRaw,
      safeStep: targetSafe,
      lambdas: lambdasDisplay,
      maxViolationRaw: projection.maxViolationStep0,
      maxViolationSafe: projection.maxViolationProjected,
      descentRetainedRatio: projection.descentRetainedRatio,
      colorById,
    })

    requestAnimationFrame(frame)
  }

  ui.onControlsChange(() => {
    applyControls(true)
  })

  ui.onReplay(() => {
    if (previous) {
      transitionStart = performance.now()
    }
  })

  window.addEventListener('resize', () => {
    renderer.resize()
  })

  renderer.resize()
  applyControls(false)
  requestAnimationFrame(frame)
}

start()
