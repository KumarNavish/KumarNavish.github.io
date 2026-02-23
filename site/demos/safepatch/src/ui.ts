import katex from 'katex'
import { Halfspace, Vec2, dot, norm } from './geometry'

export interface ControlValues {
  eta: number
  epsById: Record<string, number>
  guardrailEnabled: boolean
}

export interface ProofFrameUi {
  ship: boolean
  reason: string | null
  story: string
  rawStep: Vec2
  safeStep: Vec2
  lambdas: Record<string, number>
  maxViolationRaw: number
  maxViolationSafe: number
  descentRetainedRatio: number
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

function positivePart(value: number): number {
  return Math.max(0, value)
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
  private readonly kktNumeric: HTMLElement
  private readonly liveEquation: HTMLElement
  private readonly metricRawViolation: HTMLElement
  private readonly metricSafeViolation: HTMLElement
  private readonly metricRetained: HTMLElement
  private readonly metricAngle: HTMLElement
  private readonly budgetInputs: Map<string, HTMLInputElement>
  private readonly budgetValues: Map<string, HTMLElement>
  private readonly lambdaRows: Map<string, LambdaRow>
  private lastLiveEquation = ''

  constructor(halfspaces: Halfspace[]) {
    this.halfspaces = halfspaces

    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.guardrailToggle = this.getElement<HTMLInputElement>('guardrail-toggle')

    this.shipIndicator = this.getElement('ship-indicator')
    this.shipReason = this.getElement('ship-reason')
    this.phaseCaption = this.getElement('phase-caption')
    this.kktNumeric = this.getElement('kkt-numeric')
    this.liveEquation = this.getElement('live-equation')

    this.metricRawViolation = this.getElement('metric-raw-violation')
    this.metricSafeViolation = this.getElement('metric-safe-violation')
    this.metricRetained = this.getElement('metric-retained')
    this.metricAngle = this.getElement('metric-angle')

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
    this.shipIndicator.textContent = frame.ship ? 'SHIP' : 'HOLD'
    this.shipIndicator.classList.toggle('ship', frame.ship)
    this.shipIndicator.classList.toggle('hold', !frame.ship)

    this.shipReason.textContent = frame.reason ?? 'No feasible projected update.'
    this.phaseCaption.textContent = frame.story

    this.metricRawViolation.textContent = `+${positivePart(frame.maxViolationRaw).toFixed(3)}`
    this.metricRawViolation.classList.add('bad')

    this.metricSafeViolation.textContent = `+${positivePart(frame.maxViolationSafe).toFixed(3)}`
    this.metricSafeViolation.classList.toggle('good', positivePart(frame.maxViolationSafe) <= 1e-6)
    this.metricSafeViolation.classList.toggle('bad', positivePart(frame.maxViolationSafe) > 1e-6)

    this.metricRetained.textContent = formatPercent(frame.descentRetainedRatio)
    this.metricRetained.classList.toggle('good', frame.descentRetainedRatio >= 0.55)
    this.metricRetained.classList.toggle('bad', frame.descentRetainedRatio < 0.55)

    const angle = angleBetweenDegrees(frame.rawStep, frame.safeStep)
    this.metricAngle.textContent = `${angle.toFixed(1)}°`

    this.kktNumeric.textContent = `Raw Δ0 = (${frame.rawStep.x.toFixed(3)}, ${frame.rawStep.y.toFixed(3)}) · Safe Δ* = (${frame.safeStep.x.toFixed(3)}, ${frame.safeStep.y.toFixed(3)})`

    this.renderLiveEquation(frame)
    this.renderLambdas(frame)
  }

  private renderLiveEquation(frame: ProofFrameUi): void {
    const expression = this.liveDecomposition(frame.lambdas)
    if (expression === this.lastLiveEquation) {
      return
    }

    this.lastLiveEquation = expression

    try {
      katex.render(expression, this.liveEquation, {
        throwOnError: true,
        displayMode: true,
        strict: 'warn',
      })
    } catch {
      this.liveEquation.textContent = expression
    }
  }

  private liveDecomposition(lambdas: Record<string, number>): string {
    const activeTerms = this.halfspaces
      .filter((halfspace) => halfspace.active)
      .map((halfspace) => ({
        id: halfspace.id,
        lambda: lambdas[halfspace.id] ?? 0,
      }))
      .filter((entry) => entry.lambda > 1e-4)
      .sort((a, b) => b.lambda - a.lambda)
      .map((entry) => {
        const index = entry.id.replace('g', '')
        return `${entry.lambda.toFixed(2)}\\cdot g_{${index}}`
      })

    if (activeTerms.length === 0) {
      return String.raw`\Delta^*=\Delta_0`
    }

    return String.raw`\Delta^*=\Delta_0-\eta\left(${activeTerms.join(' + ')}\right)`
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
