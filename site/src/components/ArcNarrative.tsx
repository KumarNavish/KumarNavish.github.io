import { getArcNeighbors, type ArcStepId } from '../lib/arc'

export function ArcNarrative({ current }: { current: ArcStepId }) {
  const { previous, current: currentStep, next } = getArcNeighbors(current)

  const continuity = previous
    ? `Built on ${previous.label.toLowerCase()}: ${previous.purpose}`
    : 'Starting point: define the decision pressure before selecting methods.'

  return (
    <section className="panel arc-context-panel" aria-label="Arc context">
      <header className="panel-header">
        <h2>Narrative Focus</h2>
      </header>

      <div className="arc-context-grid">
        <article className="arc-context-card">
          <p className="matrix-label">Question now</p>
          <p>{currentStep.readerQuestion}</p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">Answer on this page</p>
          <p>{currentStep.purpose}</p>
          <p className="meta-line">{currentStep.evidence}</p>
          <p className="meta-line">{continuity}</p>
        </article>

        <article className="arc-context-card">
          <p className="matrix-label">Question next</p>
          <p>{next ? next.readerQuestion : 'How does the full arc connect as one system?'}</p>
          <p className="meta-line">{next ? `Next layer: ${next.label}` : 'Next layer: Motivation'}</p>
        </article>
      </div>
    </section>
  )
}
