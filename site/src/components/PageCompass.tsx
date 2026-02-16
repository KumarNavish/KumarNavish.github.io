interface PageCompassProps {
  title: string
  steps: [string, string, string]
  outcome: string
}

export function PageCompass({ title, steps, outcome }: PageCompassProps) {
  return (
    <section className="panel page-compass-panel" aria-label={`${title} reading guide`}>
      <header className="panel-header">
        <h2>{title}</h2>
      </header>
      <div className="page-compass-grid">
        <article className="page-compass-card">
          <p className="matrix-label">Scan sequence</p>
          <ol className="page-compass-list">
            <li>{steps[0]}</li>
            <li>{steps[1]}</li>
            <li>{steps[2]}</li>
          </ol>
        </article>
        <article className="page-compass-card">
          <p className="matrix-label">What this should make clear</p>
          <p>{outcome}</p>
        </article>
      </div>
    </section>
  )
}
