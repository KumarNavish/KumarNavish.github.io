interface ScreenPoint {
  x: number
  y: number
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface SceneRenderInput {
  queueRawSeries: number[]
  queueSafeSeries: number[]
  queueOverloadThreshold: number
  rawRiskRatio: number
  safeRiskRatio: number
  retainedValueRatio: number
  correctionRatio: number
  transitionProgress: number
}

const RAW_COLOR = '#d92d41'
const SAFE_COLOR = '#0e5acf'
const TEXT_COLOR = '#1e3655'

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateSeries(series: number[], indexFloat: number): number {
  if (series.length === 0) {
    return 0
  }
  const i0 = Math.floor(indexFloat)
  const i1 = Math.min(series.length - 1, i0 + 1)
  const t = indexFloat - i0
  return lerp(series[i0], series[i1], t)
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
    background.addColorStop(0, '#fcfdff')
    background.addColorStop(1, '#eef4fb')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)

    const panel: Rect = {
      x: 18,
      y: 18,
      width: width - 36,
      height: height - 36,
    }

    ctx.beginPath()
    ctx.roundRect(panel.x, panel.y, panel.width, panel.height, 14)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.74)'
    ctx.strokeStyle = 'rgba(133, 153, 179, 0.4)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    this.drawChip(
      panel.x + 14,
      panel.y + 12,
      'raw unsafe risk',
      `${Math.round(clamp(input.rawRiskRatio) * 100)}%`,
      RAW_COLOR,
    )
    this.drawChip(
      panel.x + 152,
      panel.y + 12,
      'SafePatch risk',
      `${Math.round(clamp(input.safeRiskRatio) * 100)}%`,
      '#0a8b64',
    )
    this.drawChip(
      panel.x + 282,
      panel.y + 12,
      'patch gain kept',
      `${Math.round(clamp(input.retainedValueRatio) * 100)}%`,
      SAFE_COLOR,
    )

    const chart: Rect = {
      x: panel.x + 28,
      y: panel.y + 66,
      width: panel.width - 56,
      height: panel.height - 110,
    }

    const maxValue = Math.max(
      input.queueOverloadThreshold,
      ...input.queueRawSeries,
      ...input.queueSafeSeries,
      1,
    )

    const mapX = (indexFloat: number, length: number): number =>
      chart.x + (indexFloat / Math.max(1, length - 1)) * chart.width

    const mapY = (value: number): number =>
      chart.y + chart.height - (value / (maxValue * 1.08)) * chart.height

    const thresholdY = mapY(input.queueOverloadThreshold)

    ctx.save()
    ctx.beginPath()
    ctx.rect(chart.x, chart.y, chart.width, chart.height)
    ctx.clip()

    ctx.fillStyle = 'rgba(217, 45, 65, 0.08)'
    ctx.fillRect(chart.x, chart.y, chart.width, Math.max(0, thresholdY - chart.y))

    for (let i = 0; i <= 4; i += 1) {
      const y = chart.y + (i / 4) * chart.height
      ctx.beginPath()
      ctx.moveTo(chart.x, y)
      ctx.lineTo(chart.x + chart.width, y)
      ctx.strokeStyle = 'rgba(72, 97, 127, 0.14)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(chart.x, thresholdY)
    ctx.lineTo(chart.x + chart.width, thresholdY)
    ctx.strokeStyle = 'rgba(217, 45, 65, 0.75)'
    ctx.lineWidth = 1.3
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])

    this.drawSeriesGhost(mapX, mapY, input.queueRawSeries, RAW_COLOR)
    this.drawSeriesGhost(mapX, mapY, input.queueSafeSeries, SAFE_COLOR)

    const rawReveal = clamp(input.transitionProgress / 0.56)
    const safeReveal = clamp((input.transitionProgress - 0.42) / 0.58)

    this.drawAvoidedArea(mapX, mapY, input.queueRawSeries, input.queueSafeSeries, Math.min(rawReveal, safeReveal))

    const rawPoint = this.drawSeries(mapX, mapY, input.queueRawSeries, rawReveal, RAW_COLOR, 2.5)
    const safePoint = this.drawSeries(mapX, mapY, input.queueSafeSeries, safeReveal, SAFE_COLOR, 2.6)

    const markerProgress = Math.max(rawReveal, safeReveal)
    const markerX = mapX(markerProgress * (input.queueRawSeries.length - 1), input.queueRawSeries.length)
    ctx.beginPath()
    ctx.moveTo(markerX, chart.y)
    ctx.lineTo(markerX, chart.y + chart.height)
    ctx.strokeStyle = 'rgba(60, 82, 111, 0.36)'
    ctx.lineWidth = 1
    ctx.stroke()

    if (rawPoint) {
      this.drawGlow(rawPoint, RAW_COLOR, 11)
    }
    if (safePoint) {
      this.drawGlow(safePoint, SAFE_COLOR, 11)
    }

    ctx.restore()

    ctx.font = '600 11px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#4f6685'
    ctx.fillText('SLA overload threshold', chart.x + 8, thresholdY - 6)
    ctx.fillText('minute 0', chart.x, chart.y + chart.height + 18)
    ctx.fillText(`minute ${input.queueRawSeries.length - 1}`, chart.x + chart.width - 58, chart.y + chart.height + 18)

    const avoidedLoad = Math.max(0, Math.round((input.correctionRatio * 1000 + (input.rawRiskRatio - input.safeRiskRatio) * 550)))
    ctx.fillStyle = TEXT_COLOR
    ctx.font = '700 12px "Space Grotesk", sans-serif'
    ctx.fillText(`avoided overload load: ${avoidedLoad.toLocaleString()} tickets`, chart.x, panel.y + panel.height - 16)
  }

  private drawChip(x: number, y: number, label: string, value: string, color: string): void {
    const ctx = this.ctx
    const width = 124
    const height = 38

    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 10)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.strokeStyle = 'rgba(147, 164, 187, 0.45)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    ctx.font = '600 10px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#4b6382'
    ctx.fillText(label, x + 8, y + 14)

    ctx.font = '700 13px "Manrope", sans-serif'
    ctx.fillStyle = color
    ctx.fillText(value, x + 8, y + 30)
  }

  private drawSeriesGhost(
    mapX: (indexFloat: number, length: number) => number,
    mapY: (value: number) => number,
    series: number[],
    color: string,
  ): void {
    const ctx = this.ctx
    if (series.length < 2) {
      return
    }

    ctx.beginPath()
    ctx.moveTo(mapX(0, series.length), mapY(series[0]))
    for (let i = 1; i < series.length; i += 1) {
      ctx.lineTo(mapX(i, series.length), mapY(series[i]))
    }

    ctx.strokeStyle = withAlpha(color, 0.18)
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private drawSeries(
    mapX: (indexFloat: number, length: number) => number,
    mapY: (value: number) => number,
    series: number[],
    reveal: number,
    color: string,
    width: number,
  ): ScreenPoint | null {
    if (series.length < 2) {
      return null
    }

    const ctx = this.ctx
    const progress = clamp(reveal)
    const maxIndexFloat = progress * (series.length - 1)
    const fullIndex = Math.floor(maxIndexFloat)
    const frac = maxIndexFloat - fullIndex

    ctx.beginPath()
    ctx.moveTo(mapX(0, series.length), mapY(series[0]))

    for (let i = 1; i <= fullIndex; i += 1) {
      ctx.lineTo(mapX(i, series.length), mapY(series[i]))
    }

    if (fullIndex < series.length - 1) {
      const x0 = mapX(fullIndex, series.length)
      const y0 = mapY(series[fullIndex])
      const x1 = mapX(fullIndex + 1, series.length)
      const y1 = mapY(series[fullIndex + 1])
      ctx.lineTo(lerp(x0, x1, frac), lerp(y0, y1, frac))
    }

    ctx.strokeStyle = withAlpha(color, 0.95)
    ctx.lineWidth = width
    ctx.stroke()

    const markerValue = interpolateSeries(series, maxIndexFloat)
    const marker: ScreenPoint = {
      x: mapX(maxIndexFloat, series.length),
      y: mapY(markerValue),
    }

    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.98)
    ctx.fill()

    return marker
  }

  private drawAvoidedArea(
    mapX: (indexFloat: number, length: number) => number,
    mapY: (value: number) => number,
    rawSeries: number[],
    safeSeries: number[],
    reveal: number,
  ): void {
    const progress = clamp(reveal)
    if (rawSeries.length < 2 || safeSeries.length < 2 || progress < 0.08) {
      return
    }

    const ctx = this.ctx
    const samples = 40
    const maxIndexFloat = progress * (rawSeries.length - 1)

    const rawPts: ScreenPoint[] = []
    const safePts: ScreenPoint[] = []

    for (let i = 0; i <= samples; i += 1) {
      const idxFloat = (i / samples) * maxIndexFloat
      const rawValue = interpolateSeries(rawSeries, idxFloat)
      const safeValue = interpolateSeries(safeSeries, idxFloat)

      rawPts.push({ x: mapX(idxFloat, rawSeries.length), y: mapY(rawValue) })
      safePts.push({ x: mapX(idxFloat, safeSeries.length), y: mapY(safeValue) })
    }

    ctx.beginPath()
    ctx.moveTo(rawPts[0].x, rawPts[0].y)
    for (const point of rawPts) {
      ctx.lineTo(point.x, point.y)
    }
    for (let i = safePts.length - 1; i >= 0; i -= 1) {
      ctx.lineTo(safePts[i].x, safePts[i].y)
    }
    ctx.closePath()

    ctx.fillStyle = 'rgba(14, 90, 207, 0.09)'
    ctx.fill()
  }

  private drawGlow(point: ScreenPoint, color: string, radius: number): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.16)
    ctx.fill()
  }
}
