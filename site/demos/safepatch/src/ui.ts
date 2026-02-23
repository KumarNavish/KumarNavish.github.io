import { Halfspace, Vec2, dot, norm } from './geometry'

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
  maxViolationStep0: number
  maxViolationCurrent: number
  activeSetIds: string[]
  colorById: Record<string, string>
}

interface LambdaRow {
  row: HTMLDivElement
  label: HTMLSpanElement
  value: HTMLSpanElement
  fill: HTMLDivElement
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function angleBetweenDegrees(a: Vec2, b: Vec2): number {
  const na = norm(a)
  const nb = norm(b)
  if (na <= 1e-8 || nb <= 1e-8) {
    return 0
  }

  const cosine = clamp(dot(a, b) / (na * nb), -1, 1)
  return (Math.acos(cosine) * 180) / Math.PI
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
  private readonly metricAngle: HTMLElement
  private readonly metricViolation: HTMLElement
  private readonly metricActiveSet: HTMLElement
  private readonly budgetInputs: Map<string, HTMLInputElement>
  private readonly budgetValues: Map<string, HTMLElement>
  private readonly lambdaRows: Map<string, LambdaRow>

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
    this.metricAngle = this.getElement('metric-angle')
    this.metricViolation = this.getElement('metric-violation')
    this.metricActiveSet = this.getElement('metric-active-set')

    this.budgetInputs = new Map<string, HTMLInputElement>()
    this.budgetValues = new Map<string, HTMLElement>()
    for (const halfspace of halfspaces) {
      this.budgetInputs.set(halfspace.id, this.getElement<HTMLInputElement>(`eps-${halfspace.id}`))
      this.budgetValues.set(halfspace.id, this.getElement(`eps-${halfspace.id}-value`))
    }

    this.lambdaRows = this.createLambdaRows(halfspaces)

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
      ? frame.reason ?? 'Projected step remains inside all active guardrails.'
      : frame.reason ?? 'No feasible projected step under current budgets.'

    const angle = angleBetweenDegrees(frame.step0, frame.stepCurrent)
    this.metricAngle.textContent = `${angle.toFixed(1)}°`

    const removedViolation = Math.max(0, frame.maxViolationStep0) - Math.max(0, frame.maxViolationCurrent)
    this.metricViolation.textContent = `${removedViolation >= 0 ? '+' : ''}${removedViolation.toFixed(3)}`
    this.metricViolation.classList.toggle('good', removedViolation >= -1e-6)
    this.metricViolation.classList.toggle('bad', removedViolation < -1e-6)

    this.metricActiveSet.textContent = frame.activeSetIds.length > 0 ? frame.activeSetIds.join(', ') : 'none'

    this.kktNumeric.textContent = `Δ(t) = (${frame.stepCurrent.x.toFixed(3)}, ${frame.stepCurrent.y.toFixed(3)}) | max v(t) = ${frame.maxViolationCurrent.toFixed(4)}`

    this.renderLambdas(frame)
  }

  private renderLambdas(frame: ProofFrameUi): void {
    const activeHalfspaces = this.halfspaces.filter((halfspace) => halfspace.active)
    const maxLambda = Math.max(0.05, ...activeHalfspaces.map((halfspace) => frame.lambdas[halfspace.id] ?? 0))

    for (const halfspace of this.halfspaces) {
      const row = this.lambdaRows.get(halfspace.id)
      if (!row) {
        continue
      }

      const enabled = halfspace.active
      const value = enabled ? frame.lambdas[halfspace.id] ?? 0 : 0

      row.row.classList.toggle('inactive', !enabled)
      row.label.textContent = halfspace.id
      row.value.textContent = enabled ? value.toFixed(3) : '—'
      row.fill.style.setProperty('--bar-color', frame.colorById[halfspace.id] ?? '#2563eb')
      row.fill.style.width = enabled ? `${Math.min(100, (value / maxLambda) * 100)}%` : '0%'
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

  private createLambdaRows(halfspaces: Halfspace[]): Map<string, LambdaRow> {
    const container = this.getElement<HTMLDivElement>('lambda-bars')
    const rows = new Map<string, LambdaRow>()

    for (const halfspace of halfspaces) {
      const row = document.createElement('div')
      row.className = 'lambda-row'

      const head = document.createElement('div')
      head.className = 'lambda-head'

      const label = document.createElement('span')
      label.textContent = halfspace.id

      const value = document.createElement('span')
      value.textContent = '0.000'

      head.appendChild(label)
      head.appendChild(value)

      const track = document.createElement('div')
      track.className = 'lambda-track'

      const fill = document.createElement('div')
      fill.className = 'lambda-fill'
      track.appendChild(fill)

      row.appendChild(head)
      row.appendChild(track)
      container.appendChild(row)

      rows.set(halfspace.id, {
        row,
        label,
        value,
        fill,
      })
    }

    return rows
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
