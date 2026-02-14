import { useEffect, useMemo, useRef, useState } from 'react'

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
type ArtifactTab = 'charter' | 'map' | 'exports'

const DEMO_PHASES: DemoPhase[] = [
  {
    label: 'Read request',
    detail: 'Reading the request text...',
  },
  {
    label: 'Find pain points',
    detail: 'Finding delay, rework, and risk...',
  },
  {
    label: 'Create outputs',
    detail: 'Creating summary, flow map, and export files...',
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
      title: 'Before and after preview',
      manualWorkflow: 'Choose an example to preview the manual process.',
      businessPain: ['Slow turnaround', 'Repetitive manual work', 'Higher risk from manual checks'],
      automatedChange: [
        'Reads messy request text',
        'Builds a clear project summary and flow map',
        'Prepares export JSON for internal tools',
      ],
      impactSummary: 'Click Run automation to see the transformation.',
    }
  }

  const baselineCycle = metricToText(sample.ground_truth.baseline_cycle_time_days)
  const volume = metricToText(sample.ground_truth.volume_per_month)
  const categoryDescription = findCategoryDescription(catalog, sample.ground_truth.category)

  return {
    title: 'What will change',
    manualWorkflow: `${sample.title} is currently handled with manual routing, approvals, and follow-ups. ${categoryDescription}`,
    businessPain: [
      `Delay: about ${baselineCycle} days per request.`,
      `Rework: around ${volume} requests each month need repeated handoffs.`,
      `Risk: ${prettyCategory(sample.ground_truth.risk_level)} risk because checks are manual.`,
    ],
    automatedChange: [
      `Auto-sorts this as ${prettyCategory(sample.ground_truth.category)}.`,
      'Creates summary + flow map in one run.',
      'Prepares export JSON you can copy into delivery tools.',
    ],
    impactSummary: 'Press Run automation. The before/after result appears here.',
  }
}

function buildPostRunNarrative(result: PipelineResult): AutomationNarrative {
  const baselineCycle = metricToText(result.charter.baseline_metrics.cycle_time_days)
  const targetCycle = metricToText(result.charter.target_metrics.cycle_time_days_target)
  const volume = metricToText(result.charter.baseline_metrics.volume_per_month)

  return {
    title: 'Automation complete',
    manualWorkflow: `Before: this workflow needed ${result.extracted.manual_step_count} manual touchpoints and cross-team follow-up.`,
    businessPain: [
      `Delay: ${baselineCycle} day baseline cycle time.`,
      `Rework: ${volume} requests per month with repeated approvals.`,
      `Risk: ${prettyCategory(result.triage.risk_level)} risk from manual controls.`,
    ],
    automatedChange: [
      `Auto-sorted to ${prettyCategory(result.triage.category)} with ${result.triage.priority} priority.`,
      'Built a clear summary, flow map, and automation plan.',
      'Prepared export JSON for Jira, ServiceNow, and tracking.',
    ],
    impactSummary: `After: target cycle time ${targetCycle} days and estimated savings ${result.triage.est_savings_hours_per_month} hours per month.`,
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
  const [activeTab, setActiveTab] = useState<ArtifactTab>('charter')

  const packSectionRef = useRef<HTMLElement | null>(null)

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
      return 'Could not load data. Please refresh.'
    }
    if (isRunning) {
      return DEMO_PHASES[activePhaseIndex]?.detail ?? 'Running automation...'
    }
    if (!result) {
      return 'Choose an example and click Run automation.'
    }
    return 'Done. Scroll to view and copy your outputs.'
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
      setActiveTab('charter')
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
    setActiveTab('charter')

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

  function openDeliverables() {
    packSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
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
        <h1>Paste a messy request. Get a clear automation plan.</h1>
        <p className="hero-subhead">
          This tool turns a manual process request into three practical outputs: summary, flow map,
          and export JSON.
        </p>
      </header>

      {hasResult ? (
        <section className="panel outcome-banner" aria-live="polite">
          <p>
            Automation finished: manual intake was converted into a ready-to-use process pack.
          </p>
        </section>
      ) : null}

      <section className="panel intake-panel">
        <div className="intake-layout">
          <section className="intake-controls">
            <h2>Try it</h2>
            <p className="control-caption">Pick an example, edit if needed, then click Run automation.</p>

            <label>
              Choose an example
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
                rows={6}
              />
            </label>

            <button className="primary-btn" onClick={() => void runPipeline()} disabled={!selectedSample || isRunning}>
              {isRunning ? 'Running...' : 'Run automation'}
            </button>

            <p className="hint-text">{hintText}</p>
            {error ? <p className="error-text">{error}</p> : null}
            {copyStatus ? <p className="status-text">{copyStatus}</p> : null}
            {dispatchStatus ? <p className="status-text success-text">{dispatchStatus}</p> : null}

            <section className="next-step-card">
              <p className="next-step-tag">What to do next</p>
              {hasResult ? (
                <>
                  <p>Open outputs and copy what you need.</p>
                  <div className="inline-actions">
                    <button className="secondary-btn" onClick={openDeliverables}>
                      Open outputs
                    </button>
                    <button className="secondary-btn" onClick={() => setActiveTab('exports')}>
                      Go to exports
                    </button>
                  </div>
                </>
              ) : (
                <p>Click Run automation to generate the outputs.</p>
              )}
            </section>
          </section>

          <section className="magic-panel" aria-live="polite">
            <p className="moment-tag">{automationNarrative.title}</p>
            <h2>See what changed</h2>
            <p className="magic-lede">{automationNarrative.impactSummary}</p>

            <div className="magic-main">
              <article className="state-card before-state">
                <h3>Before (manual)</h3>
                <p className="state-caption">How the work happened before</p>
                <p>{automationNarrative.manualWorkflow}</p>
                <ul>
                  {automationNarrative.businessPain.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>

              <div className="transform-center">
                <p className="transform-label">Automation in progress</p>
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
                <h3>After (automated)</h3>
                <p className="state-caption">What the tool produced</p>
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
                    <button className="secondary-btn inline-open-btn" onClick={openDeliverables}>
                      View outputs
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Click <strong>Run automation</strong> to convert this request into ready-to-use
                      outputs.
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
          <h2>Your outputs</h2>
          <p>
            Summary, flow map, and export JSON will appear here right after the run.
          </p>
        </section>
      ) : (
        <section className="panel pack-panel" ref={packSectionRef}>
          <h2>Your outputs</h2>
          <p className="pack-subhead">Read left to right: summary, flow map, then exports.</p>

          <div className="kpi-grid">
            <article>
              <span>Workflow type</span>
              <strong>{prettyCategory(result.triage.category)}</strong>
            </article>
            <article>
              <span>Risk</span>
              <strong>{prettyCategory(result.triage.risk_level)}</strong>
            </article>
            <article>
              <span>Priority</span>
              <strong>{result.triage.priority}</strong>
            </article>
            <article>
              <span>Hours saved / month</span>
              <strong>{result.triage.est_savings_hours_per_month}</strong>
            </article>
          </div>

          <div className="tab-row" role="tablist" aria-label="Output sections">
            <button
              className={`tab-btn ${activeTab === 'charter' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'charter'}
              onClick={() => setActiveTab('charter')}
            >
              1. Summary
            </button>
            <button
              className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'map'}
              onClick={() => setActiveTab('map')}
            >
              2. Flow Map
            </button>
            <button
              className={`tab-btn ${activeTab === 'exports' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'exports'}
              onClick={() => setActiveTab('exports')}
            >
              3. Export JSON
            </button>
          </div>

          <section className="artifact-panel">
            {activeTab === 'charter' ? (
              <section className="artifact-card">
                <h3>Summary</h3>
                <p>
                  <strong>Problem:</strong> {result.charter.problem_statement}
                </p>
                <p>
                  <strong>Recommended next action:</strong> {result.triage.next_action}
                </p>
                <ul className="metric-list">
                  <li>Baseline cycle time: {metricToText(result.charter.baseline_metrics.cycle_time_days)}</li>
                  <li>
                    Target cycle time: {metricToText(result.charter.target_metrics.cycle_time_days_target)}
                  </li>
                  <li>Monthly volume: {metricToText(result.charter.baseline_metrics.volume_per_month)}</li>
                </ul>
                <div className="inline-actions">
                  <button className="secondary-btn" onClick={() => copyJson('Charter JSON', result.charter)}>
                    Copy summary JSON
                  </button>
                  <button className="secondary-btn" onClick={() => setActiveTab('map')}>
                    Next: Flow map
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab === 'map' ? (
              <section className="artifact-card">
                <h3>Flow map</h3>
                <MermaidDiagram title="Optimized workflow" chart={result.toBeMermaid} />
                <div className="inline-actions">
                  <button className="secondary-btn" onClick={() => setActiveTab('exports')}>
                    Next: Export JSON
                  </button>
                </div>
                <details className="advanced-block">
                  <summary>Show current flow (raw)</summary>
                  <pre>{result.asIsMermaid}</pre>
                </details>
              </section>
            ) : null}

            {activeTab === 'exports' ? (
              <section className="artifact-card">
                <h3>Export JSON</h3>
                <div className="button-column">
                  <button className="secondary-btn" onClick={() => copyJson('Jira payload', result.exports.jira_issue_create)}>
                    Copy Jira JSON
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => copyJson('ServiceNow payload', result.exports.servicenow_record_create)}
                  >
                    Copy ServiceNow JSON
                  </button>
                  <button className="secondary-btn" onClick={() => copyJson('Tracker payload', result.exports.process_tracker_row)}>
                    Copy tracker JSON
                  </button>
                  <button className="secondary-btn" onClick={() => copyJson('Blueprint JSON', result.blueprint)}>
                    Copy automation plan JSON
                  </button>
                  <button className="primary-btn" onClick={sendToDeliveryQueue}>
                    Send package
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
            ) : null}
          </section>

          <details className="advanced-block">
            <summary>Technical details (optional)</summary>
            <p>
              Estimated from {impactRationale?.manual_steps ?? 'n/a'} manual touchpoints, volume{' '}
              {metricToText(impactRationale?.monthly_volume)}, cycle time{' '}
              {metricToText(impactRationale?.cycle_time_days)} days. Confidence:{' '}
              <strong>{impactRationale ? prettyCategory(impactRationale.confidence) : 'Not available'}</strong>
              .
            </p>
          </details>
        </section>
      )}
    </main>
  )
}

export default App
