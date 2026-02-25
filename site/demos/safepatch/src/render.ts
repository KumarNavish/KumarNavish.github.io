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

const RAW_COLOR = '#e15a69'
const SAFE_COLOR = '#1f75ff'
const ZONE_COLOR = '#10a57a'
const CORRECTION_COLOR = '#f39b3f'
const GRID_STROKE = 'rgba(86, 118, 152, 0.12)'

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
    const gap = 16
    const topHeight = Math.max(220, Math.round(height * 0.52))

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
    const safeTarget = input.queueSafeSeries.slice(0, queueLength)
    const safeAnimated = rawSeries.map((value, index) => value + (safeTarget[index] - value) * blend)

    this.drawPanelCard(geometryPanel, 'PATCH GEOMETRY', 'raw update vector vs SafePatch correction')
    this.drawPanelCard(queuePanel, 'QUEUE REPLAY', 'risk over time under the same traffic window')
    this.drawGeometryPanel(geometryPanel, input.halfspaces, input.step0, projectedAnimated, input.gradient, blend)
    this.drawQueuePanel(queuePanel, rawSeries, safeAnimated, input.overloadThreshold, blend)
  }

  private paintBackdrop(width: number, height: number): void {
    const ctx = this.ctx
    const linear = ctx.createLinearGradient(0, 0, width, height)
    linear.addColorStop(0, '#f9fcff')
    linear.addColorStop(0.62, '#eef4ff')
    linear.addColorStop(1, '#e9f1ff')
    ctx.fillStyle = linear
    ctx.fillRect(0, 0, width, height)

    const radial = ctx.createRadialGradient(width * 0.78, height * 0.2, 20, width * 0.78, height * 0.2, width * 0.58)
    radial.addColorStop(0, 'rgba(71, 132, 221, 0.12)')
    radial.addColorStop(1, 'rgba(71, 132, 221, 0)')
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, width, height)
  }

  private drawPanelCard(panel: Rect, title: string, subtitle: string): void {
    const ctx = this.ctx

    this.drawRoundedRect(panel.x, panel.y, panel.width, panel.height, 12)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(127, 155, 189, 0.34)'
    ctx.lineWidth = 1
    ctx.stroke()

    const accent = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y)
    accent.addColorStop(0, 'rgba(35, 109, 208, 0.25)')
    accent.addColorStop(1, 'rgba(35, 109, 208, 0)')
    ctx.fillStyle = accent
    ctx.fillRect(panel.x + 10, panel.y + 9, Math.max(70, panel.width * 0.45), 2)

    ctx.font = '700 10px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#3a5f88'
    ctx.fillText(title, panel.x + 12, panel.y + 22)

    ctx.font = '600 10px "Manrope", sans-serif'
    ctx.fillStyle = 'rgba(77, 103, 133, 0.86)'
    ctx.fillText(subtitle, panel.x + 12, panel.y + 36)
  }

  private drawGeometryPanel(
    panel: Rect,
    halfspaces: Halfspace[],
    step0: Vec2,
    projectedStep: Vec2,
    gradient: Vec2,
    blend: number,
  ): void {
    const ctx = this.ctx
    const chart: Rect = {
      x: panel.x + 12,
      y: panel.y + 44,
      width: panel.width - 24,
      height: panel.height - 56,
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

      const fill = ctx.createLinearGradient(chart.x, chart.y, chart.x + chart.width, chart.y + chart.height)
      fill.addColorStop(0, withAlpha(ZONE_COLOR, 0.16))
      fill.addColorStop(1, withAlpha(ZONE_COLOR, 0.04))
      ctx.fillStyle = fill
      ctx.fill()

      ctx.strokeStyle = withAlpha(ZONE_COLOR, 0.68)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    this.drawConstraintBoundaries(chart, mapper, halfspaces)
    this.drawDirectionHint(mapper, gradient)

    const origin = mapper.worldToCanvas(vec(0, 0))
    const rawEnd = mapper.worldToCanvas(step0)
    const projectedEnd = mapper.worldToCanvas(projectedStep)

    this.drawArrow(origin, rawEnd, RAW_COLOR, 2.2, 1)
    this.drawArrow(origin, projectedEnd, SAFE_COLOR, 2.8, 2)

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(rawEnd.x, rawEnd.y)
    ctx.lineTo(projectedEnd.x, projectedEnd.y)
    ctx.strokeStyle = withAlpha(CORRECTION_COLOR, 0.74)
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()

    this.drawProjectionPulse(rawEnd, projectedEnd, blend)
    this.drawArrowLabel('raw step', rawEnd, RAW_COLOR)
    this.drawArrowLabel('safe step', projectedEnd, SAFE_COLOR)

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 3.8, 0, Math.PI * 2)
    ctx.fillStyle = '#2f557f'
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
      ctx.strokeStyle = withAlpha(index % 2 === 0 ? '#67a9de' : '#5db68f', 0.5)
      ctx.lineWidth = 0.95
      ctx.stroke()
    })

    const center = mapper.center
    ctx.beginPath()
    ctx.moveTo(rect.x, center.y)
    ctx.lineTo(rect.x + rect.width, center.y)
    ctx.strokeStyle = withAlpha('#648eb6', 0.35)
    ctx.lineWidth = 0.9
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(center.x, rect.y)
    ctx.lineTo(center.x, rect.y + rect.height)
    ctx.strokeStyle = withAlpha('#648eb6', 0.35)
    ctx.lineWidth = 0.9
    ctx.stroke()
  }

  private drawDirectionHint(mapper: Mapper, gradient: Vec2): void {
    const direction = scale(normalize(gradient), mapper.worldRadius * 0.66)
    const origin = mapper.worldToCanvas(vec(0, 0))
    const target = mapper.worldToCanvas(scale(direction, -1))
    this.drawArrow(origin, target, withAlpha('#c78633', 0.58), 1.15, 0)
  }

  private drawArrow(from: Vec2, to: Vec2, color: string, width: number, glowLevel: number): void {
    const ctx = this.ctx
    const dx = to.x - from.x
    const dy = to.y - from.y
    const angle = Math.atan2(dy, dx)
    const head = 10

    ctx.save()
    if (glowLevel > 0) {
      ctx.shadowColor = withAlpha(color, 0.35)
      ctx.shadowBlur = glowLevel * 7
    }

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
    ctx.restore()
  }

  private drawProjectionPulse(from: Vec2, to: Vec2, blend: number): void {
    const ctx = this.ctx
    const x = from.x + (to.x - from.x) * blend
    const y = from.y + (to.y - from.y) * blend

    ctx.beginPath()
    ctx.arc(x, y, 4.6, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(CORRECTION_COLOR, 0.92)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(CORRECTION_COLOR, 0.38)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private drawArrowLabel(text: string, point: Vec2, color: string): void {
    const ctx = this.ctx
    const label = text.toUpperCase()
    ctx.font = '700 9px "IBM Plex Mono", monospace'
    const width = ctx.measureText(label).width + 12
    const height = 17
    const x = clamp(point.x + 8, 8, this.canvas.clientWidth - width - 8)
    const y = clamp(point.y - 24, 8, this.canvas.clientHeight - height - 8)

    this.drawRoundedRect(x, y, width, height, 6)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fill()
    ctx.strokeStyle = withAlpha(color, 0.45)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = withAlpha(color, 0.9)
    ctx.fillText(label, x + 6, y + 12)
  }

  private drawQueuePanel(
    panel: Rect,
    rawSeries: number[],
    safeSeries: number[],
    threshold: number,
    blend: number,
  ): void {
    const chart: Rect = {
      x: panel.x + 12,
      y: panel.y + 44,
      width: panel.width - 24,
      height: panel.height - 56,
    }

    if (rawSeries.length === 0 || safeSeries.length === 0) {
      return
    }

    const maxValue = Math.max(...rawSeries, ...safeSeries, threshold, 1)
    const upper = maxValue * 1.08

    const mapX = (index: number, length: number): number => chart.x + (index / Math.max(1, length - 1)) * chart.width
    const mapY = (value: number): number => chart.y + chart.height - (value / upper) * chart.height

    const thresholdY = mapY(threshold)

    this.drawQueueGrid(chart)
    this.drawThresholdZone(chart, thresholdY)
    this.drawSeriesFill(rawSeries, mapX, mapY, withAlpha(RAW_COLOR, 0.09))
    this.drawSeriesFill(safeSeries, mapX, mapY, withAlpha(SAFE_COLOR, 0.1))
    this.drawDeltaArea(rawSeries, safeSeries, mapX, mapY)
    this.drawSmoothSeries(rawSeries, mapX, mapY, RAW_COLOR, 2.2)
    this.drawSmoothSeries(safeSeries, mapX, mapY, SAFE_COLOR, 2.8)
    this.drawGlowSweep(chart, blend)
    this.drawSeriesMarker(rawSeries, mapX, mapY, RAW_COLOR)
    this.drawSeriesMarker(safeSeries, mapX, mapY, SAFE_COLOR)
    this.drawQueueLegend(chart)
    this.drawEndpointBadge('RAW', rawSeries[rawSeries.length - 1], mapX(rawSeries.length - 1, rawSeries.length), mapY(rawSeries[rawSeries.length - 1]), RAW_COLOR)
    this.drawEndpointBadge('SAFE', safeSeries[safeSeries.length - 1], mapX(safeSeries.length - 1, safeSeries.length), mapY(safeSeries[safeSeries.length - 1]), SAFE_COLOR)
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

  private drawThresholdZone(chart: Rect, thresholdY: number): void {
    const ctx = this.ctx
    ctx.fillStyle = withAlpha(RAW_COLOR, 0.06)
    ctx.fillRect(chart.x, chart.y, chart.width, Math.max(0, thresholdY - chart.y))

    ctx.save()
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(chart.x, thresholdY)
    ctx.lineTo(chart.x + chart.width, thresholdY)
    ctx.strokeStyle = withAlpha(RAW_COLOR, 0.78)
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#8d4251'
    ctx.font = '600 10px "IBM Plex Mono", monospace'
    ctx.fillText('threshold', chart.x + chart.width - 66, thresholdY - 6)
  }

  private drawSeriesFill(
    series: number[],
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    color: string,
  ): void {
    if (series.length < 2) {
      return
    }

    const ctx = this.ctx
    const baseline = mapY(0)

    ctx.beginPath()
    ctx.moveTo(mapX(0, series.length), baseline)
    for (let i = 0; i < series.length; i += 1) {
      ctx.lineTo(mapX(i, series.length), mapY(series[i]))
    }
    ctx.lineTo(mapX(series.length - 1, series.length), baseline)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
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
    const gradient = ctx.createLinearGradient(sweepX - 24, chart.y, sweepX + 24, chart.y)
    gradient.addColorStop(0, 'rgba(38, 151, 255, 0)')
    gradient.addColorStop(0.5, 'rgba(31, 117, 255, 0.1)')
    gradient.addColorStop(1, 'rgba(38, 151, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(sweepX - 24, chart.y, 48, chart.height)
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
    ctx.arc(x, y, 4.4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 8.8, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.42)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private drawQueueLegend(chart: Rect): void {
    const ctx = this.ctx
    const legendY = chart.y + 12

    ctx.beginPath()
    ctx.moveTo(chart.x + 8, legendY)
    ctx.lineTo(chart.x + 30, legendY)
    ctx.strokeStyle = RAW_COLOR
    ctx.lineWidth = 2.2
    ctx.stroke()

    ctx.font = '600 10px "Manrope", sans-serif'
    ctx.fillStyle = '#6a3b47'
    ctx.fillText('raw', chart.x + 34, legendY + 3)

    const safeX = chart.x + 84
    ctx.beginPath()
    ctx.moveTo(safeX, legendY)
    ctx.lineTo(safeX + 22, legendY)
    ctx.strokeStyle = SAFE_COLOR
    ctx.lineWidth = 2.4
    ctx.stroke()

    ctx.fillStyle = '#2e5e9d'
    ctx.fillText('safe', safeX + 26, legendY + 3)
  }

  private drawEndpointBadge(label: string, value: number, x: number, y: number, color: string): void {
    const ctx = this.ctx
    const text = `${label} ${Math.round(value)}`

    ctx.font = '700 10px "IBM Plex Mono", monospace'
    const width = ctx.measureText(text).width + 12
    const height = 17
    const bx = clamp(x + 8, 8, this.canvas.clientWidth - width - 8)
    const by = clamp(y - 25, 8, this.canvas.clientHeight - height - 8)

    this.drawRoundedRect(bx, by, width, height, 6)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
    ctx.fill()
    ctx.strokeStyle = withAlpha(color, 0.46)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = withAlpha(color, 0.96)
    ctx.fillText(text, bx + 6, by + 12)
  }

  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    const ctx = this.ctx
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + width, y, x + width, y + height, r)
    ctx.arcTo(x + width, y + height, x, y + height, r)
    ctx.arcTo(x, y + height, x, y, r)
    ctx.arcTo(x, y, x + width, y, r)
    ctx.closePath()
  }
}
