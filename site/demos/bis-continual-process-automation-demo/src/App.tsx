import { useEffect, useMemo, useRef, useState } from 'react'

import {
  ReplayMemory,
  replayWeightForPreset,
  type ReplayPreset,
} from './cl/memory'
import { OnlineCategoryModel } from './cl/onlineModel'
import { evaluateIntakeSamples, regressionDelta } from './cl/regression'
import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline } from './domain/pipeline'
import {
  intakeCategories,
  type CategoryCatalog,
  type IntakeCategory,
  type IntakeSample,
} from './domain/types'

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

const PRESET_OPTIONS: Array<{ id: ReplayPreset; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'fast_adaptation', label: 'Fast adaptation' },
  { id: 'retention_first', label: 'Retention-first' },
]

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

function runPresetRegressionSuite(samples: IntakeSample[], preset: ReplayPreset): RegressionSuiteRow {
  // Fixed split simulates "previously stable workflows" vs "new updates".
  const splitIndex = Math.max(2, Math.floor(samples.length / 2))
  const oldSlice = samples.slice(0, splitIndex)
  const newSlice = samples.slice(splitIndex)

  const model = new OnlineCategoryModel()
  const memory = new ReplayMemory(64, 17)
  const warmup = oldSlice.map((sample) => asTrainingExample(sample))
  model.train(warmup, { epochs: 20, learningRate: 0.2 })
  for (const example of warmup) {
    memory.add(example)
  }

  const beforeOld = evaluateIntakeSamples(oldSlice, model)

  for (const sample of newSlice) {
    const current = asTrainingExample(sample)
    const replay = memory.sampleForPreset(preset, preset === 'fast_adaptation' ? 0 : 5)
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
  const overall = evaluateIntakeSamples(samples, model)
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
          const firstPrediction = model.predict(firstSample.text)
          setPredictedCategory(firstPrediction)
          setCorrectionCategory(firstPrediction)
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

  function runPipeline(sample: IntakeSample | null) {
    if (!sample || !catalog || !modelRef.current) {
      return
    }
    setResult(runIntakePipeline(sample, catalog))
    const prediction = modelRef.current.predict(sample.text)
    setPredictedCategory(prediction)
    setCorrectionCategory(prediction)
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

  function applyCorrection() {
    if (!selectedSample || !modelRef.current || !memoryRef.current) {
      return
    }

    const model = modelRef.current
    const memory = memoryRef.current
    const corrected = asTrainingExample(selectedSample, correctionCategory)

    const before = evaluateIntakeSamples(samples, model)
    const replay = memory.sampleForPreset(preset, preset === 'fast_adaptation' ? 0 : 5)
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
    const after = evaluateIntakeSamples(samples, model)
    const predictedAfter = model.predict(selectedSample.text)
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
    const rows = PRESET_OPTIONS.map((option) => runPresetRegressionSuite(samples, option.id))
    setSuiteRows(rows)
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
              <button className="secondary" onClick={runRegressionSuite}>
                Run regression suite
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
                <span>Predicted category</span>
                <strong>{predictedCategory ?? 'n/a'}</strong>
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
            <div className="controls compact">
              <label>
                Correct category
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
              <button className="secondary" onClick={applyCorrection}>
                Apply correction (update model)
              </button>
            </div>
            {updateSummary ? (
              <p className="status">
                Last update ({updateSummary.preset}) overall accuracy {formatPct(updateSummary.before_accuracy)} →{' '}
                {formatPct(updateSummary.after_accuracy)}. Current sample now predicts{' '}
                <strong>{updateSummary.predicted_after}</strong>.
              </p>
            ) : null}
          </section>

          <section className="card">
            <h2>Regression Safety</h2>
            <p>
              Compare retention of previously seen workflows after new updates using each preset.
            </p>
            {suiteRows.length === 0 ? (
              <p className="status">Run regression suite to view before/after retention metrics.</p>
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
                        <td>{PRESET_OPTIONS.find((option) => option.id === row.preset)?.label}</td>
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
