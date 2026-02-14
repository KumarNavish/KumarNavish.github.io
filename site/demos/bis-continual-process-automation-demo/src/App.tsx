import { useEffect, useMemo, useState } from 'react'

import { MermaidDiagram } from './components/MermaidDiagram'
import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline, type PipelineResult } from './domain/pipeline'
import type { CategoryCatalog, IntakeSample } from './domain/types'

interface ImpactSnapshot {
  baselineDays: number | null
  targetDays: number | null
  monthlyHoursSaved: number
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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function toNumber(value: string | number | null | undefined): number | null {
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

function formatDays(value: number | null): string {
  if (value === null) {
    return 'n/a'
  }
  return `${value}d`
}

function excerpt(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
}

function buildImpactSnapshot(result: PipelineResult): ImpactSnapshot {
  const baselineDays = toNumber(result.charter.baseline_metrics.cycle_time_days)
  const targetDays = toNumber(result.charter.target_metrics.cycle_time_days_target)

  return {
    baselineDays,
    targetDays,
    monthlyHoursSaved: result.triage.est_savings_hours_per_month,
  }
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [requestText, setRequestText] = useState('')

  const [result, setResult] = useState<PipelineResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
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

  const impactSnapshot = useMemo(() => (result ? buildImpactSnapshot(result) : null), [result])

  const previewBaselineDays = selectedSample?.ground_truth.baseline_cycle_time_days ?? null
  const inferredTargetDays =
    previewBaselineDays !== null ? Math.max(1, Math.round(previewBaselineDays * 0.65)) : null

  const beforeCycleTime = impactSnapshot?.baselineDays ?? previewBaselineDays
  const afterCycleTime = impactSnapshot?.targetDays ?? inferredTargetDays

  const requestPreview = excerpt(requestText || selectedSample?.text || '', 420)

  const jiraFields =
    result && typeof result.exports.jira_issue_create.fields === 'object'
      ? (result.exports.jira_issue_create.fields as Record<string, unknown>)
      : null

  const servicenowPayload =
    result && typeof result.exports.servicenow_record_create === 'object'
      ? (result.exports.servicenow_record_create as Record<string, unknown>)
      : null

  const trackerPayload =
    result && typeof result.exports.process_tracker_row === 'object'
      ? (result.exports.process_tracker_row as Record<string, unknown>)
      : null

  const hintText = useMemo(() => {
    if (error) {
      return 'Could not load data. Please refresh.'
    }
    if (isRunning) {
      return 'Running automation...'
    }
    if (!result) {
      return 'Click Start demo.'
    }
    return 'Work packet ready.'
  }, [error, isRunning, result])

  function handleSampleChange(sampleId: string) {
    setSelectedSampleId(sampleId)
    const nextSample = samples.find((sample) => sample.id === sampleId)
    if (nextSample) {
      setRequestText(nextSample.text)
      setResult(null)
      setCopyStatus(null)
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
    setCopyStatus(null)
    setIsRunning(true)

    await sleep(260)

    const nextResult = runIntakePipeline(sampleForRun, catalog)
    setResult(nextResult)
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

  async function copyFullPack() {
    if (!result) {
      return
    }

    const packagePayload = {
      workflow: result.sample.title,
      triage: result.triage,
      charter: result.charter,
      process_map: {
        as_is_mermaid: result.asIsMermaid,
        to_be_mermaid: result.toBeMermaid,
      },
      automation_blueprint: result.blueprint,
      exports: result.exports,
    }

    await copyJson('Work packet', packagePayload)
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>Turn one messy request into an execution-ready work packet.</h1>
      </header>

      <section className="panel workspace-panel">
        <section className="control-pane">
          <h2>Request</h2>

          <section className="example-picker">
            <label htmlFor="example-select">Choose example</label>
            <div className="select-shell">
              <select
                id="example-select"
                className="example-select"
                value={selectedSampleId}
                onChange={(event) => handleSampleChange(event.target.value)}
              >
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </select>
              <span className="select-caret" aria-hidden="true">
                ▾
              </span>
            </div>
          </section>

          <details className="advanced-block inline-advanced">
            <summary>Edit request text</summary>
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={6}
            />
          </details>

          <button className="primary-btn" onClick={() => void runPipeline()} disabled={!selectedSample || isRunning}>
            {isRunning ? 'Running...' : 'Start demo'}
          </button>

          <p className="hint-text">{hintText}</p>
          {error ? <p className="error-text">{error}</p> : null}
          {copyStatus ? <p className="status-text success-text">{copyStatus}</p> : null}
        </section>

        <section className="result-pane" aria-live="polite">
          {!result ? (
            <section className="moment-shell">
              <p className="moment-tag">Before</p>
              <h2>Manual intake request</h2>
              <pre className="input-preview">{requestPreview}</pre>

              <div className="impact-strip">
                <article>
                  <span>Cycle</span>
                  <strong>{formatDays(previewBaselineDays)}</strong>
                </article>
                <article>
                  <span>State</span>
                  <strong>Manual</strong>
                </article>
                <article>
                  <span>Output</span>
                  <strong>Not standardized</strong>
                </article>
              </div>
            </section>
          ) : (
            <section className="moment-shell">
              <p className="moment-tag">After</p>
              <h2>Execution packet generated</h2>

              <div className="impact-strip">
                <article>
                  <span>Cycle</span>
                  <strong>
                    {formatDays(beforeCycleTime)} to {formatDays(afterCycleTime)}
                  </strong>
                </article>
                <article>
                  <span>Saved / month</span>
                  <strong>{impactSnapshot.monthlyHoursSaved}h</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong>Ready to hand off</strong>
                </article>
              </div>

              <section className="transformation-grid">
                <article className="moment-card before-card">
                  <p className="doc-tag">Input</p>
                  <pre className="input-preview">{excerpt(result.sample.text, 520)}</pre>
                </article>

                <article className="moment-card after-card">
                  <p className="doc-tag">Output</p>

                  <section className="artifact-card">
                    <h3>Project charter</h3>
                    <ul className="key-list">
                      <li>
                        <strong>Problem:</strong> {result.charter.problem_statement}
                      </li>
                      <li>
                        <strong>Target cycle:</strong>{' '}
                        {metricToText(result.charter.target_metrics.cycle_time_days_target)}
                      </li>
                      <li>
                        <strong>Priority:</strong> {result.triage.priority}
                      </li>
                      <li>
                        <strong>Next step:</strong> {result.triage.next_action}
                      </li>
                    </ul>
                  </section>

                  <section className="artifact-card">
                    <h3>To-be process map</h3>
                    <MermaidDiagram title="To-be process" chart={result.toBeMermaid} />
                  </section>

                  <section className="artifact-card">
                    <h3>Handoff payload</h3>
                    <ul className="key-list">
                      <li>
                        <strong>Jira:</strong> {metricToText(jiraFields?.summary)}
                      </li>
                      <li>
                        <strong>ServiceNow:</strong>{' '}
                        {metricToText(servicenowPayload?.short_description)}
                      </li>
                      <li>
                        <strong>Owner:</strong> {metricToText(trackerPayload?.owner)}
                      </li>
                      <li>
                        <strong>Risk:</strong> {prettyCategory(result.triage.risk_level)}
                      </li>
                    </ul>
                  </section>

                  <div className="outputs-actions">
                    <button className="primary-btn" onClick={() => void copyFullPack()}>
                      Copy work packet
                    </button>
                  </div>
                </article>
              </section>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
