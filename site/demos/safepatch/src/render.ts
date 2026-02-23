import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  dot,
  norm,
  normalize,
  scale,
  sub,
  worldBoundsFromHalfspaces,
} from './geometry'
import { ConstraintDiagnostic } from './qp'

export interface CorrectionVisual {
  id: string
  vector: Vec2
  color: string
  progress: number
}

export interface SceneRenderInput {
  halfspaces: Halfspace[]
  diagnostics: ConstraintDiagnostic[]
  zone: Polygon
  step0: Vec2
  stepCurrent: Vec2
  stepTarget: Vec2
  corrections: CorrectionVisual[]
  violationById: Record<string, number>
  phaseLabel: string
  ship: boolean
  phaseIndex: number
}

interface ScreenPoint {
  x: number
  y: number
}

const GRID_COLOR = 'rgba(57, 86, 120, 0.11)'
const AXIS_COLOR = 'rgba(44, 74, 107, 0.22)'
const ZONE_FILL = 'rgba(20, 131, 109, 0.12)'
const ZONE_STROKE = 'rgba(20, 124, 104, 0.65)'
const RAW_COLOR = '#dc2626'
const SAFE_COLOR = '#1668d6'

const CONSTRAINT_COLORS = ['#2563eb', '#d97706', '#0f766e', '#be123c']

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const parsed = Number.parseInt(clean, 16)
  const r = (parsed >> 16) & 255
  const g = (parsed >> 8) & 255
  const b = parsed & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function constraintColor(index: number): string {
  return CONSTRAINT_COLORS[index % CONSTRAINT_COLORS.length]
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
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width <= 0 || height <= 0) {
      return
    }

    const ctx = this.ctx
    ctx.clearRect(0, 0, width, height)

    const background = ctx.createLinearGradient(0, 0, 0, height)
    background.addColorStop(0, '#f9fcff')
    background.addColorStop(1, '#f3f8ff')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)

    const zoneRadius = worldBoundsFromHalfspaces(input.halfspaces)
    const correctionMagnitude = input.corrections.reduce((sum, correction) => sum + norm(correction.vector), 0)
    const stepRadius = Math.max(norm(input.step0), norm(input.stepTarget), norm(input.stepCurrent), correctionMagnitude, 0.9)
    const worldRadius = Math.max(zoneRadius, stepRadius * 1.75)

    const toScreen = (point: Vec2): ScreenPoint => {
      const padX = 56
      const padY = 52
      const innerWidth = Math.max(1, width - padX * 2)
      const innerHeight = Math.max(1, height - padY * 2)

      return {
        x: ((point.x + worldRadius) / (2 * worldRadius)) * innerWidth + padX,
        y: ((worldRadius - point.y) / (2 * worldRadius)) * innerHeight + padY,
      }
    }

    this.drawGrid(toScreen, worldRadius)
    this.drawObjectiveContours(toScreen, input.step0, worldRadius)
    this.drawZone(toScreen, input.zone)
    this.drawConstraints(toScreen, input.halfspaces, input.diagnostics, worldRadius, input.violationById)

    this.drawVector(toScreen, { x: 0, y: 0 }, input.stepTarget, {
      color: withAlpha(SAFE_COLOR, 0.28),
      width: 3,
      dashed: true,
    })

    this.drawVector(toScreen, { x: 0, y: 0 }, input.step0, {
      color: RAW_COLOR,
      width: 3,
      label: 'Δ0',
    })

    this.drawCorrectionChain(toScreen, input.step0, input.corrections)

    this.drawVector(toScreen, { x: 0, y: 0 }, input.stepCurrent, {
      color: input.ship ? SAFE_COLOR : '#475569',
      width: 4,
      label: 'Δ(t)',
      glow: input.ship,
    })

    this.drawViolationLinks(toScreen, input.halfspaces, input.stepCurrent, input.violationById)

    this.drawOrigin(toScreen)
    this.drawStatusLabel(input.phaseLabel, input.ship)
    this.drawLegend(width, height)
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, worldRadius: number): void {
    const ctx = this.ctx
    const tick = worldRadius / 4

    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1

    for (let i = -3; i <= 3; i += 1) {
      const coordinate = i * tick

      const verticalStart = toScreen({ x: coordinate, y: -worldRadius })
      const verticalEnd = toScreen({ x: coordinate, y: worldRadius })
      ctx.beginPath()
      ctx.moveTo(verticalStart.x, verticalStart.y)
      ctx.lineTo(verticalEnd.x, verticalEnd.y)
      ctx.stroke()

      const horizontalStart = toScreen({ x: -worldRadius, y: coordinate })
      const horizontalEnd = toScreen({ x: worldRadius, y: coordinate })
      ctx.beginPath()
      ctx.moveTo(horizontalStart.x, horizontalStart.y)
      ctx.lineTo(horizontalEnd.x, horizontalEnd.y)
      ctx.stroke()
    }

    ctx.strokeStyle = AXIS_COLOR
    ctx.lineWidth = 1.6

    const xStart = toScreen({ x: -worldRadius, y: 0 })
    const xEnd = toScreen({ x: worldRadius, y: 0 })
    ctx.beginPath()
    ctx.moveTo(xStart.x, xStart.y)
    ctx.lineTo(xEnd.x, xEnd.y)
    ctx.stroke()

    const yStart = toScreen({ x: 0, y: -worldRadius })
    const yEnd = toScreen({ x: 0, y: worldRadius })
    ctx.beginPath()
    ctx.moveTo(yStart.x, yStart.y)
    ctx.lineTo(yEnd.x, yEnd.y)
    ctx.stroke()
  }

  private drawObjectiveContours(toScreen: (point: Vec2) => ScreenPoint, center: Vec2, worldRadius: number): void {
    const ctx = this.ctx
    const screenCenter = toScreen(center)
    const unit = toScreen({ x: center.x + worldRadius * 0.15, y: center.y })
    const baseRadius = Math.max(20, Math.abs(unit.x - screenCenter.x) * 0.38)
    const radii = [baseRadius, baseRadius * 1.6, baseRadius * 2.3]

    for (const [index, radius] of radii.entries()) {
      ctx.beginPath()
      ctx.arc(screenCenter.x, screenCenter.y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = withAlpha('#475569', 0.1 + index * 0.05)
      ctx.lineWidth = 1.3
      ctx.stroke()
    }

    ctx.font = '600 11px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = 'rgba(54, 83, 114, 0.65)'
    ctx.fillText('unconstrained optimum', screenCenter.x + 12, screenCenter.y - 10)
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
    ctx.lineWidth = 2.2
    ctx.stroke()
  }

  private drawConstraints(
    toScreen: (point: Vec2) => ScreenPoint,
    halfspaces: Halfspace[],
    diagnostics: ConstraintDiagnostic[],
    worldRadius: number,
    violationById: Record<string, number>,
  ): void {
    const diagnosticsById = new Map(diagnostics.map((entry) => [entry.id, entry]))

    for (let index = 0; index < halfspaces.length; index += 1) {
      const halfspace = halfspaces[index]
      if (!halfspace.active) {
        continue
      }

      const color = constraintColor(index)
      const diagnostic = diagnosticsById.get(halfspace.id)
      const violation = Math.max(0, violationById[halfspace.id] ?? 0)

      const n = halfspace.normal
      const normSq = Math.max(dot(n, n), 1e-8)
      const center = scale(n, halfspace.bound / normSq)
      const tangent = normalize({ x: -n.y, y: n.x })
      const extent = worldRadius * 1.9

      const start = toScreen(add(center, scale(tangent, -extent)))
      const end = toScreen(add(center, scale(tangent, extent)))

      const baseAlpha = diagnostic?.isBinding ? 0.85 : 0.52
      this.strokeScreenLine(start, end, {
        color: withAlpha(color, baseAlpha),
        width: diagnostic?.isBinding ? 2.6 : 1.7,
        dashed: !diagnostic?.isBinding,
      })

      if (violation > 1e-6) {
        this.strokeScreenLine(start, end, {
          color: withAlpha('#dc2626', Math.min(0.8, 0.28 + violation * 0.9)),
          width: 3.1,
        })
      }

      const normalTip = toScreen(add(center, scale(n, worldRadius * 0.14)))
      const normalRoot = toScreen(add(center, scale(n, -worldRadius * 0.01)))
      this.drawArrow(normalRoot, normalTip, {
        color: withAlpha(color, 0.72),
        width: 1.5,
        headSize: 7,
      })

      const labelPosition = toScreen(add(center, scale(tangent, worldRadius * 0.08)))
      const label = halfspace.id.replace('g', 'g')
      const ctx = this.ctx
      ctx.font = '700 11px "IBM Plex Sans", sans-serif'
      ctx.fillStyle = withAlpha(color, 0.85)
      ctx.fillText(label, labelPosition.x + 4, labelPosition.y - 4)
    }
  }

  private drawCorrectionChain(
    toScreen: (point: Vec2) => ScreenPoint,
    start: Vec2,
    corrections: CorrectionVisual[],
  ): void {
    let cursor = { ...start }

    for (const correction of corrections) {
      if (correction.progress <= 0) {
        continue
      }

      const applied = scale(correction.vector, correction.progress)
      const next = add(cursor, applied)
      const isPartial = correction.progress < 0.999

      this.drawVector(toScreen, cursor, next, {
        color: withAlpha(correction.color, 0.28 + correction.progress * 0.58),
        width: 2.4,
        dashed: isPartial,
      })

      if (isPartial) {
        const p = toScreen(next)
        const ctx = this.ctx
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4.1, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(correction.color, 0.72)
        ctx.fill()
      }

      cursor = next
    }
  }

  private drawViolationLinks(
    toScreen: (point: Vec2) => ScreenPoint,
    halfspaces: Halfspace[],
    stepCurrent: Vec2,
    violationById: Record<string, number>,
  ): void {
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
      this.strokeScreenLine(a, b, {
        color: withAlpha('#dc2626', 0.55),
        width: 2.7,
      })

      ctx.beginPath()
      ctx.arc(b.x, b.y, 4.3, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha('#dc2626', 0.66)
      ctx.fill()
    }
  }

  private drawOrigin(toScreen: (point: Vec2) => ScreenPoint): void {
    const origin = toScreen({ x: 0, y: 0 })
    const ctx = this.ctx

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4.4, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#0f365d'
    ctx.fillText('θ', origin.x + 8, origin.y - 8)
  }

  private drawStatusLabel(label: string, ship: boolean): void {
    const ctx = this.ctx
    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = ship ? '#0f766e' : '#b42318'
    ctx.fillText(label, 16, 24)
  }

  private drawLegend(width: number, height: number): void {
    const ctx = this.ctx
    const y = height - 18

    ctx.font = '600 11px "IBM Plex Sans", sans-serif'

    ctx.fillStyle = RAW_COLOR
    ctx.fillRect(14, y - 8, 12, 2)
    ctx.fillStyle = '#365876'
    ctx.fillText('raw update', 32, y)

    ctx.fillStyle = SAFE_COLOR
    ctx.fillRect(118, y - 8, 12, 2)
    ctx.fillStyle = '#365876'
    ctx.fillText('safe projected update', 136, y)

    ctx.fillStyle = withAlpha('#dc2626', 0.58)
    ctx.fillRect(294, y - 8, 12, 2)
    ctx.fillStyle = '#365876'
    ctx.fillText('constraint violation distance', 312, y)
  }

  private drawVector(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    options: { color: string; width: number; dashed?: boolean; glow?: boolean; label?: string },
  ): void {
    const start = toScreen(from)
    const end = toScreen(to)

    if (Math.hypot(end.x - start.x, end.y - start.y) < 1) {
      return
    }

    this.drawArrow(start, end, {
      color: options.color,
      width: options.width,
      dashed: options.dashed,
      glow: options.glow,
      headSize: 9,
    })

    if (options.label) {
      const ctx = this.ctx
      ctx.font = '700 12px "IBM Plex Sans", sans-serif'
      ctx.fillStyle = options.color
      ctx.fillText(options.label, end.x + 8, end.y - 7)
    }
  }

  private drawArrow(
    start: ScreenPoint,
    end: ScreenPoint,
    options: { color: string; width: number; headSize: number; dashed?: boolean; glow?: boolean },
  ): void {
    const delta = { x: end.x - start.x, y: end.y - start.y }
    const length = Math.hypot(delta.x, delta.y)
    if (length < 1e-6) {
      return
    }

    const dir = { x: delta.x / length, y: delta.y / length }
    const normal = { x: -dir.y, y: dir.x }

    const ctx = this.ctx
    if (options.glow) {
      ctx.shadowColor = 'rgba(22, 104, 214, 0.36)'
      ctx.shadowBlur = 12
    }

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = options.color
    ctx.lineWidth = options.width
    ctx.lineCap = 'round'
    ctx.setLineDash(options.dashed ? [6, 6] : [])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.shadowBlur = 0

    const head = options.headSize
    const left = {
      x: end.x - dir.x * head + normal.x * (head * 0.56),
      y: end.y - dir.y * head + normal.y * (head * 0.56),
    }
    const right = {
      x: end.x - dir.x * head - normal.x * (head * 0.56),
      y: end.y - dir.y * head - normal.y * (head * 0.56),
    }

    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = options.color
    ctx.fill()
  }

  private strokeScreenLine(
    a: ScreenPoint,
    b: ScreenPoint,
    options: { color: string; width: number; dashed?: boolean },
  ): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = options.color
    ctx.lineWidth = options.width
    ctx.setLineDash(options.dashed ? [7, 6] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const palette: Record<string, string> = {}
  halfspaces.forEach((halfspace, index) => {
    palette[halfspace.id] = constraintColor(index)
  })
  return palette
}
