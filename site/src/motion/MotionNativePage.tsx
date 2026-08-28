import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import './motionNative.css'
import { CasePathChapter } from './CasePathChapter'
import { GraphChapter } from './GraphChapter'
import { RankChapter } from './RankChapter'
import { ReplayChapter } from './ReplayChapter'
import { SpatialChapter } from './SpatialChapter'
import { TemporalChapter } from './TemporalChapter'
import {
  CHAPTERS,
  EVIDENCE,
  type ChapterId,
} from './content'
import {
  EvidenceButton,
  EvidenceDrawer,
  MotionHeader,
  ResearchIndex,
  useActiveChapter,
} from './shared'

const HERO_NODES = [
  { id: 'graph', label: 'Graph operators', x: 12, y: 54 },
  { id: 'replay', label: 'Replay geometry', x: 31, y: 30 },
  { id: 'rank', label: 'Rank feasibility', x: 51, y: 55 },
  { id: 'temporal', label: 'Temporal value', x: 70, y: 29 },
  { id: 'casepath', label: 'Bounded agents', x: 83, y: 61 },
  { id: 'spatial', label: 'Spatial intelligence', x: 62, y: 82 },
]

const HERO_EDGES = [
  ['graph', 'replay'],
  ['replay', 'rank'],
  ['rank', 'temporal'],
  ['temporal', 'casepath'],
  ['casepath', 'spatial'],
  ['replay', 'casepath'],
  ['graph', 'rank'],
] as const

const ATLAS_QUESTIONS = [
  {
    id: 'stable',
    label: 'What must remain stable while the system changes?',
    x: 17,
    y: 28,
    chapters: ['graph', 'replay', 'rank', 'temporal'] as ChapterId[],
  },
  {
    id: 'feasible',
    label: 'Does the available structure contain an acceptable action?',
    x: 50,
    y: 18,
    chapters: ['graph', 'replay', 'rank'] as ChapterId[],
  },
  {
    id: 'evidence',
    label: 'What evidence is sufficient to permit a decision?',
    x: 75,
    y: 46,
    chapters: ['replay', 'temporal', 'casepath'] as ChapterId[],
  },
  {
    id: 'interface',
    label: 'How should intelligence become inspectable and usable?',
    x: 42,
    y: 76,
    chapters: ['casepath', 'spatial'] as ChapterId[],
  },
]

function initialReducedMotion(): boolean {
  const stored = window.localStorage.getItem('motion-native-reduced-motion')
  if (stored === 'true') {
    return true
  }
  if (stored === 'false') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function HeroConstellation() {
  const nodeMap = Object.fromEntries(HERO_NODES.map((node) => [node.id, node]))
  return (
    <figure className="mn-hero-constellation">
      <svg viewBox="0 0 100 100" role="img" aria-label="Research trajectory from graph structure to spatial intelligence">
        <g className="mn-hero-relations">
          {HERO_EDGES.map(([sourceId, targetId], index) => {
            const source = nodeMap[sourceId]
            const target = nodeMap[targetId]
            if (!source || !target) {
              return null
            }
            return (
              <line
                key={`${sourceId}-${targetId}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                style={{ '--relation-order': index } as CSSProperties}
              />
            )
          })}
        </g>
        <g className="mn-hero-nodes">
          {HERO_NODES.map((node, index) => (
            <a key={node.id} href={`#${node.id}`} aria-label={`Open ${node.label} chapter`}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.id === 'spatial' ? 4.2 : 3.2}
                style={{ '--node-order': index } as CSSProperties}
              />
              <text x={node.x} y={node.y + 7} textAnchor="middle">{node.label}</text>
            </a>
          ))}
        </g>
      </svg>
      <figcaption>
        One trajectory: define the desired behavior, expose the available structure, and keep evidence attached to action.
      </figcaption>
    </figure>
  )
}

function EntrySection({ onOpenIndex }: { onOpenIndex: () => void }) {
  return (
    <section id="entry" className="mn-entry" aria-labelledby="mn-entry-title">
      <div className="mn-entry-grid">
        <div className="mn-entry-copy">
          <p className="mn-eyebrow">Machine learning research · systems engineering · spatial interaction</p>
          <h1 id="mn-entry-title">
            Difficult ideas,<br />made operable.
          </h1>
          <p className="mn-entry-thesis">
            I study how intelligent systems should remember, adapt, and expose their reasoning—then build interactive instruments that let those mechanisms be inspected directly.
          </p>
          <div className="mn-entry-actions">
            <button type="button" className="mn-primary-action" onClick={() => scrollToId('graph')}>
              Enter the instruments
              <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4l5 5-5 5" /></svg>
            </button>
            <button type="button" className="mn-secondary-action" onClick={onOpenIndex}>
              Search the body of work
            </button>
          </div>
          <dl className="mn-entry-facts">
            <div>
              <dt>Research question</dt>
              <dd>How can a system change without making its structure, evidence, or past invisible?</dd>
            </div>
            <div>
              <dt>Current direction</dt>
              <dd>Continual adaptation, bounded agents, and persistent spatial interfaces.</dd>
            </div>
          </dl>
        </div>
        <HeroConstellation />
      </div>
      <div className="mn-entry-ledger" aria-label="Portfolio reading guide">
        <article><span>30 seconds</span><strong>Six mechanisms</strong><p>See the trajectory and choose the instrument relevant to you.</p></article>
        <article><span>3 minutes</span><strong>Live concepts</strong><p>Change real variables and observe the mechanism, consequence, and boundary.</p></article>
        <article><span>20 minutes</span><strong>Inspectable evidence</strong><p>Follow claims into papers, reviews, systems, equations, and limitations.</p></article>
      </div>
    </section>
  )
}

function InstrumentDirectory({ onOpenEvidence }: { onOpenEvidence: (id: string) => void }) {
  const evidenceForChapter = (chapterId: ChapterId) => EVIDENCE.find((record) => record.chapter === chapterId)
  return (
    <section className="mn-directory" aria-labelledby="mn-directory-title">
      <header>
        <p className="mn-eyebrow">Live concept · concise interpretation · inspectable evidence</p>
        <h2 id="mn-directory-title">The work is organized by the mechanism it makes visible.</h2>
        <p>
          No thumbnails or generic project cards. Each chapter begins with a question and remains interactive through its evidence and failure boundary.
        </p>
      </header>
      <div className="mn-directory-grid">
        {CHAPTERS.map((chapter) => {
          const evidence = evidenceForChapter(chapter.id)
          return (
            <article key={chapter.id} style={{ '--chapter-accent': chapter.accent } as CSSProperties}>
              <a href={`#${chapter.id}`}>
                <span>{chapter.index}</span>
                <div>
                  <p>{chapter.status}</p>
                  <h3>{chapter.shortTitle}</h3>
                  <strong>{chapter.question}</strong>
                </div>
                <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4l5 5-5 5" /></svg>
              </a>
              {evidence ? (
                <button type="button" onClick={() => onOpenEvidence(evidence.id)}>
                  Inspect evidence contract
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function AtlasSection({ onOpenEvidence }: { onOpenEvidence: (id: string) => void }) {
  const [lens, setLens] = useState<'questions' | 'mechanisms' | 'frontier'>('questions')
  const [focusedQuestion, setFocusedQuestion] = useState(ATLAS_QUESTIONS[0]?.id ?? '')
  const focused = ATLAS_QUESTIONS.find((question) => question.id === focusedQuestion)
  const chapterPositions = useMemo(
    () =>
      Object.fromEntries(
        CHAPTERS.map((chapter, index) => [
          chapter.id,
          {
            x: 12 + (index % 3) * 35,
            y: 42 + Math.floor(index / 3) * 36,
          },
        ]),
      ),
    [],
  )

  return (
    <section id="atlas" className="mn-atlas" aria-labelledby="mn-atlas-title">
      <header>
        <div>
          <p className="mn-eyebrow">Research atlas</p>
          <h2 id="mn-atlas-title">The chronology resolves into recurring questions.</h2>
        </div>
        <div className="mn-atlas-lenses" role="group" aria-label="Atlas lens">
          {(['questions', 'mechanisms', 'frontier'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={lens === value ? 'is-active' : ''}
              aria-pressed={lens === value}
              onClick={() => setLens(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </header>
      <div className="mn-atlas-grid">
        <figure className="mn-atlas-map">
          <svg viewBox="0 0 100 100" role="img" aria-label="Question-driven map connecting the research chapters">
            <g className="mn-atlas-links">
              {ATLAS_QUESTIONS.flatMap((question) =>
                question.chapters.map((chapterId) => {
                  const target = chapterPositions[chapterId]
                  if (!target) {
                    return null
                  }
                  const visible = lens !== 'questions' || question.id === focusedQuestion
                  return (
                    <line
                      key={`${question.id}-${chapterId}`}
                      x1={question.x}
                      y1={question.y}
                      x2={target.x}
                      y2={target.y}
                      className={visible ? 'is-visible' : ''}
                    />
                  )
                }),
              )}
            </g>
            <g className="mn-atlas-question-nodes">
              {ATLAS_QUESTIONS.map((question) => (
                <g
                  key={question.id}
                  className={question.id === focusedQuestion ? 'is-focused' : ''}
                  transform={`translate(${question.x} ${question.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Trace question: ${question.label}`}
                  onClick={() => setFocusedQuestion(question.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setFocusedQuestion(question.id)
                    }
                  }}
                >
                  <circle r="4.2" />
                  <circle r="6.2" className="mn-atlas-question-orbit" />
                </g>
              ))}
            </g>
            <g className="mn-atlas-chapter-nodes">
              {CHAPTERS.map((chapter) => {
                const position = chapterPositions[chapter.id]
                if (!position) {
                  return null
                }
                const connected = focused?.chapters.includes(chapter.id) ?? false
                return (
                  <a
                    key={chapter.id}
                    href={`#${chapter.id}`}
                    className={connected || lens !== 'questions' ? 'is-connected' : ''}
                  >
                    <rect x={position.x - 5} y={position.y - 3.2} width="10" height="6.4" rx="0.8" />
                    <text x={position.x} y={position.y + 8} textAnchor="middle">{chapter.shortTitle}</text>
                  </a>
                )
              })}
            </g>
          </svg>
          <figcaption>Select a question to trace its path across papers, mechanisms, systems, and future work.</figcaption>
        </figure>
        <aside className="mn-atlas-inspector">
          <p className="mn-eyebrow">Trace a question</p>
          <h3>{focused?.label}</h3>
          <ol>
            {focused?.chapters.map((chapterId, index) => {
              const chapter = CHAPTERS.find((candidate) => candidate.id === chapterId)
              if (!chapter) {
                return null
              }
              return (
                <li key={chapter.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <a href={`#${chapter.id}`}>
                    <strong>{chapter.shortTitle}</strong>
                    <p>{chapter.question}</p>
                  </a>
                </li>
              )
            })}
          </ol>
          <div className="mn-atlas-evidence">
            {EVIDENCE.filter((record) => focused?.chapters.includes(record.chapter)).slice(0, 3).map((record) => (
              <EvidenceButton key={record.id} evidenceId={record.id} onOpen={onOpenEvidence} compact />
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

function ContactSection() {
  return (
    <section id="contact" className="mn-contact" aria-labelledby="mn-contact-title">
      <div>
        <p className="mn-eyebrow">Contact resolution</p>
        <h2 id="mn-contact-title">The next useful conversation should begin with a real question.</h2>
        <p>
          I am completing a PhD in machine learning at the University of Basel and work across continual learning, optimization, agentic systems, and spatial interfaces.
        </p>
      </div>
      <nav aria-label="Contact and research profiles">
        <a href="mailto:navish.kumar@unibas.ch"><span>Email</span><strong>navish.kumar@unibas.ch</strong></a>
        <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer"><span>Code</span><strong>GitHub ↗</strong></a>
        <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer"><span>Research</span><strong>Google Scholar ↗</strong></a>
        <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer"><span>Discussion</span><strong>OpenReview ↗</strong></a>
        <a href="/artifacts/resume.pdf" target="_blank" rel="noreferrer"><span>Profile</span><strong>Résumé PDF ↗</strong></a>
      </nav>
    </section>
  )
}

export default function MotionNativePage() {
  const [activeChapter, setActiveChapter] = useState<ChapterId>('entry')
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion)
  const [evidenceId, setEvidenceId] = useState<string | null>(null)
  const [indexOpen, setIndexOpen] = useState(false)

  const handleChapterChange = useCallback((id: ChapterId) => setActiveChapter(id), [])
  useActiveChapter(handleChapterChange)

  const toggleMotion = useCallback(() => {
    setReducedMotion((value) => {
      const next = !value
      window.localStorage.setItem('motion-native-reduced-motion', String(next))
      return next
    })
  }, [])

  const closeEvidence = useCallback(() => setEvidenceId(null), [])
  const closeIndex = useCallback(() => setIndexOpen(false), [])

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
    return () => {
      delete document.documentElement.dataset.motion
    }
  }, [reducedMotion])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (isTyping) {
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        setIndexOpen(true)
      }
      if (event.key === 'Escape') {
        setEvidenceId(null)
        setIndexOpen(false)
      }
      if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'k') {
        const order: ChapterId[] = ['entry', ...CHAPTERS.map((chapter) => chapter.id), 'atlas', 'contact']
        const currentIndex = Math.max(0, order.indexOf(activeChapter))
        const direction = event.key.toLowerCase() === 'j' ? 1 : -1
        const next = order[Math.min(order.length - 1, Math.max(0, currentIndex + direction))]
        if (next) {
          event.preventDefault()
          scrollToId(next)
        }
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [activeChapter])

  return (
    <div className="motion-native-site" data-active-chapter={activeChapter}>
      <a className="mn-skip-link" href="#entry">Skip to the research experience</a>
      <MotionHeader
        activeChapter={activeChapter}
        reducedMotion={reducedMotion}
        onToggleMotion={toggleMotion}
        onOpenIndex={() => setIndexOpen(true)}
      />
      <main>
        <EntrySection onOpenIndex={() => setIndexOpen(true)} />
        <InstrumentDirectory onOpenEvidence={setEvidenceId} />
        <GraphChapter reducedMotion={reducedMotion} onOpenEvidence={setEvidenceId} />
        <ReplayChapter reducedMotion={reducedMotion} onOpenEvidence={setEvidenceId} />
        <RankChapter reducedMotion={reducedMotion} onOpenEvidence={setEvidenceId} />
        <TemporalChapter reducedMotion={reducedMotion} onOpenEvidence={setEvidenceId} />
        <CasePathChapter reducedMotion={reducedMotion} onOpenEvidence={setEvidenceId} />
        <SpatialChapter reducedMotion={reducedMotion} onOpenEvidence={setEvidenceId} />
        <AtlasSection onOpenEvidence={setEvidenceId} />
        <ContactSection />
      </main>
      <footer className="mn-footer">
        <span>Navish Kumar · Basel</span>
        <span>Motion explains mechanism. Evidence bounds claims.</span>
        <a href="#entry">Return to beginning ↑</a>
      </footer>
      <p className="mn-keyboard-hint" aria-hidden="true">/ index · J/K chapters · Esc close</p>
      <EvidenceDrawer evidenceId={evidenceId} onClose={closeEvidence} />
      <ResearchIndex open={indexOpen} onClose={closeIndex} />
    </div>
  )
}
