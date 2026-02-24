import { useCallback } from 'react'

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
        <p className="eyebrow">Overview</p>
        <h1>Use this site to judge whether these ML methods are practical to deploy.</h1>
        <p className="hero-copy">
          Every section is built to answer one question: does this approach hold up under real
          operational change?
        </p>

        <div className="identity-snapshot" aria-label="Identity at a glance">
          <article className="identity-card">
            <p className="matrix-label">Who I am</p>
            <p>Research-grounded builder who ships applied ML systems.</p>
          </article>
          <article className="identity-card">
            <p className="matrix-label">What I build</p>
            <p>Reliability-focused models, tools, and decision workflows.</p>
          </article>
          <article className="identity-card">
            <p className="matrix-label">Why it matters</p>
            <p>Operations get systems they can trust under real change.</p>
          </article>
        </div>

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

      <section className="panel utility-panel">
        <header className="panel-header">
          <h2>Start Here In 2 Minutes</h2>
        </header>
        <div className="utility-list">
          <article className="utility-step">
            <p className="matrix-label">1</p>
            <h3>Test methods under stress</h3>
            <p>Open Methods to compare strategy behavior as regimes change.</p>
          </article>
          <article className="utility-step">
            <p className="matrix-label">2</p>
            <h3>Check real decision impact</h3>
            <p>Open Case Studies to see decisions, implementation links, and live simulation.</p>
          </article>
          <article className="utility-step">
            <p className="matrix-label">3</p>
            <h3>Verify evidence quality</h3>
            <p>Open Evidence to inspect publication grounding and citation trajectory.</p>
          </article>
        </div>
        <div className="action-row">
          <a className="action-link action-link-primary" href="/projects">
            Open Methods
          </a>
          <a className="action-link" href="/work">
            Open Case Studies
          </a>
          <a className="action-link" href="/publications">
            Open Evidence
          </a>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Three Build Principles</h2>
        </header>
        <div className="direction-grid">
          <article className="direction-card">
            <h3>Dependability over peak score</h3>
            <p>
              A method is useful only if it remains stable under drift, not only at a static optimum.
            </p>
          </article>
          <article className="direction-card">
            <h3>Operations-first modeling</h3>
            <p>
              Reliability, cost, and deployability are design inputs from the start.
            </p>
          </article>
          <article className="direction-card">
            <h3>Evidence before assertion</h3>
            <p>
              Claims must be visible in code and measurable in outcomes.
            </p>
          </article>
        </div>

        <p className="meta-line">These principles filter every method in the next layer.</p>
      </section>
    </div>
  )
}
