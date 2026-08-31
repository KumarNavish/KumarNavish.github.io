import { useMemo, useState, type CSSProperties } from 'react'
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
import { CasePathProductExperience } from '../rebuilt/CasePathProductExperience'
import {
  GuidedMechanism,
  PROGRAMME_MOMENTS,
  ProgrammeStage,
  ProjectMechanism,
} from '../rebuilt/ProjectStages'
import { SpatialWorldExperience } from '../rebuilt/SpatialWorldExperience'
import './researchProgrammePages.css'

const PERIOD_LABELS: Record<WorkPeriod, string> = {
  foundations: 'Foundations',
  current: 'Current',
  frontier: 'Frontier',
}

const TYPE_LABELS: Record<WorkRegistryEntry['type'], string> = {
  paper: 'paper',
  system: 'system',
  experiment: 'experiment',
  direction: 'direction',
}

const RELATION_LABELS: Record<WorkRelation['kind'], string> = {
  'direct-methodological-inheritance': 'method inherited',
  'recurring-question': 'question recurs',
  'adjacent-application': 'adjacent application',
  'later-extension': 'later extension',
}

const QUESTIONS = [
  {
    number: '01',
    title: 'How does local structure become global behaviour?',
    body: 'Interaction networks, complex phases, and city micro-regions all ask what disappears when local relationships are averaged away.',
    ids: ['counterspeech-dynamics', 'normalized-gain-laplacians', 'extremal-gain-laplacian-bounds', 'urban-microregion-logistics'],
  },
  {
    number: '02',
    title: 'How can learning change without destructive interference?',
    body: 'Geometry, replay, low-rank adapters, and chronological data expose which changes remain possible—and which damage must be measured.',
    ids: ['square-root-natural-gradient', 'experience-replay-optimization', 'rank-feasibility', 'ticlm-replay-value'],
  },
  {
    number: '03',
    title: 'How should evidence constrain intelligent action?',
    body: 'The recurring demand is to keep interpretation, authority, failure, correction, and provenance visible rather than burying them in fluent output.',
    ids: ['counterspeech-dynamics', 'casepath'],
  },
  {
    number: '04',
    title: 'What should an intelligent interface become?',
    body: 'The frontier is a persistent environment where language changes explicit world state and situated agents act within inspectable boundaries.',
    ids: ['casepath', 'spatial-intelligence'],
  },
] as const

const MEMORY_MOMENTS = [
  {
    id: 'normalized-gain-laplacians',
    control: 'Break a cycle',
    title: 'One rotated relationship makes inconsistency visible everywhere it matters.',
    body: 'The cycle no longer closes. The operator changes. The smallest eigenvalue leaves zero. A local defect becomes a global certificate.',
    step: 4,
  },
  {
    id: 'experience-replay-optimization',
    control: 'Correct forgetting',
    title: 'Replay becomes useful only when its update counters the damage.',
    body: 'The stage exposes the unavailable joint-training update, the correction contributed by remembered examples, and the residual the buffer cannot express.',
    step: 5,
  },
  {
    id: 'casepath',
    control: 'Refuse the action',
    title: 'A plausible interpretation is held when current evidence does not permit action.',
    body: 'A conflicting source reopens an obligation. The deterministic gate refuses completion until an authoritative correction can be replayed.',
    step: 4,
  },
] as const

const TRAJECTORY_MODE_LABELS = {
  time: 'Time',
  questions: 'Questions',
  methods: 'Methods',
  systems: 'Systems',
  frontier: 'Frontier',
} as const

type TrajectoryMode = keyof typeof TRAJECTORY_MODE_LABELS
type PeriodFilter = 'all' | WorkPeriod
type StatusFilter = 'all' | ResearchStatus
type YearFilter = 'all' | number

const MODE_POSITIONS: Record<TrajectoryMode, Array<[number, number]>> = {
  time: [[7, 25], [18, 48], [29, 20], [39, 69], [49, 39], [60, 17], [70, 55], [80, 30], [88, 72], [94, 48]],
  questions: [[8, 18], [28, 16], [46, 22], [13, 68], [37, 57], [58, 65], [76, 59], [91, 71], [67, 24], [91, 22]],
  methods: [[9, 65], [24, 18], [39, 34], [54, 65], [70, 21], [85, 42], [71, 70], [91, 70], [43, 16], [15, 31]],
  systems: [[8, 70], [24, 70], [40, 70], [56, 70], [72, 70], [88, 70], [25, 18], [47, 18], [69, 18], [90, 18]],
  frontier: [[9, 74], [20, 67], [31, 60], [42, 53], [53, 46], [64, 39], [75, 32], [85, 24], [68, 73], [94, 12]],
}

function externalLink(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function ResearchStatus({ work }: { work: WorkRegistryEntry }) {
  return <span className={`programme-status ${statusClass(work.researchStatus)}`}>{work.researchStatusLabel}</span>
}

function EvidenceLink({ work, label = 'Evidence' }: { work: WorkRegistryEntry; label?: string }) {
  const evidence = work.evidence.find((item) => item.public)
  if (!evidence) return null
  if (externalLink(evidence.url)) {
    return <a href={evidence.url} target="_blank" rel="noreferrer">{label} ↗</a>
  }
  return <Link to={evidence.url}>{label} ↗</Link>
}

function GlobalPageIntro({
  title,
  body,
  aside,
}: {
  title: string
  body: string
  aside?: string
}) {
  return (
    <header className="programme-page-intro">
      <h1>{title}</h1>
      <div>
        <p>{body}</p>
        {aside ? <span>{aside}</span> : null}
      </div>
    </header>
  )
}

function HorizonSignal() {
  const horizons = [
    {
      period: 'foundations' as const,
      year: '2020—24',
      title: 'Make structure and geometry precise.',
      body: 'Interaction networks, gain Laplacians, spatial micro-regions, and natural-gradient optimisation.',
    },
    {
      period: 'current' as const,
      year: 'Now',
      title: 'Make adaptation and authority inspectable.',
      body: 'Replay correction, PEFT feasibility, temporal replay value, and CasePath.',
    },
    {
      period: 'frontier' as const,
      year: 'Next',
      title: 'Move intelligence into persistent worlds.',
      body: 'Language-to-world state, situated agents, tools, and spatial interfaces.',
    },
  ]

  return (
    <div className="horizon-signal" aria-label="Foundations, current work, and frontier">
      {horizons.map((horizon) => (
        <article key={horizon.period} className={`portfolio-period-card horizon-${horizon.period}`}>
          <span>{horizon.year}</span>
          <strong>{horizon.title}</strong>
          <p>{horizon.body}</p>
        </article>
      ))}
    </div>
  )
}

function MemoryStage() {
  const [activeId, setActiveId] = useState<(typeof MEMORY_MOMENTS)[number]['id']>(MEMORY_MOMENTS[0].id)
  const moment = MEMORY_MOMENTS.find((item) => item.id === activeId) ?? MEMORY_MOMENTS[0]
  const work = getWork(moment.id)

  return (
    <section className="memory-section" aria-labelledby="memory-title">
      <header>
        <span>Three moments to remember</span>
        <h2 id="memory-title">The difficult idea should become clear before the abstract is opened.</h2>
      </header>
      <div className="memory-selector" role="tablist" aria-label="Choose a scientific moment">
        {MEMORY_MOMENTS.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={item.id === activeId}
            className={item.id === activeId ? 'is-active' : ''}
            key={item.id}
            onClick={() => setActiveId(item.id)}
          >
            <span>{item.control}</span>
            <strong>{getWork(item.id).shortTitle}</strong>
          </button>
        ))}
      </div>
      <div className="memory-workbench">
        <div className="memory-mechanism" key={moment.id}>
          <ProjectMechanism workId={moment.id} step={moment.step} />
        </div>
        <div className="memory-copy">
          <span>{work.dateLabel} · {work.researchStatusLabel}</span>
          <h3>{moment.title}</h3>
          <p>{moment.body}</p>
          <Link to={work.route}>Open the complete explanation ↗</Link>
        </div>
      </div>
    </section>
  )
}

function CompactWorkIndex({ interactive = false }: { interactive?: boolean }) {
  const [activeId, setActiveId] = useState(WORK_REGISTRY[0].id)
  const active = getWork(activeId)

  if (interactive) {
    return (
      <div className="work-index-product">
        <aside className="work-index-rail" aria-label="Complete body of work">
          {WORK_REGISTRY.map((work, index) => (
            <button
              type="button"
              data-work-id={work.id}
              className={activeId === work.id ? 'work-index-entry is-active' : 'work-index-entry'}
              aria-pressed={activeId === work.id}
              key={work.id}
              onClick={() => setActiveId(work.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{work.shortTitle}</strong><small>{work.year} · {TYPE_LABELS[work.type]}</small></div>
              <ResearchStatus work={work} />
            </button>
          ))}
        </aside>
        <div className="work-index-stage" key={active.id}>
          <GuidedMechanism workId={active.id} compact />
          <div className="work-index-stage-footer">
            <div>
              <span>{active.question}</span>
              <p>{active.contribution}</p>
            </div>
            <Link to={active.route}>Enter this work ↗</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="compact-work-ledger" aria-label="Ten-work index">
      {WORK_REGISTRY.map((work, index) => (
        <Link key={work.id} to={work.route} data-work-id={work.id}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{work.shortTitle}</strong>
          <small>{work.year}</small>
          <ResearchStatus work={work} />
          <i aria-hidden="true">↗</i>
        </Link>
      ))}
    </div>
  )
}

export function PortfolioHomePage() {
  const current = WORK_REGISTRY.filter((work) => work.period === 'current')

  return (
    <div className="portfolio-product-page programme-home-page">
      <PortfolioHeader />
      <main>
        <section className="programme-hero" id="top">
          <div className="programme-hero-copy">
            <span>Navish Kumar · machine-learning researcher and systems builder</span>
            <h1>
              I study how intelligent systems change—
              <em>and how to keep that change visible.</em>
            </h1>
            <p>
              From mathematical structure and continual adaptation to evidence-grounded agents and
              spatial interfaces, the work asks what must remain inspectable before a system can be trusted.
            </p>
            <div className="programme-hero-actions">
              <Link to="/trajectory">Follow the trajectory</Link>
              <a href="mailto:navish.kumar@unibas.ch">navish.kumar@unibas.ch</a>
            </div>
          </div>
          <HorizonSignal />
        </section>

        <section className="home-living-field">
          <div className="home-living-field-head">
            <span>The research programme</span>
            <p>
              Six scientific objects. One recurring demand: show the structure, intervention,
              consequence, and boundary rather than asking the reader to trust a summary.
            </p>
          </div>
          <ProgrammeStage />
        </section>

        <MemoryStage />

        <section className="question-portals" aria-labelledby="question-portals-title">
          <header>
            <span>Enter through a question</span>
            <h2 id="question-portals-title">The work is easier to understand as a set of recurring problems than as a publication list.</h2>
          </header>
          <div>
            {QUESTIONS.map((question) => (
              <article key={question.number}>
                <span>{question.number}</span>
                <h3>{question.title}</h3>
                <p>{question.body}</p>
                <ul>
                  {question.ids.map((id) => {
                    const work = getWork(id)
                    return <li key={id}><Link to={work.route}>{work.shortTitle}</Link></li>
                  })}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="current-work-band" aria-labelledby="current-title">
          <header>
            <span>Working now</span>
            <h2 id="current-title">The current questions remain unfinished—and visible.</h2>
          </header>
          <div>
            {current.map((work) => (
              <Link key={work.id} to={work.route}>
                <ResearchStatus work={work} />
                <strong>{work.shortTitle}</strong>
                <p>{work.nextQuestion}</p>
                <i aria-hidden="true">↗</i>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-atlas-entry" aria-labelledby="atlas-entry-title">
          <div>
            <span>Complete atlas</span>
            <h2 id="atlas-entry-title">Ten works, available without competing for the opening moment.</h2>
            <p>Scan the full record here, or open the larger stage where each work receives its native explanatory grammar.</p>
            <Link to="/work">Open the complete work surface ↗</Link>
          </div>
          <CompactWorkIndex />
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

function relationRecords(work: WorkRegistryEntry) {
  const outgoing = work.relations.map((relation) => ({
    id: `out-${work.id}-${relation.targetId}-${relation.kind}`,
    direction: 'to' as const,
    relation,
    work: getWork(relation.targetId),
  }))
  const incoming = WORK_REGISTRY.flatMap((candidate) =>
    candidate.relations
      .filter((relation) => relation.targetId === work.id)
      .map((relation) => ({
        id: `in-${candidate.id}-${work.id}-${relation.kind}`,
        direction: 'from' as const,
        relation,
        work: candidate,
      })),
  )
  return [...incoming, ...outgoing]
}

function TrajectoryNodeMap({
  mode,
  works,
  selectedId,
  onSelect,
}: {
  mode: TrajectoryMode
  works: WorkRegistryEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const positions = MODE_POSITIONS[mode]
  const visibleIds = new Set(works.map((work) => work.id))

  return (
    <div className={`trajectory-node-map mode-${mode}`}>
      <svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        <path className="trajectory-spine" d="M70 470 C190 430 205 145 320 185 S465 510 550 356 S720 114 940 122" />
        {WORK_REGISTRY.flatMap((source, sourceIndex) =>
          source.relations.map((relation) => {
            const targetIndex = WORK_REGISTRY.findIndex((candidate) => candidate.id === relation.targetId)
            if (targetIndex < 0 || !visibleIds.has(source.id) || !visibleIds.has(relation.targetId)) return null
            const [x1, y1] = positions[sourceIndex]
            const [x2, y2] = positions[targetIndex]
            const active = selectedId === source.id || selectedId === relation.targetId
            return (
              <line
                key={`${source.id}-${relation.targetId}-${relation.kind}`}
                x1={x1 * 10}
                y1={y1 * 6.2}
                x2={x2 * 10}
                y2={y2 * 6.2}
                className={`relation-line relation-${relation.kind} ${active ? 'is-active' : ''}`}
              />
            )
          }),
        )}
      </svg>
      {WORK_REGISTRY.map((work, index) => {
        const [x, y] = positions[index]
        const visible = visibleIds.has(work.id)
        return (
          <button
            type="button"
            className={`trajectory-node period-${work.period} ${selectedId === work.id ? 'is-selected' : ''}`}
            style={{ '--trajectory-x': `${x}%`, '--trajectory-y': `${y}%` } as CSSProperties}
            aria-pressed={selectedId === work.id}
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            key={work.id}
            onClick={() => onSelect(work.id)}
          >
            <span>{work.year}</span>
            <strong>{work.shortTitle}</strong>
            <small>{work.researchStatusLabel}</small>
          </button>
        )
      })}
      {!selectedId ? (
        <div className="trajectory-overview-message">
          <span>{TRAJECTORY_MODE_LABELS[mode]} view</span>
          <strong>Select any work to illuminate its intellectual neighbours.</strong>
        </div>
      ) : null}
    </div>
  )
}

export function TrajectoryPage() {
  const [mode, setMode] = useState<TrajectoryMode>('time')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [year, setYear] = useState<YearFilter>('all')
  const [theme, setTheme] = useState('all')

  const years = useMemo(() => Array.from(new Set(WORK_REGISTRY.map((work) => work.year))).sort((a, b) => a - b), [])
  const themes = useMemo(() => Array.from(new Set(WORK_REGISTRY.flatMap((work) => work.themes))).sort(), [])
  const filtered = useMemo(
    () => WORK_REGISTRY.filter((work) =>
      (period === 'all' || work.period === period) &&
      (status === 'all' || work.researchStatus === status) &&
      (year === 'all' || work.year === year) &&
      (theme === 'all' || work.themes.includes(theme)),
    ),
    [period, status, year, theme],
  )
  const selected = selectedId ? getWork(selectedId) : null
  const relations = selected ? relationRecords(selected) : []

  const reset = () => {
    setPeriod('all')
    setStatus('all')
    setYear('all')
    setTheme('all')
    setSelectedId(null)
  }

  return (
    <div className="portfolio-product-page trajectory-programme-page">
      <PortfolioHeader />
      <main>
        <GlobalPageIntro
          title="The same research programme can be read through time, questions, methods, systems, or frontier direction."
          body="The nodes do not change. Their relationships do. Select a work to see which ideas it inherits, which questions recur, and what it makes possible next."
          aside="The map opens at programme level. No single project owns the trajectory."
        />

        <div className="trajectory-mode-switcher" role="tablist" aria-label="Trajectory organization">
          {Object.entries(TRAJECTORY_MODE_LABELS).map(([key, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? 'is-active' : ''}
              key={key}
              onClick={() => { setMode(key as TrajectoryMode); setSelectedId(null) }}
            >
              {label}
            </button>
          ))}
        </div>

        <details className="trajectory-filter-drawer">
          <summary>Filter the ten-work record</summary>
          <div className="trajectory-controls" aria-label="Trajectory filters">
            <label>Period<select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)}><option value="all">All periods</option>{WORK_PERIODS.map((item) => <option key={item} value={item}>{PERIOD_LABELS[item]}</option>)}</select></label>
            <label>Year<select value={String(year)} onChange={(event) => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">All statuses</option>{RESEARCH_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Theme<select value={theme} onChange={(event) => setTheme(event.target.value)}><option value="all">All themes</option>{themes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button type="button" onClick={reset}>Reset filters</button>
          </div>
        </details>

        <section className="trajectory-map-surface">
          <TrajectoryNodeMap mode={mode} works={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </section>

        <section className="trajectory-mobile-timeline" aria-label="Vertical chronological trajectory">
          {WORK_PERIODS.map((periodKey) => (
            <div key={periodKey}>
              <header><span>{PERIOD_LABELS[periodKey]}</span></header>
              {filtered.filter((work) => work.period === periodKey).map((work) => (
                <button type="button" className="trajectory-mobile-node" aria-pressed={selectedId === work.id} key={work.id} onClick={() => setSelectedId(work.id)}>
                  <span>{work.year}</span><strong>{work.shortTitle}</strong><small>{work.researchStatusLabel}</small>
                </button>
              ))}
            </div>
          ))}
        </section>

        {selected ? (
          <section className="trajectory-selected-work" aria-live="polite">
            <div className="trajectory-selected-stage"><ProjectMechanism workId={selected.id} step={3} /></div>
            <div className="trajectory-selected-copy">
              <div><ResearchStatus work={selected} /><span>{selected.dateLabel} · {TYPE_LABELS[selected.type]}</span></div>
              <h2>{selected.shortTitle}</h2>
              <p className="trajectory-selected-question">{selected.question}</p>
              <p>{selected.contribution}</p>
              <Link to={selected.route}>Open the complete work ↗</Link>
            </div>
            <div className="trajectory-relation-list">
              <span>Visible relationships</span>
              {relations.length ? relations.map((record) => (
                <Link key={record.id} to={record.work.route}>
                  <small>{record.direction === 'from' ? 'from' : 'toward'} · {RELATION_LABELS[record.relation.kind]}</small>
                  <strong>{record.work.shortTitle}</strong>
                  <p>{record.relation.note}</p>
                </Link>
              )) : <p>No explicit registry relationship is recorded.</p>}
            </div>
          </section>
        ) : (
          <section className="trajectory-programme-summary">
            {PROGRAMME_MOMENTS.map((moment, index) => (
              <article key={moment.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{moment.verb}</strong>
                <p>{moment.title}</p>
              </article>
            ))}
          </section>
        )}
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function WorkIndexPage() {
  return (
    <div className="portfolio-product-page complete-work-page">
      <PortfolioHeader />
      <main>
        <GlobalPageIntro
          title="Ten works. One active stage. No project is reduced to a thumbnail."
          body="Select a work from the index. Its own scientific object takes over the stage, the explanation advances one causal step at a time, and exact evidence remains one route away."
          aside="The index stays compact so the active idea has room to become clear."
        />
        <CompactWorkIndex interactive />
      </main>
      <PortfolioFooter />
    </div>
  )
}

const RESEARCH_CLUSTERS = [
  {
    index: 'I',
    title: 'Structure and geometry',
    question: 'How do local relationships determine the behaviour of a whole system?',
    established: 'Interaction evidence, normalized gain operators, extremal frustration bounds, urban micro-regions, and square-root natural-gradient geometry.',
    unresolved: 'How can the same structural discipline be carried into systems that must keep changing?',
    ids: ['counterspeech-dynamics', 'normalized-gain-laplacians', 'extremal-gain-laplacian-bounds', 'urban-microregion-logistics', 'square-root-natural-gradient'],
  },
  {
    index: 'II',
    title: 'Learning under change',
    question: 'Which changes remain possible without destroying useful behaviour?',
    established: 'Replay as update correction, rank as a feasible adaptation space, and chronological replay value under a fixed token budget.',
    unresolved: 'How should a learning system decide what evidence is still useful when the world and its authority both evolve?',
    ids: ['experience-replay-optimization', 'rank-feasibility', 'ticlm-replay-value'],
  },
  {
    index: 'III',
    title: 'Evidence and action',
    question: 'When should an intelligent system be allowed to act?',
    established: 'Typed evidence processes, deterministic action gates, replayable correction, and a persistent language-to-world state prototype.',
    unresolved: 'Can situated intelligent interfaces remain inspectable while their worlds, tools, agents, and evidence become richer?',
    ids: ['casepath', 'spatial-intelligence'],
  },
] as const

export function ResearchPage() {
  return (
    <div className="portfolio-product-page research-programme-page">
      <PortfolioHeader />
      <main>
        <GlobalPageIntro
          title="The publications are evidence of a longer argument."
          body="The programme moves from observing structure, through learning under change, toward systems whose interpretations and actions remain inspectable."
          aside="Exact status, venue, paper, code, limitation, and public evidence follow in the audit ledger."
        />

        <section className="research-clusters">
          {RESEARCH_CLUSTERS.map((cluster) => (
            <article key={cluster.index}>
              <div className="research-cluster-number">{cluster.index}</div>
              <div className="research-cluster-copy">
                <span>{cluster.title}</span>
                <h2>{cluster.question}</h2>
                <dl>
                  <div><dt>What was established</dt><dd>{cluster.established}</dd></div>
                  <div><dt>What remained unresolved</dt><dd>{cluster.unresolved}</dd></div>
                </dl>
              </div>
              <div className="research-cluster-works">
                {cluster.ids.map((id) => {
                  const work = getWork(id)
                  return (
                    <Link to={work.route} key={id}>
                      <span>{work.year}</span><strong>{work.shortTitle}</strong><ResearchStatus work={work} />
                    </Link>
                  )
                })}
              </div>
            </article>
          ))}
        </section>

        <section className="research-audit-ledger" aria-labelledby="research-ledger-title">
          <header><span>Audit record</span><h2 id="research-ledger-title">Exact status and public evidence</h2></header>
          <div>
            {WORK_REGISTRY.filter((work) => work.type === 'paper' || work.type === 'experiment').map((work) => (
              <article key={work.id}>
                <div className="research-ledger-meta"><span>{work.dateLabel}</span><ResearchStatus work={work} /></div>
                <h3><Link to={work.route}>{work.title}</Link></h3>
                <p>{work.question}</p>
                <dl>
                  <div><dt>Contribution</dt><dd>{work.contribution}</dd></div>
                  <div><dt>Boundary</dt><dd>{work.limitation}</dd></div>
                </dl>
                <div className="research-ledger-links"><EvidenceLink work={work} label="Primary record" /><Link to={work.route}>Interactive explanation ↗</Link></div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function SystemsPage() {
  return (
    <div className="portfolio-product-page systems-programme-page">
      <PortfolioHeader />
      <main>
        <GlobalPageIntro
          title="CasePath began with a practical failure: a plausible interpretation could outrun the evidence required to act."
          body="The system gives that failure a durable representation—source-grounded assertions, unresolved obligations, deterministic gates, exact replay, and correction that propagates."
          aside="Operate the failure-and-correction path below."
        />

        <CasePathProductExperience embedded />

        <section className="system-proof-ledger">
          <header><span>Product and engineering evidence</span><h2>Consequential decisions—not a generic architecture diagram.</h2></header>
          <div>
            <article><span>Model boundary</span><strong>Models propose interpretations; the kernel computes admission.</strong><p>This keeps fluent output separate from operational authority.</p></article>
            <article><span>Failure contract</span><strong>Conflict, missing evidence, and unresolved obligations produce HOLD or REFUSE.</strong><p>Failure remains actionable state rather than prose.</p></article>
            <article><span>Correction</span><strong>Append-only evidence and typed dependencies support scoped replay.</strong><p>A changed source updates only the process that depends on it.</p></article>
            <article><span>Verification</span><strong>Terminal packets are hash-bound and independently checkable.</strong><p>Downstream users can inspect how an action became admissible.</p></article>
          </div>
        </section>

        <section className="portfolio-infrastructure-proof">
          <div>
            <span>Implementation evidence</span>
            <h2>The portfolio itself uses the same discipline.</h2>
            <p>A typed work registry generates canonical routes, metadata, status records, deep links, and browser acceptance across desktop, mobile, reduced motion, and persistent world-state interactions.</p>
          </div>
          <dl>
            <div><dt>Source of truth</dt><dd>typed ten-work registry</dd></div>
            <div><dt>Release</dt><dd>generated static route documents</dd></div>
            <div><dt>QA</dt><dd>Playwright interaction and overflow gates</dd></div>
            <div><dt>Scientific integrity</dt><dd>status and boundary audit</dd></div>
          </dl>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function FrontierPage() {
  const temporal = getWork('ticlm-replay-value')
  return (
    <div className="portfolio-product-page frontier-programme-page">
      <PortfolioHeader />
      <main>
        <GlobalPageIntro
          title="What changes when intelligence stops living in an answer box?"
          body="Two current directions test that question from different sides: when old information remains useful over time, and how language can edit a persistent spatial world."
          aside="The world prototype is deterministic and 2.5D today; its state, relations, edits, and agent actions are real."
        />

        <section className="frontier-world-section">
          <SpatialWorldExperience embedded />
        </section>

        <section className="frontier-temporal-section">
          <div className="frontier-temporal-copy">
            <ResearchStatus work={temporal} />
            <span>TiC-LM · temporal replay value</span>
            <h2>Old data can preserve a capability—or make the present harder to learn.</h2>
            <p>{temporal.explanation15}</p>
            <Link to={temporal.route}>Open the temporal replay experiment ↗</Link>
          </div>
          <div className="frontier-temporal-stage"><GuidedMechanism workId={temporal.id} compact /></div>
        </section>

        <section className="frontier-thesis">
          <span>Direction</span>
          <p>
            The common frontier is persistent state: a learning system should remember only what still has value,
            and an interface should let people inspect what changed rather than receiving disconnected outputs.
          </p>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

const ARC = [
  { year: '2020', title: 'Observe interaction', body: 'I began by studying social interactions that were difficult to describe without collapsing their context.' },
  { year: '2020—21', title: 'Formalise consistency', body: 'Graph theory made local agreement and global imbalance precise through gain Laplacians, spectra, and frustration.' },
  { year: '2024', title: 'Let geometry shape learning', body: 'Natural-gradient optimisation showed that representation changes not only numerical behaviour, but what can be proved.' },
  { year: '2025—26', title: 'Expose interference', body: 'Continual learning turned the same concern into an update problem: what must remain stable while a useful model changes?' },
  { year: 'Now', title: 'Bind action to evidence', body: 'CasePath carries that discipline into operational systems where interpretation, authority, failure, correction, and replay must remain separate.' },
  { year: 'Next', title: 'Build persistent interfaces', body: 'Spatial computing is where I am testing what an intelligent interface becomes when language edits an inhabited, inspectable world.' },
]

export function AboutPage() {
  return (
    <div className="portfolio-product-page about-programme-page">
      <PortfolioHeader />
      <main>
        <GlobalPageIntro
          title="The work has changed domains. The underlying demand has remained surprisingly stable."
          body="I am drawn to systems where local choices produce consequences that are difficult to see—and where better structure, evidence, or interfaces can make those consequences inspectable."
          aside="Basel, Switzerland · PhD research in machine learning · theory, experiments, systems, and interaction."
        />

        <section className="about-intellectual-arc">
          {ARC.map((item, index) => (
            <article key={item.year}>
              <span>{item.year}</span>
              <div className="about-arc-node"><i /><small>{String(index + 1).padStart(2, '0')}</small></div>
              <div><h2>{item.title}</h2><p>{item.body}</p></div>
            </article>
          ))}
        </section>

        <section className="about-working-style">
          <div>
            <span>How I work</span>
            <h2>I move between proof, experiment, product decision, and interface until the real failure becomes visible.</h2>
          </div>
          <div>
            <p>I prefer difficult questions with a falsifiable core, consequential boundaries, and enough technical depth that the eventual interface cannot be separated from the method.</p>
            <p>The best collaborations combine scientific disagreement, direct construction, ruthless evidence checks, and the willingness to discard an elegant story when the mechanism does not survive.</p>
          </div>
        </section>

        <section className="about-contact-conclusion">
          <p>Research, systems, and spatial interfaces are currently converging around one question: how can intelligent systems become more capable without becoming less inspectable?</p>
          <div>
            <a href="mailto:navish.kumar@unibas.ch">Email</a>
            <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Scholar ↗</a>
            <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">OpenReview ↗</a>
          </div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
