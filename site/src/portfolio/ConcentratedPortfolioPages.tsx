import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import {
  RESEARCH_STATUSES,
  WORK_PERIODS,
  WORK_REGISTRY,
  getWork,
  statusClass,
  type ResearchStatus,
  type WorkPeriod,
  type WorkRegistryEntry,
  type WorkRelation,
} from '../data/workRegistry'
import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import { WorkPreview } from './WorkPreview'
import './concentratedPortfolio.css'

const PERIOD_LABELS: Record<WorkPeriod, string> = {
  foundations: 'Foundations',
  current: 'Current work',
  frontier: 'Frontier',
}

const TYPE_LABELS: Record<WorkRegistryEntry['type'], string> = {
  paper: 'Paper',
  system: 'System',
  experiment: 'Experiment',
  direction: 'Direction',
}

const RELATION_LABELS: Record<WorkRelation['kind'], string> = {
  'direct-methodological-inheritance': 'method inherited',
  'recurring-question': 'question recurs',
  'adjacent-application': 'adjacent application',
  'later-extension': 'later extension',
}

const PROGRAMME_STEPS = [
  {
    workId: 'counterspeech-dynamics',
    verb: 'Observe',
    title: 'Make the interaction system visible.',
    takeaway:
      'Before proposing an intervention, identify what can actually be observed and where the evidence stops.',
  },
  {
    workId: 'normalized-gain-laplacians',
    verb: 'Formalise',
    title: 'Turn local relationships into global structure.',
    takeaway:
      'A mathematical operator can expose when locally plausible relationships fail to agree around a cycle.',
  },
  {
    workId: 'square-root-natural-gradient',
    verb: 'Reparameterise',
    title: 'Let geometry change the learning path.',
    takeaway:
      'The representation of an update is not cosmetic: it can determine whether optimisation is stable and provable.',
  },
  {
    workId: 'experience-replay-optimization',
    verb: 'Correct',
    title: 'Make interference measurable.',
    takeaway:
      'Replay matters when remembered examples reconstruct the update that current-only learning is missing.',
  },
  {
    workId: 'casepath',
    verb: 'Constrain',
    title: 'Separate interpretation from authority.',
    takeaway:
      'A model may propose meaning; an inspectable kernel must still decide whether the evidence permits action.',
  },
  {
    workId: 'spatial-intelligence',
    verb: 'Inhabit',
    title: 'Move intelligence into persistent world state.',
    takeaway:
      'Language should edit an existing environment that people and agents can inspect, manipulate, and revisit.',
  },
] as const

const QUESTION_PORTALS = [
  {
    title: 'How does local structure become global behaviour?',
    summary:
      'From real interaction networks to gain-graph operators, the recurring move is to make local relationships legible at system scale.',
    workIds: [
      'counterspeech-dynamics',
      'normalized-gain-laplacians',
      'extremal-gain-laplacian-bounds',
      'urban-microregion-logistics',
    ],
  },
  {
    title: 'How can learning change without destructive interference?',
    summary:
      'Geometry, replay, low-rank correction spaces, and chronological training all ask which changes should remain possible—and which damage must be exposed.',
    workIds: [
      'square-root-natural-gradient',
      'experience-replay-optimization',
      'rank-feasibility',
      'ticlm-replay-value',
    ],
  },
  {
    title: 'How should evidence constrain intelligent action?',
    summary:
      'Observable sources, bounded assertions, unresolved obligations, and deterministic gates make refusal as important as completion.',
    workIds: ['counterspeech-dynamics', 'urban-microregion-logistics', 'casepath'],
  },
  {
    title: 'What should an intelligent interface become?',
    summary:
      'The frontier is not another answer box. It is a persistent environment where language changes state and situated agents act inside explicit boundaries.',
    workIds: ['casepath', 'spatial-intelligence'],
  },
] as const

const TRAJECTORY_POSITIONS = [
  [7, 53],
  [18, 22],
  [33, 69],
  [44, 34],
  [58, 16],
  [68, 51],
  [83, 26],
  [92, 62],
  [73, 79],
  [45, 82],
] as const

type TrajectoryMode = 'time' | 'questions' | 'methods' | 'systems' | 'frontier'
type PeriodFilter = 'all' | WorkPeriod
type StatusFilter = 'all' | ResearchStatus
type YearFilter = 'all' | number

type RelationRecord = {
  id: string
  direction: 'from' | 'to'
  work: WorkRegistryEntry
  relation: WorkRelation
}

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

function externalLink(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function ResearchStatusBadge({ work }: { work: WorkRegistryEntry }) {
  return (
    <span className={`authorship-status ${statusClass(work.researchStatus)}`}>
      {work.researchStatusLabel}
    </span>
  )
}

function EvidenceSignal({ work, compact = false }: { work: WorkRegistryEntry; compact?: boolean }) {
  const evidence = work.evidence.find((item) => item.public)
  if (!evidence) return <span className="authorship-evidence">Evidence record pending</span>

  const content = (
    <>
      <span>{evidence.label}</span>
      {compact ? null : <small>{evidence.note}</small>}
    </>
  )

  if (externalLink(evidence.url)) {
    return (
      <a className="authorship-evidence" href={evidence.url} target="_blank" rel="noreferrer">
        {content}
        <i aria-hidden="true">↗</i>
      </a>
    )
  }

  return (
    <Link className="authorship-evidence" to={evidence.url}>
      {content}
      <i aria-hidden="true">↗</i>
    </Link>
  )
}

function PageIntro({
  title,
  body,
  side,
}: {
  title: string
  body: string
  side?: ReactNode
}) {
  return (
    <section className="authorship-page-intro">
      <div>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      {side ? <div className="authorship-page-intro-side">{side}</div> : null}
    </section>
  )
}

function ProgrammeCanvas({ activePeriod = null }: { activePeriod?: WorkPeriod | null }) {
  const nodes = [
    { x: 68, y: 164, label: 'interaction', period: 'foundations' },
    { x: 176, y: 82, label: 'structure', period: 'foundations' },
    { x: 304, y: 150, label: 'geometry', period: 'foundations' },
    { x: 432, y: 76, label: 'adaptation', period: 'current' },
    { x: 566, y: 154, label: 'authority', period: 'current' },
    { x: 692, y: 78, label: 'worlds', period: 'frontier' },
  ] as const

  return (
    <svg
      className="programme-canvas"
      viewBox="0 0 760 244"
      role="img"
      aria-label="Research programme moving from interaction evidence through structure, geometry, adaptation, authority, and persistent worlds"
    >
      <path
        className="programme-spine"
        d="M68 164 C118 164 126 82 176 82 S254 150 304 150 S382 76 432 76 S516 154 566 154 S642 78 692 78"
      />
      {nodes.map((node, index) => {
        const active = activePeriod === null || activePeriod === node.period
        return (
          <g
            key={node.label}
            className={active ? `programme-node period-${node.period} is-active` : `programme-node period-${node.period}`}
            transform={`translate(${node.x} ${node.y})`}
          >
            <circle r={index === 5 ? 14 : 11} />
            <circle className="programme-node-ring" r={index === 5 ? 23 : 19} />
            <text y={node.y > 120 ? 38 : -31} textAnchor="middle">
              {node.label}
            </text>
          </g>
        )
      })}
      <text x="68" y="223">observable relations</text>
      <text x="692" y="223" textAnchor="end">persistent intelligent interfaces</text>
    </svg>
  )
}

function EvolutionStage() {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const step = PROGRAMME_STEPS[index]
  const work = getWork(step.workId)

  useEffect(() => {
    if (!playing || reducedMotion) return undefined
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % PROGRAMME_STEPS.length),
      6200,
    )
    return () => window.clearInterval(timer)
  }, [playing, reducedMotion])

  const move = (delta: number) => {
    setPlaying(false)
    setIndex((current) => (current + delta + PROGRAMME_STEPS.length) % PROGRAMME_STEPS.length)
  }

  return (
    <section className="evolution-stage" aria-labelledby="evolution-title">
      <header className="evolution-heading">
        <div>
          <span>One question, changing shape</span>
          <h2 id="evolution-title">
            How can a complex system change without hiding what changed?
          </h2>
        </div>
        <p>
          Advance through six moments. Each step changes the scientific object, but preserves the
          same demand: expose structure, intervention, consequence, and boundary.
        </p>
      </header>

      <div className="evolution-workbench">
        <div className="evolution-preview" key={work.id}>
          <WorkPreview work={work} />
        </div>
        <div className="evolution-copy" aria-live="polite">
          <span className="evolution-index">
            {String(index + 1).padStart(2, '0')} / {String(PROGRAMME_STEPS.length).padStart(2, '0')}
          </span>
          <strong>{step.verb}</strong>
          <h3>{step.title}</h3>
          <p>{step.takeaway}</p>
          <Link to={work.route}>Open {work.shortTitle} ↗</Link>
        </div>
      </div>

      <div className="evolution-transport" aria-label="Research trajectory controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous research moment">
          Previous
        </button>
        <button
          type="button"
          onClick={() => setPlaying((current) => !current)}
          aria-pressed={playing && !reducedMotion}
          disabled={reducedMotion}
        >
          {reducedMotion ? 'Motion reduced' : playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => move(1)} aria-label="Next research moment">
          Next
        </button>
      </div>

      <div className="evolution-scrubber" role="tablist" aria-label="Research programme moments">
        {PROGRAMME_STEPS.map((item, itemIndex) => (
          <button
            type="button"
            role="tab"
            aria-selected={itemIndex === index}
            className={itemIndex === index ? 'is-active' : ''}
            key={item.workId}
            onClick={() => {
              setPlaying(false)
              setIndex(itemIndex)
            }}
          >
            <span>{String(itemIndex + 1).padStart(2, '0')}</span>
            <strong>{item.verb}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

function CompactAtlasEntry({
  work,
  selected = false,
  asButton = false,
  onSelect,
}: {
  work: WorkRegistryEntry
  selected?: boolean
  asButton?: boolean
  onSelect?: () => void
}) {
  const content = (
    <>
      <span className="atlas-entry-year">{work.year}</span>
      <span className="atlas-entry-title">{work.shortTitle}</span>
      <ResearchStatusBadge work={work} />
      <span className="atlas-entry-arrow" aria-hidden="true">↗</span>
    </>
  )

  if (asButton) {
    return (
      <button
        type="button"
        className={selected ? 'compact-atlas-entry is-selected' : 'compact-atlas-entry'}
        onClick={onSelect}
        aria-pressed={selected}
        data-work-id={work.id}
      >
        {content}
      </button>
    )
  }

  return (
    <Link className="compact-atlas-entry" to={work.route} data-work-id={work.id}>
      {content}
    </Link>
  )
}

export function PortfolioHomePage() {
  const [activePeriod, setActivePeriod] = useState<WorkPeriod | null>(null)
  const [activePortal, setActivePortal] = useState(0)
  const portal = QUESTION_PORTALS[activePortal]
  const currentWorks = WORK_REGISTRY.filter((work) => work.period === 'current')
  const periodRepresentatives: Record<WorkPeriod, WorkRegistryEntry> = {
    foundations: getWork('normalized-gain-laplacians'),
    current: getWork('experience-replay-optimization'),
    frontier: getWork('spatial-intelligence'),
  }
  const activeRepresentative = activePeriod ? periodRepresentatives[activePeriod] : null

  return (
    <div className="portfolio-product-page concentrated-portfolio-page">
      <PortfolioHeader />
      <main>
        <section className="authorship-hero" id="top">
          <div className="authorship-identity">
            <p className="authorship-role">
              Navish Kumar · machine-learning researcher and systems builder
            </p>
            <h1>
              I study how intelligent systems should change—without becoming impossible to
              understand.
            </h1>
            <p className="authorship-thesis">
              The work moves from interaction networks and mathematical structure to continual
              adaptation, evidence-bound agents, and persistent spatial worlds. The unifying goal
              is simple: make difficult systems inspectable before asking people to trust them.
            </p>
            <div className="authorship-actions">
              <Link className="portfolio-button is-primary" to="/trajectory">
                Explore the trajectory
              </Link>
              <Link className="portfolio-button" to="/work">
                Inspect the work
              </Link>
              <a className="portfolio-button" href="mailto:navish.kumar@unibas.ch">
                Contact
              </a>
            </div>
            <p className="authorship-domain-line">
              Mathematical learning · continual adaptation · evidence-grounded systems · spatial
              intelligence
            </p>
          </div>

          <div className="authorship-hero-stage">
            <div className="authorship-stage-head">
              <span>Live research programme</span>
              <button type="button" onClick={() => setActivePeriod(null)}>
                Programme view
              </button>
            </div>
            {activeRepresentative ? (
              <div className="authorship-stage-work" key={activeRepresentative.id}>
                <WorkPreview work={activeRepresentative} />
                <div>
                  <ResearchStatusBadge work={activeRepresentative} />
                  <strong>{activeRepresentative.shortTitle}</strong>
                  <p>{activeRepresentative.explanation15}</p>
                  <Link to={activeRepresentative.route}>Enter the work ↗</Link>
                </div>
              </div>
            ) : (
              <div className="authorship-stage-programme">
                <ProgrammeCanvas />
                <p>
                  One programme, six changing objects: relations, operators, geometry, updates,
                  evidence, and worlds.
                </p>
              </div>
            )}
            <div className="portfolio-period-signal" aria-label="Foundations, current work, and frontier">
              {WORK_PERIODS.map((period) => (
                <button
                  type="button"
                  key={period}
                  className={`portfolio-period-card period-${period}`}
                  aria-pressed={activePeriod === period}
                  onClick={() => setActivePeriod(period)}
                >
                  <span>{PERIOD_LABELS[period]}</span>
                  <strong>{periodRepresentatives[period].shortTitle}</strong>
                  <small>
                    {period === 'foundations'
                      ? 'structure and evidence'
                      : period === 'current'
                        ? 'learning and authority'
                        : 'persistent worlds'}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <EvolutionStage />

        <section className="question-portals" aria-labelledby="question-portals-title">
          <header>
            <div>
              <span>Choose an intellectual question</span>
              <h2 id="question-portals-title">Four ways into the same body of work.</h2>
            </div>
            <p>
              The portfolio is chronological only when chronology helps. Start from the question
              that matters to you, then follow the evidence across papers, systems, and prototypes.
            </p>
          </header>

          <div className="question-portal-layout">
            <div className="question-portal-list" role="tablist" aria-label="Intellectual questions">
              {QUESTION_PORTALS.map((item, index) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePortal === index}
                  className={activePortal === index ? 'is-active' : ''}
                  key={item.title}
                  onClick={() => setActivePortal(index)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>

            <div className="question-portal-stage" role="tabpanel" aria-live="polite">
              <p>{portal.summary}</p>
              <div>
                {portal.workIds.map((workId) => {
                  const work = getWork(workId)
                  return (
                    <Link to={work.route} key={work.id}>
                      <span>{work.year}</span>
                      <strong>{work.shortTitle}</strong>
                      <small>{work.researchStatusLabel}</small>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="current-state" aria-labelledby="current-state-title">
          <header>
            <div>
              <span>Current state</span>
              <h2 id="current-state-title">What is being revised, tested, and built now.</h2>
            </div>
            <Link to="/research">Open the exact research record ↗</Link>
          </header>
          <div className="current-state-list">
            {currentWorks.map((work) => (
              <Link to={work.route} key={work.id}>
                <ResearchStatusBadge work={work} />
                <strong>{work.shortTitle}</strong>
                <p>{work.nextQuestion}</p>
                <time dateTime={work.updatedAt}>Reviewed {work.updatedAt}</time>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-atlas-entry" aria-labelledby="home-atlas-title">
          <header>
            <div>
              <span>Complete atlas</span>
              <h2 id="home-atlas-title">Ten works, visible without ten full summaries.</h2>
            </div>
            <p>
              Scan the record here. Open the dedicated atlas for native previews, contribution
              statements, evidence, and direct routes.
            </p>
          </header>
          <div className="home-atlas-list">
            {WORK_REGISTRY.map((work) => (
              <CompactAtlasEntry work={work} key={work.id} />
            ))}
          </div>
          <Link className="portfolio-button is-primary" to="/work">
            Open the complete work atlas
          </Link>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

function incomingRelations(work: WorkRegistryEntry): RelationRecord[] {
  return WORK_REGISTRY.flatMap((candidate) =>
    candidate.relations
      .filter((relation) => relation.targetId === work.id)
      .map((relation) => ({
        id: `${candidate.id}-${work.id}-${relation.kind}`,
        direction: 'from' as const,
        work: candidate,
        relation,
      })),
  )
}

function relationRecords(work: WorkRegistryEntry): RelationRecord[] {
  const outgoing: RelationRecord[] = work.relations.map((relation) => ({
    id: `${work.id}-${relation.targetId}-${relation.kind}`,
    direction: 'to',
    work: getWork(relation.targetId),
    relation,
  }))
  const records = [...incomingRelations(work), ...outgoing]
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = `${record.work.id}-${record.relation.kind}-${record.direction}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function portalIndex(work: WorkRegistryEntry): number {
  const index = QUESTION_PORTALS.findIndex((portal) => (portal.workIds as readonly string[]).includes(work.id))
  return index < 0 ? QUESTION_PORTALS.length : index
}

function orderedForMode(works: WorkRegistryEntry[], mode: TrajectoryMode): WorkRegistryEntry[] {
  return [...works].sort((left, right) => {
    if (mode === 'time') return left.date.localeCompare(right.date)
    if (mode === 'questions') {
      return portalIndex(left) - portalIndex(right) || left.date.localeCompare(right.date)
    }
    if (mode === 'methods') {
      return left.previewKind.localeCompare(right.previewKind) || left.date.localeCompare(right.date)
    }
    if (mode === 'systems') {
      const weight = { system: 0, experiment: 1, paper: 2, direction: 3 }
      return weight[left.type] - weight[right.type] || left.date.localeCompare(right.date)
    }
    const periodWeight: Record<WorkPeriod, number> = { frontier: 0, current: 1, foundations: 2 }
    return periodWeight[left.period] - periodWeight[right.period] || right.date.localeCompare(left.date)
  })
}

function TrajectoryInspector({ selected }: { selected: WorkRegistryEntry | null }) {
  if (!selected) {
    return (
      <aside className="trajectory-inspector is-programme">
        <span>Programme view</span>
        <h2>No project is the default centre.</h2>
        <p>
          The trajectory begins with the whole programme. Select a node to inspect its question,
          contribution, evidence, limitation, and one deduplicated relation map.
        </p>
        <ProgrammeCanvas />
        <dl>
          <div>
            <dt>Foundations</dt>
            <dd>Interaction evidence, graph structure, geometry, and applied modelling.</dd>
          </div>
          <div>
            <dt>Current</dt>
            <dd>Replay, rank-constrained adaptation, temporal learning, and evidence-bound action.</dd>
          </div>
          <div>
            <dt>Frontier</dt>
            <dd>Persistent world state and situated intelligent interfaces.</dd>
          </div>
        </dl>
      </aside>
    )
  }

  const relations = relationRecords(selected)

  return (
    <aside className="trajectory-inspector" aria-live="polite">
      <div className="trajectory-inspector-meta">
        <ResearchStatusBadge work={selected} />
        <span>{selected.dateLabel}</span>
        <span>{TYPE_LABELS[selected.type]}</span>
      </div>
      <WorkPreview work={selected} />
      <h2>{selected.shortTitle}</h2>
      <p className="trajectory-inspector-question">{selected.question}</p>
      <p>{selected.contribution}</p>
      <div className="trajectory-inspector-facts">
        <div>
          <span>Evidence now</span>
          <p>{selected.evidenceAvailableNow}</p>
        </div>
        <div>
          <span>Boundary</span>
          <p>{selected.limitation}</p>
        </div>
        <div>
          <span>Question next</span>
          <p>{selected.nextQuestion}</p>
        </div>
      </div>
      <div className="trajectory-relation-list">
        <h3>Connections</h3>
        {relations.map((record) => (
          <button
            type="button"
            key={record.id}
            onClick={() => document.querySelector<HTMLElement>(`[data-trajectory-id="${record.work.id}"]`)?.click()}
          >
            <span>{record.direction === 'from' ? '← from' : 'to →'}</span>
            <strong>{record.work.shortTitle}</strong>
            <small>{RELATION_LABELS[record.relation.kind]}</small>
            <p>{record.relation.note}</p>
          </button>
        ))}
      </div>
      <Link className="portfolio-button is-primary" to={selected.route}>
        Open this work
      </Link>
    </aside>
  )
}

export function TrajectoryPage() {
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [year, setYear] = useState<YearFilter>('all')
  const [theme, setTheme] = useState('all')
  const [mode, setMode] = useState<TrajectoryMode>('time')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const years = useMemo(
    () => Array.from(new Set(WORK_REGISTRY.map((work) => work.year))).sort((a, b) => a - b),
    [],
  )
  const themes = useMemo(
    () => Array.from(new Set(WORK_REGISTRY.flatMap((work) => work.themes))).sort(),
    [],
  )
  const filtered = useMemo(
    () =>
      WORK_REGISTRY.filter(
        (work) =>
          (period === 'all' || work.period === period) &&
          (status === 'all' || work.researchStatus === status) &&
          (year === 'all' || work.year === year) &&
          (theme === 'all' || work.themes.includes(theme)),
      ),
    [period, status, theme, year],
  )
  const ordered = useMemo(() => orderedForMode(filtered, mode), [filtered, mode])
  const selected = selectedId ? WORK_REGISTRY.find((work) => work.id === selectedId) ?? null : null
  const selectedRelations = selected ? new Set(relationRecords(selected).map((record) => record.work.id)) : new Set<string>()

  const reset = () => {
    setPeriod('all')
    setStatus('all')
    setYear('all')
    setTheme('all')
    setSelectedId(null)
  }

  return (
    <div className="portfolio-product-page concentrated-portfolio-page trajectory-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          title="The evolution of a research programme."
          body="Browse the same ten works by time, recurring questions, methods, systems, or frontier direction. The nodes rearrange; the underlying evidence does not."
          side={
            <div className="trajectory-period-overview">
              {WORK_PERIODS.map((item) => (
                <span key={item} className={`period-${item}`}>
                  <strong>{WORK_REGISTRY.filter((work) => work.period === item).length}</strong>
                  {PERIOD_LABELS[item]}
                </span>
              ))}
            </div>
          }
        />

        <section className="trajectory-view-switch" aria-label="Trajectory organisation">
          {(['time', 'questions', 'methods', 'systems', 'frontier'] as TrajectoryMode[]).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? 'is-active' : ''}
              aria-pressed={mode === item}
              onClick={() => {
                setMode(item)
                setSelectedId(null)
              }}
            >
              {item === 'time' ? 'Time' : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </section>

        <section className="trajectory-controls" aria-label="Trajectory filters">
          <label>
            Period
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)}>
              <option value="all">All periods</option>
              {WORK_PERIODS.map((item) => (
                <option key={item} value={item}>
                  {PERIOD_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select
              value={String(year)}
              onChange={(event) =>
                setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))
              }
            >
              <option value="all">All years</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Research status
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              {RESEARCH_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Theme
            <select value={theme} onChange={(event) => setTheme(event.target.value)}>
              <option value="all">All themes</option>
              {themes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={reset}>
            Reset filters
          </button>
        </section>

        <section className="trajectory-product-surface">
          <div className={`trajectory-constellation mode-${mode}`} aria-label="Interactive research trajectory">
            <svg className="trajectory-connection-field" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={ordered
                  .map((_, index) => TRAJECTORY_POSITIONS[index] ?? TRAJECTORY_POSITIONS[TRAJECTORY_POSITIONS.length - 1])
                  .map(([x, y]) => `${x},${y}`)
                  .join(' ')}
              />
              {selected
                ? selected.relations.map((relation) => {
                    const fromIndex = ordered.findIndex((work) => work.id === selected.id)
                    const toIndex = ordered.findIndex((work) => work.id === relation.targetId)
                    if (fromIndex < 0 || toIndex < 0) return null
                    const [x1, y1] = TRAJECTORY_POSITIONS[fromIndex]
                    const [x2, y2] = TRAJECTORY_POSITIONS[toIndex]
                    return (
                      <line
                        key={`${selected.id}-${relation.targetId}-${relation.kind}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        className={`relation-${relation.kind}`}
                      />
                    )
                  })
                : null}
            </svg>

            <div className="trajectory-node-layer">
              {ordered.map((work, index) => {
                const [x, y] = TRAJECTORY_POSITIONS[index] ?? TRAJECTORY_POSITIONS[TRAJECTORY_POSITIONS.length - 1]
                const style = { '--node-x': `${x}%`, '--node-y': `${y}%` } as CSSProperties
                const selectedNode = selectedId === work.id
                const related = selectedRelations.has(work.id)
                return (
                  <button
                    type="button"
                    key={work.id}
                    style={style}
                    className={`trajectory-node period-${work.period}${selectedNode ? ' is-selected' : ''}${related ? ' is-related' : ''}`}
                    onClick={() => setSelectedId(work.id)}
                    aria-pressed={selectedNode}
                    data-trajectory-id={work.id}
                  >
                    <span>{work.year}</span>
                    <strong>{work.shortTitle}</strong>
                    <small>{work.researchStatusLabel} · {TYPE_LABELS[work.type]}</small>
                  </button>
                )
              })}
              {!ordered.length ? (
                <div className="trajectory-empty">
                  <strong>No work matches these filters.</strong>
                  <button type="button" onClick={reset}>Reset filters</button>
                </div>
              ) : null}
            </div>
          </div>

          <TrajectoryInspector selected={selected} />
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function WorkIndexPage() {
  const [selectedId, setSelectedId] = useState(WORK_REGISTRY[0].id)
  const selected = getWork(selectedId)

  return (
    <div className="portfolio-product-page concentrated-portfolio-page work-atlas-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          title="A compact atlas with depth on demand."
          body="All ten major works remain visible at once. Select one to change the active scientific object, then open its evidence and full route."
          side={<p>Equal access does not require identical cards. Each work keeps its native visual grammar.</p>}
        />

        <section className="work-atlas-surface">
          <div className="work-atlas-list" aria-label="Complete body of work">
            {WORK_REGISTRY.map((work) => (
              <CompactAtlasEntry
                work={work}
                key={work.id}
                asButton
                selected={work.id === selectedId}
                onSelect={() => setSelectedId(work.id)}
              />
            ))}
          </div>

          <article className={`work-atlas-stage preview-${selected.previewKind}`} aria-live="polite">
            <div className="work-atlas-stage-meta">
              <ResearchStatusBadge work={selected} />
              <span>{selected.dateLabel}</span>
              <span>{TYPE_LABELS[selected.type]}</span>
            </div>
            <WorkPreview work={selected} key={selected.id} />
            <div className="work-atlas-stage-copy">
              <h2>{selected.shortTitle}</h2>
              <p className="work-atlas-question">{selected.question}</p>
              <p>{selected.contribution}</p>
            </div>
            <div className="work-atlas-proof-row">
              <div>
                <span>What was established</span>
                <p>{selected.evidenceAvailableNow}</p>
              </div>
              <div>
                <span>What remains unresolved</span>
                <p>{selected.limitation}</p>
              </div>
            </div>
            <div className="work-atlas-stage-actions">
              <Link className="portfolio-button is-primary" to={selected.route}>
                Open the full work
              </Link>
              <EvidenceSignal work={selected} />
            </div>
          </article>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

const RESEARCH_CLUSTERS = [
  {
    title: 'Structure and geometry',
    explanation:
      'How do local relations become global operators, and how does geometry change what an optimiser can guarantee?',
    workIds: [
      'counterspeech-dynamics',
      'normalized-gain-laplacians',
      'extremal-gain-laplacian-bounds',
      'square-root-natural-gradient',
    ],
  },
  {
    title: 'Learning under change',
    explanation:
      'Which correction is missing, which adaptation space can represent it, and when does historical data help rather than become stale?',
    workIds: ['experience-replay-optimization', 'rank-feasibility', 'ticlm-replay-value'],
  },
  {
    title: 'Evidence and action',
    explanation:
      'How should observable evidence influence operational decisions without granting a generative model unbounded authority?',
    workIds: ['urban-microregion-logistics', 'casepath', 'spatial-intelligence'],
  },
] as const

export function ResearchPage() {
  const researchWorks = WORK_REGISTRY.filter((work) => work.type === 'paper' || work.type === 'experiment')

  return (
    <div className="portfolio-product-page concentrated-portfolio-page research-map-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          title="Research questions, results, and what each one made possible."
          body="The programme appears first as three connected questions. The exact publication and review ledger remains underneath as the audit layer."
          side={<Link to="/trajectory">See the same works in motion across time ↗</Link>}
        />

        <section className="research-cluster-map" aria-label="Research question clusters">
          {RESEARCH_CLUSTERS.map((cluster, index) => (
            <article key={cluster.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{cluster.title}</h2>
              <p>{cluster.explanation}</p>
              <div>
                {cluster.workIds.map((workId) => {
                  const work = getWork(workId)
                  return (
                    <Link to={work.route} key={work.id}>
                      <ResearchStatusBadge work={work} />
                      <strong>{work.shortTitle}</strong>
                      <p>{work.contribution}</p>
                      <small>{work.nextQuestion}</small>
                    </Link>
                  )
                })}
              </div>
            </article>
          ))}
        </section>

        <section className="research-ledger" aria-labelledby="research-ledger-title">
          <header>
            <div>
              <span>Audit record</span>
              <h2 id="research-ledger-title">Exact status, venue, evidence, and boundary.</h2>
            </div>
            <a
              href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en"
              target="_blank"
              rel="noreferrer"
            >
              Google Scholar ↗
            </a>
          </header>
          <div className="research-ledger-list">
            {researchWorks.map((work) => (
              <article key={work.id}>
                <time dateTime={work.date}>{work.dateLabel}</time>
                <div>
                  <ResearchStatusBadge work={work} />
                  <h3>{work.title}</h3>
                  <p>{work.venue}</p>
                </div>
                <div>
                  <span>Contribution</span>
                  <p>{work.contribution}</p>
                </div>
                <div>
                  <span>Boundary</span>
                  <p>{work.limitation}</p>
                </div>
                <div className="research-ledger-actions">
                  <Link to={work.route}>Open work ↗</Link>
                  <EvidenceSignal work={work} compact />
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

const CASEPATH_STEPS = [
  {
    label: 'Source enters',
    state: '2 observable sources',
    decision: 'Keep origin, scope, and retrieval time attached.',
    tone: 'neutral',
  },
  {
    label: 'Assertions proposed',
    state: '3 cited assertions',
    decision: 'The model may interpret; every assertion remains bounded by source spans.',
    tone: 'neutral',
  },
  {
    label: 'Conflict appears',
    state: '1 unresolved obligation',
    decision: 'The deterministic gate holds the workflow instead of smoothing over disagreement.',
    tone: 'hold',
  },
  {
    label: 'Correction propagates',
    state: '2 derived states invalidated',
    decision: 'A corrected source changes only the dependent assertions and downstream decisions.',
    tone: 'repair',
  },
  {
    label: 'Packet issued',
    state: 'replayable provenance',
    decision: 'Action is admitted only after the obligation is resolved and the certificate verifies.',
    tone: 'accept',
  },
] as const

function CasePathProof() {
  const [step, setStep] = useState(0)
  const current = CASEPATH_STEPS[step]

  return (
    <div className="casepath-proof">
      <div className="casepath-proof-flow" aria-label="CasePath deterministic workflow">
        {CASEPATH_STEPS.map((item, index) => (
          <button
            type="button"
            key={item.label}
            className={`${index <= step ? 'is-complete' : ''}${index === step ? ' is-current' : ''}`}
            onClick={() => setStep(index)}
            aria-pressed={index === step}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
      <div className={`casepath-proof-state tone-${current.tone}`} aria-live="polite">
        <span>Browser model of the workflow · not a claim about sealed outcomes</span>
        <strong>{current.state}</strong>
        <p>{current.decision}</p>
        <div>
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
            Previous
          </button>
          <button type="button" onClick={() => setStep((value) => Math.min(CASEPATH_STEPS.length - 1, value + 1))} disabled={step === CASEPATH_STEPS.length - 1}>
            Next decision
          </button>
          <button type="button" onClick={() => setStep(0)}>Restart</button>
        </div>
      </div>
    </div>
  )
}

export function SystemsPage() {
  const casePath = getWork('casepath')

  return (
    <div className="portfolio-product-page concentrated-portfolio-page systems-proof-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          title="A system should show why it acted—or why it refused."
          body="CasePath began with a practical failure: a model could produce a plausible interpretation without showing whether the evidence permitted anyone to act on it."
          side={<ResearchStatusBadge work={casePath} />}
        />

        <section className="systems-case-study">
          <header>
            <div>
              <span>Flagship operational system</span>
              <h2>CasePath: evidence-grounded claim handling.</h2>
            </div>
            <p>
              A source-grounded workflow separates generative interpretation from deterministic
              authority, preserves provenance, and makes correction replayable.
            </p>
          </header>

          <CasePathProof />

          <div className="systems-decision-grid">
            <article>
              <span>User and operational context</span>
              <h3>High-consequence claims cannot end at plausible text.</h3>
              <p>
                The product must show what was observed, what was inferred, what remains unresolved,
                and whether the next action is admissible.
              </p>
            </article>
            <article>
              <span>Product decision</span>
              <h3>Deterministic hold and refusal are first-class outcomes.</h3>
              <p>
                A model proposes interpretations and actions. Typed obligations and independent
                checks decide whether the workflow may continue.
              </p>
            </article>
            <article>
              <span>Engineering evidence</span>
              <h3>State, provenance, replay, correction, and recovery.</h3>
              <p>
                The system uses typed process-evidence graphs, append-only recovery, scoped
                invalidation, proof-carrying admission, and reproducible terminal packets.
              </p>
            </article>
          </div>

          <div className="systems-case-actions">
            <Link className="portfolio-button is-primary" to={casePath.route}>
              Inspect the CasePath chapter
            </Link>
            <EvidenceSignal work={casePath} />
          </div>
        </section>

        <section className="systems-proof-stack" aria-labelledby="systems-proof-stack-title">
          <header>
            <span>Implementation evidence</span>
            <h2 id="systems-proof-stack-title">The portfolio infrastructure is also inspectable.</h2>
          </header>
          <div>
            <article>
              <strong>Typed registry</strong>
              <p>Research status, website maturity, evidence, limitations, and relations remain separate.</p>
            </article>
            <article>
              <strong>Generated routes</strong>
              <p>Every major work has a static document, canonical metadata, and a restorable deep route.</p>
            </article>
            <article>
              <strong>Rendered acceptance</strong>
              <p>Desktop, mobile, reduced motion, interaction state, metadata, overflow, and browser errors are tested.</p>
            </article>
            <article>
              <strong>Verified deployment</strong>
              <p>The public GitHub Pages release is checked after deployment rather than inferred from a green build.</p>
            </article>
          </div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function FrontierPage() {
  const spatial = getWork('spatial-intelligence')
  const temporal = getWork('ticlm-replay-value')

  return (
    <div className="portfolio-product-page concentrated-portfolio-page frontier-direction-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          title="From answer boxes to persistent, inspectable worlds."
          body="The frontier joins two questions: when historical information remains useful, and how an intelligent interface should preserve state across actions rather than generate disconnected outputs."
          side={<Link to="/trajectory">See how the frontier grows from the current programme ↗</Link>}
        />

        <section className="frontier-dual-stage">
          <article>
            <div className="frontier-stage-meta">
              <ResearchStatusBadge work={temporal} />
              <span>Temporal intelligence</span>
            </div>
            <WorkPreview work={temporal} />
            <h2>{temporal.shortTitle}</h2>
            <p>{temporal.question}</p>
            <strong>Current threshold</strong>
            <p>{temporal.nextQuestion}</p>
            <Link to={temporal.route}>Open the ongoing experiment ↗</Link>
          </article>

          <article className="frontier-spatial-stage">
            <div className="frontier-stage-meta">
              <ResearchStatusBadge work={spatial} />
              <span>Current browser artifact</span>
            </div>
            <WorkPreview work={spatial} />
            <h2>Persistent semantic scene compiler</h2>
            <p>
              A truthful language-to-world-state prototype: browser speech or text becomes typed
              objects, relations, persistent edits, scene-state diffs, and situated agent actions.
            </p>
            <strong>Not yet claimed</strong>
            <p>
              Generated 3D assets, physics, 6DoF interaction, embodied policies, or foundation-model
              semantic parsing. Those remain the next implementation layer.
            </p>
            <Link to={spatial.route}>Operate the current prototype ↗</Link>
          </article>
        </section>

        <section className="frontier-sequence" aria-labelledby="frontier-sequence-title">
          <header>
            <span>The interaction thesis</span>
            <h2 id="frontier-sequence-title">Language should change an inhabited world.</h2>
          </header>
          <ol>
            <li><strong>Speak or type.</strong><span>The instruction remains visible.</span></li>
            <li><strong>Interpret explicitly.</strong><span>Objects, relations, goals, and unresolved language are inspectable.</span></li>
            <li><strong>Edit persistent state.</strong><span>Follow-up commands modify the same world rather than regenerate it.</span></li>
            <li><strong>Act inside boundaries.</strong><span>An agent uses only the tools and targets present in the current state.</span></li>
            <li><strong>Advance into space.</strong><span>Depth, camera, 6DoF manipulation, physics, and embodied policy are the next credible threshold.</span></li>
          </ol>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

const ABOUT_ARC = [
  {
    year: '2020',
    title: 'Interaction became an evidence problem.',
    body: 'I began by studying people whose behaviour was difficult to observe clearly inside a real social network.',
    route: '/work/counterspeech-dynamics',
  },
  {
    year: '2020–21',
    title: 'Graph theory made consistency precise.',
    body: 'Gain graphs turned local, orientation-sensitive relationships into operators, spectra, and explicit repair costs.',
    route: '/work/gain-graphs',
  },
  {
    year: '2024',
    title: 'Optimisation made representation consequential.',
    body: 'Square-root geometry showed that the form of an update can change both behaviour and what can be proved.',
    route: '/work/square-root-natural-gradient',
  },
  {
    year: '2025–26',
    title: 'Continual learning exposed the cost of change.',
    body: 'Replay, rank feasibility, and temporal data ask which corrections can be represented, selected, and kept useful over time.',
    route: '/work/experience-replay-optimization',
  },
  {
    year: '2026',
    title: 'Evidence became an authority boundary.',
    body: 'CasePath carries the same concern into operational systems: a plausible interpretation is not yet permission to act.',
    route: '/systems/casepath',
  },
  {
    year: 'Next',
    title: 'The interface becomes a persistent world.',
    body: 'Spatial computing is where I am testing what an inspectable, stateful intelligent interface could become.',
    route: '/frontier/spatial-intelligence',
  },
] as const

export function AboutPage() {
  return (
    <div className="portfolio-product-page concentrated-portfolio-page about-arc-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          title="One concern has followed the work: make change legible."
          body="I move between theory, experiments, systems, and interfaces because the same failure appears in each domain: a system changes, but the reason, consequence, or boundary remains hidden."
          side={<p>Basel, Switzerland · PhD research in machine learning · open to research and product conversations.</p>}
        />

        <section className="about-research-arc" aria-label="Autobiographical research arc">
          {ABOUT_ARC.map((item) => (
            <Link to={item.route} key={item.year}>
              <time>{item.year}</time>
              <div>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </section>

        <section className="about-collaboration" aria-labelledby="about-collaboration-title">
          <div>
            <span>How I work</span>
            <h2 id="about-collaboration-title">Precise about evidence. Restless about the interface.</h2>
          </div>
          <div>
            <p>
              I am most useful where a difficult technical object must become a method, a reliable
              system, and a product that another person can actually understand and operate.
            </p>
            <p>
              The collaboration fit is strongest around continual learning, optimisation,
              evidence-grounded agents, research engineering, scientific interfaces, and spatial
              intelligence.
            </p>
            <a className="portfolio-button is-primary" href="mailto:navish.kumar@unibas.ch">
              navish.kumar@unibas.ch
            </a>
          </div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
