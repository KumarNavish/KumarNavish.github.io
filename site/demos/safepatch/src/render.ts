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

const RAW_COLOR = '#ff728d'
const SAFE_COLOR = '#32bcff'
const ZONE_COLOR = '#50e6c0'
const CORRECTION_COLOR = '#ffc37d'
const GRID_STROKE = 'rgba(169, 210, 240, 0.16)'

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

    const margin = 18
    const gap = 14
    const topHeight = Math.max(190, Math.round(height * 0.43))

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

    this.drawPanelFrame(geometryPanel)
    this.drawPanelFrame(queuePanel)
    this.drawGeometryPanel(geometryPanel, input.halfspaces, input.step0, projectedAnimated, input.gradient)
    this.drawQueuePanel(queuePanel, rawSeries, safeSeriesAnimated, input.overloadThreshold, blend)
  }

  private paintBackdrop(width: number, height: number): void {
    const ctx = this.ctx
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#0a2a42')
    gradient.addColorStop(0.65, '#082137')
    gradient.addColorStop(1, '#081b2e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  private drawPanelFrame(rect: Rect): void {
    const ctx = this.ctx
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
    gradient.addColorStop(0, 'rgba(8, 40, 64, 0.88)')
    gradient.addColorStop(1, 'rgba(7, 31, 52, 0.92)')

    ctx.beginPath()
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 14)
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.strokeStyle = 'rgba(140, 186, 223, 0.34)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawGeometryPanel(
    panel: Rect,
    halfspaces: Halfspace[],
    step0: Vec2,
    projectedStep: Vec2,
    gradient: Vec2,
  ): void {
    const ctx = this.ctx

    ctx.font = '700 12px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#8bd8ff'
    ctx.fillText('MECHANISM VIEW', panel.x + 14, panel.y + 20)
    ctx.font = '600 14px "Sora", sans-serif'
    ctx.fillStyle = '#ecf8ff'
    ctx.fillText('Project risky step into the certified ship zone', panel.x + 14, panel.y + 42)

    const chart: Rect = {
      x: panel.x + 14,
      y: panel.y + 54,
      width: panel.width - 28,
      height: panel.height - 68,
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
      ctx.fillStyle = withAlpha(ZONE_COLOR, 0.12)
      ctx.fill()
      ctx.strokeStyle = withAlpha(ZONE_COLOR, 0.82)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    this.drawConstraintBoundaries(chart, mapper, halfspaces)
    this.drawDirectionHint(chart, mapper, gradient)

    const origin = mapper.worldToCanvas(vec(0, 0))
    const rawEnd = mapper.worldToCanvas(step0)
    const projectedEnd = mapper.worldToCanvas(projectedStep)

    this.drawArrow(origin, rawEnd, RAW_COLOR, 3, 'raw step')
    this.drawArrow(origin, projectedEnd, SAFE_COLOR, 3.4, 'SafePatch step')

    this.ctx.save()
    this.ctx.setLineDash([5, 4])
    this.ctx.beginPath()
    this.ctx.moveTo(rawEnd.x, rawEnd.y)
    this.ctx.lineTo(projectedEnd.x, projectedEnd.y)
    this.ctx.strokeStyle = withAlpha(CORRECTION_COLOR, 0.9)
    this.ctx.lineWidth = 1.4
    this.ctx.stroke()
    this.ctx.restore()

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#e8f5ff'
    ctx.fill()

    ctx.fillStyle = '#c7e7fa'
    ctx.font = '600 11px "Space Grotesk", sans-serif'
    const correctionNorm = Math.hypot(projectedStep.x - step0.x, projectedStep.y - step0.y)
    const rawNorm = Math.hypot(step0.x, step0.y)
    ctx.fillText(`raw norm ${rawNorm.toFixed(2)} | correction ${correctionNorm.toFixed(2)}`, chart.x + 8, chart.y + 14)
    ctx.fillText('green polygon = feasible ship zone', chart.x + 8, chart.y + chart.height - 8)
  }

  private drawGeometryGrid(rect: Rect): void {
    const ctx = this.ctx
    const verticalLines = 8
    const horizontalLines = 6

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
      ctx.strokeStyle = withAlpha(index % 2 === 0 ? '#7fdbff' : '#77efcd', 0.6)
      ctx.lineWidth = 1.1
      ctx.stroke()
    })

    const center = mapper.center
    ctx.beginPath()
    ctx.moveTo(rect.x, center.y)
    ctx.lineTo(rect.x + rect.width, center.y)
    ctx.strokeStyle = withAlpha('#9fd3f9', 0.5)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(center.x, rect.y)
    ctx.lineTo(center.x, rect.y + rect.height)
    ctx.strokeStyle = withAlpha('#9fd3f9', 0.5)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawDirectionHint(rect: Rect, mapper: Mapper, gradient: Vec2): void {
    const direction = scale(normalize(gradient), mapper.worldRadius * 0.65)
    const origin = mapper.worldToCanvas(vec(0, 0))
    const target = mapper.worldToCanvas(scale(direction, -1))
    this.drawArrow(origin, target, withAlpha('#ffd6a4', 0.95), 1.5, 'descent direction', true)
    this.ctx.fillStyle = '#d9ecfb'
    this.ctx.font = '600 10px "Space Grotesk", sans-serif'
    this.ctx.fillText('descent target', rect.x + rect.width - 110, rect.y + 12)
  }

  private drawArrow(
    from: Vec2,
    to: Vec2,
    color: string,
    width: number,
    label: string,
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

    ctx.fillStyle = '#e4f6ff'
    ctx.font = '600 10px "Space Grotesk", sans-serif'
    ctx.fillText(label, to.x + 6, to.y - 7)
  }

  private drawQueuePanel(
    panel: Rect,
    rawSeries: number[],
    safeSeries: number[],
    threshold: number,
    blend: number,
  ): void {
    const ctx = this.ctx
    ctx.font = '700 12px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#8bd8ff'
    ctx.fillText('IMPACT VIEW', panel.x + 14, panel.y + 20)
    ctx.font = '600 14px "Sora", sans-serif'
    ctx.fillStyle = '#ecf8ff'
    ctx.fillText('Queue trajectory if shipped raw vs with SafePatch', panel.x + 14, panel.y + 42)

    const chart: Rect = {
      x: panel.x + 14,
      y: panel.y + 56,
      width: panel.width - 28,
      height: panel.height - 72,
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
    this.drawSmoothSeries(rawSeries, mapX, mapY, RAW_COLOR, 2.6)
    this.drawSmoothSeries(safeSeries, mapX, mapY, SAFE_COLOR, 3.2)
    this.drawGlowSweep(chart, blend)
    this.drawSeriesMarker(rawSeries, mapX, mapY, RAW_COLOR)
    this.drawSeriesMarker(safeSeries, mapX, mapY, SAFE_COLOR)
    this.drawQueueLegend(chart, rawSeries.length)
  }

  private drawQueueGrid(chart: Rect): void {
    const ctx = this.ctx
    for (let i = 0; i <= 5; i += 1) {
      const y = chart.y + (i / 5) * chart.height
      ctx.beginPath()
      ctx.moveTo(chart.x, y)
      ctx.lineTo(chart.x + chart.width, y)
      ctx.strokeStyle = GRID_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i <= 8; i += 1) {
      const x = chart.x + (i / 8) * chart.width
      ctx.beginPath()
      ctx.moveTo(x, chart.y)
      ctx.lineTo(x, chart.y + chart.height)
      ctx.strokeStyle = withAlpha('#9dd2f9', 0.1)
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawThresholdBand(chart: Rect, thresholdY: number): void {
    const ctx = this.ctx
    ctx.fillStyle = withAlpha(RAW_COLOR, 0.11)
    ctx.fillRect(chart.x, chart.y, chart.width, Math.max(0, thresholdY - chart.y))

    ctx.save()
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(chart.x, thresholdY)
    ctx.lineTo(chart.x + chart.width, thresholdY)
    ctx.strokeStyle = withAlpha(RAW_COLOR, 0.9)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#ffd8e1'
    ctx.font = '600 11px "Space Grotesk", sans-serif'
    ctx.fillText('SLA breach threshold', chart.x + 8, thresholdY - 8)
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
    ctx.fillStyle = withAlpha(SAFE_COLOR, 0.15)
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
    const gradient = ctx.createLinearGradient(sweepX - 28, chart.y, sweepX + 28, chart.y)
    gradient.addColorStop(0, 'rgba(49, 188, 255, 0)')
    gradient.addColorStop(0.5, 'rgba(49, 188, 255, 0.18)')
    gradient.addColorStop(1, 'rgba(49, 188, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(sweepX - 28, chart.y, 56, chart.height)
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
    ctx.arc(x, y, 4.8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.46)
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  private drawQueueLegend(chart: Rect, seriesLength: number): void {
    const ctx = this.ctx
    const y = chart.y + chart.height + 18
    ctx.font = '600 11px "Space Grotesk", sans-serif'

    ctx.beginPath()
    ctx.moveTo(chart.x, y - 3)
    ctx.lineTo(chart.x + 18, y - 3)
    ctx.strokeStyle = RAW_COLOR
    ctx.lineWidth = 2.8
    ctx.stroke()
    ctx.fillStyle = '#d7edff'
    ctx.fillText('raw deploy', chart.x + 24, y)

    ctx.beginPath()
    ctx.moveTo(chart.x + 110, y - 3)
    ctx.lineTo(chart.x + 128, y - 3)
    ctx.strokeStyle = SAFE_COLOR
    ctx.lineWidth = 3.2
    ctx.stroke()
    ctx.fillText('SafePatch deploy', chart.x + 134, y)

    ctx.fillStyle = '#bddcf3'
    ctx.fillText(`minute 0 -> minute ${Math.max(0, seriesLength - 1)}`, chart.x + chart.width - 148, y)
  }
}
