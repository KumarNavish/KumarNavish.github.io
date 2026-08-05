import { useEffect, useMemo, useState } from 'react'

import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline, type PipelineResult } from './domain/pipeline'
import type { CategoryCatalog, IntakeSample } from './domain/types'

type RunStage = 'idle' | 'analyzing' | 'building' | 'checking' | 'ready' | 'failed'
type PresetId = 'balanced' | 'fast' | 'retention'

interface Preset {
  id: PresetId
  label: string
}

const PRESETS: Preset[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'fast', label: 'Fast Adaptation' },
  { id: 'retention', label: 'Retention-first' },
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
  return value === null ? 'n/a' : `${value} days`
}

function stageLabel(stage: RunStage): string {
  if (stage === 'idle') {
    return 'Ready to run'
  }
  if (stage === 'analyzing') {
    return 'Reading request...'
  }
  if (stage === 'building') {
    return 'Building execution packet...'
  }
  if (stage === 'checking') {
    return 'Running safety checks...'
  }
  if (stage === 'ready') {
    return 'Done'
  }
  return 'Run failed'
}

function simulateDrift(text: string): string {
  return text
    .replace(/approval/gi, 'sign-off')
    .replace(/manual/gi, 'human')
    .replace(/ticket/gi, 'case')
}

function parseFlowSteps(mermaid: string): string[] {
  const labels: string[] = []
  const quoted = /"([^"]+)"/g
  let match = quoted.exec(mermaid)
  while (match) {
    labels.push(match[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim())
    match = quoted.exec(mermaid)
  }
  return Array.from(new Set(labels)).slice(0, 6)
}

async function copyJson(label: string, payload: unknown): Promise<string> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    return `${label} copied`
  } catch {
    return 'Clipboard blocked in this browser'
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

  const manualFlow = useMemo(() => {
    if (!result) {
      return ['Intake arrives in mixed format', 'Manual triage', 'Manual approval chain', 'Status follow-up by email']
    }
    return parseFlowSteps(result.asIsMermaid)
  }, [result])

  const automatedFlow = useMemo(() => {
    if (!result) {
      return ['Unified intake', 'Auto categorization', 'Policy checks', 'Automated routing', 'SLA tracking and audit log']
    }
    return parseFlowSteps(result.toBeMermaid)
  }, [result])

  const beforePain = useMemo(() => {
    if (!result) {
      return [
        'Requests arrive with missing data.',
        'Teams chase approvals manually.',
        'Status is spread across email and trackers.',
      ]
    }

    const points: string[] = []
    if (result.extracted.pain_keywords.includes('missing_fields')) {
      points.push('Missing fields trigger avoidable rework.')
    }
    if (result.extracted.pain_keywords.includes('manual_work') || result.extracted.manual_step_count > 2) {
      points.push('Manual handoffs create queue delays.')
    }
    if (result.extracted.pain_keywords.includes('ownership_confusion')) {
      points.push('Unclear ownership causes follow-up loops.')
    }
    if (result.extracted.pain_keywords.includes('delay')) {
      points.push('SLA risk grows as approvals stall.')
    }
    if (points.length === 0) {
      points.push('Manual routing increases lead time.')
      points.push('Approvals depend on repeated follow-ups.')
      points.push('No consistent audit trail per request.')
    }
    return points.slice(0, 3)
  }, [result])

  const afterOutcome = useMemo(() => {
    if (!result) {
      return [
        'One-click packet is generated for execution.',
        'Approvals, controls, and routing are predefined.',
        'Handoff payloads are ready for issue trackers.',
      ]
    }

    return [
      `Case is auto-triaged as ${pretty(result.triage.category)} with ${result.triage.priority} priority.`,
      `Blueprint applies ${result.blueprint.steps[2]?.description.toLowerCase() ?? 'rule-based routing'}.`,
      `Export payloads are ready for Jira, ServiceNow, and process tracker handoff.`,
    ]
  }, [result])

  const runInProgress = stage === 'analyzing' || stage === 'building' || stage === 'checking'

  async function handleRun(): Promise<void> {
    if (!selectedSample || !catalog) {
      return
    }

    setCopyStatus('')
    setError('')
    setStage('analyzing')

    try {
      await sleep(140)

      const normalizedText = requestText.trim().length > 0 ? requestText : selectedSample.text
      const pipelineInput: IntakeSample = {
        ...selectedSample,
        text: driftEnabled ? simulateDrift(normalizedText) : normalizedText,
      }

      setStage('building')
      await sleep(140)

      const pipelineResult = runIntakePipeline(pipelineInput, catalog)
      setResult(pipelineResult)

      setStage('checking')
      await sleep(140)

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
          <p className="kicker">BIS Process Optimisation Copilot</p>
          <h1>Turn one messy request into a ready execution packet.</h1>
          <p className="subhead">
            Start once. Get a charter, process flow, automation blueprint, and copy-ready handoff JSON.
          </p>

          <div className="input-grid">
            <label className="field">
              <span>Choose request</span>
              <select value={selectedSample?.id ?? ''} onChange={(event) => handleSampleChange(event.target.value)}>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-wide">
              <span>Messy input</span>
              <textarea value={requestText} rows={4} onChange={(event) => setRequestText(event.target.value)} />
            </label>
          </div>

          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={() => void handleRun()} disabled={runInProgress}>
              {runInProgress ? 'Running...' : 'Start demo'}
            </button>
            <button type="button" className="secondary-btn" onClick={handleReset}>
              Reset
            </button>
            <p className="status-line">
              {stageLabel(stage)}
              {copyStatus ? ` • ${copyStatus}` : ''}
            </p>
          </div>

          <details className="advanced">
            <summary>Advanced settings</summary>
            <div className="advanced-content">
              <div className="preset-row" role="radiogroup" aria-label="Preset">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={presetId === preset.id ? 'chip active' : 'chip'}
                    onClick={() => setPresetId(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={driftEnabled}
                  onChange={(event) => setDriftEnabled(event.target.checked)}
                />
                Simulate wording drift
              </label>
              <p className="advanced-note">Active preset: {activePreset.label}</p>
            </div>
          </details>

          {error ? <p className="warning">{error}</p> : null}
        </header>

        <section className={result ? 'moment-card ready' : 'moment-card'}>
          <div className="moment-head">
            <p className="moment-kicker">Automation moment</p>
            <h2>{selectedSample?.title ?? 'Select a request and start'}</h2>
          </div>

          <div className="impact-strip">
            <article>
              <span>Lead time</span>
              <strong>
                {formatDays(baselineDays)} {'->'} {formatDays(targetDays)}
              </strong>
            </article>
            <article>
              <span>Manual handoffs</span>
              <strong>
                {beforeTouches} {'->'} {afterTouches}
              </strong>
            </article>
            <article>
              <span>Capacity returned</span>
              <strong>{result ? `${result.triage.est_savings_hours_per_month}h/month` : 'Pending run'}</strong>
            </article>
            <article>
              <span>Lead-time gain</span>
              <strong>{leadTimeReduction}% faster</strong>
            </article>
          </div>

          <div className="before-after-grid">
            <article className="before-card">
              <h3>Before (manual)</h3>
              <ul>
                {beforePain.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="after-card">
              <h3>After (automated)</h3>
              <ul>
                {afterOutcome.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="outputs-card">
          <div className="outputs-head">
            <h2>Your outputs</h2>
            <p>Everything below is copy-ready for execution handoff.</p>
          </div>

          {result ? (
            <div className="outputs-grid">
              <article className="output-tile">
                <h3>Project charter</h3>
                <p className="tile-main">{result.charter.problem_statement}</p>
                <div className="tile-stats">
                  <p>
                    <span>Category</span>
                    <strong>{pretty(result.triage.category)}</strong>
                  </p>
                  <p>
                    <span>Priority</span>
                    <strong>{result.triage.priority}</strong>
                  </p>
                  <p>
                    <span>Risk</span>
                    <strong>{pretty(result.triage.risk_level)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-btn mini"
                  onClick={() =>
                    void handleCopy('Charter JSON', {
                      triage: result.triage,
                      charter: result.charter,
                    })
                  }
                >
                  Copy charter JSON
                </button>
              </article>

              <article className="output-tile">
                <h3>Process flow</h3>
                <div className="flow-grid">
                  <div>
                    <p className="flow-label">As-is</p>
                    <ol>
                      {manualFlow.map((step) => (
                        <li key={`manual-${step}`}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="flow-label">To-be</p>
                    <ol>
                      {automatedFlow.map((step) => (
                        <li key={`auto-${step}`}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>

              <article className="output-tile">
                <h3>Automation blueprint</h3>
                <div className="tile-list">
                  <p>
                    <span>Connectors</span>
                    <strong>{result.blueprint.connectors.map((item) => item.system).join(', ') || 'n/a'}</strong>
                  </p>
                  <p>
                    <span>Main control</span>
                    <strong>{result.blueprint.controls[0]?.control ?? 'Audit log'}</strong>
                  </p>
                  <p>
                    <span>Monitoring</span>
                    <strong>{result.blueprint.monitoring[0]?.metric ?? 'approval_cycle_time_days'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-btn mini"
                  onClick={() => void handleCopy('Blueprint JSON', result.blueprint)}
                >
                  Copy blueprint JSON
                </button>
              </article>

              <article className="output-tile">
                <h3>External handoff</h3>
                <div className="tile-list">
                  <p>
                    <span>Jira summary</span>
                    <strong>{String(result.exports.jira_issue_create.summary)}</strong>
                  </p>
                  <p>
                    <span>ServiceNow short description</span>
                    <strong>{String(result.exports.servicenow_record_create.short_description)}</strong>
                  </p>
                </div>
                <div className="button-stack">
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => void handleCopy('Jira JSON', result.exports.jira_issue_create)}
                  >
                    Copy Jira JSON
                  </button>
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => void handleCopy('ServiceNow JSON', result.exports.servicenow_record_create)}
                  >
                    Copy ServiceNow JSON
                  </button>
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => void handleCopy('Tracker JSON', result.exports.process_tracker_row)}
                  >
                    Copy tracker JSON
                  </button>
                </div>
              </article>
            </div>
          ) : (
            <article className="empty-outputs">
              <p>Click Start demo to generate your packet instantly.</p>
            </article>
          )}
        </section>

        <details className="details-card">
          <summary>Open full packet details</summary>
          {result ? (
            <div className="json-grid">
              <article>
                <h3>Packet JSON</h3>
                <pre>
                  {JSON.stringify(
                    {
                      triage: result.triage,
                      charter: result.charter,
                      blueprint: result.blueprint,
                      as_is_flow: manualFlow,
                      to_be_flow: automatedFlow,
                    },
                    null,
                    2,
                  )}
                </pre>
              </article>
              <article>
                <h3>Export payload JSON</h3>
                <pre>{JSON.stringify(result.exports, null, 2)}</pre>
              </article>
            </div>
          ) : (
            <p className="empty-outputs">Run the demo to open packet details.</p>
          )}
        </details>
      </section>
    </main>
  )
}

export default App
