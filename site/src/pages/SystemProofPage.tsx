import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchProfileApi,
  fetchProjectsApi,
  fetchPublicationsApi,
  type ProjectItem,
  type PublicationItem,
} from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface ImpactData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface ImpactUseCaseDefinition {
  id: string
  title: string
  owner: string
  decision: string
  outcome: string
  projectMatcher?: (name: string) => boolean
  publicationMatcher: (title: string) => boolean
}

const IMPACT_USE_CASES: ImpactUseCaseDefinition[] = [
  {
    id: 'continual-learning-updates',
    title: 'Continual-learning policy selection',
    owner: 'ML engineers running long-lived model updates',
    decision: 'Which policy update strategy preserves stability as tasks evolve?',
    outcome: 'Reduces update risk by pairing implementation experiments with formal guarantees.',
    projectMatcher: (name) => name.toLowerCase().includes('cl-plo'),
    publicationMatcher: (title) => title.toLowerCase().includes('square-root natural-gradient'),
  },
  {
    id: 'online-moderation',
    title: 'Harm-mitigation intervention design',
    owner: 'Trust and safety teams',
    decision: 'Which interaction signatures justify early intervention?',
    outcome:
      'Supports triage and policy testing through observed hate/counterspeech interaction patterns.',
    projectMatcher: (name) => name.toLowerCase().includes('twitter-hate-and-counter-speakers'),
    publicationMatcher: (title) => title.toLowerCase().includes('interaction dynamics between hate'),
  },
  {
    id: 'urban-transition-planning',
    title: 'Cargo-bike rollout prioritization',
    owner: 'Urban logistics and mobility planners',
    decision: 'Which micro-regions should be prioritized for transition first?',
    outcome: 'Provides pre-pilot evidence for transition sequencing and planning tradeoffs.',
    publicationMatcher: (title) =>
      title.toLowerCase().includes('delivery vehicles across urban micro-regions'),
  },
]

function buildOutcomeSignal(
  project: ProjectItem | null,
  publication: PublicationItem | null,
): string {
  const citationSignal = publication
    ? `${formatNumber(publication.citation_count)} citations${
        publication.year ? ` (${publication.year})` : ''
      }`
    : null
  const implementationSignal = project
    ? project.last_push
      ? `implementation updated ${new Date(project.last_push).getFullYear()}`
      : 'implementation available for direct review'
    : null

  if (citationSignal && implementationSignal) {
    return `${citationSignal}; ${implementationSignal}.`
  }
  if (citationSignal) {
    return `${citationSignal}; publication-backed decision evidence.`
  }
  if (implementationSignal) {
    return `${implementationSignal}.`
  }
  return 'Decision logic captured in publication-backed modeling.'
}

export function SystemProofPage() {
  const loadImpact = useCallback(
    () =>
      Promise.all([fetchProfileApi(), fetchProjectsApi(), fetchPublicationsApi()]).then(
        ([profile, projects, publications]) => ({
          profile,
          projects,
          publications,
        }),
      ),
    [],
  )

  const state = useResource<ImpactData>(loadImpact)

  const impactCards = useMemo(() => {
    const data = state.data
    if (!data) {
      return []
    }

    return IMPACT_USE_CASES.map((item) => {
      const project = item.projectMatcher
        ? data.projects.items.find((entry) => item.projectMatcher?.(entry.name)) ?? null
        : null
      const publication =
        data.publications.items.find((entry) => item.publicationMatcher(entry.title)) ?? null

      return {
        ...item,
        project,
        publication,
      }
    })
  }, [state.data])

  const implementationCount = useMemo(() => {
    if (!state.data) {
      return 0
    }
    return state.data.projects.items.filter((project) => project.featured || project.pinned).length
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading impact overview." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load impact overview."
        details={state.error ?? 'unknown impact page error'}
      />
    )
  }

  const { profile } = state.data

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Impact</p>
        <h1>Evidence is useful only when it supports action.</h1>
        <p className="hero-copy">
          This page shows practical decision tracks, the work outputs behind them, and supporting
          evidence.
        </p>
      </section>

      <section className="metric-grid" aria-label="Impact snapshot">
        <article className="metric-card">
          <p className="metric-label">Decision tracks</p>
          <p className="metric-value">{formatNumber(impactCards.length)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Implemented systems</p>
          <p className="metric-value">{formatNumber(implementationCount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Evidence papers</p>
          <p className="metric-value">{formatNumber(profile.counts.publications)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Total citations</p>
          <p className="metric-value">{formatNumber(profile.counts.citations_total)}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Decision Tracks</h2>
        </header>
        <div className="stack-list">
          {impactCards.map((card) => (
            <article key={card.id} className="stack-item">
              <h3>{card.title}</h3>
              <p className="meta-line">
                <strong>Primary user:</strong> {card.owner}
              </p>
              <p className="meta-line">
                <strong>Decision:</strong> {card.decision}
              </p>
              <p>{card.outcome}</p>
              <p className="meta-line">
                <strong>Implementation:</strong>{' '}
                {card.project ? (
                  <>
                    {card.project.one_line ?? card.project.name}
                    {' '}
                    ·{' '}
                    <a
                      href={card.project.demo_url ?? card.project.html_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </>
                ) : (
                  'Paper-backed modeling output.'
                )}
              </p>
              <p className="meta-line">
                <strong>Evidence:</strong>{' '}
                {card.publication ? (
                  <>
                    {card.publication.title}
                    {' '}
                    · {formatNumber(card.publication.citation_count)} citations
                    {card.publication.url ? (
                      <>
                        {' '}
                        ·{' '}
                        <a href={card.publication.url} target="_blank" rel="noreferrer">
                          Read
                        </a>
                      </>
                    ) : null}
                  </>
                ) : (
                  'Publication evidence is being curated for this track.'
                )}
              </p>
              <p className="meta-line">
                <strong>Outcome signal:</strong>{' '}
                {buildOutcomeSignal(card.project, card.publication)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Direct Outputs</h2>
        </header>
        <div className="action-row">
          <Link className="action-link" to="/work">
            Case studies
          </Link>
          <Link className="action-link" to="/projects">
            Projects archive
          </Link>
          <Link className="action-link" to="/publications">
            Publications archive
          </Link>
          <a className="action-link" href="/api/v1/profile.json" target="_blank" rel="noreferrer">
            Data endpoint
          </a>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Last refresh {formatDateTime(profile.last_sync.last_run_timestamp)} · Sources:{' '}
          {profile.source_provenance.projects_source ?? 'unknown projects source'} /{' '}
          {profile.source_provenance.publications_source ?? 'unknown publications source'}
        </p>
      </section>
    </div>
  )
}
