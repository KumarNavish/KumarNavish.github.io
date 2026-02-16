import { Link } from 'react-router-dom'

import { getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcBridge({ current }: { current: ArcStepId }) {
  const { current: currentStep, next } = getArcNeighbors(current)

  return (
    <section className="panel arc-bridge-panel" aria-label="Narrative handoff">
      <header className="panel-header">
        <h2>{next ? `Transition to ${next.label}` : 'Close the Arc'}</h2>
      </header>
      <p className="arc-bridge-lead">{currentStep.handoff}</p>
      <p className="meta-line">
        {next
          ? `Next question: ${next.readerQuestion}`
          : 'Return to motivation and review the full arc as one integrated system.'}
      </p>
      <div className="action-row">
        <Link className="action-link action-link-primary" to={next ? next.route : '/'}>
          {next ? `Continue to ${next.label}` : 'Return to Motivation'}
        </Link>
      </div>
    </section>
  )
}
