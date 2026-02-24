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

const RAW_COLOR = '#ff5f76'
const SAFE_COLOR = '#67b7ff'
const ZONE_STROKE = '#5ae5c2'

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

    const background = ctx.createLinearGradient(0, 0, 0, height)
    background.addColorStop(0, '#0f1a2a')
    background.addColorStop(1, '#0a1321')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)

    const frame: Viewport = {
      x: 18,
      y: 18,
      width: width - 36,
      height: height - 36,
    }

    const content: Viewport = {
      x: frame.x + 10,
      y: frame.y + 10,
      width: frame.width - 20,
      height: frame.height - 20,
    }

    const boundRadius = worldBoundsFromHalfspaces(input.halfspaces)
    const stepRadius = Math.max(norm(input.rawTarget), norm(input.safeTarget), norm(input.rawStep), norm(input.safeStep), 0.9)
    const worldRadius = Math.max(boundRadius * 2, stepRadius * 1.7, 1.5)

    const toScreen = (point: Vec2): ScreenPoint => ({
      x: ((point.x + worldRadius) / (2 * worldRadius)) * content.width + content.x,
      y: ((worldRadius - point.y) / (2 * worldRadius)) * content.height + content.y,
    })

    this.drawGrid(toScreen, content, worldRadius)

    if (input.previousZone && input.previousZone.vertices.length >= 3 && input.transitionProgress < 0.97) {
      this.drawZone(toScreen, input.previousZone, withAlpha('#a0afc5', 0.04), withAlpha('#90a3bf', 0.3), true)
    }

    const displayedZone = morphPolygon(input.zone, 0.12 + input.zoneReveal * 0.88)
    this.drawZone(
      toScreen,
      displayedZone,
      withAlpha('#2dd3b2', 0.16 + input.zoneReveal * 0.08),
      withAlpha(ZONE_STROKE, 0.48 + input.zoneReveal * 0.42),
      false,
    )

    this.drawOriginPulse(toScreen({ x: 0, y: 0 }), 1 - clamp(input.transitionProgress))

    if (input.rawReveal > 0.02) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.rawStep, RAW_COLOR, 3.9, 0.95)
      if (norm(input.rawTarget) > 0.08) {
        this.drawArrow(toScreen, input.rawStep, input.rawTarget, RAW_COLOR, 1.2, 0.32, [4, 6])
      }
      this.drawPoint(toScreen(input.rawStep), RAW_COLOR, 4.4)
    }

    if (input.safeReveal > 0.01 && norm(sub(input.safeTarget, input.rawTarget)) > 1e-5) {
      this.drawCorrectionCurve(toScreen, input.rawTarget, input.safeTarget, input.correctionProgress)
    }

    if (input.safeReveal > 0.02) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.safeStep, SAFE_COLOR, 4.2, 0.97)
      this.drawPoint(toScreen(input.safeStep), SAFE_COLOR, 4.8)
      this.drawSafeHalo(toScreen(input.safeStep), input.safeReveal)
    }

    if (input.violationRaw > 1e-6 && input.rawReveal > 0.08 && norm(input.rawStep) > 0.09) {
      this.drawViolationPulse(toScreen(input.rawStep), clamp(input.rawReveal))
    }

    if (input.rawReveal > 0.06 && norm(input.rawStep) > 0.1) {
      this.drawVectorTag(content, toScreen(input.rawStep), input.rawStep, 'raw', RAW_COLOR)
    }

    if (input.safeReveal > 0.08 && norm(input.safeStep) > 0.1) {
      this.drawVectorTag(content, toScreen(input.safeStep), input.safeStep, 'safe', SAFE_COLOR)
    }
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, content: Viewport, worldRadius: number): void {
    const ctx = this.ctx
    const step = worldRadius / 4

    ctx.strokeStyle = 'rgba(142, 164, 194, 0.1)'
    ctx.lineWidth = 1

    for (let i = -3; i <= 3; i += 1) {
      const coordinate = i * step

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

    ctx.strokeStyle = 'rgba(192, 209, 233, 0.26)'
    ctx.lineWidth = 1.4

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

    ctx.strokeStyle = 'rgba(155, 179, 210, 0.34)'
    ctx.lineWidth = 1
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

  private drawOriginPulse(point: ScreenPoint, intensity: number): void {
    const ctx = this.ctx
    const pulse = 14 * clamp(intensity)

    if (pulse > 0.2) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 8 + pulse, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(124, 171, 235, ${0.22 * clamp(intensity)})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(point.x, point.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = '#eaf2ff'
    ctx.fill()
  }

  private drawPoint(point: ScreenPoint, color: string, radius: number): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.94)
    ctx.fill()
  }

  private drawArrow(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    colorHex: string,
    width: number,
    opacity: number,
    dash: number[] = [],
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

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.setLineDash(dash)
    ctx.stroke()
    ctx.setLineDash([])

    const head = Math.max(8, width * 2.35)
    const left = {
      x: end.x - dir.x * head + normal.x * (head * 0.6),
      y: end.y - dir.y * head + normal.y * (head * 0.6),
    }
    const right = {
      x: end.x - dir.x * head - normal.x * (head * 0.6),
      y: end.y - dir.y * head - normal.y * (head * 0.6),
    }

    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  private drawCorrectionCurve(
    toScreen: (point: Vec2) => ScreenPoint,
    rawTarget: Vec2,
    safeTarget: Vec2,
    progress: number,
  ): void {
    const delta = sub(safeTarget, rawTarget)
    const distance = norm(delta)
    if (distance <= 1e-6) {
      return
    }

    const direction = scale(delta, 1 / distance)
    const normal = { x: -direction.y, y: direction.x }

    const c1 = add(rawTarget, add(scale(direction, distance * 0.24), scale(normal, distance * 0.36)))
    const c2 = add(rawTarget, add(scale(direction, distance * 0.72), scale(normal, distance * 0.18)))

    const ctx = this.ctx
    const p0 = toScreen(rawTarget)
    const p1 = toScreen(c1)
    const p2 = toScreen(c2)
    const p3 = toScreen(safeTarget)

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    ctx.strokeStyle = 'rgba(197, 215, 241, 0.68)'
    ctx.lineWidth = 1.8
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])

    const markerWorld = cubicBezierPoint(rawTarget, c1, c2, safeTarget, clamp(progress))
    const marker = toScreen(markerWorld)

    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(225, 238, 255, 0.95)'
    ctx.fill()
  }

  private drawViolationPulse(point: ScreenPoint, intensity: number): void {
    const ctx = this.ctx
    const alpha = 0.25 + 0.3 * clamp(intensity)

    ctx.beginPath()
    ctx.arc(point.x, point.y, 11, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 106, 130, ${alpha})`
    ctx.lineWidth = 1.9
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(point.x, point.y, 17, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 106, 130, ${alpha * 0.46})`
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  private drawSafeHalo(point: ScreenPoint, reveal: number): void {
    const ctx = this.ctx
    const ring = (1 - clamp(reveal)) * 12
    if (ring <= 0.2) {
      return
    }

    ctx.beginPath()
    ctx.arc(point.x, point.y, 9 + ring, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(103, 183, 255, ${0.28 * (1 - clamp(reveal))})`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  private drawVectorTag(bounds: Viewport, point: ScreenPoint, direction: Vec2, text: string, color: string): void {
    const directionNorm = Math.max(1e-8, norm(direction))
    const unit = { x: direction.x / directionNorm, y: direction.y / directionNorm }
    const normal = { x: -unit.y, y: unit.x }

    const anchor = {
      x: point.x + normal.x * 16 + unit.x * 10,
      y: point.y + normal.y * 16 + unit.y * 10,
    }

    const ctx = this.ctx
    ctx.font = '700 11px "IBM Plex Sans", sans-serif'

    const pad = 7
    const width = ctx.measureText(text).width + pad * 2
    const height = 20

    const x = clamp(anchor.x - width / 2, bounds.x + 6, bounds.x + bounds.width - width - 6)
    const y = clamp(anchor.y - height / 2, bounds.y + 6, bounds.y + bounds.height - height - 6)

    ctx.fillStyle = withAlpha(color, 0.2)
    ctx.strokeStyle = withAlpha(color, 0.62)
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#e6f0ff'
    ctx.fillText(text, x + pad, y + 13.4)
  }
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const palette: Record<string, string> = {}
  const colors = ['#67b7ff', '#5ae5c2', '#ffc566', '#ff5f76', '#9e8bff', '#63d4ff']
  halfspaces.forEach((halfspace, index) => {
    palette[halfspace.id] = colors[index % colors.length]
  })
  return palette
}
