import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchLatestRunApi,
  fetchMetricsApi,
  fetchProfileApi,
  fetchProjectsApi,
  fetchProvenanceApi,
  fetchPublicationsApi,
  fetchSearchIndexApi,
  fetchStatusApi,
  type LatestRunApi,
  type ProjectItem,
  type PublicationItem,
  type SearchDocument,
} from '../lib/api'
import {
  compactList,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
} from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
  searchIndex: Awaited<ReturnType<typeof fetchSearchIndexApi>>
  status: Awaited<ReturnType<typeof fetchStatusApi>> | null
  latestRun: Awaited<ReturnType<typeof fetchLatestRunApi>> | null
  provenance: Awaited<ReturnType<typeof fetchProvenanceApi>> | null
}

type SearchScope = 'all' | 'project' | 'publication'

interface DecisionTrack {
  id: string
  title: string
  decision: string
  keywords: string[]
  actionPrompt: string
}

interface RankedEvidence {
  key: string
  type: 'project' | 'publication'
  score: number
  matchedTerms: string[]
  doc: SearchDocument
  project: ProjectItem | null
  publication: PublicationItem | null
}

const DECISION_TRACKS: DecisionTrack[] = [
  {
    id: 'stability',
    title: 'Stable continual updates',
    decision: 'Select an update strategy that preserves performance across sequential tasks.',
    actionPrompt: 'Use this when selecting update policy for long-lived model deployments.',
    keywords: ['continual', 'optimization', 'policy', 'natural', 'gradient', 'stability'],
  },
  {
    id: 'safety',
    title: 'Online harm mitigation',
    decision: 'Prioritize signals that justify earlier intervention in harmful interactions.',
    actionPrompt: 'Use this when designing moderation triage and intervention thresholds.',
    keywords: ['hate', 'counter', 'interaction', 'moderation', 'social', 'twitter'],
  },
  {
    id: 'logistics',
    title: 'Urban transition planning',
    decision: 'Rank micro-regions for phased logistics transition and pilot rollout.',
    actionPrompt: 'Use this when sequencing rollout candidates under operational constraints.',
    keywords: ['urban', 'logistics', 'micro', 'regions', 'delivery', 'cargo'],
  },
]

function tokenize(text: string): string[] {
  return Array.from(new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(Boolean)))
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase()
}

function cleanSnippet(value: string | null | undefined): string {
  if (!value) {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'none') {
    return ''
  }
  return trimmed
}

function yearsSince(dateValue: string | null): number | null {
  if (!dateValue) {
    return null
  }
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Date().getFullYear() - date.getFullYear()
}

function computeProjectScore(
  project: ProjectItem,
  matchedTerms: string[],
  baseScore: number,
): number {
  const featuredBoost = project.featured || project.pinned ? 7 : 0
  const starBoost = Math.min(6, Math.log10(project.stars + 1) * 4)
  const recencyYears = yearsSince(project.last_push)
  const recencyBoost = recencyYears === null ? 0 : Math.max(0, 5 - recencyYears)
  const tagBoost = matchedTerms.some((term) =>
    project.tags.some((tag) => tag.toLowerCase().includes(term)),
  )
    ? 3
    : 0

  return baseScore + featuredBoost + starBoost + recencyBoost + tagBoost
}

function computePublicationScore(
  publication: PublicationItem,
  matchedTerms: string[],
  baseScore: number,
): number {
  const citationBoost = Math.min(12, Math.log10((publication.citation_count ?? 0) + 1) * 6)
  const recencyBoost = publication.year
    ? Math.max(0, 4 - (new Date().getFullYear() - publication.year))
    : 0
  const keywordBoost = matchedTerms.some((term) =>
    publication.keywords.some((keyword) => keyword.toLowerCase().includes(term)),
  )
    ? 2
    : 0

  return baseScore + citationBoost + recencyBoost + keywordBoost
}

function runAgeHours(run: LatestRunApi | null): number | null {
  const timestamp = run?.run.timestamp
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

function buildNextMove(project: ProjectItem | null, publication: PublicationItem | null): string {
  if (project && publication) {
    return `Start with ${project.name} and validate assumptions against ${publication.title}.`
  }
  if (project) {
    return `Start by extending ${project.name} with the selected track constraints.`
  }
  if (publication) {
    return `Use ${publication.title} as the primary evidence anchor for this track.`
  }
  return 'Broaden the query terms to surface stronger project and publication alignment.'
}

export function DashboardPage() {
  const [selectedTrackId, setSelectedTrackId] = useState<string>(DECISION_TRACKS[0].id)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [publicationFloor, setPublicationFloor] = useState<string>('all')

  const loadDashboard = useCallback(
    () =>
      Promise.all([
        fetchProfileApi(),
        fetchProjectsApi(),
        fetchPublicationsApi(),
        fetchMetricsApi(),
        fetchSearchIndexApi(),
        fetchStatusApi().catch(() => null),
        fetchLatestRunApi().catch(() => null),
        fetchProvenanceApi().catch(() => null),
      ]).then(
        ([
          profile,
          projects,
          publications,
          metrics,
          searchIndex,
          status,
          latestRun,
          provenance,
        ]) => ({
          profile,
          projects,
          publications,
          metrics,
          searchIndex,
          status,
          latestRun,
          provenance,
        }),
      ),
    [],
  )

  const state = useResource<DashboardData>(loadDashboard)

  const selectedTrack = useMemo(
    () => DECISION_TRACKS.find((track) => track.id === selectedTrackId) ?? DECISION_TRACKS[0],
    [selectedTrackId],
  )

  const publicationYears = useMemo(() => {
    if (!state.data) {
      return []
    }
    return Array.from(
      new Set(
        state.data.publications.items
          .map((publication) => publication.year)
          .filter((year): year is number => typeof year === 'number'),
      ),
    ).sort((left, right) => right - left)
  }, [state.data])

  const rankedEvidence = useMemo(() => {
    if (!state.data) {
      return []
    }

    const floorYear = publicationFloor === 'all' ? null : Number(publicationFloor)
    const terms = Array.from(
      new Set([
        ...selectedTrack.keywords.map(normalizeTerm),
        ...tokenize(query).map(normalizeTerm),
      ]),
    ).filter((term) => term.length > 1)

    const projectsByName = new Map(
      state.data.projects.items.map((project) => [project.name.toLowerCase(), project]),
    )
    const publicationsById = new Map(
      state.data.publications.items.map((publication) => [publication.id, publication]),
    )

    const hitMap = new Map<number, { score: number; terms: Set<string> }>()

    for (const term of terms) {
      const docIds = state.data.searchIndex.postings[term] ?? []
      for (const docId of docIds) {
        const existing = hitMap.get(docId) ?? { score: 0, terms: new Set<string>() }
        existing.score += 10
        existing.terms.add(term)
        hitMap.set(docId, existing)
      }
    }

    const results: RankedEvidence[] = []

    for (const doc of state.data.searchIndex.documents) {
      if (scope !== 'all' && doc.type !== scope) {
        continue
      }

      const signal = hitMap.get(doc.doc_id)
      const fallbackTerms = terms.filter((term) => {
        const haystack = `${doc.title} ${doc.subtitle}`.toLowerCase()
        return haystack.includes(term)
      })

      if (terms.length > 0 && !signal && fallbackTerms.length === 0) {
        continue
      }

      const matchedTerms = signal ? Array.from(signal.terms) : fallbackTerms
      const baseScore = signal ? signal.score : fallbackTerms.length * 5

      if (doc.type === 'project') {
        const projectName = doc.id.startsWith('project:') ? doc.id.slice(8) : doc.title
        const project = projectsByName.get(projectName.toLowerCase()) ?? null
        if (!project) {
          continue
        }
        if (featuredOnly && !(project.featured || project.pinned)) {
          continue
        }

        const score = computeProjectScore(project, matchedTerms, baseScore)
        results.push({
          key: doc.id,
          type: 'project',
          score,
          matchedTerms,
          doc,
          project,
          publication: null,
        })
        continue
      }

      const publicationId = doc.id.startsWith('publication:') ? doc.id.slice(12) : doc.id
      const publication = publicationsById.get(publicationId) ?? null
      if (!publication) {
        continue
      }
      if (floorYear && publication.year && publication.year < floorYear) {
        continue
      }

      const score = computePublicationScore(publication, matchedTerms, baseScore)
      results.push({
        key: doc.id,
        type: 'publication',
        score,
        matchedTerms,
        doc,
        project: null,
        publication,
      })
    }

    return results.sort(
      (left, right) => right.score - left.score || left.doc.title.localeCompare(right.doc.title),
    )
  }, [featuredOnly, publicationFloor, query, scope, selectedTrack, state.data])

  const topProject = useMemo(
    () => rankedEvidence.find((item) => item.type === 'project')?.project ?? null,
    [rankedEvidence],
  )

  const topPublication = useMemo(
    () => rankedEvidence.find((item) => item.type === 'publication')?.publication ?? null,
    [rankedEvidence],
  )

  const evidenceMix = useMemo(() => {
    const projectMatches = rankedEvidence.filter((item) => item.type === 'project').length
    const publicationMatches = rankedEvidence.filter((item) => item.type === 'publication').length
    return { projectMatches, publicationMatches }
  }, [rankedEvidence])

  const topWarnings = useMemo(() => {
    const latestRun = state.data?.latestRun
    if (!latestRun) {
      return []
    }

    return latestRun.tasks
      .flatMap((task) =>
        task.logs
          .filter((log) => log.level === 'warning' || log.level === 'error')
          .map((log) => ({ task: task.name, ...log })),
      )
      .slice(0, 4)
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading capability overview." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load capability overview."
        details={state.error ?? 'unknown overview error'}
      />
    )
  }

  const { latestRun, metrics, profile, provenance, status } = state.data
  const runAge = runAgeHours(latestRun)
  const warningCount = topWarnings.length
  const maxScore = rankedEvidence[0]?.score ?? 1
  const maxTaskDuration = Math.max(...(latestRun?.tasks.map((task) => task.duration_seconds) ?? [1]))

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Overview</p>
        <h1>Portfolio as a live decision system.</h1>
        <p className="hero-copy">
          Choose a decision track, inspect ranked evidence, and verify the pipeline run that produced
          the result.
        </p>
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/proof">
            Open system board
          </Link>
          <Link className="action-link" to="/work">
            See applied cases
          </Link>
          <a className="action-link" href="/api/v1/profile.json" target="_blank" rel="noreferrer">
            API endpoint
          </a>
        </div>
      </section>

      <section className="metric-grid" aria-label="Snapshot">
        <article className="metric-card">
          <p className="metric-label">Projects</p>
          <p className="metric-value">{formatNumber(profile.counts.projects)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Publications</p>
          <p className="metric-value">{formatNumber(profile.counts.publications)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Citations</p>
          <p className="metric-value">{formatNumber(profile.counts.citations_total)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Search docs</p>
          <p className="metric-value">{formatNumber(state.data.searchIndex.document_count)}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Decision Studio</h2>
        </header>

        <div className="track-row" role="tablist" aria-label="Decision tracks">
          {DECISION_TRACKS.map((track) => (
            <button
              key={track.id}
              type="button"
              className={track.id === selectedTrack.id ? 'track-chip track-chip-active' : 'track-chip'}
              onClick={() => setSelectedTrackId(track.id)}
            >
              {track.title}
            </button>
          ))}
        </div>

        <p className="meta-line">
          <strong>Decision:</strong> {selectedTrack.decision}
        </p>

        <div className="controls-panel workbench-controls">
          <label>
            Focus query
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="optional terms"
            />
          </label>

          <label>
            Evidence scope
            <select value={scope} onChange={(event) => setScope(event.target.value as SearchScope)}>
              <option value="all">Projects + publications</option>
              <option value="project">Projects only</option>
              <option value="publication">Publications only</option>
            </select>
          </label>

          <label>
            Publication floor year
            <select
              value={publicationFloor}
              onChange={(event) => setPublicationFloor(event.target.value)}
            >
              <option value="all">All years</option>
              {publicationYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}+
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="toggle-line">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(event) => setFeaturedOnly(event.target.checked)}
          />
          Featured systems only
        </label>

        <div className="card-grid decision-output-grid">
          <article className="item-card decision-output-card">
            <p className="eyebrow">Recommended next move</p>
            <h3>{buildNextMove(topProject, topPublication)}</h3>
            <p>{selectedTrack.actionPrompt}</p>
            <p className="meta-line">
              {topProject ? (
                <>
                  Project: <strong>{topProject.name}</strong>
                  {' · '}
                  <a href={topProject.demo_url ?? topProject.html_url} target="_blank" rel="noreferrer">
                    Open implementation
                  </a>
                </>
              ) : (
                'No project match under current constraints.'
              )}
            </p>
            <p className="meta-line">
              {topPublication ? (
                <>
                  Paper: <strong>{topPublication.title}</strong>
                  {' · '}
                  {formatNumber(topPublication.citation_count)} citations
                </>
              ) : (
                'No publication match under current constraints.'
              )}
            </p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Evidence mix</p>
            <h3>{formatNumber(rankedEvidence.length)} matched records</h3>
            <p className="meta-line">
              {formatNumber(evidenceMix.projectMatches)} projects ·{' '}
              {formatNumber(evidenceMix.publicationMatches)} publications
            </p>
            <p className="meta-line">
              Top terms:{' '}
              {rankedEvidence[0]?.matchedTerms.length
                ? compactList(rankedEvidence[0].matchedTerms, 5)
                : 'n/a'}
            </p>
            <p className="meta-line">
              Last sync {formatDateTime(profile.last_sync.last_run_timestamp)}
            </p>
          </article>
        </div>

        <div className="stack-list evidence-feed">
          {rankedEvidence.slice(0, 8).map((item) => {
            const percent = Math.max(8, Math.round((item.score / maxScore) * 100))
            const subtitle = cleanSnippet(item.doc.subtitle)
            return (
              <article key={item.key} className="stack-item evidence-item">
                <div className="evidence-top-row">
                  <h3>{item.doc.title}</h3>
                  <span className="score-pill">{item.score.toFixed(1)}</span>
                </div>
                <div className="evidence-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <p className="meta-line">
                  {item.type === 'project' ? 'Project' : 'Publication'} · matched:{' '}
                  {compactList(item.matchedTerms, 6)}
                </p>
                {subtitle ? <p className="meta-line">{subtitle}</p> : null}
                <p className="meta-line">
                  {item.doc.url ? (
                    <a href={item.doc.url} target="_blank" rel="noreferrer">
                      Open source
                    </a>
                  ) : (
                    <Link to={item.doc.route}>Open record</Link>
                  )}
                </p>
              </article>
            )
          })}
          {rankedEvidence.length === 0 ? (
            <article className="stack-item evidence-item">
              <h3>No evidence matches yet</h3>
              <p className="meta-line">Loosen filters or add broader query terms.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Automation Trail</h2>
          <a href="/ops/latest-run.json" target="_blank" rel="noreferrer">
            raw run JSON
          </a>
        </header>

        <div className="metric-grid ops-metric-grid">
          <article className="metric-card">
            <p className="metric-label">Pipeline status</p>
            <p className="metric-value">{latestRun?.run.status ?? status?.status ?? 'n/a'}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Tasks passed</p>
            <p className="metric-value">{formatNumber(latestRun?.summary.success ?? null)}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Warnings</p>
            <p className="metric-value">{formatNumber(warningCount)}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Run age</p>
            <p className="metric-value">{runAge === null ? 'n/a' : `${Math.round(runAge)}h`}</p>
          </article>
        </div>

        {latestRun ? (
          <div className="stack-list task-timeline">
            {latestRun.tasks.map((task) => {
              const widthPercent = Math.max(
                10,
                Math.round((task.duration_seconds / maxTaskDuration) * 100),
              )
              return (
                <article key={task.name} className="stack-item task-item">
                  <div className="evidence-top-row">
                    <h3>{task.name}</h3>
                    <span className={`status-pill status-${task.status}`}>{task.status}</span>
                  </div>
                  <div className="evidence-bar" aria-hidden="true">
                    <span style={{ width: `${widthPercent}%` }} />
                  </div>
                  <p className="meta-line">
                    {formatDuration(task.duration_seconds)} · deps {task.deps.length} · outputs{' '}
                    {task.outputs.length}
                  </p>
                  {task.outputs.length > 0 ? (
                    <p className="meta-line">{compactList(task.outputs, 2)}</p>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="meta-line">Ops endpoint unavailable in this environment.</p>
        )}

        {topWarnings.length > 0 ? (
          <div className="ops-warning-block">
            <p className="matrix-label">Warnings and errors</p>
            <ul>
              {topWarnings.map((warning) => (
                <li key={`${warning.task}-${warning.timestamp}-${warning.message}`}>
                  <strong>{warning.task}</strong>: {warning.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="meta-line">
          Refresh {formatDateTime(profile.last_sync.last_run_timestamp)} · metric source {metrics.source}
          {provenance?.git_sha ? ` · git ${provenance.git_sha.slice(0, 10)}` : ''}
          {latestRun?.run.trigger?.event_name ? ` · trigger ${latestRun.run.trigger.event_name}` : ''}
        </p>
        {topProject?.last_push ? (
          <p className="meta-line">Top project updated {formatDate(topProject.last_push)}.</p>
        ) : null}
      </section>
    </div>
  )
}
