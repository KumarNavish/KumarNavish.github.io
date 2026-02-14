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

type StageState = 'pending' | 'active' | 'done'

const PRESET_OPTIONS: Array<{ id: ReplayPreset; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'fast_adaptation', label: 'Fast adaptation' },
  { id: 'retention_first', label: 'Retention-first' },
]

const STAGES = [
  'Understand the request context',
  'Generate charter, maps, and blueprint',
  'Prepare export payloads for delivery tools',
] as const

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

  const [preset, setPreset] = useState<ReplayPreset>('balanced')
  const [simulateDrift, setSimulateDrift] = useState(false)
  const [memoryReplaySize, setMemoryReplaySize] = useState(5)

  const [result, setResult] = useState<ReturnType<typeof runIntakePipeline> | null>(null)
  const [predictedCategory, setPredictedCategory] = useState<IntakeCategory | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [stageIndex, setStageIndex] = useState<number>(-1)

  const [correctionCategory, setCorrectionCategory] = useState<IntakeCategory>(intakeCategories[0])
  const [updateSummary, setUpdateSummary] = useState<UpdateSummary | null>(null)
  const [suiteRows, setSuiteRows] = useState<RegressionSuiteRow[]>([])

  const [error, setError] = useState<string | null>(null)

  const modelRef = useRef<OnlineCategoryModel | null>(null)
  const memoryRef = useRef<ReplayMemory | null>(null)
  const runTimerRef = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([loadIntakeSamples(), loadCategoryCatalog()])
      .then(([loadedSamples, loadedCatalog]) => {
        setSamples(loadedSamples)
        setCatalog(loadedCatalog)

        const firstSample = loadedSamples[0]
        setSelectedSampleId(firstSample?.id ?? '')

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

  useEffect(() => {
    return () => {
      if (runTimerRef.current !== null) {
        window.clearInterval(runTimerRef.current)
      }
    }
  }, [])

  const selectedSample = useMemo(
    () => samples.find((sample) => sample.id === selectedSampleId) ?? samples[0] ?? null,
    [samples, selectedSampleId],
  )

  const stageState = (index: number): StageState => {
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

  const nextHint = useMemo(() => {
    if (error) {
      return 'Data could not be loaded. Refresh once the source is available.'
    }
    if (!result) {
      return 'Choose an intake sample and click Start demo.'
    }
    if (isRunning) {
      return 'Generating structured deliverables...'
    }
    return 'Review the outputs and copy payloads into your delivery workflow.'
  }, [error, isRunning, result])

  function clearRunTimer() {
    if (runTimerRef.current !== null) {
      window.clearInterval(runTimerRef.current)
      runTimerRef.current = null
    }
  }

  function runPipeline(sample: IntakeSample | null) {
    if (!sample || !catalog || !modelRef.current) {
      return
    }

    const adaptedSample = withOptionalDrift(sample, simulateDrift)
    const nextResult = runIntakePipeline(adaptedSample, catalog)
    const prediction = modelRef.current.predict(adaptedSample.text)

    setResult(nextResult)
    setPredictedCategory(prediction)
    setCorrectionCategory(prediction)
    setUpdateSummary(null)
    setSuiteRows([])
    setCopyStatus(null)

    clearRunTimer()
    setStageIndex(0)
    setIsRunning(true)

    runTimerRef.current = window.setInterval(() => {
      setStageIndex((current) => {
        if (current >= STAGES.length - 1) {
          clearRunTimer()
          setIsRunning(false)
          return current
        }

        const next = current + 1
        if (next >= STAGES.length - 1) {
          clearRunTimer()
          setIsRunning(false)
        }
        return next
      })
    }, 650)
  }

  function startDemo() {
    if (!selectedSample) {
      return
    }
    runPipeline(selectedSample)
  }

  async function copyJson(label: string, payload: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopyStatus(`${label} copied`)
    } catch {
      setCopyStatus(`Could not copy ${label}`)
    }
  }

  function applyCorrection() {
    if (!selectedSample || !modelRef.current || !memoryRef.current) {
      return
    }

    const model = modelRef.current
    const memory = memoryRef.current
    const adaptedSample = withOptionalDrift(selectedSample, simulateDrift)
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

  const revealSummary = result !== null && stageIndex >= 0
  const revealArtifacts = result !== null && stageIndex >= 1
  const revealExports = result !== null && stageIndex >= 2

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>From messy intake to delivery-ready automation artifacts in under a minute.</h1>
        <p className="hero-subhead">
          Turn one raw request into a project charter, process redesign map, automation blueprint,
          and export payloads your team can execute.
        </p>
        <div className="hero-actions">
          <button className="primary-btn hero-btn" onClick={startDemo} disabled={!selectedSample || isRunning}>
            {isRunning ? 'Generating...' : 'Start demo'}
          </button>
          <p className="hero-hint">{nextHint}</p>
        </div>
      </header>

      <section className="main-grid">
        <aside className="left-rail">
          <section className="panel">
            <h2>1. Intake</h2>
            <label>
              Select request example
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

            {selectedSample ? (
              <article className="request-preview">
                <span>{selectedSample.channel.replace('_', ' ')}</span>
                <p>{selectedSample.text}</p>
              </article>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
            {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
          </section>

          <section className="panel">
            <h2>2. Guided Flow</h2>
            <ol className="stage-list">
              {STAGES.map((stage, index) => (
                <li key={stage} className={`stage-item ${stageState(index)}`}>
                  <strong>{index + 1}</strong>
                  <span>{stage}</span>
                </li>
              ))}
            </ol>
          </section>

          <details className="expert-panel">
            <summary>Expert mode (optional)</summary>
            <div className="expert-content">
              <p className="status-text">
                Optional controls for retention behavior and correction testing.
              </p>

              <label>
                Update strategy
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
                Simulate wording/policy drift
              </label>

              <label>
                Replay memory size: {memoryReplaySize}
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
                  {presetLabel(updateSummary.preset)} accuracy: {formatPct(updateSummary.before_accuracy)}
                  {' -> '}
                  {formatPct(updateSummary.after_accuracy)}. Updated prediction:{' '}
                  {prettyCategory(updateSummary.predicted_after)}
                </p>
              ) : null}

              {suiteRows.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Preset</th>
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
        </aside>

        <section className="right-rail">
          {!result ? (
            <section className="panel empty-state">
              <h2>3. Deliverables</h2>
              <p>
                Click <strong>Start demo</strong> to generate the full optimization pack.
              </p>
              <ul className="outcome-list">
                <li>Decision snapshot with priority and expected savings</li>
                <li>Project charter with baseline and target metrics</li>
                <li>As-is/to-be process map and implementation blueprint</li>
                <li>Copy-ready Jira, ServiceNow, and tracker payloads</li>
              </ul>
            </section>
          ) : (
            <>
              {revealSummary ? (
                <section className="panel">
                  <h2>3. Decision Snapshot</h2>
                  <div className="metric-grid">
                    <article>
                      <span>Recommended workflow</span>
                      <strong>{prettyCategory(result.triage.category)}</strong>
                    </article>
                    <article>
                      <span>Delivery priority</span>
                      <strong>{result.triage.priority}</strong>
                    </article>
                    <article>
                      <span>Risk level</span>
                      <strong>{prettyCategory(result.triage.risk_level)}</strong>
                    </article>
                    <article>
                      <span>Estimated hours saved per month</span>
                      <strong>{result.triage.est_savings_hours_per_month}</strong>
                    </article>
                  </div>
                </section>
              ) : null}

              {revealArtifacts ? (
                <>
                  <section className="panel">
                    <h2>4. Project Charter</h2>
                    <p>
                      <strong>Problem statement:</strong> {result.charter.problem_statement}
                    </p>
                    <p>
                      <strong>Recommended next action:</strong> {result.triage.next_action}
                    </p>
                    <div className="metric-grid compact">
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
                  </section>

                  <section className="panel">
                    <h2>5. Process Redesign</h2>
                    <p className="section-note">
                      Compare the current flow against the optimized future-state process.
                    </p>
                    <div className="map-grid">
                      <MermaidDiagram title="As-is process" chart={result.asIsMermaid} />
                      <MermaidDiagram title="To-be process" chart={result.toBeMermaid} />
                    </div>
                  </section>

                  <section className="panel">
                    <h2>6. Automation Blueprint</h2>
                    <div className="two-col-list">
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
                  </section>
                </>
              ) : null}

              {revealExports ? (
                <section className="panel">
                  <h2>7. Export Pack</h2>
                  <p className="section-note">
                    Copy these payloads into your project tracker and service workflow tools.
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

                  <p className="integration-note">
                    Integration note: Payloads are shaped like ticketing and tracker APIs to show
                    direct transferability.
                  </p>
                </section>
              ) : null}
            </>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
