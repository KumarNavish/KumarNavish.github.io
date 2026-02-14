import { useEffect, useMemo, useState } from 'react'

import { MermaidDiagram } from './components/MermaidDiagram'
import { loadCategoryCatalog, loadIntakeSamples } from './domain/loadData'
import { runIntakePipeline, type PipelineResult } from './domain/pipeline'
import type { CategoryCatalog, IntakeSample } from './domain/types'

interface ImpactSnapshot {
  baselineDays: number | null
  targetDays: number | null
  monthlyHoursSaved: number
  leadTimeReductionPct: number | null
}

interface SigmaSnapshot {
  opportunitiesPerMonth: number
  baselineDPMO: number
  targetDPMO: number
  baselineSigma: number
  targetSigma: number
  firstPassCurrentPct: number
  firstPassTargetPct: number
  copqHoursCurrent: number
  copqHoursTarget: number
}

interface RootCauseItem {
  cause: string
  effect: string
  evidence: string
  priority: 'H' | 'M'
}

interface ImproveActionItem {
  id: string
  step: string
  owner: string
  expectedEffect: string
  dueWeek: number
}

interface ControlPlanItem {
  metric: string
  owner: string
  frequency: string
  trigger: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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

function estimateManualSteps(text: string): number {
  const normalized = text.toLowerCase()
  const signalCount = (normalized.match(/\b(approve|review|handoff|email|manually|rework|follow up)\b/g) ?? [])
    .length
  return clamp(3 + signalCount, 3, 10)
}

function buildImpactSnapshot(result: PipelineResult): ImpactSnapshot {
  const baselineDays = toNumber(result.charter.baseline_metrics.cycle_time_days)
  const targetDays = toNumber(result.charter.target_metrics.cycle_time_days_target)

  const leadTimeReductionPct =
    baselineDays !== null && targetDays !== null && baselineDays > 0
      ? Math.max(0, Math.round(((baselineDays - targetDays) / baselineDays) * 100))
      : null

  return {
    baselineDays,
    targetDays,
    monthlyHoursSaved: result.triage.est_savings_hours_per_month,
    leadTimeReductionPct,
  }
}

function dpmoToSigma(dpmo: number): number {
  const points = [
    { sigma: 6, dpmo: 3.4 },
    { sigma: 5, dpmo: 233 },
    { sigma: 4, dpmo: 6210 },
    { sigma: 3, dpmo: 66807 },
    { sigma: 2, dpmo: 308537 },
    { sigma: 1, dpmo: 690000 },
  ]

  if (dpmo <= points[0].dpmo) {
    return points[0].sigma
  }

  if (dpmo >= points[points.length - 1].dpmo) {
    return points[points.length - 1].sigma
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const high = points[i]
    const low = points[i + 1]

    if (dpmo >= high.dpmo && dpmo <= low.dpmo) {
      const highLog = Math.log10(high.dpmo)
      const lowLog = Math.log10(low.dpmo)
      const currentLog = Math.log10(dpmo)
      const ratio = (currentLog - highLog) / (lowLog - highLog)
      const interpolated = high.sigma - ratio * (high.sigma - low.sigma)
      return Number(interpolated.toFixed(1))
    }
  }

  return 1
}

function buildSigmaSnapshot(result: PipelineResult): SigmaSnapshot {
  const volume =
    result.extracted.volume_per_month ?? result.sample.ground_truth.volume_per_month ?? 40
  const manualSteps = Math.max(1, result.extracted.manual_step_count)
  const opportunitiesPerMonth = Math.max(1, volume * manualSteps)

  const riskBaseRate: Record<'low' | 'medium' | 'high', number> = {
    low: 0.06,
    medium: 0.09,
    high: 0.13,
  }

  const baselineRate = clamp(
    riskBaseRate[result.triage.risk_level] + Math.min(0.06, Math.max(0, (manualSteps - 2) * 0.01)),
    0.03,
    0.25,
  )

  const automationLift = clamp(result.triage.automation_score / 160, 0.2, 0.7)
  const targetRate = clamp(baselineRate * (1 - automationLift), 0.008, 0.16)

  const baselineDPMO = Math.round(baselineRate * 1_000_000)
  const targetDPMO = Math.round(targetRate * 1_000_000)

  const copqHoursCurrent = Math.round(opportunitiesPerMonth * baselineRate * 0.5)
  const copqHoursTarget = Math.round(opportunitiesPerMonth * targetRate * 0.5)

  return {
    opportunitiesPerMonth,
    baselineDPMO,
    targetDPMO,
    baselineSigma: dpmoToSigma(baselineDPMO),
    targetSigma: dpmoToSigma(targetDPMO),
    firstPassCurrentPct: Math.round((1 - baselineRate) * 100),
    firstPassTargetPct: Math.round((1 - targetRate) * 100),
    copqHoursCurrent,
    copqHoursTarget,
  }
}

function buildRootCauses(result: PipelineResult): RootCauseItem[] {
  const catalog: Record<string, { cause: string; effect: string; evidence: string }> = {
    delay: {
      cause: 'Approval queue variability',
      effect: 'Lead-time spikes and SLA misses',
      evidence: 'Delay language detected in request.',
    },
    back_and_forth: {
      cause: 'Clarification loops across teams',
      effect: 'Rework and ownership drift',
      evidence: 'Back-and-forth communication pattern detected.',
    },
    manual_work: {
      cause: 'Manual routing and updates',
      effect: 'Inconsistent handling and long cycle time',
      evidence: 'Manual handling references detected.',
    },
    rekeying: {
      cause: 'Repeated data re-entry',
      effect: 'Higher defect opportunity and latency',
      evidence: 'Copy/paste and spreadsheet behaviors detected.',
    },
    missing_fields: {
      cause: 'Incomplete intake fields',
      effect: 'Downstream approval rejections',
      evidence: 'Missing/incomplete field risk detected.',
    },
    escalation: {
      cause: 'Late risk surfacing',
      effect: 'Emergency escalation workload',
      evidence: 'Escalation terms detected in request.',
    },
    ownership_confusion: {
      cause: 'Unclear process ownership',
      effect: 'Stalled handoffs and poor accountability',
      evidence: 'Ownership confusion terms detected.',
    },
  }

  const mapped = result.extracted.pain_keywords
    .map((keyword) => catalog[keyword])
    .filter((item): item is { cause: string; effect: string; evidence: string } => Boolean(item))

  if (mapped.length === 0) {
    return [
      {
        cause: 'Manual handoff complexity',
        effect: 'Cycle-time variance and rework',
        evidence: `${result.extracted.manual_step_count} manual touchpoints detected.`,
        priority: 'H',
      },
      {
        cause: 'Cross-system fragmentation',
        effect: 'Delayed status synchronization',
        evidence:
          result.extracted.key_systems.length > 0
            ? `Systems involved: ${result.extracted.key_systems.join(', ')}.`
            : 'Multiple workflow systems implied by request context.',
        priority: 'M',
      },
    ]
  }

  return mapped.slice(0, 3).map((item, index) => ({
    ...item,
    priority: index === 0 ? 'H' : 'M',
  }))
}

function buildImprovePlan(result: PipelineResult): ImproveActionItem[] {
  const effectMap: Record<string, string> = {
    validation: 'Increase first-pass yield and reduce missing-field defects.',
    approval: 'Reduce approval wait-time variance.',
    routing: 'Shorten handoff latency through deterministic routing.',
    notification: 'Improve SLA adherence through timely nudges.',
    update: 'Close execution loop with synchronized status updates.',
  }

  const fallbackOwners = ['Process Lead', 'Ops Manager', 'Control Owner', 'System Owner']

  return result.blueprint.steps.slice(0, 4).map((step, index) => ({
    id: step.id,
    step: step.name,
    owner: result.extracted.approval_roles[index] ?? fallbackOwners[index] ?? 'Operations Team',
    expectedEffect: effectMap[step.type] ?? 'Reduce variation and improve flow.',
    dueWeek: index + 1,
  }))
}

function buildControlPlan(result: PipelineResult): ControlPlanItem[] {
  const fallbackOwners = ['Process Owner', 'Quality Lead', 'Operations Manager']

  return result.blueprint.monitoring.slice(0, 3).map((item, index) => ({
    metric: item.metric,
    owner: fallbackOwners[index] ?? 'Process Team',
    frequency: index === 0 ? 'Daily' : 'Weekly',
    trigger: item.alert_condition,
  }))
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
  const sigmaSnapshot = useMemo(() => (result ? buildSigmaSnapshot(result) : null), [result])
  const rootCauses = useMemo(() => (result ? buildRootCauses(result) : []), [result])
  const improvePlan = useMemo(() => (result ? buildImprovePlan(result) : []), [result])
  const controlPlan = useMemo(() => (result ? buildControlPlan(result) : []), [result])

  const previewBaselineDays = selectedSample?.ground_truth.baseline_cycle_time_days ?? null
  const previewVolume = selectedSample?.ground_truth.volume_per_month ?? null
  const previewRisk = selectedSample?.ground_truth.risk_level ?? null

  const inferredTargetDays =
    previewBaselineDays !== null ? Math.max(1, Math.round(previewBaselineDays * 0.65)) : null

  const beforeCycleTime = impactSnapshot?.baselineDays ?? previewBaselineDays
  const afterCycleTime = impactSnapshot?.targetDays ?? inferredTargetDays

  const requestPreview = excerpt(requestText || selectedSample?.text || '', 460)
  const previewManualSteps = estimateManualSteps(requestText || selectedSample?.text || '')
  const beforeManualSteps = result?.extracted.manual_step_count ?? previewManualSteps
  const afterManualSteps = result ? Math.max(2, Math.min(beforeManualSteps, result.blueprint.steps.length)) : null

  const jiraFields =
    result && typeof result.exports.jira_issue_create.fields === 'object'
      ? (result.exports.jira_issue_create.fields as Record<string, unknown>)
      : null

  const servicenowBody =
    result &&
    typeof result.exports.servicenow_record_create === 'object' &&
    typeof (result.exports.servicenow_record_create as Record<string, unknown>).payload === 'object'
      ? ((result.exports.servicenow_record_create as Record<string, unknown>).payload as Record<
          string,
          unknown
        >)
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
      return 'Running automation pipeline...'
    }
    if (!result) {
      return 'Pick a request, then click Start demo.'
    }
    return 'Automation packet ready to export.'
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
      six_sigma: {
        impact: impactSnapshot,
        sigma: sigmaSnapshot,
        root_causes: rootCauses,
        improve_plan: improvePlan,
        control_plan: controlPlan,
      },
      process_map: {
        as_is_mermaid: result.asIsMermaid,
        to_be_mermaid: result.toBeMermaid,
      },
      automation_blueprint: result.blueprint,
      exports: result.exports,
    }

    await copyJson('DMAIC work packet', packagePayload)
  }

  function exportTicketBundle() {
    if (!result) {
      return
    }

    const exportBundle = {
      jira: result.exports.jira_issue_create,
      servicenow: result.exports.servicenow_record_create,
      process_tracker: result.exports.process_tracker_row,
    }

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = 'bis-automation-exports.json'
    anchor.click()
    URL.revokeObjectURL(objectUrl)
    setCopyStatus('Export bundle downloaded')
  }

  const categoryDefinition = result
    ? catalog?.categories.find((item) => item.id === result.triage.category) ?? null
    : null

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">BIS Process Optimisation Copilot</p>
        <h1>Turn a messy BIS request into an execution-ready automation packet.</h1>
        <p className="hero-subtitle">
          Start once. Get a project charter, before/after process maps, automation blueprint, and export payloads.
        </p>
      </header>

      <section className="panel workspace-panel">
        <section className="control-pane">
          <h2>1. Choose request</h2>

          <section className="example-picker">
            <label htmlFor="example-select">Use case</label>
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

          {result ? (
            <button className="secondary-btn export-btn" onClick={() => exportTicketBundle()}>
              Export Jira + ServiceNow payloads
            </button>
          ) : null}

          <p className="hint-text">{hintText}</p>
          {error ? <p className="error-text">{error}</p> : null}
          {copyStatus ? <p className="status-text success-text">{copyStatus}</p> : null}
        </section>

        <section className="result-pane" aria-live="polite">
          <section className={`automation-moment ${result ? 'is-complete' : ''}`}>
            <header className="moment-header">
              <p className="label">Automation moment</p>
              <h2>Before and after in one run</h2>
            </header>
            <div className="moment-grid">
              <article className="moment-card before-card">
                <h3>Before (manual)</h3>
                <p className="moment-request">{requestPreview}</p>
                <ul className="moment-list">
                  <li>
                    <span>Cycle time</span>
                    <strong>{formatDays(previewBaselineDays)}</strong>
                  </li>
                  <li>
                    <span>Monthly volume</span>
                    <strong>{previewVolume ?? 'n/a'}</strong>
                  </li>
                  <li>
                    <span>Risk level</span>
                    <strong>{previewRisk ? prettyCategory(previewRisk) : 'n/a'}</strong>
                  </li>
                  <li>
                    <span>Manual handoffs</span>
                    <strong>{beforeManualSteps}</strong>
                  </li>
                </ul>
              </article>
              <div className="moment-arrow" aria-hidden="true">
                →
              </div>
              <article className="moment-card after-card">
                <h3>After (automated)</h3>
                {result ? (
                  <>
                    <ul className="outcome-list">
                      <li>Project charter generated</li>
                      <li>As-is and to-be process maps generated</li>
                      <li>Automation blueprint generated</li>
                      <li>Jira and ServiceNow payloads generated</li>
                    </ul>
                    <div className="impact-strip">
                      <article className="metric-pill">
                        <span>Lead time</span>
                        <strong>
                          {formatDays(beforeCycleTime)} to {formatDays(afterCycleTime)}
                        </strong>
                      </article>
                      <article className="metric-pill">
                        <span>Hours saved</span>
                        <strong>{impactSnapshot?.monthlyHoursSaved ?? 0}h / month</strong>
                      </article>
                      <article className="metric-pill">
                        <span>Quality</span>
                        <strong>
                          {sigmaSnapshot?.baselineSigma ?? 0}σ to {sigmaSnapshot?.targetSigma ?? 0}σ
                        </strong>
                      </article>
                      <article className="metric-pill">
                        <span>Touchpoints</span>
                        <strong>
                          {beforeManualSteps} to {afterManualSteps ?? 0}
                        </strong>
                      </article>
                    </div>
                  </>
                ) : (
                  <p className="detail-note">
                    Click <strong>Start demo</strong> to turn this into a complete execution packet.
                  </p>
                )}
              </article>
            </div>
          </section>

          {result ? (
            <>
              <section className="executive-card">
                <p className="card-kicker">Your outputs</p>
                <h2>Execution packet ready to send</h2>
                <p className="exec-summary">{result.charter.problem_statement}</p>
                <div className="summary-row">
                  <article className="summary-card">
                    <span>Category</span>
                    <strong>{prettyCategory(result.triage.category)}</strong>
                  </article>
                  <article className="summary-card">
                    <span>Priority</span>
                    <strong>{result.triage.priority}</strong>
                  </article>
                  <article className="summary-card">
                    <span>Risk</span>
                    <strong>{prettyCategory(result.triage.risk_level)}</strong>
                  </article>
                </div>
                {categoryDefinition ? <p className="detail-note">{categoryDefinition.description}</p> : null}
                <ol className="action-list compact-list">
                  {improvePlan.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <strong>{item.step}</strong>
                      <span>{item.expectedEffect}</span>
                    </li>
                  ))}
                </ol>
                <div className="actions-row">
                  <button className="primary-btn" onClick={() => exportTicketBundle()}>
                    Export Jira + ServiceNow payloads
                  </button>
                  <button className="secondary-btn" onClick={() => void copyFullPack()}>
                    Copy full packet JSON
                  </button>
                </div>
                <p className="integration-note">
                  These payloads are shaped like ticketing and tracker APIs to show transferability.
                </p>
              </section>

              <details className="packet-details">
                <summary>View full DMAIC packet</summary>
                <section className="details-grid">
                  <article className="detail-card">
                    <h3>Charter</h3>
                    <ul className="detail-list">
                      <li>
                        <strong>Problem</strong>
                        <span>{result.charter.problem_statement}</span>
                      </li>
                      <li>
                        <strong>Scope in</strong>
                        <span>{result.charter.scope_in.join(' | ')}</span>
                      </li>
                      <li>
                        <strong>Stakeholders</strong>
                        <span>{result.charter.stakeholders.join(', ')}</span>
                      </li>
                      <li>
                        <strong>Baseline cycle</strong>
                        <span>{metricToText(result.charter.baseline_metrics.cycle_time_days)}</span>
                      </li>
                      <li>
                        <strong>Target cycle</strong>
                        <span>{metricToText(result.charter.target_metrics.cycle_time_days_target)}</span>
                      </li>
                    </ul>
                  </article>

                  <article className="detail-card">
                    <h3>Root causes and controls</h3>
                    <ul className="detail-list">
                      {rootCauses.map((cause) => (
                        <li key={cause.cause}>
                          <strong>{cause.cause}</strong>
                          <span>{cause.effect}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="detail-list">
                      {controlPlan.map((item) => (
                        <li key={item.metric}>
                          <strong>{item.metric}</strong>
                          <span>
                            {item.frequency} | {item.trigger}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <MermaidDiagram title="As-is process map" chart={result.asIsMermaid} />
                  <MermaidDiagram title="To-be process map" chart={result.toBeMermaid} />

                  <article className="detail-card span-2">
                    <h3>Export preview</h3>
                    <ul className="detail-list compact">
                      <li>
                        <strong>Jira summary</strong>
                        <span>{metricToText(jiraFields?.summary)}</span>
                      </li>
                      <li>
                        <strong>ServiceNow short description</strong>
                        <span>{metricToText(servicenowBody?.short_description)}</span>
                      </li>
                      <li>
                        <strong>Tracker owner</strong>
                        <span>{metricToText(trackerPayload?.owner)}</span>
                      </li>
                      <li>
                        <strong>Target SLA</strong>
                        <span>{metricToText(trackerPayload?.target_sla_days)}</span>
                      </li>
                    </ul>
                    <div className="actions-row copy-group">
                      <button
                        className="secondary-btn"
                        onClick={() => copyJson('Jira payload', result.exports.jira_issue_create)}
                      >
                        Copy Jira JSON
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => copyJson('ServiceNow payload', result.exports.servicenow_record_create)}
                      >
                        Copy ServiceNow JSON
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => copyJson('Tracker payload', result.exports.process_tracker_row)}
                      >
                        Copy tracker JSON
                      </button>
                    </div>
                  </article>
                </section>
              </details>
            </>
          ) : (
            <section className="executive-card placeholder-card">
              <p className="card-kicker">Your outputs</p>
              <h2>Run once to generate ready-to-use deliverables</h2>
              <ul className="outcome-list">
                <li>Lean charter with baseline and target metrics</li>
                <li>As-is and to-be process maps</li>
                <li>Automation blueprint with controls</li>
                <li>Export payloads for Jira and ServiceNow</li>
              </ul>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
