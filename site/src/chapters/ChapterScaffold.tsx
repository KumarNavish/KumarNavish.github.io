import { useEffect, useRef, useState, type ReactNode } from 'react'
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

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useStoryObserver(onStepChange: (step: number) => void, count: number): void {
  const callback = useRef(onStepChange)
  useEffect(() => {
    callback.current = onStepChange
  }, [onStepChange])

  useEffect(() => {
    const nodes = Array.from({ length: count }, (_, index) =>
      document.getElementById(`chapter-step-${index}`),
    ).filter((node): node is HTMLElement => node !== null)
    if (!nodes.length) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        const index = Number(visible?.target.getAttribute('data-step'))
        if (Number.isFinite(index)) callback.current(index)
      },
      { rootMargin: '-34% 0px -42% 0px', threshold: [0.18, 0.42, 0.7] },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [count])
}

export function ChapterScaffold(props: ChapterScaffoldProps) {
  const [mode, setMode] = useState<ChapterMode>('watch')
  const [playing, setPlaying] = useState(false)
  useStoryObserver(props.onStepChange, props.steps.length)

  useEffect(() => {
    if (!playing || mode !== 'watch' || prefersReducedMotion()) return undefined
    const id = window.setInterval(() => {
      props.onStepChange((props.activeStep + 1) % props.steps.length)
    }, 2800)
    return () => window.clearInterval(id)
  }, [mode, playing, props.activeStep, props.onStepChange, props.steps.length])

  const setStep = (index: number, scroll = true) => {
    const normalized = (index + props.steps.length) % props.steps.length
    props.onStepChange(normalized)
    if (scroll) {
      document.getElementById(`chapter-step-${normalized}`)?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      })
    }
  }

  const setInstrumentMode = (nextMode: ChapterMode) => {
    setMode(nextMode)
    if (nextMode !== 'watch') setPlaying(false)
  }

  return (
    <div className="chapter-page">
      <PortfolioHeader />
      <main>
        <section className="chapter-hero" id="top">
          <div>
            <p className="portfolio-kicker">{props.eyebrow}</p>
            <h1>{props.title}</h1>
          </div>
          <div className="chapter-hero-side">
            <p>{props.thesis}</p>
            <span>{props.status}</span>
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
                  ? 'Watch the idea'
                  : item === 'manipulate'
                    ? 'Manipulate it'
                    : 'Inspect evidence'}
              </button>
            ))}
          </div>

          <div className="chapter-stage-shell">
            <div className="chapter-stage-head">
              <div>
                <span>
                  {String(props.activeStep + 1).padStart(2, '0')} /{' '}
                  {String(props.steps.length).padStart(2, '0')}
                </span>
                <strong>{props.steps[props.activeStep]?.label}</strong>
              </div>
              {mode === 'watch' ? (
                <div className="chapter-transport" aria-label="Guided sequence controls">
                  <button
                    type="button"
                    aria-label="Back one step"
                    onClick={() => setStep(props.activeStep - 1)}
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
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    aria-label="Next step"
                    onClick={() => setStep(props.activeStep + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <div className="chapter-stage" data-mode={mode}>
              {props.stage}
              <div className="chapter-stage-insight" aria-live="polite">
                <span>What to notice</span>
                <p>{props.insight}</p>
              </div>
            </div>

            {mode === 'manipulate' ? <div className="chapter-controls">{props.controls}</div> : null}
            {mode === 'inspect' ? <div className="chapter-inspect">{props.inspect}</div> : null}

            <div className="chapter-step-dots" aria-label="Explanatory sequence">
              {props.steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={props.activeStep === index ? 'is-active' : ''}
                  onClick={() => setStep(index)}
                  aria-label={`Go to ${step.label}`}
                  aria-current={props.activeStep === index ? 'step' : undefined}
                />
              ))}
            </div>
          </div>

          <aside className="chapter-story" aria-label="Guided explanation">
            {props.steps.map((step, index) => (
              <article
                key={step.title}
                id={`chapter-step-${index}`}
                data-step={index}
                className={props.activeStep === index ? 'is-active' : ''}
              >
                <span>
                  {String(index + 1).padStart(2, '0')} · {step.label}
                </span>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
                <em>{step.cue}</em>
              </article>
            ))}
          </aside>
        </section>

        <section className="chapter-contribution" id="contribution">
          <div>
            <p className="portfolio-kicker">What I contributed</p>
            <h2>{props.contribution[0]}</h2>
          </div>
          <ol>
            {props.contribution.slice(1).map((item, index) => (
              <li key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="chapter-evidence" id="evidence">
          <header>
            <p className="portfolio-kicker">Evidence, not theatre</p>
            <h2>Follow the explanation into the actual work.</h2>
          </header>
          <div className="chapter-evidence-grid">
            {props.evidence.map((item) => {
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
          <p className="portfolio-kicker">Where the idea stops</p>
          <h2>{props.boundary}</h2>
        </section>

        <section className="chapter-next">
          <p>Continue the intellectual sequence</p>
          <Link to={props.next.route}>
            <span>{props.next.title}</span>
            <strong>{props.next.question}</strong>
            <i>Enter next instrument ↗</i>
          </Link>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
