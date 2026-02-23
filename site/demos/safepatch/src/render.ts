import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  dot,
  lerp,
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

interface PreviousScene {
  zone: Polygon
  step0: Vec2
  projectedStep: Vec2
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
  previous: PreviousScene | null
  changeBlend: number
}

interface ScreenPoint {
  x: number
  y: number
}

const RAW_COLOR = '#dc2626'
const SAFE_COLOR = '#1d4ed8'
const CORRECTION_COLOR = '#7c3aed'
const PREVIOUS_COLOR = '#64748b'
const GRID_COLOR = 'rgba(71, 101, 133, 0.1)'
const AXIS_COLOR = 'rgba(57, 85, 115, 0.2)'
const ZONE_FILL = 'rgba(20, 131, 109, 0.12)'
const ZONE_STROKE = 'rgba(20, 124, 104, 0.64)'

const CONSTRAINT_COLORS = ['#2563eb', '#d97706', '#0f766e', '#be123c']

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
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width <= 0 || height <= 0) {
      return
    }

    const ctx = this.ctx
    ctx.clearRect(0, 0, width, height)

    const background = ctx.createLinearGradient(0, 0, 0, height)
    background.addColorStop(0, '#f9fcff')
    background.addColorStop(1, '#f1f7ff')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)

    const zoneRadius = worldBoundsFromHalfspaces(input.halfspaces)
    const worldRadius = Math.max(zoneRadius * 1.95, 2.8)

    const toScreen = (point: Vec2): ScreenPoint => {
      const padX = 60
      const padY = 54
      const innerWidth = Math.max(1, width - padX * 2)
      const innerHeight = Math.max(1, height - padY * 2)

      return {
        x: ((point.x + worldRadius) / (2 * worldRadius)) * innerWidth + padX,
        y: ((worldRadius - point.y) / (2 * worldRadius)) * innerHeight + padY,
      }
    }

    this.drawGrid(toScreen, worldRadius)

    if (input.previous && input.changeBlend < 0.999) {
      const alpha = Math.max(0, 1 - input.changeBlend) * 0.84
      this.drawPreviousSnapshot(toScreen, input.previous, alpha)
      this.drawChangeBridge(toScreen, input.previous.projectedStep, input.stepTarget, input.changeBlend)
    }

    this.drawZone(toScreen, input.zone)
    this.drawConstraints(toScreen, input.halfspaces, input.diagnostics, worldRadius, input.violationById)

    this.drawVector(toScreen, { x: 0, y: 0 }, input.stepTarget, {
      color: withAlpha(SAFE_COLOR, 0.24),
      width: 2.8,
      dashed: true,
    })

    this.drawVector(toScreen, { x: 0, y: 0 }, input.step0, {
      color: RAW_COLOR,
      width: 3.4,
    })

    const correction = sub(input.stepCurrent, input.step0)
    if (input.phaseIndex >= 2 && norm(correction) > 1e-5) {
      this.drawVector(toScreen, input.step0, input.stepCurrent, {
        color: CORRECTION_COLOR,
        width: 3.2,
      })
    }

    this.drawVector(toScreen, { x: 0, y: 0 }, input.stepCurrent, {
      color: input.ship ? SAFE_COLOR : '#475569',
      width: 4.4,
      glow: input.ship,
    })

    this.drawWorstViolation(toScreen, input.stepCurrent, input.halfspaces, input.violationById)
    this.drawOrigin(toScreen)
    this.drawLegend(width, height, input.previous !== null && input.changeBlend < 0.999)
    this.drawPhaseLabel(width, input.phaseLabel, input.ship)
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, worldRadius: number): void {
    const ctx = this.ctx
    const tick = worldRadius / 4

    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1

    for (let i = -3; i <= 3; i += 1) {
      const coordinate = i * tick
      const vStart = toScreen({ x: coordinate, y: -worldRadius })
      const vEnd = toScreen({ x: coordinate, y: worldRadius })
      ctx.beginPath()
      ctx.moveTo(vStart.x, vStart.y)
      ctx.lineTo(vEnd.x, vEnd.y)
      ctx.stroke()

      const hStart = toScreen({ x: -worldRadius, y: coordinate })
      const hEnd = toScreen({ x: worldRadius, y: coordinate })
      ctx.beginPath()
      ctx.moveTo(hStart.x, hStart.y)
      ctx.lineTo(hEnd.x, hEnd.y)
      ctx.stroke()
    }

    ctx.strokeStyle = AXIS_COLOR
    ctx.lineWidth = 1.5

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

  private drawPreviousSnapshot(toScreen: (point: Vec2) => ScreenPoint, previous: PreviousScene, alpha: number): void {
    if (previous.zone.vertices.length >= 3) {
      const ctx = this.ctx
      ctx.beginPath()
      previous.zone.vertices.forEach((vertex, index) => {
        const p = toScreen(vertex)
        if (index === 0) {
          ctx.moveTo(p.x, p.y)
        } else {
          ctx.lineTo(p.x, p.y)
        }
      })
      ctx.closePath()
      ctx.strokeStyle = withAlpha(PREVIOUS_COLOR, alpha * 0.56)
      ctx.lineWidth = 1.8
      ctx.setLineDash([8, 7])
      ctx.stroke()
      ctx.setLineDash([])
    }

    this.drawVector(toScreen, { x: 0, y: 0 }, previous.projectedStep, {
      color: withAlpha(PREVIOUS_COLOR, alpha * 0.9),
      width: 2.4,
      dashed: true,
    })
  }

  private drawChangeBridge(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    blend: number,
  ): void {
    if (norm(sub(to, from)) <= 1e-5) {
      return
    }

    const ctx = this.ctx
    const a = toScreen(from)
    const b = toScreen(to)

    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
    gradient.addColorStop(0, withAlpha('#64748b', 0.58))
    gradient.addColorStop(1, withAlpha('#7c3aed', 0.74))

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = gradient
    ctx.lineWidth = 2.2
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])

    const marker = toScreen(lerp(from, to, blend))
    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4.6, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#7c3aed', 0.78)
    ctx.fill()
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
    ctx.lineWidth = 2.1
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

      const diagnostic = diagnosticsById.get(halfspace.id)
      const color = constraintColor(index)

      const n = halfspace.normal
      const normSq = Math.max(dot(n, n), 1e-8)
      const center = scale(n, halfspace.bound / normSq)
      const tangent = normalize({ x: -n.y, y: n.x })
      const extent = worldRadius * 1.9

      const start = toScreen(add(center, scale(tangent, -extent)))
      const end = toScreen(add(center, scale(tangent, extent)))

      this.strokeLine(start, end, {
        color: withAlpha(color, 0.31),
        width: diagnostic?.isBinding ? 2.2 : 1.4,
        dashed: true,
      })

      const violation = Math.max(0, violationById[halfspace.id] ?? 0)
      if (violation > 1e-6) {
        this.strokeLine(start, end, {
          color: withAlpha('#dc2626', Math.min(0.75, 0.25 + violation * 0.9)),
          width: 2.7,
        })
      }
    }
  }

  private drawWorstViolation(
    toScreen: (point: Vec2) => ScreenPoint,
    stepCurrent: Vec2,
    halfspaces: Halfspace[],
    violationById: Record<string, number>,
  ): void {
    let worst: Halfspace | null = null
    let worstValue = 0

    for (const halfspace of halfspaces) {
      if (!halfspace.active) {
        continue
      }
      const value = violationById[halfspace.id] ?? 0
      if (value > worstValue) {
        worstValue = value
        worst = halfspace
      }
    }

    if (!worst || worstValue <= 1e-6) {
      return
    }

    const normalSq = Math.max(dot(worst.normal, worst.normal), 1e-8)
    const boundaryPoint = sub(stepCurrent, scale(worst.normal, worstValue / normalSq))

    const ctx = this.ctx
    const a = toScreen(boundaryPoint)
    const b = toScreen(stepCurrent)

    this.strokeLine(a, b, {
      color: withAlpha('#dc2626', 0.62),
      width: 2.9,
    })

    ctx.beginPath()
    ctx.arc(b.x, b.y, 4.6, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#dc2626', 0.72)
    ctx.fill()
  }

  private drawOrigin(toScreen: (point: Vec2) => ScreenPoint): void {
    const origin = toScreen({ x: 0, y: 0 })
    const ctx = this.ctx

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4.3, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#0f365d'
    ctx.fillText('θ', origin.x + 8, origin.y - 8)
  }

  private drawLegend(width: number, height: number, showPrevious: boolean): void {
    const ctx = this.ctx
    const x = 14
    const rowHeight = 18
    const rows = showPrevious ? 4 : 3
    const legendWidth = showPrevious ? 172 : 148
    const legendHeight = 12 + rowHeight * rows
    const y = height - legendHeight - 14

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, y, legendWidth, legendHeight, 9)
    ctx.fill()
    ctx.stroke()

    const drawItem = (index: number, color: string, label: string): void => {
      const itemY = y + 14 + index * rowHeight
      ctx.fillStyle = color
      ctx.fillRect(x + 10, itemY - 3, 12, 2.5)
      ctx.fillStyle = '#365876'
      ctx.font = '600 11px "IBM Plex Sans", sans-serif'
      ctx.fillText(label, x + 28, itemY)
    }

    drawItem(0, RAW_COLOR, 'raw step')
    drawItem(1, CORRECTION_COLOR, 'correction')
    drawItem(2, SAFE_COLOR, 'safe step')
    if (showPrevious) {
      drawItem(3, PREVIOUS_COLOR, 'previous step')
    }
  }

  private drawPhaseLabel(width: number, label: string, ship: boolean): void {
    const ctx = this.ctx
    const text = label
    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    const textWidth = ctx.measureText(text).width
    const padX = 10
    const padY = 7
    const boxWidth = textWidth + padX * 2
    const boxHeight = 26
    const x = width - boxWidth - 16
    const y = 14

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.strokeStyle = ship ? 'rgba(15, 118, 110, 0.35)' : 'rgba(180, 35, 24, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, y, boxWidth, boxHeight, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = ship ? '#0f766e' : '#b42318'
    ctx.fillText(text, x + padX, y + boxHeight - padY)
  }

  private drawVector(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    options: { color: string; width: number; dashed?: boolean; glow?: boolean },
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
      ctx.shadowColor = 'rgba(29, 78, 216, 0.35)'
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

  private strokeLine(a: ScreenPoint, b: ScreenPoint, options: { color: string; width: number; dashed?: boolean }): void {
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
