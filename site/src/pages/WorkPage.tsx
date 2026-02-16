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
import { simulateLastMilePlan } from '../lib/lastMileSimulator'
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

const SERVICE_TARGET_PRESETS = [0.93, 0.95, 0.97] as const

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

function buildOutcomeSignal(
  project: ProjectItem | null,
  publication: PublicationItem | null,
): string {
  const citationSignal = publication
    ? `${formatNumber(publication.citation_count)} citations${
        publication.year ? ` (${publication.year})` : ''
      }`
    : null
  const projectSignal = project
    ? project.last_push
      ? `implementation updated ${new Date(project.last_push).getFullYear()}`
      : 'implementation available for direct review'
    : null

  if (citationSignal && projectSignal) {
    return `${citationSignal}; ${projectSignal}.`
  }
  if (citationSignal) {
    return `${citationSignal}; publication-backed decision evidence.`
  }
  if (projectSignal) {
    return `${projectSignal}.`
  }
  return 'Decision logic documented and reviewable in this case.'
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatSignedPercent(value: number): string {
  const formatted = (value * 100).toFixed(1)
  return `${value > 0 ? '+' : ''}${formatted}%`
}

export function WorkPage() {
  const [demandVolatility, setDemandVolatility] = useState(0.38)
  const [bikeLaneCoverage, setBikeLaneCoverage] = useState(0.57)
  const [serviceLevelTarget, setServiceLevelTarget] = useState<number>(0.95)

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

  const logisticsSimulation = useMemo(
    () =>
      simulateLastMilePlan({
        demand_volatility: demandVolatility,
        bike_lane_coverage: bikeLaneCoverage,
        service_level_target: serviceLevelTarget,
      }),
    [bikeLaneCoverage, demandVolatility, serviceLevelTarget],
  )

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
    return <LoadingBlock label="Loading impact." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load impact view."
        details={state.error ?? 'unknown work page error'}
      />
    )
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Impact</p>
        <h1>Impact is demonstrated where models alter operational decisions.</h1>
        <p className="hero-copy">
          Each case follows one sequence: claim, artifact, evidence, and measurable operational
          signal.
        </p>
        <div className="action-row">
          <Link className="action-link" to="/projects">
            Back to Skills
          </Link>
          <Link className="action-link action-link-primary" to="/publications">
            Continue to Research
          </Link>
        </div>
      </section>

      <section id="cases" className="panel">
        <header className="panel-header">
          <h2>Case Evidence Map</h2>
        </header>
        <div className="stack-list">
          {caseStudies.map((caseStudy) => (
            <article
              key={caseStudy.id}
              id={`case-${caseStudy.id}`}
              className="stack-item case-study-card"
            >
              <p className="eyebrow">{caseStudy.track}</p>
              <h3>{caseStudy.title}</h3>

              <div className="case-rows">
                <div className="case-row">
                  <p className="matrix-label">Claim</p>
                  <p>{caseStudy.decision}</p>
                </div>

                <div className="case-row">
                  <p className="matrix-label">Artifact</p>
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
                      `${caseStudy.implementation} This case is evidenced through publication and operational outputs.`
                    )}
                  </p>
                </div>

                <div className="case-row">
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
                            <a href={caseStudy.publication.url} target="_blank" rel="noreferrer">
                              Read
                            </a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      'Publication evidence is being curated for this case.'
                    )}
                  </p>
                </div>

                <div className="case-row">
                  <p className="matrix-label">Operational signal</p>
                  <p>{buildOutcomeSignal(caseStudy.project, caseStudy.publication)}</p>
                </div>
              </div>

              {caseStudy.id === 'urban-transition-planning' ? (
                <section className="case-demo-shell" aria-label="Last-mile logistics simulator">
                  <header className="case-demo-head">
                    <p className="matrix-label">In-context demonstration</p>
                    <h4>Last-mile transition planner</h4>
                    <p className="meta-line">
                      Tune two operating conditions. Service target stays explicit as a deployment
                      choice.
                    </p>
                  </header>

                  <div className="case-demo-grid">
                    <label className="case-demo-slider">
                      Demand volatility ({formatPercent(demandVolatility)})
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={demandVolatility}
                        onChange={(event) => setDemandVolatility(Number(event.target.value))}
                      />
                    </label>

                    <label className="case-demo-slider">
                      Bike-lane coverage ({formatPercent(bikeLaneCoverage)})
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={bikeLaneCoverage}
                        onChange={(event) => setBikeLaneCoverage(Number(event.target.value))}
                      />
                    </label>
                  </div>

                  <div className="case-demo-target-row" role="group" aria-label="Service-level target">
                    {SERVICE_TARGET_PRESETS.map((target) => (
                      <button
                        key={target}
                        type="button"
                        className={
                          target === serviceLevelTarget ? 'track-chip track-chip-active' : 'track-chip'
                        }
                        onClick={() => setServiceLevelTarget(target)}
                      >
                        Service target {formatPercent(target)}
                      </button>
                    ))}
                  </div>

                  <div className="case-demo-outcomes">
                    <article className="case-demo-card">
                      <p className="matrix-label">Fleet split</p>
                      <p className="case-demo-value">
                        {formatPercent(logisticsSimulation.bike_share)} bikes ·{' '}
                        {formatPercent(logisticsSimulation.van_share)} vans
                      </p>
                    </article>
                    <article className="case-demo-card">
                      <p className="matrix-label">Expected reliability</p>
                      <p className="case-demo-value">
                        {formatPercent(logisticsSimulation.expected_reliability)}
                      </p>
                    </article>
                    <article className="case-demo-card">
                      <p className="matrix-label">Cost delta vs van baseline</p>
                      <p className="case-demo-value">
                        {formatSignedPercent(logisticsSimulation.cost_delta_vs_van_baseline)}
                      </p>
                    </article>
                    <article className="case-demo-card">
                      <p className="matrix-label">Emissions reduction</p>
                      <p className="case-demo-value">
                        {formatPercent(logisticsSimulation.emissions_reduction)}
                      </p>
                    </article>
                  </div>

                  <div className="case-demo-plan">
                    <p className="matrix-label">Suggested first wave</p>
                    <ol className="case-demo-list">
                      {logisticsSimulation.first_wave.map((region) => (
                        <li key={region}>{region}</li>
                      ))}
                    </ol>
                    <p className="meta-line">{logisticsSimulation.rationale}</p>
                  </div>
                </section>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section id="systems" className="panel">
        <header className="panel-header">
          <h2>Supporting Repositories</h2>
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
          <h2>Continue the Arc</h2>
        </header>
        <div className="action-row">
          <Link className="action-link" to="/projects">
            Skills layer
          </Link>
          <Link className="action-link action-link-primary" to="/publications">
            Research layer
          </Link>
        </div>
        <p className="meta-line">
          Last refresh {formatDateTime(state.data.profile.last_sync.last_run_timestamp)}
        </p>
      </section>
    </div>
  )
}
