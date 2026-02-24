export interface ControlValues {
  pressure: number
}

export interface ProofFrameUi {
  ship: boolean
  reason: string | null
  phaseText: string
  rawRiskRatio: number
  retainedValueRatio: number
  riskRemovedRatio: number
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

  private readonly metricRawRisk: HTMLElement
  private readonly metricValue: HTMLElement
  private readonly metricRemoved: HTMLElement
  private readonly metricRawRiskBar: HTMLElement
  private readonly metricValueBar: HTMLElement
  private readonly metricRemovedBar: HTMLElement

  constructor() {
    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.pressureDetail = this.getElement('pressure-detail')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.phaseCaption = this.getElement('phase-caption')

    this.metricRawRisk = this.getElement('metric-raw-risk')
    this.metricValue = this.getElement('metric-value')
    this.metricRemoved = this.getElement('metric-removed')
    this.metricRawRiskBar = this.getElement('metric-raw-risk-bar')
    this.metricValueBar = this.getElement('metric-value-bar')
    this.metricRemovedBar = this.getElement('metric-removed-bar')

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

    const rawRiskPct = Math.round(clamp(frame.rawRiskRatio) * 100)
    const retainedValuePct = Math.round(clamp(frame.retainedValueRatio) * 100)
    const removedRiskPct = Math.round(clamp(frame.riskRemovedRatio) * 100)

    this.metricRawRisk.textContent = `${rawRiskPct}%`
    this.metricRawRiskBar.style.width = `${rawRiskPct}%`

    this.metricValue.textContent = `${retainedValuePct}%`
    this.metricValueBar.style.width = `${retainedValuePct}%`

    this.metricRemoved.textContent = `${removedRiskPct}%`
    this.metricRemovedBar.style.width = `${removedRiskPct}%`
  }

  renderPressureModel(eta: number, strictness: number): void {
    const pressureLabel = eta < 0.95 ? 'Low pressure' : eta < 1.6 ? 'Balanced pressure' : 'High pressure'
    const guardrailLabel = strictness < 0.78 ? 'tight guardrails' : strictness < 1.08 ? 'standard guardrails' : 'wide guardrails'
    this.pressureDetail.textContent = `${pressureLabel}: larger patches move farther; ${guardrailLabel} control how strongly SafePatch must bend the update.`
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
