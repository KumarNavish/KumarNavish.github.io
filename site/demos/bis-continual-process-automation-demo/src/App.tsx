import { useEffect, useMemo, useState } from 'react'

import { MermaidDiagram } from './components/MermaidDiagram'
import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline, type PipelineResult } from './domain/pipeline'
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

interface AutomationNarrative {
  title: string
  manualWorkflow: string
  businessPain: string[]
  automatedChange: string[]
  impactSummary: string
}

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

function buildImpactRationale(result: PipelineResult): ImpactRationale {
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

function findCategoryDescription(catalog: CategoryCatalog | null, categoryId: string): string {
  const entry = catalog?.categories.find((category) => category.id === categoryId)
  return entry?.description ?? prettyCategory(categoryId)
}

function buildPreRunNarrative(
  sample: IntakeSample | null,
  catalog: CategoryCatalog | null,
): AutomationNarrative {
  if (!sample) {
    return {
      title: 'Automation Preview',
      manualWorkflow: 'Select a scenario to show how the intake workflow is automated.',
      businessPain: ['Cycle-time delays', 'Manual rework and handoff risk', 'No standard output'],
      automatedChange: [
        'Auto-triage of intake text',
        'Instant charter + process map + blueprint',
        'Export payloads for delivery systems',
      ],
      impactSummary: 'Click Start demo to generate the automation pack now.',
    }
  }

  const baselineCycle = metricToText(sample.ground_truth.baseline_cycle_time_days)
  const volume = metricToText(sample.ground_truth.volume_per_month)
  const categoryDescription = findCategoryDescription(catalog, sample.ground_truth.category)

  return {
    title: 'What will be automated',
    manualWorkflow: `${sample.title} currently runs through ${prettyCategory(sample.channel)} intake, manual routing, and follow-ups. ${categoryDescription}`,
    businessPain: [
      `Cycle time is ${baselineCycle} days with inconsistent handoffs.`,
      `Volume is about ${volume} requests per month, creating repetitive triage work.`,
      `Risk level is ${prettyCategory(sample.ground_truth.risk_level)} because controls depend on manual checks.`,
    ],
    automatedChange: [
      `Classify and prioritize as ${prettyCategory(sample.ground_truth.category)} automatically.`,
      'Generate a project charter, as-is/to-be process maps, and automation blueprint.',
      'Prepare copy-ready payloads for Jira, ServiceNow, and process tracking.',
    ],
    impactSummary: 'Click Start demo. The transformation appears here immediately.',
  }
}

function buildPostRunNarrative(result: PipelineResult): AutomationNarrative {
  const baselineCycle = metricToText(result.charter.baseline_metrics.cycle_time_days)
  const targetCycle = metricToText(result.charter.target_metrics.cycle_time_days_target)
  const volume = metricToText(result.charter.baseline_metrics.volume_per_month)

  return {
    title: 'Automation Completed',
    manualWorkflow: `Before: ${result.sample.title} required ${result.extracted.manual_step_count} manual touchpoints and coordination across ${result.extracted.key_systems.length || 1} systems.`,
    businessPain: [
      `Delay: baseline cycle time ${baselineCycle} days.`,
      `Rework: monthly load ${volume} requests with repeated approval/routing tasks.`,
      `Risk: ${prettyCategory(result.triage.risk_level)} due to manual controls and handoffs.`,
    ],
    automatedChange: [
      `Auto-triaged to ${prettyCategory(result.triage.category)} with ${result.triage.priority} priority.`,
      'Generated charter + process map + automation blueprint in one run.',
      'Prepared export payloads for Jira, ServiceNow, and tracker updates.',
    ],
    impactSummary: `After: target cycle time ${targetCycle} days and estimated savings ${result.triage.est_savings_hours_per_month} hours/month.`,
  }
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [requestText, setRequestText] = useState('')

  const [result, setResult] = useState<ReturnType<typeof runIntakePipeline> | null>(null)
  const [impactRationale, setImpactRationale] = useState<ImpactRationale | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [runPhase, setRunPhase] = useState<string | null>(null)
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

  const automationNarrative = useMemo(
    () => (result ? buildPostRunNarrative(result) : buildPreRunNarrative(selectedSample, catalog)),
    [catalog, result, selectedSample],
  )

  const hintText = useMemo(() => {
    if (error) {
      return 'Data could not be loaded. Refresh once the source is available.'
    }
    if (isRunning) {
      return runPhase ?? 'Generating automation pack...'
    }
    if (!result) {
      return 'Choose a scenario and click Start demo.'
    }
    return 'Automation completed. Your business-ready artifacts are ready below.'
  }, [error, isRunning, result, runPhase])

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
    setRunPhase('Analyzing intake request')

    await nextPaint()

    setRunPhase('Generating charter, process map, and blueprint')
    const nextResult = runIntakePipeline(sampleForRun, catalog)
    setResult(nextResult)
    setImpactRationale(buildImpactRationale(nextResult))

    await nextPaint()

    setRunPhase('Preparing export payloads for delivery systems')
    await nextPaint()

    setIsRunning(false)
    setRunPhase(null)
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
        <section className="automation-moment" aria-live="polite">
          <p className="moment-tag">{automationNarrative.title}</p>
          <h3>From manual workflow to automated delivery</h3>
          <div className="moment-grid">
            <article>
              <h4>1. Manual workflow today</h4>
              <p>{automationNarrative.manualWorkflow}</p>
            </article>
            <article>
              <h4>2. Problem it causes</h4>
              <ul>
                {automationNarrative.businessPain.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
            <article>
              <h4>3. What was automated</h4>
              <ul>
                {automationNarrative.automatedChange.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          </div>
          <p className="moment-impact">
            <strong>Automation impact:</strong> {automationNarrative.impactSummary}
          </p>
        </section>
        {error ? <p className="error-text">{error}</p> : null}
        {copyStatus ? <p className="status-text">{copyStatus}</p> : null}
        {dispatchStatus ? <p className="status-text success-text">{dispatchStatus}</p> : null}
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
