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
  clockMs: number
}

const RAW_COLOR = '#ff6b82'
const SAFE_COLOR = '#57d4ff'
const ZONE_COLOR = '#44d4a0'
const CORRECTION_COLOR = '#ffd076'
const GRID_STROKE = 'rgba(130, 162, 201, 0.22)'

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function easeInOutCubic(value: number): number {
  const t = clamp(value)
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

function easeOutCubic(value: number): number {
  const t = clamp(value)
  return 1 - (1 - t) ** 3
}

function phaseWindow(progress: number, start: number, end: number): number {
  if (end <= start) {
    return progress >= end ? 1 : 0
  }
  return clamp((progress - start) / (end - start))
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

    const timeline = clamp(input.transitionProgress)
    const phaseRisk = easeOutCubic(phaseWindow(timeline, 0, 0.38))
    const phaseProjection = easeInOutCubic(phaseWindow(timeline, 0.24, 0.7))
    const phaseQueue = easeInOutCubic(phaseWindow(timeline, 0.58, 1))
    const pulse = 0.5 + 0.5 * Math.sin(input.clockMs * 0.0022)

    this.paintBackdrop(width, height, input.clockMs, phaseQueue)

    const margin = 16
    const gap = 12
    const stacked = width < 980

    let geometryPanel: Rect
    let queuePanel: Rect

    if (stacked) {
      const topHeight = Math.max(220, Math.round((height - margin * 2 - gap) * 0.48))
      geometryPanel = {
        x: margin,
        y: margin,
        width: width - margin * 2,
        height: topHeight,
      }
      queuePanel = {
        x: margin,
        y: geometryPanel.y + geometryPanel.height + gap,
        width: width - margin * 2,
        height: height - margin * 2 - topHeight - gap,
      }
    } else {
      const leftWidth = Math.round((width - margin * 2 - gap) * 0.47)
      geometryPanel = {
        x: margin,
        y: margin,
        width: leftWidth,
        height: height - margin * 2,
      }
      queuePanel = {
        x: margin + leftWidth + gap,
        y: margin,
        width: width - margin * 2 - leftWidth - gap,
        height: height - margin * 2,
      }
    }

    const queueLength = Math.min(input.queueRawSeries.length, input.queueSafeSeries.length)
    const rawSeries = input.queueRawSeries.slice(0, queueLength)
    const safeTarget = input.queueSafeSeries.slice(0, queueLength)
    const safeAnimated = rawSeries.map((value, index) => value + (safeTarget[index] - value) * phaseQueue)

    this.drawStoryRail(width, margin, phaseRisk, phaseProjection, phaseQueue)

    const geometrySubtitle =
      phaseProjection < 0.1 ? '1/3 detect raw risk direction' : '2/3 project to nearest safe vector'
    const queueSubtitle = phaseQueue < 0.1 ? '3/3 replay pending' : '3/3 replaying queue impact'

    this.drawPanelShell(geometryPanel, 'PATCH SPACE', geometrySubtitle, phaseProjection)
    this.drawPanelShell(queuePanel, 'QUEUE REPLAY', queueSubtitle, phaseQueue)

    this.drawPanelConnector(geometryPanel, queuePanel, stacked, phaseProjection, phaseQueue, pulse)

    this.drawGeometryPanel(
      geometryPanel,
      input.halfspaces,
      input.step0,
      input.projectedStep,
      input.gradient,
      phaseRisk,
      phaseProjection,
      phaseQueue,
      pulse,
      input.clockMs,
    )

    this.drawQueuePanel(queuePanel, rawSeries, safeAnimated, input.overloadThreshold, phaseQueue, pulse, input.clockMs)
  }

  private paintBackdrop(width: number, height: number, clockMs: number, phaseQueue: number): void {
    const ctx = this.ctx
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#111a2b')
    gradient.addColorStop(0.58, '#0f1827')
    gradient.addColorStop(1, '#0b1320')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const drift = 0.2 + 0.8 * phaseQueue
    const glowX = width * (0.22 + drift * 0.1) + Math.sin(clockMs * 0.00055) * 26
    const glowY = height * 0.09 + Math.cos(clockMs * 0.0006) * 10

    const glow = ctx.createRadialGradient(glowX, glowY, 24, glowX, glowY, width * 0.62)
    glow.addColorStop(0, 'rgba(80, 145, 235, 0.24)')
    glow.addColorStop(1, 'rgba(80, 145, 235, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)

    const lowerGlow = ctx.createRadialGradient(width * 0.85, height * 0.88, 12, width * 0.85, height * 0.88, width * 0.46)
    lowerGlow.addColorStop(0, `rgba(87, 212, 255, ${0.1 + phaseQueue * 0.12})`)
    lowerGlow.addColorStop(1, 'rgba(87, 212, 255, 0)')
    ctx.fillStyle = lowerGlow
    ctx.fillRect(0, 0, width, height)
  }

  private drawStoryRail(
    canvasWidth: number,
    topOffset: number,
    phaseRisk: number,
    phaseProjection: number,
    phaseQueue: number,
  ): void {
    const ctx = this.ctx
    const y = topOffset - 7
    const railWidth = Math.min(340, canvasWidth - 66)
    const x = (canvasWidth - railWidth) / 2

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + railWidth, y)
    ctx.strokeStyle = 'rgba(104, 136, 176, 0.35)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    const checkpoints = [
      { label: 'RAW', progress: phaseRisk },
      { label: 'PROJECT', progress: phaseProjection },
      { label: 'REPLAY', progress: phaseQueue },
    ]

    checkpoints.forEach((checkpoint, index) => {
      const px = x + (index / (checkpoints.length - 1)) * railWidth
      const active = checkpoint.progress > 0.08
      const fill = active ? `rgba(87, 212, 255, ${0.52 + checkpoint.progress * 0.32})` : 'rgba(104, 136, 176, 0.42)'

      ctx.beginPath()
      ctx.arc(px, y, 4.2, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()

      ctx.font = '700 8px "IBM Plex Mono", monospace'
      ctx.fillStyle = active ? '#8cd8ff' : '#6f8cb2'
      const width = ctx.measureText(checkpoint.label).width
      ctx.fillText(checkpoint.label, px - width / 2, y - 8)
    })
  }

  private drawPanelShell(panel: Rect, title: string, subtitle: string, accentProgress: number): void {
    const ctx = this.ctx

    this.drawRoundedRect(panel.x, panel.y, panel.width, panel.height, 12)
    ctx.fillStyle = 'rgba(19, 30, 47, 0.78)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(56, 86, 122, 0.66)'
    ctx.lineWidth = 1
    ctx.stroke()

    const accent = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width * 0.72, panel.y)
    accent.addColorStop(0, `rgba(86, 153, 246, ${0.3 + accentProgress * 0.35})`)
    accent.addColorStop(1, 'rgba(86, 153, 246, 0)')
    ctx.fillStyle = accent
    ctx.fillRect(panel.x + 12, panel.y + 10, Math.max(84, panel.width * 0.4), 2)

    ctx.font = '700 10px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#8eb1e0'
    ctx.fillText(title, panel.x + 12, panel.y + 24)

    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif'
    ctx.fillStyle = '#6e89af'
    ctx.fillText(subtitle, panel.x + 12, panel.y + 38)
  }

  private drawPanelConnector(
    geometryPanel: Rect,
    queuePanel: Rect,
    stacked: boolean,
    phaseProjection: number,
    phaseQueue: number,
    pulse: number,
  ): void {
    const ctx = this.ctx
    const connectorProgress = clamp((phaseProjection + phaseQueue * 1.2) / 2)

    if (stacked) {
      const x = geometryPanel.x + geometryPanel.width - 24
      const fromY = geometryPanel.y + geometryPanel.height + 2
      const toY = queuePanel.y - 2

      ctx.save()
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(x, fromY)
      ctx.lineTo(x, toY)
      ctx.strokeStyle = 'rgba(127, 166, 212, 0.44)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      const y = fromY + (toY - fromY) * connectorProgress
      this.drawConnectorPulse(vec(x, y), pulse)
      return
    }

    const from = vec(geometryPanel.x + geometryPanel.width + 6, geometryPanel.y + geometryPanel.height * 0.52)
    const to = vec(queuePanel.x - 6, queuePanel.y + queuePanel.height * 0.52)

    ctx.save()
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = 'rgba(127, 166, 212, 0.44)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    const node = vec(from.x + (to.x - from.x) * connectorProgress, from.y + (to.y - from.y) * connectorProgress)
    this.drawConnectorPulse(node, pulse)
  }

  private drawConnectorPulse(point: Vec2, pulse: number): void {
    const ctx = this.ctx

    ctx.beginPath()
    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(SAFE_COLOR, 0.92)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(point.x, point.y, 6 + pulse * 2.5, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(SAFE_COLOR, 0.24 + pulse * 0.16)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawGeometryPanel(
    panel: Rect,
    halfspaces: Halfspace[],
    step0: Vec2,
    projectedStep: Vec2,
    gradient: Vec2,
    phaseRisk: number,
    phaseProjection: number,
    phaseQueue: number,
    pulse: number,
    clockMs: number,
  ): void {
    const ctx = this.ctx
    const chart: Rect = {
      x: panel.x + 12,
      y: panel.y + 46,
      width: panel.width - 24,
      height: panel.height - 58,
    }

    this.drawGeometryGrid(chart, clockMs)

    const active = halfspaces.filter((halfspace) => halfspace.active)
    const mapper = this.createMapper(chart, active)
    const zone = intersectHalfspaces(active, mapper.worldRadius)

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
      fill.addColorStop(0, withAlpha(ZONE_COLOR, 0.14 + pulse * 0.08))
      fill.addColorStop(1, withAlpha(ZONE_COLOR, 0.04))
      ctx.fillStyle = fill
      ctx.fill()

      ctx.strokeStyle = withAlpha(ZONE_COLOR, 0.72)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    this.drawConstraintBoundaries(chart, mapper, active)

    const origin = mapper.worldToCanvas(vec(0, 0))
    const rawTarget = mapper.worldToCanvas(step0)
    const safeTarget = mapper.worldToCanvas(projectedStep)

    const rawVisible = mapper.worldToCanvas(scale(step0, clamp(phaseRisk, 0.02, 1)))
    const safeVisible = mapper.worldToCanvas(lerp(step0, projectedStep, phaseProjection))

    this.drawArrow(origin, rawVisible, withAlpha(RAW_COLOR, 0.86), 2.1, true)

    if (phaseProjection > 0.03) {
      this.drawArrow(origin, safeVisible, withAlpha(SAFE_COLOR, 0.78 + phaseProjection * 0.2), 2.8, false)
      this.drawCorrectionArc(rawTarget, safeTarget, phaseProjection)
      this.drawTravelSpark(rawTarget, safeTarget, phaseProjection, pulse)
    }

    this.drawDirectionHint(mapper, gradient)
    this.drawRiskHalo(rawTarget, phaseRisk, pulse)
    this.drawSafeHalo(safeTarget, phaseProjection, phaseQueue, pulse)

    if (phaseRisk > 0.16) {
      this.drawTag(rawTarget, 'raw', RAW_COLOR)
    }
    if (phaseProjection > 0.18) {
      this.drawTag(safeVisible, 'safe', SAFE_COLOR)
    }

    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 3.8, 0, Math.PI * 2)
    ctx.fillStyle = '#7ca2d4'
    ctx.fill()

    const caption =
      phaseProjection < 0.12
        ? 'Raw patch enters unsafe region.'
        : phaseProjection < 0.92
          ? 'SafePatch projects to nearest feasible point.'
          : 'Projected patch is now guardrail-safe.'
    this.drawPanelCaption(chart, caption)
  }

  private drawGeometryGrid(rect: Rect, clockMs: number): void {
    const ctx = this.ctx
    const vertical = 4
    const horizontal = 4
    const driftX = Math.sin(clockMs * 0.00034) * 5
    const driftY = Math.cos(clockMs * 0.00031) * 4

    for (let i = 0; i <= vertical; i += 1) {
      const x = rect.x + (i / vertical) * rect.width + driftX
      ctx.beginPath()
      ctx.moveTo(x, rect.y)
      ctx.lineTo(x, rect.y + rect.height)
      ctx.strokeStyle = GRID_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i <= horizontal; i += 1) {
      const y = rect.y + (i / horizontal) * rect.height + driftY
      ctx.beginPath()
      ctx.moveTo(rect.x, y)
      ctx.lineTo(rect.x + rect.width, y)
      ctx.strokeStyle = GRID_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private createMapper(rect: Rect, halfspaces: Halfspace[]): Mapper {
    const radius = worldBoundsFromHalfspaces(halfspaces)
    const pad = 12
    const usableWidth = rect.width - pad * 2
    const usableHeight = rect.height - pad * 2
    const scaleFactor = Math.min(usableWidth / (radius * 2), usableHeight / (radius * 2))
    const center = vec(rect.x + rect.width / 2, rect.y + rect.height / 2)

    return {
      worldRadius: radius,
      center,
      worldToCanvas: (point: Vec2) => vec(center.x + point.x * scaleFactor, center.y - point.y * scaleFactor),
    }
  }

  private drawConstraintBoundaries(rect: Rect, mapper: Mapper, halfspaces: Halfspace[]): void {
    const ctx = this.ctx
    const span = mapper.worldRadius * 1.8

    halfspaces.forEach((halfspace, index) => {
      const normal = normalize(halfspace.normal)
      const tangent = vec(-normal.y, normal.x)
      const anchor = scale(normal, halfspace.bound)
      const p0 = mapper.worldToCanvas(sub(anchor, scale(tangent, span)))
      const p1 = mapper.worldToCanvas(sub(anchor, scale(tangent, -span)))

      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.strokeStyle = withAlpha(index % 2 === 0 ? '#7db5eb' : '#66c5a0', 0.47)
      ctx.lineWidth = 0.95
      ctx.stroke()
    })

    const center = mapper.center
    ctx.beginPath()
    ctx.moveTo(rect.x, center.y)
    ctx.lineTo(rect.x + rect.width, center.y)
    ctx.strokeStyle = withAlpha('#7fa3cf', 0.38)
    ctx.lineWidth = 0.9
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(center.x, rect.y)
    ctx.lineTo(center.x, rect.y + rect.height)
    ctx.strokeStyle = withAlpha('#7fa3cf', 0.38)
    ctx.lineWidth = 0.9
    ctx.stroke()
  }

  private drawArrow(from: Vec2, to: Vec2, color: string, width: number, dashed: boolean): void {
    const ctx = this.ctx
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const head = 10

    ctx.save()
    if (dashed) {
      ctx.setLineDash([7, 5])
    }
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  private drawDirectionHint(mapper: Mapper, gradient: Vec2): void {
    const direction = scale(normalize(gradient), mapper.worldRadius * 0.62)
    const origin = mapper.worldToCanvas(vec(0, 0))
    const target = mapper.worldToCanvas(scale(direction, -1))
    this.drawArrow(origin, target, withAlpha('#f5bc62', 0.58), 1.1, true)
  }

  private drawCorrectionArc(rawEnd: Vec2, safeEnd: Vec2, phaseProjection: number): void {
    const ctx = this.ctx
    const midX = (rawEnd.x + safeEnd.x) / 2
    const midY = (rawEnd.y + safeEnd.y) / 2 - 16

    const segments = 32
    const visible = Math.max(2, Math.floor(segments * clamp(phaseProjection)))

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    for (let i = 0; i <= visible; i += 1) {
      const t = i / segments
      const point = this.quadraticPoint(rawEnd, vec(midX, midY), safeEnd, t)
      if (i === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    }
    ctx.strokeStyle = withAlpha(CORRECTION_COLOR, 0.74)
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()
  }

  private drawTravelSpark(rawEnd: Vec2, safeEnd: Vec2, phaseProjection: number, pulse: number): void {
    const ctx = this.ctx
    const midX = (rawEnd.x + safeEnd.x) / 2
    const midY = (rawEnd.y + safeEnd.y) / 2 - 16
    const point = this.quadraticPoint(rawEnd, vec(midX, midY), safeEnd, clamp(phaseProjection))

    ctx.beginPath()
    ctx.arc(point.x, point.y, 3.4 + pulse * 1.8, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(CORRECTION_COLOR, 0.94)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(point.x, point.y, 8 + pulse * 2.2, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(CORRECTION_COLOR, 0.26 + pulse * 0.16)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private quadraticPoint(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
    const clamped = clamp(t)
    const oneMinus = 1 - clamped
    return vec(
      oneMinus * oneMinus * p0.x + 2 * oneMinus * clamped * p1.x + clamped * clamped * p2.x,
      oneMinus * oneMinus * p0.y + 2 * oneMinus * clamped * p1.y + clamped * clamped * p2.y,
    )
  }

  private drawRiskHalo(rawEnd: Vec2, phaseRisk: number, pulse: number): void {
    const ctx = this.ctx
    const alpha = 0.08 + phaseRisk * 0.18

    ctx.beginPath()
    ctx.arc(rawEnd.x, rawEnd.y, 9 + pulse * 4, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(RAW_COLOR, alpha)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(rawEnd.x, rawEnd.y, 15 + pulse * 5, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(RAW_COLOR, alpha * 0.66)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawSafeHalo(safeEnd: Vec2, phaseProjection: number, phaseQueue: number, pulse: number): void {
    if (phaseProjection < 0.12) {
      return
    }

    const ctx = this.ctx
    const intensity = 0.12 + phaseProjection * 0.2 + phaseQueue * 0.16

    ctx.beginPath()
    ctx.arc(safeEnd.x, safeEnd.y, 8 + pulse * 3.6, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(SAFE_COLOR, intensity)
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(safeEnd.x, safeEnd.y, 14 + pulse * 4, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(SAFE_COLOR, intensity * 0.62)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawTag(point: Vec2, label: string, color: string): void {
    const ctx = this.ctx
    const text = label.toUpperCase()

    ctx.font = '700 9px "IBM Plex Mono", monospace'
    const width = ctx.measureText(text).width + 12
    const height = 16
    const x = clamp(point.x + 8, 8, this.canvas.clientWidth - width - 8)
    const y = clamp(point.y - 24, 8, this.canvas.clientHeight - height - 8)

    this.drawRoundedRect(x, y, width, height, 6)
    ctx.fillStyle = 'rgba(11, 20, 34, 0.82)'
    ctx.fill()
    ctx.strokeStyle = withAlpha(color, 0.6)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = withAlpha(color, 0.95)
    ctx.fillText(text, x + 6, y + 11)
  }

  private drawPanelCaption(chart: Rect, text: string): void {
    const ctx = this.ctx
    const x = chart.x + 8
    const y = chart.y + chart.height - 22

    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif'
    ctx.fillStyle = '#90b3de'
    ctx.fillText(text, x, y)
  }

  private drawQueuePanel(
    panel: Rect,
    rawSeries: number[],
    safeSeries: number[],
    threshold: number,
    phaseQueue: number,
    pulse: number,
    clockMs: number,
  ): void {
    const chart: Rect = {
      x: panel.x + 12,
      y: panel.y + 46,
      width: panel.width - 24,
      height: panel.height - 58,
    }

    if (rawSeries.length === 0 || safeSeries.length === 0) {
      return
    }

    const maxValue = Math.max(...rawSeries, ...safeSeries, threshold, 1)
    const upper = maxValue * 1.08

    const mapX = (index: number, length: number): number => chart.x + (index / Math.max(1, length - 1)) * chart.width
    const mapY = (value: number): number => chart.y + chart.height - (value / upper) * chart.height

    const reveal = clamp(phaseQueue * 1.05)
    const thresholdY = mapY(threshold)

    this.drawQueueGrid(chart, clockMs)
    this.drawThresholdZone(chart, thresholdY)

    this.drawClipped(chart, reveal, () => {
      this.drawSeriesFill(rawSeries, mapX, mapY, withAlpha(RAW_COLOR, 0.08))
      this.drawSeriesFill(safeSeries, mapX, mapY, withAlpha(SAFE_COLOR, 0.12))
      this.drawDeltaArea(rawSeries, safeSeries, mapX, mapY)
      this.drawSmoothSeries(rawSeries, mapX, mapY, RAW_COLOR, 2.2)
      this.drawSmoothSeries(safeSeries, mapX, mapY, SAFE_COLOR, 2.9)
      this.drawSweep(chart, reveal, pulse)
    })

    const rawCursor = this.valueAtProgress(rawSeries, reveal)
    const safeCursor = this.valueAtProgress(safeSeries, reveal)
    const xCursor = mapX(reveal * Math.max(1, rawSeries.length - 1), rawSeries.length)

    this.drawCursor(xCursor, mapY(rawCursor), RAW_COLOR)
    this.drawCursor(xCursor, mapY(safeCursor), SAFE_COLOR)

    this.drawSeriesRunner(rawSeries, mapX, mapY, clockMs * 0.00024, reveal, RAW_COLOR)
    this.drawSeriesRunner(safeSeries, mapX, mapY, clockMs * 0.00026 + 0.2, reveal, SAFE_COLOR)

    this.drawQueueLegend(chart)

    const savedTarget = Math.max(0, Math.round(rawSeries[rawSeries.length - 1] - safeSeries[safeSeries.length - 1]))
    const savedAnimated = Math.round(savedTarget * reveal)
    const pillText = reveal < 0.18 ? 'REPLAYING IMPACT...' : `CAPACITY SAVED ${savedAnimated}`
    this.drawPill(chart.x + 8, chart.y + 8, pillText)

    const caption =
      reveal < 0.2
        ? 'Queue replay initializing.'
        : 'Safe projection lowers queue risk under same traffic pulse.'
    this.drawPanelCaption(chart, caption)
  }

  private drawQueueGrid(chart: Rect, clockMs: number): void {
    const ctx = this.ctx
    const shimmer = Math.sin(clockMs * 0.0011) * 2.2

    for (let i = 0; i <= 4; i += 1) {
      const y = chart.y + (i / 4) * chart.height + shimmer
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

    ctx.fillStyle = withAlpha(RAW_COLOR, 0.08)
    ctx.fillRect(chart.x, chart.y, chart.width, Math.max(0, thresholdY - chart.y))

    ctx.save()
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(chart.x, thresholdY)
    ctx.lineTo(chart.x + chart.width, thresholdY)
    ctx.strokeStyle = withAlpha(RAW_COLOR, 0.82)
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#ff9aad'
    ctx.font = '600 10px "IBM Plex Mono", monospace'
    ctx.fillText('risk threshold', chart.x + chart.width - 92, thresholdY - 6)
  }

  private drawClipped(chart: Rect, reveal: number, draw: () => void): void {
    const ctx = this.ctx
    ctx.save()
    ctx.beginPath()
    ctx.rect(chart.x, chart.y, chart.width * reveal, chart.height)
    ctx.clip()
    draw()
    ctx.restore()
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

    ctx.fillStyle = withAlpha(SAFE_COLOR, 0.13)
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
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  private drawSweep(chart: Rect, reveal: number, pulse: number): void {
    const ctx = this.ctx
    const x = chart.x + chart.width * reveal
    const gradient = ctx.createLinearGradient(x - 26, chart.y, x + 26, chart.y)
    gradient.addColorStop(0, 'rgba(87, 212, 255, 0)')
    gradient.addColorStop(0.5, `rgba(87, 212, 255, ${0.08 + pulse * 0.09})`)
    gradient.addColorStop(1, 'rgba(87, 212, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - 26, chart.y, 52, chart.height)
  }

  private drawCursor(x: number, y: number, color: string): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(x, y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 8.8, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.42)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private drawSeriesRunner(
    series: number[],
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    phaseClock: number,
    reveal: number,
    color: string,
  ): void {
    if (series.length < 2 || reveal <= 0.05) {
      return
    }

    const ctx = this.ctx
    const progress = clamp((phaseClock % 1) * reveal)
    const position = progress * (series.length - 1)
    const value = this.valueAtProgress(series, progress)
    const x = mapX(position, series.length)
    const y = mapY(value)

    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.9)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 6.2, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.26)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawQueueLegend(chart: Rect): void {
    const ctx = this.ctx
    const y = chart.y + 30

    ctx.beginPath()
    ctx.moveTo(chart.x + 10, y)
    ctx.lineTo(chart.x + 34, y)
    ctx.strokeStyle = RAW_COLOR
    ctx.lineWidth = 2.2
    ctx.stroke()

    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif'
    ctx.fillStyle = '#fca7b7'
    ctx.fillText('raw', chart.x + 38, y + 3)

    const safeStart = chart.x + 86
    ctx.beginPath()
    ctx.moveTo(safeStart, y)
    ctx.lineTo(safeStart + 24, y)
    ctx.strokeStyle = SAFE_COLOR
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.fillStyle = '#83dcff'
    ctx.fillText('safe', safeStart + 28, y + 3)
  }

  private drawPill(x: number, y: number, text: string): void {
    const ctx = this.ctx
    ctx.font = '700 10px "IBM Plex Mono", monospace'
    const width = ctx.measureText(text).width + 14
    const height = 18

    this.drawRoundedRect(x, y, width, height, 8)
    ctx.fillStyle = 'rgba(15, 24, 39, 0.9)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(111, 153, 206, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#8bb6ea'
    ctx.fillText(text, x + 7, y + 12)
  }

  private valueAtProgress(series: number[], progress: number): number {
    if (series.length === 0) {
      return 0
    }
    if (series.length === 1) {
      return series[0]
    }

    const capped = clamp(progress)
    const position = capped * (series.length - 1)
    const i0 = Math.floor(position)
    const i1 = Math.min(series.length - 1, i0 + 1)
    const t = position - i0

    return series[i0] + (series[i1] - series[i0]) * t
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
