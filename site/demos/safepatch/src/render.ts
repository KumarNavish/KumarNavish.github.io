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
  rawOverloadMinute: number | null
  safeOverloadMinute: number | null
  transitionProgress: number
}

const RAW_COLOR = '#d92d41'
const SAFE_COLOR = '#0e5acf'

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

function interpolateSeries(series: number[], indexFloat: number): number {
  if (series.length === 0) {
    return 0
  }

  const i0 = Math.floor(indexFloat)
  const i1 = Math.min(series.length - 1, i0 + 1)
  const t = indexFloat - i0
  return series[i0] + (series[i1] - series[i0]) * t
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
    background.addColorStop(1, '#edf4fb')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)

    const chart: Rect = {
      x: 48,
      y: 40,
      width: width - 96,
      height: height - 92,
    }

    ctx.beginPath()
    ctx.roundRect(chart.x - 16, chart.y - 16, chart.width + 32, chart.height + 28, 12)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
    ctx.strokeStyle = 'rgba(136, 154, 180, 0.4)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    const maxValue = Math.max(input.overloadThreshold, ...input.queueRawSeries, ...input.queueSafeSeries, 1)

    const mapX = (indexFloat: number, length: number): number =>
      chart.x + (indexFloat / Math.max(1, length - 1)) * chart.width

    const mapY = (value: number): number =>
      chart.y + chart.height - (value / (maxValue * 1.08)) * chart.height

    this.drawGrid(chart)

    const thresholdY = mapY(input.overloadThreshold)
    this.drawThreshold(chart, thresholdY)

    const rawReveal = clamp(input.transitionProgress / 0.58)
    const safeReveal = clamp((input.transitionProgress - 0.34) / 0.66)

    this.drawSeriesGhost(mapX, mapY, input.queueRawSeries, RAW_COLOR)
    this.drawSeriesGhost(mapX, mapY, input.queueSafeSeries, SAFE_COLOR)

    this.drawSeries(mapX, mapY, input.queueRawSeries, rawReveal, RAW_COLOR, 2.5)
    this.drawSeries(mapX, mapY, input.queueSafeSeries, safeReveal, SAFE_COLOR, 2.6)

    this.drawCurrentMinuteMarker(chart, input.queueRawSeries.length, Math.max(rawReveal, safeReveal))

    if (input.rawOverloadMinute !== null) {
      this.drawOverloadMarker(mapX(input.rawOverloadMinute, input.queueRawSeries.length), thresholdY, RAW_COLOR, 'raw page')
    }
    if (input.safeOverloadMinute !== null) {
      this.drawOverloadMarker(mapX(input.safeOverloadMinute, input.queueSafeSeries.length), thresholdY, SAFE_COLOR, 'safe page')
    }

    this.drawLegend(chart)

    ctx.font = '600 11px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#4d6585'
    ctx.fillText('minute 0', chart.x, chart.y + chart.height + 20)
    ctx.fillText(`minute ${input.queueRawSeries.length - 1}`, chart.x + chart.width - 60, chart.y + chart.height + 20)
  }

  private drawGrid(chart: Rect): void {
    const ctx = this.ctx

    for (let i = 0; i <= 4; i += 1) {
      const y = chart.y + (i / 4) * chart.height
      ctx.beginPath()
      ctx.moveTo(chart.x, y)
      ctx.lineTo(chart.x + chart.width, y)
      ctx.strokeStyle = 'rgba(74, 97, 126, 0.14)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i <= 6; i += 1) {
      const x = chart.x + (i / 6) * chart.width
      ctx.beginPath()
      ctx.moveTo(x, chart.y)
      ctx.lineTo(x, chart.y + chart.height)
      ctx.strokeStyle = 'rgba(74, 97, 126, 0.1)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawThreshold(chart: Rect, y: number): void {
    const ctx = this.ctx

    ctx.beginPath()
    ctx.moveTo(chart.x, y)
    ctx.lineTo(chart.x + chart.width, y)
    ctx.strokeStyle = withAlpha(RAW_COLOR, 0.7)
    ctx.lineWidth = 1.35
    ctx.setLineDash([6, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.font = '600 11px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#b22a41'
    ctx.fillText('SLA overload threshold', chart.x + 8, y - 7)
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
  ): void {
    if (series.length < 2) {
      return
    }

    const ctx = this.ctx
    const progress = clamp(reveal)
    const maxIndexFloat = progress * (series.length - 1)
    const fullIndex = Math.floor(maxIndexFloat)
    const fraction = maxIndexFloat - fullIndex

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
      ctx.lineTo(x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction)
    }

    ctx.strokeStyle = withAlpha(color, 0.94)
    ctx.lineWidth = width
    ctx.stroke()

    const markerValue = interpolateSeries(series, maxIndexFloat)
    const markerX = mapX(maxIndexFloat, series.length)
    const markerY = mapY(markerValue)

    ctx.beginPath()
    ctx.arc(markerX, markerY, 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(markerX, markerY, 10, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.13)
    ctx.fill()
  }

  private drawCurrentMinuteMarker(chart: Rect, seriesLength: number, progress: number): void {
    const ctx = this.ctx
    const x = chart.x + clamp(progress) * chart.width

    ctx.beginPath()
    ctx.moveTo(x, chart.y)
    ctx.lineTo(x, chart.y + chart.height)
    ctx.strokeStyle = 'rgba(54, 79, 109, 0.34)'
    ctx.lineWidth = 1
    ctx.stroke()

    const minute = Math.round(clamp(progress) * (seriesLength - 1))
    ctx.font = '600 11px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#4f6684'
    ctx.fillText(`minute ${minute}`, x + 6, chart.y + 16)
  }

  private drawOverloadMarker(x: number, y: number, color: string, label: string): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 13, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, 0.34)
    ctx.lineWidth = 1.4
    ctx.stroke()

    ctx.font = '600 10px "Space Grotesk", sans-serif'
    ctx.fillStyle = withAlpha(color, 0.95)
    ctx.fillText(label, x + 8, y - 8)
  }

  private drawLegend(chart: Rect): void {
    const ctx = this.ctx
    const x = chart.x + 4
    const y = chart.y + 8

    ctx.beginPath()
    ctx.roundRect(x, y, 170, 40, 10)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.strokeStyle = 'rgba(140, 160, 185, 0.4)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    ctx.font = '600 10px "Space Grotesk", sans-serif'
    ctx.fillStyle = '#45607f'

    ctx.beginPath()
    ctx.moveTo(x + 10, y + 14)
    ctx.lineTo(x + 30, y + 14)
    ctx.strokeStyle = RAW_COLOR
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.fillText('raw deploy', x + 35, y + 17)

    ctx.beginPath()
    ctx.moveTo(x + 10, y + 29)
    ctx.lineTo(x + 30, y + 29)
    ctx.strokeStyle = SAFE_COLOR
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.fillText('SafePatch deploy', x + 35, y + 32)
  }
}
