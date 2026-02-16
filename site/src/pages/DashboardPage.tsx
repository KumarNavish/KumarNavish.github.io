import { useCallback } from 'react'

import { ArcSpine } from '../components/ArcSpine'
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
        <h1>I build decision systems that stay reliable as conditions change.</h1>
        <p className="hero-copy">
          My work starts from one practical constraint: decisions should remain dependable even when
          data, objectives, and operating conditions shift.
        </p>

        <div className="overview-fact-row" aria-label="Motivation context">
          <article className="overview-fact">
            <p className="matrix-label">Problems worked</p>
            <p>{formatNumber(profile.counts.projects)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Research works</p>
            <p>{formatNumber(metrics.works_count)}</p>
          </article>
          <article className="overview-fact">
            <p className="matrix-label">Citations</p>
            <p>{formatNumber(metrics.citations_total)}</p>
          </article>
        </div>
      </section>

      <ArcSpine current="motivation" />

      <section className="panel">
        <header className="panel-header">
          <h2>What This Motivation Requires</h2>
        </header>
        <div className="direction-grid">
          <article className="direction-card">
            <h3>Reliability under drift</h3>
            <p>
              Methods must stay stable when environments change, not only on static benchmarks.
            </p>
          </article>
          <article className="direction-card">
            <h3>Operational constraints first</h3>
            <p>
              Modeling must respect service, cost, and deployment constraints from the beginning.
            </p>
          </article>
          <article className="direction-card">
            <h3>Evidence tied to decisions</h3>
            <p>
              Each claim should be inspectable in systems, measurable outcomes, and research backing.
            </p>
          </article>
        </div>

        <p className="meta-line">
          These requirements determine the skills developed in the next layer.
        </p>
      </section>
    </div>
  )
}
