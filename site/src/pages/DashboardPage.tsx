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
        <h1>I build decision systems that stay reliable when conditions change.</h1>
        <p className="hero-copy">
          My focus is practical: keep high-stakes decisions stable under drift, shifting objectives,
          and hard operating constraints.
        </p>

        <div className="overview-fact-row" aria-label="Motivation context">
          <article className="overview-fact">
            <p className="matrix-label">Systems built</p>
            <p>{formatNumber(profile.counts.projects)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Papers</p>
            <p>{formatNumber(metrics.works_count)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Citations</p>
            <p>{formatNumber(metrics.citations_total)}</p>
          </article>
        </div>
      </section>

      <ArcSpine current="motivation" />

      <PageCompass
        title="Read In 20 Seconds"
        steps={[
          'Start with the core pressure.',
          'Use the three signals for scope.',
          'Carry these principles into Skills.',
        ]}
        outcome="This section defines why the rest of the portfolio is structured the way it is."
      />

      <section className="panel">
        <header className="panel-header">
          <h2>Principles That Guide Every Build</h2>
        </header>
        <div className="direction-grid">
          <article className="direction-card">
            <h3>Reliability before peak score</h3>
            <p>
              A method matters only if it stays dependable under drift, not only at a static peak.
            </p>
          </article>
          <article className="direction-card">
            <h3>Operations shape modeling early</h3>
            <p>
              Service reliability, cost, and deployment feasibility are design constraints, not afterthoughts.
            </p>
          </article>
          <article className="direction-card">
            <h3>Claims must be inspectable</h3>
            <p>
              Every claim should be visible in code, measurable in outcomes, and grounded in evidence.
            </p>
          </article>
        </div>

        <p className="meta-line">
          These principles directly shape the methods shown next.
        </p>
      </section>
    </div>
  )
}
