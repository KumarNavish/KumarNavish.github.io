import { useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import {
  DEFAULT_WORLD,
  moveWorldObject,
  parseAndApply,
  runAgentAction,
  type ParsedIntent,
  type SceneObjectKind,
  type WorldObject,
  type WorldState,
} from '../spatial/sceneParser'
import './spatialWorldExperience.css'

type InspectorTab = 'intent' | 'world' | 'history'
type ViewMode = 'overview' | 'agent'
type SpeechRecognitionEventLike = { results: ArrayLike<{ 0: { transcript: string } }> }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SpeechConstructor = new () => SpeechRecognitionLike
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechConstructor
  webkitSpeechRecognition?: SpeechConstructor
}

const EXAMPLE_COMMAND =
  'Create a quiet mountain laboratory at sunset. Put a microscope beside a robotic arm. Ask the agent to inspect a sample.'

const FOLLOW_UP = 'Add a second sample beside the microscope and make the room darker.'

const OBJECT_LABEL: Record<SceneObjectKind, string> = {
  laboratory: 'laboratory',
  table: 'work table',
  'robotic-arm': 'robotic arm',
  microscope: 'microscope',
  sample: 'sample',
  telescope: 'telescope',
  drone: 'drone',
  screen: 'display',
  lamp: 'lamp',
  chair: 'chair',
  plant: 'plant',
}

function worldDiff(before: WorldState, after: WorldState): string[] {
  const changes: string[] = []
  const beforeIds = new Set(before.objects.map((object) => object.id))
  const afterIds = new Set(after.objects.map((object) => object.id))
  const added = after.objects.filter((object) => !beforeIds.has(object.id))
  const removed = before.objects.filter((object) => !afterIds.has(object.id))
  for (const object of added) changes.push(`+ ${object.label}`)
  for (const object of removed) changes.push(`− ${object.label}`)
  if (before.environment !== after.environment) changes.push(`environment · ${before.environment} → ${after.environment}`)
  if (before.timeOfDay !== after.timeOfDay) changes.push(`light · ${before.timeOfDay} → ${after.timeOfDay}`)
  if (before.mood !== after.mood) changes.push(`mood · ${before.mood} → ${after.mood}`)
  if (after.action && before.action?.status !== after.action.status)
    changes.push(`agent · ${after.action.verb} ${after.action.status}`)
  if (!changes.length && before.revision !== after.revision) changes.push('coordinates updated')
  return changes
}

function objectPosition(object: WorldObject): { left: string; top: string; zIndex: number } {
  const left = Math.max(6, Math.min(88, 7 + object.x / 5.6))
  const top = Math.max(18, Math.min(78, 14 + object.y / 5.1))
  return { left: `${left}%`, top: `${top}%`, zIndex: Math.round(object.y) }
}

function WorldObjectVisual({ object }: { object: WorldObject }) {
  return (
    <span className={`world-object-shape kind-${object.kind}`} aria-hidden="true">
      <i /><b /><em />
    </span>
  )
}

function EnvironmentBackdrop({ world }: { world: WorldState }) {
  return (
    <div className={`world-environment environment-${world.environment} time-${world.timeOfDay} mood-${world.mood}`} aria-hidden="true">
      <div className="world-sun" />
      <div className="world-stars"><i /><i /><i /><i /><i /></div>
      <div className="world-mountain mountain-1" />
      <div className="world-mountain mountain-2" />
      <div className="world-mountain mountain-3" />
      <div className="world-city"><i /><i /><i /><i /></div>
      <div className="world-ocean" />
      <div className="world-forest"><i /><i /><i /><i /><i /></div>
    </div>
  )
}

function IntentInspector({ intent }: { intent: ParsedIntent | null }) {
  if (!intent) {
    return (
      <div className="world-empty-inspector">
        <strong>No interpretation yet.</strong>
        <p>Submit the example or describe a world in your own words.</p>
      </div>
    )
  }

  return (
    <dl className="intent-inspector-list">
      <div><dt>operation</dt><dd>{intent.operation}</dd></div>
      <div><dt>environment</dt><dd>{intent.environment ?? 'unchanged'}</dd></div>
      <div><dt>time</dt><dd>{intent.timeOfDay ?? 'unchanged'}</dd></div>
      <div><dt>objects</dt><dd>{intent.additions.length ? intent.additions.map((item) => OBJECT_LABEL[item.kind]).join(', ') : 'none added'}</dd></div>
      <div><dt>relations</dt><dd>{intent.additions.map((item) => item.relation).filter(Boolean).join(', ') || 'implicit placement'}</dd></div>
      <div><dt>agent goal</dt><dd>{intent.action ? `${intent.action.verb} ${intent.action.targetKind ?? ''}`.trim() : 'none'}</dd></div>
      <div><dt>confidence</dt><dd>{Math.round(intent.confidence * 100)}%</dd></div>
    </dl>
  )
}

export function SpatialWorldExperience({ embedded = false }: { embedded?: boolean }) {
  const [world, setWorld] = useState<WorldState>(DEFAULT_WORLD)
  const [prompt, setPrompt] = useState(EXAMPLE_COMMAND)
  const [intent, setIntent] = useState<ParsedIntent | null>(null)
  const [tab, setTab] = useState<InspectorTab>('intent')
  const [view, setView] = useState<ViewMode>('overview')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [diff, setDiff] = useState<string[]>([])
  const [status, setStatus] = useState('Describe a world, then watch the structure become spatial state.')
  const dragRef = useRef<{ id: string; x: number; y: number; pointerX: number; pointerY: number } | null>(null)

  const selected = world.objects.find((object) => object.id === selectedId) ?? null
  const sceneSummary = useMemo(
    () => `${world.environment} · ${world.timeOfDay} · ${world.objects.length} object${world.objects.length === 1 ? '' : 's'} · revision ${world.revision}`,
    [world],
  )

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const command = prompt.trim()
    if (!command) return
    const before = world
    const result = parseAndApply(world, command)
    setIntent(result.intent)
    setWorld(result.world)
    setDiff(worldDiff(before, result.world))
    setStatus(`Revision ${result.world.revision} created. Existing world state was preserved.`)
    setTab('intent')
  }

  const reset = () => {
    setWorld(DEFAULT_WORLD)
    setIntent(null)
    setDiff([])
    setSelectedId(null)
    setStatus('World reset. The next instruction will create revision 1.')
  }

  const runAction = () => {
    const before = world
    const next = runAgentAction(world)
    setWorld(next)
    setDiff(worldDiff(before, next))
    setStatus(next.action?.status === 'complete' ? 'The agent resolved its target and completed the situated action.' : 'No agent action is currently planned.')
  }

  const moveSelected = (dx: number, dy: number) => {
    if (!selected) return
    const before = world
    const next = moveWorldObject(world, selected.id, selected.x + dx, selected.y + dy)
    setWorld(next)
    setDiff(worldDiff(before, next))
  }

  const startSpeech = () => {
    const speechWindow = window as SpeechWindow
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Constructor) {
      setStatus('Speech recognition is unavailable in this browser. Typed input remains fully supported.')
      return
    }
    const recognition = new Constructor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) setPrompt(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setStatus('Speech capture failed. The typed command remains available.')
    }
    setListening(true)
    recognition.start()
  }

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, object: WorldObject) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id: object.id, x: object.x, y: object.y, pointerX: event.clientX, pointerY: event.clientY }
    setSelectedId(object.id)
  }

  const drag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = dragRef.current
    if (!active) return
    const dx = (event.clientX - active.pointerX) * 1.45
    const dy = (event.clientY - active.pointerY) * 1.45
    setWorld((current) => moveWorldObject(current, active.id, active.x + dx, active.y + dy))
  }

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId)
      dragRef.current = null
      setDiff(['coordinates updated by direct manipulation'])
    }
  }

  return (
    <section className={embedded ? 'spatial-world-experience is-embedded' : 'spatial-world-experience'}>
      <div className="world-command-region">
        <form onSubmit={submit}>
          <label htmlFor="world-command">Describe the scene</label>
          <textarea
            id="world-command"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            spellCheck="true"
          />
          <div className="world-command-actions">
            <button type="submit" className="world-primary-action">Build or update world</button>
            <button type="button" onClick={startSpeech} aria-pressed={listening}>{listening ? 'Listening…' : 'Speak'}</button>
            <button type="button" onClick={() => setPrompt(FOLLOW_UP)}>Use follow-up</button>
            <button type="button" onClick={reset}>Reset</button>
          </div>
        </form>

        <div className="world-pipeline" aria-label="Language to world pipeline">
          {['language', 'intent', 'relations', 'world state', 'agent action'].map((item, index) => (
            <span key={item} className={world.revision >= Math.max(1, index - 1) ? 'is-complete' : ''}>
              <i>{String(index + 1).padStart(2, '0')}</i>{item}
            </span>
          ))}
        </div>
      </div>

      <div className="world-product-shell">
        <div className="world-viewport-shell">
          <header className="world-viewport-header">
            <div><span>Persistent semantic world</span><strong>{sceneSummary}</strong></div>
            <div className="world-view-switch" role="group" aria-label="World camera">
              <button type="button" aria-pressed={view === 'overview'} onClick={() => setView('overview')}>Overview</button>
              <button type="button" aria-pressed={view === 'agent'} onClick={() => setView('agent')}>Agent view</button>
            </div>
          </header>

          <div className={`world-viewport view-${view}`}>
            <EnvironmentBackdrop world={world} />
            <div className="world-ground-grid" aria-hidden="true" />
            <div className="world-lab-volume" aria-hidden="true"><i /><b /><em /></div>
            <svg className="world-relation-layer" viewBox="0 0 1000 600" aria-hidden="true">
              {world.objects.filter((object) => object.relation).map((object) => (
                <path key={object.id} d={`M${100 + object.x * 1.55} ${90 + object.y * 1.18} C500 250 560 250 680 300`} />
              ))}
              {world.action?.targetId ? <path className="agent-route-line" d={`M180 468 C300 410 430 352 640 292`} /> : null}
            </svg>

            {world.objects.map((object) => {
              const position = objectPosition(object)
              return (
                <button
                  type="button"
                  key={object.id}
                  data-scene-object={object.id}
                  className={selectedId === object.id ? 'world-object is-selected' : 'world-object'}
                  style={position}
                  onPointerDown={(event) => beginDrag(event, object)}
                  onPointerMove={drag}
                  onPointerUp={endDrag}
                  onClick={() => setSelectedId(object.id)}
                  aria-label={`${object.label}${object.relation ? `, ${object.relation}` : ''}`}
                >
                  <WorldObjectVisual object={object} />
                  <span>{object.label}</span>
                </button>
              )
            })}

            <div className={world.action?.status === 'complete' ? 'world-agent is-complete' : 'world-agent'} style={{ left: `${12 + world.agent.x / 6}%`, top: `${32 + world.agent.y / 5.6}%` }}>
              <i /><span>{world.agent.label}</span>
            </div>

            {!world.objects.length ? (
              <div className="world-empty-state">
                <strong>Speak or type a world.</strong>
                <span>Objects will appear in persistent spatial state.</span>
              </div>
            ) : null}

            {diff.length ? (
              <div className="world-diff" aria-live="polite">
                <span>revision diff</span>
                {diff.map((change) => <strong key={change}>{change}</strong>)}
              </div>
            ) : null}
          </div>

          <footer className="world-viewport-footer">
            <span>{status}</span>
            {world.action ? (
              <button type="button" onClick={runAction} disabled={world.action.status === 'complete'}>
                {world.action.status === 'complete' ? 'Action complete' : `Run agent · ${world.action.verb}`}
              </button>
            ) : null}
          </footer>
        </div>

        <aside className="world-inspector">
          <div className="world-inspector-tabs" role="tablist" aria-label="World inspector">
            {(['intent', 'world', 'history'] as InspectorTab[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="world-inspector-body">
            {tab === 'intent' ? <IntentInspector intent={intent} /> : null}
            {tab === 'world' ? (
              <>
                <pre>{JSON.stringify(world, null, 2)}</pre>
                {selected ? (
                  <div className="world-object-editor">
                    <strong>Move {selected.label}</strong>
                    <div>
                      <button type="button" onClick={() => moveSelected(-12, 0)} aria-label="Move selected object left">←</button>
                      <button type="button" onClick={() => moveSelected(0, -12)} aria-label="Move selected object up">↑</button>
                      <button type="button" onClick={() => moveSelected(0, 12)} aria-label="Move selected object down">↓</button>
                      <button type="button" onClick={() => moveSelected(12, 0)} aria-label="Move selected object right">→</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            {tab === 'history' ? (
              <div className="spatial-history">
                {world.history.length ? world.history.map((command, index) => (
                  <article className="spatial-history-item" key={`${command}-${index}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span><p>{command}</p>
                  </article>
                )) : <div className="world-empty-inspector"><strong>No commands yet.</strong><p>Every persistent edit will appear here.</p></div>}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  )
}

export function SpatialWorldPage() {
  return (
    <div className="portfolio-product-page spatial-world-page">
      <PortfolioHeader />
      <main>
        <section className="spatial-page-intro">
          <div>
            <span>Generative AI × spatial computing</span>
            <h1>Language should change a world—not end as an answer.</h1>
          </div>
          <p>
            This browser-native prototype makes the complete transition visible: language becomes
            structured intent, persistent world state, direct spatial editing, and a situated agent
            action. The current renderer is deliberately 2.5D and deterministic; the interaction
            contract is the research thesis.
          </p>
        </section>
        <SpatialWorldExperience />
        <section className="spatial-technical-boundary">
          <h2>What is implemented now</h2>
          <div>
            <article><strong>Persistent state</strong><p>Follow-up commands edit the same world rather than generating disconnected scenes.</p></article>
            <article><strong>Visible interpretation</strong><p>Environment, objects, relations, confidence, goal, and history remain inspectable.</p></article>
            <article><strong>Situated action</strong><p>The agent resolves a target inside the current scene before it moves.</p></article>
            <article><strong>Honest boundary</strong><p>No foundation model, physics engine, generated asset system, or immersive 6DoF is implied.</p></article>
          </div>
          <Link to="/frontier">Return to the frontier</Link>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
