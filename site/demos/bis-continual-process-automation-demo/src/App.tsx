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

type FlowStep = 'start' | 'correct' | 'regression'

const PRESET_OPTIONS: Array<{ id: ReplayPreset; label: string; intent: string }> = [
  {
    id: 'balanced',
    label: 'Balanced',
    intent: 'Good default for daily process updates and retention.',
  },
  {
    id: 'fast_adaptation',
    label: 'Fast adaptation',
    intent: 'Adapts quickest to new patterns, with higher regression risk.',
  },
  {
    id: 'retention_first',
    label: 'Retention-first',
    intent: 'Prioritizes high-risk replay to protect established workflows.',
  },
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

function renderMetricEntries(metrics: Record<string, number | string | null>) {
  return (
    <ul className="bullet-list">
      {Object.entries(metrics).map(([key, value]) => (
        <li key={key}>
          <strong>{key}:</strong> {value === null ? 'n/a' : String(value)}
        </li>
      ))}
    </ul>
  )
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
  const [result, setResult] = useState<ReturnType<typeof runIntakePipeline> | null>(null)

  const [preset, setPreset] = useState<ReplayPreset>('balanced')
  const [predictedCategory, setPredictedCategory] = useState<IntakeCategory | null>(null)
  const [correctionCategory, setCorrectionCategory] = useState<IntakeCategory>(intakeCategories[0])
  const [updateSummary, setUpdateSummary] = useState<UpdateSummary | null>(null)
  const [suiteRows, setSuiteRows] = useState<RegressionSuiteRow[]>([])

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [simulateDrift, setSimulateDrift] = useState(false)
  const [memoryReplaySize, setMemoryReplaySize] = useState(5)

  const [flowStep, setFlowStep] = useState<FlowStep>('start')
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
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

  const activePreset = PRESET_OPTIONS.find((option) => option.id === preset)

  function runPipeline(sample: IntakeSample | null) {
    if (!sample || !catalog || !modelRef.current) {
      return
    }

    const adaptedSample = withOptionalDrift(sample, simulateDrift)
    setResult(runIntakePipeline(adaptedSample, catalog))

    const prediction = modelRef.current.predict(adaptedSample.text)
    setPredictedCategory(prediction)
    setCorrectionCategory(prediction)
    setUpdateSummary(null)
    setCopyStatus(null)
    setFlowStep('correct')
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
    setFlowStep('regression')
  }

  function runRegressionAndExport() {
    if (samples.length === 0) {
      return
    }

    const rows = PRESET_OPTIONS.map((option) =>
      runPresetRegressionSuite(samples, option.id, memoryReplaySize, simulateDrift),
    )

    setSuiteRows(rows)
    setCopyStatus('Regression refreshed. Export payloads are ready below.')
    setFlowStep('regression')
  }

  return (
    <main className="shell">
      <header className="hero card">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>Intake a messy request. Get charter, process maps, blueprint, and export payloads.</h1>
        <p className="value-prop">
          Turn process-improvement requests into structured work artifacts with built-in regression
          safety, so updates do not break previously stable workflows.
        </p>
      </header>

      <div className="layout">
        <aside className="rail">
          <section className="card rail-card">
            <h2>Intake</h2>
            {error ? <p className="status error">{error}</p> : null}
            {!error && samples.length === 0 ? <p className="status">Loading intake samples...</p> : null}
            {samples.length > 0 ? (
              <>
                <label>
                  Sample request
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

                <label>
                  Update preset
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

                <p className="helper">{activePreset?.intent}</p>
              </>
            ) : null}
          </section>

          <section className="card rail-card">
            <h2>Guided Flow</h2>
            <ol className="flow-list">
              <li className={flowStep === 'start' ? 'active' : ''}>
                <button className="primary" onClick={startDemo}>
                  Start demo
                </button>
                <p>Generate triage, charter, process maps, blueprint, and exports instantly.</p>
              </li>
              <li className={flowStep === 'correct' ? 'active' : ''}>
                <button className="secondary" onClick={applyCorrection} disabled={!result}>
                  Apply correction
                </button>
                <p>Correct category prediction to update the online model safely.</p>
              </li>
              <li className={flowStep === 'regression' ? 'active' : ''}>
                <button className="secondary" onClick={runRegressionAndExport} disabled={!result}>
                  Run regression + export
                </button>
                <p>Check retention metrics and use ticketing-ready payloads.</p>
              </li>
            </ol>

            <button className="link-button" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? 'Hide advanced' : 'Show advanced'}
            </button>

            {showAdvanced ? (
              <div className="advanced-panel">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={simulateDrift}
                    onChange={(event) => setSimulateDrift(event.target.checked)}
                  />
                  Simulate wording/policy drift
                </label>
                <label>
                  Memory replay size: {memoryReplaySize}
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={memoryReplaySize}
                    onChange={(event) => setMemoryReplaySize(Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}

            {copyStatus ? <p className="status">{copyStatus}</p> : null}
          </section>
        </aside>

        <section className="content">
          {!result ? (
            <section className="card artifact-card">
              <h2>Ready</h2>
              <p>Click “Start demo” to produce complete artifacts in one pass.</p>
            </section>
          ) : (
            <>
              <section className="card artifact-card">
                <h2>Triage & Correction</h2>
                <div className="kv-grid">
                  <p>
                    <span>Predicted category</span>
                    <strong>{predictedCategory ?? 'n/a'}</strong>
                  </p>
                  <p>
                    <span>Target category</span>
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
                    <span>Estimated monthly savings</span>
                    <strong>{result.triage.est_savings_hours_per_month} hours</strong>
                  </p>
                </div>

                <label>
                  Correct predicted category
                  <select
                    value={correctionCategory}
                    onChange={(event) => setCorrectionCategory(event.target.value as IntakeCategory)}
                  >
                    {intakeCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                {updateSummary ? (
                  <p className="status">
                    Update ({updateSummary.preset}): overall accuracy {formatPct(updateSummary.before_accuracy)} →{' '}
                    {formatPct(updateSummary.after_accuracy)}. Current sample now predicts{' '}
                    <strong>{updateSummary.predicted_after}</strong>.
                  </p>
                ) : null}
              </section>

              <section className="card artifact-card">
                <h2>Project Charter</h2>
                <p>
                  <strong>Problem statement:</strong> {result.charter.problem_statement}
                </p>
                <h3>Scope In</h3>
                <ul className="bullet-list">
                  {result.charter.scope_in.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <h3>Scope Out</h3>
                <ul className="bullet-list">
                  {result.charter.scope_out.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <h3>Baseline Metrics</h3>
                {renderMetricEntries(result.charter.baseline_metrics)}
                <h3>Target Metrics</h3>
                {renderMetricEntries(result.charter.target_metrics)}
                <button className="secondary" onClick={() => copyJson('Charter JSON', result.charter)}>
                  Copy charter JSON
                </button>
              </section>

              <section className="card artifact-card">
                <h2>Process Maps</h2>
                <div className="maps-grid">
                  <MermaidDiagram title="As-Is Map" chart={result.asIsMermaid} />
                  <MermaidDiagram title="To-Be Map" chart={result.toBeMermaid} />
                </div>
              </section>

              <section className="card artifact-card">
                <h2>Automation Blueprint</h2>
                <pre>{JSON.stringify(result.blueprint, null, 2)}</pre>
                <button className="secondary" onClick={() => copyJson('Blueprint JSON', result.blueprint)}>
                  Copy blueprint JSON
                </button>
              </section>

              <section className="card artifact-card">
                <h2>Regression Safety</h2>
                {suiteRows.length === 0 ? (
                  <p className="status">Run “Run regression + export” to compare retention across presets.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Preset</th>
                          <th>Old accuracy (before)</th>
                          <th>Old accuracy (after)</th>
                          <th>Retention</th>
                          <th>Mean regression drop</th>
                          <th>Overall accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suiteRows.map((row) => (
                          <tr key={row.preset}>
                            <td>{PRESET_OPTIONS.find((item) => item.id === row.preset)?.label}</td>
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
                )}
              </section>

              <section className="card artifact-card">
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
                  onClick={() => copyJson('ServiceNow payload', result.exports.servicenow_record_create)}
                >
                  Copy ServiceNow payload
                </button>

                <h3>Process tracker row</h3>
                <pre>{JSON.stringify(result.exports.process_tracker_row, null, 2)}</pre>
                <p className="integration-note">
                  These payloads mirror ticketing/tracker API shapes to show direct transferability into
                  internal delivery systems.
                </p>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
