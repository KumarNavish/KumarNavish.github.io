import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'

import { PortfolioFooter, PortfolioHeader } from '../shared/PortfolioHeader'
import {
  applySceneIntent,
  EMPTY_WORLD,
  moveSceneObject,
  parseSceneCommand,
  type SceneAgent,
  type SceneIntent,
  type SceneObject,
  type SceneObjectKind,
  type TimeOfDay,
  type WorldState,
} from './sceneParser'
import './spatialLab.css'

type BuildPhase = 'idle' | 'language' | 'intent' | 'world' | 'action'

interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const FLAGSHIP_PROMPT =
  'Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.'

const PROMPT_PRESETS = [
  FLAGSHIP_PROMPT,
  'Change the world to night, add a telescope near the lab, and let the agent observe the sky.',
  'Add a drone and a research screen. Move the sample onto the lab table.',
  'Turn this into a forest laboratory at dawn and remove the robotic arm.',
]

function timePalette(time: TimeOfDay) {
  switch (time) {
    case 'sunset':
      return {
        skyA: '#f4c48d',
        skyB: '#9aa6d8',
        glow: '#ef8e58',
        terrainA: '#51655f',
        terrainB: '#304842',
      }
    case 'night':
      return {
        skyA: '#15213c',
        skyB: '#3f4866',
        glow: '#d8e0ff',
        terrainA: '#263c42',
        terrainB: '#182b31',
      }
    case 'dawn':
      return {
        skyA: '#f2d6c5',
        skyB: '#b8cde2',
        glow: '#ffd8a4',
        terrainA: '#61776e',
        terrainB: '#435d55',
      }
    case 'day':
    default:
      return {
        skyA: '#dceafa',
        skyB: '#f4f7f4',
        glow: '#ffffff',
        terrainA: '#6f8b7f',
        terrainB: '#4d6f63',
      }
  }
}

function ObjectGlyph({ kind }: { kind: SceneObjectKind }) {
  switch (kind) {
    case 'robotic-arm':
      return (
        <g>
          <rect x="-28" y="12" width="56" height="18" rx="7" fill="#2f3430" />
          <circle cx="-12" cy="8" r="10" fill="#c9472d" />
          <line x1="-12" y1="8" x2="12" y2="-22" stroke="#c9472d" strokeWidth="9" strokeLinecap="round" />
          <circle cx="12" cy="-22" r="8" fill="#c9472d" />
          <line x1="12" y1="-22" x2="28" y2="-42" stroke="#c9472d" strokeWidth="8" strokeLinecap="round" />
          <path d="M24 -50L34 -44L29 -35" fill="none" stroke="#2f3430" strokeWidth="5" strokeLinecap="round" />
        </g>
      )
    case 'microscope':
      return (
        <g>
          <rect x="-28" y="19" width="60" height="11" rx="5.5" fill="#2f3430" />
          <path d="M-4 17C-3 -5 5 -22 22 -34" fill="none" stroke="#285ec4" strokeWidth="10" strokeLinecap="round" />
          <rect x="14" y="-45" width="17" height="28" rx="6" transform="rotate(28 22 -31)" fill="#2f3430" />
          <rect x="-8" y="2" width="36" height="6" rx="3" fill="#6b716b" />
        </g>
      )
    case 'sample':
      return (
        <g>
          <ellipse cx="0" cy="8" rx="24" ry="9" fill="rgba(40,94,196,.2)" stroke="#285ec4" strokeWidth="3" />
          <ellipse cx="0" cy="4" rx="17" ry="5" fill="#ffffff" opacity="0.8" />
          <circle cx="5" cy="2" r="4" fill="#1b6b50" />
        </g>
      )
    case 'lab-table':
      return (
        <g>
          <rect x="-56" y="-2" width="112" height="16" rx="6" fill="#d6d2c5" stroke="#7a8178" strokeWidth="2" />
          <line x1="-42" y1="14" x2="-48" y2="54" stroke="#5b625b" strokeWidth="6" />
          <line x1="42" y1="14" x2="48" y2="54" stroke="#5b625b" strokeWidth="6" />
        </g>
      )
    case 'telescope':
      return (
        <g>
          <rect x="-30" y="-28" width="64" height="18" rx="9" transform="rotate(-18)" fill="#2f3430" />
          <circle cx="30" cy="-18" r="10" fill="#285ec4" />
          <line x1="4" y1="-10" x2="-8" y2="46" stroke="#6b716b" strokeWidth="5" />
          <line x1="-8" y1="44" x2="-36" y2="61" stroke="#6b716b" strokeWidth="4" />
          <line x1="-8" y1="44" x2="20" y2="61" stroke="#6b716b" strokeWidth="4" />
        </g>
      )
    case 'drone':
      return (
        <g>
          <rect x="-20" y="-8" width="40" height="16" rx="8" fill="#2f3430" />
          <line x1="-16" y1="0" x2="-42" y2="-14" stroke="#2f3430" strokeWidth="4" />
          <line x1="16" y1="0" x2="42" y2="-14" stroke="#2f3430" strokeWidth="4" />
          <line x1="-16" y1="0" x2="-42" y2="14" stroke="#2f3430" strokeWidth="4" />
          <line x1="16" y1="0" x2="42" y2="14" stroke="#2f3430" strokeWidth="4" />
          {[[-42,-14],[42,-14],[-42,14],[42,14]].map(([x,y]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="18" ry="4" fill="none" stroke="#285ec4" strokeWidth="2" />)}
        </g>
      )
    case 'lamp':
      return (
        <g>
          <line x1="0" y1="-28" x2="0" y2="42" stroke="#2f3430" strokeWidth="5" />
          <path d="M-24 -28H24L15 -52H-15Z" fill="#efc46f" stroke="#8c6b2c" strokeWidth="2" />
          <ellipse cx="0" cy="44" rx="26" ry="8" fill="#2f3430" />
        </g>
      )
    case 'screen':
      return (
        <g>
          <rect x="-42" y="-32" width="84" height="54" rx="7" fill="#19233b" stroke="#707878" strokeWidth="3" />
          <path d="M-29 5L-13 -4L2 2L19 -15L31 -8" fill="none" stroke="#6fc8b0" strokeWidth="3" />
          <line x1="0" y1="22" x2="0" y2="42" stroke="#444b47" strokeWidth="5" />
          <line x1="-24" y1="42" x2="24" y2="42" stroke="#444b47" strokeWidth="5" />
        </g>
      )
    case 'chair':
      return (
        <g>
          <rect x="-26" y="-8" width="52" height="16" rx="6" fill="#b98452" />
          <rect x="-26" y="-44" width="52" height="34" rx="8" fill="#c89a68" />
          <line x1="-18" y1="8" x2="-22" y2="46" stroke="#5c4b3c" strokeWidth="5" />
          <line x1="18" y1="8" x2="22" y2="46" stroke="#5c4b3c" strokeWidth="5" />
        </g>
      )
    case 'plant':
      return (
        <g>
          <path d="M0 24C-18 -10 -38 -18 -42 -40C-14 -38 -4 -22 0 0C8 -31 27 -42 44 -50C47 -22 24 -8 2 10" fill="#5d8f6f" />
          <path d="M-28 23H28L20 56H-20Z" fill="#aa7650" />
        </g>
      )
  }
}

function AgentGlyph({ agent, target }: { agent: SceneAgent; target?: SceneObject }) {
  const moving = agent.action !== 'idle' && target
  const destinationX = target ? Math.max(96, Math.min(724, target.x - 50)) : agent.x
  const destinationY = target ? Math.max(100, Math.min(390, target.y + 8)) : agent.y
  const translateX = moving ? destinationX - agent.x : 0
  const translateY = moving ? destinationY - agent.y : 0
  return (
    <g transform={`translate(${agent.x} ${agent.y})`}>
      <g
        className={moving ? 'spatial-agent is-active' : 'spatial-agent'}
        style={{ '--agent-x': `${translateX}px`, '--agent-y': `${translateY}px` } as CSSProperties}
      >
        <circle cx="0" cy="-33" r="14" fill="#f2c4a2" stroke="#2f3430" strokeWidth="2" />
        <rect x="-13" y="-18" width="26" height="42" rx="11" fill="#1b6b50" />
        <line x1="-9" y1="24" x2="-17" y2="52" stroke="#2f3430" strokeWidth="6" strokeLinecap="round" />
        <line x1="9" y1="24" x2="17" y2="52" stroke="#2f3430" strokeWidth="6" strokeLinecap="round" />
        <line x1="-13" y1="-9" x2="-31" y2="10" stroke="#2f3430" strokeWidth="5" strokeLinecap="round" />
        <line x1="13" y1="-9" x2="31" y2="10" stroke="#2f3430" strokeWidth="5" strokeLinecap="round" />
        <rect x="-35" y="57" width="70" height="20" rx="10" fill="#ffffff" stroke="#d9ddd4" />
        <text x="0" y="71" textAnchor="middle">{agent.action}</text>
      </g>
    </g>
  )
}

function EnvironmentLayer({ world }: { world: WorldState }) {
  const palette = timePalette(world.timeOfDay)
  const showStars = world.timeOfDay === 'night'
  return (
    <g>
      <rect width="820" height="520" fill={palette.skyA} />
      <rect y="180" width="820" height="340" fill={palette.skyB} opacity="0.78" />
      <circle cx={world.timeOfDay === 'sunset' ? 644 : 680} cy={world.timeOfDay === 'sunset' ? 150 : 92} r={world.timeOfDay === 'sunset' ? 48 : 34} fill={palette.glow} opacity="0.88" />
      {showStars ? Array.from({ length: 30 }, (_, index) => <circle key={index} cx={35 + (index * 71) % 760} cy={26 + (index * 43) % 160} r={index % 4 === 0 ? 2 : 1} fill="#ffffff" opacity={0.45 + (index % 5) * 0.1} />) : null}

      {world.environment === 'mountain-lab' || world.environment === 'empty' ? (
        <>
          <path d="M0 286L115 150L208 250L335 96L474 254L602 142L820 318V520H0Z" fill={palette.terrainA} opacity="0.82" />
          <path d="M0 350L160 230L260 340L426 196L592 324L712 238L820 302V520H0Z" fill={palette.terrainB} />
          <path d="M290 156L335 96L381 166L350 150L335 126L319 151Z" fill="#f2f4f0" opacity="0.85" />
          <path d="M565 184L602 142L642 196L614 184L602 165L588 184Z" fill="#f2f4f0" opacity="0.8" />
        </>
      ) : null}

      {world.environment === 'forest-lab' ? (
        <>
          <rect y="300" width="820" height="220" fill="#405d49" />
          {Array.from({ length: 17 }, (_, index) => {
            const x = 20 + index * 52
            const height = 80 + (index % 5) * 18
            return (
              <g key={index} transform={`translate(${x} ${318 - height / 2})`}>
                <rect x="-5" y={height * 0.6} width="10" height={height * 0.5} fill="#5d4939" />
                <path d={`M0 0L${-28 - (index % 3) * 4} ${height * 0.72}H${28 + (index % 3) * 4}Z`} fill={index % 2 ? '#2f6048' : '#3b7356'} />
              </g>
            )
          })}
        </>
      ) : null}

      {world.environment === 'city-studio' ? (
        <>
          <rect y="304" width="820" height="216" fill="#59636c" />
          {Array.from({ length: 13 }, (_, index) => {
            const width = 42 + (index % 4) * 12
            const height = 95 + (index % 5) * 27
            return (
              <g key={index} transform={`translate(${index * 66 - 12} ${304 - height})`}>
                <rect width={width} height={height} fill={index % 2 ? '#737d84' : '#667078'} />
                {Array.from({ length: 4 }, (_, row) => <rect key={row} x="10" y={14 + row * 22} width={width - 20} height="7" fill="#f4d990" opacity="0.55" />)}
              </g>
            )
          })}
        </>
      ) : null}

      {world.environment === 'ocean-station' ? (
        <>
          <rect y="270" width="820" height="250" fill="#3c7291" />
          <path d="M0 286C100 252 189 312 292 280C389 249 482 302 581 278C671 256 744 300 820 275V520H0Z" fill="#5f9bb4" opacity="0.74" />
          <path d="M0 326C112 290 216 348 338 315C456 284 552 340 678 306C730 292 778 299 820 317" fill="none" stroke="#d7eef4" strokeWidth="5" opacity="0.55" />
        </>
      ) : null}

      <path d="M82 366L740 366L790 485L30 485Z" fill="rgba(244,245,241,.93)" stroke="#bdc4bb" strokeWidth="2" />
      <path d="M132 390L690 390L724 464L98 464Z" fill="rgba(255,255,255,.82)" stroke="#d9ddd4" />
      <text x="58" y="505" fill="rgba(17,19,16,.58)">persistent world revision {world.revision}</text>
    </g>
  )
}

function WorldCanvas({
  world,
  phase,
  selectedId,
  onSelect,
  onMove,
}: {
  world: WorldState
  phase: BuildPhase
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingRef = useRef<string | null>(null)

  const pointerToCanvas = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * 820,
      y: ((event.clientY - rect.top) / rect.height) * 520,
    }
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    const point = pointerToCanvas(event)
    onMove(draggingRef.current, point.x, point.y)
  }, [onMove, pointerToCanvas])

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null
  }, [])

  return (
    <svg
      ref={svgRef}
      className={`spatial-world-canvas phase-${phase}`}
      viewBox="0 0 820 520"
      role="img"
      aria-label="Persistent generated world"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={() => onSelect(null)}
    >
      <EnvironmentLayer world={world} />
      <g opacity={phase === 'language' || phase === 'intent' ? 0.38 : 1}>
        {world.objects.map((object, index) => (
          <g
            key={object.id}
            className={selectedId === object.id ? 'spatial-object is-selected' : 'spatial-object'}
            transform={`translate(${object.x} ${object.y})`}
            style={{ '--object-delay': `${index * 55}ms` } as CSSProperties}
            onPointerDown={(event) => {
              event.stopPropagation()
              draggingRef.current = object.id
              onSelect(object.id)
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <circle className="spatial-object-hit" cx="0" cy="0" r="54" />
            <ObjectGlyph kind={object.kind} />
            <rect x="-42" y="62" width="84" height="20" rx="10" fill="#ffffff" stroke="#d9ddd4" />
            <text x="0" y="76" textAnchor="middle">{object.label}</text>
          </g>
        ))}

        {world.agents.map((agent) => (
          <AgentGlyph
            key={agent.id}
            agent={agent}
            target={agent.targetKind ? world.objects.find((object) => object.kind === agent.targetKind) : undefined}
          />
        ))}
      </g>

      {world.objects.length === 0 ? (
        <g transform="translate(410 260)">
          <circle r="62" fill="rgba(255,255,255,.72)" stroke="#d9ddd4" strokeDasharray="7 7" />
          <text x="0" y="-5" textAnchor="middle" className="spatial-empty-title">The world is empty.</text>
          <text x="0" y="17" textAnchor="middle">Describe a place, object, and action.</text>
        </g>
      ) : null}
    </svg>
  )
}

function IntentInspector({ intent }: { intent: SceneIntent | null }) {
  if (!intent) {
    return (
      <div className="spatial-intent-empty">
        <span>Nothing interpreted yet.</span>
        <p>The parser will expose environment, time, objects, relations, and agent behavior before the world changes.</p>
      </div>
    )
  }

  return (
    <div className="spatial-intent-grid">
      <article>
        <span>Environment</span>
        <strong>{intent.environment ?? 'preserve current'}</strong>
      </article>
      <article>
        <span>Lighting</span>
        <strong>{intent.timeOfDay ?? 'preserve current'}</strong>
      </article>
      <article>
        <span>Add</span>
        <strong>{intent.addObjects.map((object) => object.kind).join(', ') || 'nothing'}</strong>
      </article>
      <article>
        <span>Remove</span>
        <strong>{intent.removeKinds.join(', ') || 'nothing'}</strong>
      </article>
      <article className="is-wide">
        <span>Agent</span>
        <strong>
          {intent.agentAction
            ? `${intent.agentAction}${intent.agentTarget ? ` → ${intent.agentTarget}` : ''}`
            : 'no new action'}
        </strong>
      </article>
      <article className="is-wide">
        <span>Concept trace</span>
        <div className="spatial-concept-chips">
          {intent.concepts.length > 0 ? intent.concepts.map((concept) => <i key={concept}>{concept}</i>) : <i>preserve world</i>}
        </div>
      </article>
    </div>
  )
}

function WorldStateInspector({ world }: { world: WorldState }) {
  const readable = JSON.stringify(
    {
      environment: world.environment,
      timeOfDay: world.timeOfDay,
      objects: world.objects.map(({ id, kind, x, y, relation }) => ({ id, kind, x: Math.round(x), y: Math.round(y), relation })),
      agents: world.agents,
      revision: world.revision,
    },
    null,
    2,
  )
  return <pre className="spatial-world-json">{readable}</pre>
}

export function SpatialLabPage() {
  const [command, setCommand] = useState(FLAGSHIP_PROMPT)
  const [world, setWorld] = useState<WorldState>(EMPTY_WORLD)
  const [intent, setIntent] = useState<SceneIntent | null>(null)
  const [phase, setPhase] = useState<BuildPhase>('idle')
  const [listening, setListening] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'intent' | 'world'>('intent')
  const timersRef = useRef<number[]>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const speechConstructor = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const executeCommand = useCallback((rawCommand: string) => {
    const normalized = rawCommand.trim()
    if (!normalized) return

    clearTimers()
    const nextIntent = parseSceneCommand(normalized)
    setPhase('language')
    setSelectedId(null)

    timersRef.current.push(
      window.setTimeout(() => {
        setIntent(nextIntent)
        setActivePanel('intent')
        setPhase('intent')
      }, 280),
      window.setTimeout(() => {
        setWorld((current) => applySceneIntent(current, nextIntent))
        setPhase('world')
      }, 850),
      window.setTimeout(() => {
        setPhase(nextIntent.agentAction ? 'action' : 'world')
      }, 1450),
    )
  }, [clearTimers])

  const startListening = useCallback(() => {
    if (!speechConstructor) return
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setListening(false)
      return
    }

    const recognition = new speechConstructor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const results = Array.from(event.results)
      const transcript = results.map((result) => result[0]?.transcript ?? '').join(' ').trim()
      if (transcript) setCommand(transcript)
      const finalTranscript = results.filter((result) => result.isFinal).map((result) => result[0]?.transcript ?? '').join(' ').trim()
      if (finalTranscript) executeCommand(finalTranscript)
    }
    recognition.onerror = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [executeCommand, speechConstructor])

  const moveObject = useCallback((id: string, x: number, y: number) => {
    setWorld((current) => moveSceneObject(current, id, x, y))
  }, [])

  const resetWorld = useCallback(() => {
    clearTimers()
    setWorld(EMPTY_WORLD)
    setIntent(null)
    setPhase('idle')
    setSelectedId(null)
  }, [clearTimers])

  const selectedObject = world.objects.find((object) => object.id === selectedId)

  return (
    <div className="spatial-lab-page" id="top">
      <PortfolioHeader compact />
      <main>
        <section className="spatial-hero">
          <div className="spatial-hero-meta">
            <Link to="/">← Research atlas</Link>
            <span>Active direction · live browser experiment</span>
          </div>
          <p className="spatial-kicker">Generative AI × spatial computing</p>
          <h1>Language should become a world you can keep editing.</h1>
          <p>
            Speak or type a scene. Watch the interface expose interpreted intent, persistent world
            structure, spatial objects, and situated agent action—then modify the same world instead
            of generating an unrelated image.
          </p>
        </section>

        <section className="spatial-lab-shell" aria-label="Speech to scene laboratory">
          <header className="spatial-lab-header">
            <div>
              <span>Live experiment</span>
              <strong>speech → intent → world → action</strong>
            </div>
            <div className="spatial-phase-track" aria-label={`Current build phase: ${phase}`}>
              {(['language', 'intent', 'world', 'action'] as const).map((item, index) => {
                const order = { idle: -1, language: 0, intent: 1, world: 2, action: 3 }
                const complete = order[phase] >= index
                return (
                  <div key={item} className={complete ? 'is-complete' : ''}>
                    <i>{index + 1}</i>
                    <span>{item}</span>
                  </div>
                )
              })}
            </div>
          </header>

          <div className="spatial-command-bar">
            <label>
              <span>Describe or edit the world</span>
              <textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                rows={3}
                placeholder="Create a quiet mountain laboratory at sunset…"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') executeCommand(command)
                }}
              />
            </label>
            <div className="spatial-command-actions">
              <button
                type="button"
                className={listening ? 'spatial-mic is-listening' : 'spatial-mic'}
                onClick={startListening}
                disabled={!speechConstructor}
                title={speechConstructor ? 'Speak a scene' : 'Speech recognition is not supported in this browser'}
              >
                <span aria-hidden="true">●</span>
                {listening ? 'Listening…' : speechConstructor ? 'Speak' : 'Speech unavailable'}
              </button>
              <button type="button" className="spatial-build-button" onClick={() => executeCommand(command)}>
                Apply to world
              </button>
              <button type="button" className="spatial-reset-button" onClick={resetWorld}>
                Reset
              </button>
            </div>
            <div className="spatial-prompt-presets" aria-label="Example commands">
              {PROMPT_PRESETS.map((preset, index) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCommand(preset)
                    if (index === 0 && world.commandHistory.length === 0) executeCommand(preset)
                  }}
                >
                  {index === 0 ? 'Build flagship scene' : `Edit ${index}`}
                </button>
              ))}
            </div>
          </div>

          <div className="spatial-workbench">
            <section className="spatial-inspector">
              <header>
                <div className="spatial-inspector-tabs" role="tablist" aria-label="Inspect generated state">
                  <button type="button" role="tab" aria-selected={activePanel === 'intent'} className={activePanel === 'intent' ? 'is-active' : ''} onClick={() => setActivePanel('intent')}>
                    Interpreted intent
                  </button>
                  <button type="button" role="tab" aria-selected={activePanel === 'world'} className={activePanel === 'world' ? 'is-active' : ''} onClick={() => setActivePanel('world')}>
                    World state
                  </button>
                </div>
                <span>Revision {world.revision}</span>
              </header>

              <div className="spatial-inspector-body">
                {activePanel === 'intent' ? <IntentInspector intent={intent} /> : <WorldStateInspector world={world} />}
              </div>

              <footer>
                <span>Command history</span>
                <ol>
                  {world.commandHistory.length > 0 ? world.commandHistory.slice().reverse().map((item, index) => (
                    <li key={`${item}-${index}`}>
                      <i>{world.commandHistory.length - index}</i>
                      <p>{item}</p>
                    </li>
                  )) : <li className="is-empty">No world edits yet.</li>}
                </ol>
              </footer>
            </section>

            <section className="spatial-world-shell">
              <header>
                <div>
                  <span>Persistent scene</span>
                  <strong>{world.environment} · {world.timeOfDay}</strong>
                </div>
                <p>Drag any object to edit the world directly.</p>
              </header>
              <WorldCanvas
                world={world}
                phase={phase}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={moveObject}
              />
              <footer>
                <div>
                  <span>Objects</span>
                  <strong>{world.objects.length}</strong>
                </div>
                <div>
                  <span>Agents</span>
                  <strong>{world.agents.length}</strong>
                </div>
                <div>
                  <span>Selected</span>
                  <strong>{selectedObject?.label ?? 'none'}</strong>
                </div>
                <div>
                  <span>State model</span>
                  <strong>persistent</strong>
                </div>
              </footer>
            </section>
          </div>

          <div className="spatial-honesty-note">
            <strong>What is live here</strong>
            <p>
              Speech recognition, semantic parsing, persistent scene-state updates, object relations,
              direct manipulation, and agent targeting all run in the browser. The public parser is
              intentionally deterministic so the demonstration remains fast, private, inspectable, and
              honest. Its scene schema is designed to be replaced by a model-backed interpreter without
              changing the world-state contract.
            </p>
          </div>
        </section>

        <section className="spatial-architecture" aria-labelledby="spatial-architecture-title">
          <div>
            <p className="spatial-kicker">The thesis</p>
            <h2 id="spatial-architecture-title">Generation is only the first transition.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <strong>Language becomes explicit intent.</strong>
              <p>Environment, objects, relations, tools, lighting, and behaviors remain inspectable.</p>
            </li>
            <li>
              <span>02</span>
              <strong>Intent becomes persistent world state.</strong>
              <p>Follow-up instructions edit the same scene instead of replacing it with a disconnected generation.</p>
            </li>
            <li>
              <span>03</span>
              <strong>Agents become situated.</strong>
              <p>Action is grounded in objects and space, not described as detached text.</p>
            </li>
            <li>
              <span>04</span>
              <strong>Direct interaction remains available.</strong>
              <p>Language and spatial manipulation operate on one shared state representation.</p>
            </li>
          </ol>
        </section>

        <section className="spatial-boundary">
          <p className="spatial-kicker">Boundary</p>
          <h2>This is a systems thesis made tangible—not a claim of open-world 3D generation.</h2>
          <p>
            The browser experiment uses a controlled visual vocabulary and deterministic parser. It
            demonstrates the product architecture—persistent intent, world state, direct edits, and
            situated action—without pretending that arbitrary spoken scenes can already become
            production-quality immersive environments locally and instantly.
          </p>
        </section>
      </main>
      <PortfolioFooter />
    </div>
  )
}
