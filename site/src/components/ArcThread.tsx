import { Link } from 'react-router-dom'

import { ARC_STEPS, type ArcStepId } from '../lib/arc'

export function ArcThread({ current }: { current: ArcStepId }) {
  return (
    <section className="panel arc-thread-panel" aria-label="Narrative thread">
      <ol className="arc-thread-list">
        {ARC_STEPS.map((step, index) => (
          <li key={step.id} className={step.id === current ? 'arc-thread-item arc-thread-item-active' : 'arc-thread-item'}>
            <Link to={step.route} className="arc-thread-link">
              <span className="arc-thread-index">{index + 1}</span>
              <span>{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
