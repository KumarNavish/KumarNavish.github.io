import { useEffect, useMemo, useState } from 'react'

import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline, type PipelineResult } from './domain/pipeline'
import type { CategoryCatalog, IntakeSample } from './domain/types'

type RunStage = 'idle' | 'analyzing' | 'building' | 'checking' | 'ready' | 'failed'
type PresetId = 'balanced' | 'fast' | 'retention'

interface Preset {
  id: PresetId
  label: string
  note: string
}

const PRESETS: Preset[] = [
  { id: 'balanced', label: 'Balanced', note: 'Default update and safety checks.' },
  { id: 'fast', label: 'Fast Adaptation', note: 'Prioritize speed of change.' },
  { id: 'retention', label: 'Retention-first', note: 'Prioritize non-regression.' },
]

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function pretty(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDays(value: number | null): string {
  return value === null ? 'n/a' : `${value}d`
}

function simulateDrift(text: string): string {
  return text
    .replace(/approval/gi, 'sign-off')
    .replace(/manual/gi, 'human')
    .replace(/ticket/gi, 'case')
}

function fieldLabel(key: string): string {
  return key.replace(/_/g, ' ')
}

function stageLabel(stage: RunStage): string {
  if (stage === 'idle') {
    return 'Ready'
  }
  if (stage === 'analyzing') {
    return 'Reading request'
  }
  if (stage === 'building') {
    return 'Building packet'
  }
  if (stage === 'checking') {
    return 'Running safety check'
  }
  if (stage === 'ready') {
    return 'Packet ready'
  }
  return 'Run failed'
}

function stageRank(stage: RunStage): number {
  if (stage === 'idle') {
    return 0
  }
  if (stage === 'analyzing') {
    return 1
  }
  if (stage === 'building') {
    return 2
  }
  if (stage === 'checking') {
    return 3
  }
  return 4
}

async function copyJson(label: string, payload: unknown): Promise<string> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    return `${label} copied.`
  } catch {
    return 'Clipboard blocked in this browser.'
  }
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [requestText, setRequestText] = useState('')

  const [presetId, setPresetId] = useState<PresetId>('balanced')
  const [driftEnabled, setDriftEnabled] = useState(false)

  const [result, setResult] = useState<PipelineResult | null>(null)
  const [stage, setStage] = useState<RunStage>('idle')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    Promise.all([loadIntakeSamples(), loadCategoryCatalog()])
      .then(([loadedSamples, loadedCatalog]) => {
        setSamples(loadedSamples)
        setCatalog(loadedCatalog)

        const first = loadedSamples[0]
        if (first) {
          setSelectedId(first.id)
          setRequestText(first.text)
        }
      })
      .catch((loadError) => {
        if (loadError instanceof Error) {
          setError(loadError.message)
          return
        }
        setError('Unknown data loading error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const selectedSample = useMemo(
    () => samples.find((sample) => sample.id === selectedId) ?? samples[0] ?? null,
    [samples, selectedId],
  )

  const activePreset = useMemo(
    () => PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[0],
    [presetId],
  )

  const baselineDays = useMemo(() => {
    if (result) {
      return toNumber(result.charter.baseline_metrics.cycle_time_days)
    }
    return selectedSample?.ground_truth.baseline_cycle_time_days ?? null
  }, [result, selectedSample])

  const targetDays = useMemo(() => {
    if (result) {
      return toNumber(result.charter.target_metrics.cycle_time_days_target)
    }
    if (baselineDays === null) {
      return null
    }
    return Math.max(1, Math.round(baselineDays * 0.6))
  }, [result, baselineDays])

  const leadTimeReduction = useMemo(() => {
    if (baselineDays === null || targetDays === null || baselineDays <= 0) {
      return null
    }
    return Math.max(0, Math.round(((baselineDays - targetDays) / baselineDays) * 100))
  }, [baselineDays, targetDays])

  const beforeTouches = result?.extracted.manual_step_count ?? 4
  const afterTouches = toNumber(result?.charter.target_metrics.manual_handoffs_target) ?? Math.max(1, beforeTouches - 2)

  const beforeFlow = useMemo(() => {
    if (!selectedSample) {
      return []
    }
    return [
      `Request enters via ${selectedSample.channel}.`,
      'Analyst manually triages and classifies.',
      'Missing details are chased across teams.',
      'Approvals and status are updated manually.',
    ]
  }, [selectedSample])

  const afterFlow = useMemo(() => {
    if (!result) {
      return ['Awaiting run', 'Awaiting run', 'Awaiting run', 'Awaiting run']
    }

    return [
      `Auto-classify into ${pretty(result.triage.category)}.`,
      `${Object.keys(result.charter.baseline_metrics).length} baseline signals captured.`,
      `${result.blueprint.steps.length} orchestrated automation steps.`,
      'Export payloads generated for execution tools.',
    ]
  }, [result])

  async function handleRun(): Promise<void> {
    if (!selectedSample || !catalog) {
      return
    }

    setCopyStatus('')
    setError('')
    setStage('analyzing')

    try {
      await sleep(120)

      const normalizedText = requestText.trim().length > 0 ? requestText : selectedSample.text
      const pipelineInput: IntakeSample = {
        ...selectedSample,
        text: driftEnabled ? simulateDrift(normalizedText) : normalizedText,
      }

      setStage('building')
      await sleep(120)

      const pipelineResult = runIntakePipeline(pipelineInput, catalog)
      setResult(pipelineResult)

      setStage('checking')
      await sleep(120)

      setStage('ready')
    } catch (runError) {
      setStage('failed')
      if (runError instanceof Error) {
        setError(runError.message)
        return
      }
      setError('Pipeline run failed')
    }
  }

  function handleSampleChange(nextId: string): void {
    setSelectedId(nextId)
    const nextSample = samples.find((sample) => sample.id === nextId)
    if (nextSample) {
      setRequestText(nextSample.text)
      setResult(null)
      setStage('idle')
      setCopyStatus('')
      setError('')
    }
  }

  function handleReset(): void {
    if (!selectedSample) {
      return
    }
    setRequestText(selectedSample.text)
    setResult(null)
    setStage('idle')
    setCopyStatus('')
    setError('')
  }

  async function handleCopy(label: string, payload: unknown): Promise<void> {
    setCopyStatus(await copyJson(label, payload))
  }

  if (loading) {
    return (
      <main className="demo-shell">
        <section className="loading-card">
          <h1>Loading BIS demo...</h1>
        </section>
      </main>
    )
  }

  if (error && !selectedSample) {
    return (
      <main className="demo-shell">
        <section className="loading-card">
          <h1>Unable to load demo</h1>
          <p className="warning">{error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="demo-shell">
      <section className="layout">
        <header className="hero-card">
          <p className="kicker">BIS Process Optimisation</p>
          <h1>From messy request to ready automation packet.</h1>

          <div className="controls-grid">
            <label>
              Workflow
              <select value={selectedSample?.id ?? ''} onChange={(event) => handleSampleChange(event.target.value)}>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="preset-row" role="radiogroup" aria-label="Preset">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={presetId === preset.id ? 'chip active' : 'chip'}
                  onClick={() => setPresetId(preset.id)}
                  title={preset.note}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button type="button" className="primary-btn" onClick={() => void handleRun()}>
              Start demo
            </button>
            <button type="button" className="secondary-btn" onClick={handleReset}>
              Reset
            </button>
          </div>

          <label>
            Request
            <textarea value={requestText} rows={3} onChange={(event) => setRequestText(event.target.value)} />
          </label>

          <div className="status-row">
            <p className="status-pill">{stageLabel(stage)}</p>
            {copyStatus ? <p className="status-pill">{copyStatus}</p> : null}
            {error ? <p className="warning">{error}</p> : null}
          </div>

          <div className="run-rail" aria-label="Run stages">
            <span className={stageRank(stage) >= 1 ? 'rail active' : 'rail'}>1. Intake</span>
            <span className={stageRank(stage) >= 2 ? 'rail active' : 'rail'}>2. Packet</span>
            <span className={stageRank(stage) >= 3 ? 'rail active' : 'rail'}>3. Safety</span>
          </div>
        </header>

        <section className={result ? 'moment-card ready' : 'moment-card'}>
          <article className="moment before">
            <h2>Before</h2>
            <p className="metric">{formatDays(baselineDays)}</p>
            <p className="meta">Lead time</p>
            <p className="meta">{beforeTouches} manual touchpoints</p>
          </article>

          <p className="arrow" aria-hidden="true">
            →
          </p>

          <article className="moment after">
            <h2>After</h2>
            {result ? (
              <>
                <p className="metric">{formatDays(targetDays)}</p>
                <p className="meta">Lead time</p>
                <div className="signals">
                  <span>{leadTimeReduction ?? 0}% faster</span>
                  <span>{afterTouches} touchpoints</span>
                  <span>{result.triage.est_savings_hours_per_month}h saved/month</span>
                </div>
              </>
            ) : (
              <p className="meta">Click Start demo.</p>
            )}
          </article>
        </section>

        <section className="outputs-card">
          <h2>Your outputs</h2>
          {result ? (
            <div className="outputs-grid">
              <article className="tile">
                <h3>Triage</h3>
                <p>{pretty(result.triage.category)}</p>
                <p>Priority: {result.triage.priority}</p>
                <p>Risk: {pretty(result.triage.risk_level)}</p>
                <p>Automation score: {result.triage.automation_score}</p>
              </article>

              <article className="tile">
                <h3>Charter</h3>
                <p>{result.charter.problem_statement}</p>
                <p>
                  Target: {formatDays(baselineDays)} {'->'} {formatDays(targetDays)}
                </p>
                <button type="button" className="secondary-btn mini" onClick={() => void handleCopy('Charter JSON', result.charter)}>
                  Copy charter JSON
                </button>
              </article>

              <article className="tile">
                <h3>Automation blueprint</h3>
                <ul>
                  {result.blueprint.steps.slice(0, 4).map((step) => (
                    <li key={step.id}>{step.name}</li>
                  ))}
                </ul>
                <button type="button" className="secondary-btn mini" onClick={() => void handleCopy('Blueprint JSON', result.blueprint)}>
                  Copy blueprint JSON
                </button>
              </article>

              <article className="tile">
                <h3>Export payloads</h3>
                <div className="copy-row">
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => void handleCopy('Jira JSON', result.exports.jira_issue_create)}
                  >
                    Copy Jira
                  </button>
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => void handleCopy('ServiceNow JSON', result.exports.servicenow_record_create)}
                  >
                    Copy ServiceNow
                  </button>
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => void handleCopy('Tracker JSON', result.exports.process_tracker_row)}
                  >
                    Copy tracker
                  </button>
                </div>
              </article>
            </div>
          ) : (
            <p className="empty">Run the demo to generate the packet.</p>
          )}
        </section>

        <details className="details-card">
          <summary>Open full packet details</summary>
          <div className="details-grid">
            <section className="flow-grid">
              <article>
                <h3>Before flow</h3>
                <ol>
                  {beforeFlow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
              <article>
                <h3>After flow</h3>
                <ol>
                  {afterFlow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            </section>

            <section className="advanced-row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={driftEnabled}
                  onChange={(event) => setDriftEnabled(event.target.checked)}
                />
                Simulate wording drift
              </label>
              <p className="preset-note">Preset: {activePreset.label} - {activePreset.note}</p>
            </section>

            {result ? (
              <section className="json-grid">
                <article>
                  <h3>Plan packet JSON</h3>
                  <pre>
                    {JSON.stringify(
                      {
                        category: result.triage.category,
                        risk_level: result.triage.risk_level,
                        charter: result.charter,
                        blueprint: result.blueprint,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </article>
                <article>
                  <h3>Export JSON</h3>
                  <pre>{JSON.stringify(result.exports, null, 2)}</pre>
                </article>
              </section>
            ) : null}

            {result ? (
              <section className="required-fields-card">
                <h3>Primary fields captured</h3>
                <div className="fields-grid">
                  {Object.entries(result.exports.process_tracker_row).map(([key, value]) => (
                    <p key={key}>
                      <span>{fieldLabel(key)}</span>
                      <strong>{String(value)}</strong>
                    </p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </details>
      </section>
    </main>
  )
}

export default App
