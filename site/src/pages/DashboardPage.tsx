import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchMetricsApi,
  fetchProfileApi,
  fetchProjectsApi,
  fetchPublicationsApi,
  fetchSearchIndexApi,
  type ProjectItem,
  type PublicationItem,
  type SearchDocument,
} from '../lib/api'
import { compactList, formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface DashboardData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
  searchIndex: Awaited<ReturnType<typeof fetchSearchIndexApi>>
}

type SearchScope = 'all' | 'project' | 'publication'

interface DecisionTrack {
  id: string
  title: string
  decision: string
  keywords: string[]
  value: string
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
    decision: 'Choose update strategies that preserve performance as tasks evolve.',
    value: 'Use this to reduce model regression risk in long-lived deployments.',
    keywords: ['continual', 'optimization', 'policy', 'natural', 'gradient', 'stability'],
  },
  {
    id: 'safety',
    title: 'Online harm mitigation',
    decision: 'Prioritize behavioral signals that justify earlier intervention.',
    value: 'Use this to design more reliable moderation triage and intervention policies.',
    keywords: ['hate', 'counter', 'interaction', 'moderation', 'social', 'twitter'],
  },
  {
    id: 'logistics',
    title: 'Urban transition planning',
    decision: 'Rank regions for phased logistics transition and pilot sequencing.',
    value: 'Use this to sequence rollout decisions with practical operational constraints.',
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

function computeProjectScore(project: ProjectItem, matchedTerms: string[], baseScore: number): number {
  const featuredBoost = project.featured || project.pinned ? 7 : 0
  const starBoost = Math.min(5, Math.log10(project.stars + 1) * 3)
  const recencyYears = yearsSince(project.last_push)
  const recencyBoost = recencyYears === null ? 0 : Math.max(0, 4 - recencyYears)
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
  const citationBoost = Math.min(10, Math.log10((publication.citation_count ?? 0) + 1) * 5)
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

function describeStrength(score: number, maxScore: number): string {
  if (maxScore <= 0) {
    return 'Exploratory fit'
  }
  const ratio = score / maxScore
  if (ratio >= 0.75) {
    return 'High fit'
  }
  if (ratio >= 0.45) {
    return 'Solid fit'
  }
  return 'Exploratory fit'
}

function buildNextMove(project: ProjectItem | null, publication: PublicationItem | null): string {
  if (project && publication) {
    return `Start with ${project.name}, then validate assumptions against ${publication.title}.`
  }
  if (project) {
    return `Start by extending ${project.name} under the selected decision constraints.`
  }
  if (publication) {
    return `Use ${publication.title} as the primary evidence anchor.`
  }
  return 'Broaden the query to surface stronger project and evidence alignment.'
}

export function DashboardPage() {
  const [selectedTrackId, setSelectedTrackId] = useState<string>(DECISION_TRACKS[0].id)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')

  const loadDashboard = useCallback(
    () =>
      Promise.all([
        fetchProfileApi(),
        fetchProjectsApi(),
        fetchPublicationsApi(),
        fetchMetricsApi(),
        fetchSearchIndexApi(),
      ]).then(([profile, projects, publications, metrics, searchIndex]) => ({
        profile,
        projects,
        publications,
        metrics,
        searchIndex,
      })),
    [],
  )

  const state = useResource<DashboardData>(loadDashboard)

  const selectedTrack = useMemo(
    () => DECISION_TRACKS.find((track) => track.id === selectedTrackId) ?? DECISION_TRACKS[0],
    [selectedTrackId],
  )

  const rankedEvidence = useMemo(() => {
    if (!state.data) {
      return []
    }

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

        results.push({
          key: doc.id,
          type: 'project',
          score: computeProjectScore(project, matchedTerms, baseScore),
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

      results.push({
        key: doc.id,
        type: 'publication',
        score: computePublicationScore(publication, matchedTerms, baseScore),
        matchedTerms,
        doc,
        project: null,
        publication,
      })
    }

    return results.sort(
      (left, right) => right.score - left.score || left.doc.title.localeCompare(right.doc.title),
    )
  }, [query, scope, selectedTrack, state.data])

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

  const { metrics, profile } = state.data
  const maxScore = rankedEvidence[0]?.score ?? 1

  return (
    <div className="page">
      <section className="hero hero-primary">
        <p className="eyebrow">Overview</p>
        <h1>Research organized for practical decisions.</h1>
        <p className="hero-copy">
          Select a decision track to surface the most relevant systems and evidence, then move
          directly into case work.
        </p>
        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            Open case studies
          </Link>
          <Link className="action-link" to="/proof">
            View approach
          </Link>
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
          <p className="metric-label">Featured systems</p>
          <p className="metric-value">{formatNumber(profile.counts.featured_projects)}</p>
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
          <strong>Focus:</strong> {selectedTrack.decision}
        </p>

        <div className="controls-panel controls-panel-2 workbench-controls">
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
        </div>

        <p className="meta-line">
          <strong>Track keywords:</strong> {compactList(selectedTrack.keywords, 6)}
        </p>

        <div className="card-grid decision-output-grid">
          <article className="item-card decision-output-card">
            <p className="eyebrow">Recommended move</p>
            <h3>{buildNextMove(topProject, topPublication)}</h3>
            <p>{selectedTrack.value}</p>
          </article>

          <article className="item-card decision-output-card">
            <p className="eyebrow">Current match mix</p>
            <h3>{formatNumber(rankedEvidence.length)} relevant records</h3>
            <p className="meta-line">
              {formatNumber(evidenceMix.projectMatches)} projects ·{' '}
              {formatNumber(evidenceMix.publicationMatches)} publications
            </p>
            <p className="meta-line">
              Core themes:{' '}
              {metrics.topics.length > 0
                ? compactList(metrics.topics.slice(0, 4).map((topic) => topic.topic), 4)
                : 'n/a'}
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
                  <span className="score-pill">{describeStrength(item.score, maxScore)}</span>
                </div>
                <div className="evidence-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <p className="meta-line">
                  {item.type === 'project' ? 'Build artifact' : 'Evidence anchor'} · matched:{' '}
                  {compactList(item.matchedTerms, 6)}
                </p>
                {subtitle ? <p className="meta-line">{subtitle}</p> : null}
                <p className="meta-line">
                  {item.doc.url ? (
                    <a href={item.doc.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    <Link to={item.doc.route}>Open</Link>
                  )}
                </p>
              </article>
            )
          })}
          {rankedEvidence.length === 0 ? (
            <article className="stack-item evidence-item">
              <h3>No strong matches yet</h3>
              <p className="meta-line">Try broader terms for a wider evidence set.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">Updated {formatDateTime(profile.last_sync.last_run_timestamp)}</p>
      </section>
    </div>
  )
}
