export interface ControlValues {
  pressure: number
}

export interface ProofFrameUi {
  ship: boolean
  statusText: string
  decisionText: string
  peakRawQueue: number
  peakSafeQueue: number
  avoidedEscalations: number
}

export class UIController {
  private readonly etaSlider: HTMLInputElement
  private readonly etaValue: HTMLElement
  private readonly pressureDetail: HTMLElement

  private readonly shipIndicator: HTMLElement
  private readonly shipReason: HTMLElement
  private readonly decisionLine: HTMLElement

  private readonly kpiPeakRaw: HTMLElement
  private readonly kpiPeakSafe: HTMLElement
  private readonly kpiAvoidedEscalations: HTMLElement

  constructor() {
    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.pressureDetail = this.getElement('pressure-detail')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.decisionLine = this.getElement('decision-line')

    this.kpiPeakRaw = this.getElement('kpi-peak-raw')
    this.kpiPeakSafe = this.getElement('kpi-peak-safe')
    this.kpiAvoidedEscalations = this.getElement('kpi-overload-avoided')

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

    this.shipReason.textContent = frame.statusText
    this.decisionLine.textContent = frame.decisionText

    this.kpiPeakRaw.textContent = frame.peakRawQueue.toLocaleString()
    this.kpiPeakSafe.textContent = frame.peakSafeQueue.toLocaleString()
    this.kpiAvoidedEscalations.textContent = frame.avoidedEscalations.toLocaleString()
  }

  renderPressureModel(eta: number, strictness: number): void {
    const patchLabel = eta < 0.95 ? 'Low' : eta < 1.6 ? 'Balanced' : 'High'
    const guardrailLabel = strictness < 0.78 ? 'tight guardrails' : strictness < 1.08 ? 'standard guardrails' : 'wide guardrails'
    this.pressureDetail.textContent = `${patchLabel} patch size. ${guardrailLabel} determine correction strength before ship.`
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
