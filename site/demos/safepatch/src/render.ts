import { Halfspace, Polygon, Vec2, add, norm, scale, sub, worldBoundsFromHalfspaces } from './geometry'

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
  constraintForceById: Record<string, number>
  violationRaw: number
  zoneReveal: number
  rawReveal: number
  safeReveal: number
  correctionProgress: number
  transitionProgress: number
}

const RAW_COLOR = '#dc2626'
const SAFE_COLOR = '#1d4ed8'

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function polygonCentroid(polygon: Polygon): Vec2 | null {
  if (polygon.vertices.length < 3) {
    return null
  }

  let areaAccumulator = 0
  let cxAccumulator = 0
  let cyAccumulator = 0

  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const a = polygon.vertices[i]
    const b = polygon.vertices[(i + 1) % polygon.vertices.length]
    const cross = a.x * b.y - b.x * a.y

    areaAccumulator += cross
    cxAccumulator += (a.x + b.x) * cross
    cyAccumulator += (a.y + b.y) * cross
  }

  const area = areaAccumulator / 2
  if (Math.abs(area) <= 1e-8) {
    return null
  }

  return {
    x: cxAccumulator / (6 * area),
    y: cyAccumulator / (6 * area),
  }
}

function morphPolygon(zone: Polygon, reveal: number): Polygon {
  const centroid = polygonCentroid(zone)
  if (!centroid || zone.vertices.length < 3) {
    return zone
  }

  const t = clamp(reveal)
  return {
    isEmpty: zone.isEmpty,
    vertices: zone.vertices.map((vertex) => ({
      x: centroid.x + (vertex.x - centroid.x) * t,
      y: centroid.y + (vertex.y - centroid.y) * t,
    })),
  }
}

function cubicBezierPoint(a: Vec2, c1: Vec2, c2: Vec2, b: Vec2, t: number): Vec2 {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  return {
    x: uuu * a.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + ttt * b.x,
    y: uuu * a.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + ttt * b.y,
  }
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
    bg.addColorStop(0, '#f8fcff')
    bg.addColorStop(1, '#ebf4ff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    const frame: Viewport = {
      x: 14,
      y: 14,
      width: width - 28,
      height: height - 28,
    }

    const content: Viewport = {
      x: frame.x + 12,
      y: frame.y + 12,
      width: frame.width - 24,
      height: frame.height - 24,
    }

    const boundRadius = worldBoundsFromHalfspaces(input.halfspaces)
    const stepRadius = Math.max(norm(input.rawTarget), norm(input.safeTarget), norm(input.rawStep), norm(input.safeStep), 0.85)
    const worldRadius = Math.max(boundRadius * 2, stepRadius * 1.45, 1.4)

    const toScreen = (point: Vec2): ScreenPoint => ({
      x: ((point.x + worldRadius) / (2 * worldRadius)) * content.width + content.x,
      y: ((worldRadius - point.y) / (2 * worldRadius)) * content.height + content.y,
    })

    this.drawAtmosphere(content)

    ctx.save()
    ctx.beginPath()
    ctx.rect(content.x, content.y, content.width, content.height)
    ctx.clip()

    this.drawGrid(toScreen, content, worldRadius)

    if (input.previousZone && input.previousZone.vertices.length >= 3 && input.transitionProgress < 0.996) {
      this.drawZone(toScreen, input.previousZone, withAlpha('#6b7f97', 0.18), withAlpha('#6b7f97', 0.25), true)
    }

    const displayedZone = morphPolygon(input.zone, 0.2 + input.zoneReveal * 0.8)
    this.drawZone(
      toScreen,
      displayedZone,
      withAlpha('#0f766e', 0.12 + input.zoneReveal * 0.14),
      withAlpha('#0f766e', 0.34 + input.zoneReveal * 0.56),
      false,
    )

    for (const halfspace of input.halfspaces) {
      if (!halfspace.active) {
        continue
      }
      const emphasis = clamp((input.constraintForceById[halfspace.id] ?? 0) + 0.06)
      this.drawConstraintLine(
        toScreen,
        worldRadius,
        halfspace,
        input.colorById[halfspace.id] ?? SAFE_COLOR,
        emphasis,
      )
    }

    const origin = toScreen({ x: 0, y: 0 })

    this.drawRawTrail(toScreen, input.rawTarget, input.rawReveal)

    if (input.rawReveal > 0.04) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.rawStep, RAW_COLOR, 4, 0.93)
    }

    if (input.safeReveal > 0.02) {
      this.drawCurvedCorrection(toScreen, input.rawTarget, input.safeTarget, input.correctionProgress)
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.safeStep, SAFE_COLOR, 4.3, 0.95)
      this.drawSafeLock(toScreen(input.safeStep), input.safeReveal)
    }

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4.1, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    this.drawLabel(content, origin, 'theta', '#0f172a', 10, -14)

    if (input.violationRaw > 1e-6 && input.rawReveal > 0.1 && norm(input.rawStep) > 0.08) {
      this.drawViolationPulse(toScreen(input.rawStep))
    }

    if (input.rawReveal > 0.08 && norm(input.rawStep) > 0.08) {
      this.drawLabel(content, toScreen(input.rawStep), 'delta0', RAW_COLOR, 10, -14)
    }

    if (input.safeReveal > 0.1 && norm(input.safeStep) > 0.08) {
      this.drawLabel(content, toScreen(input.safeStep), 'delta*', SAFE_COLOR, 10, 18)
    }

    const centroid = polygonCentroid(input.zone)
    if (centroid) {
      this.drawLabel(content, toScreen(centroid), 'ship zone', '#0f766e', 8, -16)
    }

    ctx.restore()
  }

  private drawAtmosphere(content: Viewport): void {
    const ctx = this.ctx

    const glow = ctx.createRadialGradient(
      content.x + content.width * 0.48,
      content.y + content.height * 0.54,
      8,
      content.x + content.width * 0.48,
      content.y + content.height * 0.54,
      content.width * 0.68,
    )

    glow.addColorStop(0, 'rgba(255,255,255,0.84)')
    glow.addColorStop(1, 'rgba(206,223,245,0.18)')

    ctx.fillStyle = glow
    ctx.fillRect(content.x, content.y, content.width, content.height)
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, content: Viewport, worldRadius: number): void {
    const ctx = this.ctx
    const step = worldRadius / 4

    ctx.strokeStyle = 'rgba(66, 94, 122, 0.09)'
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

    ctx.strokeStyle = 'rgba(57, 83, 110, 0.23)'
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

    ctx.strokeStyle = 'rgba(197, 213, 232, 0.55)'
    ctx.strokeRect(content.x, content.y, content.width, content.height)
  }

  private drawZone(
    toScreen: (point: Vec2) => ScreenPoint,
    zone: Polygon,
    fill: string,
    stroke: string,
    dashed: boolean,
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
    ctx.fillStyle = fill
    ctx.fill()

    ctx.strokeStyle = stroke
    ctx.lineWidth = 2.1
    ctx.setLineDash(dashed ? [7, 7] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawConstraintLine(
    toScreen: (point: Vec2) => ScreenPoint,
    worldRadius: number,
    halfspace: Halfspace,
    color: string,
    emphasis: number,
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
    ctx.strokeStyle = withAlpha(color, 0.08 + emphasis * 0.62)
    ctx.lineWidth = 1.1 + emphasis * 2.2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawRawTrail(toScreen: (point: Vec2) => ScreenPoint, rawTarget: Vec2, reveal: number): void {
    if (reveal <= 0.02) {
      return
    }

    for (let i = 1; i <= 4; i += 1) {
      const t = clamp((reveal * i) / 4)
      const ghost = scale(rawTarget, t * 0.92)
      const alpha = 0.16 + t * 0.18
      this.drawArrow(toScreen, { x: 0, y: 0 }, ghost, RAW_COLOR, 2.4, alpha)
    }
  }

  private drawCurvedCorrection(
    toScreen: (point: Vec2) => ScreenPoint,
    rawTarget: Vec2,
    safeTarget: Vec2,
    progress: number,
  ): void {
    const delta = sub(safeTarget, rawTarget)
    const dist = norm(delta)
    if (dist <= 1e-6) {
      return
    }

    const dir = scale(delta, 1 / dist)
    const normal = { x: -dir.y, y: dir.x }
    const bend = dist * 0.36

    const c1 = add(rawTarget, add(scale(dir, dist * 0.22), scale(normal, bend)))
    const c2 = add(rawTarget, add(scale(dir, dist * 0.75), scale(normal, bend * 0.55)))

    const ctx = this.ctx
    const p0 = toScreen(rawTarget)
    const p1 = toScreen(c1)
    const p2 = toScreen(c2)
    const p3 = toScreen(safeTarget)

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.56)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 5])
    ctx.stroke()
    ctx.setLineDash([])

    const markerWorld = cubicBezierPoint(rawTarget, c1, c2, safeTarget, clamp(progress))
    const marker = toScreen(markerWorld)

    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(124, 58, 237, 0.88)'
    ctx.fill()
  }

  private drawSafeLock(point: ScreenPoint, reveal: number): void {
    const ctx = this.ctx
    const pulse = (1 - clamp(reveal)) * 10

    ctx.beginPath()
    ctx.arc(point.x, point.y, 8 + pulse, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(29, 78, 216, ${0.34 * (1 - clamp(reveal))})`
    ctx.lineWidth = 1.6
    ctx.stroke()
  }

  private drawViolationPulse(point: ScreenPoint): void {
    const ctx = this.ctx

    ctx.beginPath()
    ctx.arc(point.x, point.y, 10, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.48)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(point.x, point.y, 15, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.2)'
    ctx.lineWidth = 1.3
    ctx.stroke()
  }

  private drawLabel(
    bounds: Viewport,
    anchor: ScreenPoint,
    text: string,
    color: string,
    dx: number,
    dy: number,
  ): void {
    const ctx = this.ctx
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif'

    const pad = 8
    const width = ctx.measureText(text).width + pad * 2

    const x = clamp(anchor.x + dx, bounds.x + 4, bounds.x + bounds.width - width - 4)
    const y = clamp(anchor.y + dy, bounds.y + 16, bounds.y + bounds.height - 6)

    ctx.fillStyle = withAlpha(color, 0.12)
    ctx.strokeStyle = withAlpha(color, 0.36)
    ctx.beginPath()
    ctx.roundRect(x, y - 14, width, 20, 9)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#143a61'
    ctx.fillText(text, x + pad, y)
  }

  private drawArrow(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    colorHex: string,
    width: number,
    opacity: number,
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
    const color = withAlpha(colorHex, clamp(opacity, 0, 1))

    ctx.shadowColor = withAlpha(colorHex, 0.3)
    ctx.shadowBlur = 10

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
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
    ctx.fillStyle = color
    ctx.fill()
  }
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const palette: Record<string, string> = {}
  const colors = ['#1d4ed8', '#d97706', '#0f766e', '#be123c', '#7c3aed', '#0e7490']
  halfspaces.forEach((halfspace, index) => {
    palette[halfspace.id] = colors[index % colors.length]
  })
  return palette
}
