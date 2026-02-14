import { useEffect, useMemo, useState } from 'react'

import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline } from './domain/pipeline'
import type { CategoryCatalog, IntakeSample } from './domain/types'

function renderMetricEntries(metrics: Record<string, number | string | null>) {
  return (
    <ul>
      {Object.entries(metrics).map(([key, value]) => (
        <li key={key}>
          <strong>{key}:</strong> {value === null ? 'n/a' : String(value)}
        </li>
      ))}
    </ul>
  )
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<string>('')
  const [result, setResult] = useState<ReturnType<typeof runIntakePipeline> | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadIntakeSamples(), loadCategoryCatalog()])
      .then(([loadedSamples, loadedCatalog]) => {
        setSamples(loadedSamples)
        setCatalog(loadedCatalog)
        setSelectedSampleId(loadedSamples[0]?.id ?? '')
      })
      .catch((unknownError) => {
        if (unknownError instanceof Error) {
          setError(unknownError.message)
          return
        }
        setError('Unknown data loading error')
      })
  }, [])

  const selectedSample = useMemo(
    () => samples.find((sample) => sample.id === selectedSampleId) ?? samples[0] ?? null,
    [samples, selectedSampleId],
  )

  function runPipeline(sample: IntakeSample | null) {
    if (!sample || !catalog) {
      return
    }
    setResult(runIntakePipeline(sample, catalog))
  }

  function startDemo() {
    const first = samples[0]
    if (!first) {
      return
    }
    setSelectedSampleId(first.id)
    runPipeline(first)
  }

  async function copyJson(label: string, payload: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopyStatus(`${label} copied`)
    } catch {
      setCopyStatus(`Could not copy ${label}`)
    }
  }

  return (
    <main className="page">
      <section className="card header-card">
        <p className="eyebrow">BIS Process Optimisation Demo</p>
        <h1>Continual Process Automation Copilot</h1>
        <p className="value-prop">
          Turn messy process improvement requests into a standardized charter,
          process map, and automation blueprint—exportable to internal tracking
          systems.
        </p>
      </section>

      <section className="card control-card">
        {error ? <p className="status error">{error}</p> : null}
        {!error && samples.length === 0 ? <p className="status">Loading intake samples...</p> : null}
        {samples.length > 0 && catalog ? (
          <>
            <div className="controls">
              <button className="primary" onClick={startDemo}>
                Start demo
              </button>
              <label>
                Sample
                <select
                  value={selectedSampleId}
                  onChange={(event) => setSelectedSampleId(event.target.value)}
                >
                  {samples.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      {sample.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary" onClick={() => runPipeline(selectedSample)}>
                Run selected sample
              </button>
            </div>
            <p className="status">
              Loaded {samples.length} intake samples across {catalog.categories.length} categories.
            </p>
            {copyStatus ? <p className="status">{copyStatus}</p> : null}
          </>
        ) : null}
      </section>

      {result ? (
        <>
          <section className="card">
            <h2>Triage</h2>
            <div className="kv-grid">
              <p>
                <span>Category</span>
                <strong>{result.triage.category}</strong>
              </p>
              <p>
                <span>Risk</span>
                <strong>{result.triage.risk_level}</strong>
              </p>
              <p>
                <span>Priority</span>
                <strong>{result.triage.priority}</strong>
              </p>
              <p>
                <span>Automation score</span>
                <strong>{result.triage.automation_score}</strong>
              </p>
              <p>
                <span>Savings / month</span>
                <strong>{result.triage.est_savings_hours_per_month}h</strong>
              </p>
              <p>
                <span>Next action</span>
                <strong>{result.triage.next_action}</strong>
              </p>
            </div>
          </section>

          <section className="card">
            <h2>Project Charter</h2>
            <p>
              <strong>Problem statement:</strong> {result.charter.problem_statement}
            </p>
            <h3>Scope In</h3>
            <ul>
              {result.charter.scope_in.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Scope Out</h3>
            <ul>
              {result.charter.scope_out.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Stakeholders</h3>
            <ul>
              {result.charter.stakeholders.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Baseline Metrics</h3>
            {renderMetricEntries(result.charter.baseline_metrics)}
            <h3>Target Metrics</h3>
            {renderMetricEntries(result.charter.target_metrics)}
            <h3>Constraints / Controls</h3>
            <ul>
              {result.charter.constraints_controls.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>DMAIC Next Steps</h3>
            <ul>
              {result.charter.dmaic_next_steps.map((item) => (
                <li key={`${item.phase}-${item.action}`}>
                  <strong>{item.phase}:</strong> {item.action}
                </li>
              ))}
            </ul>
            <button className="secondary" onClick={() => copyJson('Charter JSON', result.charter)}>
              Copy charter JSON
            </button>
          </section>

          <section className="card">
            <h2>Process Maps</h2>
            <h3>As-Is (Mermaid)</h3>
            <pre>{result.asIsMermaid}</pre>
            <h3>To-Be (Mermaid)</h3>
            <pre>{result.toBeMermaid}</pre>
          </section>

          <section className="card">
            <h2>Automation Blueprint</h2>
            <pre>{JSON.stringify(result.blueprint, null, 2)}</pre>
            <button
              className="secondary"
              onClick={() => copyJson('Automation blueprint', result.blueprint)}
            >
              Copy blueprint JSON
            </button>
          </section>

          <section className="card">
            <h2>Export Payloads</h2>
            <h3>Jira issue create</h3>
            <pre>{JSON.stringify(result.exports.jira_issue_create, null, 2)}</pre>
            <button
              className="secondary"
              onClick={() => copyJson('Jira payload', result.exports.jira_issue_create)}
            >
              Copy Jira payload
            </button>
            <h3>ServiceNow record create</h3>
            <pre>{JSON.stringify(result.exports.servicenow_record_create, null, 2)}</pre>
            <button
              className="secondary"
              onClick={() =>
                copyJson('ServiceNow payload', result.exports.servicenow_record_create)
              }
            >
              Copy ServiceNow payload
            </button>
            <h3>Process tracker row</h3>
            <pre>{JSON.stringify(result.exports.process_tracker_row, null, 2)}</pre>
            <button
              className="secondary"
              onClick={() => copyJson('Tracker payload', result.exports.process_tracker_row)}
            >
              Copy tracker payload
            </button>
          </section>
        </>
      ) : (
        <section className="card">
          <h2>Next step</h2>
          <p>Click “Start demo” to generate triage, charter, process maps, blueprint, and exports.</p>
        </section>
      )}
    </main>
  )
}

export default App
