export interface ControlValues {
  pressure: number
}

export interface ProofFrameUi {
  ship: boolean
  reason: string | null
  phaseText: string
  rawOvershootRatio: number
  safetyRecoveredRatio: number
  correctionRatio: number
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
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
  private readonly metricRawBar: HTMLElement
  private readonly metricSafeBar: HTMLElement
  private readonly metricCorrectionBar: HTMLElement

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
    this.metricRawBar = this.getElement('metric-raw-bar')
    this.metricSafeBar = this.getElement('metric-safe-bar')
    this.metricCorrectionBar = this.getElement('metric-correction-bar')

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

    const rawOvershootPct = Math.round(clamp(frame.rawOvershootRatio) * 100)
    const safeRecoveredPct = Math.round(clamp(frame.safetyRecoveredRatio) * 100)
    const correctionPct = Math.round(clamp(frame.correctionRatio) * 100)

    this.metricRawViolation.textContent = `${rawOvershootPct}%`
    this.metricRawBar.style.width = `${rawOvershootPct}%`

    this.metricCorrection.textContent = `${correctionPct}%`
    this.metricCorrectionBar.style.width = `${correctionPct}%`

    this.metricSafeViolation.textContent = `${safeRecoveredPct}%`
    this.metricSafeBar.style.width = `${safeRecoveredPct}%`
  }

  renderPressureModel(eta: number, strictness: number): void {
    const pressureLabel = eta < 0.95 ? 'Low pressure' : eta < 1.6 ? 'Balanced pressure' : 'High pressure'
    const guardrailLabel = strictness < 0.78 ? 'tight guardrails' : strictness < 1.08 ? 'standard guardrails' : 'wide guardrails'
    this.pressureDetail.textContent = `${pressureLabel}: larger pushes move farther; ${guardrailLabel} set how much correction is needed.`
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
