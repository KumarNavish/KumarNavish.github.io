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

const RAW_COLOR = '#d92d41'
const SAFE_COLOR = '#0e5acf'
const ZONE_STROKE = '#009b78'

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
    background.addColorStop(0, '#fbfdff')
    background.addColorStop(1, '#edf2f7')
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
    const worldRadius = Math.max(boundRadius * 2, stepRadius * 1.72, 1.6)
    const scalePx = Math.min(content.width, content.height) / (2 * worldRadius)
    const centerX = content.x + content.width / 2
    const centerY = content.y + content.height / 2

    const toScreen = (point: Vec2): ScreenPoint => ({
      x: centerX + point.x * scalePx,
      y: centerY - point.y * scalePx,
    })

    this.drawGrid(toScreen, content, worldRadius)

    if (input.previousZone && input.previousZone.vertices.length >= 3 && input.transitionProgress < 0.96) {
      this.drawZone(toScreen, input.previousZone, withAlpha('#8f9caf', 0.06), withAlpha('#8290a4', 0.22), true)
    }

    const displayedZone = morphPolygon(input.zone, 0.12 + input.zoneReveal * 0.88)
    this.drawZone(
      toScreen,
      displayedZone,
      withAlpha('#0bbf98', 0.15 + input.zoneReveal * 0.07),
      withAlpha(ZONE_STROKE, 0.45 + input.zoneReveal * 0.45),
      false,
    )

    const activeBoundaries = input.halfspaces
      .map((halfspace) => ({
        halfspace,
        emphasis: clamp(input.constraintForceById[halfspace.id] ?? 0),
      }))
      .filter((entry) => entry.halfspace.active && entry.emphasis > 0.05)
      .sort((a, b) => b.emphasis - a.emphasis)
      .slice(0, 2)

    for (const entry of activeBoundaries) {
      this.drawActiveBoundary(
        toScreen,
        worldRadius,
        entry.halfspace,
        input.colorById[entry.halfspace.id] ?? '#6c86ab',
        entry.emphasis,
      )
    }

    this.drawOriginPulse(toScreen({ x: 0, y: 0 }), 1 - clamp(input.transitionProgress))

    if (input.rawReveal > 0.02) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.rawStep, RAW_COLOR, 4.15, 0.96)
      if (norm(input.rawTarget) > 0.08) {
        this.drawArrow(toScreen, input.rawStep, input.rawTarget, RAW_COLOR, 1.1, 0.34, [4, 6])
      }
      this.drawPoint(toScreen(input.rawStep), RAW_COLOR, 4.6)
      if (input.rawReveal > 0.18) {
        this.drawTag(content, toScreen(input.rawStep), 'unsafe')
      }
    }

    const correctionNorm = norm(sub(input.safeTarget, input.rawTarget))
    if (input.safeReveal > 0.01 && correctionNorm > 1e-5) {
      this.drawProjectionWitness(toScreen, scalePx, input.rawTarget, input.safeTarget, input.correctionProgress)
      this.drawCorrectionCurve(toScreen, input.rawTarget, input.safeTarget, input.correctionProgress)
    }

    if (input.safeReveal > 0.02) {
      this.drawArrow(toScreen, { x: 0, y: 0 }, input.safeStep, SAFE_COLOR, 4.35, 0.98)
      this.drawPoint(toScreen(input.safeStep), SAFE_COLOR, 5)
      this.drawSafeHalo(toScreen(input.safeStep), input.safeReveal)
      if (input.safeReveal > 0.24) {
        this.drawTag(content, toScreen(input.safeStep), 'safe')
      }
    }

    if (input.violationRaw > 1e-6 && input.rawReveal > 0.08 && norm(input.rawStep) > 0.09) {
      this.drawViolationPulse(toScreen(input.rawStep), clamp(input.rawReveal))
    }
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, content: Viewport, worldRadius: number): void {
    const ctx = this.ctx
    const step = worldRadius / 4

    ctx.strokeStyle = 'rgba(54, 73, 98, 0.12)'
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

    ctx.strokeStyle = 'rgba(45, 63, 86, 0.3)'
    ctx.lineWidth = 1.45

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

    ctx.strokeStyle = 'rgba(88, 105, 130, 0.28)'
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
    ctx.lineWidth = 2.2
    ctx.setLineDash(dashed ? [7, 7] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawActiveBoundary(
    toScreen: (point: Vec2) => ScreenPoint,
    worldRadius: number,
    halfspace: Halfspace,
    color: string,
    emphasis: number,
  ): void {
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

    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = withAlpha(color, 0.22 + emphasis * 0.52)
    ctx.lineWidth = 1.2 + emphasis * 2.4
    ctx.setLineDash([8, 6])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawOriginPulse(point: ScreenPoint, intensity: number): void {
    const ctx = this.ctx
    const pulse = 14 * clamp(intensity)

    if (pulse > 0.2) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 8 + pulse, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(68, 95, 127, ${0.22 * clamp(intensity)})`
      ctx.lineWidth = 1.4
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(point.x, point.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = '#1c2d40'
    ctx.fill()
  }

  private drawPoint(point: ScreenPoint, color: string, radius: number): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.96)
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

    const head = Math.max(9, width * 2.25)
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

  private drawProjectionWitness(
    toScreen: (point: Vec2) => ScreenPoint,
    scalePx: number,
    rawTarget: Vec2,
    safeTarget: Vec2,
    progress: number,
  ): void {
    const correction = sub(safeTarget, rawTarget)
    const distance = norm(correction)
    if (distance <= 1e-6) {
      return
    }

    const t = clamp(progress)
    const center = toScreen(rawTarget)
    const radius = distance * scalePx * t

    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(70, 96, 126, ${0.17 + 0.3 * t})`
    ctx.lineWidth = 1.5
    ctx.setLineDash([7, 7])
    ctx.stroke()
    ctx.setLineDash([])

    const witness = toScreen(safeTarget)
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(witness.x, witness.y)
    ctx.strokeStyle = `rgba(92, 116, 146, ${0.14 + 0.34 * t})`
    ctx.lineWidth = 1.25
    ctx.stroke()
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

    const c1 = add(rawTarget, add(scale(direction, distance * 0.24), scale(normal, distance * 0.34)))
    const c2 = add(rawTarget, add(scale(direction, distance * 0.72), scale(normal, distance * 0.16)))

    const ctx = this.ctx
    const p0 = toScreen(rawTarget)
    const p1 = toScreen(c1)
    const p2 = toScreen(c2)
    const p3 = toScreen(safeTarget)

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    ctx.strokeStyle = 'rgba(77, 101, 133, 0.74)'
    ctx.lineWidth = 1.9
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])

    const markerWorld = cubicBezierPoint(rawTarget, c1, c2, safeTarget, clamp(progress))
    const marker = toScreen(markerWorld)

    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(42, 63, 93, 0.9)'
    ctx.fill()
  }

  private drawViolationPulse(point: ScreenPoint, intensity: number): void {
    const ctx = this.ctx
    const alpha = 0.25 + 0.32 * clamp(intensity)

    ctx.beginPath()
    ctx.arc(point.x, point.y, 11, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(217, 45, 65, ${alpha})`
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(point.x, point.y, 17, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(217, 45, 65, ${alpha * 0.44})`
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  private drawSafeHalo(point: ScreenPoint, reveal: number): void {
    const ctx = this.ctx
    const ring = (1 - clamp(reveal)) * 13
    if (ring <= 0.2) {
      return
    }

    ctx.beginPath()
    ctx.arc(point.x, point.y, 9.5 + ring, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(14, 90, 207, ${0.3 * (1 - clamp(reveal))})`
    ctx.lineWidth = 1.6
    ctx.stroke()
  }

  private drawTag(bounds: Viewport, point: ScreenPoint, text: string): void {
    const ctx = this.ctx
    ctx.font = '700 11px "Space Grotesk", sans-serif'
    const pad = 8
    const width = ctx.measureText(text).width + pad * 2
    const height = 20

    const x = clamp(point.x + 10, bounds.x + 6, bounds.x + bounds.width - width - 6)
    const y = clamp(point.y - 28, bounds.y + 6, bounds.y + bounds.height - height - 6)

    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 10)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.strokeStyle = 'rgba(134, 150, 172, 0.55)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#22334b'
    ctx.fillText(text, x + pad, y + 13.5)
  }
}

export function paletteForConstraints(halfspaces: Halfspace[]): Record<string, string> {
  const palette: Record<string, string> = {}
  const colors = ['#0e5acf', '#009b78', '#9f7100', '#d92d41', '#6f52d9', '#0a5d88']
  halfspaces.forEach((halfspace, index) => {
    palette[halfspace.id] = colors[index % colors.length]
  })
  return palette
}
