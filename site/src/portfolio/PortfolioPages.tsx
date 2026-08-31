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
  foundations: 'Foundations / past',
  current: 'Current research',
  frontier: 'Frontier / next',
}

const RELATION_LABELS: Record<WorkRelation['kind'], string> = {
  'direct-methodological-inheritance': 'Direct methodological inheritance',
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

function externalLink(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function EvidenceLink({ evidence }: { evidence: WorkRegistryEntry['evidence'][number] }) {
  if (!externalLink(evidence.url)) {
    return (
      <Link to={evidence.url} className="registry-evidence-link">
        <span>{evidence.label}</span>
        <small>{evidence.note}</small>
      </Link>
    )
  }
  return (
    <a href={evidence.url} target="_blank" rel="noreferrer" className="registry-evidence-link">
      <span>{evidence.label} ↗</span>
      <small>{evidence.note}</small>
    </a>
  )
}

function StatusPair({ work }: { work: WorkRegistryEntry }) {
  return (
    <div className="registry-status-pair" aria-label="Research and website experience status">
      <span className={`registry-status ${statusClass(work.researchStatus)}`}>
        Research · {work.researchStatusLabel}
      </span>
      <span className="registry-status status-experience">
        Experience · {work.experienceStatusLabel}
      </span>
    </div>
  )
}

function RelationSummary({ work }: { work: WorkRegistryEntry }) {
  const relation = work.relations[0]
  if (!relation) return null
  const target = getWork(relation.targetId)
  return (
    <p className="registry-relation-summary">
      <span>{RELATION_LABELS[relation.kind]}</span>
      <Link to={target.route}>{target.shortTitle}</Link>
    </p>
  )
}

function WorkCard({ work, compact = false }: { work: WorkRegistryEntry; compact?: boolean }) {
  return (
    <article className={compact ? 'registry-work-card is-compact' : 'registry-work-card'} data-work-id={work.id}>
      <header>
        <div className="registry-work-meta">
          <span>{work.dateLabel}</span>
          <span>{TYPE_LABELS[work.type]}</span>
          <span>{PERIOD_LABELS[work.period]}</span>
        </div>
        <StatusPair work={work} />
      </header>
      <WorkPreview work={work} className="registry-card-preview" />
      <div className="registry-work-copy">
        <h2>{work.shortTitle}</h2>
        <p className="registry-work-question">{work.question}</p>
        <p>{work.contribution}</p>
      </div>
      <footer>
        <RelationSummary work={work} />
        <Link to={work.route} className="registry-work-open">
          Open the work <span aria-hidden="true">↗</span>
        </Link>
      </footer>
    </article>
  )
}

function PageIntro({
  kicker,
  title,
  body,
  aside,
}: {
  kicker: string
  title: string
  body: string
  aside?: string
}) {
  return (
    <section className="portfolio-page-intro">
      <div>
        <p className="portfolio-kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      <div className="portfolio-page-intro-copy">
        <p>{body}</p>
        {aside ? <span>{aside}</span> : null}
      </div>
    </section>
  )
}

const HERO_WORK_IDS = [
  'normalized-gain-laplacians',
  'experience-replay-optimization',
  'spatial-intelligence',
] as const

export function PortfolioHomePage() {
  const heroWorks = HERO_WORK_IDS.map((id) => getWork(id))
  const currentWorks = WORK_REGISTRY.filter((work) => work.period === 'current')
  const latestUpdate = [...WORK_REGISTRY].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

  return (
    <div className="portfolio-product-page">
      <PortfolioHeader />
      <main>
        <section className="portfolio-home-hero" id="top">
          <div className="portfolio-home-identity">
            <p className="portfolio-kicker">Navish Kumar · Basel, Switzerland</p>
            <h1>
              Machine-learning researcher
              <br />
              <em>and systems builder.</em>
            </h1>
            <p className="portfolio-home-thesis">
              I make difficult systems inspectable: mathematical structure, learning under interference,
              evidence-grounded agents, and spatial interfaces that people can actually operate.
            </p>
            <div className="portfolio-home-actions">
              <Link className="portfolio-button is-primary" to="/trajectory">
                Explore the trajectory
              </Link>
              <Link className="portfolio-button" to="/work">
                Scan the complete work
              </Link>
              <a className="portfolio-button" href="mailto:navish.kumar@unibas.ch">
                Contact
              </a>
            </div>
            <ul className="portfolio-area-list" aria-label="Areas of contribution">
              <li>Mathematical learning</li>
              <li>Continual adaptation</li>
              <li>Evidence-grounded systems</li>
              <li>Spatial intelligence</li>
            </ul>
          </div>

          <div className="portfolio-period-signal" aria-label="Foundations, current research, and frontier">
            {heroWorks.map((work) => (
              <article key={work.id} className={`portfolio-period-card period-${work.period}`}>
                <div>
                  <span>{PERIOD_LABELS[work.period]}</span>
                  <strong>{work.shortTitle}</strong>
                </div>
                <WorkPreview work={work} className="hero-work-preview" />
                <Link to={work.route}>Enter this work ↗</Link>
              </article>
            ))}
          </div>

          <div className="portfolio-first-view-contract">
            <span>Past · structure and evidence</span>
            <span>Now · replay, PEFT, temporal learning, CasePath</span>
            <span>Next · persistent worlds and situated agents</span>
          </div>
        </section>

        <section className="portfolio-trajectory-callout" aria-labelledby="home-trajectory-title">
          <div>
            <p className="portfolio-kicker">Trajectory</p>
            <h2 id="home-trajectory-title">The connective tissue is the product.</h2>
            <p>
              The work moves from observing interaction systems, through mathematical and optimization
              structure, into constrained learning, temporal decisions, inspectable agents, and spatial
              interfaces. Connections are labelled as inheritance, recurrence, adjacency, or extension—never
              implied as a false causal chain.
            </p>
          </div>
          <div className="portfolio-trajectory-mini" aria-label="Intellectual trajectory summary">
            <span>interaction evidence</span><i>→</i>
            <span>spectral structure</span><i>→</i>
            <span>optimization geometry</span><i>→</i>
            <span>learning under interference</span><i>→</i>
            <span>temporal replay value</span><i>→</i>
            <span>reviewable agents</span><i>→</i>
            <span>persistent worlds</span>
          </div>
          <Link className="portfolio-button" to="/trajectory">
            Open the complete trajectory
          </Link>
        </section>

        <section className="portfolio-work-shelf" aria-labelledby="home-work-title">
          <header>
            <div>
              <p className="portfolio-kicker">Complete major body of work</p>
              <h2 id="home-work-title">Ten works. Equal entry dignity. Different depths.</h2>
            </div>
            <p>
              Every work exposes its question, verified status, contribution, evidence state, native motion
              preview, direct route, and relation to the programme.
            </p>
          </header>
          <div className="registry-work-grid">
            {WORK_REGISTRY.map((work) => <WorkCard key={work.id} work={work} />)}
          </div>
        </section>

        <section className="portfolio-current-band" aria-labelledby="home-current-title">
          <div>
            <p className="portfolio-kicker">Working now</p>
            <h2 id="home-current-title">The active questions remain visible.</h2>
          </div>
          <div className="portfolio-current-list">
            {currentWorks.map((work) => (
              <Link key={work.id} to={work.route}>
                <span>{work.researchStatusLabel}</span>
                <strong>{work.shortTitle}</strong>
                <p>{work.nextQuestion}</p>
              </Link>
            ))}
          </div>
          <p className="portfolio-return-note">
            Latest registry review: {latestUpdate?.updatedAt}. Public status and evidence are separated from
            website implementation progress.
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

export function TrajectoryPage() {
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [year, setYear] = useState<YearFilter>('all')
  const [theme, setTheme] = useState('all')
  const [selectedId, setSelectedId] = useState('experience-replay-optimization')

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
  const selected = getWork(selectedId)
  const outgoing = selected.relations.map((relation) => ({ relation, target: getWork(relation.targetId) }))
  const incoming = incomingRelations(selected)

  return (
    <div className="portfolio-product-page trajectory-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          kicker="Trajectory"
          title="Browse the evolution of the questions—not only the dates."
          body="Time, intellectual dependence, research status, and evidence state remain visible together. Relation labels distinguish direct inheritance from recurring questions, adjacent applications, and later extensions."
          aside="Use the filters, select any work, then move through its predecessors and successors."
        />

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
          <button type="button" onClick={() => {
            setPeriod('all')
            setStatus('all')
            setYear('all')
            setTheme('all')
          }}>
            Reset filters
          </button>
        </section>

        <section className="trajectory-product-surface">
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
                  <div>
                    {periodWorks.map((work) => (
                      <button
                        key={work.id}
                        type="button"
                        className={selectedId === work.id ? 'trajectory-node is-selected' : 'trajectory-node'}
                        onClick={() => setSelectedId(work.id)}
                        aria-pressed={selectedId === work.id}
                      >
                        <span>{work.year}</span>
                        <strong>{work.shortTitle}</strong>
                        <small>{work.researchStatusLabel} · {TYPE_LABELS[work.type]}</small>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
            {!filtered.length ? <p className="trajectory-empty">No works match these filters.</p> : null}
          </div>

          <aside className="trajectory-inspector" aria-live="polite">
            <StatusPair work={selected} />
            <WorkPreview work={selected} />
            <span className="trajectory-inspector-date">{selected.dateLabel} · {selected.venue}</span>
            <h2>{selected.shortTitle}</h2>
            <p className="trajectory-inspector-question">{selected.question}</p>
            <p>{selected.contribution}</p>
            <dl>
              <div><dt>Evidence now</dt><dd>{selected.evidenceAvailableNow}</dd></div>
              <div><dt>Relation to earlier work</dt><dd>{selected.relationToEarlierWork}</dd></div>
              <div><dt>Question next</dt><dd>{selected.nextQuestion}</dd></div>
            </dl>
            <Link className="portfolio-button is-primary" to={selected.route}>Open this work</Link>

            <div className="trajectory-connections">
              <h3>Predecessors and successors</h3>
              {incoming.map(({ source, relation }) => (
                <button key={`${source.id}-${relation.kind}`} type="button" onClick={() => setSelectedId(source.id)}>
                  <span>{RELATION_LABELS[relation.kind]}</span>
                  <strong>← {source.shortTitle}</strong>
                  <p>{relation.note}</p>
                </button>
              ))}
              {outgoing.map(({ target, relation }) => (
                <button key={`${target.id}-${relation.kind}`} type="button" onClick={() => setSelectedId(target.id)}>
                  <span>{RELATION_LABELS[relation.kind]}</span>
                  <strong>{target.shortTitle} →</strong>
                  <p>{relation.note}</p>
                </button>
              ))}
            </div>
          </aside>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function WorkIndexPage() {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<'all' | WorkRegistryEntry['type']>('all')
  const visible = WORK_REGISTRY.filter((work) =>
    (status === 'all' || work.researchStatus === status) && (type === 'all' || work.type === type),
  )
  return (
    <div className="portfolio-product-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          kicker="Work"
          title="The complete body of work is visible at once."
          body="Papers, systems, experiments, and directions share one evidence contract without pretending they share one maturity level. No major work is buried inside another project’s monograph."
          aside={`${visible.length} of ${WORK_REGISTRY.length} first-class works shown.`}
        />
        <section className="work-index-controls" aria-label="Work filters">
          <label>
            Type
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              <option value="all">All types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Research status
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              {RESEARCH_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </section>
        <section className="registry-work-grid work-index-grid" aria-label="Complete body of work">
          {visible.map((work) => <WorkCard key={work.id} work={work} />)}
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function ResearchPage() {
  const researchWorks = WORK_REGISTRY.filter((work) => work.type === 'paper' || work.type === 'experiment')
  const statusOrder: ResearchStatus[] = ['published', 'accepted', 'preprint', 'under-review', 'under-revision', 'ongoing']
  return (
    <div className="portfolio-product-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          kicker="Research"
          title="A living intellectual record, not a dead bibliography."
          body="Every record states what is established, what remains under review or revision, what is still a hypothesis, and where the next question comes from."
          aside="Google Scholar and OpenReview remain one click away; public statuses are not inferred from private drafts."
        />
        <section className="research-source-links">
          <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Google Scholar ↗</a>
          <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">OpenReview profile ↗</a>
          <a href="/artifacts/resume.pdf" target="_blank" rel="noreferrer">Résumé ↗</a>
        </section>
        {statusOrder.map((researchStatus) => {
          const works = researchWorks.filter((work) => work.researchStatus === researchStatus)
          if (!works.length) return null
          return (
            <section key={researchStatus} className="research-status-group">
              <header>
                <span className={`registry-status ${statusClass(researchStatus)}`}>{works[0]?.researchStatusLabel}</span>
                <h2>{works.length} {works.length === 1 ? 'record' : 'records'}</h2>
              </header>
              <div className="research-record-list">
                {works.map((work) => (
                  <article key={work.id}>
                    <div>
                      <span>{work.dateLabel}</span>
                      <h3>{work.title}</h3>
                      <p>{work.venue}</p>
                      <p>{work.coauthors.length ? `With ${work.coauthors.join(', ')}` : 'Independent ongoing direction'}</p>
                    </div>
                    <div>
                      <strong>{work.question}</strong>
                      <p>{work.contribution}</p>
                      <small>{work.statusNote}</small>
                      <Link to={work.route}>Open explanation ↗</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function SystemsPage() {
  const casepath = getWork('casepath')
  const urban = getWork('urban-microregion-logistics')
  return (
    <div className="portfolio-product-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          kicker="Systems"
          title="Research earns its place when it changes an operational decision."
          body="The systems surface exposes architecture, deterministic boundaries, failure behaviour, provenance, deployment evidence, and the product choices required to make technical depth usable."
          aside="The portfolio itself is built as an evidence-backed product, not a résumé theme."
        />
        <section className="systems-feature">
          <WorkPreview work={casepath} />
          <div>
            <StatusPair work={casepath} />
            <h2>{casepath.shortTitle}</h2>
            <p>{casepath.explanation15}</p>
            <ul>
              <li>Bounded model proposals rather than unreviewable authority.</li>
              <li>Deterministic gates for missing, conflicting, or inadmissible evidence.</li>
              <li>Append-only provenance, replay, correction, and reviewable action packets.</li>
              <li>Product choreography that keeps the source-to-decision path inspectable.</li>
            </ul>
            <Link className="portfolio-button is-primary" to={casepath.route}>Open CasePath chapter</Link>
            <a className="portfolio-button" href="/casepath/">Open deployed CasePath</a>
          </div>
        </section>
        <section className="systems-product-decisions">
          <div>
            <p className="portfolio-kicker">Product evidence</p>
            <h2>Architecture is visible in the failure path.</h2>
          </div>
          <ol>
            <li><strong>Source before assertion</strong><p>Facts preserve citations, uncertainty, and source scope.</p></li>
            <li><strong>Computation before persuasion</strong><p>Typed obligations and deterministic checks decide whether work may continue.</p></li>
            <li><strong>Refusal as a product state</strong><p>Missing or conflicting evidence produces hold or refusal, not fluent completion.</p></li>
            <li><strong>Correction without amnesia</strong><p>Expert changes recompute dependent state while keeping the original trace replayable.</p></li>
          </ol>
        </section>
        <section className="systems-adjacent">
          <WorkCard work={urban} compact />
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function FrontierPage() {
  const frontier = WORK_REGISTRY.filter((work) => work.period === 'frontier' || work.researchStatus === 'ongoing')
  return (
    <div className="portfolio-product-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          kicker="Frontier"
          title="The next interface is not another answer box."
          body="The frontier asks how intelligent systems should allocate learning through time, preserve inspectable state, and act inside persistent environments rather than emitting disconnected outputs."
          aside="Ongoing work and directions are labelled as such; simulations never masquerade as completed empirical results."
        />
        <section className="frontier-grid">
          {frontier.map((work) => <WorkCard key={work.id} work={work} />)}
        </section>
        <section className="frontier-thesis">
          <p className="portfolio-kicker">Open thesis</p>
          <h2>Intelligence becomes more useful when state, action, evidence, and space remain inspectable.</h2>
          <div>
            <article><span>Learning</span><p>Which past information still deserves present compute?</p></article>
            <article><span>Authority</span><p>Which interpretation is sufficiently supported to permit action?</p></article>
            <article><span>Worlds</span><p>How should language edit a persistent environment rather than regenerate it?</p></article>
          </div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function AboutPage() {
  return (
    <div className="portfolio-product-page">
      <PortfolioHeader />
      <main>
        <PageIntro
          kicker="About / contact"
          title="Research depth, engineering discipline, and product judgment should reinforce one another."
          body="Navish Kumar is a machine-learning researcher and systems builder based in Basel, working across optimization, continual learning, evidence-grounded agents, and emerging spatial interfaces."
          aside="Open to research, applied-ML, research-engineering, and product roles where difficult ideas must become reliable systems."
        />
        <section className="about-surface">
          <div className="about-principles">
            <article><span>01</span><h2>Make hidden structure observable.</h2><p>Define the object, failure mode, and diagnostic before optimizing the story.</p></article>
            <article><span>02</span><h2>Separate model judgment from deterministic authority.</h2><p>Use learned systems where interpretation is valuable and explicit gates where trust requires it.</p></article>
            <article><span>03</span><h2>Build interfaces that expose causality.</h2><p>Motion, controls, and evidence should reveal what changed and why.</p></article>
          </div>
          <aside className="about-contact-card">
            <span>Basel, Switzerland</span>
            <h2>Collaboration interests</h2>
            <p>Continual and adaptive ML, optimization, reliable agents, scientific interfaces, spatial computing, and products that turn emerging methods into usable workflows.</p>
            <a href="mailto:navish.kumar@unibas.ch">navish.kumar@unibas.ch</a>
            <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Google Scholar ↗</a>
            <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">OpenReview ↗</a>
            <a href="/artifacts/resume.pdf" target="_blank" rel="noreferrer">Résumé ↗</a>
          </aside>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}

export function RegistryWorkPage({ workId }: { workId: string }) {
  const work = getWork(workId)
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'guided' | 'explore' | 'evidence'>('guided')
  const related = getRelatedWorks(work)
  const explanations = work.explanation60
  const current = explanations[Math.min(step, explanations.length - 1)] ?? work.explanation15

  return (
    <div className="portfolio-product-page registry-deep-page">
      <PortfolioHeader />
      <main>
        <section className="registry-deep-hero">
          <div>
            <p className="portfolio-kicker">{work.dateLabel} · {work.venue}</p>
            <h1>{work.title}</h1>
          </div>
          <div>
            <StatusPair work={work} />
            <p>{work.question}</p>
          </div>
        </section>

        <section className="registry-deep-instrument">
          <div className="registry-deep-modebar" aria-label="Project explanation mode">
            <button type="button" className={mode === 'guided' ? 'is-active' : ''} onClick={() => setMode('guided')}>Guided mode</button>
            <button type="button" className={mode === 'explore' ? 'is-active' : ''} onClick={() => setMode('explore')}>Explore mode</button>
            <button type="button" className={mode === 'evidence' ? 'is-active' : ''} onClick={() => setMode('evidence')}>Evidence</button>
          </div>
          <div className="registry-deep-stage">
            <WorkPreview work={work} />
            {mode === 'guided' ? (
              <div className="registry-guided-copy" aria-live="polite">
                <span>{String(step + 1).padStart(2, '0')} / {String(explanations.length).padStart(2, '0')}</span>
                <h2>{current}</h2>
                <p>{work.explanation15}</p>
                <div>
                  <button type="button" onClick={() => setStep((step + explanations.length - 1) % explanations.length)}>Back</button>
                  <button type="button" onClick={() => setStep(0)}>Restart</button>
                  <button type="button" onClick={() => setStep((step + 1) % explanations.length)}>Next</button>
                </div>
              </div>
            ) : null}
            {mode === 'explore' ? (
              <div className="registry-explore-copy">
                <h2>Operate the complete gain-graph mechanism.</h2>
                <p>The shared instrument recomputes the graph, Hermitian operator, cycle products, eigensystem, diffusion, and exact finite-graph frustration diagnostics.</p>
                <Link className="portfolio-button is-primary" to="/work/gain-graphs">Open the full computed instrument</Link>
              </div>
            ) : null}
            {mode === 'evidence' ? (
              <div className="registry-deep-evidence">
                {work.evidence.map((item) => <EvidenceLink key={`${item.kind}-${item.url}`} evidence={item} />)}
              </div>
            ) : null}
          </div>
        </section>

        <section className="registry-deep-argument">
          <article><span>Question</span><h2>{work.question}</h2></article>
          <article><span>Contribution</span><h2>{work.contribution}</h2></article>
          <article><span>Evidence available now</span><p>{work.evidenceAvailableNow}</p></article>
          <article><span>Failure boundary</span><p>{work.limitation}</p></article>
          <article><span>Relation to earlier work</span><p>{work.relationToEarlierWork}</p></article>
          <article><span>Question next</span><p>{work.nextQuestion}</p></article>
        </section>

        <section className="registry-related-works">
          <header><p className="portfolio-kicker">Connected work</p><h2>Continue by relation, not by arbitrary pagination.</h2></header>
          <div>{related.map((item) => <WorkCard key={item.id} work={item} compact />)}</div>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
