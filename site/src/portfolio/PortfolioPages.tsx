import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  RESEARCH_STATUSES,
  WORK_PERIODS,
  WORK_REGISTRY,
  getRelatedWorks,
  getWork,
  statusClass,
  type ResearchStatus,
  type WorkPeriod,
  type WorkRegistryEntry,
  type WorkRelation,
} from '../data/workRegistry'
import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import { WorkPreview } from './WorkPreview'
import './portfolioPages.css'

const PERIOD_LABELS: Record<WorkPeriod, string> = {
  foundations: 'Foundations',
  current: 'Current research',
  frontier: 'Frontier',
}

const RELATION_LABELS: Record<WorkRelation['kind'], string> = {
  'direct-methodological-inheritance': 'Methodological inheritance',
  'recurring-question': 'Recurring question',
  'adjacent-application': 'Adjacent application',
  'later-extension': 'Later extension',
}

const TYPE_LABELS: Record<WorkRegistryEntry['type'], string> = {
  paper: 'Paper',
  system: 'System',
  experiment: 'Experiment',
  direction: 'Direction',
}

const FEATURED_WORK_IDS = [
  'experience-replay-optimization',
  'extremal-gain-laplacian-bounds',
  'casepath',
  'spatial-intelligence',
] as const

const HERO_WORK_IDS = [
  'normalized-gain-laplacians',
  'experience-replay-optimization',
  'spatial-intelligence',
] as const

const PROGRAMME_STAGES = [
  ['Observe', 'Make interaction systems measurable before intervening.'],
  ['Structure', 'Find operators that expose consistency, balance, and failure.'],
  ['Optimize', 'Turn geometry into behaviour that can be derived and tested.'],
  ['Adapt', 'Study what learning keeps, forgets, and interferes with.'],
  ['Value time', 'Decide when historical information remains worth replaying.'],
  ['Bound action', 'Separate model proposals from evidence and authority.'],
  ['Persist worlds', 'Let language edit a state that agents can actually inhabit.'],
] as const

function ArrowIcon() {
  return (
    <svg className="inline-arrow" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 9h10M9 5l4 4-4 4" />
    </svg>
  )
}

function externalLink(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function EvidenceLink({ evidence }: { evidence: WorkRegistryEntry['evidence'][number] }) {
  const content = (
    <>
      <span>{evidence.label}</span>
      <small>{evidence.note}</small>
    </>
  )
  if (!externalLink(evidence.url)) {
    return (
      <Link to={evidence.url} className="registry-evidence-link">
        {content}
      </Link>
    )
  }
  return (
    <a href={evidence.url} target="_blank" rel="noreferrer" className="registry-evidence-link">
      {content}
    </a>
  )
}

function StatusPair({ work }: { work: WorkRegistryEntry }) {
  return (
    <div className="registry-status-pair" aria-label="Research and website experience status">
      <span className={`registry-status ${statusClass(work.researchStatus)}`}>
        {work.researchStatusLabel}
      </span>
      <span className="registry-status status-experience">{work.experienceStatusLabel}</span>
    </div>
  )
}

function PageIntro({
  label,
  title,
  body,
  aside,
}: {
  label: string
  title: string
  body: string
  aside?: string
}) {
  return (
    <section className="portfolio-page-intro">
      <div>
        <p className="portfolio-section-label">{label}</p>
        <h1>{title}</h1>
      </div>
      <div className="portfolio-page-intro-copy">
        <p>{body}</p>
        {aside ? <span>{aside}</span> : null}
      </div>
    </section>
  )
}

function WorkLine({
  work,
  action = 'Open work',
  onInspect,
}: {
  work: WorkRegistryEntry
  action?: string
  onInspect?: (id: string) => void
}) {
  return (
    <article className="work-line" data-work-id={work.id}>
      <div className="work-line-index">
        <span>{work.year}</span>
        <small>{TYPE_LABELS[work.type]}</small>
      </div>
      <div className="work-line-copy">
        <h3>{work.shortTitle}</h3>
        <p>{work.question}</p>
      </div>
      <div className="work-line-state">
        <span>{work.researchStatusLabel}</span>
        <small>{PERIOD_LABELS[work.period]}</small>
      </div>
      <div className="work-line-actions">
        {onInspect ? (
          <button type="button" onClick={() => onInspect(work.id)}>
            Preview
          </button>
        ) : null}
        <Link to={work.route}>
          {action}
          <ArrowIcon />
        </Link>
      </div>
    </article>
  )
}

function ProgrammeRail() {
  return (
    <ol className="programme-rail" aria-label="Research programme from observation to persistent worlds">
      {PROGRAMME_STAGES.map(([title, description], index) => (
        <li key={title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PortfolioHomePage() {
  const heroWorks = HERO_WORK_IDS.map((id) => getWork(id))
  const featuredWorks = FEATURED_WORK_IDS.map((id) => getWork(id))
  const currentWorks = WORK_REGISTRY.filter((work) => work.period === 'current')
  const latestUpdate = [...WORK_REGISTRY].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0]
  const leadWork = featuredWorks[0]
  const supportingWorks = featuredWorks.slice(1)

  return (
    <div className="portfolio-product-page portfolio-home-page">
      <PortfolioHeader />
      <main>
        <section className="portfolio-home-hero" id="top">
          <div className="portfolio-home-identity">
            <h1>
              I study how learning systems preserve structure,
              <em> adapt through time, and act on evidence.</em>
            </h1>
            <p className="portfolio-home-thesis">
              Navish Kumar is a machine-learning researcher and systems builder in Basel. His work
              moves from spectral structure and optimization geometry to continual learning,
              reviewable agents, and persistent spatial worlds.
            </p>
            <div className="portfolio-home-actions">
              <Link className="portfolio-button is-primary" to="/trajectory">
                Follow the research trajectory
                <ArrowIcon />
              </Link>
              <Link className="portfolio-button" to="/work">
                Browse all work
                <ArrowIcon />
              </Link>
            </div>
            <div className="portfolio-home-facts" aria-label="Research profile">
              <span>Machine learning PhD · University of Basel</span>
              <span>Theory, optimization, continual learning, reliable agents</span>
              <span>Research code, interactive explanations, deployed systems</span>
            </div>
          </div>

          <aside className="portfolio-programme-summary" aria-label="Foundations, current research, and frontier">
            <header>
              <span>One programme, three horizons</span>
              <p>Each horizon asks the same question at a different level: what must remain visible before a system is trusted to act?</p>
            </header>
            <div className="portfolio-period-signal">
              {heroWorks.map((work) => (
                <Link key={work.id} to={work.route} className={`portfolio-period-card period-${work.period}`}>
                  <span>{PERIOD_LABELS[work.period]}</span>
                  <strong>{work.shortTitle}</strong>
                  <small>{work.question}</small>
                  <ArrowIcon />
                </Link>
              ))}
            </div>
          </aside>
        </section>

        <section className="portfolio-home-trajectory" aria-labelledby="home-trajectory-title">
          <header>
            <p className="portfolio-section-label">The research programme</p>
            <h2 id="home-trajectory-title">The connective tissue is more important than the categories.</h2>
            <p>
              The trajectory is not a chronology dressed as a story. It makes direct inheritance,
              recurring questions, adjacent applications, and later extensions explicit.
            </p>
          </header>
          <ProgrammeRail />
          <Link className="portfolio-text-link" to="/trajectory">
            Explore every work and relation
            <ArrowIcon />
          </Link>
        </section>

        <section className="portfolio-featured-work" aria-labelledby="home-featured-title">
          <header>
            <p className="portfolio-section-label">Selected work</p>
            <h2 id="home-featured-title">Four projects that expose the programme from different sides.</h2>
          </header>

          <article className="featured-lead" data-featured-work={leadWork.id}>
            <div className="featured-lead-copy">
              <div className="featured-meta">
                <span>{leadWork.dateLabel}</span>
                <span>{leadWork.researchStatusLabel}</span>
              </div>
              <h3>{leadWork.shortTitle}</h3>
              <p className="featured-question">{leadWork.question}</p>
              <p>{leadWork.contribution}</p>
              <Link className="portfolio-text-link" to={leadWork.route}>
                Open the full explanation
                <ArrowIcon />
              </Link>
            </div>
            <WorkPreview work={leadWork} className="featured-lead-preview" />
          </article>

          <div className="featured-supporting">
            {supportingWorks.map((work) => (
              <article key={work.id} data-featured-work={work.id}>
                <div className="featured-meta">
                  <span>{work.year}</span>
                  <span>{work.researchStatusLabel}</span>
                </div>
                <h3>{work.shortTitle}</h3>
                <p>{work.explanation15}</p>
                <Link to={work.route} aria-label={`Open ${work.shortTitle}`}>
                  Read the work
                  <ArrowIcon />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="portfolio-home-index" aria-labelledby="home-index-title">
          <header>
            <div>
              <p className="portfolio-section-label">Complete record</p>
              <h2 id="home-index-title">All ten works, without ten competing showcases.</h2>
            </div>
            <p>Scan the question and status here. Open depth only where it matters.</p>
          </header>
          <div className="work-line-list">
            {WORK_REGISTRY.map((work) => (
              <WorkLine key={work.id} work={work} />
            ))}
          </div>
        </section>

        <section className="portfolio-current-band" aria-labelledby="home-current-title">
          <div className="portfolio-current-heading">
            <p className="portfolio-section-label">Working now</p>
            <h2 id="home-current-title">The active questions remain visible.</h2>
            <p>
              Current work is presented as work in progress, with the next falsifiable question
              separated from the story already supported by evidence.
            </p>
          </div>
          <div className="portfolio-current-list">
            {currentWorks.map((work) => (
              <Link key={work.id} to={work.route}>
                <span>{work.researchStatusLabel}</span>
                <strong>{work.shortTitle}</strong>
                <p>{work.nextQuestion}</p>
                <ArrowIcon />
              </Link>
            ))}
          </div>
          <p className="portfolio-return-note">
            Registry reviewed {latestUpdate?.updatedAt}. Research status and website maturity are tracked independently.
          </p>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

type PeriodFilter = 'all' | WorkPeriod
type StatusFilter = 'all' | ResearchStatus
type YearFilter = 'all' | number

function incomingRelations(work: WorkRegistryEntry): Array<{ source: WorkRegistryEntry; relation: WorkRelation }> {
  return WORK_REGISTRY.flatMap((candidate) =>
    candidate.relations
      .filter((relation) => relation.targetId === work.id)
      .map((relation) => ({ source: candidate, relation })),
  )
}

function TrajectoryFocus({ work, onClose }: { work: WorkRegistryEntry; onClose: () => void }) {
  const outgoing = work.relations.map((relation) => ({ relation, target: getWork(relation.targetId) }))
  const incoming = incomingRelations(work)
  return (
    <article className="trajectory-inspector" aria-live="polite">
      <button className="trajectory-close" type="button" onClick={onClose}>
        Return to overview
      </button>
      <div className="trajectory-focus-grid">
        <div className="trajectory-focus-copy">
          <StatusPair work={work} />
          <span className="trajectory-inspector-date">{work.dateLabel} · {work.venue}</span>
          <h2>{work.shortTitle}</h2>
          <p className="trajectory-inspector-question">{work.question}</p>
          <p>{work.contribution}</p>
          <dl>
            <div><dt>Evidence now</dt><dd>{work.evidenceAvailableNow}</dd></div>
            <div><dt>Relation to earlier work</dt><dd>{work.relationToEarlierWork}</dd></div>
            <div><dt>Question next</dt><dd>{work.nextQuestion}</dd></div>
          </dl>
          <Link className="portfolio-button is-primary" to={work.route}>
            Open this work
            <ArrowIcon />
          </Link>
        </div>
        <WorkPreview work={work} className="trajectory-focus-preview" />
      </div>
      <div className="trajectory-connections">
        <section>
          <h3>Leads into this work</h3>
          {incoming.length ? incoming.map(({ source, relation }) => (
            <Link key={`${source.id}-${relation.kind}`} to={source.route}>
              <span>{RELATION_LABELS[relation.kind]}</span>
              <strong>{source.shortTitle}</strong>
              <p>{relation.note}</p>
            </Link>
          )) : <p>No earlier relation is asserted.</p>}
        </section>
        <section>
          <h3>Connects from this work</h3>
          {outgoing.length ? outgoing.map(({ target, relation }) => (
            <Link key={`${target.id}-${relation.kind}`} to={target.route}>
              <span>{RELATION_LABELS[relation.kind]}</span>
              <strong>{target.shortTitle}</strong>
              <p>{relation.note}</p>
            </Link>
          )) : <p>No later relation is asserted.</p>}
        </section>
      </div>
    </article>
  )
}

export function TrajectoryPage() {
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [year, setYear] = useState<YearFilter>('all')
  const [theme, setTheme] = useState('all')
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
    () => WORK_REGISTRY.filter((work) =>
      (period === 'all' || work.period === period) &&
      (status === 'all' || work.researchStatus === status) &&
      (year === 'all' || work.year === year) &&
      (theme === 'all' || work.themes.includes(theme)),
    ).sort((left, right) => left.date.localeCompare(right.date)),
    [period, status, year, theme],
  )
  const selected = selectedId && filtered.some((work) => work.id === selectedId)
    ? getWork(selectedId)
    : null

  const resetFilters = () => {
    setPeriod('all')
    setStatus('all')
    setYear('all')
    setTheme('all')
    setSelectedId(null)
  }

  return (
    <div className="portfolio-product-page trajectory-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          label="Research trajectory"
          title="Begin with the programme. Focus on a project only when you need its evidence."
          body="The overview preserves chronology without pretending that dates alone explain the work. Select a node to inspect its contribution, evidence boundary, predecessors, and successors."
          aside="Solid relation labels mean direct inheritance. The other labels identify recurrence, adjacency, or extension without inflating causality."
        />

        <details className="trajectory-filter-disclosure">
          <summary>Filter the trajectory</summary>
          <section className="trajectory-controls" aria-label="Trajectory filters">
            <label>
              Period
              <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)}>
                <option value="all">All periods</option>
                {WORK_PERIODS.map((item) => <option key={item} value={item}>{PERIOD_LABELS[item]}</option>)}
              </select>
            </label>
            <label>
              Year
              <select value={String(year)} onChange={(event) => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">All years</option>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Research status
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                <option value="all">All statuses</option>
                {RESEARCH_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                <option value="all">All themes</option>
                {themes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button type="button" onClick={resetFilters}>Reset filters</button>
          </section>
        </details>

        <section className="trajectory-product-surface">
          <header className="trajectory-overview-head">
            <div>
              <span>{filtered.length} of {WORK_REGISTRY.length} works visible</span>
              <strong>{selected ? `Focused on ${selected.shortTitle}` : 'Programme overview'}</strong>
            </div>
            <p>Select any node; the complete path remains visible while its local evidence opens below.</p>
          </header>

          <div className="trajectory-timeline" aria-label="Chronological research trajectory">
            {WORK_PERIODS.map((periodKey) => {
              const periodWorks = filtered.filter((work) => work.period === periodKey)
              if (!periodWorks.length) return null
              return (
                <section key={periodKey} className={`trajectory-period period-${periodKey}`}>
                  <header>
                    <span>{PERIOD_LABELS[periodKey]}</span>
                    <strong>{periodWorks.length} {periodWorks.length === 1 ? 'work' : 'works'}</strong>
                  </header>
                  <div className="trajectory-period-track">
                    {periodWorks.map((work, index) => (
                      <button
                        key={work.id}
                        type="button"
                        className={selected?.id === work.id ? 'trajectory-node is-selected' : 'trajectory-node'}
                        onClick={() => setSelectedId(work.id)}
                        aria-pressed={selected?.id === work.id}
                      >
                        <span className="trajectory-node-order">{String(index + 1).padStart(2, '0')}</span>
                        <span className="trajectory-node-year">{work.year}</span>
                        <strong>{work.shortTitle}</strong>
                        <small>{work.researchStatusLabel} · {TYPE_LABELS[work.type]}</small>
                        <p>{work.question}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
            {!filtered.length ? <p className="trajectory-empty">No works match these filters.</p> : null}
          </div>

          {selected ? (
            <TrajectoryFocus work={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <aside className="trajectory-overview-note">
              <span>Overview state</span>
              <h2>Seven recurring moves organise the programme.</h2>
              <ProgrammeRail />
            </aside>
          )}
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

type WorkTypeFilter = 'all' | WorkRegistryEntry['type']

export function WorkIndexPage() {
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<WorkTypeFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(
    () => WORK_REGISTRY.filter((work) => {
      const matchesQuery = !normalizedQuery || [
        work.title,
        work.shortTitle,
        work.question,
        work.contribution,
        ...work.themes,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
      return matchesQuery &&
        (period === 'all' || work.period === period) &&
        (status === 'all' || work.researchStatus === status) &&
        (type === 'all' || work.type === type)
    }),
    [normalizedQuery, period, status, type],
  )
  const selected = selectedId ? getWork(selectedId) : null

  return (
    <div className="portfolio-product-page work-index-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          label="Complete work"
          title="A research record should scan like an index, not advertise like a card wall."
          body="Every major work remains first-class. The default surface shows the question, date, status, and type; the richer explanation opens only when selected."
          aside="Research status and website-experience status remain independent throughout."
        />

        <section className="work-index-controls" aria-label="Work filters">
          <label className="work-search">
            Search the work
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Question, method, domain…"
            />
          </label>
          <label>
            Period
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)}>
              <option value="all">All</option>
              {WORK_PERIODS.map((item) => <option key={item} value={item}>{PERIOD_LABELS[item]}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">All</option>
              {RESEARCH_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={type} onChange={(event) => setType(event.target.value as WorkTypeFilter)}>
              <option value="all">All</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </section>

        <section className="work-index-layout">
          <div className="work-index-list">
            <header>
              <span>{filtered.length} works</span>
              <p>Question first. Evidence and detail on demand.</p>
            </header>
            <div className="work-line-list">
              {filtered.map((work) => (
                <WorkLine key={work.id} work={work} onInspect={setSelectedId} />
              ))}
              {!filtered.length ? <p className="work-index-empty">No work matches the current filters.</p> : null}
            </div>
          </div>

          <aside className={selected ? 'work-index-inspector has-selection' : 'work-index-inspector'} aria-live="polite">
            {selected ? (
              <>
                <button type="button" className="work-index-close" onClick={() => setSelectedId(null)}>Close preview</button>
                <StatusPair work={selected} />
                <WorkPreview work={selected} />
                <span>{selected.dateLabel} · {selected.venue}</span>
                <h2>{selected.shortTitle}</h2>
                <p className="work-index-question">{selected.question}</p>
                <p>{selected.contribution}</p>
                <Link className="portfolio-button is-primary" to={selected.route}>
                  Open full work
                  <ArrowIcon />
                </Link>
              </>
            ) : (
              <div className="work-index-placeholder">
                <span>Depth on demand</span>
                <h2>The index remains quiet until a work needs closer inspection.</h2>
                <p>Choose Preview for a semantic animation and contribution summary, or open any route directly.</p>
              </div>
            )}
          </aside>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

function ResearchRecordRow({ work }: { work: WorkRegistryEntry }) {
  return (
    <article className="research-record-row">
      <div>
        <span>{work.dateLabel}</span>
        <small>{work.venue}</small>
      </div>
      <div>
        <h2>{work.shortTitle}</h2>
        <p>{work.contribution}</p>
        <small>{work.coauthors.length ? `With ${work.coauthors.join(', ')}` : 'Independent work'}</small>
      </div>
      <div>
        <span className={statusClass(work.researchStatus)}>{work.researchStatusLabel}</span>
        <Link to={work.route}>Open <ArrowIcon /></Link>
      </div>
    </article>
  )
}

export function ResearchPage() {
  const researchWorks = WORK_REGISTRY.filter((work) => work.type === 'paper' || work.type === 'experiment')
  return (
    <div className="portfolio-product-page research-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          label="Research record"
          title="Claims, publication state, and evidence should remain legible at the same time."
          body="This page is a bibliographic and scientific record rather than another project gallery. Published, accepted, preprint, review, revision, and ongoing states are stated directly."
          aside="Website polish never upgrades a scientific status."
        />
        <section className="research-record">
          <header>
            <span>{researchWorks.length} research works</span>
            <p>Ordered chronologically by the start of the work.</p>
          </header>
          {researchWorks.map((work) => <ResearchRecordRow key={work.id} work={work} />)}
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function SystemsPage() {
  const systems = WORK_REGISTRY.filter((work) => work.type === 'system' || work.id === 'spatial-intelligence')
  const lead = systems[0]
  return (
    <div className="portfolio-product-page systems-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          label="Systems"
          title="The system boundary matters as much as the model inside it."
          body="These projects make sources, state, admissible actions, provenance, and correction visible. The goal is not decorative interactivity; it is operational inspectability."
          aside="Model proposals remain distinct from deterministic checks and authority."
        />
        {lead ? (
          <section className="systems-lead">
            <div>
              <StatusPair work={lead} />
              <h2>{lead.shortTitle}</h2>
              <p>{lead.question}</p>
              <p>{lead.contribution}</p>
              <Link className="portfolio-button is-primary" to={lead.route}>Enter the system <ArrowIcon /></Link>
            </div>
            <WorkPreview work={lead} />
          </section>
        ) : null}
        <section className="systems-principles" aria-label="System principles">
          <article><span>01</span><h3>State is explicit</h3><p>Important work opens as a durable surface, not a disappearing drawer or opaque chat turn.</p></article>
          <article><span>02</span><h3>Evidence is addressable</h3><p>Assertions retain source, scope, and provenance rather than collapsing into fluent prose.</p></article>
          <article><span>03</span><h3>Action is bounded</h3><p>Admission, refusal, correction, and replay remain inspectable after the model has proposed an interpretation.</p></article>
        </section>
        <div className="work-line-list systems-work-list">
          {systems.slice(1).map((work) => <WorkLine key={work.id} work={work} />)}
        </div>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function FrontierPage() {
  const frontierWorks = WORK_REGISTRY.filter((work) => work.period === 'frontier' || work.period === 'current')
  return (
    <div className="portfolio-product-page frontier-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          label="Current frontier"
          title="Open questions should look open—not prematurely resolved."
          body="These directions extend the programme into time-continual models, evidence-efficient agents, and persistent spatial worlds. Each states what exists now and what remains unproven."
          aside="The next experiment is part of the public record."
        />
        <section className="frontier-ledger">
          {frontierWorks.map((work, index) => (
            <article key={work.id} className={index === 0 ? 'is-lead' : ''}>
              <div className="frontier-ledger-copy">
                <span>{PERIOD_LABELS[work.period]} · {work.researchStatusLabel}</span>
                <h2>{work.shortTitle}</h2>
                <p>{work.question}</p>
                <dl>
                  <div><dt>Exists now</dt><dd>{work.evidenceAvailableNow}</dd></div>
                  <div><dt>Still open</dt><dd>{work.nextQuestion}</dd></div>
                </dl>
                <Link to={work.route}>Inspect the direction <ArrowIcon /></Link>
              </div>
              {index === 0 ? <WorkPreview work={work} /> : null}
            </article>
          ))}
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function AboutPage() {
  return (
    <div className="portfolio-product-page about-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          label="About"
          title="I am interested in systems whose behaviour becomes clearer under pressure, not only in demonstrations."
          body="I am a machine-learning PhD researcher at the University of Basel. My work combines mathematical structure, optimization, continual learning, evidence-grounded agents, and interfaces that let people inspect what a system is doing."
          aside="Based in Basel, Switzerland."
        />
        <section className="about-narrative">
          <article>
            <h2>Research orientation</h2>
            <p>
              The recurring question is how to preserve enough structure that a learning or agentic
              system can be corrected rather than merely restarted. That leads naturally from graph
              operators and optimization geometry to replay, temporal value, provenance, and persistent state.
            </p>
          </article>
          <article>
            <h2>Working principles</h2>
            <ol>
              <li><span>01</span><p>Make the object of reasoning explicit before optimizing it.</p></li>
              <li><span>02</span><p>Separate evidence, interpretation, and authority.</p></li>
              <li><span>03</span><p>Treat limitations as boundaries, not as the centre of the story.</p></li>
              <li><span>04</span><p>Build interfaces that reveal state changes and failure modes.</p></li>
            </ol>
          </article>
          <article className="about-contact-block">
            <h2>Contact and profiles</h2>
            <a href="mailto:navish.kumar@unibas.ch">navish.kumar@unibas.ch</a>
            <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Google Scholar</a>
            <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">OpenReview</a>
          </article>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function RegistryWorkPage({ workId }: { workId: string }) {
  const work = getWork(workId)
  const related = getRelatedWorks(work)
  return (
    <div className="portfolio-product-page registry-work-page">
      <PortfolioHeader />
      <main>
        <section className="registry-work-hero">
          <div className="registry-work-hero-copy">
            <Link className="registry-back-link" to="/work">Back to complete work</Link>
            <div className="registry-work-meta">
              <span>{work.dateLabel}</span>
              <span>{TYPE_LABELS[work.type]}</span>
              <span>{PERIOD_LABELS[work.period]}</span>
            </div>
            <StatusPair work={work} />
            <h1>{work.title}</h1>
            <p className="registry-work-hero-question">{work.question}</p>
            <p>{work.contribution}</p>
          </div>
          <WorkPreview work={work} className="registry-work-hero-preview" />
        </section>

        <section className="registry-work-story">
          <header>
            <span>One-minute explanation</span>
            <h2>The argument, without the project-page machinery.</h2>
          </header>
          <div>
            {work.explanation60.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>

        <section className="registry-work-facts">
          <article><span>My role</span><p>{work.role}</p></article>
          <article><span>Evidence available now</span><p>{work.evidenceAvailableNow}</p></article>
          <article><span>Scientific boundary</span><p>{work.limitation}</p></article>
          <article><span>Relation to earlier work</span><p>{work.relationToEarlierWork}</p></article>
          <article><span>Question next</span><p>{work.nextQuestion}</p></article>
        </section>

        <section className="registry-work-evidence">
          <header>
            <span>Evidence</span>
            <h2>Direct records and public artifacts.</h2>
          </header>
          <div>
            {work.evidence.map((evidence) => <EvidenceLink key={`${evidence.kind}-${evidence.url}`} evidence={evidence} />)}
          </div>
        </section>

        {related.length ? (
          <section className="registry-related-work">
            <header><span>Related work</span><h2>Follow the explicit connections.</h2></header>
            <div className="work-line-list">
              {related.map((item) => <WorkLine key={item.id} work={item} />)}
            </div>
          </section>
        ) : null}
      </main>
      <PortfolioFooter />
    </div>
  )
}
