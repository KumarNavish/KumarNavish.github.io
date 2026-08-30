import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioHeader'
import './chapters.css'

export type ChapterMode = 'watch' | 'manipulate' | 'inspect'

export interface ChapterStep {
  label: string
  title: string
  body: string
  takeaway: string
}

export interface ChapterEvidence {
  label: string
  title: string
  detail: string
  href?: string
}

export interface ChapterLink {
  label: string
  href: string
}

interface ChapterScaffoldProps {
  eyebrow: string
  status: string
  title: string
  question: string
  thesis: string
  steps: ChapterStep[]
  activeStep: number
  onStepChange: (step: number) => void
  stage: ReactNode
  controls: ReactNode
  inspect: ReactNode
  evidence: ChapterEvidence[]
  contribution: string[]
  boundary: string
  links?: ChapterLink[]
  next?: { label: string; title: string; route: string }
}

function useStepObserver(onStepChange: (step: number) => void, stepCount: number) {
  const callbackRef = useRef(onStepChange)
  useEffect(() => {
    callbackRef.current = onStepChange
  }, [onStepChange])

  useEffect(() => {
    const elements = Array.from({ length: stepCount }, (_, index) =>
      document.getElementById(`chapter-step-${index}`),
    ).filter((element): element is HTMLElement => element !== null)

    if (!('IntersectionObserver' in window)) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        const stepValue = active?.target.getAttribute('data-step')
        if (stepValue) callbackRef.current(Number(stepValue))
      },
      { rootMargin: '-34% 0px -46% 0px', threshold: [0.1, 0.35, 0.65] },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [stepCount])
}

export function ChapterScaffold({
  eyebrow,
  status,
  title,
  question,
  thesis,
  steps,
  activeStep,
  onStepChange,
  stage,
  controls,
  inspect,
  evidence,
  contribution,
  boundary,
  links = [],
  next,
}: ChapterScaffoldProps) {
  const [mode, setMode] = useState<ChapterMode>('watch')
  const [playing, setPlaying] = useState(false)

  useStepObserver(onStepChange, steps.length)

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setInterval(() => {
      onStepChange((activeStep + 1) % steps.length)
    }, 3200)
    return () => window.clearInterval(timer)
  }, [activeStep, onStepChange, playing, steps.length])


  return (
    <div className="chapter-page" id="top">
      <PortfolioHeader compact />
      <main>
        <section className="chapter-hero">
          <div className="chapter-hero-meta">
            <Link to="/">← Research atlas</Link>
            <span>{status}</span>
          </div>
          <p className="chapter-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="chapter-question">{question}</p>
          <p className="chapter-thesis">{thesis}</p>
          {links.length > 0 ? (
            <div className="chapter-link-row">
              {links.map((link) => (
                <a key={link.href} className="portfolio-button" href={link.href} target="_blank" rel="noreferrer">
                  {link.label} ↗
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section className="chapter-instrument" aria-label={`${title} interactive explanation`}>
          <div className="chapter-narrative">
            <header className="chapter-mode-shell">
              <div className="chapter-mode-toggle" role="tablist" aria-label="Explanation mode">
                {(['watch', 'manipulate', 'inspect'] as ChapterMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={mode === item}
                    className={mode === item ? 'is-active' : ''}
                    onClick={() => {
                      setMode(item)
                      if (item !== 'watch') setPlaying(false)
                    }}
                  >
                    {item[0]?.toUpperCase()}{item.slice(1)}
                  </button>
                ))}
              </div>
              {mode === 'watch' ? (
                <button
                  type="button"
                  className={playing ? 'chapter-play-button is-playing' : 'chapter-play-button'}
                  onClick={() => setPlaying((value) => !value)}
                >
                  <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
                  {playing ? 'Pause sequence' : 'Play explanation'}
                </button>
              ) : null}
            </header>

            {mode === 'watch' ? (
              <ol className="chapter-step-list">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    id={`chapter-step-${index}`}
                    data-step={index}
                    className={activeStep === index ? 'is-active' : ''}
                  >
                    <button type="button" onClick={() => onStepChange(index)}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <p>{step.label}</p>
                        <h2>{step.title}</h2>
                        <div className="chapter-step-detail">
                          <p>{step.body}</p>
                          <strong>{step.takeaway}</strong>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            ) : mode === 'manipulate' ? (
              <div className="chapter-control-panel">
                <p className="chapter-panel-kicker">Change the mechanism</p>
                <h2>Manipulate the variables that matter.</h2>
                <p>Every control below changes the live scientific object—not a decorative animation.</p>
                {controls}
              </div>
            ) : (
              <div className="chapter-inspect-panel">
                <p className="chapter-panel-kicker">Exact layer</p>
                <h2>Inspect the formal object and evidence.</h2>
                {inspect}
              </div>
            )}
          </div>

          <div className={`chapter-stage-shell mode-${mode}`}>
            <div className="chapter-stage-topline">
              <div>
                <span>Live state</span>
                <strong>{steps[activeStep]?.label}</strong>
              </div>
              <div className="chapter-stage-progress" aria-label={`Step ${activeStep + 1} of ${steps.length}`}>
                {steps.map((step, index) => (
                  <button
                    key={step.label}
                    type="button"
                    className={activeStep === index ? 'is-active' : ''}
                    onClick={() => onStepChange(index)}
                    aria-label={`Open step ${index + 1}: ${step.label}`}
                  />
                ))}
              </div>
            </div>
            <div className="chapter-stage">{stage}</div>
            <div className="chapter-stage-caption">
              <span>What changed</span>
              <p>{steps[activeStep]?.takeaway}</p>
            </div>
          </div>
        </section>

        <section className="chapter-contribution" aria-labelledby="contribution-title">
          <div>
            <p className="chapter-panel-kicker">What I contributed</p>
            <h2 id="contribution-title">The intellectual move.</h2>
          </div>
          <ol>
            {contribution.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="chapter-evidence" aria-labelledby="evidence-title">
          <header>
            <p className="chapter-panel-kicker">Evidence layer</p>
            <h2 id="evidence-title">Claims you can inspect.</h2>
          </header>
          <div className="chapter-evidence-grid">
            {evidence.map((item) => (
              <article key={item.title}>
                <span>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noreferrer">
                    Open evidence ↗
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="chapter-boundary">
          <p className="chapter-panel-kicker">Boundary</p>
          <h2>What this work does not claim.</h2>
          <p>{boundary}</p>
        </section>

        {next ? (
          <Link className="chapter-next" to={next.route}>
            <span>{next.label}</span>
            <strong>{next.title}</strong>
            <i aria-hidden="true">→</i>
          </Link>
        ) : null}
      </main>
      <PortfolioFooter />
    </div>
  )
}
