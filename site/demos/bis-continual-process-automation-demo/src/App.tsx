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

const PRESET_OPTIONS: Array<{ id: ReplayPreset; label: string; intent: string }> = [
  {
    id: 'balanced',
    label: 'Balanced',
    intent: 'Good default for day-to-day automation updates with stable retention.',
  },
  {
    id: 'fast_adaptation',
    label: 'Fast adaptation',
    intent: 'Learns new request patterns fastest, with higher non-regression risk.',
  },
  {
    id: 'retention_first',
    label: 'Retention-first',
    intent: 'Prioritizes high-risk replay to protect previously stable workflows.',
  },
]

const STAGES = [
  {
    title: 'Read and structure intake',
    detail: 'Extract systems, approval chain, risk clues, and bottleneck signals from raw text.',
  },
  {
    title: 'Classify and prioritize',
    detail: 'Predict workflow category and estimate automation potential and savings.',
  },
  {
    title: 'Generate delivery artifacts',
    detail: 'Build charter, process map, and implementation blueprint.',
  },
  {
    title: 'Prepare export payloads',
    detail: 'Create copy-ready payloads for Jira, ServiceNow, and process tracking.',
  },
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

  const [showExpert, setShowExpert] = useState(false)
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

  const activePreset = PRESET_OPTIONS.find((option) => option.id === preset)

  const progress =
    stageIndex < 0
      ? 0
      : Math.round(
          (Math.min(stageIndex + (isRunning ? 0.4 : 1), STAGES.length) / STAGES.length) * 100,
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
      return 'Resolve data-loading issue before running the demo.'
    }
    if (!result) {
      return 'Start demo to transform one real intake into ready-to-implement artifacts.'
    }
    if (isRunning) {
      return 'Pipeline is running. Watch each transformation stage complete.'
    }
    return 'Review outputs, then open Expert mode only if you want model correction and regression analysis.'
  }, [error, isRunning, result])

  const automationPack = useMemo(() => {
    if (!result) {
      return null
    }

    return {
      generated_for: result.sample.id,
      intake_title: result.sample.title,
      model_context: {
        preset,
        predicted_category: predictedCategory,
        extracted_signals: result.extracted,
      },
      outputs: {
        triage: result.triage,
        charter: result.charter,
        process_map_to_be: result.toBeMermaid,
        blueprint: result.blueprint,
        export_payloads: result.exports,
      },
    }
  }, [predictedCategory, preset, result])

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
    }, 700)
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

  const revealSignals = result !== null && stageIndex >= 0
  const revealTriage = result !== null && stageIndex >= 1
  const revealArtifacts = result !== null && stageIndex >= 2
  const revealExports = result !== null && stageIndex >= 3 && !isRunning

  return (
    <main className="app-shell">
      <header className="hero-card">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>Turn one messy request into execution-ready process automation artifacts.</h1>
        <p className="subhead">
          One click generates a standardized charter, process map, blueprint, and export payloads
          your team can directly move into delivery tools.
        </p>
      </header>

      <section className="control-card">
        <div className="control-row">
          <label>
            Intake sample
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

          <div className="preset-group" role="radiogroup" aria-label="Training preset">
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`preset-chip ${preset === option.id ? 'active' : ''}`}
                onClick={() => setPreset(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button className="primary-btn" onClick={startDemo} disabled={!selectedSample || isRunning}>
            {isRunning ? 'Running...' : 'Start demo'}
          </button>
        </div>

        <p className="preset-intent">{activePreset?.intent}</p>
        <p className="next-hint">{nextHint}</p>
        {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}

        <div className="progress-wrap" aria-label="Pipeline progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <ol className="stage-list">
          {STAGES.map((stage, index) => {
            const status = stageState(index)
            return (
              <li key={stage.title} className={`stage-item ${status}`}>
                <p className="stage-title">{stage.title}</p>
                <p className="stage-detail">{stage.detail}</p>
              </li>
            )
          })}
        </ol>
      </section>

      {!result ? (
        <section className="artifact-card">
          <h2>What You Will See</h2>
          <p>
            The demo reveals each transformation step, so you can track exactly how the intake is
            converted into operational deliverables.
          </p>
        </section>
      ) : (
        <section className="artifact-stack">
          <section className="artifact-card">
            <h2>Input to Output</h2>
            <div className="before-after">
              <article>
                <h3>Raw Intake</h3>
                <p>{result.sample.text}</p>
              </article>
              <article>
                <h3>Automation Outcome</h3>
                <p>
                  Category <strong>{result.triage.category}</strong>, priority{' '}
                  <strong>{result.triage.priority}</strong>, estimated savings{' '}
                  <strong>{result.triage.est_savings_hours_per_month}h/month</strong>.
                </p>
              </article>
            </div>
          </section>

          {revealSignals ? (
            <section className="artifact-card">
              <h2>What The Model Understood</h2>
              <div className="signal-grid">
                <article>
                  <h3>Predicted category</h3>
                  <p>{predictedCategory ?? 'n/a'}</p>
                </article>
                <article>
                  <h3>Key systems</h3>
                  <div className="chip-row">
                    {result.extracted.key_systems.length > 0
                      ? result.extracted.key_systems.map((item) => <span key={item}>{item}</span>)
                      : 'None detected'}
                  </div>
                </article>
                <article>
                  <h3>Approval roles</h3>
                  <div className="chip-row">
                    {result.extracted.approval_roles.length > 0
                      ? result.extracted.approval_roles.map((item) => <span key={item}>{item}</span>)
                      : 'None detected'}
                  </div>
                </article>
                <article>
                  <h3>Pain signals</h3>
                  <div className="chip-row">
                    {result.extracted.pain_keywords.length > 0
                      ? result.extracted.pain_keywords.map((item) => <span key={item}>{item}</span>)
                      : 'None detected'}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {revealTriage ? (
            <section className="artifact-card">
              <h2>Triage Snapshot</h2>
              <div className="kv-grid">
                <p>
                  <span>Risk</span>
                  <strong>{result.triage.risk_level}</strong>
                </p>
                <p>
                  <span>Automation score</span>
                  <strong>{result.triage.automation_score}</strong>
                </p>
                <p>
                  <span>Next action</span>
                  <strong>{result.triage.next_action}</strong>
                </p>
                <p>
                  <span>Manual touchpoints</span>
                  <strong>{result.extracted.manual_step_count}</strong>
                </p>
              </div>
            </section>
          ) : null}

          {revealArtifacts ? (
            <>
              <section className="artifact-card">
                <h2>Project Charter</h2>
                <p>
                  <strong>Problem statement:</strong> {result.charter.problem_statement}
                </p>
                <h3>Target metrics</h3>
                <ul className="bullet-list">
                  {Object.entries(result.charter.target_metrics).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {value === null ? 'n/a' : String(value)}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="artifact-card">
                <h2>To-Be Process Map</h2>
                <MermaidDiagram title="Optimized workflow" chart={result.toBeMermaid} />
              </section>

              <section className="artifact-card">
                <h2>Automation Blueprint</h2>
                <pre>{JSON.stringify(result.blueprint, null, 2)}</pre>
              </section>
            </>
          ) : null}

          {revealExports ? (
            <section className="artifact-card">
              <h2>Export Payload Bundle</h2>
              <pre>{JSON.stringify(result.exports, null, 2)}</pre>
              <div className="button-row">
                <button className="secondary-btn" onClick={() => copyJson('Export payload bundle', result.exports)}>
                  Copy export payloads
                </button>
                <button className="secondary-btn" onClick={() => copyJson('Automation pack', automationPack)}>
                  Copy full automation pack
                </button>
              </div>
              <p className="integration-note">
                Payload shape mirrors common ticketing/tracker APIs, so this output can be moved
                directly into internal execution workflows.
              </p>
            </section>
          ) : null}

          <details className="expert-panel" open={showExpert} onToggle={(event) => setShowExpert(event.currentTarget.open)}>
            <summary>Expert mode (optional): correction + non-regression checks</summary>

            <div className="expert-content">
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

              <div className="expert-row">
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
                <button className="secondary-btn" onClick={applyCorrection}>
                  Apply correction
                </button>
                <button className="secondary-btn" onClick={runRegressionSuite}>
                  Run regression suite
                </button>
              </div>

              {updateSummary ? (
                <p className="status-text">
                  Updated with {updateSummary.preset}: accuracy {formatPct(updateSummary.before_accuracy)} →{' '}
                  {formatPct(updateSummary.after_accuracy)}; now predicts{' '}
                  <strong>{updateSummary.predicted_after}</strong>.
                </p>
              ) : null}

              {suiteRows.length > 0 ? (
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
              ) : null}
            </div>
          </details>
        </section>
      )}
    </main>
  )
}

export default App
