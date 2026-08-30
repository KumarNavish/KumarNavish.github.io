import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioHeader'
import './atlas.css'

type AtlasStatus = 'Published' | 'Under revision' | 'Ongoing' | 'System' | 'Active direction'

type PreviewKind =
  | 'graph'
  | 'natural'
  | 'gbr'
  | 'rank'
  | 'ticlm'
  | 'urban'
  | 'counter'
  | 'casepath'
  | 'spatial'

interface AtlasEntry {
  number: string
  title: string
  question: string
  contribution: string
  status: AtlasStatus
  route: string
  kind: PreviewKind
  evidence?: { label: string; href: string }
}

const ATLAS_ENTRIES: AtlasEntry[] = [
  {
    number: '01',
    title: 'Gain Graph Laplacians',
    question: 'How does local phase inconsistency become a global spectral certificate?',
    contribution:
      'Normalized gain-Laplacian foundations and extremal eigenvalue bounds tied to graph frustration.',
    status: 'Published',
    route: '/research/graph-laplacians',
    kind: 'graph',
    evidence: {
      label: 'Linear Algebra and its Applications',
      href: 'https://www.sciencedirect.com/science/article/pii/S0024379521002111',
    },
  },
  {
    number: '02',
    title: 'Natural-Gradient Variational Inference',
    question: 'Can a practical optimization geometry also admit a clean convergence story?',
    contribution:
      'Convergence guarantees for square-root natural-gradient variational Gaussian inference and its flow.',
    status: 'Published',
    route: '/research/natural-gradient-vi',
    kind: 'natural',
    evidence: { label: 'arXiv', href: 'https://arxiv.org/abs/2507.07853' },
  },
  {
    number: '03',
    title: 'Experience Replay / GBR',
    question: 'Which remembered examples make the next update resemble joint training?',
    contribution:
      'A replay correction target, observable mismatch, and greedy selection rule grounded in optimization.',
    status: 'Under revision',
    route: '/research/experience-replay-optimization',
    kind: 'gbr',
    evidence: { label: 'OpenReview', href: 'https://openreview.net/forum?id=4z7il66fFb' },
  },
  {
    number: '04',
    title: 'Rank Feasibility in Continual PEFT',
    question: 'Does a low-rank adaptation space contain a correction that can protect every old task?',
    contribution:
      'A geometric feasibility test and minimum-norm correction for choosing the smallest useful LoRA rank.',
    status: 'Under revision',
    route: '/research/rank-feasibility',
    kind: 'rank',
    evidence: { label: 'OpenReview', href: 'https://openreview.net/forum?id=CwmHHYCbjK' },
  },
  {
    number: '05',
    title: 'Time-Continual Language Models',
    question: 'When should an old data window earn the current tokens it replaces?',
    contribution:
      'A counterfactual view of replay value across current adaptation, backward retention, and forward compatibility.',
    status: 'Ongoing',
    route: '/research/ticlm',
    kind: 'ticlm',
  },
  {
    number: '06',
    title: 'Urban Micro-Region Logistics',
    question: 'Where can cargo bikes replace vans without degrading service?',
    contribution:
      'A spatial modeling pipeline that turns neighborhood context into operational fleet-transition evidence.',
    status: 'Published',
    route: '/research/urban-logistics',
    kind: 'urban',
    evidence: { label: 'arXiv', href: 'https://arxiv.org/abs/2301.12887' },
  },
  {
    number: '07',
    title: 'Hate and Counterspeech Dynamics',
    question: 'How do harmful and protective speech behaviors interact at the level of people and communities?',
    contribution:
      'A paired-user dataset and behavioral analysis exposing asymmetries in interaction and counterspeech strategy.',
    status: 'Published',
    route: '/research/counterspeech',
    kind: 'counter',
    evidence: { label: 'ACM', href: 'https://dl.acm.org/doi/abs/10.1145/3371158.3371172' },
  },
  {
    number: '08',
    title: 'CasePath',
    question: 'How can fallible evidence become a safe, reviewable procedural decision?',
    contribution:
      'A bounded evidence-to-process architecture with deterministic gates, provenance, and explicit failure surfaces.',
    status: 'System',
    route: '/systems/casepath',
    kind: 'casepath',
  },
  {
    number: '09',
    title: 'Generative AI × Spatial Computing',
    question: 'What changes when language becomes a persistent environment for situated action?',
    contribution:
      'A live speech-to-scene laboratory that exposes intent, world structure, persistent edits, and agent behavior.',
    status: 'Active direction',
    route: '/research/spatial-intelligence',
    kind: 'spatial',
  },
]

function GraphPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Gain graph phase preview">
      <defs>
        <marker id="atlas-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0L8 4L0 8Z" fill="currentColor" />
        </marker>
      </defs>
      <g className="atlas-graph-edges">
        <line x1="72" y1="114" x2="148" y2="48" />
        <line x1="148" y1="48" x2="264" y2="70" className="is-live" />
        <line x1="264" y1="70" x2="290" y2="156" />
        <line x1="290" y1="156" x2="178" y2="176" />
        <line x1="178" y1="176" x2="72" y2="114" />
        <line x1="148" y1="48" x2="178" y2="176" />
      </g>
      {[['72','114'],['148','48'],['264','70'],['290','156'],['178','176']].map(([x,y], index) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="10" className={index === 2 ? 'is-emphasis' : ''} />
      ))}
      <g className="atlas-phase-orbit" transform="translate(206 58)">
        <circle cx="0" cy="0" r="22" />
        <line x1="0" y1="0" x2="18" y2="0" markerEnd="url(#atlas-arrow)" />
      </g>
      <g className="atlas-spectrum" transform="translate(58 194)">
        <line x1="0" y1="0" x2="244" y2="0" />
        {[18, 58, 102, 151, 202].map((x, index) => (
          <circle key={x} cx={x} cy={index === 0 ? -10 : -5 - index * 2} r={index === 0 ? 6 : 4} />
        ))}
      </g>
    </svg>
  )
}

function NaturalPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Natural gradient geometry preview">
      <g className="atlas-contours">
        <ellipse cx="228" cy="102" rx="100" ry="42" transform="rotate(-18 228 102)" />
        <ellipse cx="228" cy="102" rx="72" ry="30" transform="rotate(-18 228 102)" />
        <ellipse cx="228" cy="102" rx="40" ry="16" transform="rotate(-18 228 102)" />
      </g>
      <circle cx="228" cy="102" r="6" className="atlas-target" />
      <path className="atlas-euclidean-path" d="M58 164L112 91L165 140L212 84L228 102" />
      <path className="atlas-natural-path" d="M58 164C104 141 137 118 169 106C190 98 208 97 228 102" />
      <g className="atlas-covariance" transform="translate(82 52)">
        <ellipse cx="0" cy="0" rx="30" ry="13" transform="rotate(24)" />
        <line x1="-25" y1="0" x2="25" y2="0" transform="rotate(24)" />
      </g>
      <text x="42" y="190">geometry changes the path</text>
    </svg>
  )
}

function GbrPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Replay correction preview">
      <g className="atlas-memory-cloud">
        {[[72,54],[102,90],[78,142],[132,157],[150,64],[172,122],[116,120]].map(([x,y], index) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="6" className={index === 1 || index === 4 || index === 5 ? 'is-selected' : ''} />
        ))}
      </g>
      <g className="atlas-vector-current">
        <line x1="210" y1="154" x2="312" y2="94" />
        <circle cx="312" cy="94" r="5" />
      </g>
      <g className="atlas-vector-target">
        <line x1="210" y1="154" x2="262" y2="48" />
        <circle cx="262" cy="48" r="5" />
      </g>
      <g className="atlas-vector-replay">
        <line x1="210" y1="154" x2="251" y2="62" />
        <circle cx="251" cy="62" r="5" />
      </g>
      <line className="atlas-residual" x1="251" y1="62" x2="262" y2="48" />
      <text x="200" y="186">selected memory shrinks the residual</text>
    </svg>
  )
}

function RankPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Rank feasibility preview">
      <g transform="translate(48 178)">
        <path className="atlas-rank-space rank-one" d="M0 0L232 -72" />
        <path className="atlas-rank-space rank-wide" d="M0 0L236 -126L264 -34Z" />
        <circle cx="236" cy="-126" r="7" className="atlas-rank-target" />
        <line className="atlas-rank-gap" x1="222" y1="-69" x2="236" y2="-126" />
        <circle cx="222" cy="-69" r="5" className="atlas-rank-projection" />
      </g>
      <g className="atlas-rank-meter" transform="translate(62 24)">
        {[0,1,2,3,4,5].map((index) => <rect key={index} x={index * 24} y="0" width="16" height="7" rx="3.5" />)}
      </g>
      <text x="205" y="193">rank expands what can be corrected</text>
    </svg>
  )
}

function TiclmPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Temporal replay preview">
      <g className="atlas-time-windows" transform="translate(38 33)">
        {[0,1,2,3,4,5].map((index) => (
          <rect key={index} x={index * 43} y="0" width="32" height="28" rx="6" className={index === 5 ? 'is-current' : index < 2 ? 'is-stale' : ''} />
        ))}
        <path d="M15 36C40 86 174 82 230 36" />
        <path className="is-harmful" d="M58 36C82 112 188 118 230 36" />
      </g>
      <g className="atlas-regret-grid" transform="translate(73 95)">
        {Array.from({ length: 24 }).map((_, index) => {
          const row = Math.floor(index / 6)
          const column = index % 6
          return <rect key={index} x={column * 32} y={row * 22} width="26" height="16" rx="3" style={{ opacity: 0.22 + ((row + column) % 5) * 0.13 }} />
        })}
      </g>
      <text x="70" y="199">history helps until it becomes stale</text>
    </svg>
  )
}

function UrbanPreview() {
  const hexes = Array.from({ length: 18 }).map((_, index) => {
    const column = index % 6
    const row = Math.floor(index / 6)
    const x = 42 + column * 42 + (row % 2) * 21
    const y = 34 + row * 48
    return `${x},${y - 14} ${x + 13},${y - 7} ${x + 13},${y + 7} ${x},${y + 14} ${x - 13},${y + 7} ${x - 13},${y - 7}`
  })
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Urban logistics preview">
      <g className="atlas-hex-grid">
        {hexes.map((points, index) => <polygon key={points} points={points} className={index === 7 || index === 8 || index === 13 ? 'is-bike' : index === 4 || index === 10 ? 'is-van' : ''} />)}
      </g>
      <path className="atlas-bike-route" d="M70 142C112 106 164 132 202 94C230 68 251 72 290 46" />
      <circle className="atlas-bike-dot" cx="70" cy="142" r="7" />
      <text x="170" y="190">context changes the best fleet</text>
    </svg>
  )
}

function CounterPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Counterspeech network preview">
      <g className="atlas-social-links">
        <line x1="78" y1="96" x2="155" y2="61" />
        <line x1="78" y1="96" x2="155" y2="126" />
        <line x1="155" y1="61" x2="250" y2="84" />
        <line x1="155" y1="126" x2="250" y2="84" />
        <line x1="155" y1="126" x2="262" y2="153" />
        <line x1="250" y1="84" x2="262" y2="153" />
      </g>
      <g className="atlas-hate-nodes">
        <circle cx="78" cy="96" r="16" />
        <circle cx="155" cy="61" r="12" />
      </g>
      <g className="atlas-counter-nodes">
        <circle cx="155" cy="126" r="14" />
        <circle cx="250" cy="84" r="15" />
        <circle cx="262" cy="153" r="10" />
      </g>
      <path className="atlas-counter-pulse" d="M155 126C188 103 213 95 250 84" />
      <text x="70" y="194">interaction changes the intervention</text>
    </svg>
  )
}

function CasePathPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Evidence process preview">
      <g className="atlas-process-column">
        <rect x="34" y="38" width="68" height="92" rx="10" />
        <line x1="47" y1="58" x2="88" y2="58" />
        <line x1="47" y1="76" x2="82" y2="76" />
        <line x1="47" y1="94" x2="91" y2="94" />
      </g>
      <g className="atlas-extract-column">
        <rect x="133" y="48" width="76" height="70" rx="11" />
        <circle cx="150" cy="67" r="5" />
        <line x1="162" y1="67" x2="193" y2="67" />
        <circle cx="150" cy="84" r="5" />
        <line x1="162" y1="84" x2="191" y2="84" />
        <circle cx="150" cy="101" r="5" />
        <line x1="162" y1="101" x2="187" y2="101" />
      </g>
      <g className="atlas-gate-column">
        <path d="M244 50H314V76H270V92H314V118H244Z" />
        <circle cx="279" cy="63" r="7" />
        <circle cx="279" cy="105" r="7" />
      </g>
      <path className="atlas-process-flow" d="M103 83H132M210 83H243" />
      <g className="atlas-output-tree">
        <line x1="278" y1="119" x2="278" y2="151" />
        <line x1="234" y1="151" x2="318" y2="151" />
        <circle cx="234" cy="151" r="8" />
        <circle cx="278" cy="151" r="8" />
        <circle cx="318" cy="151" r="8" />
      </g>
      <text x="70" y="194">every decision keeps its evidence trace</text>
    </svg>
  )
}

function SpatialPreview() {
  return (
    <svg className="atlas-preview-svg" viewBox="0 0 360 210" role="img" aria-label="Speech to scene preview">
      <g className="atlas-speech-wave" transform="translate(28 56)">
        {[18,32,48,26,58,39,22].map((height, index) => <rect key={index} x={index * 10} y={(58 - height) / 2} width="5" height={height} rx="2.5" />)}
      </g>
      <path className="atlas-spatial-flow" d="M108 84H146" />
      <g className="atlas-intent-stack" transform="translate(148 42)">
        <rect x="0" y="0" width="70" height="20" rx="7" />
        <rect x="8" y="30" width="84" height="20" rx="7" />
        <rect x="0" y="60" width="61" height="20" rx="7" />
      </g>
      <path className="atlas-spatial-flow" d="M242 84H274" />
      <g className="atlas-world-mini" transform="translate(271 42)">
        <path d="M0 62L32 20L64 62Z" />
        <rect x="14" y="62" width="46" height="38" rx="4" />
        <circle cx="47" cy="18" r="11" />
        <path className="atlas-agent-path" d="M14 91C28 72 43 82 57 68" />
        <circle cx="14" cy="91" r="6" />
      </g>
      <text x="70" y="194">language becomes persistent world state</text>
    </svg>
  )
}

function AtlasPreview({ kind }: { kind: PreviewKind }) {
  switch (kind) {
    case 'graph':
      return <GraphPreview />
    case 'natural':
      return <NaturalPreview />
    case 'gbr':
      return <GbrPreview />
    case 'rank':
      return <RankPreview />
    case 'ticlm':
      return <TiclmPreview />
    case 'urban':
      return <UrbanPreview />
    case 'counter':
      return <CounterPreview />
    case 'casepath':
      return <CasePathPreview />
    case 'spatial':
      return <SpatialPreview />
  }
}

function AtlasEntryRow({ entry }: { entry: AtlasEntry }) {
  return (
    <article className={`atlas-entry atlas-kind-${entry.kind}`}>
      <div className="atlas-entry-index" aria-hidden="true">
        {entry.number}
      </div>
      <div className="atlas-entry-copy">
        <div className="atlas-entry-meta">
          <span>{entry.status}</span>
          {entry.evidence ? (
            <a href={entry.evidence.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              {entry.evidence.label} ↗
            </a>
          ) : null}
        </div>
        <h3>{entry.title}</h3>
        <p className="atlas-entry-question">{entry.question}</p>
        <p className="atlas-entry-contribution">{entry.contribution}</p>
        <Link className="atlas-entry-link" to={entry.route}>
          Enter explanation <span aria-hidden="true">→</span>
        </Link>
      </div>
      <Link className="atlas-entry-stage" to={entry.route} aria-label={`Open ${entry.title}`}>
        <AtlasPreview kind={entry.kind} />
      </Link>
    </article>
  )
}

export function AtlasPage() {
  return (
    <div className="atlas-page" id="top">
      <PortfolioHeader />

      <main>
        <section className="atlas-hero">
          <div className="atlas-hero-copy">
            <p className="atlas-kicker">Research, systems, interaction</p>
            <h1>
              Difficult ideas,
              <span>made directly explorable.</span>
            </h1>
            <p className="atlas-hero-lead">
              I investigate how learning systems remain useful under constraints—and build the
              instruments that make their behavior visible.
            </p>
            <div className="atlas-hero-actions">
              <a className="portfolio-button is-primary" href="#atlas">
                Enter the atlas
              </a>
              <Link className="portfolio-button" to="/research/spatial-intelligence">
                Open speech-to-scene lab
              </Link>
            </div>
          </div>

          <div className="atlas-hero-instrument" aria-label="Portfolio thesis visual">
            <div className="atlas-thesis-orbit">
              <span className="atlas-thesis-node node-research">Research</span>
              <span className="atlas-thesis-node node-systems">Systems</span>
              <span className="atlas-thesis-node node-product">Product</span>
              <span className="atlas-thesis-node node-interaction">Interaction</span>
              <i className="atlas-thesis-core">useful intelligence</i>
            </div>
            <p>
              The site is not a résumé wrapper. Every major work is an authored explanatory
              instrument: problem → mechanism → consequence → evidence → boundary.
            </p>
          </div>
        </section>

        <section className="atlas-signal-strip" aria-label="Portfolio signal">
          <article>
            <strong>Mathematical depth</strong>
            <span>Spectral structure, optimization geometry, feasibility.</span>
          </article>
          <article>
            <strong>Systems judgment</strong>
            <span>Constraints, evidence, failure surfaces, operational decisions.</span>
          </article>
          <article>
            <strong>Product execution</strong>
            <span>Interfaces that let people inspect, manipulate, and understand.</span>
          </article>
        </section>

        <section className="atlas-body" id="atlas" aria-labelledby="atlas-title">
          <header className="atlas-section-header">
            <p className="atlas-kicker">The body of work</p>
            <h2 id="atlas-title">One trajectory, nine living explanations.</h2>
            <p>
              Published foundations, papers under revision, active research, systems, and frontier
              experiments are organized by the question each one makes tractable—not by chronology.
            </p>
          </header>

          <div className="atlas-entry-list">
            {ATLAS_ENTRIES.map((entry) => (
              <AtlasEntryRow key={entry.route} entry={entry} />
            ))}
          </div>
        </section>

        <section className="atlas-trajectory" aria-labelledby="trajectory-title">
          <div className="atlas-trajectory-copy">
            <p className="atlas-kicker">The recurring method</p>
            <h2 id="trajectory-title">I keep returning to the same hard transition.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <strong>Expose the hidden constraint.</strong>
              <p>What can the system not represent, observe, retain, or safely decide?</p>
            </li>
            <li>
              <span>02</span>
              <strong>Construct the right object.</strong>
              <p>A spectrum, correction target, feasibility region, regret row, or evidence graph.</p>
            </li>
            <li>
              <span>03</span>
              <strong>Make behavior inspectable.</strong>
              <p>Turn the object into diagnostics, experiments, controls, and falsifiable boundaries.</p>
            </li>
            <li>
              <span>04</span>
              <strong>Translate it into use.</strong>
              <p>Let researchers, operators, or users make a better decision because the mechanism is visible.</p>
            </li>
          </ol>
        </section>

        <section className="atlas-frontier" aria-labelledby="frontier-title">
          <div>
            <p className="atlas-kicker">The frontier</p>
            <h2 id="frontier-title">From models that answer to worlds that persist.</h2>
            <p>
              My spatial-computing direction asks what happens when language no longer ends as text:
              intent becomes structured world state, the world survives successive instructions, and
              agents act inside it.
            </p>
            <Link className="portfolio-button is-primary" to="/research/spatial-intelligence">
              Build a world in the browser
            </Link>
          </div>
          <Link className="atlas-frontier-stage" to="/research/spatial-intelligence" aria-label="Open spatial computing lab">
            <SpatialPreview />
          </Link>
        </section>
      </main>

      <PortfolioFooter />
    </div>
  )
}
