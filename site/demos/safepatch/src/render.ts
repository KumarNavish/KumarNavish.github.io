import { Halfspace, Polygon, Vec2, add, lerp, norm, worldBoundsFromHalfspaces } from './geometry'

interface PreviousScene {
  halfspaces: Halfspace[]
  zone: Polygon
  rawStep: Vec2
  safeStep: Vec2
}

export interface SceneRenderInput {
  halfspaces: Halfspace[]
  zone: Polygon
  rawStep: Vec2
  safeStep: Vec2
  rawTarget: Vec2
  safeTarget: Vec2
  violationRaw: number
  violationSafe: number
  previous: PreviousScene | null
  changeProgress: number
}

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

const RAW_COLOR = '#dc2626'
const SAFE_COLOR = '#1d4ed8'
const PREVIOUS_COLOR = '#64748b'
const GRID_COLOR = 'rgba(67, 95, 124, 0.1)'
const AXIS_COLOR = 'rgba(59, 86, 115, 0.22)'
const ZONE_FILL = 'rgba(20, 131, 109, 0.13)'
const ZONE_STROKE = 'rgba(20, 124, 104, 0.62)'

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

    const bg = ctx.createLinearGradient(0, 0, 0, height)
    bg.addColorStop(0, '#f9fcff')
    bg.addColorStop(1, '#f1f7ff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    const gap = 16
    const pad = 14
    const panelWidth = (width - pad * 2 - gap) / 2
    const panelHeight = height - pad * 2

    const left: Viewport = {
      x: pad,
      y: pad,
      width: panelWidth,
      height: panelHeight,
    }

    const right: Viewport = {
      x: pad + panelWidth + gap,
      y: pad,
      width: panelWidth,
      height: panelHeight,
    }

    const stepExtent = Math.max(norm(input.rawTarget), norm(input.safeTarget), norm(input.rawStep), norm(input.safeStep), 0.9)
    const currentRadius = worldBoundsFromHalfspaces(input.halfspaces)
    const previousRadius = input.previous ? worldBoundsFromHalfspaces(input.previous.halfspaces) : 0
    const worldRadius = Math.max(stepExtent * 1.9, currentRadius * 2.0, previousRadius * 2.0, 2.8)

    this.drawPanel({
      viewport: left,
      title: 'Unsafe raw update',
      subtitle: 'Before projection',
      primaryStep: input.rawStep,
      primaryTarget: input.rawTarget,
      previousPrimary: input.previous?.rawStep ?? null,
      secondaryStep: input.safeStep,
      secondaryColor: SAFE_COLOR,
      primaryColor: RAW_COLOR,
      violation: input.violationRaw,
      zone: input.zone,
      previousZone: input.previous?.zone ?? null,
      worldRadius,
      changeProgress: input.changeProgress,
      showBridge: false,
    })

    this.drawPanel({
      viewport: right,
      title: 'Projected safe update',
      subtitle: 'After projection',
      primaryStep: input.safeStep,
      primaryTarget: input.safeTarget,
      previousPrimary: input.previous?.safeStep ?? null,
      secondaryStep: input.rawStep,
      secondaryColor: RAW_COLOR,
      primaryColor: SAFE_COLOR,
      violation: input.violationSafe,
      zone: input.zone,
      previousZone: input.previous?.zone ?? null,
      worldRadius,
      changeProgress: input.changeProgress,
      showBridge: true,
    })
  }

  private drawPanel(params: {
    viewport: Viewport
    title: string
    subtitle: string
    primaryStep: Vec2
    primaryTarget: Vec2
    previousPrimary: Vec2 | null
    secondaryStep: Vec2
    secondaryColor: string
    primaryColor: string
    violation: number
    zone: Polygon
    previousZone: Polygon | null
    worldRadius: number
    changeProgress: number
    showBridge: boolean
  }): void {
    const {
      viewport,
      title,
      subtitle,
      primaryStep,
      primaryTarget,
      previousPrimary,
      secondaryStep,
      secondaryColor,
      primaryColor,
      violation,
      zone,
      previousZone,
      worldRadius,
      changeProgress,
      showBridge,
    } = params

    const ctx = this.ctx

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(158, 180, 204, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(viewport.x, viewport.y, viewport.width, viewport.height, 14)
    ctx.fill()
    ctx.stroke()

    const headerHeight = 46
    const contentPad = 12

    const content: Viewport = {
      x: viewport.x + contentPad,
      y: viewport.y + headerHeight,
      width: viewport.width - contentPad * 2,
      height: viewport.height - headerHeight - contentPad,
    }

    const toScreen = (point: Vec2): ScreenPoint => {
      return {
        x: ((point.x + worldRadius) / (2 * worldRadius)) * content.width + content.x,
        y: ((worldRadius - point.y) / (2 * worldRadius)) * content.height + content.y,
      }
    }

    ctx.fillStyle = '#173f64'
    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillText(title, viewport.x + 12, viewport.y + 18)

    ctx.fillStyle = '#5a7898'
    ctx.font = '600 11px "IBM Plex Sans", sans-serif'
    ctx.fillText(subtitle, viewport.x + 12, viewport.y + 34)

    const statusLabel = violation > 1e-6 ? `violates +${violation.toFixed(3)}` : 'inside zone'
    const statusColor = violation > 1e-6 ? '#dc2626' : '#0f766e'
    const statusWidth = ctx.measureText(statusLabel).width + 18
    const statusX = viewport.x + viewport.width - statusWidth - 12
    const statusY = viewport.y + 10

    ctx.fillStyle = withAlpha(statusColor, 0.12)
    ctx.strokeStyle = withAlpha(statusColor, 0.35)
    ctx.beginPath()
    ctx.roundRect(statusX, statusY, statusWidth, 22, 11)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = statusColor
    ctx.font = '700 11px "IBM Plex Sans", sans-serif'
    ctx.fillText(statusLabel, statusX + 9, statusY + 15)

    ctx.save()
    ctx.beginPath()
    ctx.rect(content.x, content.y, content.width, content.height)
    ctx.clip()

    this.drawGrid(toScreen, content, worldRadius)

    if (previousZone && previousZone.vertices.length >= 3 && changeProgress < 0.999) {
      this.drawZone(toScreen, previousZone, {
        fill: withAlpha(PREVIOUS_COLOR, 0.03),
        stroke: withAlpha(PREVIOUS_COLOR, (1 - changeProgress) * 0.55),
        dashed: true,
      })
    }

    this.drawZone(toScreen, zone, {
      fill: ZONE_FILL,
      stroke: ZONE_STROKE,
      dashed: false,
    })

    if (previousPrimary && changeProgress < 0.999) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, previousPrimary, {
        color: withAlpha(PREVIOUS_COLOR, (1 - changeProgress) * 0.95),
        width: 2,
        dashed: true,
      })
    }

    this.drawArrow(toScreen, { x: 0, y: 0 }, secondaryStep, {
      color: withAlpha(secondaryColor, 0.25),
      width: 2,
      dashed: true,
    })

    if (showBridge && previousPrimary && changeProgress < 0.999) {
      this.drawBridge(toScreen, previousPrimary, primaryTarget, changeProgress)
    }

    this.drawArrow(toScreen, { x: 0, y: 0 }, primaryStep, {
      color: primaryColor,
      width: 4,
      glow: true,
    })

    const origin = toScreen({ x: 0, y: 0 })
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    ctx.restore()
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
    ctx.lineWidth = 2
    ctx.setLineDash(style.dashed ? [7, 7] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawBridge(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    progress: number,
  ): void {
    if (norm(add(to, { x: -from.x, y: -from.y })) <= 1e-6) {
      return
    }

    const ctx = this.ctx
    const a = toScreen(from)
    const b = toScreen(to)

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = withAlpha('#7c3aed', 0.52)
    ctx.lineWidth = 2
    ctx.setLineDash([4, 5])
    ctx.stroke()
    ctx.setLineDash([])

    const marker = toScreen(lerp(from, to, progress))
    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#7c3aed', 0.82)
    ctx.fill()
  }

  private drawArrow(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    options: { color: string; width: number; dashed?: boolean; glow?: boolean },
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
      ctx.shadowColor = withAlpha('#2563eb', 0.3)
      ctx.shadowBlur = 10
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

    const head = 9
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
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const palette: Record<string, string> = {}
  halfspaces.forEach((halfspace, index) => {
    palette[halfspace.id] = ['#2563eb', '#d97706', '#0f766e', '#be123c'][index % 4]
  })
  return palette
}
