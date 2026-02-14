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

interface DemoPhase {
  label: string
  detail: string
}

type PhaseState = 'pending' | 'active' | 'done'

const DEMO_PHASES: DemoPhase[] = [
  {
    label: 'Read intake request',
    detail: 'Interpreting the request and extracting bottlenecks...',
  },
  {
    label: 'Diagnose business impact',
    detail: 'Estimating delay, risk, and manual effort from the intake text...',
  },
  {
    label: 'Generate automation pack',
    detail: 'Building charter, process map, blueprint, and export payloads...',
  },
]

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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function excerpt(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
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
      title: 'Automation preview',
      manualWorkflow: 'Pick a scenario to preview the manual workflow before automation.',
      businessPain: ['Cycle-time delay', 'Manual rework across teams', 'Control and compliance risk'],
      automatedChange: [
        'Auto-triage from messy request text',
        'Instant charter + process map + blueprint',
        'Delivery payloads for Jira, ServiceNow, and trackers',
      ],
      impactSummary: 'Click Start demo to run the full transformation.',
    }
  }

  const baselineCycle = metricToText(sample.ground_truth.baseline_cycle_time_days)
  const volume = metricToText(sample.ground_truth.volume_per_month)
  const categoryDescription = findCategoryDescription(catalog, sample.ground_truth.category)

  return {
    title: 'What will be automated',
    manualWorkflow: `${sample.title} currently relies on manual intake, routing, approvals, and follow-up loops. ${categoryDescription}`,
    businessPain: [
      `Delay: average cycle time is ${baselineCycle} days.`,
      `Rework: around ${volume} requests per month require repeated triage and handoffs.`,
      `Risk: ${prettyCategory(sample.ground_truth.risk_level)} due to manual control checks.`,
    ],
    automatedChange: [
      `Auto-classify and prioritize into ${prettyCategory(sample.ground_truth.category)}.`,
      'Generate charter, to-be process map, and automation blueprint in one run.',
      'Prepare export-ready payloads for delivery systems.',
    ],
    impactSummary: 'Press Start demo. The workflow transformation appears here immediately.',
  }
}

function buildPostRunNarrative(result: PipelineResult): AutomationNarrative {
  const baselineCycle = metricToText(result.charter.baseline_metrics.cycle_time_days)
  const targetCycle = metricToText(result.charter.target_metrics.cycle_time_days_target)
  const volume = metricToText(result.charter.baseline_metrics.volume_per_month)

  return {
    title: 'Automation completed',
    manualWorkflow: `Before automation, this workflow required ${result.extracted.manual_step_count} manual touchpoints and fragmented tracking across teams and systems.`,
    businessPain: [
      `Delay: baseline cycle time ${baselineCycle} days.`,
      `Rework: ${volume} requests per month with repetitive triage and approvals.`,
      `Risk: ${prettyCategory(result.triage.risk_level)} from manual control execution.`,
    ],
    automatedChange: [
      `Auto-triaged to ${prettyCategory(result.triage.category)} with ${result.triage.priority} priority.`,
      'Generated charter + process map + automation blueprint in one action.',
      'Prepared export payloads for Jira, ServiceNow, and process tracking.',
    ],
    impactSummary: `Cycle time target is now ${targetCycle} days with estimated savings of ${result.triage.est_savings_hours_per_month} hours per month.`,
  }
}

function getPhaseState(index: number, activePhaseIndex: number, isRunning: boolean, hasResult: boolean): PhaseState {
  if (isRunning) {
    if (index < activePhaseIndex) {
      return 'done'
    }
    if (index === activePhaseIndex) {
      return 'active'
    }
    return 'pending'
  }

  if (hasResult) {
    return 'done'
  }

  return 'pending'
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [requestText, setRequestText] = useState('')

  const [result, setResult] = useState<PipelineResult | null>(null)
  const [impactRationale, setImpactRationale] = useState<ImpactRationale | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [activePhaseIndex, setActivePhaseIndex] = useState(0)
  const [runProgress, setRunProgress] = useState(0)

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

  const automationNarrative = useMemo(
    () => (result ? buildPostRunNarrative(result) : buildPreRunNarrative(selectedSample, catalog)),
    [catalog, result, selectedSample],
  )

  const hasResult = Boolean(result)

  const hintText = useMemo(() => {
    if (error) {
      return 'Data could not be loaded. Refresh once the source is available.'
    }
    if (isRunning) {
      return DEMO_PHASES[activePhaseIndex]?.detail ?? 'Running automation...'
    }
    if (!result) {
      return 'Select a workflow and click Start demo.'
    }
    return 'Automation complete. Review and export the deliverables below.'
  }, [activePhaseIndex, error, isRunning, result])

  function handleSampleChange(sampleId: string) {
    setSelectedSampleId(sampleId)
    const nextSample = samples.find((sample) => sample.id === sampleId)
    if (nextSample) {
      setRequestText(nextSample.text)
      setResult(null)
      setImpactRationale(null)
      setRunProgress(0)
      setActivePhaseIndex(0)
      setCopyStatus(null)
      setDispatchStatus(null)
    }
  }

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
    setActivePhaseIndex(0)
    setRunProgress(12)

    await nextPaint()
    await sleep(220)

    setActivePhaseIndex(1)
    setRunProgress(48)
    await nextPaint()
    await sleep(240)

    const nextResult = runIntakePipeline(sampleForRun, catalog)
    setResult(nextResult)
    setImpactRationale(buildImpactRationale(nextResult))

    setActivePhaseIndex(2)
    setRunProgress(82)
    await nextPaint()
    await sleep(220)

    setRunProgress(100)
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
        <h1>Turn one messy process request into a delivery-ready automation pack in seconds.</h1>
        <p className="hero-subhead">
          The demo automates a real BIS-style intake workflow: triage the request, standardize it
          into charter + process map + blueprint, then export payloads for delivery systems.
        </p>
      </header>

      <section className="panel intake-panel">
        <div className="intake-layout">
          <section className="intake-controls">
            <h2>Start here</h2>

            <label>
              Workflow scenario
              <select value={selectedSampleId} onChange={(event) => handleSampleChange(event.target.value)}>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Intake request
              <textarea
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                rows={6}
              />
            </label>

            <button className="primary-btn" onClick={() => void runPipeline()} disabled={!selectedSample || isRunning}>
              {isRunning ? 'Automating...' : 'Start demo'}
            </button>

            <p className="hint-text">{hintText}</p>
            {error ? <p className="error-text">{error}</p> : null}
            {copyStatus ? <p className="status-text">{copyStatus}</p> : null}
            {dispatchStatus ? <p className="status-text success-text">{dispatchStatus}</p> : null}
          </section>

          <section className="magic-panel" aria-live="polite">
            <p className="moment-tag">{automationNarrative.title}</p>
            <h2>The automation moment</h2>
            <p className="magic-lede">{automationNarrative.impactSummary}</p>

            <div className="magic-main">
              <article className="state-card before-state">
                <h3>Before</h3>
                <p className="state-caption">Manual workflow</p>
                <p>{automationNarrative.manualWorkflow}</p>
                <ul>
                  {automationNarrative.businessPain.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>

              <div className="transform-center">
                <p className="transform-label">Transformation</p>
                <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={runProgress}>
                  <span style={{ width: `${runProgress}%` }} />
                </div>
                <ol className="phase-list">
                  {DEMO_PHASES.map((phase, index) => {
                    const state = getPhaseState(index, activePhaseIndex, isRunning, hasResult)
                    return (
                      <li key={phase.label} className={`phase-item ${state}`}>
                        <span>{index + 1}</span>
                        {phase.label}
                      </li>
                    )
                  })}
                </ol>
              </div>

              <article className="state-card after-state">
                <h3>After</h3>
                <p className="state-caption">Automated output</p>
                {hasResult ? (
                  <>
                    <ul>
                      {automationNarrative.automatedChange.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <div className="impact-strip">
                      <span>{result.triage.priority} priority</span>
                      <span>{result.triage.est_savings_hours_per_month} hrs/month saved</span>
                      <span>
                        Target cycle {metricToText(result.charter.target_metrics.cycle_time_days_target)} days
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Click <strong>Start demo</strong> to convert the intake text into charter,
                      process map, blueprint, and export payloads.
                    </p>
                    <p className="preview-text">Preview: {excerpt(requestText)}</p>
                  </>
                )}
              </article>
            </div>
          </section>
        </div>
      </section>

      {!result ? (
        <section className="panel placeholder-panel">
          <h2>Automation pack</h2>
          <p>
            Your charter, process map, blueprint, and export payloads will appear here right after
            the run.
          </p>
        </section>
      ) : (
        <section className="panel pack-panel">
          <h2>Automation pack (delivery-ready)</h2>

          <div className="kpi-grid">
            <article>
              <span>Predicted workflow</span>
              <strong>{prettyCategory(result.triage.category)}</strong>
            </article>
            <article>
              <span>Risk level</span>
              <strong>{prettyCategory(result.triage.risk_level)}</strong>
            </article>
            <article>
              <span>Priority</span>
              <strong>{result.triage.priority}</strong>
            </article>
            <article>
              <span>Savings (hrs/month)</span>
              <strong>{result.triage.est_savings_hours_per_month}</strong>
            </article>
          </div>

          <div className="artifact-grid">
            <section className="artifact-card">
              <h3>Charter</h3>
              <p>
                <strong>Problem:</strong> {result.charter.problem_statement}
              </p>
              <p>
                <strong>Next action:</strong> {result.triage.next_action}
              </p>
              <ul className="metric-list">
                <li>Baseline cycle time: {metricToText(result.charter.baseline_metrics.cycle_time_days)}</li>
                <li>
                  Target cycle time: {metricToText(result.charter.target_metrics.cycle_time_days_target)}
                </li>
                <li>Monthly volume: {metricToText(result.charter.baseline_metrics.volume_per_month)}</li>
              </ul>
              <button className="secondary-btn" onClick={() => copyJson('Charter JSON', result.charter)}>
                Copy charter JSON
              </button>
            </section>

            <section className="artifact-card">
              <h3>To-be process map</h3>
              <MermaidDiagram title="Optimized workflow" chart={result.toBeMermaid} />
              <details className="advanced-block">
                <summary>Show as-is flow</summary>
                <pre>{result.asIsMermaid}</pre>
              </details>
            </section>

            <section className="artifact-card">
              <h3>Export payloads</h3>
              <div className="button-column">
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
          </div>

          <details className="advanced-block">
            <summary>Advanced details</summary>
            <p>
              Estimated from {impactRationale?.manual_steps ?? 'n/a'} manual touchpoints, volume{' '}
              {metricToText(impactRationale?.monthly_volume)}, cycle time{' '}
              {metricToText(impactRationale?.cycle_time_days)} days. Confidence:{' '}
              <strong>{impactRationale ? prettyCategory(impactRationale.confidence) : 'Not available'}</strong>
              .
            </p>
            <button className="secondary-btn" onClick={() => copyJson('Blueprint JSON', result.blueprint)}>
              Copy blueprint JSON
            </button>
          </details>
        </section>
      )}
    </main>
  )
}

export default App
