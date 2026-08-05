export function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="state-block" aria-live="polite">
      <p className="state-label">Loading</p>
      <p>{label}</p>
    </section>
  )
}

export function ErrorBlock({ label, details }: { label: string; details: string }) {
  return (
    <section className="state-block state-error" role="alert">
      <p className="state-label">Error</p>
      <p>{label}</p>
      <p className="state-details">{details}</p>
    </section>
  )
}

