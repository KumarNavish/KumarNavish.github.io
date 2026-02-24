export interface ControlValues {
  pressure: number
}

export interface ProofFrameUi {
  ship: boolean
  statusText: string
  decisionText: string
  rawOutcomeText: string
  safeOutcomeText: string
  peakQueueReduction: number
  breachMinutesAvoided: number
  avoidedEscalations: number
}

function scenarioLabel(pressure: number): string {
  if (pressure < 0.38) {
    return 'Low traffic'
  }
  if (pressure < 0.75) {
    return 'Peak hour'
  }
  return 'Incident surge'
}

export class UIController {
  private readonly pressureDetail: HTMLElement

  private readonly shipIndicator: HTMLElement
  private readonly shipReason: HTMLElement
  private readonly decisionLine: HTMLElement

  private readonly rawOutcome: HTMLElement
  private readonly safeOutcome: HTMLElement

  private readonly kpiPeakReduction: HTMLElement
  private readonly kpiBreachMinutes: HTMLElement
  private readonly kpiEscalations: HTMLElement

  private readonly scenarioButtons: HTMLButtonElement[]
  private selectedPressure = 0.55

  constructor() {
    this.pressureDetail = this.getElement('pressure-detail')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.decisionLine = this.getElement('decision-line')

    this.rawOutcome = this.getElement('raw-outcome')
    this.safeOutcome = this.getElement('safe-outcome')

    this.kpiPeakReduction = this.getElement('kpi-peak-reduction')
    this.kpiBreachMinutes = this.getElement('kpi-breach-minutes')
    this.kpiEscalations = this.getElement('kpi-escalations')

    this.scenarioButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.scenario-btn'))

    if (this.scenarioButtons.length === 0) {
      throw new Error('Missing .scenario-btn controls')
    }

    const activeButton = this.scenarioButtons.find((button) => button.classList.contains('active')) ?? this.scenarioButtons[0]
    this.selectedPressure = Number.parseFloat(activeButton.dataset.pressure ?? '0.55')
    this.syncScenarioButtonState()
  }

  onControlsChange(callback: () => void): void {
    for (const button of this.scenarioButtons) {
      button.addEventListener('click', () => {
        const pressure = Number.parseFloat(button.dataset.pressure ?? '0.55')
        if (Number.isNaN(pressure)) {
          return
        }

        this.selectedPressure = pressure
        this.syncScenarioButtonState()
        callback()
      })
    }
  }

  onReplay(callback: () => void): void {
    const replayButton = this.getElement<HTMLButtonElement>('replay-button')
    replayButton.addEventListener('click', callback)
  }

  onExport(callback: () => void): void {
    const exportButton = this.getElement<HTMLButtonElement>('export-button')
    exportButton.addEventListener('click', callback)
  }

  setControlValues(values: Partial<ControlValues>): void {
    if (typeof values.pressure === 'number' && Number.isFinite(values.pressure)) {
      this.selectedPressure = values.pressure
      this.syncScenarioButtonState()
    }
  }

  readControlValues(): ControlValues {
    return {
      pressure: this.selectedPressure,
    }
  }

  renderFrame(frame: ProofFrameUi): void {
    this.shipIndicator.textContent = frame.ship ? 'SHIP' : 'HOLD'
    this.shipIndicator.classList.toggle('ship', frame.ship)
    this.shipIndicator.classList.toggle('hold', !frame.ship)

    this.shipReason.textContent = frame.statusText
    this.decisionLine.textContent = frame.decisionText

    this.rawOutcome.textContent = frame.rawOutcomeText
    this.safeOutcome.textContent = frame.safeOutcomeText

    this.kpiPeakReduction.textContent = frame.peakQueueReduction.toLocaleString()
    this.kpiBreachMinutes.textContent = frame.breachMinutesAvoided.toLocaleString()
    this.kpiEscalations.textContent = frame.avoidedEscalations.toLocaleString()
  }

  renderPressureModel(pressure: number, eta: number, strictness: number): void {
    const profile = scenarioLabel(pressure)
    const patchLabel = eta < 0.95 ? 'small patch' : eta < 1.6 ? 'medium patch' : 'large patch'
    const guardrailLabel = strictness < 0.78 ? 'tight guardrails' : strictness < 1.08 ? 'standard guardrails' : 'wide guardrails'
    this.pressureDetail.textContent = `${profile}: ${patchLabel} under ${guardrailLabel}.`
  }

  private syncScenarioButtonState(): void {
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    for (let i = 0; i < this.scenarioButtons.length; i += 1) {
      const pressure = Number.parseFloat(this.scenarioButtons[i].dataset.pressure ?? '0')
      const distance = Math.abs(pressure - this.selectedPressure)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    }

    this.scenarioButtons.forEach((button, index) => {
      button.classList.toggle('active', index === closestIndex)
    })

    const snappedPressure = Number.parseFloat(this.scenarioButtons[closestIndex].dataset.pressure ?? '0.55')
    this.selectedPressure = snappedPressure
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
