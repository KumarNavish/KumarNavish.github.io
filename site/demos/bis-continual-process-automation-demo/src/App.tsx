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
  { id: 'balanced', label: 'Balanced', note: 'Balanced adaptation and retention.' },
  { id: 'fast', label: 'Fast Adaptation', note: 'Adapt quickly to new request variants.' },
  { id: 'retention', label: 'Retention-first', note: 'Preserve previous workflow quality first.' },
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
    return 'Checking non-regression'
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
      return 0
    }
    return Math.max(0, Math.round(((baselineDays - targetDays) / baselineDays) * 100))
  }, [baselineDays, targetDays])

  const beforeTouches = result?.extracted.manual_step_count ?? 4
  const afterTouches =
    toNumber(result?.charter.target_metrics.manual_handoffs_target) ?? Math.max(1, beforeTouches - 2)

  const kickoffBrief = useMemo(() => {
    if (!selectedSample || !result) {
      return null
    }

    return {
      request_title: selectedSample.title,
      category: result.triage.category,
      priority: result.triage.priority,
      risk_level: result.triage.risk_level,
      next_action: result.triage.next_action,
      outcome: {
        lead_time_before_days: baselineDays,
        lead_time_after_days: targetDays,
        lead_time_reduction_pct: leadTimeReduction,
        monthly_hours_saved: result.triage.est_savings_hours_per_month,
      },
      owner: 'BIS Process Optimisation CoE',
      preset: activePreset.label,
      handoff: {
        jira: result.exports.jira_issue_create,
        serviceNow: result.exports.servicenow_record_create,
        tracker: result.exports.process_tracker_row,
      },
    }
  }, [selectedSample, result, baselineDays, targetDays, leadTimeReduction, activePreset.label])

  const beforeFlow = useMemo(() => {
    if (!selectedSample) {
      return []
    }

    return [
      `Request enters through ${selectedSample.channel}.`,
      'Analyst triages manually.',
      'Missing info is chased over email/chat.',
      'Approvals and updates are logged manually.',
    ]
  }, [selectedSample])

  const afterFlow = useMemo(() => {
    if (!result) {
      return ['Awaiting run', 'Awaiting run', 'Awaiting run', 'Awaiting run']
    }

    return [
      `Auto-classify as ${pretty(result.triage.category)}.`,
      'Generate charter and baseline metrics.',
      'Attach controls and monitoring steps.',
      'Generate export payloads for execution systems.',
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
      await sleep(110)

      const normalizedText = requestText.trim().length > 0 ? requestText : selectedSample.text
      const pipelineInput: IntakeSample = {
        ...selectedSample,
        text: driftEnabled ? simulateDrift(normalizedText) : normalizedText,
      }

      setStage('building')
      await sleep(110)

      const pipelineResult = runIntakePipeline(pipelineInput, catalog)
      setResult(pipelineResult)

      setStage('checking')
      await sleep(110)

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
        <header className="top-band">
          <p className="kicker">BIS Process Optimisation</p>
          <h1>One request in. One execution packet out.</h1>
        </header>

        <section className="workspace">
          <article className="intake-card">
            <h2>1. Choose and run</h2>

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

            <label>
              Request
              <textarea value={requestText} rows={4} onChange={(event) => setRequestText(event.target.value)} />
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

            <div className="action-row">
              <button type="button" className="primary-btn" onClick={() => void handleRun()}>
                Start demo
              </button>
              <button type="button" className="secondary-btn" onClick={handleReset}>
                Reset
              </button>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={driftEnabled}
                onChange={(event) => setDriftEnabled(event.target.checked)}
              />
              Simulate wording drift
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
          </article>

          <article className={result ? 'outcome-card ready' : 'outcome-card'}>
            <p className="outcome-tag">2. Automation outcome</p>
            {result ? (
              <>
                <h2>{pretty(result.triage.category)} packet generated.</h2>

                <ul className="outcome-list">
                  <li>
                    <span>Problem solved</span>
                    <strong>{result.charter.problem_statement}</strong>
                  </li>
                  <li>
                    <span>What changed</span>
                    <strong>{result.triage.next_action}</strong>
                  </li>
                  <li>
                    <span>Business result</span>
                    <strong>
                      {formatDays(baselineDays)} {'->'} {formatDays(targetDays)} lead time ({leadTimeReduction}% faster)
                    </strong>
                  </li>
                </ul>

                <div className="result-metrics">
                  <p>
                    <span>Touchpoints</span>
                    <strong>
                      {beforeTouches} {'->'} {afterTouches}
                    </strong>
                  </p>
                  <p>
                    <span>Monthly capacity</span>
                    <strong>{result.triage.est_savings_hours_per_month}h saved</strong>
                  </p>
                  <p>
                    <span>Priority</span>
                    <strong>{result.triage.priority}</strong>
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2>No output yet.</h2>
                <p className="placeholder">Run the demo to reveal the automation result.</p>
              </>
            )}
          </article>
        </section>

        <section className="deliverables-card">
          <h2>3. Ready to hand off</h2>

          {result ? (
            <div className="deliverables-grid">
              <article className="tile">
                <h3>Charter</h3>
                <p>{result.charter.problem_statement}</p>
                <button type="button" className="secondary-btn mini" onClick={() => void handleCopy('Charter JSON', result.charter)}>
                  Copy charter JSON
                </button>
              </article>

              <article className="tile">
                <h3>Blueprint</h3>
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
                <h3>Jira payload</h3>
                <p>Issue object ready for intake handoff.</p>
                <button
                  type="button"
                  className="secondary-btn mini"
                  onClick={() => void handleCopy('Jira JSON', result.exports.jira_issue_create)}
                >
                  Copy Jira JSON
                </button>
              </article>

              <article className="tile">
                <h3>ServiceNow + tracker</h3>
                <p>Execution records ready for operations.</p>
                <div className="copy-row">
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
            <p className="empty">Run the demo to generate handoff artifacts.</p>
          )}

          {kickoffBrief ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void handleCopy('Kickoff brief', kickoffBrief)}
            >
              Copy kickoff brief
            </button>
          ) : null}
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

            {result ? (
              <section className="json-grid">
                <article>
                  <h3>Plan packet JSON</h3>
                  <pre>{JSON.stringify({ triage: result.triage, charter: result.charter, blueprint: result.blueprint }, null, 2)}</pre>
                </article>
                <article>
                  <h3>Export JSON</h3>
                  <pre>{JSON.stringify(result.exports, null, 2)}</pre>
                </article>
              </section>
            ) : null}
          </div>
        </details>
      </section>
    </main>
  )
}

export default App
