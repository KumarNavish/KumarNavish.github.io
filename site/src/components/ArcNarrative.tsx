import { Link } from 'react-router-dom'

import { getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcNarrative({ current }: { current: ArcStepId }) {
  const { previous, current: currentStep, next } = getArcNeighbors(current)

  return (
    <section className="panel arc-context-panel" aria-label="Arc context">
      <header className="panel-header">
        <h2>How This Connects</h2>
      </header>

      <div className="arc-context-grid">
        <article className="arc-context-card">
          <p className="matrix-label">From previous layer</p>
          <p>
            {previous
              ? previous.handoff
              : 'This is the entry point of the portfolio arc.'}
          </p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">This layer answers</p>
          <p>{currentStep.question}</p>
          <p className="meta-line">{currentStep.evidence}</p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">Next transition</p>
          <p>
            {next ? (
              <>
                {currentStep.handoff}{' '}
                <Link to={next.route} className="builder-inline-link">
                  Open {next.label}
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
