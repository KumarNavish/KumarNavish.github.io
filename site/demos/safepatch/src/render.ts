import { Halfspace, Polygon, Vec2, lerp, norm, worldBoundsFromHalfspaces } from './geometry'

interface ScreenPoint {
  x: number
  y: number
}

interface Viewport {
  x: number
  y: number
  width: number
  height: number
}

export interface SceneRenderInput {
  halfspaces: Halfspace[]
  zone: Polygon
  previousZone: Polygon | null
  rawStep: Vec2
  safeStep: Vec2
  rawTarget: Vec2
  safeTarget: Vec2
  colorById: Record<string, string>
  activeSetIds: string[]
  violationRaw: number
  violationSafe: number
  correctionProgress: number
  transitionProgress: number
}

const RAW_COLOR = '#dc2626'
const SAFE_COLOR = '#1d4ed8'
const GRID_COLOR = 'rgba(67, 95, 124, 0.1)'
const AXIS_COLOR = 'rgba(59, 86, 115, 0.24)'
const ZONE_FILL = 'rgba(20, 131, 109, 0.15)'
const ZONE_STROKE = 'rgba(20, 124, 104, 0.68)'

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
    background.addColorStop(1, '#f0f7ff')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)

    const framePad = 14
    const frame: Viewport = {
      x: framePad,
      y: framePad,
      width: width - framePad * 2,
      height: height - framePad * 2,
    }

    this.drawFrame(frame)

    const contentPad = 16
    const legendPad = 34
    const content: Viewport = {
      x: frame.x + contentPad,
      y: frame.y + contentPad + legendPad,
      width: frame.width - contentPad * 2,
      height: frame.height - contentPad * 2 - legendPad,
    }

    const boundRadius = worldBoundsFromHalfspaces(input.halfspaces)
    const stepRadius = Math.max(norm(input.rawTarget), norm(input.safeTarget), norm(input.rawStep), norm(input.safeStep), 0.75)
    const worldRadius = Math.max(boundRadius * 1.9, stepRadius * 1.55, 1.35)

    const toScreen = (point: Vec2): ScreenPoint => ({
      x: ((point.x + worldRadius) / (2 * worldRadius)) * content.width + content.x,
      y: ((worldRadius - point.y) / (2 * worldRadius)) * content.height + content.y,
    })

    ctx.save()
    ctx.beginPath()
    ctx.rect(content.x, content.y, content.width, content.height)
    ctx.clip()

    this.drawGrid(toScreen, content, worldRadius)

    if (input.previousZone && input.previousZone.vertices.length >= 3 && input.transitionProgress < 0.995) {
      this.drawZone(toScreen, input.previousZone, {
        fill: withAlpha('#64748b', 0.02),
        stroke: withAlpha('#64748b', (1 - input.transitionProgress) * 0.5),
        dashed: true,
      })
    }

    this.drawZone(toScreen, input.zone, {
      fill: ZONE_FILL,
      stroke: ZONE_STROKE,
      dashed: false,
    })

    for (const id of input.activeSetIds) {
      const halfspace = input.halfspaces.find((entry) => entry.id === id)
      if (!halfspace) {
        continue
      }
      this.drawConstraintLine(toScreen, worldRadius, halfspace, input.colorById[id] ?? SAFE_COLOR, input.correctionProgress)
    }

    if (input.correctionProgress > 0.01) {
      this.drawConnector(toScreen, input.rawTarget, input.safeTarget, input.correctionProgress)
    }

    this.drawArrow(toScreen, { x: 0, y: 0 }, input.rawStep, {
      color: RAW_COLOR,
      width: 4,
      glow: true,
    })

    if (input.correctionProgress > 0.01) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.safeStep, {
        color: SAFE_COLOR,
        width: 4,
        glow: true,
      })
    }

    const origin = toScreen({ x: 0, y: 0 })
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#324f71'
    ctx.fillText('theta', origin.x + 8, origin.y - 8)

    if (input.violationRaw > 1e-6 && norm(input.rawStep) > 0.12) {
      this.drawViolationPulse(toScreen(input.rawStep), 9.5)
    }

    if (norm(input.rawStep) > 0.11) {
      this.drawTipLabel(toScreen(input.rawStep), 'delta0', RAW_COLOR)
    }
    if (input.correctionProgress > 0.05 && norm(input.safeStep) > 0.11) {
      this.drawTipLabel(toScreen(input.safeStep), 'delta*', SAFE_COLOR)
    }

    ctx.restore()

    this.drawLegend(frame)
  }

  private drawFrame(frame: Viewport): void {
    const ctx = this.ctx
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(158, 180, 204, 0.36)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(frame.x, frame.y, frame.width, frame.height, 14)
    ctx.fill()
    ctx.stroke()
  }

  private drawLegend(frame: Viewport): void {
    const ctx = this.ctx

    const items = [
      { label: 'raw step', color: RAW_COLOR },
      { label: 'safe step', color: SAFE_COLOR },
      { label: 'ship zone', color: '#0f766e' },
    ]

    let cursor = frame.x + 14
    const y = frame.y + 18

    ctx.font = '700 11px "IBM Plex Sans", sans-serif'

    for (const item of items) {
      const width = ctx.measureText(item.label).width + 30
      ctx.fillStyle = withAlpha(item.color, 0.1)
      ctx.strokeStyle = withAlpha(item.color, 0.28)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(cursor, y - 11, width, 22, 11)
      ctx.fill()
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(cursor + 9, y)
      ctx.lineTo(cursor + 18, y)
      ctx.strokeStyle = item.color
      ctx.lineWidth = 2.2
      ctx.stroke()

      ctx.fillStyle = '#234b73'
      ctx.fillText(item.label, cursor + 22, y + 4)

      cursor += width + 8
    }
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, content: Viewport, worldRadius: number): void {
    const ctx = this.ctx
    const step = worldRadius / 4

    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1

    for (let i = -3; i <= 3; i += 1) {
      const coordinate = i * step

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

    ctx.strokeStyle = 'rgba(203, 217, 233, 0.55)'
    ctx.strokeRect(content.x, content.y, content.width, content.height)
  }

  private drawZone(
    toScreen: (point: Vec2) => ScreenPoint,
    zone: Polygon,
    style: { fill: string; stroke: string; dashed: boolean },
  ): void {
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
    ctx.fillStyle = style.fill
    ctx.fill()

    ctx.strokeStyle = style.stroke
    ctx.lineWidth = 2.2
    ctx.setLineDash(style.dashed ? [7, 7] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawConstraintLine(
    toScreen: (point: Vec2) => ScreenPoint,
    worldRadius: number,
    halfspace: Halfspace,
    color: string,
    intensity: number,
  ): void {
    const ctx = this.ctx
    const normal = halfspace.normal
    const direction = { x: -normal.y, y: normal.x }
    const center = { x: normal.x * halfspace.bound, y: normal.y * halfspace.bound }

    const start = {
      x: center.x - direction.x * worldRadius * 1.8,
      y: center.y - direction.y * worldRadius * 1.8,
    }
    const end = {
      x: center.x + direction.x * worldRadius * 1.8,
      y: center.y + direction.y * worldRadius * 1.8,
    }

    const a = toScreen(start)
    const b = toScreen(end)

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = withAlpha(color, 0.12 + intensity * 0.48)
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawConnector(toScreen: (point: Vec2) => ScreenPoint, from: Vec2, to: Vec2, progress: number): void {
    const ctx = this.ctx
    const a = toScreen(from)
    const b = toScreen(to)

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.55)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 5])
    ctx.stroke()
    ctx.setLineDash([])

    const marker = toScreen(lerp(from, to, progress))
    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(124, 58, 237, 0.82)'
    ctx.fill()
  }

  private drawViolationPulse(point: ScreenPoint, radius: number): void {
    const ctx = this.ctx

    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.45)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.2)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  private drawTipLabel(point: ScreenPoint, text: string, color: string): void {
    const ctx = this.ctx
    ctx.font = '700 11px "IBM Plex Sans", sans-serif'
    const paddingX = 8
    const width = ctx.measureText(text).width + paddingX * 2
    const x = point.x + 10
    const y = point.y - 14

    ctx.fillStyle = withAlpha(color, 0.12)
    ctx.strokeStyle = withAlpha(color, 0.38)
    ctx.beginPath()
    ctx.roundRect(x, y - 14, width, 20, 9)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#143a61'
    ctx.fillText(text, x + paddingX, y)
  }

  private drawArrow(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    options: { color: string; width: number; glow?: boolean },
  ): void {
    const start = toScreen(from)
    const end = toScreen(to)

    const delta = { x: end.x - start.x, y: end.y - start.y }
    const length = Math.hypot(delta.x, delta.y)
    if (length < 1e-6) {
      return
    }

    const dir = { x: delta.x / length, y: delta.y / length }
    const normal = { x: -dir.y, y: dir.x }

    const ctx = this.ctx
    if (options.glow) {
      ctx.shadowColor = withAlpha(options.color, 0.38)
      ctx.shadowBlur = 10
    }

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = options.color
    ctx.lineWidth = options.width
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.shadowBlur = 0

    const head = 10
    const left = {
      x: end.x - dir.x * head + normal.x * (head * 0.58),
      y: end.y - dir.y * head + normal.y * (head * 0.58),
    }
    const right = {
      x: end.x - dir.x * head - normal.x * (head * 0.58),
      y: end.y - dir.y * head - normal.y * (head * 0.58),
    }

    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = options.color
    ctx.fill()
  }
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const palette: Record<string, string> = {}
  const colors = ['#1d4ed8', '#d97706', '#0f766e', '#be123c', '#7c3aed']
  halfspaces.forEach((halfspace, index) => {
    palette[halfspace.id] = colors[index % colors.length]
  })
  return palette
}
