import { useEffect, useMemo, useRef, useState } from 'react'

import {
  ReplayMemory,
  replayWeightForPreset,
  type ReplayPreset,
} from './cl/memory'
import { OnlineCategoryModel } from './cl/onlineModel'
import { evaluateIntakeSamples, regressionDelta } from './cl/regression'
import { MermaidDiagram } from './components/MermaidDiagram'
import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline } from './domain/pipeline'
import {
  intakeCategories,
  type CategoryCatalog,
  type IntakeCategory,
  type IntakeSample,
} from './domain/types'

interface UpdateSummary {
  preset: ReplayPreset
  before_accuracy: number
  after_accuracy: number
  predicted_after: IntakeCategory
}

interface RegressionSuiteRow {
  preset: ReplayPreset
  before_old_accuracy: number
  after_old_accuracy: number
  overall_accuracy: number
  retention_ratio: number
  mean_drop: number
}

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

type ArtifactTab = 'charter' | 'map' | 'blueprint' | 'export'
type StageState = 'pending' | 'active' | 'done'

const PRESET_OPTIONS: Array<{ id: ReplayPreset; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'fast_adaptation', label: 'Fast adaptation' },
  { id: 'retention_first', label: 'Retention-first' },
]

const STAGES = [
  'Read intake context',
  'Generate optimisation artifacts',
  'Package delivery payloads',
] as const

const ARTIFACT_TABS: Array<{ id: ArtifactTab; label: string }> = [
  { id: 'charter', label: 'Charter' },
  { id: 'map', label: 'Process map' },
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'export', label: 'Export' },
]

const DRIFT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/approval/gi, 'sign-off'],
  [/ticket/gi, 'case'],
  [/request/gi, 'submission'],
  [/escalation/gi, 'rapid handoff'],
  [/compliance/gi, 'governance'],
]

function applyDriftText(text: string): string {
  return DRIFT_REPLACEMENTS.reduce(
    (updated, [pattern, replacement]) => updated.replace(pattern, replacement),
    text,
  )
}

function withOptionalDrift(sample: IntakeSample, enabled: boolean): IntakeSample {
  if (!enabled) {
    return sample
  }
  return {
    ...sample,
    text: applyDriftText(sample.text),
  }
}

function asTrainingExample(sample: IntakeSample, label?: IntakeCategory) {
  return {
    id: sample.id,
    text: sample.text,
    label: label ?? sample.ground_truth.category,
    risk_level: sample.ground_truth.risk_level,
  }
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
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

function presetLabel(preset: ReplayPreset): string {
  return PRESET_OPTIONS.find((option) => option.id === preset)?.label ?? preset
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

function runPresetRegressionSuite(
  samples: IntakeSample[],
  preset: ReplayPreset,
  replayCount: number,
  driftEnabled: boolean,
): RegressionSuiteRow {
  const evaluationSamples = samples.map((sample) => withOptionalDrift(sample, driftEnabled))
  const splitIndex = Math.max(2, Math.floor(evaluationSamples.length / 2))
  const oldSlice = evaluationSamples.slice(0, splitIndex)
  const newSlice = evaluationSamples.slice(splitIndex)

  const model = new OnlineCategoryModel()
  const memory = new ReplayMemory(64, 17)
  const warmup = oldSlice.map((sample) => asTrainingExample(sample))
  model.train(warmup, { epochs: 22, learningRate: 0.2 })

  for (const example of warmup) {
    memory.add(example)
  }

  const beforeOld = evaluateIntakeSamples(oldSlice, model)

  for (const sample of newSlice) {
    const current = asTrainingExample(sample)
    const replay = memory.sampleForPreset(
      preset,
      preset === 'fast_adaptation' ? 0 : replayCount,
    )

    model.train([current, ...replay], {
      epochs: 16,
      learningRate: preset === 'fast_adaptation' ? 0.24 : 0.16,
      exampleWeight: (example) =>
        replayWeightForPreset(preset, {
          ...example,
          risk_level: example.risk_level ?? 'low',
        }),
    })

    memory.add(current)
  }

  const afterOld = evaluateIntakeSamples(oldSlice, model)
  const overall = evaluateIntakeSamples(evaluationSamples, model)
  const delta = regressionDelta([
    { step: 'before_old', metrics: beforeOld },
    { step: 'after_old', metrics: afterOld },
  ])

  return {
    preset,
    before_old_accuracy: beforeOld.overall_accuracy,
    after_old_accuracy: afterOld.overall_accuracy,
    overall_accuracy: overall.overall_accuracy,
    retention_ratio:
      beforeOld.overall_accuracy === 0
        ? 1
        : afterOld.overall_accuracy / beforeOld.overall_accuracy,
    mean_drop: delta.mean_drop,
  }
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<string>('')
  const [requestText, setRequestText] = useState('')

  const [preset, setPreset] = useState<ReplayPreset>('balanced')
  const [simulateDrift, setSimulateDrift] = useState(false)
  const [memoryReplaySize, setMemoryReplaySize] = useState(5)

  const [result, setResult] = useState<ReturnType<typeof runIntakePipeline> | null>(null)
  const [impactRationale, setImpactRationale] = useState<ImpactRationale | null>(null)
  const [predictedCategory, setPredictedCategory] = useState<IntakeCategory | null>(null)

  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)
  const [dispatchLog, setDispatchLog] = useState<DispatchRecord[]>([])

  const [activeTab, setActiveTab] = useState<ArtifactTab>('charter')
  const [isRunning, setIsRunning] = useState(false)
  const [stageIndex, setStageIndex] = useState<number>(-1)

  const [correctionCategory, setCorrectionCategory] = useState<IntakeCategory>(intakeCategories[0])
  const [updateSummary, setUpdateSummary] = useState<UpdateSummary | null>(null)
  const [suiteRows, setSuiteRows] = useState<RegressionSuiteRow[]>([])

  const [error, setError] = useState<string | null>(null)

  const modelRef = useRef<OnlineCategoryModel | null>(null)
  const memoryRef = useRef<ReplayMemory | null>(null)

  useEffect(() => {
    Promise.all([loadIntakeSamples(), loadCategoryCatalog()])
      .then(([loadedSamples, loadedCatalog]) => {
        setSamples(loadedSamples)
        setCatalog(loadedCatalog)

        const firstSample = loadedSamples[0]
        setSelectedSampleId(firstSample?.id ?? '')
        setRequestText(firstSample?.text ?? '')

        const model = new OnlineCategoryModel()
        const warmupExamples = loadedSamples
          .slice(0, Math.min(4, loadedSamples.length))
          .map((sample) => asTrainingExample(sample))
        model.train(warmupExamples, { epochs: 24, learningRate: 0.23 })

        const memory = new ReplayMemory(64, 41)
        for (const example of warmupExamples) {
          memory.add(example)
        }

        modelRef.current = model
        memoryRef.current = memory

        if (firstSample) {
          const prediction = model.predict(firstSample.text)
          setPredictedCategory(prediction)
          setCorrectionCategory(prediction)
        }
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

  const nextHint = useMemo(() => {
    if (error) {
      return 'Data could not be loaded. Refresh once the source is available.'
    }
    if (isRunning) {
      return `Running step ${Math.min(stageIndex + 1, STAGES.length)} of ${STAGES.length}...`
    }
    if (!result) {
      return 'Click Start demo to generate a full optimisation pack.'
    }
    return 'Review the deliverables and send the pack to your workflow tools.'
  }, [error, isRunning, stageIndex, result])

  function stageState(index: number): StageState {
    if (stageIndex < 0) {
      return 'pending'
    }
    if (index < stageIndex) {
      return 'done'
    }
    if (index === stageIndex) {
      return isRunning ? 'active' : 'done'
    }
    return 'pending'
  }

  async function runPipeline() {
    if (!selectedSample || !catalog || !modelRef.current) {
      return
    }

    const normalizedText = requestText.trim() || selectedSample.text
    const baseSample: IntakeSample = {
      ...selectedSample,
      text: normalizedText,
    }

    setIsRunning(true)
    setStageIndex(0)
    setCopyStatus(null)
    setDispatchStatus(null)
    setUpdateSummary(null)
    setSuiteRows([])

    const adaptedSample = withOptionalDrift(baseSample, simulateDrift)
    const prediction = modelRef.current.predict(adaptedSample.text)
    setPredictedCategory(prediction)
    setCorrectionCategory(prediction)

    await nextPaint()

    setStageIndex(1)
    const nextResult = runIntakePipeline(adaptedSample, catalog)
    setResult(nextResult)
    setImpactRationale(buildImpactRationale(nextResult))
    setActiveTab('charter')

    await nextPaint()

    setStageIndex(2)
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

  function applyCorrection() {
    if (!selectedSample || !modelRef.current || !memoryRef.current) {
      return
    }

    const model = modelRef.current
    const memory = memoryRef.current
    const sampleForUpdate: IntakeSample = {
      ...selectedSample,
      text: requestText.trim() || selectedSample.text,
    }
    const adaptedSample = withOptionalDrift(sampleForUpdate, simulateDrift)
    const corrected = asTrainingExample(adaptedSample, correctionCategory)

    const evaluationSet = samples.map((sample) => withOptionalDrift(sample, simulateDrift))
    const before = evaluateIntakeSamples(evaluationSet, model)
    const replay = memory.sampleForPreset(
      preset,
      preset === 'fast_adaptation' ? 0 : memoryReplaySize,
    )

    model.train([corrected, ...replay], {
      epochs: 18,
      learningRate: preset === 'fast_adaptation' ? 0.25 : 0.17,
      exampleWeight: (example) =>
        replayWeightForPreset(preset, {
          ...example,
          risk_level: example.risk_level ?? 'low',
        }),
    })

    memory.add(corrected)

    const after = evaluateIntakeSamples(evaluationSet, model)
    const predictedAfter = model.predict(adaptedSample.text)

    setPredictedCategory(predictedAfter)
    setUpdateSummary({
      preset,
      before_accuracy: before.overall_accuracy,
      after_accuracy: after.overall_accuracy,
      predicted_after: predictedAfter,
    })
  }

  function runRegressionSuite() {
    if (samples.length === 0) {
      return
    }

    const rows = PRESET_OPTIONS.map((option) =>
      runPresetRegressionSuite(samples, option.id, memoryReplaySize, simulateDrift),
    )

    setSuiteRows(rows)
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>Turn one messy internal request into delivery-ready automation in under a minute.</h1>
        <p className="hero-subhead">
          Generate a decision snapshot, project charter, process redesign map, and export payloads
          your team can run immediately.
        </p>
      </header>

      <section className="workspace">
        <aside className="intake-panel">
          <h2>Intake</h2>
          <label>
            Scenario
            <select
              value={selectedSampleId}
              onChange={(event) => handleSampleChange(event.target.value)}
            >
              {samples.map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Incoming request
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={7}
            />
          </label>

          <button className="primary-btn" onClick={() => void runPipeline()} disabled={!selectedSample || isRunning}>
            {isRunning ? 'Generating...' : 'Start demo'}
          </button>

          <p className="hint-text">{nextHint}</p>
          {error ? <p className="error-text">{error}</p> : null}
          {copyStatus ? <p className="status-text">{copyStatus}</p> : null}
          {dispatchStatus ? <p className="status-text success-text">{dispatchStatus}</p> : null}

          <ol className="stage-list">
            {STAGES.map((stage, index) => (
              <li key={stage} className={`stage-item ${stageState(index)}`}>
                <strong>{index + 1}</strong>
                <span>{stage}</span>
              </li>
            ))}
          </ol>
        </aside>

        <section className="deliverable-panel">
          {!result ? (
            <section className="empty-state">
              <h2>Deliverables</h2>
              <p>
                Click <strong>Start demo</strong> to generate all artifacts in one pass.
              </p>
              <ul className="outcome-list">
                <li>Decision snapshot with priority and expected savings</li>
                <li>Lean-style charter with baseline and target metrics</li>
                <li>As-is/to-be process map plus implementation blueprint</li>
                <li>Jira, ServiceNow, and process tracker payloads</li>
              </ul>
            </section>
          ) : (
            <>
              <section className="decision-strip">
                <article>
                  <span>Recommended workflow</span>
                  <strong>{prettyCategory(result.triage.category)}</strong>
                </article>
                <article>
                  <span>Priority</span>
                  <strong>{result.triage.priority}</strong>
                </article>
                <article>
                  <span>Risk level</span>
                  <strong>{prettyCategory(result.triage.risk_level)}</strong>
                </article>
                <article>
                  <span>Savings (hours/month)</span>
                  <strong>{result.triage.est_savings_hours_per_month}</strong>
                </article>
              </section>

              {impactRationale ? (
                <details className="rationale-panel">
                  <summary>Why this savings estimate</summary>
                  <p>
                    Estimate is derived from {impactRationale.manual_steps} manual touchpoints,
                    monthly volume of {metricToText(impactRationale.monthly_volume)}, and baseline
                    cycle time of {metricToText(impactRationale.cycle_time_days)} days.
                  </p>
                  <p>
                    Confidence: <strong>{prettyCategory(impactRationale.confidence)}</strong>
                  </p>
                </details>
              ) : null}

              <nav className="artifact-tabs" aria-label="Deliverable views">
                {ARTIFACT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <section className="artifact-view">
                {activeTab === 'charter' ? (
                  <div className="artifact-block">
                    <h2>Project Charter</h2>
                    <p>
                      <strong>Problem statement:</strong> {result.charter.problem_statement}
                    </p>
                    <p>
                      <strong>Next action:</strong> {result.triage.next_action}
                    </p>
                    <div className="metric-grid">
                      <article>
                        <span>Baseline cycle time (days)</span>
                        <strong>{metricToText(result.charter.baseline_metrics.cycle_time_days)}</strong>
                      </article>
                      <article>
                        <span>Target cycle time (days)</span>
                        <strong>{metricToText(result.charter.target_metrics.cycle_time_days_target)}</strong>
                      </article>
                      <article>
                        <span>Baseline monthly volume</span>
                        <strong>{metricToText(result.charter.baseline_metrics.volume_per_month)}</strong>
                      </article>
                      <article>
                        <span>Expected monthly savings (hours)</span>
                        <strong>
                          {metricToText(
                            result.charter.target_metrics.expected_savings_hours_per_month,
                          )}
                        </strong>
                      </article>
                    </div>
                    <button
                      className="secondary-btn"
                      onClick={() => copyJson('Charter JSON', result.charter)}
                    >
                      Copy charter JSON
                    </button>
                  </div>
                ) : null}

                {activeTab === 'map' ? (
                  <div className="artifact-block">
                    <h2>Process Redesign</h2>
                    <p className="section-note">
                      Compare the current flow with the optimized future-state design.
                    </p>
                    <div className="map-grid">
                      <MermaidDiagram title="As-is" chart={result.asIsMermaid} />
                      <MermaidDiagram title="To-be" chart={result.toBeMermaid} />
                    </div>
                  </div>
                ) : null}

                {activeTab === 'blueprint' ? (
                  <div className="artifact-block">
                    <h2>Automation Blueprint</h2>
                    <div className="blueprint-grid">
                      <article>
                        <h3>Connected systems</h3>
                        <div className="chip-row">
                          {result.blueprint.connectors.map((connector) => (
                            <span key={connector.system}>{connector.system}</span>
                          ))}
                        </div>
                      </article>
                      <article>
                        <h3>Automation sequence</h3>
                        <ol className="step-list">
                          {result.blueprint.steps.map((step) => (
                            <li key={step.id}>{step.name}</li>
                          ))}
                        </ol>
                      </article>
                    </div>

                    <h3>Controls and monitoring</h3>
                    <ul className="bullet-list">
                      {result.blueprint.controls.slice(0, 2).map((control) => (
                        <li key={control.control}>{control.control}</li>
                      ))}
                      {result.blueprint.monitoring.slice(0, 2).map((metric) => (
                        <li key={metric.metric}>{metric.metric}</li>
                      ))}
                    </ul>

                    <button
                      className="secondary-btn"
                      onClick={() => copyJson('Blueprint JSON', result.blueprint)}
                    >
                      Copy blueprint JSON
                    </button>
                  </div>
                ) : null}

                {activeTab === 'export' ? (
                  <div className="artifact-block">
                    <h2>Export Pack</h2>
                    <p className="section-note">
                      Copy payloads or send the pack to downstream delivery tools.
                    </p>

                    <div className="button-row">
                      <button
                        className="secondary-btn"
                        onClick={() => copyJson('Jira payload', result.exports.jira_issue_create)}
                      >
                        Copy Jira payload
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          copyJson('ServiceNow payload', result.exports.servicenow_record_create)
                        }
                      >
                        Copy ServiceNow payload
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => copyJson('Tracker payload', result.exports.process_tracker_row)}
                      >
                        Copy tracker payload
                      </button>
                    </div>

                    <button className="primary-btn send-btn" onClick={sendToDeliveryQueue}>
                      Send pack to delivery queue
                    </button>

                    {dispatchLog.length > 0 ? (
                      <div className="dispatch-log">
                        <h3>Recent dispatches</h3>
                        <ul>
                          {dispatchLog.map((entry) => (
                            <li key={entry.dispatch_id}>
                              <strong>{entry.dispatch_id}</strong> · {entry.timestamp} ·{' '}
                              {entry.destinations.join(', ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </section>
      </section>

      <details className="expert-panel">
        <summary>Governance and safety checks (optional)</summary>
        <div className="expert-content">
          <p className="status-text">
            Use these controls when validating update safety and non-regression behavior.
          </p>

          <label>
            Update policy
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as ReplayPreset)}
            >
              {PRESET_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={simulateDrift}
              onChange={(event) => setSimulateDrift(event.target.checked)}
            />
            Simulate wording and policy drift
          </label>

          <label>
            Historical case sampling: {memoryReplaySize}
            <input
              type="range"
              min={1}
              max={10}
              value={memoryReplaySize}
              onChange={(event) => setMemoryReplaySize(Number(event.target.value))}
            />
          </label>

          <div className="expert-row">
            <label>
              Correct predicted category
              <select
                value={correctionCategory}
                onChange={(event) => setCorrectionCategory(event.target.value as IntakeCategory)}
              >
                {intakeCategories.map((category) => (
                  <option key={category} value={category}>
                    {prettyCategory(category)}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-btn" onClick={applyCorrection}>
              Apply correction
            </button>
            <button className="secondary-btn" onClick={runRegressionSuite}>
              Run regression suite
            </button>
          </div>

          {predictedCategory ? (
            <p className="status-text">
              Current prediction: <strong>{prettyCategory(predictedCategory)}</strong>
            </p>
          ) : null}

          {updateSummary ? (
            <p className="status-text">
              {presetLabel(updateSummary.preset)} accuracy: {formatPct(updateSummary.before_accuracy)}{' '}
              {'->'} {formatPct(updateSummary.after_accuracy)}. Updated prediction:{' '}
              {prettyCategory(updateSummary.predicted_after)}
            </p>
          ) : null}

          {suiteRows.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Old accuracy before</th>
                    <th>Old accuracy after</th>
                    <th>Retention</th>
                    <th>Mean regression drop</th>
                    <th>Overall accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {suiteRows.map((row) => (
                    <tr key={row.preset}>
                      <td>{presetLabel(row.preset)}</td>
                      <td>{formatPct(row.before_old_accuracy)}</td>
                      <td>{formatPct(row.after_old_accuracy)}</td>
                      <td>{formatPct(row.retention_ratio)}</td>
                      <td>{formatPct(row.mean_drop)}</td>
                      <td>{formatPct(row.overall_accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </details>
    </main>
  )
}

export default App
