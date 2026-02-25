import katex from 'katex'

const sliderMax = 100
const copyResetDelayMs = 1400

type StrategyId = 'raw' | 'safe' | 'hold'

export interface ControlValues {
  pressure: number
  urgency: number
  strictness: number
}

export interface StrategyRowUi {
  id: StrategyId
  guardrailsText: string
  peakText: string
  breachText: string
  escalationsText: string
  scoreText: string
  statusText: string
  recommended: boolean
}

export interface ProofFrameUi {
  decisionTone: 'ship' | 'hold'
  decisionTitle: string
  decisionDetail: string
  readinessScoreText: string
  readinessNote: string
  recommendedControlsText: string
  guardrailValueText: string
  retainedValueText: string
  strategyCaption: string
  strategyRows: StrategyRowUi[]
  whyItems: string[]
  gateItems: string[]
  actionItems: string[]
  memoText: string
}

interface StrategyRowElements {
  row: HTMLTableRowElement
  guardrails: HTMLElement
  peak: HTMLElement
  breach: HTMLElement
  escalations: HTMLElement
  score: HTMLElement
  status: HTMLElement
}

export class UIController {
  private readonly scenarioButtons: HTMLButtonElement[]
  private readonly scenarioNote: HTMLElement | null
  private readonly urgencyNote: HTMLElement | null
  private readonly strictnessNote: HTMLElement | null
  private readonly urgencySlider: HTMLInputElement
  private readonly strictnessSlider: HTMLInputElement

  private readonly urgencyValue: HTMLElement
  private readonly strictnessValue: HTMLElement

  private readonly decisionPanel: HTMLElement
  private readonly decisionPill: HTMLElement
  private readonly decisionTitle: HTMLElement
  private readonly decisionDetail: HTMLElement
  private readonly readinessScore: HTMLElement
  private readonly readinessNote: HTMLElement

  private readonly strategyCaption: HTMLElement
  private readonly whyList: HTMLUListElement
  private readonly gateList: HTMLUListElement

  private readonly guardrailValue: HTMLElement
  private readonly retainedValue: HTMLElement
  private readonly recommendedControls: HTMLElement
  private readonly actionList: HTMLUListElement
  private readonly memoText: HTMLElement

  private readonly autoTuneButton: HTMLButtonElement
  private readonly resetButton: HTMLButtonElement
  private readonly replayButton: HTMLButtonElement
  private readonly copyMemoButton: HTMLButtonElement

  private readonly strategyRows: Record<StrategyId, StrategyRowElements>

  private selectedPressure = 0.56
  private selectedUrgency = 0.58
  private selectedStrictness = 0.62
  private lastDecisionTone: 'ship' | 'hold' | null = null

  constructor() {
    this.decisionPanel = this.getElement('decision-panel')
    this.decisionPill = this.getElement('decision-pill')
    this.decisionTitle = this.getElement('decision-title')
    this.decisionDetail = this.getElement('decision-detail')
    this.readinessScore = this.getElement('readiness-score')
    this.readinessNote = this.getElement('readiness-note')

    this.strategyCaption = this.getElement('strategy-caption')
    this.whyList = this.getElement<HTMLUListElement>('why-list')
    this.gateList = this.getElement<HTMLUListElement>('gate-list')

    this.guardrailValue = this.getElement('guardrail-value')
    this.retainedValue = this.getElement('retained-value')
    this.recommendedControls = this.getElement('recommended-controls')
    this.actionList = this.getElement<HTMLUListElement>('action-list')
    this.memoText = this.getElement('memo-text')

    this.scenarioNote = document.getElementById('scenario-note')
    this.urgencyNote = document.getElementById('urgency-note')
    this.strictnessNote = document.getElementById('strictness-note')

    this.urgencySlider = this.getElement<HTMLInputElement>('urgency-slider')
    this.strictnessSlider = this.getElement<HTMLInputElement>('strictness-slider')
    this.urgencyValue = this.getElement('urgency-value')
    this.strictnessValue = this.getElement('strictness-value')

    this.autoTuneButton = this.getElement<HTMLButtonElement>('autotune-button')
    this.resetButton = this.getElement<HTMLButtonElement>('reset-button')
    this.replayButton = this.getElement<HTMLButtonElement>('replay-button')
    this.copyMemoButton = this.getElement<HTMLButtonElement>('copy-memo-button')

    this.strategyRows = {
      raw: this.getStrategyRowElements('raw'),
      safe: this.getStrategyRowElements('safe'),
      hold: this.getStrategyRowElements('hold'),
    }

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

  onAutoTune(callback: () => void): void {
    this.autoTuneButton.addEventListener('click', callback)
  }

  onReset(callback: () => void): void {
    this.resetButton.addEventListener('click', callback)
  }

  onReplay(callback: () => void): void {
    this.replayButton.addEventListener('click', callback)
  }

  onCopyMemo(callback: (memoText: string) => Promise<boolean> | boolean): void {
    this.copyMemoButton.addEventListener('click', async () => {
      const memo = this.memoText.textContent ?? ''
      const copied = await callback(memo)
      this.copyMemoButton.textContent = copied ? 'Copied' : 'Copy failed'
      window.setTimeout(() => {
        this.copyMemoButton.textContent = 'Copy memo'
      }, copyResetDelayMs)
    })
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
    const toneChanged = this.lastDecisionTone !== frame.decisionTone

    this.decisionPanel.classList.toggle('ship', frame.decisionTone === 'ship')
    this.decisionPanel.classList.toggle('hold', frame.decisionTone === 'hold')
    this.decisionPill.classList.toggle('ship', frame.decisionTone === 'ship')
    this.decisionPill.classList.toggle('hold', frame.decisionTone === 'hold')
    this.decisionPill.textContent = frame.decisionTone === 'ship' ? 'READY TO SHIP' : 'HOLD DEPLOYMENT'

    this.decisionTitle.textContent = frame.decisionTitle
    this.decisionDetail.textContent = frame.decisionDetail
    this.readinessScore.textContent = frame.readinessScoreText
    this.readinessNote.textContent = frame.readinessNote

    this.strategyCaption.textContent = frame.strategyCaption
    this.recommendedControls.textContent = frame.recommendedControlsText
    this.guardrailValue.textContent = frame.guardrailValueText
    this.retainedValue.textContent = frame.retainedValueText
    this.memoText.textContent = frame.memoText

    this.renderStrategyRows(frame.strategyRows)
    this.renderList(this.whyList, frame.whyItems, 'Recommendation rationale is loading.')
    this.renderList(this.gateList, frame.gateItems, 'Rollout plan is loading.')
    this.renderList(this.actionList, frame.actionItems, 'No execution actions available for this state.')

    if (toneChanged) {
      this.flash(this.decisionPanel)
    }
    this.lastDecisionTone = frame.decisionTone
  }

  private renderStrategyRows(rows: StrategyRowUi[]): void {
    for (const row of rows) {
      const elements = this.strategyRows[row.id]
      elements.row.classList.toggle('recommended', row.recommended)
      elements.guardrails.textContent = row.guardrailsText
      elements.peak.textContent = row.peakText
      elements.breach.textContent = row.breachText
      elements.escalations.textContent = row.escalationsText
      elements.score.textContent = row.scoreText
      elements.status.textContent = row.statusText
    }
  }

  private renderList(target: HTMLUListElement, items: string[], fallback: string): void {
    const lines = items.length > 0 ? items.slice(0, 4) : [fallback]
    const nodes = lines.map((item) => {
      const line = document.createElement('li')
      line.textContent = item
      return line
    })
    target.replaceChildren(...nodes)
  }

  private renderMathBlocks(): void {
    const equationRaw = this.getElement('equation-raw')
    const equationQp = this.getElement('equation-qp')

    equationRaw.innerHTML = katex.renderToString(String.raw`\Delta_0 = -\eta\,g_{\text{new}}`, {
      displayMode: true,
      throwOnError: false,
      output: 'html',
    })

    equationQp.innerHTML = katex.renderToString(
      String.raw`\Delta^\star = \operatorname{proj}_{\mathcal{C}}(\Delta_0),\quad \mathcal{C}=\{\Delta\mid n_k^\top\Delta\le\varepsilon_k\}`,
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
      button.setAttribute('aria-pressed', index === closestIndex ? 'true' : 'false')
    })

    this.selectedPressure = Number.parseFloat(this.scenarioButtons[closestIndex].dataset.pressure ?? '0.56')
    if (this.scenarioNote) {
      this.scenarioNote.textContent = this.describeScenario(this.selectedPressure)
    }
  }

  private syncSliderValues(): void {
    this.selectedUrgency = this.clamp01(this.selectedUrgency)
    this.selectedStrictness = this.clamp01(this.selectedStrictness)

    this.urgencySlider.value = Math.round(this.selectedUrgency * sliderMax).toString()
    this.strictnessSlider.value = Math.round(this.selectedStrictness * sliderMax).toString()

    this.urgencyValue.textContent = `${Math.round(this.selectedUrgency * 100)}%`
    this.strictnessValue.textContent = `${Math.round(this.selectedStrictness * 100)}%`

    if (this.urgencyNote) {
      this.urgencyNote.textContent = this.describeUrgency(this.selectedUrgency)
    }
    if (this.strictnessNote) {
      this.strictnessNote.textContent = this.describeStrictness(this.selectedStrictness)
    }
  }

  private getStrategyRowElements(id: StrategyId): StrategyRowElements {
    return {
      row: this.getElement<HTMLTableRowElement>(`strategy-row-${id}`),
      guardrails: this.getElement(`${id}-guardrails`),
      peak: this.getElement(`${id}-peak`),
      breach: this.getElement(`${id}-breach`),
      escalations: this.getElement(`${id}-escalations`),
      score: this.getElement(`${id}-score`),
      status: this.getElement(`${id}-status`),
    }
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

  private describeScenario(pressure: number): string {
    if (pressure < 0.38) {
      return 'Normal traffic: low queue pressure and lower immediate safety risk.'
    }
    if (pressure < 0.75) {
      return 'Traffic spike: queue pressure is meaningful but still manageable.'
    }
    return 'Incident traffic: severe pressure where unsafe patches trigger escalations quickly.'
  }

  private describeUrgency(urgency: number): string {
    if (urgency < 0.34) {
      return 'Low urgency: stronger correction can be applied for safety.'
    }
    if (urgency < 0.67) {
      return 'Balanced urgency: keep quality while correcting risk.'
    }
    return 'Critical urgency: correction must prevent risky over-shoot.'
  }

  private describeStrictness(strictness: number): string {
    if (strictness < 0.34) {
      return 'Relaxed policy: easier to keep quality, less conservative on risk.'
    }
    if (strictness < 0.67) {
      return 'Moderate strictness: core guardrails remain active.'
    }
    return 'High strictness: limits are tight, so some gain may be traded for safety.'
  }

  private flash(element: HTMLElement): void {
    element.classList.remove('flash')
    void element.offsetWidth
    element.classList.add('flash')
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }
    return element as T
  }
}
