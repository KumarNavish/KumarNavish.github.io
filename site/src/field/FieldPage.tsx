import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import katex from 'katex'
import 'katex/dist/katex.min.css'

import {
  getEntity,
  getEvidenceClaim,
  getEvidenceSource,
  type FieldEntity,
} from './content'
import {
  createInitialFieldState,
  fieldReducer,
  type FieldChapter,
  type FieldState,
} from './experience'
import {
  REPLAY_CANDIDATES,
  REPLAY_TARGET,
  selectReplayCandidates,
  type ReplayMethod,
  type Vector2,
} from './replayModel'
import { useActiveChapter, useSectionProgress } from './useSectionProgress'

const CHAPTER_IDS: FieldChapter[] = ['entry', 'trajectory', 'proof', 'replay', 'contact']

const TRAJECTORY_ENTITIES = [
  'spectral-foundations',
  'square-root-ngi',
  'experience-replay',
  'rank-feasibility',
  'ticlm',
  'casepath',
  'spatial-intelligence',
] as const

const CHAPTER_LABELS: Record<FieldChapter, string> = {
  entry: 'Thesis',
  trajectory: 'Trajectory',
  proof: 'Selected work',
  replay: 'Replay monograph',
  contact: 'Contact',
}

interface Point {
  x: number
  y: number
}

type NodeStyle = CSSProperties & {
  '--node-x': string
  '--node-y': string
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number): number {
  const normalized = clamp((value - edgeStart) / Math.max(edgeEnd - edgeStart, 0.0001))
  return normalized * normalized * (3 - 2 * normalized)
}

function isFieldChapter(value: string): value is FieldChapter {
  return CHAPTER_IDS.includes(value as FieldChapter)
}

function initialReducedMotion(): boolean {
  const stored = window.localStorage.getItem('field-reduced-motion')
  if (stored === 'true') {
    return true
  }
  if (stored === 'false') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scrollToChapter(chapter: FieldChapter): void {
  document.getElementById(chapter)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function vectorEndpoint(vector: Vector2, origin: Point, scale: number): Point {
  return {
    x: origin.x + vector.x * scale,
    y: origin.y + vector.y * scale,
  }
}

function EvidenceMarker({
  claimId,
  visible,
  onOpen,
}: {
  claimId: string
  visible: boolean
  onOpen: (claimId: string) => void
}) {
  if (!visible) {
    return null
  }

  return (
    <button
      type="button"
      className="evidence-marker"
      onClick={() => onOpen(claimId)}
      aria-label="Inspect evidence for this claim"
    >
      Evidence
    </button>
  )
}

function StatusLine({ entity }: { entity: FieldEntity }) {
  return (
    <p className="status-line">
      <span>{entity.statusLabel}</span>
      <span aria-hidden="true">/</span>
      <span>{entity.year}</span>
    </p>
  )
}

function PersistentField({ state }: { state: FieldState }) {
  const positionSets: Record<FieldChapter, Point[]> = {
    entry: [
      { x: 18, y: 32 },
      { x: 40, y: 18 },
      { x: 62, y: 36 },
      { x: 82, y: 22 },
      { x: 74, y: 68 },
      { x: 42, y: 78 },
      { x: 20, y: 66 },
    ],
    trajectory: [
      { x: 18, y: 20 },
      { x: 29, y: 30 },
      { x: 42, y: 41 },
      { x: 55, y: 52 },
      { x: 68, y: 63 },
      { x: 78, y: 73 },
      { x: 88, y: 84 },
    ],
    proof: [
      { x: 12, y: 25 },
      { x: 24, y: 25 },
      { x: 48, y: 50 },
      { x: 72, y: 50 },
      { x: 88, y: 50 },
      { x: 28, y: 76 },
      { x: 78, y: 82 },
    ],
    replay: [
      { x: 11, y: 16 },
      { x: 18, y: 26 },
      { x: 52, y: 48 },
      { x: 78, y: 35 },
      { x: 86, y: 74 },
      { x: 24, y: 82 },
      { x: 90, y: 88 },
    ],
    contact: [
      { x: 42, y: 50 },
      { x: 45, y: 50 },
      { x: 48, y: 50 },
      { x: 51, y: 50 },
      { x: 54, y: 50 },
      { x: 57, y: 50 },
      { x: 60, y: 50 },
    ],
  }

  const positions = positionSets[state.chapter]

  return (
    <svg className="persistent-field" viewBox="0 0 100 100" aria-hidden="true">
      <g className="persistent-field-lines">
        <path d="M18 32 L40 18 L62 36 L82 22" />
        <path d="M18 32 L20 66 L42 78 L74 68 L82 22" />
        <path d="M40 18 L42 78 M62 36 L74 68" />
      </g>
      {TRAJECTORY_ENTITIES.map((entityId, index) => {
        const entity = getEntity(entityId)
        const point = positions[index] ?? { x: 50, y: 50 }
        const style: NodeStyle = {
          '--node-x': `${point.x}px`,
          '--node-y': `${point.y}px`,
        }
        const isFocused = state.focusedEntityId === entityId
        return (
          <g
            key={entityId}
            className={isFocused ? 'persistent-field-node is-focused' : 'persistent-field-node'}
            style={style}
          >
            <circle r={isFocused ? 1.2 : 0.72} />
            <text x="1.8" y="0.5">
              {entity?.shortTitle ?? entityId}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function FieldHeader({
  state,
  onToggleEvidence,
  onToggleMotion,
}: {
  state: FieldState
  onToggleEvidence: () => void
  onToggleMotion: () => void
}) {
  return (
    <header className="field-header">
      <a className="field-identity" href="#entry" aria-label="Navish Kumar — return to thesis">
        <strong>Navish Kumar</strong>
        <span>Learning systems under change</span>
      </a>

      <nav className="field-nav" aria-label="Portfolio chapters">
        {CHAPTER_IDS.map((chapter) => (
          <a
            key={chapter}
            href={`#${chapter}`}
            aria-current={state.chapter === chapter ? 'location' : undefined}
          >
            {CHAPTER_LABELS[chapter]}
          </a>
        ))}
      </nav>

      <div className="field-tools">
        <button
          type="button"
          className="field-tool"
          aria-pressed={state.evidenceLens}
          onClick={onToggleEvidence}
          title="Toggle evidence lens (E)"
        >
          Evidence
        </button>
        <button
          type="button"
          className="field-tool"
          aria-pressed={state.reducedMotion}
          onClick={onToggleMotion}
        >
          {state.reducedMotion ? 'Motion reduced' : 'Reduce motion'}
        </button>
      </div>
    </header>
  )
}

function EntryScene({ onOpenWork }: { onOpenWork: () => void }) {
  return (
    <section id="entry" className="field-entry" data-chapter="entry" aria-labelledby="entry-title">
      <div className="entry-copy">
        <p className="entry-role">Researcher · systems builder · spatial intelligence</p>
        <h1 id="entry-title">I build learning systems that remain useful as the world changes.</h1>
        <p className="entry-thesis">
          The work moves from mathematical structure to continual adaptation, inspectable products,
          and spatial interfaces—always asking what should remain stable, what should change, and how
          the evidence should stay visible.
        </p>
        <div className="entry-actions">
          <button type="button" className="primary-action" onClick={() => scrollToChapter('trajectory')}>
            Explore the field
            <span aria-hidden="true">↓</span>
          </button>
          <button type="button" className="text-action" onClick={onOpenWork}>
            Skip to selected work
            <span aria-hidden="true">↘</span>
          </button>
        </div>
      </div>

      <div className="entry-signals" aria-label="Primary research signals">
        <article>
          <span>01</span>
          <h2>Replay</h2>
          <p>Which previous examples deserve influence in the next update?</p>
        </article>
        <article>
          <span>02</span>
          <h2>Feasibility</h2>
          <p>When does an adaptation subspace contain a valid correction?</p>
        </article>
        <article>
          <span>03</span>
          <h2>Embodiment</h2>
          <p>What should a spatial interface to an intelligent system expose?</p>
        </article>
      </div>

      <p className="entry-scroll" aria-hidden="true">
        Scroll to reorganize the work by question
      </p>
    </section>
  )
}

const TRAJECTORY_SCATTER: Point[] = [
  { x: 150, y: 180 },
  { x: 465, y: 90 },
  { x: 760, y: 225 },
  { x: 870, y: 500 },
  { x: 560, y: 615 },
  { x: 235, y: 545 },
  { x: 390, y: 335 },
]

const TRAJECTORY_ALIGNED: Point[] = [
  { x: 150, y: 115 },
  { x: 270, y: 200 },
  { x: 395, y: 290 },
  { x: 520, y: 380 },
  { x: 645, y: 470 },
  { x: 760, y: 555 },
  { x: 870, y: 625 },
]

function TrajectoryScene({
  reducedMotion,
  evidenceLens,
  onFocusEntity,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  evidenceLens: boolean
  onFocusEntity: (entityId: string | null) => void
  onOpenEvidence: (claimId: string) => void
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const progress = useSectionProgress(sectionRef, reducedMotion)
  const alignment = smoothstep(0.2, 0.72, progress)
  const relationOpacity = smoothstep(0.34, 0.62, progress)
  const evidenceOpacity = smoothstep(0.68, 0.9, progress)

  const activeStatement =
    progress < 0.22
      ? 'The work first appears broad: mathematical structure, learning, systems, and interaction.'
      : progress < 0.48
        ? 'Recurring questions begin to connect projects that initially look separate.'
        : progress < 0.78
          ? 'The trajectory resolves into one path: structure → adaptation → inspection → embodiment.'
          : 'The evidence attaches to the questions, not to a chronology of job titles.'

  return (
    <section
      ref={sectionRef}
      id="trajectory"
      className="field-trajectory scroll-scene"
      data-chapter="trajectory"
      aria-labelledby="trajectory-title"
    >
      <div className="scene-sticky trajectory-layout">
        <div className="trajectory-copy">
          <p className="scene-index">01 / Trajectory</p>
          <h2 id="trajectory-title">
            One question connects the work: how can intelligent systems remain useful under change?
          </h2>
          <p className="trajectory-statement" aria-live="polite">
            {activeStatement}
          </p>

          <ol className="trajectory-axes">
            {[
              ['spectral-foundations', 'Mathematical structure', 'What must remain true?'],
              ['experience-replay', 'Continual adaptation', 'What should memory contribute now?'],
              ['casepath', 'Reliable systems', 'How should evidence and failure remain inspectable?'],
              ['spatial-intelligence', 'Spatial intelligence', 'What should the interface become?'],
            ].map(([entityId, label, question]) => (
              <li key={entityId}>
                <button
                  type="button"
                  onClick={() => onFocusEntity(entityId)}
                  onFocus={() => onFocusEntity(entityId)}
                  onBlur={() => onFocusEntity(null)}
                  onMouseEnter={() => onFocusEntity(entityId)}
                  onMouseLeave={() => onFocusEntity(null)}
                >
                  <span>{label}</span>
                  <strong>{question}</strong>
                </button>
              </li>
            ))}
          </ol>

          <div className="trajectory-evidence" style={{ opacity: evidenceOpacity }}>
            <p>
              The portfolio is organized by recurring questions rather than résumé chronology.
              <EvidenceMarker
                claimId="portfolio-system"
                visible={evidenceLens}
                onOpen={onOpenEvidence}
              />
            </p>
          </div>
        </div>

        <figure className="trajectory-figure">
          <svg viewBox="0 0 1000 700" role="img" aria-labelledby="trajectory-figure-title">
            <title id="trajectory-figure-title">
              Research projects reorganizing from scattered work into a question-driven trajectory
            </title>
            <g className="trajectory-question-lines" style={{ opacity: relationOpacity }}>
              <path d="M120 112 C320 108 455 254 515 377" />
              <path d="M356 286 C520 254 636 397 650 470" />
              <path d="M515 377 C610 438 738 525 882 626" />
            </g>
            <path
              className="trajectory-spine"
              d="M150 115 L270 200 L395 290 L520 380 L645 470 L760 555 L870 625"
              style={{ opacity: relationOpacity }}
            />
            {TRAJECTORY_ENTITIES.map((entityId, index) => {
              const entity = getEntity(entityId)
              const scatter = TRAJECTORY_SCATTER[index] ?? { x: 500, y: 350 }
              const aligned = TRAJECTORY_ALIGNED[index] ?? scatter
              const x = lerp(scatter.x, aligned.x, alignment)
              const y = lerp(scatter.y, aligned.y, alignment)
              return (
                <g key={entityId} transform={`translate(${x} ${y})`}>
                  <circle className={`entity-shape entity-shape-${entity?.kind ?? 'paper'}`} r="18" />
                  <circle className="entity-core" r="3" />
                  <text className="entity-year" x="28" y="-8">
                    {entity?.year}
                  </text>
                  <text className="entity-label" x="28" y="13">
                    {entity?.shortTitle}
                  </text>
                </g>
              )
            })}
          </svg>
          <figcaption>
            Chronology remains available, but the primary map is causal: questions generate methods,
            evidence, systems, and new questions.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function EvidenceThreshold({
  evidenceLens,
  onFocusEntity,
  onOpenEvidence,
  onOpenMonograph,
}: {
  evidenceLens: boolean
  onFocusEntity: (entityId: string | null) => void
  onOpenEvidence: (claimId: string) => void
  onOpenMonograph: () => void
}) {
  const works = [
    {
      entityId: 'experience-replay',
      mechanism: 'Choose a replay subset by matching the update correction induced by the stage objective.',
      evidence: 'Locked 10-seed outcome comparison plus a public review record.',
      action: (
        <button type="button" className="work-action" onClick={onOpenMonograph}>
          Inspect monograph <span aria-hidden="true">↗</span>
        </button>
      ),
    },
    {
      entityId: 'rank-feasibility',
      mechanism: 'Test whether a candidate LoRA rank contains a sufficiently small old-task correction.',
      evidence: 'Public NeurIPS submission, reviewer discussion, and held-out correction tests.',
      action: (
        <a
          className="work-action"
          href="https://openreview.net/forum?id=CwmHHYCbjK"
          target="_blank"
          rel="noreferrer"
        >
          Open review record <span aria-hidden="true">↗</span>
        </a>
      ),
    },
    {
      entityId: 'ticlm',
      mechanism: 'Value historical windows by the regret-row improvement they produce after replacing current tokens.',
      evidence: 'Ongoing work; the present surface states the hypothesis without presenting it as completed evidence.',
      action: <span className="work-state">Current research frontier</span>,
    },
  ]

  return (
    <section id="proof" className="field-proof" data-chapter="proof" aria-labelledby="proof-title">
      <header className="proof-header">
        <p className="scene-index">02 / Selected work</p>
        <h2 id="proof-title">Three mechanisms, one standard: make the desired behaviour inspectable.</h2>
        <p>
          Each work is reduced to the question it asks, the mechanism it introduces, the evidence
          available now, and the boundary that remains.
        </p>
      </header>

      <div className="work-ledger">
        {works.map(({ entityId, mechanism, evidence, action }, index) => {
          const entity = getEntity(entityId)
          if (!entity) {
            return null
          }
          return (
            <article
              key={entityId}
              onMouseEnter={() => onFocusEntity(entityId)}
              onMouseLeave={() => onFocusEntity(null)}
            >
              <div className="work-number">0{index + 1}</div>
              <div className="work-main">
                <StatusLine entity={entity} />
                <h3>{entity.title}</h3>
                <p className="work-question">{entity.question}</p>
              </div>
              <dl className="work-definition">
                <div>
                  <dt>Mechanism</dt>
                  <dd>{mechanism}</dd>
                </div>
                <div>
                  <dt>Evidence state</dt>
                  <dd>{evidence}</dd>
                </div>
              </dl>
              <div className="work-controls">
                {action}
                {entityId === 'experience-replay' ? (
                  <EvidenceMarker
                    claimId="er-framing"
                    visible={evidenceLens}
                    onOpen={onOpenEvidence}
                  />
                ) : null}
                {entityId === 'rank-feasibility' ? (
                  <EvidenceMarker
                    claimId="rank-framing"
                    visible={evidenceLens}
                    onOpen={onOpenEvidence}
                  />
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Arrow({
  from,
  to,
  className,
}: {
  from: Point
  to: Point
  className: string
}) {
  return (
    <g className={className}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle cx={to.x} cy={to.y} r="3" />
    </g>
  )
}

function ReplayMechanismFigure({ progress }: { progress: number }) {
  const origin = { x: 155, y: 175 }
  const scale = 150
  const current = vectorEndpoint({ x: 0.82, y: 0.31 }, origin, scale)
  const desired = vectorEndpoint(REPLAY_TARGET, origin, scale)
  const selection = selectReplayCandidates({ method: 'greedy', candidateCount: 3, seed: 17 })
  const selectedMean = vectorEndpoint(selection.mean, origin, scale)
  const candidateOpacity = smoothstep(0.16, 0.34, progress)
  const selectionOpacity = smoothstep(0.36, 0.58, progress)
  const residualOpacity = smoothstep(0.49, 0.65, progress)

  return (
    <figure className="replay-mechanism-figure">
      <svg viewBox="0 0 520 350" role="img" aria-labelledby="replay-figure-title">
        <title id="replay-figure-title">
          Current and desired updates, candidate replay gradients, greedy subset mean, and residual mismatch
        </title>
        <g className="mechanism-grid">
          <line x1="55" y1={origin.y} x2="465" y2={origin.y} />
          <line x1={origin.x} y1="42" x2={origin.x} y2="304" />
        </g>
        <circle className="mechanism-origin" cx={origin.x} cy={origin.y} r="4" />
        <Arrow from={origin} to={current} className="vector-current" />
        <text className="vector-label" x={current.x + 8} y={current.y - 8}>
          current update
        </text>
        <Arrow from={origin} to={desired} className="vector-desired" />
        <text className="vector-label vector-label-strong" x={desired.x + 8} y={desired.y - 10}>
          desired update
        </text>

        <g style={{ opacity: candidateOpacity }}>
          {REPLAY_CANDIDATES.map((candidate) => {
            const endpoint = vectorEndpoint(candidate, origin, scale)
            const selected = selection.selectedIds.includes(candidate.id)
            return (
              <g key={candidate.id} className={selected ? 'candidate is-selected' : 'candidate'}>
                <line x1={origin.x} y1={origin.y} x2={endpoint.x} y2={endpoint.y} />
                <circle cx={endpoint.x} cy={endpoint.y} r={selected ? 4 : 2.5} />
              </g>
            )
          })}
        </g>

        <g style={{ opacity: selectionOpacity }}>
          <Arrow from={origin} to={selectedMean} className="vector-selection" />
          <text className="vector-label" x={selectedMean.x + 8} y={selectedMean.y + 17}>
            selected mean
          </text>
        </g>
        <g className="residual-segment" style={{ opacity: residualOpacity }}>
          <line x1={selectedMean.x} y1={selectedMean.y} x2={desired.x} y2={desired.y} />
          <text x={(selectedMean.x + desired.x) / 2 + 8} y={(selectedMean.y + desired.y) / 2 - 8}>
            mismatch ρ
          </text>
        </g>
      </svg>
      <figcaption>
        Conceptual schematic. The instrument below uses the same deterministic candidate set and reports
        the actual residual for the displayed selection.
      </figcaption>
    </figure>
  )
}

function ReplayInstrument({
  evidenceLens,
  onOpenEvidence,
}: {
  evidenceLens: boolean
  onOpenEvidence: (claimId: string) => void
}) {
  const [method, setMethod] = useState<ReplayMethod>('greedy')
  const [candidateCount, setCandidateCount] = useState(3)
  const [seed, setSeed] = useState(23)
  const result = useMemo(
    () => selectReplayCandidates({ method, candidateCount, seed }),
    [candidateCount, method, seed],
  )

  const origin = { x: 130, y: 122 }
  const scale = 105
  const target = vectorEndpoint(REPLAY_TARGET, origin, scale)
  const selectionMean = vectorEndpoint(result.mean, origin, scale)

  return (
    <section className="replay-instrument" aria-labelledby="replay-instrument-title">
      <header>
        <div>
          <p>Operable conceptual model</p>
          <h3 id="replay-instrument-title">Correction-matching instrument</h3>
        </div>
        <output aria-live="polite">
          <span>Residual</span>
          {result.residual.toFixed(3)}
        </output>
      </header>

      <div className="instrument-body">
        <svg viewBox="0 0 390 245" role="img" aria-label="Interactive replay candidate selection">
          <g className="mechanism-grid">
            <line x1="28" y1={origin.y} x2="350" y2={origin.y} />
            <line x1={origin.x} y1="22" x2={origin.x} y2="220" />
          </g>
          {REPLAY_CANDIDATES.map((candidate) => {
            const endpoint = vectorEndpoint(candidate, origin, scale)
            const selected = result.selectedIds.includes(candidate.id)
            return (
              <g key={candidate.id} className={selected ? 'instrument-candidate is-selected' : 'instrument-candidate'}>
                <line x1={origin.x} y1={origin.y} x2={endpoint.x} y2={endpoint.y} />
                <circle cx={endpoint.x} cy={endpoint.y} r={selected ? 4.5 : 2.5} />
                <text x={endpoint.x + 6} y={endpoint.y - 5}>
                  {candidate.label}
                </text>
              </g>
            )
          })}
          <Arrow from={origin} to={target} className="vector-desired" />
          <Arrow from={origin} to={selectionMean} className="vector-selection" />
          <line
            className="instrument-residual"
            x1={selectionMean.x}
            y1={selectionMean.y}
            x2={target.x}
            y2={target.y}
          />
        </svg>

        <div className="instrument-controls">
          <fieldset>
            <legend>Selection rule</legend>
            <button
              type="button"
              aria-pressed={method === 'greedy'}
              onClick={() => setMethod('greedy')}
            >
              Greedy match
            </button>
            <button
              type="button"
              aria-pressed={method === 'random'}
              onClick={() => setMethod('random')}
            >
              Random subset
            </button>
          </fieldset>

          <label>
            Replay examples <strong>{candidateCount}</strong>
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={candidateCount}
              onChange={(event) => setCandidateCount(Number(event.target.value))}
            />
          </label>

          <button
            type="button"
            className="resample-action"
            disabled={method !== 'random'}
            onClick={() => setSeed((value) => value + 19)}
          >
            Resample random control
          </button>
        </div>
      </div>

      <p className="instrument-note">
        The model is intentionally small and deterministic. It demonstrates the subset-matching mechanism;
        it is not an empirical result.
        <EvidenceMarker claimId="er-framing" visible={evidenceLens} onOpen={onOpenEvidence} />
      </p>
    </section>
  )
}

const REPLAY_BEATS = [
  {
    id: 'question',
    label: 'Question',
    heading: 'What update would joint training have made?',
    body: 'Current-only learning is efficient, but it omits the contribution of previous tasks. Replay is useful only when it restores the right missing update.',
  },
  {
    id: 'tension',
    label: 'Constraint',
    heading: 'The candidate pool is larger than the replay budget.',
    body: 'A dense candidate mean can define the target, while the actual update is restricted to a small subset. The subset therefore becomes a real optimization object.',
  },
  {
    id: 'mechanism',
    label: 'Mechanism',
    heading: 'Choose examples whose mean gradient approaches the correction.',
    body: 'Greedy Ball Replay adds one candidate at a time, minimizing the residual mismatch that remains after each choice.',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    heading: 'The mechanism is judged by outcomes, not by mismatch alone.',
    body: 'The locked comparison reports paired final accuracy, loss, and forgetting, while the review record exposes the unresolved dense-baseline challenge.',
  },
  {
    id: 'frontier',
    label: 'Boundary',
    heading: 'The open question is practical value under stronger alternatives.',
    body: 'The scientific boundary is explicit: when does constrained subset selection justify its cost relative to dense replay or weighting?',
  },
]

function ReplayScene({
  reducedMotion,
  evidenceLens,
  onOpenEvidence,
  onOpenMonograph,
}: {
  reducedMotion: boolean
  evidenceLens: boolean
  onOpenEvidence: (claimId: string) => void
  onOpenMonograph: () => void
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const progress = useSectionProgress(sectionRef, reducedMotion)
  const activeBeatIndex =
    progress < 0.18 ? 0 : progress < 0.38 ? 1 : progress < 0.62 ? 2 : progress < 0.84 ? 3 : 4
  const paperState = progress >= 0.62

  return (
    <section
      ref={sectionRef}
      id="replay"
      className={paperState ? 'field-replay scroll-scene is-paper-state' : 'field-replay scroll-scene'}
      data-chapter="replay"
      aria-labelledby="replay-title"
    >
      <div className="scene-sticky replay-layout">
        <div className="replay-narrative">
          <p className="scene-index">03 / Scientific mechanism</p>
          <StatusLine entity={getEntity('experience-replay') as FieldEntity} />
          <h2 id="replay-title">Replay is not merely remembering data. It is choosing an update under constraints.</h2>

          <ol className="replay-beats" aria-label="Replay argument">
            {REPLAY_BEATS.map((beat, index) => (
              <li key={beat.id} className={index === activeBeatIndex ? 'is-active' : undefined}>
                <span>0{index + 1}</span>
                <div>
                  <small>{beat.label}</small>
                  <h3>{beat.heading}</h3>
                  <p>{beat.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="replay-actions">
            <button type="button" className="primary-action" onClick={onOpenMonograph}>
              Open full monograph <span aria-hidden="true">↗</span>
            </button>
            <EvidenceMarker claimId="er-review-boundary" visible={evidenceLens} onOpen={onOpenEvidence} />
          </div>
        </div>

        <div className="replay-visual">
          <ReplayMechanismFigure progress={progress} />
          <ReplayInstrument evidenceLens={evidenceLens} onOpenEvidence={onOpenEvidence} />

          <section className="outcome-ledger" aria-label="Locked outcome comparison">
            <header>
              <p>Empirical evidence / locked 10-seed comparison</p>
              <button type="button" onClick={() => onOpenEvidence('er-outcomes')}>
                Inspect source
              </button>
            </header>
            <dl>
              <div>
                <dt>Average accuracy</dt>
                <dd>+1.389 pp</dd>
                <span>[0.920, 1.858]</span>
              </div>
              <div>
                <dt>Average loss</dt>
                <dd>−0.0456</dd>
                <span>[−0.0673, −0.0239]</span>
              </div>
              <div>
                <dt>Forgetting</dt>
                <dd>−1.391 pp</dd>
                <span>[−1.945, −0.837]</span>
              </div>
            </dl>
            <p>GBR minus uniform-subset control on S-TinyImageNet / class-incremental; seeds 30–39.</p>
          </section>
        </div>
      </div>
    </section>
  )
}

function ContactScene() {
  return (
    <section id="contact" className="field-contact" data-chapter="contact" aria-labelledby="contact-title">
      <div className="contact-path" aria-hidden="true">
        {TRAJECTORY_ENTITIES.map((entityId, index) => (
          <span key={entityId} style={{ '--path-index': index }} />
        ))}
      </div>
      <div className="contact-copy">
        <p className="scene-index">04 / Resolution</p>
        <h2 id="contact-title">The useful conversation starts where the evidence ends.</h2>
        <p>
          For research collaboration, applied ML systems, or spatial-intelligence work, use the direct
          channel below. The papers, code, and review records remain available for inspection first.
        </p>
      </div>
      <div className="contact-actions">
        <a className="contact-primary" href="mailto:navish.kumar@unibas.ch">
          navish.kumar@unibas.ch
        </a>
        <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <a
          href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en"
          target="_blank"
          rel="noreferrer"
        >
          Google Scholar <span aria-hidden="true">↗</span>
        </a>
        <a href="/artifacts/resume.pdf" target="_blank" rel="noreferrer">
          Résumé PDF <span aria-hidden="true">↗</span>
        </a>
      </div>
      <footer>
        <span>Basel, Switzerland</span>
        <span>Research · systems · interaction</span>
      </footer>
    </section>
  )
}

function useDialogFocus(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const container = containerRef.current
    if (!container) {
      return undefined
    }

    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector))
    focusable[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, onClose, open])
}

function EvidenceDrawer({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const drawerRef = useRef<HTMLElement>(null)
  const claim = getEvidenceClaim(claimId)
  useDialogFocus(Boolean(claim), drawerRef, onClose)

  if (!claim) {
    return null
  }

  const sources = claim.sourceIds
    .map((sourceId) => getEvidenceSource(sourceId))
    .filter((source) => source !== undefined)

  return (
    <div className="overlay-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={drawerRef}
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>Evidence lens</p>
            <h2 id="evidence-drawer-title">Inspect the basis and the boundary.</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close evidence drawer">
            Close
          </button>
        </header>

        <section>
          <h3>Claim</h3>
          <p>{claim.claim}</p>
        </section>
        <section>
          <h3>What the evidence supports</h3>
          <p>{claim.supports}</p>
        </section>
        <section>
          <h3>What it does not establish</h3>
          <p>{claim.boundary}</p>
        </section>
        <section>
          <h3>Sources</h3>
          <div className="evidence-source-list">
            {sources.map((source) => (
              <a key={source.id} href={source.href} target="_blank" rel="noreferrer">
                <span>{source.label}</span>
                <small>
                  {source.kind} · verified {source.verifiedAt}
                </small>
              </a>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

function Equation({ tex, label }: { tex: string; label: string }) {
  const markup = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: true }),
    [tex],
  )
  return (
    <figure className="monograph-equation">
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function MonographOverlay({
  evidenceLens,
  onOpenEvidence,
  onClose,
}: {
  evidenceLens: boolean
  onOpenEvidence: (claimId: string) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocus(true, panelRef, onClose)

  return (
    <div className="monograph-backdrop" role="presentation" onMouseDown={onClose}>
      <article
        ref={panelRef}
        className="monograph-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monograph-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="monograph-panel-header">
          <div>
            <StatusLine entity={getEntity('experience-replay') as FieldEntity} />
            <h2 id="monograph-title">Experience Replay Through the Lens of Optimization</h2>
            <p>
              A scientific monograph organized as question → mechanism → evidence → boundary → frontier.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close research monograph">
            Close
          </button>
        </header>

        <nav className="monograph-local-nav" aria-label="Monograph sections">
          <a href="#monograph-question">Question</a>
          <a href="#monograph-mechanism">Mechanism</a>
          <a href="#monograph-evidence">Evidence</a>
          <a href="#monograph-limits">Limits</a>
          <a href="#monograph-artifacts">Artifacts</a>
        </nav>

        <section id="monograph-question" className="monograph-section">
          <p className="monograph-section-index">01 / Question</p>
          <h3>What should a replay update approximate?</h3>
          <p>
            Online continual learning cannot retrain on all previous data. Current-only learning is cheap
            but forgets, while a replay batch has limited size. The missing object is a precise description
            of what the constrained replay contribution should recover.
          </p>
        </section>

        <section id="monograph-mechanism" className="monograph-section">
          <p className="monograph-section-index">02 / Mechanism</p>
          <h3>Define the desired correction, then match it with a valid subset.</h3>
          <p>
            The stage objective identifies a dense minibatch target. The current minibatch already supplies
            part of that target; replay must supply the correction that remains. A valid replay subset is
            therefore evaluated by the distance between its mean gradient and that correction.
            <EvidenceMarker claimId="er-framing" visible={evidenceLens} onOpen={onOpenEvidence} />
          </p>
          <div className="equation-grid">
            <Equation
              tex="\\tau_t = g^{\\star,\\mathrm{mb}}_t - g^{\\mathrm{mb}}_{t,\\mathrm{cur}}"
              label="Desired replay correction"
            />
            <Equation
              tex="\\rho_t(S)=\\left\\lVert |S|^{-1}\\sum_{i\\in S}g_i-\\tau_t\\right\\rVert_2"
              label="Observable subset mismatch"
            />
          </div>
        </section>

        <section id="monograph-evidence" className="monograph-section monograph-evidence-section">
          <p className="monograph-section-index">03 / Evidence</p>
          <h3>Outcome confirmation on the locked S-TinyImageNet / CI configuration.</h3>
          <dl className="monograph-result-table">
            <div>
              <dt>Average accuracy</dt>
              <dd>+1.389 pp</dd>
              <span>95% CI [0.920, 1.858]</span>
            </div>
            <div>
              <dt>Average loss</dt>
              <dd>−0.0456</dd>
              <span>95% CI [−0.0673, −0.0239]</span>
            </div>
            <div>
              <dt>Forgetting</dt>
              <dd>−1.391 pp</dd>
              <span>95% CI [−1.945, −0.837]</span>
            </div>
          </dl>
          <p>
            Paired GBR minus uniform-subset result, seeds 30–39. The comparison tests whether the
            selection rule changes practical outcomes under a fixed configuration.
          </p>
          <button type="button" className="inline-evidence-action" onClick={() => onOpenEvidence('er-outcomes')}>
            Inspect source and scope
          </button>
        </section>

        <section id="monograph-limits" className="monograph-section">
          <p className="monograph-section-index">04 / Limits</p>
          <h3>The strongest unresolved challenge is not hidden.</h3>
          <p>
            The public review record asks whether the constrained subset problem remains practically
            compelling when dense gradient weighting is simpler or stronger. The current evidence shows
            that greedy choice improves over random down-sampling under the tested replay constraint; it
            does not establish a universal compute or memory advantage over dense alternatives.
          </p>
          <button
            type="button"
            className="inline-evidence-action"
            onClick={() => onOpenEvidence('er-review-boundary')}
          >
            Inspect review boundary
          </button>
        </section>

        <section id="monograph-artifacts" className="monograph-section">
          <p className="monograph-section-index">05 / Artifacts and frontier</p>
          <h3>The next scientific decision is sharply bounded.</h3>
          <p>
            Determine when subset selection earns its extra machinery relative to dense replay, and make
            that trade-off legible in the main argument rather than treating the replay constraint as an
            unquestioned convention.
          </p>
          <div className="monograph-artifacts">
            <a href="https://openreview.net/forum?id=4z7il66fFb" target="_blank" rel="noreferrer">
              Open review discussion <span aria-hidden="true">↗</span>
            </a>
            <a href="https://openreview.net/pdf?id=4z7il66fFb" target="_blank" rel="noreferrer">
              Open paper PDF <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </article>
    </div>
  )
}

export function FieldPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const evidenceId = searchParams.get('evidence')
  const monographOpen = location.pathname === '/research/experience-replay-optimization'
  const lastFocusRef = useRef<HTMLElement | null>(null)

  const [state, dispatch] = useReducer(
    fieldReducer,
    createInitialFieldState({
      evidenceLens: searchParams.get('lens') === 'evidence',
      reducedMotion: initialReducedMotion(),
    }),
  )

  const handleChapterChange = useCallback((chapterId: string) => {
    if (isFieldChapter(chapterId)) {
      dispatch({ type: 'ENTER_CHAPTER', chapter: chapterId })
    }
  }, [])

  useActiveChapter(CHAPTER_IDS, handleChapterChange)

  const openEvidence = useCallback(
    (claimId: string) => {
      lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const next = new URLSearchParams(searchParams)
      next.set('evidence', claimId)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const closeEvidence = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('evidence')
    setSearchParams(next, { replace: true })
    window.setTimeout(() => lastFocusRef.current?.focus(), 0)
  }, [searchParams, setSearchParams])

  const toggleEvidenceLens = useCallback(() => {
    const enabled = !state.evidenceLens
    dispatch({ type: 'SET_EVIDENCE_LENS', enabled })
    const next = new URLSearchParams(searchParams)
    if (enabled) {
      next.set('lens', 'evidence')
    } else {
      next.delete('lens')
      next.delete('evidence')
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, state.evidenceLens])

  const toggleReducedMotion = useCallback(() => {
    const enabled = !state.reducedMotion
    window.localStorage.setItem('field-reduced-motion', String(enabled))
    dispatch({ type: 'SET_REDUCED_MOTION', enabled })
  }, [state.reducedMotion])

  const openMonograph = useCallback(() => {
    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    navigate({
      pathname: '/research/experience-replay-optimization',
      search: location.search,
    })
  }, [location.search, navigate])

  const closeMonograph = useCallback(() => {
    navigate({ pathname: '/', search: location.search, hash: '#replay' })
    window.setTimeout(() => lastFocusRef.current?.focus(), 0)
  }, [location.search, navigate])

  useEffect(() => {
    const evidenceEnabled = searchParams.get('lens') === 'evidence'
    if (evidenceEnabled !== state.evidenceLens) {
      dispatch({ type: 'SET_EVIDENCE_LENS', enabled: evidenceEnabled })
    }
  }, [searchParams, state.evidenceLens])

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(state.reducedMotion)
    document.documentElement.dataset.fieldChapter = state.chapter
    return () => {
      delete document.documentElement.dataset.reducedMotion
      delete document.documentElement.dataset.fieldChapter
    }
  }, [state.chapter, state.reducedMotion])

  useEffect(() => {
    document.body.classList.toggle('has-field-overlay', Boolean(evidenceId || monographOpen))
    return () => document.body.classList.remove('has-field-overlay')
  }, [evidenceId, monographOpen])

  useEffect(() => {
    if (!location.hash || monographOpen) {
      return
    }
    const target = document.getElementById(location.hash.slice(1))
    window.setTimeout(() => target?.scrollIntoView({ block: 'start' }), 0)
  }, [location.hash, monographOpen])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }

      if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        toggleEvidenceLens()
        return
      }

      if (event.key === 'Escape') {
        if (evidenceId) {
          closeEvidence()
        } else if (monographOpen) {
          closeMonograph()
        }
        return
      }

      if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'k') {
        const index = CHAPTER_IDS.indexOf(state.chapter)
        const direction = event.key.toLowerCase() === 'j' ? 1 : -1
        const next = CHAPTER_IDS[clamp(index + direction, 0, CHAPTER_IDS.length - 1)]
        if (next) {
          event.preventDefault()
          scrollToChapter(next)
        }
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [closeEvidence, closeMonograph, evidenceId, monographOpen, state.chapter, toggleEvidenceLens])

  const focusEntity = useCallback((entityId: string | null) => {
    dispatch({ type: 'FOCUS_ENTITY', entityId })
  }, [])

  return (
    <div
      className={state.evidenceLens ? 'field-app evidence-lens-active' : 'field-app'}
      data-chapter={state.chapter}
    >
      <a className="field-skip-link" href="#entry">
        Skip to the research field
      </a>
      <PersistentField state={state} />
      <FieldHeader
        state={state}
        onToggleEvidence={toggleEvidenceLens}
        onToggleMotion={toggleReducedMotion}
      />

      <main>
        <EntryScene onOpenWork={() => scrollToChapter('proof')} />
        <TrajectoryScene
          reducedMotion={state.reducedMotion}
          evidenceLens={state.evidenceLens}
          onFocusEntity={focusEntity}
          onOpenEvidence={openEvidence}
        />
        <EvidenceThreshold
          evidenceLens={state.evidenceLens}
          onFocusEntity={focusEntity}
          onOpenEvidence={openEvidence}
          onOpenMonograph={openMonograph}
        />
        <ReplayScene
          reducedMotion={state.reducedMotion}
          evidenceLens={state.evidenceLens}
          onOpenEvidence={openEvidence}
          onOpenMonograph={openMonograph}
        />
        <ContactScene />
      </main>

      <p className="field-shortcuts" aria-hidden="true">
        E evidence · J/K chapters · Esc close
      </p>
      <div className="visually-hidden" aria-live="polite">
        Current chapter: {CHAPTER_LABELS[state.chapter]}
      </div>

      {monographOpen ? (
        <MonographOverlay
          evidenceLens={state.evidenceLens}
          onOpenEvidence={openEvidence}
          onClose={closeMonograph}
        />
      ) : null}
      {evidenceId ? <EvidenceDrawer claimId={evidenceId} onClose={closeEvidence} /> : null}
    </div>
  )
}
