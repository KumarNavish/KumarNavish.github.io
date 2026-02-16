import { useCallback } from 'react'

import { ArcBridge } from '../components/ArcBridge'
import { ArcNarrative } from '../components/ArcNarrative'
import { ArcThread } from '../components/ArcThread'
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
          I start from decision pressure, then move through methods, operational outcomes, evidence,
          and delivery history as one continuous narrative.
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

      <ArcThread current="motivation" />
      <ArcNarrative current="motivation" />

      <section className="panel">
        <header className="panel-header">
          <h2>Motivation Principles</h2>
        </header>
        <div className="direction-grid">
          <article className="direction-card">
            <h3>Clarity before complexity</h3>
            <p>
              Start from the decision that matters, then choose the smallest artifact that proves
              it.
            </p>
          </article>
          <article className="direction-card">
            <h3>Artifacts over assertions</h3>
            <p>
              Every important claim should be inspectable in code, interaction, or measurable output.
            </p>
          </article>
          <article className="direction-card">
            <h3>Continuity across layers</h3>
            <p>
              Motivation, skills, impact, research, and experience should read as one connected
              system.
            </p>
          </article>
        </div>

        <p className="meta-line">
          These principles define the methods validated in the skills layer.
        </p>
      </section>

      <ArcBridge current="motivation" />
    </div>
  )
}
