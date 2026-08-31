import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import './casePathProductExperience.css'

type CaseStep = 0 | 1 | 2 | 3 | 4 | 5

type SourceRecord = {
  id: string
  title: string
  excerpt: string
  authority: string
  state: 'active' | 'conflict' | 'corrected'
}

const STEP_COPY: Array<{ label: string; title: string; takeaway: string }> = [
  {
    label: 'Observable sources',
    title: 'Begin with what can be inspected.',
    takeaway: 'The process starts from source records—not from a fluent model conclusion.',
  },
  {
    label: 'Bounded interpretation',
    title: 'Every assertion remains attached to evidence.',
    takeaway: 'The model may propose meaning, but each assertion carries the exact source span that supports it.',
  },
  {
    label: 'Computed obligations',
    title: 'Missing work becomes explicit state.',
    takeaway: 'Unresolved evidence is represented as an obligation rather than hidden inside uncertainty language.',
  },
  {
    label: 'Conflicting authority',
    title: 'A newer source invalidates the apparent answer.',
    takeaway: 'The system must revise the process state when authority changes—even when the earlier interpretation sounded plausible.',
  },
  {
    label: 'Deterministic hold',
    title: 'The gate refuses unsupported action.',
    takeaway: 'Interpretation and authority are separated: the model can suggest, but the kernel can still hold or refuse.',
  },
  {
    label: 'Correction and replay',
    title: 'One correction propagates through the whole process.',
    takeaway: 'The final packet records sources, assertions, obligations, gate decisions, and the dependency path that changed.',
  },
]

const BASE_SOURCES: SourceRecord[] = [
  {
    id: 'policy-2025',
    title: 'Policy handbook · 2025',
    excerpt: 'Claims may be advanced when the required evidence class is present and current.',
    authority: 'policy · version 2025.2',
    state: 'active',
  },
  {
    id: 'customer-form',
    title: 'Customer submission',
    excerpt: 'The incident occurred on 14 March. Supporting invoice attached.',
    authority: 'submitted record · signed',
    state: 'active',
  },
  {
    id: 'invoice',
    title: 'Repair invoice',
    excerpt: 'Repair performed 18 March. Total: CHF 2,480.',
    authority: 'external document · dated',
    state: 'active',
  },
]

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

function SourceDocument({ source, visible }: { source: SourceRecord; visible: boolean }) {
  return (
    <article className={`case-source source-${source.state} ${visible ? 'is-visible' : ''}`}>
      <header>
        <span>{source.id}</span>
        <strong>{source.title}</strong>
      </header>
      <p>{source.excerpt}</p>
      <footer>{source.authority}</footer>
    </article>
  )
}

function AssertionLayer({ step }: { step: number }) {
  return (
    <div className={`case-assertion-layer ${step >= 1 ? 'is-visible' : ''}`} aria-label="Bounded assertions">
      <article className="case-assertion assertion-supported">
        <span>A1</span>
        <div>
          <strong>Incident date is 14 March.</strong>
          <p>customer-form · line 1</p>
        </div>
      </article>
      <article className={step >= 3 ? 'case-assertion assertion-revoked' : 'case-assertion assertion-supported'}>
        <span>A2</span>
        <div>
          <strong>Evidence class permits advancement.</strong>
          <p>{step >= 3 ? 'revoked by policy-2026' : 'policy-2025 · clause 4.2'}</p>
        </div>
      </article>
      <article className="case-assertion assertion-supported">
        <span>A3</span>
        <div>
          <strong>Invoice total is CHF 2,480.</strong>
          <p>invoice · amount field</p>
        </div>
      </article>
    </div>
  )
}

function ObligationLayer({ step, corrected }: { step: number; corrected: boolean }) {
  const resolved = corrected || step >= 5
  return (
    <div className={`case-obligation-layer ${step >= 2 ? 'is-visible' : ''}`} aria-label="Computed obligations">
      <article className="case-obligation is-resolved">
        <span>O1</span>
        <div><strong>Verify incident date</strong><p>discharged by A1</p></div>
      </article>
      <article className={resolved ? 'case-obligation is-resolved' : 'case-obligation is-open'}>
        <span>O2</span>
        <div>
          <strong>Confirm current evidence rule</strong>
          <p>{resolved ? 'discharged by corrected authority' : 'open · current authority conflicts'}</p>
        </div>
      </article>
      <article className="case-obligation is-resolved">
        <span>O3</span>
        <div><strong>Verify claimed amount</strong><p>discharged by A3</p></div>
      </article>
    </div>
  )
}

function Gate({ step, corrected }: { step: number; corrected: boolean }) {
  const visible = step >= 4
  const state = corrected || step >= 5 ? 'accept' : 'hold'
  return (
    <div className={`case-gate gate-${state} ${visible ? 'is-visible' : ''}`} aria-live="polite">
      <span>GATE 03</span>
      <strong>{state === 'accept' ? 'ACCEPT' : 'HOLD'}</strong>
      <p>
        {state === 'accept'
          ? 'All required obligations are discharged by current evidence.'
          : 'Action is withheld because the governing evidence rule is unresolved.'}
      </p>
    </div>
  )
}

function ProvenancePacket({ step, corrected }: { step: number; corrected: boolean }) {
  const visible = step >= 5 || corrected
  return (
    <div className={`case-packet ${visible ? 'is-visible' : ''}`} aria-label="Replayable provenance packet">
      <header><span>terminal packet</span><strong>CP-0418</strong></header>
      <dl>
        <div><dt>sources</dt><dd>{corrected || step >= 5 ? '4 bound' : '3 bound'}</dd></div>
        <div><dt>assertions</dt><dd>3 typed</dd></div>
        <div><dt>obligations</dt><dd>{corrected || step >= 5 ? '3 / 3 resolved' : '2 / 3 resolved'}</dd></div>
        <div><dt>gate</dt><dd>{corrected || step >= 5 ? 'accept' : 'hold'}</dd></div>
        <div><dt>replay</dt><dd>exact dependency trace</dd></div>
      </dl>
      <div className="case-hash">sha256 · 9db3…a741</div>
    </div>
  )
}

export function CasePathProductExperience({ embedded = false }: { embedded?: boolean }) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState<CaseStep>(0)
  const [playing, setPlaying] = useState(!reduced)
  const [corrected, setCorrected] = useState(false)

  useEffect(() => {
    if (!playing || reduced || step >= 5) return undefined
    const timer = window.setTimeout(() => {
      const next = Math.min(5, step + 1) as CaseStep
      setStep(next)
      if (next === 5) setPlaying(false)
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, step])

  const sources = useMemo<SourceRecord[]>(() => {
    if (step < 3) return BASE_SOURCES
    return [
      ...BASE_SOURCES,
      {
        id: 'policy-2026',
        title: corrected || step >= 5 ? 'Policy clarification · 2026' : 'Policy update · 2026',
        excerpt:
          corrected || step >= 5
            ? 'For this evidence class, a dated external invoice discharges the advancement requirement.'
            : 'Previous clause 4.2 is superseded. The current evidence requirement is not yet mapped.',
        authority: corrected || step >= 5 ? 'current authority · clarified' : 'current authority · conflict',
        state: corrected || step >= 5 ? 'corrected' : 'conflict',
      },
    ]
  }, [corrected, step])

  const activeCopy = STEP_COPY[step]

  const selectStep = (next: CaseStep) => {
    setPlaying(false)
    if (next < 3) setCorrected(false)
    setStep(next)
  }

  const restart = () => {
    setCorrected(false)
    setStep(0)
    setPlaying(!reduced)
  }

  const correct = () => {
    setCorrected(true)
    setStep(5)
    setPlaying(false)
  }

  return (
    <section className={embedded ? 'casepath-experience is-embedded' : 'casepath-experience'}>
      <div className="casepath-narrative">
        <span className="casepath-step-count">{String(step + 1).padStart(2, '0')} / 06</span>
        <p className="casepath-step-label">{activeCopy.label}</p>
        <h2>{activeCopy.title}</h2>
        <p>{activeCopy.takeaway}</p>
        {step === 4 && !corrected ? (
          <button className="casepath-correct-action" type="button" onClick={correct}>
            Apply the authoritative correction
          </button>
        ) : null}
        {!embedded ? (
          <p className="casepath-boundary-note">
            The model proposes bounded interpretations. The deterministic kernel owns obligation computation,
            action admission, replay, and refusal.
          </p>
        ) : null}
      </div>

      <div className={`casepath-workspace step-${step} ${corrected ? 'is-corrected' : ''}`}>
        <div className="casepath-source-stack">
          {sources.map((source, index) => (
            <SourceDocument key={source.id} source={source} visible={index < 3 || step >= 3} />
          ))}
        </div>

        <div className="casepath-flow-lines" aria-hidden="true">
          <i className="flow-source-assertion" />
          <i className="flow-assertion-obligation" />
          <i className="flow-obligation-gate" />
          <i className="flow-gate-packet" />
        </div>

        <AssertionLayer step={step} />
        <ObligationLayer step={step} corrected={corrected} />
        <Gate step={step} corrected={corrected} />
        <ProvenancePacket step={step} corrected={corrected} />
      </div>

      <div className="casepath-transport" aria-label="CasePath explanation controls">
        <button type="button" onClick={() => selectStep(Math.max(0, step - 1) as CaseStep)} disabled={step === 0}>
          Previous
        </button>
        <button type="button" onClick={() => setPlaying((value) => !value)} disabled={reduced || step === 5} aria-pressed={playing}>
          {reduced ? 'Step mode' : playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => selectStep(Math.min(5, step + 1) as CaseStep)} disabled={step === 5}>
          Next
        </button>
        <button type="button" onClick={restart}>Restart</button>
      </div>

      <div className="casepath-step-rail" role="tablist" aria-label="CasePath causal sequence">
        {STEP_COPY.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={step === index}
            className={step === index ? 'is-active' : ''}
            key={item.label}
            onClick={() => selectStep(index as CaseStep)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

export function CasePathProductPage() {
  return (
    <div className="portfolio-product-page casepath-product-page">
      <PortfolioHeader />
      <main>
        <header className="casepath-page-intro">
          <div>
            <span>CasePath · evidence-grounded action</span>
            <h1>A model can sound certain long before the evidence permits anyone to act.</h1>
          </div>
          <p>
            CasePath turns that failure into explicit process state: sources, bounded assertions,
            unresolved obligations, deterministic gates, and replayable correction.
          </p>
        </header>

        <CasePathProductExperience />

        <section className="casepath-product-decisions">
          <article>
            <span>01</span>
            <h2>Bound the model.</h2>
            <p>Models interpret source spans and propose typed assertions. They do not silently decide authority.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Make refusal operational.</h2>
            <p>A hold is a first-class outcome with unresolved obligations, not a conversational apology.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Let correction propagate.</h2>
            <p>Every downstream decision remains linked to the evidence and process nodes that produced it.</p>
          </article>
        </section>

        <section className="casepath-evidence-strip">
          <div><span>Execution kernel</span><strong>six roles · three gates</strong></div>
          <div><span>State</span><strong>typed Process–Evidence Graph</strong></div>
          <div><span>Admission</span><strong>proof-carrying action certificate</strong></div>
          <div><span>Recovery</span><strong>append-only replay and scoped correction</strong></div>
          <div><span>Boundary</span><strong>human authority remains explicit</strong></div>
        </section>

        <footer className="casepath-page-conclusion">
          <p>
            The product question is not whether a model can produce a convincing answer. It is whether the
            resulting action can survive evidence change, correction, replay, and independent verification.
          </p>
          <Link to="/trajectory">See how this connects to the wider programme</Link>
        </footer>
      </main>
      <PortfolioFooter />
    </div>
  )
}
