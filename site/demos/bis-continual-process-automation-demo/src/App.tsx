import { useEffect, useMemo, useState } from 'react'

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

interface ImpactSnapshot {
  baselineDays: number | null
  targetDays: number | null
  cycleGainDays: number | null
  cycleReductionPct: number | null
  monthlyHoursSaved: number
  payloadCount: number
  outputCount: number
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

function sampleHint(sample: IntakeSample | null): string {
  if (!sample) {
    return 'Pick a workflow example to begin.'
  }
  return `${prettyCategory(sample.ground_truth.category)} • ${prettyCategory(sample.ground_truth.risk_level)} risk`
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

function buildImpactSnapshot(result: PipelineResult): ImpactSnapshot {
  const baselineDays = toNumber(result.charter.baseline_metrics.cycle_time_days)
  const targetDays = toNumber(result.charter.target_metrics.cycle_time_days_target)
  const cycleGainDays =
    baselineDays !== null && targetDays !== null ? Math.max(0, baselineDays - targetDays) : null
  const cycleReductionPct =
    baselineDays !== null && targetDays !== null && baselineDays > 0
      ? Math.max(0, Math.round(((baselineDays - targetDays) / baselineDays) * 100))
      : null

  return {
    baselineDays,
    targetDays,
    cycleGainDays,
    cycleReductionPct,
    monthlyHoursSaved: result.triage.est_savings_hours_per_month,
    payloadCount: Object.keys(result.exports).length,
    outputCount: 3,
  }
}

function App() {
  const [samples, setSamples] = useState<IntakeSample[]>([])
  const [catalog, setCatalog] = useState<CategoryCatalog | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [requestText, setRequestText] = useState('')

  const [result, setResult] = useState<PipelineResult | null>(null)
  const [impactRationale, setImpactRationale] = useState<ImpactRationale | null>(null)

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

  const selectedSampleHint = useMemo(() => sampleHint(selectedSample), [selectedSample])
  const impactSnapshot = useMemo(() => (result ? buildImpactSnapshot(result) : null), [result])

  const hasResult = Boolean(result)
  const previewBaselineDays = selectedSample?.ground_truth.baseline_cycle_time_days ?? null
  const previewVolume = selectedSample?.ground_truth.volume_per_month ?? null
  const inferredTargetDays =
    previewBaselineDays !== null ? Math.max(1, Math.round(previewBaselineDays * 0.65)) : null
  const beforeCycleTime = impactSnapshot?.baselineDays ?? previewBaselineDays
  const afterCycleTime = impactSnapshot?.targetDays ?? inferredTargetDays

  const totalArtifacts = impactSnapshot
    ? impactSnapshot.outputCount + impactSnapshot.payloadCount
    : null

  const outcomeHeadline = impactSnapshot
    ? impactSnapshot.cycleReductionPct !== null
      ? `${impactSnapshot.cycleReductionPct}% faster target cycle`
      : `${impactSnapshot.monthlyHoursSaved} hours saved per month`
    : 'From manual request to execution-ready package'

  const outcomeSubline = impactSnapshot
    ? `${impactSnapshot.monthlyHoursSaved} hrs/month impact with ${totalArtifacts ?? 0} ready handoff artifacts.`
    : 'One run creates a charter, a process map, and payloads your team can use immediately.'

  const hintText = useMemo(() => {
    if (error) {
      return 'Could not load data. Please refresh.'
    }
    if (isRunning) {
      return 'Running automation…'
    }
    if (!result) {
      return 'Click Start automation.'
    }
    return 'Automation complete.'
  }, [error, isRunning, result])

  function handleSampleChange(sampleId: string) {
    setSelectedSampleId(sampleId)
    const nextSample = samples.find((sample) => sample.id === sampleId)
    if (nextSample) {
      setRequestText(nextSample.text)
      setResult(null)
      setImpactRationale(null)
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
    setImpactRationale(null)
    setCopyStatus(null)
    setIsRunning(true)

    await sleep(280)

    const nextResult = runIntakePipeline(sampleForRun, catalog)
    setResult(nextResult)
    setImpactRationale(buildImpactRationale(nextResult))
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

    await copyJson('Full process package', packagePayload)
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>Convert a messy process request into a package your team can execute.</h1>
        <p className="hero-subhead">
          This demo automates intake analysis and instantly produces real work artifacts for delivery.
        </p>
      </header>

      <section className="panel workspace-panel">
        <section className="control-pane">
          <h2>1) Choose request</h2>
          <p className="control-caption">Select a BIS workflow, then run automation.</p>

          <section className="example-picker">
            <label htmlFor="example-select">Workflow example</label>
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
            <p className="field-help">{selectedSampleHint}</p>
          </section>

          <details className="advanced-block inline-advanced">
            <summary>Edit request text (optional)</summary>
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={6}
            />
          </details>

          <button className="primary-btn" onClick={() => void runPipeline()} disabled={!selectedSample || isRunning}>
            {isRunning ? 'Running…' : '2) Start automation'}
          </button>

          <p className="hint-text">{hintText}</p>
          {error ? <p className="error-text">{error}</p> : null}
          {copyStatus ? <p className="status-text success-text">{copyStatus}</p> : null}
        </section>

        <section className="result-pane" aria-live="polite">
          {!result ? (
            <section className="outcome-shell preview-shell">
              <p className="moment-tag">Automation preview</p>
              <h2>What changes after one run</h2>
              <p className="outcome-lede">
                Current intake is slow and hard to execute. Automation turns it into a standard package.
              </p>
              <ul className="quick-list">
                <li>
                  <strong>Current pain:</strong> {formatDays(previewBaselineDays)} cycle time and{' '}
                  {metricToText(previewVolume)} requests per month.
                </li>
                <li>
                  <strong>Automated output:</strong> Charter summary, process map, and handoff payloads.
                </li>
                <li>
                  <strong>Business value:</strong> Faster turnaround with less manual coordination.
                </li>
              </ul>
            </section>
          ) : (
            <section className="outcome-shell live-shell">
              <p className="moment-tag">Automation complete</p>
              <h2>{outcomeHeadline}</h2>
              <p className="outcome-lede">{outcomeSubline}</p>

              <article className={`reveal-card ${hasResult ? 'revealed' : ''}`}>
                <p className="reveal-label">Before vs After</p>
                <div className="reveal-track">
                  <section className="reveal-state before">
                    <span className="reveal-tag">Before</span>
                    <strong>{formatDays(beforeCycleTime)}</strong>
                    <small>manual follow-up and approvals</small>
                  </section>
                  <section className="reveal-state after">
                    <span className="reveal-tag">After</span>
                    <strong>{formatDays(afterCycleTime)}</strong>
                    <small>standard flow with automation handoff</small>
                  </section>
                </div>
              </article>

              <div className="metric-row">
                <article>
                  <span>Hours saved / month</span>
                  <strong>{impactSnapshot.monthlyHoursSaved}</strong>
                </article>
                <article>
                  <span>Ready artifacts</span>
                  <strong>{totalArtifacts ?? 0}</strong>
                </article>
                <article>
                  <span>Workflow type</span>
                  <strong>{prettyCategory(result.triage.category)}</strong>
                </article>
              </div>

              <section className="handoff-strip">
                <h3>3) Use this package now</h3>
                <div className="outputs-actions">
                  <button className="primary-btn" onClick={() => void copyFullPack()}>
                    Copy full package
                  </button>
                  <button className="secondary-btn" onClick={() => copyJson('Jira payload', result.exports.jira_issue_create)}>
                    Copy Jira JSON
                  </button>
                  <button className="secondary-btn" onClick={() => copyJson('ServiceNow payload', result.exports.servicenow_record_create)}>
                    Copy ServiceNow JSON
                  </button>
                </div>
              </section>

              <details className="advanced-block preview-details">
                <summary>Preview generated charter and process map</summary>
                <div className="artifact-panel">
                  <section className="artifact-card">
                    <h3>Charter summary</h3>
                    <p>
                      <strong>Problem:</strong> {result.charter.problem_statement}
                    </p>
                    <p>
                      <strong>Next action:</strong> {result.triage.next_action}
                    </p>
                  </section>

                  <section className="artifact-card">
                    <h3>To-be process map</h3>
                    <MermaidDiagram title="To-be process" chart={result.toBeMermaid} />
                  </section>
                </div>
              </details>

              <details className="advanced-block">
                <summary>Show technical details</summary>
                <p>
                  Estimated from {impactRationale?.manual_steps ?? 'n/a'} manual touchpoints, volume{' '}
                  {metricToText(impactRationale?.monthly_volume)}, cycle time{' '}
                  {metricToText(impactRationale?.cycle_time_days)} days. Confidence:{' '}
                  <strong>{impactRationale ? prettyCategory(impactRationale.confidence) : 'Not available'}</strong>.
                </p>
                <pre>{JSON.stringify(result.blueprint, null, 2)}</pre>
              </details>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
