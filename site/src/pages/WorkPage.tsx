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
  projectMatcher: (project: ProjectItem) => boolean
  publicationMatcher: (publication: PublicationItem) => boolean
}

const CASE_STUDIES: CaseStudyDefinition[] = [
  {
    id: 'natural-gradient-vi',
    track: 'Theory to optimization system',
    title: 'Square-root Natural-gradient Variational Inference',
    question:
      'How can variational inference keep theoretical guarantees while remaining implementation-ready?',
    projectMatcher: (project) => project.name.toLowerCase().includes('cl-plo'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('square-root natural-gradient'),
  },
  {
    id: 'urban-logistics',
    track: 'Model to operational planning',
    title: 'Urban Micro-region Logistics Modeling',
    question:
      'How can sustainable delivery transitions be evaluated using observed city behavior instead of assumptions?',
    projectMatcher: (project) =>
      `${project.name} ${project.description}`.toLowerCase().includes('logistics'),
    publicationMatcher: (publication) =>
      publication.title.toLowerCase().includes('delivery vehicles across urban micro-regions'),
  },
  {
    id: 'social-counterspeech',
    track: 'Data to social intervention',
    title: 'Hate and Counterspeech Interaction Dynamics',
    question:
      'Which behavioral asymmetries identify harmful and protective actors in social systems?',
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
    return <LoadingBlock label="Loading curated work." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load curated work."
        details={state.error ?? 'unknown work page error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Case Studies</p>
        <h1>How questions become systems and evidence</h1>
        <p className="hero-copy">
          Three compact studies map the flow from framing, to build, to validated output.
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
              <div className="case-matrix">
                <div>
                  <p className="matrix-label">Question</p>
                  <p>{caseStudy.question}</p>
                </div>
                <div>
                  <p className="matrix-label">Build</p>
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
                          Open system
                        </a>
                      </>
                    ) : (
                      'Linked build artifact in active curation.'
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
                              Read paper
                            </a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      'Linked publication metadata in active curation.'
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
          <h2>Featured Systems</h2>
        </header>
        <div className="card-grid">
          {featuredProjects.map((project) => (
            <article key={project.name} className="item-card">
              <h3>{project.name}</h3>
              <p>{project.one_line ?? 'Technical artifact connected to ongoing research.'}</p>
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
                      Live demo
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
          <h2>Full Archives</h2>
        </header>
        <div className="action-row">
          <Link className="action-link" to="/projects">
            Project archive
          </Link>
          <Link className="action-link" to="/publications">
            Publication archive
          </Link>
          <Link className="action-link action-link-primary" to="/proof">
            System evidence
          </Link>
        </div>
        <p className="meta-line">
          Last curated sync {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
