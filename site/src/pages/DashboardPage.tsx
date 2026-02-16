import { useCallback } from 'react'
import { Link } from 'react-router-dom'

import { ArcNarrative } from '../components/ArcNarrative'
import { ArcThread } from '../components/ArcThread'
import { ErrorBlock, LoadingBlock } from '../components/StateBlocks'
import { fetchMetricsApi, fetchProfileApi } from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/formatters'
import { useResource } from '../lib/useResource'

interface MotivationData {
  profile: Awaited<ReturnType<typeof fetchProfileApi>>
  metrics: Awaited<ReturnType<typeof fetchMetricsApi>>
}

const ARC_STEPS = [
  {
    title: 'Motivation',
    summary:
      'I define decision pressure before choosing methods or tools.',
    route: '/',
    cta: 'Current layer',
  },
  {
    title: 'Skills',
    summary:
      'I validate methods through live artifacts under explicit constraints.',
    route: '/projects',
    cta: 'Continue to Skills',
  },
  {
    title: 'Impact',
    summary:
      'I show measurable decision change in operational settings.',
    route: '/work',
    cta: 'Continue to Impact',
  },
  {
    title: 'Research',
    summary:
      'I ground implementation choices in published evidence.',
    route: '/publications',
    cta: 'Continue to Research',
  },
  {
    title: 'Experience',
    summary:
      'I close the loop with delivery history and artifacts.',
    route: '/experience',
    cta: 'Continue to Experience',
  },
] as const

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
          This portfolio follows one arc: why the problem matters, how I build, what changes in
          practice, and the evidence behind it.
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

      <section className="panel narrative-path-panel">
        <header className="panel-header">
          <h2>Arc Overview</h2>
        </header>
        <div className="sequence-grid arc-sequence-grid">
          {ARC_STEPS.map((step, index) => (
            <article key={step.title} className="sequence-step">
              <p className="sequence-index">Step {index + 1}</p>
              <h3>{step.title}</h3>
              <p>{step.summary}</p>
              <p className="meta-line">
                <Link className="builder-inline-link" to={step.route}>
                  {step.cta}
                </Link>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Guiding Principles</h2>
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

        <div className="action-row">
          <Link className="action-link action-link-primary" to="/projects">
            Continue to Skills
          </Link>
          <Link className="action-link" to="/work">
            Jump to Impact
          </Link>
        </div>
      </section>

      <section className="panel panel-note">
        <p className="meta-line">Updated {formatDateTime(profile.last_sync.last_run_timestamp)}</p>
      </section>
    </div>
  )
}
