import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  dot,
  normalize,
  norm,
  scale,
  sub,
  worldBoundsFromHalfspaces,
} from './geometry'
import { ConstraintDiagnostic } from './qp'

export interface CorrectionVisual {
  id: string
  vector: Vec2
  color: string
}

export interface SceneRenderInput {
  halfspaces: Halfspace[]
  diagnostics: ConstraintDiagnostic[]
  zone: Polygon
  step0: Vec2
  stepCurrent: Vec2
  stepTarget: Vec2
  correctionChain: CorrectionVisual[]
  violationById: Record<string, number>
  phaseLabel: string
  ship: boolean
  violationEmphasis: number
  dualEmphasis: number
  certifyEmphasis: number
}

interface ScreenPoint {
  x: number
  y: number
}

const GRID_COLOR = 'rgba(61, 92, 125, 0.11)'
const AXIS_COLOR = 'rgba(42, 70, 103, 0.26)'
const ZONE_FILL = 'rgba(14, 165, 132, 0.14)'
const ZONE_STROKE = 'rgba(13, 120, 96, 0.58)'
const STEP0_COLOR = '#d92d20'
const STEP_COLOR = '#0e78d6'
const STEP_TARGET_COLOR = 'rgba(14, 120, 214, 0.22)'

const CONSTRAINT_COLORS = ['#6d28d9', '#d97706', '#0f766e', '#be123c']

function constraintColor(index: number): string {
  return CONSTRAINT_COLORS[index % CONSTRAINT_COLORS.length]
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export class SceneRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = context
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio))
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio))
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  render(input: SceneRenderInput): void {
    const ctx = this.ctx
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight

    if (width <= 0 || height <= 0) {
      return
    }

    ctx.clearRect(0, 0, width, height)

    const backdrop = ctx.createLinearGradient(0, 0, 0, height)
    backdrop.addColorStop(0, '#f9fcff')
    backdrop.addColorStop(1, '#f2f8ff')
    ctx.fillStyle = backdrop
    ctx.fillRect(0, 0, width, height)

    const zoneExtent = worldBoundsFromHalfspaces(input.halfspaces)
    const correctionExtent = input.correctionChain.reduce((sum, correction) => sum + norm(correction.vector), 0)
    const stepExtent = Math.max(norm(input.step0), norm(input.stepCurrent), norm(input.stepTarget), correctionExtent, 0.9)
    const worldRadius = Math.max(zoneExtent, stepExtent * 1.65)

    const toScreen = (point: Vec2): ScreenPoint => {
      const pad = 48
      const innerWidth = Math.max(1, width - pad * 2)
      const innerHeight = Math.max(1, height - pad * 2)
      return {
        x: ((point.x + worldRadius) / (2 * worldRadius)) * innerWidth + pad,
        y: ((worldRadius - point.y) / (2 * worldRadius)) * innerHeight + pad,
      }
    }

    this.drawGrid(toScreen, worldRadius)
    this.drawZone(toScreen, input.zone)
    this.drawConstraints(toScreen, input.halfspaces, input.diagnostics, worldRadius, input.violationEmphasis, input.certifyEmphasis)

    this.drawVector(toScreen, { x: 0, y: 0 }, input.step0, {
      color: STEP0_COLOR,
      width: 2.8,
      label: 'Δ0',
      opacity: 0.96,
    })

    this.drawVector(toScreen, { x: 0, y: 0 }, input.stepTarget, {
      color: STEP_TARGET_COLOR,
      width: 3.6,
      dashed: true,
      opacity: 0.9,
    })

    this.drawCorrectionChain(toScreen, input.step0, input.correctionChain, input.dualEmphasis)

    this.drawVector(toScreen, { x: 0, y: 0 }, input.stepCurrent, {
      color: input.ship ? STEP_COLOR : '#6b7280',
      width: 3.5,
      label: 'Δ(t)',
      glow: input.ship,
      opacity: 1,
    })

    this.drawViolationBridges(toScreen, input.halfspaces, input.violationById, input.stepCurrent, input.violationEmphasis)

    const origin = toScreen({ x: 0, y: 0 })
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#0f365d'
    ctx.fillText('θ', origin.x + 8, origin.y - 8)

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = input.ship ? '#0e7063' : '#b42318'
    ctx.fillText(input.phaseLabel, 14, 22)

    this.drawLegend(width, height)
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, worldRadius: number): void {
    const ctx = this.ctx
    const step = worldRadius / 4

    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let g = -3; g <= 3; g += 1) {
      const p = g * step

      const verticalStart = toScreen({ x: p, y: -worldRadius })
      const verticalEnd = toScreen({ x: p, y: worldRadius })
      ctx.beginPath()
      ctx.moveTo(verticalStart.x, verticalStart.y)
      ctx.lineTo(verticalEnd.x, verticalEnd.y)
      ctx.stroke()

      const horizontalStart = toScreen({ x: -worldRadius, y: p })
      const horizontalEnd = toScreen({ x: worldRadius, y: p })
      ctx.beginPath()
      ctx.moveTo(horizontalStart.x, horizontalStart.y)
      ctx.lineTo(horizontalEnd.x, horizontalEnd.y)
      ctx.stroke()
    }

    ctx.strokeStyle = AXIS_COLOR
    ctx.lineWidth = 1.5

    const xAxisStart = toScreen({ x: -worldRadius, y: 0 })
    const xAxisEnd = toScreen({ x: worldRadius, y: 0 })
    ctx.beginPath()
    ctx.moveTo(xAxisStart.x, xAxisStart.y)
    ctx.lineTo(xAxisEnd.x, xAxisEnd.y)
    ctx.stroke()

    const yAxisStart = toScreen({ x: 0, y: -worldRadius })
    const yAxisEnd = toScreen({ x: 0, y: worldRadius })
    ctx.beginPath()
    ctx.moveTo(yAxisStart.x, yAxisStart.y)
    ctx.lineTo(yAxisEnd.x, yAxisEnd.y)
    ctx.stroke()
  }

  private drawZone(toScreen: (point: Vec2) => ScreenPoint, zone: Polygon): void {
    if (zone.vertices.length < 3) {
      return
    }

    const ctx = this.ctx
    ctx.beginPath()
    zone.vertices.forEach((vertex, index) => {
      const p = toScreen(vertex)
      if (index === 0) {
        ctx.moveTo(p.x, p.y)
      } else {
        ctx.lineTo(p.x, p.y)
      }
    })
    ctx.closePath()

    ctx.fillStyle = ZONE_FILL
    ctx.fill()

    ctx.strokeStyle = ZONE_STROKE
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private drawConstraints(
    toScreen: (point: Vec2) => ScreenPoint,
    halfspaces: Halfspace[],
    diagnostics: ConstraintDiagnostic[],
    worldRadius: number,
    violationEmphasis: number,
    certifyEmphasis: number,
  ): void {
    const ctx = this.ctx

    for (let index = 0; index < halfspaces.length; index += 1) {
      const halfspace = halfspaces[index]
      if (!halfspace.active) {
        continue
      }

      const diagnostic = diagnostics.find((entry) => entry.id === halfspace.id)
      const color = constraintColor(index)

      const n = halfspace.normal
      const normSq = Math.max(dot(n, n), 1e-8)
      const center = scale(n, halfspace.bound / normSq)
      const tangent = normalize({ x: -n.y, y: n.x })
      const extent = worldRadius * 1.9

      const start = toScreen(add(center, scale(tangent, -extent)))
      const end = toScreen(add(center, scale(tangent, extent)))

      const violation = Math.max(0, diagnostic?.violationStep0 ?? 0)
      const violationWeight = Math.min(1, violation / 0.35)
      const highlightedColor = withAlpha('#d92d20', 0.22 + 0.45 * violationWeight * violationEmphasis)

      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = withAlpha(color, 0.36)
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.setLineDash([])

      if (violation > 1e-6 && violationEmphasis > 0.02) {
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.strokeStyle = highlightedColor
        ctx.lineWidth = 2.8
        ctx.stroke()
      }

      if (diagnostic?.isBinding && certifyEmphasis > 0.01) {
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.strokeStyle = withAlpha('#1476d8', 0.24 + certifyEmphasis * 0.5)
        ctx.lineWidth = 2.3
        ctx.stroke()
      }

      const normalTip = toScreen(add(center, scale(n, worldRadius * 0.14)))
      const normalRoot = toScreen(add(center, scale(n, -worldRadius * 0.02)))
      this.drawScreenArrow(normalRoot, normalTip, {
        color: withAlpha(color, 0.72),
        width: 1.6,
        headSize: 7,
      })

      const labelPosition = toScreen(add(center, scale(tangent, worldRadius * 0.08)))
      ctx.font = '700 11px "IBM Plex Sans", sans-serif'
      ctx.fillStyle = withAlpha(color, 0.85)
      ctx.fillText(halfspace.id, labelPosition.x + 4, labelPosition.y - 4)
    }
  }

  private drawCorrectionChain(
    toScreen: (point: Vec2) => ScreenPoint,
    step0: Vec2,
    corrections: CorrectionVisual[],
    dualEmphasis: number,
  ): void {
    if (dualEmphasis < 0.01) {
      return
    }

    let cursor = { ...step0 }
    for (const correction of corrections) {
      if (norm(correction.vector) < 1e-6) {
        continue
      }

      const next = add(cursor, correction.vector)
      this.drawVector(toScreen, cursor, next, {
        color: withAlpha(correction.color, 0.26 + dualEmphasis * 0.62),
        width: 2,
        opacity: 1,
      })
      cursor = next
    }
  }

  private drawViolationBridges(
    toScreen: (point: Vec2) => ScreenPoint,
    halfspaces: Halfspace[],
    violationById: Record<string, number>,
    stepCurrent: Vec2,
    violationEmphasis: number,
  ): void {
    if (violationEmphasis < 0.01) {
      return
    }

    const ctx = this.ctx

    for (const halfspace of halfspaces) {
      if (!halfspace.active) {
        continue
      }

      const violation = violationById[halfspace.id] ?? 0
      if (violation <= 1e-6) {
        continue
      }

      const normalSq = Math.max(dot(halfspace.normal, halfspace.normal), 1e-8)
      const boundaryPoint = sub(stepCurrent, scale(halfspace.normal, violation / normalSq))

      const a = toScreen(boundaryPoint)
      const b = toScreen(stepCurrent)

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = withAlpha('#d92d20', 0.28 + 0.52 * violationEmphasis)
      ctx.lineWidth = 2.4
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(b.x, b.y, 3.8, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha('#d92d20', 0.42 + 0.5 * violationEmphasis)
      ctx.fill()
    }
  }

  private drawVector(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    options: { color: string; width: number; opacity: number; dashed?: boolean; glow?: boolean; label?: string },
  ): void {
    const start = toScreen(from)
    const end = toScreen(to)

    this.ctx.save()
    this.ctx.globalAlpha = options.opacity
    this.drawScreenArrow(start, end, {
      color: options.color,
      width: options.width,
      dashed: options.dashed,
      glow: options.glow,
      headSize: 9,
    })

    if (options.label) {
      this.ctx.font = '700 12px "IBM Plex Sans", sans-serif'
      this.ctx.fillStyle = options.color
      this.ctx.fillText(options.label, end.x + 7, end.y - 7)
    }
    this.ctx.restore()
  }

  private drawScreenArrow(
    start: ScreenPoint,
    end: ScreenPoint,
    options: { color: string; width: number; headSize: number; dashed?: boolean; glow?: boolean },
  ): void {
    const ctx = this.ctx
    const delta = { x: end.x - start.x, y: end.y - start.y }
    const length = Math.sqrt(delta.x * delta.x + delta.y * delta.y)
    if (length < 1e-6) {
      return
    }

    const dir = { x: delta.x / length, y: delta.y / length }
    const normal = { x: -dir.y, y: dir.x }

    if (options.glow) {
      ctx.shadowColor = 'rgba(20, 118, 216, 0.35)'
      ctx.shadowBlur = 10
    }

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = options.color
    ctx.lineWidth = options.width
    ctx.setLineDash(options.dashed ? [6, 5] : [])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.shadowBlur = 0

    const head = options.headSize
    const left = {
      x: end.x - dir.x * head + normal.x * (head * 0.55),
      y: end.y - dir.y * head + normal.y * (head * 0.55),
    }
    const right = {
      x: end.x - dir.x * head - normal.x * (head * 0.55),
      y: end.y - dir.y * head - normal.y * (head * 0.55),
    }

    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = options.color
    ctx.fill()
  }

  private drawLegend(width: number, height: number): void {
    const ctx = this.ctx
    const y = height - 18

    ctx.font = '600 11px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#325777'

    ctx.fillStyle = STEP0_COLOR
    ctx.fillRect(14, y - 8, 11, 2)
    ctx.fillStyle = '#325777'
    ctx.fillText('Unconstrained Δ0', 32, y)

    ctx.fillStyle = STEP_COLOR
    ctx.fillRect(162, y - 8, 11, 2)
    ctx.fillStyle = '#325777'
    ctx.fillText('Projected Δ(t)', 180, y)

    ctx.fillStyle = withAlpha('#d92d20', 0.58)
    ctx.fillRect(298, y - 8, 11, 2)
    ctx.fillStyle = '#325777'
    ctx.fillText('Violation distance', 316, y)
  }
}

export function drawLambdaDial(
  canvas: HTMLCanvasElement,
  value: number,
  maxValue: number,
  label: string,
  enabled: boolean,
  color: string,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  const ratio = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * ratio))
  canvas.height = Math.max(1, Math.round(rect.height * ratio))
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.33

  ctx.clearRect(0, 0, width, height)

  const start = (Math.PI * 3) / 4
  const sweep = Math.PI * 1.5

  ctx.beginPath()
  ctx.arc(cx, cy, radius, start, start + sweep, false)
  ctx.strokeStyle = enabled ? 'rgba(63, 97, 129, 0.23)' : 'rgba(148, 163, 184, 0.22)'
  ctx.lineWidth = 6.8
  ctx.lineCap = 'round'
  ctx.stroke()

  const ratioValue = Math.min(Math.max(value / Math.max(maxValue, 1e-6), 0), 1)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, start, start + sweep * ratioValue, false)
  ctx.strokeStyle = enabled ? color : '#94a3b8'
  ctx.lineWidth = 6.8
  ctx.lineCap = 'round'
  ctx.stroke()

  const angle = start + sweep * ratioValue
  const needleLength = radius * 0.85
  const tip = {
    x: cx + needleLength * Math.cos(angle),
    y: cy + needleLength * Math.sin(angle),
  }

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(tip.x, tip.y)
  ctx.strokeStyle = enabled ? '#0f4d87' : '#94a3b8'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2)
  ctx.fillStyle = enabled ? '#0f4d87' : '#94a3b8'
  ctx.fill()

  ctx.font = '700 11px "IBM Plex Sans", sans-serif'
  ctx.fillStyle = '#315575'
  ctx.textAlign = 'center'
  ctx.fillText(label, cx, height - 12)

  ctx.font = '700 12px "Manrope", sans-serif'
  ctx.fillStyle = enabled ? '#143f62' : '#6b7280'
  ctx.fillText(value.toFixed(3), cx, cy + 4)
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const colors: Record<string, string> = {}
  halfspaces.forEach((halfspace, index) => {
    colors[halfspace.id] = constraintColor(index)
  })
  return colors
}
