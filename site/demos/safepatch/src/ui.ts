export interface ControlValues {
  pressure: number
}

export interface ProofFrameUi {
  recommendationText: string
  peakValueText: string
  breachValueText: string
  escalationValueText: string
}

export class UIController {
  private readonly recommendationLine: HTMLElement
  private readonly kpiPeakValue: HTMLElement
  private readonly kpiBreachValue: HTMLElement
  private readonly kpiEscalationsValue: HTMLElement

  private readonly scenarioButtons: HTMLButtonElement[]
  private selectedPressure = 0.55

  constructor() {
    this.recommendationLine = this.getElement('recommendation-line')
    this.kpiPeakValue = this.getElement('kpi-peak-value')
    this.kpiBreachValue = this.getElement('kpi-breach-value')
    this.kpiEscalationsValue = this.getElement('kpi-escalations-value')

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
    return { pressure: this.selectedPressure }
  }

  renderFrame(frame: ProofFrameUi): void {
    this.recommendationLine.textContent = frame.recommendationText
    this.kpiPeakValue.textContent = frame.peakValueText
    this.kpiBreachValue.textContent = frame.breachValueText
    this.kpiEscalationsValue.textContent = frame.escalationValueText
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
