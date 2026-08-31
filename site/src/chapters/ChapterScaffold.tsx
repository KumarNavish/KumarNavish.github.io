import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import './chapters.css'

export type ChapterMode = 'watch' | 'manipulate' | 'inspect'

export type ChapterStep = {
  label: string
  title: string
  body: string
  cue: string
}

export type ChapterEvidence = {
  label: string
  title: string
  note: string
  href?: string
}

export type ChapterLink = {
  title: string
  question: string
  route: string
}

type ChapterScaffoldProps = {
  eyebrow: string
  title: string
  thesis: string
  status: string
  steps: ChapterStep[]
  activeStep: number
  onStepChange: (step: number) => void
  stage: ReactNode
  controls: ReactNode
  inspect: ReactNode
  insight: string
  contribution: string[]
  boundary: string
  evidence: ChapterEvidence[]
  next: ChapterLink
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

export function ChapterScaffold({
  eyebrow,
  title,
  thesis,
  status,
  steps,
  activeStep,
  onStepChange,
  stage,
  controls,
  inspect,
  insight,
  contribution,
  boundary,
  evidence,
  next,
}: ChapterScaffoldProps) {
  const [mode, setMode] = useState<ChapterMode>('watch')
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useReducedMotion()

  const setStep = useCallback(
    (index: number) => {
      const normalized = (index + steps.length) % steps.length
      onStepChange(normalized)
    },
    [onStepChange, steps.length],
  )

  useEffect(() => {
    if (!playing || mode !== 'watch' || reducedMotion) return undefined
    const timer = window.setTimeout(() => setStep(activeStep + 1), 3900)
    return () => window.clearTimeout(timer)
  }, [activeStep, mode, playing, reducedMotion, setStep])

  const setInstrumentMode = (nextMode: ChapterMode) => {
    setMode(nextMode)
    if (nextMode !== 'watch') setPlaying(false)
  }

  const current = steps[activeStep]

  return (
    <div className="chapter-page">
      <PortfolioHeader />
      <main>
        <section className="chapter-hero" id="top">
          <div className="chapter-hero-heading">
            <p className="chapter-context">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="chapter-hero-side">
            <p>{thesis}</p>
            <span>{status}</span>
          </div>
        </section>

        <section className="chapter-instrument" id="instrument">
          <div className="chapter-modebar" aria-label="Instrument mode">
            {(['watch', 'manipulate', 'inspect'] as ChapterMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setInstrumentMode(item)}
                className={mode === item ? 'is-active' : ''}
                aria-pressed={mode === item}
              >
                {item === 'watch'
                  ? 'Guided explanation'
                  : item === 'manipulate'
                    ? 'Explore mechanism'
                    : 'Inspect evidence'}
              </button>
            ))}
          </div>

          <div className="chapter-stage-shell">
            <div className="chapter-stage-head">
              <div>
                <span>
                  {String(activeStep + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
                </span>
                <strong>{current?.label}</strong>
              </div>
              {mode === 'watch' ? (
                <div className="chapter-transport" aria-label="Guided sequence controls">
                  <button
                    type="button"
                    aria-label="Back one step"
                    onClick={() => {
                      setPlaying(false)
                      setStep(activeStep - 1)
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    aria-label="Restart guided sequence"
                    onClick={() => {
                      setPlaying(false)
                      setStep(0)
                    }}
                  >
                    Restart
                  </button>
                  <button
                    type="button"
                    className="chapter-play"
                    onClick={() => setPlaying((value) => !value)}
                    aria-pressed={playing}
                    aria-label={playing ? 'Pause guided sequence' : 'Play guided sequence'}
                    disabled={reducedMotion}
                  >
                    {reducedMotion ? 'Step mode' : playing ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    aria-label="Next step"
                    onClick={() => {
                      setPlaying(false)
                      setStep(activeStep + 1)
                    }}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <div className="chapter-stage-layout">
              <div className="chapter-stage" data-mode={mode}>
                {stage}
                <div className="chapter-stage-insight" aria-live="polite">
                  <span>What to notice</span>
                  <p>{insight}</p>
                </div>
              </div>

              <article className="chapter-current-story" aria-live="polite">
                <span>
                  {String(activeStep + 1).padStart(2, '0')} · {current?.label}
                </span>
                <h2>{current?.title}</h2>
                <p>{current?.body}</p>
                <em>{current?.cue}</em>
              </article>
            </div>

            {mode === 'manipulate' ? <div className="chapter-controls">{controls}</div> : null}
            {mode === 'inspect' ? <div className="chapter-inspect">{inspect}</div> : null}

            <div className="chapter-step-dots" aria-label="Explanatory sequence">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={activeStep === index ? 'is-active' : ''}
                  onClick={() => {
                    setPlaying(false)
                    setStep(index)
                  }}
                  aria-label={`Go to ${step.label}`}
                  aria-current={activeStep === index ? 'step' : undefined}
                />
              ))}
            </div>
          </div>

          <nav className="chapter-story" aria-label="Explanation steps">
            {steps.map((step, index) => (
              <button
                key={step.title}
                id={`chapter-step-${index}`}
                type="button"
                data-step={index}
                className={activeStep === index ? 'is-active' : ''}
                onClick={() => {
                  setPlaying(false)
                  setStep(index)
                }}
                aria-current={activeStep === index ? 'step' : undefined}
              >
                <span>
                  {String(index + 1).padStart(2, '0')} · {step.label}
                </span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </nav>
        </section>

        <section className="chapter-contribution" id="contribution">
          <div>
            <p className="chapter-section-label">Contribution</p>
            <h2>{contribution[0]}</h2>
          </div>
          <ol>
            {contribution.slice(1).map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="chapter-evidence" id="evidence">
          <header>
            <p className="chapter-section-label">Evidence</p>
            <h2>Open the paper, result, and claim boundary.</h2>
          </header>
          <div className="chapter-evidence-grid">
            {evidence.map((item) => {
              const content = (
                <>
                  <span>{item.label}</span>
                  <h3>{item.title}</h3>
                  <p>{item.note}</p>
                  {item.href ? <b>Open source ↗</b> : null}
                </>
              )
              return item.href ? (
                <a key={item.title} href={item.href} target="_blank" rel="noreferrer">
                  {content}
                </a>
              ) : (
                <article key={item.title}>{content}</article>
              )
            })}
          </div>
        </section>

        <section className="chapter-boundary">
          <p className="chapter-section-label">Boundary</p>
          <h2>{boundary}</h2>
        </section>

        <section className="chapter-next">
          <p>Continue the research programme</p>
          <Link to={next.route}>
            <span>{next.title}</span>
            <strong>{next.question}</strong>
            <i>Open next work ↗</i>
          </Link>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
