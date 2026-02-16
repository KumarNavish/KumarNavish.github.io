import { Link } from 'react-router-dom'

import { ARC_STEPS, getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcSpine({ current }: { current: ArcStepId }) {
  const { previous, current: currentStep, next } = getArcNeighbors(current)
  const context = previous
    ? `${previous.label} set the context. ${currentStep.label} turns it into action.`
    : 'This is the anchor for the full narrative.'

  return (
    <section className="panel arc-spine-panel" aria-label="Narrative spine">
      <p className="matrix-label">Narrative Arc</p>
      <ol className="arc-spine-track">
        {ARC_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={step.id === current ? 'arc-spine-item arc-spine-item-active' : 'arc-spine-item'}
          >
            <Link to={step.route} className="arc-spine-link">
              <span className="arc-spine-index">{index + 1}</span>
              <span>{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="arc-spine-summary">
        <strong>{currentStep.readerQuestion}</strong> {currentStep.purpose} {context}
      </p>
      <Link className="action-link action-link-primary arc-spine-next-link" to={next ? next.route : '/'}>
        {next ? `Continue to ${next.label}` : 'Return to Motivation'}
      </Link>
    </section>
  )
}
