import { useEffect, useMemo, useState } from 'react'

import { MermaidDiagram } from './components/MermaidDiagram'
import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline } from './domain/pipeline'
import type { CategoryCatalog, IntakeSample } from './domain/types'

interface ImpactRationale {
  monthly_volume: number | null
  cycle_time_days: number | null
  manual_steps: number
  confidence: 'high' | 'medium' | 'low'
}

interface DispatchRecord {
  dispatch_id: string
  timestamp: string
  destinations: string[]
}

type StepState = 'pending' | 'active' | 'done'

const STEPS = [
  'Analyze intake request',
  'Generate automation pack',
  'Prepare delivery payloads',
] as const

function metricToText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Not provided'
  }
  return String(value)
}

function prettyCategory(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function buildImpactRationale(result: ReturnType<typeof runIntakePipeline>): ImpactRationale {
  const monthlyVolume =
    result.extracted.volume_per_month ?? result.sample.ground_truth.volume_per_month ?? null
  const cycleTimeDays =
    result.extracted.cycle_time_days ?? result.sample.ground_truth.baseline_cycle_time_days ?? null
  const manualSteps = result.extracted.manual_step_count

  let confidence: ImpactRationale['confidence'] = 'low'
  if (monthlyVolume !== null && cycleTimeDays !== null) {
    confidence = 'high'
  } else if (monthlyVolume !== null || cycleTimeDays !== null) {
    confidence = 'medium'
  }

  return {
    monthly_volume: monthlyVolume,
    cycle_time_days: cycleTimeDays,
    manual_steps: manualSteps,
    confidence,
  }
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [requestText, setRequestText] = useState('')

  const [result, setResult] = useState<ReturnType<typeof runIntakePipeline> | null>(null)
  const [impactRationale, setImpactRationale] = useState<ImpactRationale | null>(null)

  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1)
  const [isRunning, setIsRunning] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)
  const [dispatchLog, setDispatchLog] = useState<DispatchRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadIntakeSamples(), loadCategoryCatalog()])
      .then(([loadedSamples, loadedCatalog]) => {
        setSamples(loadedSamples)
        setCatalog(loadedCatalog)

        const firstSample = loadedSamples[0]
        setSelectedSampleId(firstSample?.id ?? '')
        setRequestText(firstSample?.text ?? '')
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

  function handleSampleChange(sampleId: string) {
    setSelectedSampleId(sampleId)
    const nextSample = samples.find((sample) => sample.id === sampleId)
    if (nextSample) {
      setRequestText(nextSample.text)
    }
  }

  function stepState(index: number): StepState {
    if (activeStepIndex < 0) {
      return 'pending'
    }
    if (index < activeStepIndex) {
      return 'done'
    }
    if (index === activeStepIndex) {
      return isRunning ? 'active' : 'done'
    }
    return 'pending'
  }

  const hintText = useMemo(() => {
    if (error) {
      return 'Data could not be loaded. Refresh once the source is available.'
    }
    if (isRunning) {
      return `Running step ${Math.min(activeStepIndex + 1, STEPS.length)} of ${STEPS.length}...`
    }
    if (!result) {
      return 'Choose a scenario and click Start demo.'
    }
    return 'Pack ready. Copy payloads or send the full pack to delivery queue.'
  }, [activeStepIndex, error, isRunning, result])

  async function runPipeline() {
    if (!selectedSample || !catalog) {
      return
    }

    const normalizedText = requestText.trim() || selectedSample.text
    const sampleForRun: IntakeSample = {
      ...selectedSample,
      text: normalizedText,
    }

    setResult(null)
    setImpactRationale(null)
    setCopyStatus(null)
    setDispatchStatus(null)
    setIsRunning(true)
    setActiveStepIndex(0)

    await nextPaint()

    setActiveStepIndex(1)
    const nextResult = runIntakePipeline(sampleForRun, catalog)
    setResult(nextResult)
    setImpactRationale(buildImpactRationale(nextResult))

    await nextPaint()

    setActiveStepIndex(2)
    setIsRunning(false)
  }

  async function copyJson(label: string, payload: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopyStatus(`${label} copied`)
    } catch {
      setCopyStatus(`Could not copy ${label}`)
    }
  }

  function sendToDeliveryQueue() {
    if (!result) {
      return
    }

    const timestamp = new Date().toLocaleString()
    const dispatchId = `BIS-${Date.now().toString(36).toUpperCase()}`

    const entry: DispatchRecord = {
      dispatch_id: dispatchId,
      timestamp,
      destinations: ['Jira', 'ServiceNow', 'Process Tracker'],
    }

    setDispatchLog((prev) => [entry, ...prev].slice(0, 5))
    setDispatchStatus(`Pack ${dispatchId} sent at ${timestamp}`)
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>One click from messy request to a delivery-ready automation pack.</h1>
        <p className="hero-subhead">
          Intake request, generate charter + process map + blueprint, then send export payloads to
          delivery tools.
        </p>
      </header>

      <section className="panel intake-panel">
        <h2>1. Intake Request</h2>
        <label>
          Scenario
          <select value={selectedSampleId} onChange={(event) => handleSampleChange(event.target.value)}>
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Request text
          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            rows={7}
          />
        </label>

        <button className="primary-btn" onClick={() => void runPipeline()} disabled={!selectedSample || isRunning}>
          {isRunning ? 'Generating pack...' : 'Start demo'}
        </button>

        <p className="hint-text">{hintText}</p>
        {error ? <p className="error-text">{error}</p> : null}
        {copyStatus ? <p className="status-text">{copyStatus}</p> : null}
        {dispatchStatus ? <p className="status-text success-text">{dispatchStatus}</p> : null}

        <ol className="step-track">
          {STEPS.map((step, index) => (
            <li key={step} className={`step-pill ${stepState(index)}`}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {!result ? (
        <section className="panel placeholder-panel">
          <h2>2. Automation Pack</h2>
          <p>Run the demo to generate an end-to-end pack and dispatch it.</p>
        </section>
      ) : (
        <section className="panel pack-panel">
          <h2>2. Automation Pack</h2>

          <div className="kpi-grid">
            <article>
              <span>Workflow</span>
              <strong>{prettyCategory(result.triage.category)}</strong>
            </article>
            <article>
              <span>Priority</span>
              <strong>{result.triage.priority}</strong>
            </article>
            <article>
              <span>Risk</span>
              <strong>{prettyCategory(result.triage.risk_level)}</strong>
            </article>
            <article>
              <span>Savings (hrs/month)</span>
              <strong>{result.triage.est_savings_hours_per_month}</strong>
            </article>
          </div>

          {impactRationale ? (
            <details className="explain-box">
              <summary>How savings was estimated</summary>
              <p>
                Manual touchpoints: {impactRationale.manual_steps}; monthly volume:{' '}
                {metricToText(impactRationale.monthly_volume)}; baseline cycle time:{' '}
                {metricToText(impactRationale.cycle_time_days)} days.
              </p>
              <p>
                Confidence: <strong>{prettyCategory(impactRationale.confidence)}</strong>
              </p>
            </details>
          ) : null}

          <section className="pack-section">
            <h3>Project charter</h3>
            <p>
              <strong>Problem:</strong> {result.charter.problem_statement}
            </p>
            <p>
              <strong>Next action:</strong> {result.triage.next_action}
            </p>
            <ul className="metric-list">
              <li>Baseline cycle time: {metricToText(result.charter.baseline_metrics.cycle_time_days)}</li>
              <li>Target cycle time: {metricToText(result.charter.target_metrics.cycle_time_days_target)}</li>
              <li>Baseline monthly volume: {metricToText(result.charter.baseline_metrics.volume_per_month)}</li>
            </ul>
            <button className="secondary-btn" onClick={() => copyJson('Charter JSON', result.charter)}>
              Copy charter JSON
            </button>
          </section>

          <section className="pack-section">
            <h3>To-be process map</h3>
            <MermaidDiagram title="Optimized workflow" chart={result.toBeMermaid} />
          </section>

          <section className="pack-section">
            <h3>Automation blueprint</h3>
            <ul className="metric-list">
              {result.blueprint.steps.slice(0, 5).map((step) => (
                <li key={step.id}>{step.name}</li>
              ))}
            </ul>
            <button className="secondary-btn" onClick={() => copyJson('Blueprint JSON', result.blueprint)}>
              Copy blueprint JSON
            </button>
          </section>

          <section className="pack-section">
            <h3>Dispatch payloads</h3>
            <div className="button-row">
              <button className="secondary-btn" onClick={() => copyJson('Jira payload', result.exports.jira_issue_create)}>
                Copy Jira payload
              </button>
              <button
                className="secondary-btn"
                onClick={() => copyJson('ServiceNow payload', result.exports.servicenow_record_create)}
              >
                Copy ServiceNow payload
              </button>
              <button className="secondary-btn" onClick={() => copyJson('Tracker payload', result.exports.process_tracker_row)}>
                Copy tracker payload
              </button>
              <button className="primary-btn" onClick={sendToDeliveryQueue}>
                Send pack to delivery queue
              </button>
            </div>

            {dispatchLog.length > 0 ? (
              <ul className="dispatch-list">
                {dispatchLog.map((entry) => (
                  <li key={entry.dispatch_id}>
                    <strong>{entry.dispatch_id}</strong> · {entry.timestamp} ·{' '}
                    {entry.destinations.join(', ')}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </section>
      )}
    </main>
  )
}

export default App
