import { Halfspace } from './geometry'
import { drawLambdaDial } from './render'

export interface ControlValues {
  eta: number
  epsById: Record<string, number>
  guardrailEnabled: boolean
}

interface DialElements {
  wrapper: HTMLDivElement
  canvas: HTMLCanvasElement
  value: HTMLSpanElement
  id: string
}

export class UIController {
  private readonly etaSlider: HTMLInputElement
  private readonly etaValue: HTMLElement
  private readonly guardrailToggle: HTMLInputElement
  private readonly shipIndicator: HTMLElement
  private readonly holdReason: HTMLElement
  private readonly objectiveDeltaValue: HTMLElement
  private readonly activeSetValue: HTMLElement
  private readonly budgetInputs: Map<string, HTMLInputElement>
  private readonly budgetValues: Map<string, HTMLElement>
  private readonly dialElements: Map<string, DialElements>
  private readonly halfspaces: Halfspace[]

  constructor(halfspaces: Halfspace[]) {
    this.halfspaces = halfspaces

    this.etaSlider = this.getElement<HTMLInputElement>('eta-slider')
    this.etaValue = this.getElement('eta-value')
    this.guardrailToggle = this.getElement<HTMLInputElement>('guardrail-toggle')
    this.shipIndicator = this.getElement('ship-indicator')
    this.holdReason = this.getElement('hold-reason')
    this.objectiveDeltaValue = this.getElement('objective-delta')
    this.activeSetValue = this.getElement('active-set')

    this.budgetInputs = new Map<string, HTMLInputElement>()
    this.budgetValues = new Map<string, HTMLElement>()

    for (const halfspace of halfspaces) {
      this.budgetInputs.set(halfspace.id, this.getElement<HTMLInputElement>(`eps-${halfspace.id}`))
      this.budgetValues.set(halfspace.id, this.getElement(`eps-${halfspace.id}-value`))
    }

    this.dialElements = this.createLambdaDials(halfspaces)
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

  renderLambdas(lambdaById: Record<string, number>, halfspaces: Halfspace[]): void {
    const activeValues = halfspaces
      .filter((halfspace) => halfspace.active)
      .map((halfspace) => lambdaById[halfspace.id] ?? 0)
    const maxValue = Math.max(...activeValues, 0.05)

    for (const halfspace of halfspaces) {
      const dial = this.dialElements.get(halfspace.id)
      if (!dial) {
        continue
      }

      const value = lambdaById[halfspace.id] ?? 0
      dial.value.textContent = value.toFixed(3)
      dial.wrapper.classList.toggle('inactive', !halfspace.active)
      drawLambdaDial(dial.canvas, value, maxValue, halfspace.label, halfspace.active)
    }
  }

  setShipState(ship: boolean, reason: string | null): void {
    this.shipIndicator.textContent = ship ? 'SHIP' : 'HOLD'
    this.shipIndicator.classList.toggle('ship', ship)
    this.shipIndicator.classList.toggle('hold', !ship)
    this.holdReason.textContent = ship ? 'Projected step is feasible under active guardrails.' : reason ?? 'Could not certify this step.'
  }

  setObjectiveDelta(delta: number): void {
    const sign = delta <= 1e-9 ? 'improved' : 'worse'
    const formatted = `${delta >= 0 ? '+' : ''}${delta.toFixed(4)}`
    this.objectiveDeltaValue.textContent = `${formatted} (${sign})`
    this.objectiveDeltaValue.classList.toggle('good', delta <= 1e-9)
    this.objectiveDeltaValue.classList.toggle('bad', delta > 1e-9)
  }

  setActiveSet(activeSetIds: string[]): void {
    if (activeSetIds.length === 0) {
      this.activeSetValue.textContent = 'none'
      return
    }

    const labels = activeSetIds
      .map((id) => this.halfspaces.find((halfspace) => halfspace.id === id)?.label ?? id)
      .join(', ')

    this.activeSetValue.textContent = labels
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
    const guardrailEnabled = this.guardrailToggle.checked
    const guardrailInput = this.budgetInputs.get('g4')
    const guardrailValue = this.budgetValues.get('g4')
    if (!guardrailInput || !guardrailValue) {
      return
    }

    guardrailInput.disabled = !guardrailEnabled
    guardrailValue.classList.toggle('disabled', !guardrailEnabled)
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

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing UI element #${id}`)
    }

    return element as T
  }
}
