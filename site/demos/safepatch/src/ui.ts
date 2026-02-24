import katex from 'katex'

const sliderMax = 100

export interface ControlValues {
  pressure: number
  urgency: number
  strictness: number
}

export interface ProofFrameUi {
  decisionTone: 'ship' | 'hold'
  decisionTitle: string
  decisionDetail: string
  problemText: string
  mechanismText: string
  impactText: string
  peakValueText: string
  breachValueText: string
  escalationValueText: string
  guardrailValueText: string
  retainedValueText: string
}

export class UIController {
  private readonly scenarioButtons: HTMLButtonElement[]
  private readonly urgencySlider: HTMLInputElement
  private readonly strictnessSlider: HTMLInputElement

  private readonly urgencyValue: HTMLElement
  private readonly strictnessValue: HTMLElement

  private readonly decisionPanel: HTMLElement
  private readonly decisionPill: HTMLElement
  private readonly decisionTitle: HTMLElement
  private readonly decisionDetail: HTMLElement
  private readonly problemLine: HTMLElement
  private readonly mechanismLine: HTMLElement
  private readonly impactLine: HTMLElement
  private readonly kpiPeakValue: HTMLElement
  private readonly kpiBreachValue: HTMLElement
  private readonly kpiEscalationsValue: HTMLElement
  private readonly guardrailValue: HTMLElement
  private readonly retainedValue: HTMLElement

  private selectedPressure = 0.56
  private selectedUrgency = 0.58
  private selectedStrictness = 0.62

  constructor() {
    this.decisionPanel = this.getElement('decision-panel')
    this.decisionPill = this.getElement('decision-pill')
    this.decisionTitle = this.getElement('decision-title')
    this.decisionDetail = this.getElement('decision-detail')
    this.problemLine = this.getElement('problem-statement')
    this.mechanismLine = this.getElement('mechanism-statement')
    this.impactLine = this.getElement('impact-statement')
    this.kpiPeakValue = this.getElement('kpi-peak-value')
    this.kpiBreachValue = this.getElement('kpi-breach-value')
    this.kpiEscalationsValue = this.getElement('kpi-escalations-value')
    this.guardrailValue = this.getElement('guardrail-value')
    this.retainedValue = this.getElement('retained-value')

    this.urgencySlider = this.getElement<HTMLInputElement>('urgency-slider')
    this.strictnessSlider = this.getElement<HTMLInputElement>('strictness-slider')
    this.urgencyValue = this.getElement('urgency-value')
    this.strictnessValue = this.getElement('strictness-value')

    this.scenarioButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.scenario-btn'))
    if (this.scenarioButtons.length === 0) {
      throw new Error('Missing .scenario-btn controls')
    }

    const activeButton =
      this.scenarioButtons.find((button) => button.classList.contains('active')) ?? this.scenarioButtons[0]
    this.selectedPressure = Number.parseFloat(activeButton.dataset.pressure ?? '0.56')
    this.selectedUrgency = this.parseSliderValue(this.urgencySlider.value, 0.58)
    this.selectedStrictness = this.parseSliderValue(this.strictnessSlider.value, 0.62)

    this.renderMathBlocks()
    this.syncScenarioButtonState()
    this.syncSliderValues()
  }

  onControlsChange(callback: () => void): void {
    for (const button of this.scenarioButtons) {
      button.addEventListener('click', () => {
        const pressure = Number.parseFloat(button.dataset.pressure ?? '0.56')
        if (!Number.isFinite(pressure)) {
          return
        }
        this.selectedPressure = pressure
        this.syncScenarioButtonState()
        callback()
      })
    }

    const onSliderInput = () => {
      this.selectedUrgency = this.parseSliderValue(this.urgencySlider.value, this.selectedUrgency)
      this.selectedStrictness = this.parseSliderValue(this.strictnessSlider.value, this.selectedStrictness)
      this.syncSliderValues()
      callback()
    }

    this.urgencySlider.addEventListener('input', onSliderInput)
    this.strictnessSlider.addEventListener('input', onSliderInput)
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
    if (typeof values.urgency === 'number' && Number.isFinite(values.urgency)) {
      this.selectedUrgency = values.urgency
    }
    if (typeof values.strictness === 'number' && Number.isFinite(values.strictness)) {
      this.selectedStrictness = values.strictness
    }
    this.syncSliderValues()
  }

  readControlValues(): ControlValues {
    return {
      pressure: this.selectedPressure,
      urgency: this.selectedUrgency,
      strictness: this.selectedStrictness,
    }
  }

  renderFrame(frame: ProofFrameUi): void {
    this.decisionPanel.classList.toggle('ship', frame.decisionTone === 'ship')
    this.decisionPanel.classList.toggle('hold', frame.decisionTone === 'hold')
    this.decisionPill.classList.toggle('ship', frame.decisionTone === 'ship')
    this.decisionPill.classList.toggle('hold', frame.decisionTone === 'hold')
    this.decisionPill.textContent = frame.decisionTone === 'ship' ? 'SHIP WITH SAFEPATCH' : 'HOLD DEPLOYMENT'

    this.decisionTitle.textContent = frame.decisionTitle
    this.decisionDetail.textContent = frame.decisionDetail
    this.problemLine.textContent = frame.problemText
    this.mechanismLine.textContent = frame.mechanismText
    this.impactLine.textContent = frame.impactText
    this.kpiPeakValue.textContent = frame.peakValueText
    this.kpiBreachValue.textContent = frame.breachValueText
    this.kpiEscalationsValue.textContent = frame.escalationValueText
    this.guardrailValue.textContent = frame.guardrailValueText
    this.retainedValue.textContent = frame.retainedValueText
  }

  private renderMathBlocks(): void {
    const equationRaw = this.getElement('equation-raw')
    const equationQp = this.getElement('equation-qp')

    equationRaw.innerHTML = katex.renderToString(String.raw`\Delta_{0} = -\eta g_{\mathrm{new}}`, {
      displayMode: true,
      throwOnError: false,
      output: 'html',
    })

    equationQp.innerHTML = katex.renderToString(
      String.raw`\begin{aligned}
\Delta^\star &= \arg\min_{\Delta}\ \langle g_{\mathrm{new}}, \Delta \rangle + \frac{\lVert \Delta \rVert_2^2}{2\eta}\\
\text{s.t.}\ &\langle n_k, \Delta \rangle \le \varepsilon_k
\end{aligned}`,
      {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      },
    )
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

    this.selectedPressure = Number.parseFloat(this.scenarioButtons[closestIndex].dataset.pressure ?? '0.56')
  }

  private syncSliderValues(): void {
    this.selectedUrgency = this.clamp01(this.selectedUrgency)
    this.selectedStrictness = this.clamp01(this.selectedStrictness)

    this.urgencySlider.value = Math.round(this.selectedUrgency * sliderMax).toString()
    this.strictnessSlider.value = Math.round(this.selectedStrictness * sliderMax).toString()

    this.urgencyValue.textContent = `${Math.round(this.selectedUrgency * 100)}%`
    this.strictnessValue.textContent = `${Math.round(this.selectedStrictness * 100)}%`
  }

  private parseSliderValue(raw: string, fallback: number): number {
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) {
      return fallback
    }
    return this.clamp01(parsed / sliderMax)
  }

  private clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1)
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }
    return element as T
  }
}
