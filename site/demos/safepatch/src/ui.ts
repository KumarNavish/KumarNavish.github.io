import { Halfspace, Vec2, sub } from './geometry'
import { ConstraintDiagnostic } from './qp'
import { drawLambdaDial } from './render'

export interface ControlValues {
  eta: number
  epsById: Record<string, number>
  guardrailEnabled: boolean
}

export interface ProofFrameUi {
  phaseIndex: number
  phaseCaption: string
  ship: boolean
  reason: string | null
  step0: Vec2
  stepCurrent: Vec2
  lambdas: Record<string, number>
  diagnostics: ConstraintDiagnostic[]
  violationCurrentById: Record<string, number>
  stationarityResidual: number
  descentRetainedRatio: number
  objectiveDeltaCurrent: number
  activeSetIds: string[]
  maxViolationStep0: number
  maxViolationCurrent: number
  colorById: Record<string, string>
}

interface DialElements {
  wrapper: HTMLDivElement
  canvas: HTMLCanvasElement
  value: HTMLSpanElement
  id: string
}

interface ConstraintRowElements {
  row: HTMLTableRowElement
  violation0: HTMLTableCellElement
  lambda: HTMLTableCellElement
  violationCurrent: HTMLTableCellElement
}

function formatSigned(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(digits)}`
}

function formatScientific(value: number): string {
  if (!Number.isFinite(value)) {
    return 'n/a'
  }
  if (Math.abs(value) < 1e-4) {
    return value.toExponential(2)
  }
  return value.toFixed(5)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export class UIController {
  private readonly halfspaces: Halfspace[]
  private readonly etaSlider: HTMLInputElement
  private readonly etaValue: HTMLElement
  private readonly guardrailToggle: HTMLInputElement
  private readonly shipIndicator: HTMLElement
  private readonly shipReason: HTMLElement
  private readonly phaseCaption: HTMLElement
  private readonly phaseItems: HTMLLIElement[]
  private readonly kktNumeric: HTMLElement
  private readonly metricFeasibility: HTMLElement
  private readonly metricDescent: HTMLElement
  private readonly metricStationarity: HTMLElement
  private readonly metricPractical: HTMLElement
  private readonly metricActiveSet: HTMLElement
  private readonly budgetInputs: Map<string, HTMLInputElement>
  private readonly budgetValues: Map<string, HTMLElement>
  private readonly dialElements: Map<string, DialElements>
  private readonly rowElements: Map<string, ConstraintRowElements>

  constructor(halfspaces: Halfspace[]) {
    this.halfspaces = halfspaces

    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.guardrailToggle = this.getElement<HTMLInputElement>('guardrail-toggle')
    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.phaseCaption = this.getElement('phase-caption')
    this.phaseItems = Array.from(document.querySelectorAll<HTMLLIElement>('#phase-track li'))
    this.kktNumeric = this.getElement('kkt-numeric')
    this.metricFeasibility = this.getElement('metric-feasibility')
    this.metricDescent = this.getElement('metric-descent')
    this.metricStationarity = this.getElement('metric-stationarity')
    this.metricPractical = this.getElement('metric-practical')
    this.metricActiveSet = this.getElement('metric-active-set')

    this.budgetInputs = new Map<string, HTMLInputElement>()
    this.budgetValues = new Map<string, HTMLElement>()
    for (const halfspace of halfspaces) {
      this.budgetInputs.set(halfspace.id, this.getElement<HTMLInputElement>(`eps-${halfspace.id}`))
      this.budgetValues.set(halfspace.id, this.getElement(`eps-${halfspace.id}-value`))
    }

    this.dialElements = this.createLambdaDials(halfspaces)
    this.rowElements = this.createConstraintRows(halfspaces)

    this.syncDisplayedControlValues()
    this.syncGuardrailInteractivity()
  }

  onControlsChange(callback: () => void): void {
    const listener = () => {
      this.syncDisplayedControlValues()
      this.syncGuardrailInteractivity()
      callback()
    }

    this.etaSlider.addEventListener('input', listener)
    this.guardrailToggle.addEventListener('change', listener)

    for (const input of this.budgetInputs.values()) {
      input.addEventListener('input', listener)
    }
  }

  onReplay(callback: () => void): void {
    const replayButton = this.getElement<HTMLButtonElement>('replay-button')
    replayButton.addEventListener('click', callback)
  }

  readControlValues(): ControlValues {
    const epsById: Record<string, number> = {}
    for (const halfspace of this.halfspaces) {
      const input = this.budgetInputs.get(halfspace.id)
      if (!input) {
        continue
      }
      epsById[halfspace.id] = Number.parseFloat(input.value)
    }

    return {
      eta: Number.parseFloat(this.etaSlider.value),
      epsById,
      guardrailEnabled: this.guardrailToggle.checked,
    }
  }

  renderFrame(frame: ProofFrameUi): void {
    this.phaseCaption.textContent = frame.phaseCaption
    this.updatePhaseTrack(frame.phaseIndex)

    this.shipIndicator.textContent = frame.ship ? 'SHIP' : 'HOLD'
    this.shipIndicator.classList.toggle('ship', frame.ship)
    this.shipIndicator.classList.toggle('hold', !frame.ship)
    this.shipReason.textContent = frame.ship
      ? frame.reason ?? 'Projected step satisfies all active budgets.'
      : frame.reason ?? 'Projected step could not be certified.'

    const correction = sub(frame.stepCurrent, frame.step0)
    this.kktNumeric.textContent = `Δ(t)=(${frame.stepCurrent.x.toFixed(3)}, ${frame.stepCurrent.y.toFixed(3)}) = Δ0 + c(t), c(t)=(${correction.x.toFixed(3)}, ${correction.y.toFixed(3)})`

    this.metricFeasibility.textContent = formatSigned(frame.maxViolationCurrent, 4)
    this.metricFeasibility.classList.toggle('good', frame.maxViolationCurrent <= 1e-6)
    this.metricFeasibility.classList.toggle('bad', frame.maxViolationCurrent > 1e-6)

    this.metricDescent.textContent = formatPercent(frame.descentRetainedRatio)
    this.metricDescent.classList.toggle('good', frame.descentRetainedRatio >= 0.6)
    this.metricDescent.classList.toggle('bad', frame.descentRetainedRatio < 0.6)

    this.metricStationarity.textContent = formatScientific(frame.stationarityResidual)
    this.metricStationarity.classList.toggle('good', frame.stationarityResidual <= 1e-5)
    this.metricStationarity.classList.toggle('bad', frame.stationarityResidual > 1e-5)

    const removedViolation = Math.max(0, frame.maxViolationStep0) - Math.max(0, frame.maxViolationCurrent)
    this.metricPractical.textContent = `${removedViolation >= 0 ? '+' : ''}${removedViolation.toFixed(4)}`
    this.metricPractical.classList.toggle('good', removedViolation >= -1e-6)
    this.metricPractical.classList.toggle('bad', removedViolation < -1e-6)

    const activeLabels = frame.activeSetIds
      .map((id) => this.halfspaces.find((halfspace) => halfspace.id === id)?.label ?? id)
      .join(', ')
    this.metricActiveSet.textContent = activeLabels.length > 0 ? activeLabels : 'none'

    this.renderConstraintLedger(frame)
    this.renderLambdas(frame)
  }

  private renderConstraintLedger(frame: ProofFrameUi): void {
    for (const diagnostic of frame.diagnostics) {
      const row = this.rowElements.get(diagnostic.id)
      if (!row) {
        continue
      }

      const color = frame.colorById[diagnostic.id] ?? '#64748b'
      row.row.style.setProperty('--constraint-color', color)

      if (!diagnostic.active) {
        row.row.classList.add('inactive')
        row.violation0.textContent = '—'
        row.lambda.textContent = '—'
        row.violationCurrent.textContent = '—'
        continue
      }

      row.row.classList.remove('inactive')

      const lambdaValue = frame.lambdas[diagnostic.id] ?? 0
      const violation0 = diagnostic.violationStep0
      const violationCurrent = frame.violationCurrentById[diagnostic.id] ?? 0

      row.violation0.textContent = formatSigned(violation0, 3)
      row.lambda.textContent = lambdaValue.toFixed(3)
      row.violationCurrent.textContent = formatSigned(violationCurrent, 3)

      row.row.classList.toggle('violated', violationCurrent > 1e-4)
      row.row.classList.toggle('binding', Math.abs(violationCurrent) <= 2e-3 && lambdaValue > 1e-4)
    }
  }

  private renderLambdas(frame: ProofFrameUi): void {
    const activeValues = this.halfspaces
      .filter((halfspace) => halfspace.active)
      .map((halfspace) => frame.lambdas[halfspace.id] ?? 0)
    const maxValue = Math.max(...activeValues, 0.05)

    for (const halfspace of this.halfspaces) {
      const dial = this.dialElements.get(halfspace.id)
      if (!dial) {
        continue
      }

      const enabled = halfspace.active
      const value = enabled ? frame.lambdas[halfspace.id] ?? 0 : 0

      dial.value.textContent = value.toFixed(3)
      dial.wrapper.classList.toggle('inactive', !enabled)

      drawLambdaDial(
        dial.canvas,
        value,
        maxValue,
        halfspace.label,
        enabled,
        frame.colorById[halfspace.id] ?? '#1476d8',
      )
    }
  }

  private updatePhaseTrack(activePhase: number): void {
    this.phaseItems.forEach((item, index) => {
      item.classList.toggle('active', index === activePhase)
      item.classList.toggle('done', index < activePhase)
    })
  }

  private syncDisplayedControlValues(): void {
    this.etaValue.textContent = Number.parseFloat(this.etaSlider.value).toFixed(2)

    for (const [id, input] of this.budgetInputs.entries()) {
      const value = this.budgetValues.get(id)
      if (!value) {
        continue
      }
      value.textContent = Number.parseFloat(input.value).toFixed(2)
    }
  }

  private syncGuardrailInteractivity(): void {
    const guardrailInput = this.budgetInputs.get('g4')
    const guardrailValue = this.budgetValues.get('g4')

    if (!guardrailInput || !guardrailValue) {
      return
    }

    const enabled = this.guardrailToggle.checked
    guardrailInput.disabled = !enabled
    guardrailValue.classList.toggle('disabled', !enabled)
  }

  private createLambdaDials(halfspaces: Halfspace[]): Map<string, DialElements> {
    const container = this.getElement<HTMLDivElement>('lambda-dials')
    const map = new Map<string, DialElements>()

    for (const halfspace of halfspaces) {
      const wrapper = document.createElement('div')
      wrapper.className = 'dial-card'

      const canvas = document.createElement('canvas')
      canvas.className = 'dial-canvas'

      const value = document.createElement('span')
      value.className = 'dial-value'
      value.textContent = '0.000'

      wrapper.appendChild(canvas)
      wrapper.appendChild(value)
      container.appendChild(wrapper)

      map.set(halfspace.id, {
        wrapper,
        canvas,
        value,
        id: halfspace.id,
      })
    }

    return map
  }

  private createConstraintRows(halfspaces: Halfspace[]): Map<string, ConstraintRowElements> {
    const body = this.getElement<HTMLTableSectionElement>('constraint-ledger')
    const map = new Map<string, ConstraintRowElements>()

    for (const halfspace of halfspaces) {
      const row = document.createElement('tr')

      const idCell = document.createElement('th')
      idCell.scope = 'row'
      idCell.textContent = halfspace.id

      const violation0 = document.createElement('td')
      const lambda = document.createElement('td')
      const violationCurrent = document.createElement('td')

      row.appendChild(idCell)
      row.appendChild(violation0)
      row.appendChild(lambda)
      row.appendChild(violationCurrent)

      body.appendChild(row)

      map.set(halfspace.id, {
        row,
        violation0,
        lambda,
        violationCurrent,
      })
    }

    return map
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
