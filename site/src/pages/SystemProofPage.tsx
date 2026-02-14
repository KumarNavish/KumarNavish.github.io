import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchDagApi,
  fetchLatestRunApi,
  fetchProfileApi,
  fetchProvenanceApi,
  fetchStatusApi,
  type DagTask,
  type LatestRunTask,
} from '../lib/api'
import { compactList, formatDateTime, formatDuration, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface SystemData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  status: Awaited<ReturnType<typeof fetchStatusApi>> | null
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>> | null
  provenance: Awaited<ReturnType<typeof fetchProvenanceApi>> | null
  dag: Awaited<ReturnType<typeof fetchDagApi>> | null
}

type LaneId = 'ingest' | 'transform' | 'publish'

interface LaneDefinition {
  id: LaneId
  title: string
  hint: string
}

const LANES: LaneDefinition[] = [
  {
    id: 'ingest',
    title: 'Ingest',
    hint: 'Collect from registry and external APIs.',
  },
  {
    id: 'transform',
    title: 'Transform',
    hint: 'Normalize records and compute signals.',
  },
  {
    id: 'publish',
    title: 'Publish',
    hint: 'Emit APIs, artifacts, and final status.',
  },
]

function classifyLane(taskName: string): LaneId {
  if (taskName.startsWith('ingest_')) {
    return 'ingest'
  }
  if (taskName === 'emit_resume_pdf' || taskName === 'emit_status_api') {
    return 'publish'
  }
  return 'transform'
}

function normalizePublicPath(path: string): string {
  if (!path) {
    return '/'
  }
  return path.startsWith('/') ? path : `/${path}`
}

function runAgeHours(timestamp: string | null | undefined): number | null {
  if (!timestamp) {
    return null
  }
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const elapsed = Date.now() - date.getTime()
  if (elapsed < 0) {
    return 0
  }
  return elapsed / (1000 * 60 * 60)
}

function warningCount(tasks: LatestRunTask[]): number {
  return tasks.reduce(
    (total, task) =>
      total + task.logs.filter((log) => log.level === 'warning' || log.level === 'error').length,
    0,
  )
}

function buildTaskMap(tasks: LatestRunTask[]): Map<string, LatestRunTask> {
  return new Map(tasks.map((task) => [task.name, task]))
}

function taskStatus(task: LatestRunTask | null): string {
  return task?.status ?? 'unknown'
}

export function SystemProofPage() {
  const [selectedTaskName, setSelectedTaskName] = useState<string>('')

  const loadSystem = useCallback(
    () =>
      Promise.all([
        fetchProfileApi(),
        fetchStatusApi().catch(() => null),
        fetchLatestRunApi().catch(() => null),
        fetchProvenanceApi().catch(() => null),
        fetchDagApi().catch(() => null),
      ]).then(([profile, status, latestRun, provenance, dag]) => ({
        profile,
        status,
        latestRun,
        provenance,
        dag,
      })),
    [],
  )

  const state = useResource<SystemData>(loadSystem)

  const allTasks = useMemo(() => {
    if (!state.data?.dag) {
      return []
    }
    return state.data.dag.tasks
  }, [state.data])

  const latestRunTasks = useMemo(() => state.data?.latestRun?.tasks ?? [], [state.data])

  const latestTaskMap = useMemo(() => buildTaskMap(latestRunTasks), [latestRunTasks])

  const defaultTaskName = useMemo(() => {
    if (latestRunTasks.length === 0) {
      return allTasks[0]?.name ?? ''
    }

    const failed = latestRunTasks.find((task) => task.status === 'failed')
    if (failed) {
      return failed.name
    }

    const warned = latestRunTasks.find((task) =>
      task.logs.some((log) => log.level === 'warning' || log.level === 'error'),
    )
    if (warned) {
      return warned.name
    }

    return (
      latestRunTasks
        .slice()
        .sort((left, right) => right.duration_seconds - left.duration_seconds)[0]?.name ??
      latestRunTasks[0]?.name ??
      allTasks[0]?.name ??
      ''
    )
  }, [allTasks, latestRunTasks])

  const activeTaskName = useMemo(() => {
    if (!selectedTaskName) {
      return defaultTaskName
    }
    const existsInDag = allTasks.some((task) => task.name === selectedTaskName)
    return existsInDag ? selectedTaskName : defaultTaskName
  }, [allTasks, defaultTaskName, selectedTaskName])

  const selectedDagTask = useMemo(
    () => allTasks.find((task) => task.name === activeTaskName) ?? null,
    [activeTaskName, allTasks],
  )

  const selectedRunTask = useMemo(
    () => (activeTaskName ? latestTaskMap.get(activeTaskName) ?? null : null),
    [activeTaskName, latestTaskMap],
  )

  const laneTasks = useMemo(() => {
    const dagTasks = state.data?.dag?.tasks ?? []
    const grouped: Record<LaneId, DagTask[]> = {
      ingest: [],
      transform: [],
      publish: [],
    }

    for (const task of dagTasks) {
      grouped[classifyLane(task.name)].push(task)
    }

    return grouped
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading system board." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load system board."
        details={state.error ?? 'unknown system board error'}
      />
    )
  }

  const { dag, latestRun, profile, provenance, status } = state.data
  const runAge = runAgeHours(latestRun?.run.timestamp)
  const runWarningCount = warningCount(latestRunTasks)
  const workflowUrl = latestRun?.run.action_run_url ?? provenance?.action_run_url ?? null

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">System Board</p>
        <h1>Inspect the pipeline that powers the portfolio.</h1>
        <p className="hero-copy">
          Trace the full run path from ingestion to published APIs, then inspect each task directly.
        </p>
      </section>

      <section className="metric-grid" aria-label="System snapshot">
        <article className="metric-card">
          <p className="metric-label">Current status</p>
          <p className="metric-value">{latestRun?.run.status ?? status?.status ?? 'n/a'}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Tasks</p>
          <p className="metric-value">{formatNumber(latestRun?.run.task_count ?? dag?.tasks.length ?? null)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Warnings</p>
          <p className="metric-value">{formatNumber(runWarningCount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Run age</p>
          <p className="metric-value">{runAge === null ? 'n/a' : `${Math.round(runAge)}h`}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Pipeline Map</h2>
          {workflowUrl ? (
            <a href={workflowUrl} target="_blank" rel="noreferrer">
              workflow run
            </a>
          ) : (
            <a href="/ops/dag.json" target="_blank" rel="noreferrer">
              raw DAG JSON
            </a>
          )}
        </header>

        {dag ? (
          <div className="pipeline-lanes">
            {LANES.map((lane) => (
              <section key={lane.id} className="pipeline-lane">
                <p className="matrix-label">{lane.title}</p>
                <p className="meta-line">{lane.hint}</p>
                <div className="pipeline-task-list">
                  {laneTasks[lane.id].map((task) => {
                    const runTask = latestTaskMap.get(task.name) ?? null
                    const active = task.name === activeTaskName
                    return (
                      <button
                        key={task.name}
                        type="button"
                        className={active ? 'pipeline-task pipeline-task-active' : 'pipeline-task'}
                        onClick={() => setSelectedTaskName(task.name)}
                      >
                        <span className="pipeline-task-name">{task.name}</span>
                        <span className={`status-pill status-${taskStatus(runTask)}`}>{taskStatus(runTask)}</span>
                        <span className="pipeline-task-meta">
                          {runTask ? formatDuration(runTask.duration_seconds) : `${task.deps.length} deps`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="meta-line">DAG endpoint unavailable in this environment.</p>
        )}
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Task Inspector</h2>
          {activeTaskName ? <span className="meta-line">Selected: {activeTaskName}</span> : null}
        </header>

        {selectedDagTask ? (
          <div className="card-grid">
            <article className="item-card">
              <p className="matrix-label">Dependencies</p>
              <p>{selectedDagTask.deps.length > 0 ? compactList(selectedDagTask.deps, 6) : 'None'}</p>
              <p className="meta-line">Inputs: {selectedDagTask.inputs.length}</p>
              <p className="meta-line">Outputs: {selectedDagTask.outputs.length}</p>
            </article>

            <article className="item-card">
              <p className="matrix-label">Inputs</p>
              <p>{selectedDagTask.inputs.length > 0 ? compactList(selectedDagTask.inputs, 3) : 'None'}</p>
              <p className="matrix-label">Outputs</p>
              <p>{selectedDagTask.outputs.length > 0 ? compactList(selectedDagTask.outputs, 3) : 'None'}</p>
            </article>

            <article className="item-card">
              <p className="matrix-label">Run status</p>
              <p>
                {selectedRunTask ? (
                  <>
                    <span className={`status-pill status-${selectedRunTask.status}`}>{selectedRunTask.status}</span>
                    {' · '}
                    {formatDuration(selectedRunTask.duration_seconds)}
                  </>
                ) : (
                  'No run details available.'
                )}
              </p>
              {selectedRunTask?.error ? <p className="meta-line">{selectedRunTask.error}</p> : null}
              {selectedRunTask?.logs.length ? (
                <ul className="ops-log-list">
                  {selectedRunTask.logs.map((log) => (
                    <li key={`${log.timestamp}-${log.message}`}>
                      <strong>{log.level}</strong>: {log.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="meta-line">No logs for this task.</p>
              )}
            </article>
          </div>
        ) : (
          <p className="meta-line">Select a task from the pipeline map.</p>
        )}
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Published Outputs</h2>
        </header>

        <div className="action-row">
          <a className="action-link" href="/api/v1/profile.json" target="_blank" rel="noreferrer">
            profile.json
          </a>
          <a className="action-link" href="/api/v1/projects.json" target="_blank" rel="noreferrer">
            projects.json
          </a>
          <a className="action-link" href="/api/v1/publications.json" target="_blank" rel="noreferrer">
            publications.json
          </a>
          <a className="action-link" href="/api/v1/search-index.json" target="_blank" rel="noreferrer">
            search-index.json
          </a>
        </div>

        {provenance ? (
          <div className="stack-list">
            {Object.entries(provenance.artifacts).map(([name, path]) => (
              <article key={name} className="stack-item">
                <h3>{name}</h3>
                <p className="meta-line">{path}</p>
                <p className="meta-line">
                  <a href={normalizePublicPath(path)} target="_blank" rel="noreferrer">
                    Open artifact
                  </a>
                </p>
              </article>
            ))}
          </div>
        ) : null}

        <p className="meta-line">
          Last refresh {formatDateTime(profile.last_sync.last_run_timestamp)}
          {latestRun?.run.trigger?.event_name ? ` · trigger ${latestRun.run.trigger.event_name}` : ''}
          {provenance?.git_sha ? ` · git ${provenance.git_sha.slice(0, 10)}` : ''}
        </p>

        <div className="action-row">
          <Link className="action-link" to="/">
            Back to overview
          </Link>
          <Link className="action-link" to="/work">
            Case studies
          </Link>
          <Link className="action-link" to="/projects">
            Project archive
          </Link>
        </div>
      </section>
    </div>
  )
}
