import { Link } from 'react-router-dom'

import { ARC_STEPS, getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcSpine({ current }: { current: ArcStepId }) {
  const { previous, current: currentStep, next } = getArcNeighbors(current)

  return (
    <section className="panel arc-spine-panel" aria-label="Narrative spine">
      <header className="panel-header">
        <h2>Narrative Spine</h2>
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
          <p className="matrix-label">Context from previous layer</p>
          <p>
            {previous
              ? `${previous.label}: ${previous.purpose}`
              : 'Starting point: define why reliable decisions matter before choosing methods.'}
          </p>
        </article>

        <article className="arc-spine-card">
          <p className="matrix-label">Question answered here</p>
          <p>{currentStep.readerQuestion}</p>
          <p className="meta-line">{currentStep.purpose}</p>
          <p className="meta-line">{currentStep.evidence}</p>
        </article>

        <article className="arc-spine-card">
          <p className="matrix-label">Question raised next</p>
          <p>{next ? next.readerQuestion : 'How does the full arc read as one system?'}</p>
          <p className="meta-line">{currentStep.handoff}</p>
          <Link className="builder-inline-link" to={next ? next.route : '/'}>
            {next ? `Continue to ${next.label}` : 'Return to Motivation'}
          </Link>
        </article>
      </div>
    </section>
  )
}
