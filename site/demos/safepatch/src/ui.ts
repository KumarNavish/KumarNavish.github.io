import katex from 'katex'

export interface ControlValues {
  pressure: number
}

export interface ProofFrameUi {
  ship: boolean
  reason: string | null
  phaseText: string
  maxViolationRaw: number
  maxViolationSafe: number
  correctionSize: number
}

function positivePart(value: number): number {
  return Math.max(0, value)
}

export class UIController {
  private readonly etaSlider: HTMLInputElement
  private readonly etaValue: HTMLElement
  private readonly pressureDetail: HTMLElement

  private readonly shipIndicator: HTMLElement
  private readonly shipReason: HTMLElement
  private readonly phaseCaption: HTMLElement

  private readonly metricRawViolation: HTMLElement
  private readonly metricSafeViolation: HTMLElement
  private readonly metricCorrection: HTMLElement

  constructor() {
    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.pressureDetail = this.getElement('pressure-detail')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.phaseCaption = this.getElement('phase-caption')

    this.metricRawViolation = this.getElement('metric-raw-violation')
    this.metricSafeViolation = this.getElement('metric-safe-violation')
    this.metricCorrection = this.getElement('metric-correction')

    this.syncDisplayedControlValues()
  }

  onControlsChange(callback: () => void): void {
    const listener = () => {
      this.syncDisplayedControlValues()
      callback()
    }

    this.etaSlider.addEventListener('input', listener)
  }

  onReplay(callback: () => void): void {
    const replayButton = this.getElement<HTMLButtonElement>('replay-button')
    replayButton.addEventListener('click', callback)
  }

  setControlValues(values: Partial<ControlValues>): void {
    if (typeof values.pressure === 'number') {
      this.etaSlider.value = values.pressure.toFixed(3)
    }
    this.syncDisplayedControlValues()
  }

  readControlValues(): ControlValues {
    return {
      pressure: Number.parseFloat(this.etaSlider.value),
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

    this.metricCorrection.textContent = frame.correctionSize.toFixed(3)
    this.metricCorrection.classList.toggle('good', frame.correctionSize > 1e-6)
    this.metricCorrection.classList.toggle('bad', frame.correctionSize <= 1e-6)
  }

  renderPressureModel(eta: number, strictness: number): void {
    katex.render(String.raw`\eta=${eta.toFixed(2)},\ \epsilon=${strictness.toFixed(2)}`, this.pressureDetail, {
      throwOnError: false,
      displayMode: false,
      strict: 'warn',
    })
  }

  private syncDisplayedControlValues(): void {
    const pressure = Number.parseFloat(this.etaSlider.value)
    this.etaValue.textContent = `${Math.round(pressure * 100)}%`
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
