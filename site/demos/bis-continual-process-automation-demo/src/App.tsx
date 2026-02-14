import { useEffect, useState } from 'react'

import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import type { CategoryCatalog, IntakeSample } from './domain/types'

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadIntakeSamples(), loadCategoryCatalog()])
      .then(([loadedSamples, loadedCatalog]) => {
        setSamples(loadedSamples)
        setCatalog(loadedCatalog)
      })
      .catch((unknownError) => {
        if (unknownError instanceof Error) {
          setError(unknownError.message)
          return
        }
        setError('Unknown data loading error')
      })
  }, [])

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">BIS Process Optimisation Demo</p>
        <h1>Continual Process Automation Copilot</h1>
        <p className="value-prop">
          Turn messy process improvement requests into a standardized charter,
          process map, and automation blueprint—exportable to internal tracking
          systems.
        </p>

        {error ? <p className="status error">{error}</p> : null}
        {!error && samples.length === 0 ? (
          <p className="status">Loading BIS intake samples...</p>
        ) : null}

        {samples.length > 0 && catalog ? (
          <section className="status-block">
            <p className="status">
              Loaded {samples.length} intake samples across{' '}
              {catalog.categories.length} categories.
            </p>
            <ul>
              {samples.slice(0, 4).map((sample) => (
                <li key={sample.id}>
                  <strong>{sample.title}</strong> ({sample.channel})
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </main>
  )
}

export default App
