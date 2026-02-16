import { Link } from 'react-router-dom'

import { getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcNarrative({ current }: { current: ArcStepId }) {
  const { previous, current: currentStep, next } = getArcNeighbors(current)

  return (
    <section className="panel arc-context-panel" aria-label="Arc context">
      <header className="panel-header">
        <h2>Narrative Backbone</h2>
      </header>

      <div className="arc-context-grid">
        <article className="arc-context-card">
          <p className="matrix-label">Reader question</p>
          <p>{currentStep.readerQuestion}</p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">Context carried forward</p>
          <p>
            {previous
              ? previous.handoff
              : 'This page sets the direction for the full portfolio arc.'}
          </p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">What this layer demonstrates</p>
          <p>{currentStep.purpose}</p>
          <p className="meta-line">{currentStep.evidence}</p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">Next move</p>
          <p>
            {next ? (
              <>
                {currentStep.handoff}{' '}
                <Link to={next.route} className="builder-inline-link">
                  Continue to {next.label}
                </Link>
                .
              </>
            ) : (
              <>
                {currentStep.handoff}{' '}
                <Link to="/" className="builder-inline-link">
                  Return to Motivation
                </Link>
                .
              </>
            )}
          </p>
        </article>
      </div>
    </section>
  )
}
