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
  question: string
  appliedUse: string
  projectMatcher: (project: ProjectItem) => boolean
  publicationMatcher: (publication: PublicationItem) => boolean
}

const CASE_STUDIES: CaseStudyDefinition[] = [
  {
    id: 'natural-gradient-vi',
    track: 'Method Design',
    title: 'Square-root Natural-gradient Variational Inference',
    question:
      'How can variational inference keep formal guarantees and remain practical to implement?',
    appliedUse: 'Supports dependable inference updates in continual-learning pipelines.',
    projectMatcher: (project) => project.name.toLowerCase().includes('cl-plo'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('square-root natural-gradient'),
  },
  {
    id: 'urban-logistics',
    track: 'Operational AI',
    title: 'Urban Micro-region Logistics Modeling',
    question:
      'How can delivery transitions be evaluated from observed city behavior instead of assumptions?',
    appliedUse: 'Supports planning decisions for sustainable fleet transitions.',
    projectMatcher: (project) =>
      `${project.name} ${project.description}`.toLowerCase().includes('logistics'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('delivery vehicles across urban micro-regions'),
  },
  {
    id: 'social-counterspeech',
    track: 'Social Systems',
    title: 'Hate and Counterspeech Interaction Dynamics',
    question:
      'Which interaction patterns separate harmful behavior from protective response?',
    appliedUse: 'Supports moderation policy analysis and intervention prioritization.',
    projectMatcher: (project) =>
      `${project.name} ${project.description}`.toLowerCase().includes('twitter'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('interaction dynamics between hate'),
  },
]

function findMatchedProject(
  projects: ProjectItem[],
  matcher: (project: ProjectItem) => boolean,
): ProjectItem | null {
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
      publication: findMatchedPublication(
        data.publications.items,
        definition.publicationMatcher,
      ),
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
        <h1>How problem framing is converted into systems and evidence.</h1>
        <p className="hero-copy">
          Each case follows one structure so review is fast: problem, implementation, applied use,
          and supporting evidence.
        </p>
      </section>

      <section id="cases" className="panel">
        <header className="panel-header">
          <h2>Primary Cases</h2>
        </header>
        <div className="stack-list">
          {caseStudies.map((caseStudy) => (
            <article key={caseStudy.id} className="stack-item case-study-card">
              <p className="eyebrow">{caseStudy.track}</p>
              <h3>{caseStudy.title}</h3>
              <div className="case-matrix case-matrix-4">
                <div>
                  <p className="matrix-label">Problem</p>
                  <p>{caseStudy.question}</p>
                </div>
                <div>
                  <p className="matrix-label">Implementation</p>
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
                          Open
                        </a>
                      </>
                    ) : (
                      'Project link is being prepared.'
                    )}
                  </p>
                </div>
                <div>
                  <p className="matrix-label">Applied use</p>
                  <p>{caseStudy.appliedUse}</p>
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
                      'Publication link is being prepared.'
                    )}
                  </p>
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
              <p>{project.one_line ?? 'Research artifact with implementation details.'}</p>
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
            Applied value
          </Link>
        </div>
        <p className="meta-line">
          Last refresh {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
