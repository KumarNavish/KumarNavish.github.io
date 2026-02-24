interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface SceneRenderInput {
  queueRawSeries: number[]
  queueSafeSeries: number[]
  overloadThreshold: number
  transitionProgress: number
}

const RAW_COLOR = '#d13a52'
const SAFE_COLOR = '#1c5ed8'

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function easeInOutCubic(value: number): number {
  const t = clamp(value)
  return t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function firstBreachMinute(series: number[], threshold: number): number | null {
  const index = series.findIndex((value) => value > threshold)
  return index >= 0 ? index : null
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

    const chart: Rect = {
      x: 56,
      y: 30,
      width: width - 90,
      height: height - 74,
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    ctx.beginPath()
    ctx.roundRect(chart.x - 16, chart.y - 12, chart.width + 24, chart.height + 22, 12)
    ctx.fillStyle = '#f8fbff'
    ctx.strokeStyle = 'rgba(125, 149, 180, 0.4)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    const maxValue = Math.max(input.overloadThreshold, ...input.queueRawSeries, ...input.queueSafeSeries, 1)
    const upper = maxValue * 1.08

    const mapX = (index: number, length: number): number =>
      chart.x + (index / Math.max(1, length - 1)) * chart.width

    const mapY = (value: number): number => chart.y + chart.height - (value / upper) * chart.height

    this.drawGrid(chart)

    const thresholdY = mapY(input.overloadThreshold)
    this.drawThresholdBand(chart, thresholdY)

    const length = Math.min(input.queueRawSeries.length, input.queueSafeSeries.length)
    const rawSeries = input.queueRawSeries.slice(0, length)
    const safeSeries = input.queueSafeSeries.slice(0, length)

    const blend = easeInOutCubic(input.transitionProgress)
    const animatedSafeSeries = rawSeries.map((value, index) => value + (safeSeries[index] - value) * blend)

    this.drawDeltaArea(mapX, mapY, rawSeries, animatedSafeSeries)
    this.drawSeries(mapX, mapY, rawSeries, RAW_COLOR, 2.4, 0.9)
    this.drawSeries(mapX, mapY, animatedSafeSeries, SAFE_COLOR, 3.1, 0.96)

    this.drawMarkerAtEnd(mapX, mapY, rawSeries, RAW_COLOR)
    this.drawMarkerAtEnd(mapX, mapY, animatedSafeSeries, SAFE_COLOR)

    const rawBreach = firstBreachMinute(rawSeries, input.overloadThreshold)
    const safeBreach = firstBreachMinute(animatedSafeSeries, input.overloadThreshold)
    if (rawBreach !== null) {
      this.drawBreachMarker(mapX(rawBreach, rawSeries.length), thresholdY, RAW_COLOR)
    }
    if (safeBreach !== null) {
      this.drawBreachMarker(mapX(safeBreach, animatedSafeSeries.length), thresholdY, SAFE_COLOR)
    }

    this.drawLegend(chart)
    this.drawAxisLabels(chart, rawSeries.length)
  }

  private drawGrid(chart: Rect): void {
    const ctx = this.ctx

    for (let i = 0; i <= 4; i += 1) {
      const y = chart.y + (i / 4) * chart.height
      ctx.beginPath()
      ctx.moveTo(chart.x, y)
      ctx.lineTo(chart.x + chart.width, y)
      ctx.strokeStyle = 'rgba(74, 97, 126, 0.12)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i <= 6; i += 1) {
      const x = chart.x + (i / 6) * chart.width
      ctx.beginPath()
      ctx.moveTo(x, chart.y)
      ctx.lineTo(x, chart.y + chart.height)
      ctx.strokeStyle = 'rgba(74, 97, 126, 0.08)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawThresholdBand(chart: Rect, thresholdY: number): void {
    const ctx = this.ctx

    ctx.fillStyle = withAlpha(RAW_COLOR, 0.08)
    ctx.fillRect(chart.x, chart.y, chart.width, Math.max(0, thresholdY - chart.y))

    ctx.beginPath()
    ctx.moveTo(chart.x, thresholdY)
    ctx.lineTo(chart.x + chart.width, thresholdY)
    ctx.strokeStyle = withAlpha(RAW_COLOR, 0.82)
    ctx.lineWidth = 1.4
    ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.font = '700 11px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#a32d42'
    ctx.fillText('SLA breach line', chart.x + 8, thresholdY - 8)
  }

  private drawSeries(
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    series: number[],
    color: string,
    width: number,
    alpha: number,
  ): void {
    if (series.length < 2) {
      return
    }

    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(mapX(0, series.length), mapY(series[0]))

    for (let i = 1; i < series.length; i += 1) {
      ctx.lineTo(mapX(i, series.length), mapY(series[i]))
    }

    ctx.strokeStyle = withAlpha(color, alpha)
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  private drawDeltaArea(
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    rawSeries: number[],
    safeSeries: number[],
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

  private drawMarkerAtEnd(
    mapX: (index: number, length: number) => number,
    mapY: (value: number) => number,
    series: number[],
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
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.14)
    ctx.fill()
  }

  private drawBreachMarker(x: number, y: number, color: string): void {
    const ctx = this.ctx

    ctx.beginPath()
    ctx.arc(x, y, 3.8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.36)
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  private drawLegend(chart: Rect): void {
    const ctx = this.ctx
    const originX = chart.x + 6
    const originY = chart.y + 8

    ctx.font = '700 11px "Space Grotesk", sans-serif'

    ctx.beginPath()
    ctx.moveTo(originX, originY)
    ctx.lineTo(originX + 18, originY)
    ctx.strokeStyle = RAW_COLOR
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.fillStyle = '#5a6e8b'
    ctx.fillText('raw deploy', originX + 24, originY + 3)

    ctx.beginPath()
    ctx.moveTo(originX + 94, originY)
    ctx.lineTo(originX + 112, originY)
    ctx.strokeStyle = SAFE_COLOR
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillText('SafePatch deploy', originX + 118, originY + 3)
  }

  private drawAxisLabels(chart: Rect, seriesLength: number): void {
    const ctx = this.ctx
    ctx.font = '700 11px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#4f6684'
    ctx.fillText('minute 0', chart.x, chart.y + chart.height + 18)
    ctx.fillText(`minute ${Math.max(0, seriesLength - 1)}`, chart.x + chart.width - 64, chart.y + chart.height + 18)
    ctx.fillText('queue size', chart.x + 6, chart.y + 16)
  }
}
