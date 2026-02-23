import { Halfspace, Vec2 } from './geometry'

export interface ControlValues {
  eta: number
  strictness: number
}

export interface ProofFrameUi {
  ship: boolean
  reason: string | null
  phaseText: string
  rawStep: Vec2
  safeStep: Vec2
  lambdas: Record<string, number>
  maxViolationRaw: number
  maxViolationSafe: number
  descentRetainedRatio: number
  colorById: Record<string, string>
}

interface LambdaRow {
  row: HTMLDivElement
  label: HTMLSpanElement
  value: HTMLSpanElement
  fill: HTMLDivElement
}

function positivePart(value: number): number {
  return Math.max(0, value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function strictnessDescriptor(value: number): string {
  if (value < 0.9) {
    return 'Tight'
  }
  if (value > 1.12) {
    return 'Loose'
  }
  return 'Balanced'
}

export class UIController {
  private readonly halfspaces: Halfspace[]
  private readonly etaSlider: HTMLInputElement
  private readonly etaValue: HTMLElement
  private readonly strictnessSlider: HTMLInputElement
  private readonly strictnessValue: HTMLElement
  private readonly shipIndicator: HTMLElement
  private readonly shipReason: HTMLElement
  private readonly phaseCaption: HTMLElement
  private readonly metricRawViolation: HTMLElement
  private readonly metricSafeViolation: HTMLElement
  private readonly metricRetained: HTMLElement
  private readonly lambdaRows: Map<string, LambdaRow>

  constructor(halfspaces: Halfspace[]) {
    this.halfspaces = halfspaces

    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')

    this.strictnessSlider = this.getElement<HTMLInputElement>('strictness-slider')
    this.strictnessValue = this.getElement('strictness-value')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.phaseCaption = this.getElement('phase-caption')

    this.metricRawViolation = this.getElement('metric-raw-violation')
    this.metricSafeViolation = this.getElement('metric-safe-violation')
    this.metricRetained = this.getElement('metric-retained')

    this.lambdaRows = this.createLambdaRows(halfspaces)

    this.syncDisplayedControlValues()
  }

  onControlsChange(callback: () => void): void {
    const listener = () => {
      this.syncDisplayedControlValues()
      callback()
    }

    this.etaSlider.addEventListener('input', listener)
    this.strictnessSlider.addEventListener('input', listener)
  }

  onReplay(callback: () => void): void {
    const replayButton = this.getElement<HTMLButtonElement>('replay-button')
    replayButton.addEventListener('click', callback)
  }

  setControlValues(values: Partial<ControlValues>): void {
    if (typeof values.eta === 'number') {
      this.etaSlider.value = values.eta.toFixed(2)
    }
    if (typeof values.strictness === 'number') {
      this.strictnessSlider.value = values.strictness.toFixed(2)
    }
    this.syncDisplayedControlValues()
  }

  readControlValues(): ControlValues {
    return {
      eta: Number.parseFloat(this.etaSlider.value),
      strictness: Number.parseFloat(this.strictnessSlider.value),
    }
  }

  renderFrame(frame: ProofFrameUi): void {
    this.shipIndicator.textContent = frame.ship ? 'SHIP' : 'HOLD'
    this.shipIndicator.classList.toggle('ship', frame.ship)
    this.shipIndicator.classList.toggle('hold', !frame.ship)

    this.shipReason.textContent = frame.reason ?? 'No feasible projected step under current guardrails.'
    this.phaseCaption.textContent = frame.phaseText

    this.metricRawViolation.textContent = `+${positivePart(frame.maxViolationRaw).toFixed(3)}`
    this.metricRawViolation.classList.add('bad')

    this.metricSafeViolation.textContent = `+${positivePart(frame.maxViolationSafe).toFixed(3)}`
    this.metricSafeViolation.classList.toggle('good', positivePart(frame.maxViolationSafe) <= 1e-6)
    this.metricSafeViolation.classList.toggle('bad', positivePart(frame.maxViolationSafe) > 1e-6)

    this.metricRetained.textContent = formatPercent(frame.descentRetainedRatio)
    this.metricRetained.classList.toggle('good', frame.descentRetainedRatio >= 0.6)
    this.metricRetained.classList.toggle('bad', frame.descentRetainedRatio < 0.6)

    this.renderLambdas(frame)
  }

  private renderLambdas(frame: ProofFrameUi): void {
    const maxLambda = Math.max(0.05, ...this.halfspaces.map((halfspace) => frame.lambdas[halfspace.id] ?? 0))

    for (const halfspace of this.halfspaces) {
      const row = this.lambdaRows.get(halfspace.id)
      if (!row) {
        continue
      }

      const value = frame.lambdas[halfspace.id] ?? 0
      row.row.classList.toggle('inactive', !halfspace.active)
      row.label.textContent = halfspace.id
      row.value.textContent = value > 1e-4 ? value.toFixed(3) : '0.000'

      row.fill.style.setProperty('--bar-color', frame.colorById[halfspace.id] ?? '#2563eb')
      row.fill.style.width = `${Math.min(100, (value / maxLambda) * 100)}%`
    }
  }

  private syncDisplayedControlValues(): void {
    const eta = Number.parseFloat(this.etaSlider.value)
    this.etaValue.textContent = eta.toFixed(2)

    const strictness = Number.parseFloat(this.strictnessSlider.value)
    this.strictnessValue.textContent = `${strictnessDescriptor(strictness)} · ${strictness.toFixed(2)}x`
  }

  private createLambdaRows(halfspaces: Halfspace[]): Map<string, LambdaRow> {
    const container = this.getElement<HTMLDivElement>('lambda-bars')
    const rows = new Map<string, LambdaRow>()

    for (const halfspace of halfspaces) {
      const row = document.createElement('div')
      row.className = 'lambda-row'

      const head = document.createElement('div')
      head.className = 'lambda-head'

      const label = document.createElement('span')
      label.textContent = halfspace.id

      const value = document.createElement('span')
      value.textContent = '0.000'

      head.appendChild(label)
      head.appendChild(value)

      const track = document.createElement('div')
      track.className = 'lambda-track'

      const fill = document.createElement('div')
      fill.className = 'lambda-fill'
      track.appendChild(fill)

      row.appendChild(head)
      row.appendChild(track)
      container.appendChild(row)

      rows.set(halfspace.id, {
        row,
        label,
        value,
        fill,
      })
    }

    return rows
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
