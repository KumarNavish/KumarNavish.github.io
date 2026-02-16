import { Link } from 'react-router-dom'

import { ARC_STEPS, getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcSpine({ current }: { current: ArcStepId }) {
  const { previous, current: currentStep, next } = getArcNeighbors(current)
  const context = previous
    ? `Built on ${previous.label.toLowerCase()}: ${previous.purpose}`
    : 'Starting point: define the practical decision pressure first.'

  return (
    <section className="panel arc-spine-panel" aria-label="Narrative spine">
      <header className="panel-header">
        <h2>Where This Page Sits In The Arc</h2>
      </header>

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

      <div className="arc-spine-grid">
        <article className="arc-spine-card">
          <p className="matrix-label">This page answers</p>
          <h3>{currentStep.readerQuestion}</h3>
          <p className="meta-line">{currentStep.purpose}</p>
          <p className="meta-line">{currentStep.evidence}</p>
          <p className="meta-line">{context}</p>
        </article>

        <article className="arc-spine-card">
          <p className="matrix-label">Next question</p>
          <h3>{next ? next.readerQuestion : 'How does the full arc read as one system?'}</h3>
          <p className="meta-line">{currentStep.handoff}</p>
          <Link className="action-link action-link-primary" to={next ? next.route : '/'}>
            {next ? `Continue to ${next.label}` : 'Return to Motivation'}
          </Link>
        </article>
      </div>
    </section>
  )
}
