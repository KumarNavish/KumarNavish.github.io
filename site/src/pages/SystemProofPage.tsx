import { useCallback, useMemo, useState } from 'react'
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

interface ApproachData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface ApproachTrack {
  id: string
  title: string
  decision: string
  whoBenefits: string
  practicalOutcome: string
  nextAction: string
  projectMatcher?: (project: ProjectItem) => boolean
  publicationMatcher: (publication: PublicationItem) => boolean
}

const APPROACH_TRACKS: ApproachTrack[] = [
  {
    id: 'continual-learning',
    title: 'Continual learning reliability',
    decision: 'Which update strategy stays stable as objectives and tasks shift over time?',
    whoBenefits: 'Teams maintaining long-lived learning systems',
    practicalOutcome: 'Lower update risk through implementation-backed policy comparisons.',
    nextAction: 'Compare update policies under your own task sequence and drift profile.',
    projectMatcher: (project) => project.name.toLowerCase().includes('cl-plo'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('square-root natural-gradient'),
  },
  {
    id: 'moderation',
    title: 'Interaction safety design',
    decision: 'Which interaction signatures should trigger earlier intervention?',
    whoBenefits: 'Trust and safety teams designing moderation workflows',
    practicalOutcome: 'More actionable triage criteria from observed user interaction patterns.',
    nextAction: 'Use interaction signatures to define intervention thresholds and escalation rules.',
    projectMatcher: (project) =>
      `${project.name} ${project.description}`.toLowerCase().includes('twitter'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('interaction dynamics between hate'),
  },
  {
    id: 'urban-logistics',
    title: 'Urban transition sequencing',
    decision: 'Where should transition pilots begin for the strongest operational fit?',
    whoBenefits: 'Urban logistics and mobility planning teams',
    practicalOutcome: 'Clearer pilot sequencing decisions across heterogeneous micro-regions.',
    nextAction: 'Rank candidate regions by expected transition fit before field rollout.',
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('delivery vehicles across urban micro-regions'),
  },
]

function findMatchedProject(
  projects: ProjectItem[],
  matcher?: (project: ProjectItem) => boolean,
): ProjectItem | null {
  if (!matcher) {
    return null
  }
  return projects.find(matcher) ?? null
}

function findMatchedPublication(
  publications: PublicationItem[],
  matcher: (publication: PublicationItem) => boolean,
): PublicationItem | null {
  return publications.find(matcher) ?? null
}

export function SystemProofPage() {
  const [selectedTrackId, setSelectedTrackId] = useState<string>(APPROACH_TRACKS[0].id)

  const loadApproach = useCallback(
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

  const state = useResource<ApproachData>(loadApproach)

  const selectedTrack = useMemo(
    () => APPROACH_TRACKS.find((track) => track.id === selectedTrackId) ?? APPROACH_TRACKS[0],
    [selectedTrackId],
  )

  const selectedProject = useMemo(() => {
    if (!state.data) {
      return null
    }
    return findMatchedProject(state.data.projects.items, selectedTrack.projectMatcher)
  }, [selectedTrack, state.data])

  const selectedPublication = useMemo(() => {
    if (!state.data) {
      return null
    }
    return findMatchedPublication(state.data.publications.items, selectedTrack.publicationMatcher)
  }, [selectedTrack, state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading approach." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load approach."
        details={state.error ?? 'unknown approach error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Approach</p>
        <h1>How decisions are framed, built, and validated.</h1>
        <p className="hero-copy">
          Select a track to see the exact reasoning loop: decision question, implementation, and
          evidence.
        </p>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Decision Tracks</h2>
        </header>

        <div className="track-row" role="tablist" aria-label="Approach tracks">
          {APPROACH_TRACKS.map((track) => (
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
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Execution Loop</h2>
        </header>

        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">Step 1</p>
            <h3>Frame the decision</h3>
            <p>{selectedTrack.decision}</p>
          </article>

          <article className="sequence-step">
            <p className="sequence-index">Step 2</p>
            <h3>Build the system</h3>
            {selectedProject ? (
              <>
                <p>{selectedProject.one_line ?? selectedProject.description ?? selectedProject.name}</p>
                <p className="meta-line">
                  <a href={selectedProject.demo_url ?? selectedProject.html_url} target="_blank" rel="noreferrer">
                    Open implementation
                  </a>
                </p>
              </>
            ) : (
              <p>Implementation pattern is captured directly in the decision design and evaluation flow.</p>
            )}
          </article>

          <article className="sequence-step">
            <p className="sequence-index">Step 3</p>
            <h3>Validate with evidence</h3>
            {selectedPublication ? (
              <>
                <p>{selectedPublication.title}</p>
                <p className="meta-line">
                  {formatNumber(selectedPublication.citation_count)} citations
                  {selectedPublication.year ? ` · ${selectedPublication.year}` : ''}
                </p>
                {selectedPublication.url ? (
                  <p className="meta-line">
                    <a href={selectedPublication.url} target="_blank" rel="noreferrer">
                      Read publication
                    </a>
                  </p>
                ) : null}
              </>
            ) : (
              <p>Evidence reference is currently being curated for this track.</p>
            )}
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Applied Value</h2>
        </header>

        <div className="card-grid">
          <article className="item-card">
            <p className="matrix-label">Who this helps</p>
            <p>{selectedTrack.whoBenefits}</p>
          </article>
          <article className="item-card">
            <p className="matrix-label">Practical outcome</p>
            <p>{selectedTrack.practicalOutcome}</p>
          </article>
          <article className="item-card">
            <p className="matrix-label">Next action</p>
            <p>{selectedTrack.nextAction}</p>
          </article>
        </div>

        <div className="action-row">
          <Link className="action-link action-link-primary" to="/work">
            Open case studies
          </Link>
          <Link className="action-link" to="/projects">
            Projects archive
          </Link>
          <Link className="action-link" to="/publications">
            Publications archive
          </Link>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">
          Updated {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
