import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import type { WorkRegistryEntry } from '../data/workRegistry'
import './workPreview.css'

const PREVIEW_STEPS = 5

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

function useInViewport<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: '160px 0px', threshold: 0.05 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, visible]
}

function usePreviewStep(active: boolean, reduced: boolean): [number, (step: number) => void] {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!active || reduced) return undefined
    const id = window.setInterval(() => setStep((value) => (value + 1) % PREVIEW_STEPS), 1150)
    return () => window.clearInterval(id)
  }, [active, reduced])
  return [step, setStep]
}

function PreviewFrame({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="work-preview-frame">
      {children}
      <div className="work-preview-readout">
        <span>{label}</span>
        <strong>{description}</strong>
      </div>
    </div>
  )
}

function NetworkPreview({ step, id }: { step: number; id: string }) {
  const nodes = [
    [30, 74],
    [74, 36],
    [88, 118],
    [132, 72],
    [174, 34],
    [202, 102],
  ]
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 5],
  ]
  return (
    <PreviewFrame
      label={['paired users', 'activity asymmetry', 'language asymmetry', 'response paths', 'empirical boundary'][step]}
      description={['observe', 'compare', 'measure', 'trace', 'do not infer causality'][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Paired hate and counter-user interaction network</title>
        {edges.map(([a, b], index) => (
          <line
            key={`${a}-${b}`}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            className={index <= Math.min(edges.length - 1, step + 1) ? 'preview-live' : ''}
          />
        ))}
        {nodes.map(([x, y], index) => (
          <g key={index} className={index < 3 ? 'preview-harm' : 'preview-protect'}>
            <circle cx={x} cy={y} r={step >= 1 && (index === 0 || index === 4) ? 10 : 7} />
            {step >= 2 ? <circle cx={x} cy={y} r={12 + ((index + step) % 3) * 2} className="preview-ring" /> : null}
          </g>
        ))}
        {step === 4 ? <text x="116" y="148" textAnchor="middle">association ≠ intervention proof</text> : null}
      </svg>
    </PreviewFrame>
  )
}

function GainPreview({ step, id, bounds }: { step: number; id: string; bounds: boolean }) {
  const nodes = [
    [32, 94],
    [76, 36],
    [144, 38],
    [198, 92],
    [152, 132],
    [72, 130],
  ]
  const phase = [0, 0.28, 0.78, 1.38, 1.92][step]
  const lambda = Math.max(0, Math.sin(phase / 2) ** 2 * 0.82)
  return (
    <PreviewFrame
      label={bounds ? 'frustration certificate' : 'normalized operator'}
      description={
        bounds
          ? [`balanced · λ₁=0`, `one gain rotates`, `cycle fails`, `λ₁=${lambda.toFixed(2)}`, `repair cost ≥ λ₁`][step]
          : ['relationships', 'degree scaling', 'Hermitian matrix', `spectrum shifts`, 'structure remains real'][step]
      }
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Gain graph, cycle consistency, and changing spectrum</title>
        {nodes.map(([x, y], index) => {
          const next = nodes[(index + 1) % nodes.length]
          return (
            <line
              key={index}
              x1={x}
              y1={y}
              x2={next[0]}
              y2={next[1]}
              className={index === 2 ? 'preview-phase-edge' : step >= 2 && index < 4 ? 'preview-live' : ''}
              style={index === 2 ? { strokeDashoffset: `${phase * 8}` } : undefined}
            />
          )
        })}
        <path d="M76 36 L144 38 L198 92 L152 132" className={step >= 2 ? 'preview-cycle' : ''} />
        {nodes.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="6" />)}
        <g transform="translate(18 12)">
          {[0, 1, 2, 3, 4].map((index) => (
            <rect
              key={index}
              x={index * 22}
              y={20 - Math.min(18, (index === 0 ? lambda : 0.2 + index * 0.13) * 20)}
              width="13"
              height={Math.max(2, (index === 0 ? lambda : 0.2 + index * 0.13) * 20)}
              className={index === 0 ? 'preview-spectrum-first' : 'preview-spectrum-bar'}
            />
          ))}
        </g>
      </svg>
    </PreviewFrame>
  )
}

function UrbanPreview({ step, id }: { step: number; id: string }) {
  const cells = Array.from({ length: 15 }, (_, index) => ({
    x: 24 + (index % 5) * 42 + (Math.floor(index / 5) % 2) * 20,
    y: 35 + Math.floor(index / 5) * 38,
    score: ((index * 23 + step * 17) % 100) / 100,
  }))
  return (
    <PreviewFrame
      label={['city average', 'micro-regions', 'local context', 'vehicle suitability', 'rollout decision'][step]}
      description={['hides variation', 'preserve location', 'predict service time', 'compare locally', 'calibrate in field'][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Urban hexagonal micro-regions and local cargo-bike suitability</title>
        {cells.map((cell, index) => (
          <polygon
            key={index}
            points="0,-17 15,-8.5 15,8.5 0,17 -15,8.5 -15,-8.5"
            transform={`translate(${cell.x} ${cell.y})`}
            style={{ opacity: step === 0 ? 0.35 : 0.18 + cell.score * 0.72 }}
          />
        ))}
        <path d="M14 140 C72 101 118 132 220 52" className={step >= 3 ? 'preview-route' : ''} />
        {step === 0 ? <rect x="18" y="20" width="196" height="112" rx="8" className="preview-average" /> : null}
      </svg>
    </PreviewFrame>
  )
}

function NaturalGradientPreview({ step, id }: { step: number; id: string }) {
  const natural = '30,130 62,120 96,102 132,78 170,50 204,30'
  const euclidean = '30,130 66,86 100,126 140,62 174,82 204,30'
  return (
    <PreviewFrame
      label={['coordinates', 'conditioning', 'information geometry', 'square-root covariance', 'guaranteed regime'][step]}
      description={['same step, different meaning', 'raw path oscillates', 'natural path rescales', 'Σ = SSᵀ', 'assumptions matter'][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Natural and Euclidean paths across Gaussian geometry</title>
        {[0, 1, 2, 3].map((index) => (
          <ellipse
            key={index}
            cx={150}
            cy={76}
            rx={82 - index * 15}
            ry={25 - index * 4}
            transform="rotate(-28 150 76)"
          />
        ))}
        <polyline points={euclidean} className={step >= 1 ? 'preview-euclidean preview-visible' : 'preview-euclidean'} />
        <polyline points={natural} className={step >= 2 ? 'preview-natural preview-visible' : 'preview-natural'} />
        {step >= 3 ? <text x="20" y="30">Σ = SSᵀ ≻ 0</text> : null}
        {step === 4 ? <rect x="136" y="116" width="82" height="24" rx="12" className="preview-guarantee" /> : null}
      </svg>
    </PreviewFrame>
  )
}

function ReplayPreview({ step, id }: { step: number; id: string }) {
  const candidates = [
    [74, 38],
    [96, 92],
    [136, 42],
    [158, 112],
    [188, 72],
  ]
  const selected = Math.min(candidates.length - 1, step)
  const target = [196, 34]
  const chosen = candidates[selected]
  const residual = Math.hypot(target[0] - chosen[0], target[1] - chosen[1]) / 180
  return (
    <PreviewFrame
      label={['current-only update', 'old loss rises', 'joint target', 'subset correction', 'residual boundary'][step]}
      description={['learn present', 'forget past', 'define missing direction', 'match under budget', `ρ=${residual.toFixed(2)}`][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Replay candidates approximating a joint-training correction</title>
        <defs>
          <marker id={`${id}-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7Z" />
          </marker>
        </defs>
        <line x1="28" y1="132" x2="88" y2="30" className="preview-current" markerEnd={`url(#${id}-arrow)`} />
        {step >= 1 ? <path d="M24 116 Q68 148 108 124" className="preview-old-loss" /> : null}
        {step >= 2 ? <line x1="28" y1="132" x2={target[0]} y2={target[1]} className="preview-target" markerEnd={`url(#${id}-arrow)`} /> : null}
        {candidates.map(([x, y], index) => (
          <g key={index} className={step >= 3 && index <= selected ? 'preview-selected' : ''}>
            <line x1="28" y1="132" x2={x} y2={y} markerEnd={`url(#${id}-arrow)`} />
            <circle cx={x} cy={y} r="4" />
          </g>
        ))}
        {step === 4 ? <line x1={chosen[0]} y1={chosen[1]} x2={target[0]} y2={target[1]} className="preview-residual" /> : null}
      </svg>
    </PreviewFrame>
  )
}

function RankPreview({ step, id }: { step: number; id: string }) {
  const rank = [1, 2, 4, 8, 16][step]
  const width = 28 + step * 28
  const feasible = step >= 3
  const usable = step >= 4
  return (
    <PreviewFrame
      label={['rank 1', 'constraints outside', 'space expands', 'first feasible rank', 'preservation budget'][step]}
      description={['line only', 'no correction', `rank ${rank}`, feasible ? 'correction exists' : 'blocked', usable ? 'usable rank' : 'too costly'][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Nested low-rank correction spaces and old-task constraints</title>
        <path d={`M24 136 L${24 + width} 24 L${58 + width} 24 L24 136Z`} className="preview-feasible-space" />
        <line x1="24" y1="136" x2="194" y2="38" className="preview-desired" />
        {[0, 1, 2].map((index) => (
          <line key={index} x1={44 + index * 34} y1="142" x2={108 + index * 30} y2={46 + index * 17} className="preview-constraint" />
        ))}
        <circle cx="194" cy="38" r="7" className={feasible ? 'preview-feasible-target' : 'preview-blocked-target'} />
        {step === 4 ? <path d="M156 118 A52 52 0 0 0 196 78" className="preview-budget" /> : null}
      </svg>
    </PreviewFrame>
  )
}

function TemporalPreview({ step, id }: { step: number; id: string }) {
  return (
    <PreviewFrame
      label={['windows arrive', 'fixed token budget', 'backward benefit', 'staleness cost', 'conservative allocation'][step]}
      description={['chronological stream', 'replay displaces current', 'old can help', 'old can hurt', step === 4 ? 'zero replay allowed' : 'measure all regions'][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Chronological windows and backward, current, and forward replay value</title>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <g key={index}>
            <rect
              x={14 + index * 36}
              y="78"
              width="27"
              height="38"
              className={index < 4 ? 'preview-past-window' : index === 4 ? 'preview-current-window' : 'preview-future-window'}
            />
            <text x={27 + index * 36} y="134">t{index + 1}</text>
          </g>
        ))}
        {step >= 1 ? <path d="M156 72 Q112 22 72 72" className="preview-replay-flow" /> : null}
        {step >= 2 ? <path d="M24 48 H90" className="preview-benefit" /> : null}
        {step >= 3 ? <path d="M132 48 H206" className="preview-cost" /> : null}
        {step === 4 ? <text x="116" y="24" textAnchor="middle">max(0, conservative value)</text> : null}
      </svg>
    </PreviewFrame>
  )
}

function CasePathPreview({ step, id }: { step: number; id: string }) {
  const states = ['sources', 'assertions', 'obligations', 'gate', 'packet']
  return (
    <PreviewFrame label={states[step]} description={['observe', 'propose with citations', 'compute missing work', 'accept · hold · refuse', 'replay exact provenance'][step]}>
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Sources flowing through bounded extraction and deterministic gates</title>
        {states.map((state, index) => (
          <g key={state} className={index <= step ? 'preview-complete' : ''}>
            <rect x={8 + index * 45} y={50 + (index % 2) * 12} width="38" height="42" rx="5" />
            <text x={27 + index * 45} y="116">{state.slice(0, 5)}</text>
            {index < states.length - 1 ? <path d={`M${46 + index * 45} ${71 + (index % 2) * 12} L${54 + index * 45} ${71 + ((index + 1) % 2) * 12}`} /> : null}
          </g>
        ))}
        {step === 3 ? <text x="170" y="32">HOLD</text> : null}
        {step === 4 ? <path d="M178 98 L196 106 L216 94" className="preview-proof" /> : null}
      </svg>
    </PreviewFrame>
  )
}

function SpatialPreview({ step, id }: { step: number; id: string }) {
  return (
    <PreviewFrame
      label={['language', 'intent', 'world graph', 'persistent edit', 'situated action'][step]}
      description={['speak or type', 'objects + relations', 'instantiate scene', 'diff existing state', 'agent uses tools'][step]}
    >
      <svg viewBox="0 0 232 158" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Language compiling into a persistent mountain laboratory and agent action</title>
        <path d="M0 112 L42 72 L72 101 L112 48 L150 98 L184 58 L232 106 V158 H0Z" className="preview-mountain" />
        {step >= 1 ? <rect x="18" y="18" width="74" height="36" rx="5" className="preview-intent" /> : null}
        {step >= 2 ? (
          <g>
            <rect x="118" y="82" width="72" height="45" className="preview-lab" />
            <circle cx="140" cy="101" r="7" className="preview-microscope" />
            <path d="M164 112 L174 94 L184 105" className="preview-arm" />
          </g>
        ) : null}
        {step >= 3 ? <path d="M140 101 Q160 72 186 90" className="preview-edit" /> : null}
        {step >= 4 ? (
          <g>
            <circle cx="106" cy="115" r="8" className="preview-agent" />
            <path d="M112 110 Q124 100 140 101" className="preview-agent-path" />
          </g>
        ) : null}
      </svg>
    </PreviewFrame>
  )
}

function PreviewVisual({ work, step, id }: { work: WorkRegistryEntry; step: number; id: string }) {
  switch (work.previewKind) {
    case 'network':
      return <NetworkPreview step={step} id={id} />
    case 'gain-normalization':
      return <GainPreview step={step} id={id} bounds={false} />
    case 'gain-frustration':
      return <GainPreview step={step} id={id} bounds />
    case 'urban':
      return <UrbanPreview step={step} id={id} />
    case 'natural-gradient':
      return <NaturalGradientPreview step={step} id={id} />
    case 'replay':
      return <ReplayPreview step={step} id={id} />
    case 'rank':
      return <RankPreview step={step} id={id} />
    case 'temporal':
      return <TemporalPreview step={step} id={id} />
    case 'casepath':
      return <CasePathPreview step={step} id={id} />
    case 'spatial':
      return <SpatialPreview step={step} id={id} />
  }
}

export function WorkPreview({ work, className = '' }: { work: WorkRegistryEntry; className?: string }) {
  const [ref, inViewport] = useInViewport<HTMLElement>()
  const reduced = useReducedMotion()
  const [step, setStep] = usePreviewStep(inViewport, reduced)
  const rawId = useId()
  const id = `preview-${rawId.replace(/:/g, '')}`
  return (
    <figure
      ref={ref}
      className={`work-preview ${className}`.trim()}
      data-active={inViewport && !reduced ? 'true' : 'false'}
      data-reduced-motion={reduced ? 'true' : 'false'}
      aria-label={`${work.shortTitle}: five-step semantic preview`}
    >
      <PreviewVisual work={work} step={step} id={id} />
      <figcaption>
        <span>{String(step + 1).padStart(2, '0')} / 05</span>
        <p>{work.explanation15}</p>
      </figcaption>
      {reduced ? (
        <div className="work-preview-step-controls" aria-label="Reduced-motion preview steps">
          <button type="button" onClick={() => setStep((step + PREVIEW_STEPS - 1) % PREVIEW_STEPS)}>
            Previous state
          </button>
          <button type="button" onClick={() => setStep((step + 1) % PREVIEW_STEPS)}>
            Next state
          </button>
        </div>
      ) : null}
    </figure>
  )
}
