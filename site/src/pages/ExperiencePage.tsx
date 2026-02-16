import { useCallback, useMemo } from 'react'

import { ArcSpine } from '../components/ArcSpine'
import { PageCompass } from '../components/PageCompass'
import {
  fetchProfileApi,
  fetchProjectsApi,
  fetchPublicationsApi,
} from '../lib/api'
import { formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'

interface ExperienceData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  projects: Awaited<ReturnType<typeof fetchProjectsApi>>
  publications: Awaited<ReturnType<typeof fetchPublicationsApi>>
}

function yearFromIsoDate(value: string | null): number | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.getFullYear()
}

export function ExperiencePage() {
  const loadExperience = useCallback(
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

  const state = useResource<ExperienceData>(loadExperience)

  const trajectory = useMemo(() => {
    if (!state.data) {
      return {
        firstResearchYear: null as number | null,
        latestResearchYear: null as number | null,
        latestBuildYear: null as number | null,
      }
    }

    const publicationYears = state.data.publications.items
      .map((publication) => publication.year)
      .filter((year): year is number => typeof year === 'number')
    const projectYears = state.data.projects.items
      .map((project) => yearFromIsoDate(project.last_push))
      .filter((year): year is number => typeof year === 'number')

    return {
      firstResearchYear:
        publicationYears.length > 0 ? Math.min(...publicationYears) : null,
      latestResearchYear:
        publicationYears.length > 0 ? Math.max(...publicationYears) : null,
      latestBuildYear: projectYears.length > 0 ? Math.max(...projectYears) : null,
    }
  }, [state.data])

  if (state.loading) {
    return <LoadingBlock label="Loading experience." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load experience view."
        details={state.error ?? 'unknown experience error'}
      />
    )
  }

  const { profile, projects, publications } = state.data

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Experience</p>
        <h1>I carry work from inquiry to production delivery.</h1>
        <p className="hero-copy">
          This final layer shows progression over time: how the arc translated into sustained execution.
        </p>
      </section>

      <ArcSpine current="experience" />

      <PageCompass
        title="Read In 20 Seconds"
        steps={[
          'Read the three phases as one progression.',
          'Use metrics for scope and continuity.',
          'Open artifacts for direct proof.',
        ]}
        outcome="This section closes the arc with a clear execution trajectory."
      />

      <section className="panel">
        <header className="panel-header">
          <h2>Execution Progression</h2>
        </header>
        <div className="sequence-grid">
          <article className="sequence-step">
            <p className="sequence-index">Phase 1</p>
            <h3>Research foundation</h3>
            <p>
              Publication record established{trajectory.firstResearchYear ? ` in ${trajectory.firstResearchYear}` : ''},
              with focus on rigorous modeling and analysis.
            </p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">Phase 2</p>
            <h3>Applied ML systems</h3>
            <p>
              Transition to deployable ML systems with constrained optimization and reliability checks.
            </p>
          </article>
          <article className="sequence-step">
            <p className="sequence-index">Phase 3</p>
            <h3>End-to-end delivery</h3>
            <p>
              Systems maintained through {trajectory.latestBuildYear ?? 'current'} with automated
              data generation, testing, and continuous deployment.
            </p>
          </article>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Projects</p>
          <p className="metric-value">{formatNumber(projects.count)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Publications</p>
          <p className="metric-value">{formatNumber(publications.count)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Featured systems</p>
          <p className="metric-value">{formatNumber(profile.counts.featured_projects)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Latest research year</p>
          <p className="metric-value">{formatNumber(trajectory.latestResearchYear)}</p>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Execution Artifacts</h2>
        </header>
        <div className="card-grid">
          <article className="item-card">
            <h3>Generated resume</h3>
            <p>Role and delivery summary generated from structured source data.</p>
            <p className="meta-line">
              <a href="/artifacts/resume.pdf" target="_blank" rel="noreferrer">
                Open resume PDF
              </a>
            </p>
          </article>
          <article className="item-card">
            <h3>GitHub profile</h3>
            <p>Primary record of repository activity and implementation history.</p>
            <p className="meta-line">
              <a href={profile.links.github} target="_blank" rel="noreferrer">
                Open GitHub
              </a>
            </p>
          </article>
          <article className="item-card">
            <h3>Portfolio system repository</h3>
            <p>End-to-end source for data pipeline, APIs, frontend, and deployment workflow.</p>
            <p className="meta-line">
              <a
                href="https://github.com/KumarNavish/KumarNavish.github.io"
                target="_blank"
                rel="noreferrer"
              >
                Open repository
              </a>
            </p>
          </article>
        </div>
      </section>

    </div>
  )
}
