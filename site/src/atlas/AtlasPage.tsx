import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import './atlas.css'

type PreviewProps = { active: boolean }

type AtlasEntry = {
  index: string
  title: string
  period: string
  question: string
  contribution: string
  route: string
  evidence: string
  Preview: ComponentType<PreviewProps>
}

function GainPreview({ active }: PreviewProps) {
  const [phase, setPhase] = useState(0.2)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(
      () => setPhase((value) => (value >= 2.6 ? -2.6 : value + 0.14)),
      120,
    )
    return () => window.clearInterval(id)
  }, [active])
  const nodes = [
    [34, 62],
    [86, 24],
    [154, 32],
    [196, 86],
    [142, 132],
    [64, 126],
  ]
  return (
    <div className="mini-stage mini-gain">
      <svg viewBox="0 0 230 160" aria-label="Gain graph whose phase changes its spectrum">
        {[
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [4, 5],
          [5, 0],
          [1, 4],
          [2, 5],
        ].map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            className={i === 2 ? 'is-live' : ''}
            style={i === 2 ? ({ '--phase': phase } as CSSProperties) : undefined}
          />
        ))}
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="7" />
        ))}
        <path
          className="mini-spectrum"
          d={`M 20 150 L 52 ${145 - Math.abs(Math.sin(phase)) * 38} L 86 118 L 122 99 L 160 72 L 210 38`}
        />
      </svg>
      <div className="mini-readout">
        <span>edge phase</span>
        <strong>{phase.toFixed(2)} rad</strong>
      </div>
    </div>
  )
}

function NaturalPreview({ active }: PreviewProps) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setStep((value) => (value + 1) % 5), 700)
    return () => window.clearInterval(id)
  }, [active])
  const path = [
    [28, 130],
    [66, 110],
    [104, 84],
    [142, 61],
    [186, 35],
  ]
  return (
    <div className="mini-stage mini-natural">
      <svg viewBox="0 0 230 160" aria-label="Natural gradient follows covariance geometry">
        {[0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            cx={70 + i * 38}
            cy={118 - i * 27}
            rx={48 - i * 5}
            ry={17 - i * 2}
            transform={`rotate(${-24 + i * 5} ${70 + i * 38} ${118 - i * 27})`}
          />
        ))}
        <polyline points={path.map(([x, y]) => `${x},${y}`).join(' ')} />
        {path.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === step ? 6 : 3}
            className={i === step ? 'is-live' : ''}
          />
        ))}
      </svg>
      <div className="mini-readout">
        <span>geometry</span>
        <strong>square-root covariance</strong>
      </div>
    </div>
  )
}

function ReplayPreview({ active }: PreviewProps) {
  const [selection, setSelection] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setSelection((value) => (value + 1) % 4), 760)
    return () => window.clearInterval(id)
  }, [active])
  const candidates = [
    [62, 34],
    [102, 46],
    [88, 104],
    [145, 114],
  ]
  return (
    <div className="mini-stage mini-replay">
      <svg viewBox="0 0 230 160" aria-label="Replay candidates approximate a target correction">
        <defs>
          <marker id="atlas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>
        <line x1="26" y1="132" x2="188" y2="45" className="target" markerEnd="url(#atlas-arrow)" />
        {candidates.map(([x, y], i) => (
          <g key={i} className={i === selection ? 'is-selected' : ''}>
            <line x1="26" y1="132" x2={x} y2={y} markerEnd="url(#atlas-arrow)" />
            <circle cx={x} cy={y} r="5" />
          </g>
        ))}
        <line
          x1={candidates[selection][0]}
          y1={candidates[selection][1]}
          x2="188"
          y2="45"
          className="residual"
        />
      </svg>
      <div className="mini-readout">
        <span>residual</span>
        <strong>{[0.62, 0.31, 0.47, 0.18][selection].toFixed(2)}</strong>
      </div>
    </div>
  )
}

function RankPreview({ active }: PreviewProps) {
  const [rank, setRank] = useState(2)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setRank((value) => (value >= 8 ? 1 : value + 1)), 520)
    return () => window.clearInterval(id)
  }, [active])
  const width = 18 + rank * 13
  return (
    <div className="mini-stage mini-rank">
      <svg viewBox="0 0 230 160" aria-label="Feasible update space expands with adapter rank">
        <path
          d={`M 28 138 L ${28 + width} 28 L ${28 + width + 38} 28 L 28 138 Z`}
          className="feasible"
        />
        <line x1="28" y1="138" x2="184" y2="42" className="desired" />
        <circle cx="184" cy="42" r="7" className={rank >= 6 ? 'is-feasible' : ''} />
        <line
          x1="28"
          y1="138"
          x2={Math.min(184, 42 + width)}
          y2={Math.max(42, 126 - width)}
          className="correction"
        />
      </svg>
      <div className="mini-readout">
        <span>LoRA rank</span>
        <strong>
          {rank} · {rank >= 6 ? 'feasible' : 'blocked'}
        </strong>
      </div>
    </div>
  )
}

function TimePreview({ active }: PreviewProps) {
  const [now, setNow] = useState(3)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setNow((value) => (value >= 6 ? 2 : value + 1)), 620)
    return () => window.clearInterval(id)
  }, [active])
  return (
    <div className="mini-stage mini-time">
      <svg viewBox="0 0 230 160" aria-label="Replay value changes across chronological windows">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <g key={i}>
            <rect
              x={16 + i * 29}
              y="88"
              width="21"
              height="38"
              className={i === now ? 'is-now' : i < now ? 'is-past' : 'is-future'}
            />
            <text x={26 + i * 29} y="145">
              t{i + 1}
            </text>
          </g>
        ))}
        {[0, 1, 2].map((i) => {
          const from = 26 + Math.max(0, now - 1 - i) * 29
          const value = Math.sin((now + i) * 0.9)
          return (
            <path
              key={i}
              d={`M ${from} 84 Q ${125 + i * 12} ${22 + i * 10} ${26 + now * 29} 84`}
              className={value > 0 ? 'positive' : 'negative'}
            />
          )
        })}
      </svg>
      <div className="mini-readout">
        <span>best action</span>
        <strong>{now >= 5 ? 'current only' : 'selective replay'}</strong>
      </div>
    </div>
  )
}

function UrbanPreview({ active }: PreviewProps) {
  const [lane, setLane] = useState(0.55)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(
      () => setLane((value) => (value > 0.88 ? 0.22 : value + 0.06)),
      520,
    )
    return () => window.clearInterval(id)
  }, [active])
  const hexes = Array.from({ length: 14 }, (_, i) => ({
    x: 26 + (i % 5) * 38 + (Math.floor(i / 5) % 2) * 19,
    y: 34 + Math.floor(i / 5) * 34,
    score: ((i * 17) % 100) / 100,
  }))
  return (
    <div className="mini-stage mini-urban">
      <svg viewBox="0 0 230 160" aria-label="Urban cells change cargo-bike suitability">
        {hexes.map((hex, i) => (
          <polygon
            key={i}
            points="0,-16 14,-8 14,8 0,16 -14,8 -14,-8"
            transform={`translate(${hex.x} ${hex.y})`}
            style={{ opacity: 0.18 + Math.min(1, hex.score + lane * 0.45) * 0.75 }}
          />
        ))}
        <path
          d="M 18 132 C 70 98, 104 121, 208 46"
          className="bike-route"
          style={{ strokeWidth: 1.5 + lane * 4 }}
        />
      </svg>
      <div className="mini-readout">
        <span>bike-lane coverage</span>
        <strong>{Math.round(lane * 100)}%</strong>
      </div>
    </div>
  )
}

function SocialPreview({ active }: PreviewProps) {
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setPulse((value) => (value + 1) % 6), 520)
    return () => window.clearInterval(id)
  }, [active])
  const nodes = [
    [32, 70],
    [74, 34],
    [90, 112],
    [132, 65],
    [170, 34],
    [196, 96],
  ]
  return (
    <div className="mini-stage mini-social">
      <svg
        viewBox="0 0 230 160"
        aria-label="Counterspeech alters interaction paths in a social network"
      >
        {[
          [0, 1],
          [0, 2],
          [1, 3],
          [2, 3],
          [3, 4],
          [3, 5],
          [4, 5],
        ].map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            className={i === pulse ? 'is-live' : ''}
          />
        ))}
        {nodes.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === 0 || i === 4 ? 9 : 7}
            className={i < 3 ? 'hate' : 'counter'}
          />
        ))}
      </svg>
      <div className="mini-readout">
        <span>question</span>
        <strong>where can response redirect harm?</strong>
      </div>
    </div>
  )
}

function CasePreview({ active }: PreviewProps) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setStep((value) => (value + 1) % 4), 700)
    return () => window.clearInterval(id)
  }, [active])
  const labels = ['evidence', 'extract', 'gate', 'artifact']
  return (
    <div className="mini-stage mini-case">
      <svg viewBox="0 0 230 160" aria-label="CasePath converts evidence into reviewable artifacts">
        {labels.map((label, i) => (
          <g key={label} className={i <= step ? 'is-complete' : ''}>
            <rect x={12 + i * 55} y={57 - (i % 2) * 10} width="42" height="48" rx="7" />
            <text x={33 + i * 55} y={121}>
              {label}
            </text>
            {i < 3 ? (
              <path
                d={`M ${54 + i * 55} ${81 - (i % 2) * 10} L ${67 + i * 55} ${81 - ((i + 1) % 2) * 10}`}
              />
            ) : null}
          </g>
        ))}
      </svg>
      <div className="mini-readout">
        <span>current gate</span>
        <strong>{labels[step]}</strong>
      </div>
    </div>
  )
}

function SpatialPreview({ active }: PreviewProps) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setPhase((value) => (value + 1) % 5), 620)
    return () => window.clearInterval(id)
  }, [active])
  return (
    <div className="mini-stage mini-spatial">
      <svg viewBox="0 0 230 160" aria-label="Language becomes a persistent spatial world">
        <path
          d="M0 112 L42 72 L72 101 L112 48 L150 98 L184 58 L230 110 L230 160 L0 160Z"
          className="mountain"
        />
        <rect
          x="68"
          y="88"
          width="94"
          height="55"
          rx="5"
          className="lab"
          style={{ opacity: phase >= 1 ? 1 : 0.12 }}
        />
        <g className="arm" style={{ opacity: phase >= 2 ? 1 : 0.12 }}>
          <line x1="96" y1="128" x2="103" y2="103" />
          <line x1="103" y1="103" x2="125" y2="93" />
          <circle cx="103" cy="103" r="5" />
        </g>
        <g className="scope" style={{ opacity: phase >= 3 ? 1 : 0.12 }}>
          <rect x="132" y="107" width="14" height="22" />
          <line x1="139" y1="107" x2="151" y2="96" />
        </g>
        <circle cx={phase >= 4 ? 139 : 91} cy={phase >= 4 ? 115 : 130} r="6" className="agent" />
      </svg>
      <div className="mini-readout">
        <span>pipeline</span>
        <strong>{['language', 'intent', 'world', 'tools', 'agent action'][phase]}</strong>
      </div>
    </div>
  )
}

const ENTRIES: AtlasEntry[] = [
  {
    index: '01',
    title: 'Gain Graph Laplacians',
    period: '2020–2021',
    question: 'How does local phase disagreement become a global spectral certificate?',
    contribution:
      'Normalized operators and extremal eigenvalue bounds for complex unit gain graphs.',
    route: '/research/graph-laplacians',
    evidence: 'Published research',
    Preview: GainPreview,
  },
  {
    index: '02',
    title: 'Natural-gradient variational inference',
    period: '2025',
    question:
      'Can a practical optimizer become provably understandable without losing its geometry?',
    contribution: 'Convergence guarantees through a square-root covariance parameterization.',
    route: '/research/natural-gradient-vi',
    evidence: 'Research manuscript',
    Preview: NaturalPreview,
  },
  {
    index: '03',
    title: 'Experience replay as optimization',
    period: '2026',
    question: 'Which remembered examples make the next update resemble joint training?',
    contribution:
      'A correction target, selection problem, mismatch diagnostic, and explicit failure boundary.',
    route: '/research/experience-replay-optimization',
    evidence: 'Under revision',
    Preview: ReplayPreview,
  },
  {
    index: '04',
    title: 'Rank feasibility in continual PEFT',
    period: '2026',
    question: 'Does a low-rank adapter contain any correction that helps every old task?',
    contribution: 'A geometric feasibility test and minimum-norm task-wise correction.',
    route: '/research/rank-feasibility',
    evidence: 'Under revision',
    Preview: RankPreview,
  },
  {
    index: '05',
    title: 'Time-continual language models',
    period: 'Ongoing',
    question: 'Which historical windows deserve the current tokens they replace?',
    contribution:
      'Counterfactual replay value over current, backward, and forward temporal regret.',
    route: '/research/ticlm',
    evidence: 'Ongoing research',
    Preview: TimePreview,
  },
  {
    index: '06',
    title: 'Urban micro-region logistics',
    period: '2023',
    question: 'Where can cargo bikes actually outperform vans under local city conditions?',
    contribution:
      'H3-scale urban context models that turn fleet transition into an operational decision.',
    route: '/research/urban-logistics',
    evidence: 'Research project',
    Preview: UrbanPreview,
  },
  {
    index: '07',
    title: 'Hate and counterspeech dynamics',
    period: '2020',
    question: 'How do harmful and protective behaviours co-evolve in real interaction networks?',
    contribution:
      'A released paired-user dataset and behavioural analysis of intervention patterns.',
    route: '/research/counterspeech',
    evidence: 'Published research',
    Preview: SocialPreview,
  },
  {
    index: '08',
    title: 'CasePath',
    period: 'Active system',
    question: 'How can fallible evidence become a decision process without hiding uncertainty?',
    contribution:
      'Bounded extraction, deterministic gates, reviewable process state, and explicit refusal paths.',
    route: '/systems/casepath',
    evidence: 'System research',
    Preview: CasePreview,
  },
  {
    index: '09',
    title: 'Language to persistent worlds',
    period: 'Active direction',
    question:
      'What changes when language edits an inhabited environment instead of producing a disposable image?',
    contribution:
      'A live speech-to-scene interface with visible intent, persistent state, direct manipulation, and situated action.',
    route: '/research/spatial-intelligence',
    evidence: 'Interactive laboratory',
    Preview: SpatialPreview,
  },
]

function AtlasEntryView({
  entry,
  active,
  onEnter,
}: {
  entry: AtlasEntry
  active: boolean
  onEnter: () => void
}) {
  const Preview = entry.Preview
  return (
    <article className="atlas-entry" onMouseEnter={onEnter} onFocus={onEnter}>
      <div className="atlas-entry-index">
        <span>{entry.index}</span>
        <i>{entry.period}</i>
      </div>
      <div className="atlas-entry-copy">
        <p className="atlas-evidence">{entry.evidence}</p>
        <h2>{entry.title}</h2>
        <p className="atlas-question">{entry.question}</p>
        <p className="atlas-contribution">{entry.contribution}</p>
        <Link to={entry.route} className="atlas-enter">
          Enter the instrument <span>↗</span>
        </Link>
      </div>
      <div className="atlas-entry-preview">
        <Preview active={active} />
      </div>
    </article>
  )
}

export function AtlasPage() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [word, setWord] = useState(0)
  const verbs = useMemo(() => ['visible', 'testable', 'inhabitable'], [])
  useEffect(() => {
    const id = window.setInterval(() => setWord((value) => (value + 1) % verbs.length), 1600)
    return () => window.clearInterval(id)
  }, [verbs])

  return (
    <div className="atlas-page">
      <PortfolioHeader />
      <main>
        <section className="atlas-hero" id="top">
          <div className="atlas-hero-copy">
            <p className="portfolio-kicker">Research should explain itself</p>
            <h1>
              Difficult ideas,
              <br />
              <em>{verbs[word]}.</em>
            </h1>
            <p>
              A collection of living research instruments. Each work begins with the problem,
              exposes the mechanism through motion, and lets the evidence appear only when it
              becomes useful.
            </p>
            <div className="atlas-hero-actions">
              <a className="portfolio-button is-primary" href="#atlas">
                Explore the atlas
              </a>
              <Link className="portfolio-button" to="/research/spatial-intelligence">
                Open the spatial lab
              </Link>
            </div>
          </div>
          <div className="atlas-thesis" aria-label="How to read the portfolio">
            <span>problem</span>
            <i>→</i>
            <span>mechanism</span>
            <i>→</i>
            <span>intervention</span>
            <i>→</i>
            <span>change</span>
            <i>→</i>
            <span>evidence</span>
          </div>
          <p className="atlas-scroll-note">
            Nine questions · Nine native visual languages · One standard of evidence
          </p>
        </section>

        <section className="atlas-intro" id="atlas">
          <p className="portfolio-kicker">The atlas</p>
          <h2>
            Do not begin with an abstract.
            <br />
            Begin with the thing itself.
          </h2>
          <p>Move through the works chronologically, or enter the question that matters to you.</p>
        </section>

        <section className="atlas-list" aria-label="Research atlas">
          {ENTRIES.map((entry, index) => (
            <AtlasEntryView
              key={entry.route}
              entry={entry}
              active={activeIndex === index}
              onEnter={() => setActiveIndex(index)}
            />
          ))}
        </section>

        <section className="atlas-method">
          <div>
            <p className="portfolio-kicker">The common method</p>
            <h2>Structure the uncertainty. Compute what can be computed. Expose what remains.</h2>
          </div>
          <ol>
            <li>
              <strong>Formalize</strong>
              <span>Make the object, constraint, and failure mode explicit.</span>
            </li>
            <li>
              <strong>Instrument</strong>
              <span>Turn hidden behaviour into quantities a visitor can inspect.</span>
            </li>
            <li>
              <strong>Intervene</strong>
              <span>Let one principled change propagate visibly through the system.</span>
            </li>
            <li>
              <strong>Bound</strong>
              <span>Show where the explanation or method stops being sufficient.</span>
            </li>
          </ol>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
