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
  safeRiskRatio: number
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
  private readonly decisionLine: HTMLElement

  private readonly kpiValueKept: HTMLElement
  private readonly kpiRawRisk: HTMLElement
  private readonly kpiRiskRemoved: HTMLElement

  constructor() {
    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.pressureDetail = this.getElement('pressure-detail')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.phaseCaption = this.getElement('phase-caption')
    this.decisionLine = this.getElement('decision-line')

    this.kpiValueKept = this.getElement('kpi-value-kept')
    this.kpiRawRisk = this.getElement('kpi-raw-risk')
    this.kpiRiskRemoved = this.getElement('kpi-risk-removed')

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
    const safeRiskPct = Math.round(clamp(frame.safeRiskRatio) * 100)

    this.kpiValueKept.textContent = `${retainedValuePct}%`
    this.kpiRawRisk.textContent = `${rawRiskPct}%`
    this.kpiRiskRemoved.textContent = `${removedRiskPct}%`

    this.decisionLine.textContent = frame.ship
      ? `Ship safe patch: keeps ${retainedValuePct}% behavior gain, reduces unsafe risk from ${rawRiskPct}% to ${safeRiskPct}%.`
      : `Hold patch: unsafe risk remains ${safeRiskPct}%. tighten or revise guardrails.`
  }

  renderPressureModel(eta: number, strictness: number): void {
    const pressureLabel = eta < 0.95 ? 'Low pressure' : eta < 1.6 ? 'Balanced pressure' : 'High pressure'
    const guardrailLabel = strictness < 0.78 ? 'tight guardrails' : strictness < 1.08 ? 'standard guardrails' : 'wide guardrails'
    this.pressureDetail.textContent = `${pressureLabel}: larger patches move farther; ${guardrailLabel} determine how much correction is required before ship.`
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
