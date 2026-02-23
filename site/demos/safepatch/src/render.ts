import {
  Halfspace,
  Polygon,
  Vec2,
  add,
  normalize,
  norm,
  scale,
  sub,
  worldBoundsFromHalfspaces,
} from './geometry'

export interface SceneRenderInput {
  halfspaces: Halfspace[]
  zone: Polygon
  step0: Vec2
  projectedStep: Vec2
  projectedTarget: Vec2
  ship: boolean
  phaseLabel: string
}

interface ScreenPoint {
  x: number
  y: number
}

const AXIS_COLOR = 'rgba(52, 76, 103, 0.26)'
const GRID_COLOR = 'rgba(65, 91, 120, 0.09)'
const ZONE_FILL = 'rgba(12, 152, 107, 0.16)'
const ZONE_STROKE = 'rgba(10, 118, 81, 0.62)'
const STEP0_COLOR = '#d92d20'
const STEP_PROJECTED_COLOR = '#1476d8'
const STEP_TARGET_COLOR = 'rgba(20, 118, 216, 0.25)'

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

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#f7fbff')
    gradient.addColorStop(1, '#f2f8ff')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const zoneExtent = worldBoundsFromHalfspaces(input.halfspaces)
    const stepExtent = Math.max(norm(input.step0), norm(input.projectedStep), norm(input.projectedTarget), 0.8)
    const worldRadius = Math.max(zoneExtent, stepExtent * 1.45)

    const toScreen = (point: Vec2): ScreenPoint => {
      const pad = 38
      const innerWidth = Math.max(1, width - pad * 2)
      const innerHeight = Math.max(1, height - pad * 2)
      const x = ((point.x + worldRadius) / (2 * worldRadius)) * innerWidth + pad
      const y = ((worldRadius - point.y) / (2 * worldRadius)) * innerHeight + pad
      return { x, y }
    }

    this.drawGrid(toScreen, worldRadius, width, height)
    this.drawHalfspaceBoundaries(toScreen, input.halfspaces, worldRadius)
    this.drawZone(toScreen, input.zone)

    this.drawVector(toScreen, { x: 0, y: 0 }, input.step0, {
      color: STEP0_COLOR,
      width: 2.8,
      label: 'Δ0',
    })

    this.drawVector(toScreen, { x: 0, y: 0 }, input.projectedTarget, {
      color: STEP_TARGET_COLOR,
      width: 4,
      dashed: true,
      label: null,
    })

    this.drawVector(toScreen, { x: 0, y: 0 }, input.projectedStep, {
      color: input.ship ? STEP_PROJECTED_COLOR : '#6b7280',
      width: 3.4,
      label: 'Δ*',
      glow: input.ship,
    })

    const origin = toScreen({ x: 0, y: 0 })
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#0f365d'
    ctx.fillText('θ', origin.x + 8, origin.y - 8)

    ctx.font = '700 12px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = input.ship ? '#0f6f63' : '#b42318'
    ctx.fillText(input.phaseLabel, 14, 20)

    this.drawLegend(width, height)
  }

  private drawGrid(toScreen: (point: Vec2) => ScreenPoint, worldRadius: number, width: number, height: number): void {
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

    const xAxisStart = toScreen({ x: -worldRadius, y: 0 })
    const xAxisEnd = toScreen({ x: worldRadius, y: 0 })
    ctx.strokeStyle = AXIS_COLOR
    ctx.lineWidth = 1.4
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

    ctx.strokeStyle = 'rgba(80, 109, 141, 0.16)'
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
  }

  private drawZone(toScreen: (point: Vec2) => ScreenPoint, zone: Polygon): void {
    if (zone.vertices.length < 3) {
      return
    }

    const ctx = this.ctx
    ctx.beginPath()
    zone.vertices.forEach((vertex, index) => {
      const point = toScreen(vertex)
      if (index === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    })
    ctx.closePath()

    ctx.fillStyle = ZONE_FILL
    ctx.fill()

    ctx.strokeStyle = ZONE_STROKE
    ctx.lineWidth = 1.8
    ctx.stroke()
  }

  private drawHalfspaceBoundaries(toScreen: (point: Vec2) => ScreenPoint, halfspaces: Halfspace[], worldRadius: number): void {
    const ctx = this.ctx

    for (const halfspace of halfspaces) {
      if (!halfspace.active) {
        continue
      }

      const n = halfspace.normal
      const normSq = n.x * n.x + n.y * n.y
      if (normSq < 1e-9) {
        continue
      }

      const center = scale(n, halfspace.bound / normSq)
      const direction = normalize({ x: -n.y, y: n.x })
      const extent = worldRadius * 1.8

      const start = toScreen(add(center, scale(direction, -extent)))
      const end = toScreen(add(center, scale(direction, extent)))

      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle = 'rgba(16, 97, 153, 0.22)'
      ctx.lineWidth = 1.2
      ctx.setLineDash([6, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  private drawVector(
    toScreen: (point: Vec2) => ScreenPoint,
    from: Vec2,
    to: Vec2,
    options: { color: string; width: number; dashed?: boolean; glow?: boolean; label: string | null },
  ): void {
    const ctx = this.ctx
    const start = toScreen(from)
    const end = toScreen(to)
    const direction = sub(to, from)
    const length = norm(direction)

    if (length < 1e-4) {
      return
    }

    const dir = scale(direction, 1 / length)
    const normal = { x: -dir.y, y: dir.x }

    if (options.glow) {
      ctx.shadowColor = 'rgba(20, 118, 216, 0.28)'
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

    const headSize = 10
    const tip = end
    const left: ScreenPoint = {
      x: tip.x - dir.x * headSize + normal.x * (headSize * 0.55),
      y: tip.y - dir.y * headSize + normal.y * (headSize * 0.55),
    }
    const right: ScreenPoint = {
      x: tip.x - dir.x * headSize - normal.x * (headSize * 0.55),
      y: tip.y - dir.y * headSize - normal.y * (headSize * 0.55),
    }

    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = options.color
    ctx.fill()

    if (options.label) {
      ctx.font = '700 12px "IBM Plex Sans", sans-serif'
      ctx.fillStyle = options.color
      ctx.fillText(options.label, end.x + 7, end.y - 6)
    }
  }

  private drawLegend(width: number, height: number): void {
    const ctx = this.ctx
    const y = height - 20

    ctx.font = '600 11px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = '#304f72'

    ctx.fillStyle = STEP0_COLOR
    ctx.fillRect(16, y - 8, 10, 2)
    ctx.fillStyle = '#304f72'
    ctx.fillText('Unconstrained Δ0', 32, y)

    ctx.fillStyle = STEP_PROJECTED_COLOR
    ctx.fillRect(156, y - 8, 10, 2)
    ctx.fillStyle = '#304f72'
    ctx.fillText('Projected Δ*', 172, y)

    ctx.fillStyle = 'rgba(15, 118, 110, 0.26)'
    ctx.fillRect(272, y - 9, 12, 6)
    ctx.fillStyle = '#304f72'
    ctx.fillText('Ship zone', 292, y)
  }
}

export function drawLambdaDial(
  canvas: HTMLCanvasElement,
  value: number,
  maxValue: number,
  label: string,
  enabled: boolean,
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

  const startAngle = (Math.PI * 3) / 4
  const endAngle = Math.PI / 4

  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, endAngle, false)
  ctx.strokeStyle = enabled ? 'rgba(56, 92, 126, 0.24)' : 'rgba(107, 114, 128, 0.2)'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.stroke()

  const safeMax = Math.max(maxValue, 1e-6)
  const clampedRatio = Math.min(Math.max(value / safeMax, 0), 1)
  const activeEnd = startAngle + (Math.PI * 1.5) * clampedRatio

  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, activeEnd, false)
  ctx.strokeStyle = enabled ? '#1476d8' : '#94a3b8'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.stroke()

  const needleLength = radius * 0.85
  const needleAngle = startAngle + (Math.PI * 1.5) * clampedRatio
  const needleX = cx + needleLength * Math.cos(needleAngle)
  const needleY = cy + needleLength * Math.sin(needleAngle)

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(needleX, needleY)
  ctx.strokeStyle = enabled ? '#0f4d87' : '#94a3b8'
  ctx.lineWidth = 2.2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2)
  ctx.fillStyle = enabled ? '#0f4d87' : '#94a3b8'
  ctx.fill()

  ctx.font = '700 11px "IBM Plex Sans", sans-serif'
  ctx.fillStyle = '#304f72'
  ctx.textAlign = 'center'
  ctx.fillText(label, cx, height - 12)

  ctx.font = '700 12px "Manrope", sans-serif'
  ctx.fillStyle = enabled ? '#0f365d' : '#6b7280'
  ctx.fillText(value.toFixed(3), cx, cy + 4)
}
