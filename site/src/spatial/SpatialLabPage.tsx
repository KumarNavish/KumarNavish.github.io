import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioShell'
import {
  DEFAULT_WORLD,
  applySceneIntent,
  moveWorldObject,
  parseSceneCommand,
  runAgentAction,
  type ParsedIntent,
  type WorldObject,
  type WorldState,
} from './sceneParser'
import './spatialLab.css'

const FLAGSHIP_PROMPT =
  'Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.'

interface SpeechResultEvent {
  results: ArrayLike<{ 0: { transcript: string } }>
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechResultEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type PipelinePhase = 0 | 1 | 2 | 3 | 4

type InspectorTab = 'intent' | 'world' | 'history'

function speechConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function Pipeline({ phase }: { phase: PipelinePhase }) {
  const stages = [
    'language',
    'interpreted intent',
    'world structure',
    'environment',
    'situated action',
  ]
  return (
    <ol className="spatial-pipeline" aria-label="Language-to-world pipeline">
      {stages.map((stage, index) => (
        <li
          key={stage}
          className={index < phase ? 'is-complete' : index === phase ? 'is-active' : ''}
        >
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{stage}</strong>
          {index < stages.length - 1 ? <i>→</i> : null}
        </li>
      ))}
    </ol>
  )
}

function MountainBackground({ world }: { world: WorldState }) {
  const sunset = world.timeOfDay === 'sunset'
  const night = world.timeOfDay === 'night'
  const dawn = world.timeOfDay === 'dawn'
  return (
    <g>
      <rect
        width="540"
        height="430"
        fill={night ? '#20283a' : sunset ? '#f4d7bd' : dawn ? '#e5d9df' : '#dae6ec'}
      />
      <circle
        cx="430"
        cy="83"
        r="34"
        fill={night ? '#e9edf3' : sunset ? '#ef7c4d' : '#f6d56b'}
        opacity=".9"
      />
      {night
        ? Array.from({ length: 18 }, (_, index) => (
            <circle
              key={index}
              cx={24 + ((index * 83) % 490)}
              cy={28 + ((index * 47) % 105)}
              r="1.2"
              fill="#fff"
              opacity=".78"
            />
          ))
        : null}
      <path
        d="M0 254 L72 145 L124 210 L206 93 L286 225 L361 132 L430 209 L493 121 L540 197 L540 430 L0 430Z"
        fill={night ? '#596273' : '#84958a'}
      />
      <path
        d="M0 293 L91 210 L160 274 L259 164 L336 272 L421 193 L540 281 L540 430 L0 430Z"
        fill={night ? '#303a48' : '#586c60'}
      />
      <path
        d="M0 343 Q144 309 270 335 T540 326 L540 430 L0 430Z"
        fill={night ? '#202a2b' : '#304a3a'}
      />
    </g>
  )
}

function ForestBackground({ world }: { world: WorldState }) {
  const night = world.timeOfDay === 'night'
  return (
    <g>
      <rect width="540" height="430" fill={night ? '#192d29' : '#dce7db'} />
      {Array.from({ length: 15 }, (_, index) => {
        const x = 12 + index * 39
        const height = 92 + ((index * 31) % 100)
        return (
          <g key={index}>
            <rect
              x={x}
              y={345 - height}
              width="8"
              height={height}
              fill={night ? '#273f37' : '#6d806b'}
            />
            <circle
              cx={x + 4}
              cy={337 - height}
              r={28 + (index % 3) * 7}
              fill={night ? '#213c32' : '#82997b'}
            />
          </g>
        )
      })}
      <path d="M0 346 Q180 311 540 338 L540 430 L0 430Z" fill={night ? '#12251f' : '#395443'} />
    </g>
  )
}

function CityBackground({ world }: { world: WorldState }) {
  const night = world.timeOfDay === 'night'
  return (
    <g>
      <rect width="540" height="430" fill={night ? '#1c2433' : '#dce5eb'} />
      {Array.from({ length: 11 }, (_, index) => {
        const x = index * 52
        const height = 88 + ((index * 37) % 155)
        return (
          <g key={index}>
            <rect
              x={x}
              y={340 - height}
              width="44"
              height={height}
              fill={night ? '#303b4a' : '#85929a'}
            />
            {Array.from({ length: 3 }, (_, row) => (
              <rect
                key={row}
                x={x + 9}
                y={355 - height + row * 24}
                width="7"
                height="10"
                fill={night ? '#f3cf72' : '#d9e1e5'}
              />
            ))}
          </g>
        )
      })}
      <rect y="340" width="540" height="90" fill={night ? '#111820' : '#6a7377'} />
    </g>
  )
}

function OceanBackground({ world }: { world: WorldState }) {
  const sunset = world.timeOfDay === 'sunset'
  const night = world.timeOfDay === 'night'
  return (
    <g>
      <rect width="540" height="430" fill={night ? '#1b2940' : sunset ? '#f1c6b8' : '#d9eaf0'} />
      <circle cx="420" cy="84" r="30" fill={night ? '#edf0f5' : sunset ? '#ef724d' : '#f3d765'} />
      <path
        d="M0 225 Q80 210 150 228 T300 223 T440 226 T540 215 L540 430 L0 430Z"
        fill={night ? '#1c4960' : '#4f98ad'}
      />
      <path d="M0 315 Q180 281 540 310 L540 430 L0 430Z" fill="#d9c39b" />
    </g>
  )
}

function StudioBackground({ world }: { world: WorldState }) {
  const night = world.timeOfDay === 'night'
  return (
    <g>
      <rect width="540" height="430" fill={night ? '#2a2d31' : '#e9ebe7'} />
      <path d="M0 0 H540 V318 H0Z" fill={night ? '#33373b' : '#f4f5f1'} />
      <path d="M0 318 H540 V430 H0Z" fill={night ? '#17191b' : '#cfd3ca'} />
      <line x1="270" y1="0" x2="270" y2="318" stroke={night ? '#464a4f' : '#d9ddd4'} />
    </g>
  )
}

function Environment({ world }: { world: WorldState }) {
  if (world.environment === 'mountain') return <MountainBackground world={world} />
  if (world.environment === 'forest') return <ForestBackground world={world} />
  if (world.environment === 'city') return <CityBackground world={world} />
  if (world.environment === 'ocean') return <OceanBackground world={world} />
  return <StudioBackground world={world} />
}

function ObjectGlyph({ object }: { object: WorldObject }) {
  const common = { transform: `translate(${object.x} ${object.y})` }
  const label = (
    <text x="0" y="38" textAnchor="middle" fill="#111310" fontSize="8">
      {object.label}
    </text>
  )
  let glyph: ReactNode
  switch (object.kind) {
    case 'laboratory':
      glyph = (
        <g>
          <rect
            x="-78"
            y="-64"
            width="156"
            height="104"
            rx="7"
            fill="rgba(255,255,255,.88)"
            stroke="#424a43"
            strokeWidth="1.5"
          />
          <path
            d="M-89 -64 L0 -103 L89 -64"
            fill="rgba(255,255,255,.88)"
            stroke="#424a43"
            strokeWidth="1.5"
          />
          <rect x="-19" y="-14" width="38" height="54" fill="#d8ddd5" stroke="#424a43" />
          <rect x="-61" y="-37" width="30" height="23" fill="#8bb4c0" stroke="#424a43" />
          <rect x="31" y="-37" width="30" height="23" fill="#8bb4c0" stroke="#424a43" />
        </g>
      )
      break
    case 'table':
      glyph = (
        <g>
          <rect x="-43" y="-15" width="86" height="13" rx="3" fill="#8a6b4d" stroke="#513c2c" />
          <line x1="-34" y1="-2" x2="-34" y2="31" stroke="#513c2c" strokeWidth="5" />
          <line x1="34" y1="-2" x2="34" y2="31" stroke="#513c2c" strokeWidth="5" />
        </g>
      )
      break
    case 'robotic-arm':
      glyph = (
        <g>
          <rect x="-24" y="22" width="48" height="10" rx="4" fill="#464c50" />
          <line
            x1="-9"
            y1="22"
            x2="-4"
            y2="-12"
            stroke="#c9472d"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="-4" cy="-12" r="7" fill="#fff" stroke="#c9472d" strokeWidth="4" />
          <line
            x1="-4"
            y1="-12"
            x2="24"
            y2="-31"
            stroke="#c9472d"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="24" cy="-31" r="6" fill="#fff" stroke="#c9472d" strokeWidth="3" />
          <path d="M24 -31 L38 -22 M24 -31 L36 -39" stroke="#333" strokeWidth="3" />
        </g>
      )
      break
    case 'microscope':
      glyph = (
        <g>
          <rect x="-22" y="24" width="44" height="7" rx="3" fill="#285ec4" />
          <path d="M-8 22 Q-24 -4 -5 -27" fill="none" stroke="#285ec4" strokeWidth="7" />
          <rect
            x="-8"
            y="-34"
            width="12"
            height="30"
            rx="4"
            transform="rotate(-35 -2 -19)"
            fill="#fff"
            stroke="#285ec4"
            strokeWidth="3"
          />
          <line x1="-15" y1="9" x2="13" y2="9" stroke="#333" strokeWidth="4" />
        </g>
      )
      break
    case 'sample':
      glyph = (
        <g>
          <ellipse cx="0" cy="8" rx="21" ry="7" fill="#fff" stroke="#596159" />
          <ellipse cx="0" cy="5" rx="12" ry="4" fill="#e3b84f" />
        </g>
      )
      break
    case 'telescope':
      glyph = (
        <g>
          <rect
            x="-7"
            y="-31"
            width="48"
            height="15"
            rx="7"
            transform="rotate(-25 17 -23)"
            fill="#fff"
            stroke="#285ec4"
            strokeWidth="3"
          />
          <line x1="10" y1="-13" x2="-14" y2="27" stroke="#333" strokeWidth="4" />
          <line x1="10" y1="-13" x2="28" y2="27" stroke="#333" strokeWidth="4" />
        </g>
      )
      break
    case 'drone':
      glyph = (
        <g>
          <rect x="-17" y="-8" width="34" height="16" rx="5" fill="#31373b" />
          <line x1="-12" y1="0" x2="-31" y2="-15" stroke="#31373b" strokeWidth="3" />
          <line x1="12" y1="0" x2="31" y2="-15" stroke="#31373b" strokeWidth="3" />
          <ellipse cx="-32" cy="-17" rx="15" ry="3" fill="none" stroke="#285ec4" />
          <ellipse cx="32" cy="-17" rx="15" ry="3" fill="none" stroke="#285ec4" />
        </g>
      )
      break
    case 'screen':
      glyph = (
        <g>
          <rect x="-31" y="-28" width="62" height="42" rx="4" fill="#1f2732" stroke="#69747e" />
          <path d="M-23 2 L-9 -9 L2 -1 L20 -18" fill="none" stroke="#67b8d0" strokeWidth="2" />
          <line y1="14" y2="27" stroke="#333" strokeWidth="4" />
        </g>
      )
      break
    case 'lamp':
      glyph = (
        <g>
          <path d="M-20 -6 H20 L12 -29 H-12Z" fill="#f2c85a" stroke="#7a6324" />
          <line y1="-6" y2="27" stroke="#333" strokeWidth="4" />
          <line x1="-16" y1="27" x2="16" y2="27" stroke="#333" strokeWidth="4" />
        </g>
      )
      break
    case 'chair':
      glyph = (
        <g>
          <rect x="-18" y="-4" width="36" height="10" fill="#596159" />
          <rect x="-18" y="-31" width="8" height="30" fill="#596159" />
          <line x1="-12" y1="6" x2="-15" y2="30" stroke="#333" strokeWidth="4" />
          <line x1="12" y1="6" x2="15" y2="30" stroke="#333" strokeWidth="4" />
        </g>
      )
      break
    case 'plant':
      glyph = (
        <g>
          <path d="M-16 10 H16 L11 31 H-11Z" fill="#a46b42" />
          <path
            d="M0 10 C-18 -3 -20 -22 -2 -14 C-5 -34 16 -35 10 -12 C29 -24 29 0 7 6"
            fill="#4d825a"
            stroke="#2f603d"
          />
        </g>
      )
      break
    default:
      glyph = <circle r="20" fill="#fff" stroke="#333" />
  }
  return (
    <g {...common} className="world-object" data-selected={object.selected ? 'true' : 'false'}>
      {glyph}
      {label}
      {object.relation ? (
        <text x="0" y="50" textAnchor="middle" fill="#666c64" fontSize="6">
          {object.relation}
        </text>
      ) : null}
    </g>
  )
}

function WorldCanvas({
  world,
  phase,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  world: WorldState
  phase: PipelinePhase
  dragging: string | null
  onDragStart: (id: string, event: ReactPointerEvent<SVGGElement>) => void
  onDragMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  onDragEnd: () => void
}) {
  const target = world.objects.find((object) => object.id === world.action?.targetId)
  return (
    <svg
      className="world-canvas"
      viewBox="0 0 540 430"
      role="img"
      aria-label="Persistent world generated from the interpreted scene command"
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <Environment world={world} />
      <rect y="365" width="540" height="65" fill="rgba(0,0,0,.11)" />
      {phase >= 2
        ? world.objects.map((object) => (
            <g
              key={object.id}
              data-scene-object={object.id}
              onPointerDown={(event) => onDragStart(object.id, event)}
              className={dragging === object.id ? 'is-dragging' : ''}
            >
              <ObjectGlyph object={object} />
            </g>
          ))
        : null}
      {phase >= 3 ? (
        <g transform={`translate(${world.agent.x} ${world.agent.y})`} className="scene-agent">
          <circle r="14" fill="#e4b340" stroke="#6f5411" strokeWidth="2" />
          <circle cx="-4" cy="-2" r="2" fill="#111" />
          <circle cx="4" cy="-2" r="2" fill="#111" />
          <path d="M-5 5 Q0 9 5 5" fill="none" stroke="#111" />
          <text y="29" textAnchor="middle" fill="#111310" fontSize="8">
            {world.agent.label}
          </text>
        </g>
      ) : null}
      {phase >= 4 && target ? (
        <path
          d={`M ${world.agent.x} ${world.agent.y} Q ${(world.agent.x + target.x) / 2} ${Math.min(world.agent.y, target.y) - 50} ${target.x} ${target.y}`}
          fill="none"
          stroke="#e4b340"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          className="agent-path"
        />
      ) : null}
      <g transform="translate(18 18)">
        <rect width="190" height="42" rx="5" fill="rgba(255,255,255,.86)" />
        <text x="12" y="17" fill="#666c64" fontSize="8">
          persistent world · revision {world.revision}
        </text>
        <text x="12" y="32" fill="#111310" fontSize="10">
          {world.environment} · {world.timeOfDay} · {world.mood}
        </text>
      </g>
    </svg>
  )
}

function IntentPanel({ intent }: { intent: ParsedIntent | null }) {
  if (!intent)
    return (
      <div className="spatial-empty">
        <strong>No interpretation yet.</strong>
        <p>Submit the example or describe another world.</p>
      </div>
    )
  return (
    <div className="intent-panel">
      <div className="intent-head">
        <span>{intent.operation}</span>
        <strong>{Math.round(intent.confidence * 100)}% parser confidence</strong>
      </div>
      <dl>
        <div>
          <dt>environment</dt>
          <dd>{intent.environment ?? 'unchanged'}</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd>{intent.timeOfDay ?? 'unchanged'}</dd>
        </div>
        <div>
          <dt>mood</dt>
          <dd>{intent.mood ?? 'unchanged'}</dd>
        </div>
        <div>
          <dt>additions</dt>
          <dd>
            {intent.additions.length
              ? intent.additions.map((item) => item.kind).join(' · ')
              : 'none'}
          </dd>
        </div>
        <div>
          <dt>removals</dt>
          <dd>{intent.removals.length ? intent.removals.join(' · ') : 'none'}</dd>
        </div>
        <div>
          <dt>agent action</dt>
          <dd>
            {intent.action
              ? `${intent.action.verb}${intent.action.targetKind ? ` → ${intent.action.targetKind}` : ''}`
              : 'none'}
          </dd>
        </div>
      </dl>
      {intent.unresolved.length ? (
        <p className="intent-warning">Unresolved language: {intent.unresolved.join(' · ')}</p>
      ) : null}
    </div>
  )
}

export function SpatialLabPage() {
  const [prompt, setPrompt] = useState(FLAGSHIP_PROMPT)
  const [world, setWorld] = useState<WorldState>(DEFAULT_WORLD)
  const [intent, setIntent] = useState<ParsedIntent | null>(null)
  const [phase, setPhase] = useState<PipelinePhase>(0)
  const [tab, setTab] = useState<InspectorTab>('intent')
  const [listening, setListening] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [status, setStatus] = useState(
    'Describe a world. The interpretation and state transition will remain visible.',
  )
  const timers = useRef<number[]>([])
  const recognition = useRef<SpeechRecognitionInstance | null>(null)
  const speechAvailable = useMemo(
    () => typeof window !== 'undefined' && Boolean(speechConstructor()),
    [],
  )

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay)
    timers.current.push(timer)
  }

  const execute = (command: string) => {
    const nextIntent = parseSceneCommand(command)
    setIntent(nextIntent)
    setPhase(1)
    setStatus('Language captured. Revealing the parser’s structured interpretation…')
    schedule(() => {
      setPhase(2)
      setStatus('Applying a typed world-state edit without discarding the existing scene…')
    }, 420)
    schedule(() => {
      setWorld((current) => applySceneIntent(current, nextIntent))
      setPhase(3)
      setStatus(
        'World state updated. Objects remain directly manipulable and future commands will edit this revision.',
      )
    }, 840)
    schedule(() => {
      setPhase(4)
      setStatus(
        nextIntent.action
          ? 'The agent action is planned. Run it when you are ready.'
          : 'The persistent world is ready for another spoken, typed, or direct edit.',
      )
    }, 1260)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const command = prompt.trim()
    if (!command) return
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
    execute(command)
  }

  const toggleSpeech = () => {
    if (!speechAvailable) return
    if (listening) {
      recognition.current?.stop()
      setListening(false)
      return
    }
    const Constructor = speechConstructor()
    if (!Constructor) return
    const instance = new Constructor()
    instance.continuous = false
    instance.interimResults = false
    instance.lang = 'en-US'
    instance.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim()
      if (transcript) {
        setPrompt(transcript)
        execute(transcript)
      }
    }
    instance.onend = () => setListening(false)
    instance.onerror = () => {
      setListening(false)
      setStatus('Speech recognition failed. The text interface remains fully available.')
    }
    recognition.current = instance
    setListening(true)
    setStatus('Listening…')
    instance.start()
  }

  const startDrag = (id: string, event: ReactPointerEvent<SVGGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(id)
  }
  const drag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 540
    const y = ((event.clientY - rect.top) / rect.height) * 430
    setWorld((current) =>
      moveWorldObject(
        current,
        dragging,
        Math.max(30, Math.min(510, x)),
        Math.max(70, Math.min(350, y)),
      ),
    )
  }
  const endDrag = () => setDragging(null)

  const runAction = () => {
    setWorld((current) => runAgentAction(current))
    setStatus(
      'The agent executed against the existing world state. No scene regeneration occurred.',
    )
  }

  const reset = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
    setWorld(DEFAULT_WORLD)
    setIntent(null)
    setPhase(0)
    setPrompt(FLAGSHIP_PROMPT)
    setStatus('World reset. Submit the example to rebuild it visibly.')
  }

  return (
    <div className="spatial-page">
      <PortfolioHeader />
      <main>
        <section className="spatial-hero" id="top">
          <div>
            <p className="portfolio-kicker">Generative AI × spatial computing</p>
            <h1>Speak a world into persistent state.</h1>
          </div>
          <div className="spatial-hero-side">
            <p>
              Language is interpreted into a typed scene, the world changes visibly, objects remain
              manipulable, and agent actions operate on the same evolving environment.
            </p>
            <span>Live browser laboratory · no paid API</span>
          </div>
        </section>

        <section className="spatial-lab" id="lab">
          <form className="spatial-command" onSubmit={submit}>
            <div className="spatial-command-label">
              <label htmlFor="spatial-scene-description">Describe the scene</label>
              <i>{world.history.length ? `persistent revision ${world.revision}` : 'new world'}</i>
            </div>
            <textarea
              id="spatial-scene-description"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              aria-label="Describe the scene"
            />
            <div className="spatial-command-actions">
              <button
                type="submit"
                className="is-primary"
                aria-label="Build or update world"
              >
                Build or update world
              </button>
              <button
                type="button"
                onClick={toggleSpeech}
                disabled={!speechAvailable}
                className={listening ? 'is-listening' : ''}
              >
                {listening
                  ? 'Stop listening'
                  : speechAvailable
                    ? 'Speak instruction'
                    : 'Speech unavailable'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    'Add a telescope, change the scene to night, and let the agent observe it.',
                  )
                }
              >
                Try a follow-up
              </button>
              <button type="button" onClick={reset}>
                Reset
              </button>
            </div>
          </form>

          <Pipeline phase={phase} />
          <p className="spatial-status" aria-live="polite">
            {status}
          </p>

          <div className="spatial-workspace">
            <div className="spatial-world-shell">
              <div className="spatial-world-head">
                <div>
                  <span>World canvas</span>
                  <strong>Drag any object. Follow-up language edits this same state.</strong>
                </div>
                {world.action ? (
                  <button
                    type="button"
                    onClick={runAction}
                    disabled={world.action.status === 'complete'}
                  >
                    {world.action.status === 'complete'
                      ? 'Action complete'
                      : `Run agent: ${world.action.verb}`}
                  </button>
                ) : null}
              </div>
              <WorldCanvas
                world={world}
                phase={phase}
                dragging={dragging}
                onDragStart={startDrag}
                onDragMove={drag}
                onDragEnd={endDrag}
              />
            </div>

            <aside className="spatial-inspector">
              <div className="spatial-tabs" role="tablist">
                {(['intent', 'world', 'history'] as InspectorTab[]).map((item) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === item}
                    className={tab === item ? 'is-active' : ''}
                    onClick={() => setTab(item)}
                    key={item}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {tab === 'intent' ? <IntentPanel intent={intent} /> : null}
              {tab === 'world' ? <pre>{JSON.stringify(world, null, 2)}</pre> : null}
              {tab === 'history' ? (
                <div className="spatial-history">
                  {world.history.length ? (
                    world.history.map((command, index) => (
                      <article className="spatial-history-item" key={`${command}-${index}`}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <p>{command}</p>
                      </article>
                    ))
                  ) : (
                    <div className="spatial-empty">
                      <strong>No commands yet.</strong>
                      <p>Each edit will remain visible here.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="spatial-explanation">
          <header>
            <p className="portfolio-kicker">What is real here</p>
            <h2>A controlled, inspectable prototype—not a simulated miracle.</h2>
          </header>
          <div>
            <article>
              <span>01</span>
              <h3>Browser-native speech</h3>
              <p>
                When supported, the Web Speech API transcribes the instruction. Text remains the
                reliable fallback.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Visible deterministic interpretation</h3>
              <p>
                A transparent parser extracts environment, time, objects, relations, removals, and
                agent action into a model-ready schema.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Persistent world state</h3>
              <p>
                Commands produce typed edits. Existing objects survive follow-ups, direct dragging
                changes coordinates, and history remains inspectable.
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>Situated action</h3>
              <p>
                The agent resolves a target inside the current world and acts against that state
                rather than prompting a disconnected generation.
              </p>
            </article>
          </div>
        </section>

        <section className="spatial-boundary">
          <p className="portfolio-kicker">The next scientific threshold</p>
          <h2>
            Replace the deterministic interpreter and code-native object library with learned
            semantic parsing, generated assets, physics, 6DoF interaction, and embodied
            policies—without losing the state and evidence contract.
          </h2>
          <Link className="portfolio-button" to="/">
            Return to the atlas
          </Link>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
