interface PageCompassProps {
  title: string
  steps: [string, string, string]
  outcome: string
}

export function PageCompass({ title, steps, outcome }: PageCompassProps) {
  return (
    <section className="panel page-compass-panel" aria-label={`${title} reading guide`}>
      <p className="matrix-label">{title}</p>
      <ol className="page-compass-inline">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="page-compass-step-index">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="meta-line page-compass-outcome">{outcome}</p>
    </section>
  )
}
