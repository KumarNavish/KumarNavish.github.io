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

interface WorkData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

interface CaseStudyDefinition {
  id: string
  track: string
  title: string
  decision: string
  implementation: string
  outcome: string
  projectMatcher?: (project: ProjectItem) => boolean
  publicationMatcher: (publication: PublicationItem) => boolean
}

const CASE_STUDIES: CaseStudyDefinition[] = [
  {
    id: 'continual-learning-policy',
    track: 'Model Reliability',
    title: 'Continual-learning update policy',
    decision: 'Which update strategy stays stable as data and objectives shift over time?',
    implementation: 'CL-PLO sandbox for side-by-side strategy comparison under continual updates.',
    outcome:
      'Supports safer update-policy selection for long-lived learning systems where regressions are costly.',
    projectMatcher: (project) => project.name.toLowerCase().includes('cl-plo'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('square-root natural-gradient'),
  },
  {
    id: 'moderation-intervention',
    track: 'Safety Analytics',
    title: 'Hate and counterspeech intervention analysis',
    decision: 'Which behavior patterns should trigger intervention before harmful escalation?',
    implementation:
      'Dataset-backed interaction analysis between hate and counter users with reproducible code context.',
    outcome:
      'Supports moderation triage and policy evaluation with observed interaction signatures rather than guesswork.',
    projectMatcher: (project) => `${project.name} ${project.description}`.toLowerCase().includes('twitter'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('interaction dynamics between hate'),
  },
  {
    id: 'urban-transition-planning',
    track: 'Operational Planning',
    title: 'Cargo-bike transition prioritization',
    decision: 'Which urban micro-regions are best candidates for delivery-fleet transition first?',
    implementation:
      'Micro-region performance modeling from observed delivery behavior to compare transition scenarios.',
    outcome:
      'Supports rollout prioritization decisions before field pilots, reducing planning by assumption.',
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

export function WorkPage() {
  const loadWork = useCallback(
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

  const state = useResource<WorkData>(loadWork)

  const caseStudies = useMemo(() => {
    const data = state.data
    if (!data) {
      return []
    }

    return CASE_STUDIES.map((definition) => ({
      ...definition,
      project: findMatchedProject(data.projects.items, definition.projectMatcher),
      publication: findMatchedPublication(data.publications.items, definition.publicationMatcher),
    }))
  }, [state.data])

  const featuredProjects = useMemo(() => {
    const data = state.data
    if (!data) {
      return []
    }

    const profileFeatured = data.profile.featured.projects.map((project) => ({
      ...project,
      last_push: null as string | null,
    }))
    if (profileFeatured.length > 0) {
      return profileFeatured
    }

    return data.projects.items
      .filter((project) => project.featured || project.pinned)
      .slice(0, 4)
      .map((project) => ({
        name: project.name,
        one_line: project.one_line,
        html_url: project.html_url,
        demo_url: project.demo_url,
        last_push: project.last_push,
      }))
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading case studies." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load case studies."
        details={state.error ?? 'unknown work page error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Case Studies</p>
        <h1>Three applied cases, each tied to a real decision.</h1>
        <p className="hero-copy">
          Every case follows one format: decision, implementation, evidence, and practical outcome.
          This keeps review fast and comparable.
        </p>
      </section>

      <section id="cases" className="panel">
        <header className="panel-header">
          <h2>Decision Cases</h2>
        </header>
        <div className="stack-list">
          {caseStudies.map((caseStudy) => (
            <article key={caseStudy.id} className="stack-item case-study-card">
              <p className="eyebrow">{caseStudy.track}</p>
              <h3>{caseStudy.title}</h3>
              <div className="case-matrix case-matrix-4">
                <div>
                  <p className="matrix-label">Decision</p>
                  <p>{caseStudy.decision}</p>
                </div>
                <div>
                  <p className="matrix-label">Built</p>
                  <p>
                    {caseStudy.project ? (
                      <>
                        {caseStudy.project.one_line ??
                          caseStudy.project.description ??
                          caseStudy.project.name}
                        {' '}
                        ·{' '}
                        <a
                          href={caseStudy.project.demo_url ?? caseStudy.project.html_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open implementation
                        </a>
                      </>
                    ) : (
                      `${caseStudy.implementation} No standalone repository is required for this track.`
                    )}
                  </p>
                </div>
                <div>
                  <p className="matrix-label">Evidence</p>
                  <p>
                    {caseStudy.publication ? (
                      <>
                        {caseStudy.publication.title}
                        {' '}
                        · {formatNumber(caseStudy.publication.citation_count)} citations
                        {caseStudy.publication.url ? (
                          <>
                            {' '}
                            ·{' '}
                            <a
                              href={caseStudy.publication.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Read
                            </a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      'Primary publication metadata is not available in the current sync.'
                    )}
                  </p>
                </div>
                <div>
                  <p className="matrix-label">Practical outcome</p>
                  <p>{caseStudy.outcome}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="systems" className="panel">
        <header className="panel-header">
          <h2>Implementation References</h2>
        </header>
        <div className="card-grid">
          {featuredProjects.map((project) => (
            <article key={project.name} className="item-card">
              <h3>{project.name}</h3>
              <p>{project.one_line ?? 'Research implementation with reproducible setup.'}</p>
              <p className="meta-line">
                {project.last_push ? `Updated ${new Date(project.last_push).getFullYear()} · ` : ''}
                <a href={project.html_url ?? '/projects'} target="_blank" rel="noreferrer">
                  Repository
                </a>
                {project.demo_url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={project.demo_url} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="archives" className="panel">
        <header className="panel-header">
          <h2>Need Full Records?</h2>
        </header>
        <div className="action-row">
          <Link className="action-link" to="/projects">
            Project archive
          </Link>
          <Link className="action-link" to="/publications">
            Publication archive
          </Link>
          <Link className="action-link action-link-primary" to="/proof">
            Impact view
          </Link>
        </div>
        <p className="meta-line">
          Last refresh {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
