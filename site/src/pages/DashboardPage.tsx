import { useCallback } from 'react'

import { ArcSpine } from '../components/ArcSpine'
import { PageCompass } from '../components/PageCompass'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'
import { fetchMetricsApi, fetchProfileApi } from '../lib/api'
import { formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'

interface MotivationData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
}

export function DashboardPage() {
  const loadMotivation = useCallback(
    () =>
      Promise.all([fetchProfileApi(), fetchMetricsApi()]).then(([profile, metrics]) => ({
        profile,
        metrics,
      })),
    [],
  )

  const state = useResource<MotivationData>(loadMotivation)

  if (state.loading) {
    return <LoadingBlock label="Loading motivation." />
  }

  if (!state.data || state.error) {
    return (
      <ErrorBlock
        label="Unable to load motivation view."
        details={state.error ?? 'unknown motivation error'}
      />
    )
  }

  const { profile, metrics } = state.data

  return (
    <div className="page builder-page overview-flow">
      <section className="hero hero-primary builder-hero overview-hero">
        <p className="eyebrow">Motivation</p>
        <h1>I design ML systems that keep high-stakes decisions reliable.</h1>
        <p className="hero-copy">
          The core problem I work on is stability under change: shifting data, changing objectives,
          and operational constraints that do not wait for perfect conditions.
        </p>

        <div className="overview-fact-row" aria-label="Motivation context">
          <article className="overview-fact">
            <p className="matrix-label">Systems built</p>
            <p>{formatNumber(profile.counts.projects)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Research outputs</p>
            <p>{formatNumber(metrics.works_count)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Total citations</p>
            <p>{formatNumber(metrics.citations_total)}</p>
          </article>
        </div>
      </section>

      <ArcSpine current="motivation" />

      <PageCompass
        title="How To Read Motivation"
        steps={[
          'Start with the opening constraint and scope.',
          'Use the fact row to calibrate breadth and research depth.',
          'Read the three design principles as requirements for later layers.',
        ]}
        outcome="A clear understanding of why this portfolio is organized around decision reliability under change."
      />

      <section className="panel">
        <header className="panel-header">
          <h2>Design Principles Derived From This Motivation</h2>
        </header>
        <div className="direction-grid">
          <article className="direction-card">
            <h3>Robustness before peak metrics</h3>
            <p>
              A method is useful only if it remains dependable under drift, not just at a static
              optimum.
            </p>
          </article>
          <article className="direction-card">
            <h3>Operations in the loop</h3>
            <p>
              Service reliability, cost, and deployment feasibility shape modeling decisions early.
            </p>
          </article>
          <article className="direction-card">
            <h3>Claims tied to evidence</h3>
            <p>
              Every claim should be inspectable in code, measurable in outcomes, and grounded in
              research.
            </p>
          </article>
        </div>

        <p className="meta-line">
          These principles directly determine the technical skills shown next.
        </p>
      </section>
    </div>
  )
}
