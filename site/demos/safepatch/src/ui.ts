export interface ControlValues {
  eta: number
  strictness: number
}

export interface ProofFrameUi {
  ship: boolean
  reason: string | null
  phaseText: string
  maxViolationRaw: number
  maxViolationSafe: number
  descentRetainedRatio: number
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
  if (value > 1.13) {
    return 'Loose'
  }
  return 'Balanced'
}

export class UIController {
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

  constructor() {
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
  }

  private syncDisplayedControlValues(): void {
    const eta = Number.parseFloat(this.etaSlider.value)
    this.etaValue.textContent = eta.toFixed(2)

    const strictness = Number.parseFloat(this.strictnessSlider.value)
    this.strictnessValue.textContent = `${strictnessDescriptor(strictness)} · ${strictness.toFixed(2)}x`
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
