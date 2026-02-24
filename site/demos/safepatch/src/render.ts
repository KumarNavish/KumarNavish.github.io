import {
  Halfspace,
  Vec2,
  intersectHalfspaces,
  lerp,
  normalize,
  scale,
  sub,
  vec,
  worldBoundsFromHalfspaces,
} from './geometry'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Mapper {
  worldToCanvas: (point: Vec2) => Vec2
  center: Vec2
  worldRadius: number
}

export interface SceneRenderInput {
  halfspaces: Halfspace[]
  step0: Vec2
  projectedStep: Vec2
  gradient: Vec2
  queueRawSeries: number[]
  queueSafeSeries: number[]
  overloadThreshold: number
  transitionProgress: number
}

const RAW_COLOR = '#db4d62'
const SAFE_COLOR = '#1e70e6'
const ZONE_COLOR = '#26a87c'
const CORRECTION_COLOR = '#e49b3f'
const GRID_STROKE = 'rgba(82, 116, 152, 0.15)'

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function easeInOutCubic(value: number): number {
  const t = clamp(value)
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
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
    this.paintBackdrop(width, height)

    const margin = 20
    const gap = 20
    const topHeight = Math.max(210, Math.round(height * 0.5))

    const geometryPanel: Rect = {
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: topHeight,
    }

    const queuePanel: Rect = {
      x: margin,
      y: geometryPanel.y + geometryPanel.height + gap,
      width: width - margin * 2,
      height: height - geometryPanel.height - gap - margin * 2,
    }

    const blend = easeInOutCubic(input.transitionProgress)
    const projectedAnimated = lerp(input.step0, input.projectedStep, blend)

    const queueLength = Math.min(input.queueRawSeries.length, input.queueSafeSeries.length)
    const rawSeries = input.queueRawSeries.slice(0, queueLength)
    const safeSeriesTarget = input.queueSafeSeries.slice(0, queueLength)
    const safeSeriesAnimated = rawSeries.map((value, index) => value + (safeSeriesTarget[index] - value) * blend)

    this.drawSectionDivider(geometryPanel, queuePanel)
    this.drawGeometryPanel(geometryPanel, input.halfspaces, input.step0, projectedAnimated, input.gradient)
    this.drawQueuePanel(queuePanel, rawSeries, safeSeriesAnimated, input.overloadThreshold, blend)
  }

  private paintBackdrop(width: number, height: number): void {
    const ctx = this.ctx
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#f7fbff')
    gradient.addColorStop(0.6, '#eff5ff')
    gradient.addColorStop(1, '#e9f1ff')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  private drawSectionDivider(geometryPanel: Rect, queuePanel: Rect): void {
    const ctx = this.ctx
    const dividerY = queuePanel.y - 10
    ctx.beginPath()
    ctx.moveTo(geometryPanel.x, dividerY)
    ctx.lineTo(geometryPanel.x + geometryPanel.width, dividerY)
    ctx.strokeStyle = 'rgba(126, 153, 186, 0.38)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.font = '700 10px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#3c5f84'
    ctx.fillText('Constraint Projection', geometryPanel.x + 2, geometryPanel.y - 4)
    ctx.fillText('Queue Replay', queuePanel.x + 2, queuePanel.y - 4)
  }

  private drawGeometryPanel(
    panel: Rect,
    halfspaces: Halfspace[],
    step0: Vec2,
    projectedStep: Vec2,
    gradient: Vec2,
  ): void {
    const ctx = this.ctx
    const chart: Rect = {
      x: panel.x + 6,
      y: panel.y + 6,
      width: panel.width - 12,
      height: panel.height - 12,
    }

    this.drawGeometryGrid(chart)
    const mapper = this.createMapper(chart, halfspaces)
    const zone = intersectHalfspaces(halfspaces.filter((halfspace) => halfspace.active), mapper.worldRadius)

    if (!zone.isEmpty) {
      ctx.beginPath()
      zone.vertices.forEach((vertex, index) => {
        const mapped = mapper.worldToCanvas(vertex)
        if (index === 0) {
          ctx.moveTo(mapped.x, mapped.y)
        } else {
          ctx.lineTo(mapped.x, mapped.y)
        }
      })
      ctx.closePath()
      ctx.fillStyle = withAlpha(ZONE_COLOR, 0.1)
      ctx.fill()
      ctx.strokeStyle = withAlpha(ZONE_COLOR, 0.7)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    this.drawConstraintBoundaries(chart, mapper, halfspaces)
    this.drawDirectionHint(mapper, gradient)

    const origin = mapper.worldToCanvas(vec(0, 0))
    const rawEnd = mapper.worldToCanvas(step0)
    const projectedEnd = mapper.worldToCanvas(projectedStep)

    this.drawArrow(origin, rawEnd, RAW_COLOR, 2.2)
    this.drawArrow(origin, projectedEnd, SAFE_COLOR, 2.8)

    this.ctx.save()
    this.ctx.setLineDash([4, 4])
    this.ctx.beginPath()
    this.ctx.moveTo(rawEnd.x, rawEnd.y)
    this.ctx.lineTo(projectedEnd.x, projectedEnd.y)
    this.ctx.strokeStyle = withAlpha(CORRECTION_COLOR, 0.72)
    this.ctx.lineWidth = 1.2
    this.ctx.stroke()
    this.ctx.restore()

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#36587d'
    ctx.fill()
  }

  private drawGeometryGrid(rect: Rect): void {
    const ctx = this.ctx
    const verticalLines = 4
    const horizontalLines = 3

    for (let i = 0; i <= verticalLines; i += 1) {
      const x = rect.x + (i / verticalLines) * rect.width
      ctx.beginPath()
      ctx.moveTo(x, rect.y)
      ctx.lineTo(x, rect.y + rect.height)
      ctx.strokeStyle = GRID_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i <= horizontalLines; i += 1) {
      const y = rect.y + (i / horizontalLines) * rect.height
      ctx.beginPath()
      ctx.moveTo(rect.x, y)
      ctx.lineTo(rect.x + rect.width, y)
      ctx.strokeStyle = GRID_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private createMapper(rect: Rect, halfspaces: Halfspace[]): Mapper {
    const active = halfspaces.filter((halfspace) => halfspace.active)
    const radius = worldBoundsFromHalfspaces(active)
    const pad = 12
    const usableWidth = rect.width - pad * 2
    const usableHeight = rect.height - pad * 2
    const scaleFactor = Math.min(usableWidth / (radius * 2), usableHeight / (radius * 2))
    const center = vec(rect.x + rect.width / 2, rect.y + rect.height / 2)

    return {
      worldRadius: radius,
      center,
      worldToCanvas: (point: Vec2) =>
        vec(
          center.x + point.x * scaleFactor,
          center.y - point.y * scaleFactor,
        ),
    }
  }

  private drawConstraintBoundaries(rect: Rect, mapper: Mapper, halfspaces: Halfspace[]): void {
    const ctx = this.ctx
    const active = halfspaces.filter((halfspace) => halfspace.active)
    const span = mapper.worldRadius * 1.8

    active.forEach((halfspace, index) => {
      const normal = normalize(halfspace.normal)
      const tangent = vec(-normal.y, normal.x)
      const anchor = scale(normal, halfspace.bound)
      const p0 = mapper.worldToCanvas(sub(anchor, scale(tangent, span)))
      const p1 = mapper.worldToCanvas(sub(anchor, scale(tangent, -span)))

      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.strokeStyle = withAlpha(index % 2 === 0 ? '#63a8df' : '#60b796', 0.5)
      ctx.lineWidth = 0.9
      ctx.stroke()
    })

    const center = mapper.center
    ctx.beginPath()
    ctx.moveTo(rect.x, center.y)
    ctx.lineTo(rect.x + rect.width, center.y)
    ctx.strokeStyle = withAlpha('#638bb5', 0.35)
    ctx.lineWidth = 0.9
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(center.x, rect.y)
    ctx.lineTo(center.x, rect.y + rect.height)
    ctx.strokeStyle = withAlpha('#638bb5', 0.35)
    ctx.lineWidth = 0.9
    ctx.stroke()
  }

  private drawDirectionHint(mapper: Mapper, gradient: Vec2): void {
    const direction = scale(normalize(gradient), mapper.worldRadius * 0.65)
    const origin = mapper.worldToCanvas(vec(0, 0))
    const target = mapper.worldToCanvas(scale(direction, -1))
    this.drawArrow(origin, target, withAlpha('#ca8531', 0.58), 1.1, true)
  }

  private drawArrow(
    from: Vec2,
    to: Vec2,
    color: string,
    width: number,
    subtle = false,
  ): void {
    const ctx = this.ctx
    const dx = to.x - from.x
    const dy = to.y - from.y
    const angle = Math.atan2(dy, dx)
    const head = subtle ? 8 : 10

    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  private drawQueuePanel(
    panel: Rect,
    rawSeries: number[],
    safeSeries: number[],
    threshold: number,
    blend: number,
  ): void {
    const chart: Rect = {
      x: panel.x + 6,
      y: panel.y + 6,
      width: panel.width - 12,
      height: panel.height - 12,
    }

    if (rawSeries.length === 0 || safeSeries.length === 0) {
      return
    }

    const maxValue = Math.max(...rawSeries, ...safeSeries, threshold, 1)
    const upper = maxValue * 1.08

    const mapX = (index: number, length: number): number => chart.x + (index / Math.max(1, length - 1)) * chart.width
    const mapY = (value: number): number => chart.y + chart.height - (value / upper) * chart.height

    this.drawQueueGrid(chart)
    this.drawThresholdBand(chart, mapY(threshold))
    this.drawDeltaArea(rawSeries, safeSeries, mapX, mapY)
    this.drawSmoothSeries(rawSeries, mapX, mapY, RAW_COLOR, 2.2)
    this.drawSmoothSeries(safeSeries, mapX, mapY, SAFE_COLOR, 2.8)
    this.drawGlowSweep(chart, blend)
    this.drawSeriesMarker(rawSeries, mapX, mapY, RAW_COLOR)
    this.drawSeriesMarker(safeSeries, mapX, mapY, SAFE_COLOR)
    this.drawQueueLabel(chart)
  }

  private drawQueueGrid(chart: Rect): void {
    const ctx = this.ctx
    for (let i = 0; i <= 3; i += 1) {
      const y = chart.y + (i / 3) * chart.height
      ctx.beginPath()
      ctx.moveTo(chart.x, y)
      ctx.lineTo(chart.x + chart.width, y)
      ctx.strokeStyle = GRID_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawThresholdBand(chart: Rect, thresholdY: number): void {
    const ctx = this.ctx
    ctx.save()
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(chart.x, thresholdY)
    ctx.lineTo(chart.x + chart.width, thresholdY)
    ctx.strokeStyle = withAlpha(RAW_COLOR, 0.78)
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#8b3d4c'
    ctx.font = '600 10px "Space Grotesk", sans-serif'
    ctx.fillText('threshold', chart.x + chart.width - 56, thresholdY - 6)
  }

  private drawDeltaArea(
    rawSeries: number[],
    safeSeries: number[],
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
  ): void {
    if (rawSeries.length < 2 || safeSeries.length < 2) {
      return
    }

    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(mapX(0, rawSeries.length), mapY(rawSeries[0]))

    for (let i = 1; i < rawSeries.length; i += 1) {
      ctx.lineTo(mapX(i, rawSeries.length), mapY(rawSeries[i]))
    }
    for (let i = safeSeries.length - 1; i >= 0; i -= 1) {
      ctx.lineTo(mapX(i, safeSeries.length), mapY(safeSeries[i]))
    }
    ctx.closePath()
    ctx.fillStyle = withAlpha(SAFE_COLOR, 0.12)
    ctx.fill()
  }

  private drawSmoothSeries(
    series: number[],
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    color: string,
    width: number,
  ): void {
    if (series.length < 2) {
      return
    }

    const ctx = this.ctx
    const points = series.map((value, index) => vec(mapX(index, series.length), mapY(value)))

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length - 1; i += 1) {
      const current = points[i]
      const next = points[i + 1]
      const midX = (current.x + next.x) / 2
      const midY = (current.y + next.y) / 2
      ctx.quadraticCurveTo(current.x, current.y, midX, midY)
    }
    const last = points[points.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  private drawGlowSweep(chart: Rect, blend: number): void {
    const ctx = this.ctx
    const sweepX = chart.x + chart.width * blend
    const gradient = ctx.createLinearGradient(sweepX - 20, chart.y, sweepX + 20, chart.y)
    gradient.addColorStop(0, 'rgba(49, 188, 255, 0)')
    gradient.addColorStop(0.5, 'rgba(30, 112, 230, 0.08)')
    gradient.addColorStop(1, 'rgba(49, 188, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(sweepX - 20, chart.y, 40, chart.height)
  }

  private drawSeriesMarker(
    series: number[],
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    color: string,
  ): void {
    if (series.length === 0) {
      return
    }
    const ctx = this.ctx
    const x = mapX(series.length - 1, series.length)
    const y = mapY(series[series.length - 1])

    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.46)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private drawQueueLabel(chart: Rect): void {
    const ctx = this.ctx
    const y = chart.y + 12
    ctx.font = '600 10px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#3e6287'
    ctx.fillText('raw queue (red) vs SafePatch queue (blue)', chart.x + 2, y)
  }
}
