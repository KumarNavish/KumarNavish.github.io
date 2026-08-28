import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

import {
  CHAPTERS,
  EVIDENCE,
  chapterById,
  evidenceById,
  type ChapterDefinition,
  type ChapterId,
  type EvidenceRecord,
} from './content'

export type MotionPreference = 'full' | 'reduced'

export type AccentStyle = CSSProperties & {
  '--chapter-accent': string
  '--chapter-progress'?: number
}

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function useChapterProgress(
  ref: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
): number {
  const [measuredProgress, setMeasuredProgress] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      return undefined
    }
    let frame = 0
    const measure = () => {
      frame = 0
      const element = ref.current
      if (!element) {
        return
      }
      const bounds = element.getBoundingClientRect()
      const travel = Math.max(1, bounds.height - window.innerHeight)
      setMeasuredProgress(clamp(-bounds.top / travel))
    }
    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(measure)
      }
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [reducedMotion, ref])

  return reducedMotion ? 1 : measuredProgress
}

export function useActiveChapter(onChange: (id: ChapterId) => void): void {
  const stableOnChange = useCallback(onChange, [onChange])
  useEffect(() => {
    const ids: ChapterId[] = [
      'entry',
      ...CHAPTERS.map((chapter) => chapter.id),
      'atlas',
      'contact',
    ]
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) {
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        if (active?.target.id) {
          stableOnChange(active.target.id as ChapterId)
        }
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: [0, 0.2, 0.5, 0.8] },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [stableOnChange])
}

export function useInterval(callback: () => void, delay: number | null): void {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  useEffect(() => {
    if (delay === null) {
      return undefined
    }
    const timer = window.setInterval(() => callbackRef.current(), delay)
    return () => window.clearInterval(timer)
  }, [delay])
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return value.toFixed(digits)
}

export function signalColor(value: number, maximum: number): string {
  const normalized = maximum <= 1e-9 ? 0 : clamp(value / maximum, -1, 1)
  if (normalized >= 0) {
    const lightness = 42 + normalized * 30
    return `hsl(191 82% ${lightness}%)`
  }
  const lightness = 48 + Math.abs(normalized) * 22
  return `hsl(19 78% ${lightness}%)`
}

export function arrowPath(originX: number, originY: number, x: number, y: number): string {
  return `M ${originX} ${originY} L ${x} ${y}`
}

function stageIndex(progress: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)))
}

export function StageRail({
  chapter,
  activeIndex,
}: {
  chapter: ChapterDefinition
  activeIndex: number
}) {
  return (
    <ol className="mn-stage-rail" aria-label={`${chapter.shortTitle} explanation sequence`}>
      {chapter.stages.map((stage, index) => (
        <li
          key={stage.id}
          className={index === activeIndex ? 'is-active' : index < activeIndex ? 'is-complete' : ''}
        >
          <span className="mn-stage-dot" aria-hidden="true" />
          <span>{stage.label}</span>
        </li>
      ))}
    </ol>
  )
}

export function ChapterShell({
  chapterId,
  reducedMotion,
  children,
}: {
  chapterId: Exclude<ChapterId, 'entry' | 'atlas' | 'contact'>
  reducedMotion: boolean
  children: (context: {
    chapter: ChapterDefinition
    progress: number
    activeStage: number
  }) => ReactNode
}) {
  const chapter = chapterById(chapterId)
  const ref = useRef<HTMLElement>(null)
  const progress = useChapterProgress(ref, reducedMotion)
  if (!chapter) {
    return null
  }
  const activeStage = stageIndex(progress, chapter.stages.length)
  const style: AccentStyle = {
    '--chapter-accent': chapter.accent,
    '--chapter-progress': progress,
  }

  return (
    <section
      ref={ref}
      id={chapter.id}
      className="mn-chapter"
      style={style}
      data-stage={chapter.stages[activeStage]?.id}
      aria-labelledby={`${chapter.id}-title`}
    >
      <div className="mn-chapter-sticky">
        <div className="mn-chapter-frame">
          <header className="mn-chapter-header">
            <div className="mn-chapter-index" aria-hidden="true">
              {chapter.index}
            </div>
            <div>
              <p className="mn-eyebrow">{chapter.status}</p>
              <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
            </div>
          </header>
          <div className="mn-chapter-grid">
            <aside className="mn-chapter-narrative">
              <StageRail chapter={chapter} activeIndex={activeStage} />
              <div className="mn-stage-copy" aria-live="polite">
                <p className="mn-stage-label">{chapter.stages[activeStage]?.label}</p>
                <h3>{chapter.stages[activeStage]?.title}</h3>
                <p>{chapter.stages[activeStage]?.body}</p>
              </div>
            </aside>
            <div className="mn-mechanism-area">
              {children({ chapter, progress, activeStage })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ControlGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <fieldset className="mn-control-group">
      <legend>{label}</legend>
      {children}
    </fieldset>
  )
}

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <ControlGroup label={label}>
      <div className="mn-segmented">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={value === option.value ? 'is-active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </ControlGroup>
  )
}

export function RangeControl({
  label,
  value,
  minimum,
  maximum,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  minimum: number
  maximum: number
  step: number
  display?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="mn-range-control">
      <span>
        {label}
        <output>{display ?? formatNumber(value)}</output>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function EvidenceButton({
  evidenceId,
  onOpen,
  compact = false,
}: {
  evidenceId: string
  onOpen: (id: string) => void
  compact?: boolean
}) {
  const evidence = evidenceById(evidenceId)
  if (!evidence) {
    return null
  }
  return (
    <button
      type="button"
      className={compact ? 'mn-evidence-button is-compact' : 'mn-evidence-button'}
      onClick={() => onOpen(evidenceId)}
    >
      <span>{evidence.status}</span>
      {evidence.label}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" />
      </svg>
    </button>
  )
}

function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
): void {
  useEffect(() => {
    if (!active) {
      return undefined
    }
    const container = containerRef.current
    if (!container) {
      return undefined
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(selector))
    focusables[0]?.focus()
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscape()
        return
      }
      if (event.key !== 'Tab' || focusables.length === 0) {
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      previous?.focus()
    }
  }, [active, containerRef, onEscape])
}

export function EvidenceDrawer({
  evidenceId,
  onClose,
}: {
  evidenceId: string | null
  onClose: () => void
}) {
  const evidence = evidenceId ? evidenceById(evidenceId) : undefined
  const ref = useRef<HTMLElement>(null)
  useFocusTrap(ref, Boolean(evidence), onClose)

  useEffect(() => {
    document.body.classList.toggle('mn-overlay-open', Boolean(evidence))
    return () => document.body.classList.remove('mn-overlay-open')
  }, [evidence])

  if (!evidence) {
    return null
  }

  return (
    <div className="mn-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={ref}
        className="mn-evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mn-evidence-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="mn-eyebrow">Evidence · {evidence.status}</p>
            <h2 id="mn-evidence-title">{evidence.label}</h2>
          </div>
          <button type="button" className="mn-icon-button" aria-label="Close evidence" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m3 3 10 10M13 3 3 13" />
            </svg>
          </button>
        </header>
        <dl className="mn-evidence-contract">
          <div>
            <dt>Claim</dt>
            <dd>{evidence.claim}</dd>
          </div>
          <div>
            <dt>What the source supports</dt>
            <dd>{evidence.supports}</dd>
          </div>
          <div>
            <dt>What it does not establish</dt>
            <dd>{evidence.boundary}</dd>
          </div>
        </dl>
        {evidence.sources.length > 0 ? (
          <div className="mn-source-list">
            {evidence.sources.map((source) => (
              <a key={source.href} href={source.href} target="_blank" rel="noreferrer">
                {source.label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mn-source-empty">
            Ongoing private prototype. No public artifact is claimed for this evidence record.
          </p>
        )}
      </aside>
    </div>
  )
}

export function MotionHeader({
  activeChapter,
  reducedMotion,
  onToggleMotion,
  onOpenIndex,
}: {
  activeChapter: ChapterId
  reducedMotion: boolean
  onToggleMotion: () => void
  onOpenIndex: () => void
}) {
  const navigation = useMemo(
    () => [
      { id: 'graph' as const, label: 'Graph' },
      { id: 'replay' as const, label: 'Replay' },
      { id: 'rank' as const, label: 'Rank' },
      { id: 'temporal' as const, label: 'Time' },
      { id: 'casepath' as const, label: 'CasePath' },
      { id: 'spatial' as const, label: 'Space' },
    ],
    [],
  )
  return (
    <header className="mn-header">
      <a className="mn-brand" href="#entry" aria-label="Navish Kumar — return to introduction">
        <strong>Navish Kumar</strong>
        <span>Interactive research instrument</span>
      </a>
      <nav aria-label="Research chapters">
        {navigation.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={activeChapter === item.id ? 'location' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="mn-header-actions">
        <button type="button" className="mn-quiet-button" onClick={onToggleMotion}>
          Motion {reducedMotion ? 'reduced' : 'full'}
        </button>
        <button type="button" className="mn-index-button" onClick={onOpenIndex}>
          Index <kbd>/</kbd>
        </button>
      </div>
    </header>
  )
}

export function ResearchIndex({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [query, setQuery] = useState('')
  useFocusTrap(ref, open, onClose)
  const normalized = query.trim().toLowerCase()
  const results = useMemo(() => {
    const chapters = CHAPTERS.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.question,
      status: chapter.status,
      href: `#${chapter.id}`,
    }))
    const evidence = EVIDENCE.map((record) => ({
      id: record.id,
      title: record.label,
      subtitle: record.claim,
      status: record.status,
      href: `#${record.chapter}`,
    }))
    return [...chapters, ...evidence].filter((result) => {
      if (!normalized) {
        return true
      }
      return `${result.title} ${result.subtitle} ${result.status}`.toLowerCase().includes(normalized)
    })
  }, [normalized])

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="mn-index-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={ref}
        className="mn-research-index"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mn-index-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="mn-eyebrow">Global index</p>
            <h2 id="mn-index-title">Questions, mechanisms, and evidence</h2>
          </div>
          <button type="button" className="mn-icon-button" aria-label="Close index" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m3 3 10 10M13 3 3 13" />
            </svg>
          </button>
        </header>
        <label className="mn-index-search">
          <span className="visually-hidden">Search research</span>
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="8" cy="8" r="5" />
            <path d="m12 12 4 4" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a question, method, system, or source"
          />
        </label>
        <div className="mn-index-results">
          {results.map((result) => (
            <a key={`${result.id}-${result.title}`} href={result.href} onClick={onClose}>
              <span>{result.status}</span>
              <strong>{result.title}</strong>
              <p>{result.subtitle}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

export function EvidenceSummary({ record }: { record: EvidenceRecord }) {
  return (
    <article className="mn-evidence-summary">
      <p className="mn-eyebrow">{record.status}</p>
      <h4>{record.label}</h4>
      <p>{record.supports}</p>
    </article>
  )
}
