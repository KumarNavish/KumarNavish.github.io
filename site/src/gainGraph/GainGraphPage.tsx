import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import { PortfolioHeader } from '../shared/PortfolioHeader'
import {
  analyzeGainGraph,
  c,
  cAbs,
  cArg,
  complexLabel,
  diffuse,
  phaseLabel,
  wrapPhase,
  type Complex,
  type GainAnalysis,
  type GainEdge,
  type GainGraph,
} from './gainGraphMath'
import './gainGraph.css'

type Operator = 'normalized' | 'combinatorial'
type SignalMode = 'eigenmode' | 'diffusion'
type StoryStage = 'question' | 'object' | 'perturb' | 'consequence' | 'bound' | 'boundary'

interface NodeSpec {
  label: string
  x: number
  y: number
}

interface EdgeSpec {
  id: string
  label: string
  source: number
  target: number
}

const NODES: NodeSpec[] = [
  { label: 'v₁', x: 84, y: 198 },
  { label: 'v₂', x: 180, y: 72 },
  { label: 'v₃', x: 344, y: 58 },
  { label: 'v₄', x: 470, y: 184 },
  { label: 'v₅', x: 374, y: 324 },
  { label: 'v₆', x: 190, y: 326 },
]

const EDGES: EdgeSpec[] = [
  { id: 'e01', label: 'e₁₂', source: 0, target: 1 },
  { id: 'e12', label: 'e₂₃', source: 1, target: 2 },
  { id: 'e23', label: 'e₃₄', source: 2, target: 3 },
  { id: 'e34', label: 'e₄₅', source: 3, target: 4 },
  { id: 'e45', label: 'e₅₆', source: 4, target: 5 },
  { id: 'e50', label: 'e₆₁', source: 5, target: 0 },
  { id: 'e14', label: 'e₂₅', source: 1, target: 4 },
  { id: 'e25', label: 'e₃₆', source: 2, target: 5 },
]

const BASE_POTENTIALS = [0, 0.48, -0.34, 0.93, 0.16, -0.72]
const GAUGE_SHIFT = [0.36, -0.24, 0.58, -0.39, 0.22, -0.46]

const INITIAL_SIGNAL: Complex[] = [
  c(1, 0),
  c(0.28, 0.42),
  c(-0.44, 0.18),
  c(-0.12, -0.36),
  c(0.32, -0.22),
  c(0.58, 0.12),
]

const STORY: Array<{
  id: StoryStage
  number: string
  title: string
  body: string
  instruction: string
}> = [
  {
    id: 'question',
    number: '01',
    title: 'When does a complex network still behave like an ordinary graph?',
    body: 'Every oriented edge carries a unit complex gain. Locally, the phases can look arbitrary. Globally, the graph is balanced only when every cycle product equals one.',
    instruction: 'Start from the balanced state: all three cycle products close.',
  },
  {
    id: 'object',
    number: '02',
    title: 'The graph and the matrix are one object.',
    body: 'Choose an edge. Its gain enters one off-diagonal matrix cell, while the reverse orientation enters the conjugate cell. This Hermitian structure is why the spectrum remains real.',
    instruction: 'Select an edge and watch its two matrix entries highlight.',
  },
  {
    id: 'perturb',
    number: '03',
    title: 'Rotate one gain. The cycles stop closing.',
    body: 'The phase control changes the actual gain e^{iθ}. Any cycle containing the selected edge acquires a non-zero phase defect; cycles that do not contain it remain unchanged.',
    instruction: 'Drag the phase slider slowly through zero.',
  },
  {
    id: 'consequence',
    number: '04',
    title: 'The operator responds continuously.',
    body: 'The adjacency matrix, Laplacian, complete eigensystem, smallest mode, and heat diffusion are recomputed from the new gain. For the normalized operator, all eigenvalues remain inside [0, 2].',
    instruction: 'Compare eigenmodes or switch to diffusion.',
  },
  {
    id: 'bound',
    number: '05',
    title: 'The least eigenvalue becomes a certificate of frustration.',
    body: 'For the combinatorial gain Laplacian, the paper bounds the smallest eigenvalue by the frustration index—the minimum number of edges whose deletion restores balance. Both sides are computed here.',
    instruction: 'Read λ₁(L(Φ)) against the exact deletion cost ℓ(Φ).',
  },
  {
    id: 'boundary',
    number: '06',
    title: 'A certificate is not a reconstruction.',
    body: 'The frustration index can stay fixed while the phase defect, spectrum, eigenmode, and diffusion geometry keep changing. The bound detects a limit; it does not uniquely locate or describe the imbalance.',
    instruction: 'Keep ℓ(Φ)=1 and vary the phase continuously.',
  },
]

const NEXT_WORK = [
  ['Experience Replay / GBR', 'Which remembered samples make the next update resemble joint training?', 'Next research instrument'],
  ['Rank Feasibility', 'Does a low-rank space contain a correction that is feasible and practically usable?', 'Next research instrument'],
  ['TiC-LM', 'Which historical windows deserve the current tokens they replace?', 'Ongoing research'],
  ['CasePath', 'What evidence is sufficient to permit a reviewable procedural decision?', 'System chapter in reconstruction'],
  ['Generative AI × spatial computing', 'How can language become a persistent environment for action?', 'Active direction'],
] as const

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function phaseColor(angle: number): string {
  const normalized = (wrapPhase(angle) + Math.PI) / (2 * Math.PI)
  const hue = 202 + normalized * 92
  return `hsl(${hue.toFixed(1)} 72% 47%)`
}

function formatEigenvalue(value: number): string {
  return Math.abs(value) < 0.0005 ? '0.000' : value.toFixed(3)
}

function buildGraph(selectedEdgeId: string, phaseOffset: number, gaugeOn: boolean): GainGraph {
  const potentials = BASE_POTENTIALS.map((value, index) =>
    value + (gaugeOn ? GAUGE_SHIFT[index] ?? 0 : 0),
  )
  const edges: GainEdge[] = EDGES.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    phase: wrapPhase(
      (potentials[edge.source] ?? 0) -
        (potentials[edge.target] ?? 0) +
        (edge.id === selectedEdgeId ? phaseOffset : 0),
    ),
  }))
  return { nodeCount: NODES.length, edges }
}

function useActiveStory(onChange: (stage: StoryStage) => void): void {
  const callbackRef = useRef(onChange)
  useEffect(() => {
    callbackRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const elements = STORY.map((stage) => document.getElementById(`gain-story-${stage.id}`)).filter(
      (element): element is HTMLElement => element !== null,
    )
    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        const stage = active?.target.getAttribute('data-stage') as StoryStage | null
        if (stage) callbackRef.current(stage)
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: [0.1, 0.35, 0.65] },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])
}

function ThemeLock() {
  useEffect(() => {
    document.documentElement.style.colorScheme = 'light'
    document.documentElement.dataset.theme = 'light'
    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      delete document.documentElement.dataset.theme
    }
  }, [])
  return null
}

function PhaseSlider({ value, onChange, compact = false }: {
  value: number
  onChange: (value: number) => void
  compact?: boolean
}) {
  return (
    <label className={compact ? 'gain-phase-control is-compact' : 'gain-phase-control'}>
      <span>
        Edge perturbation
        <output>{phaseLabel(value)}</output>
      </span>
      <input
        type="range"
        min={-Math.PI}
        max={Math.PI}
        step={0.01}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
        aria-label="Selected edge phase perturbation"
      />
      <i aria-hidden="true"><span>−π</span><span>balanced</span><span>+π</span></i>
    </label>
  )
}

function GraphCanvas({ graph, analysis, selectedEdgeId, signal, onSelectEdge, compact = false }: {
  graph: GainGraph
  analysis: GainAnalysis
  selectedEdgeId: string
  signal: Complex[]
  onSelectEdge: (id: string) => void
  compact?: boolean
}) {
  const liveEdges = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const maximumMagnitude = Math.max(...signal.map(cAbs), 0.001)

  return (
    <figure className={compact ? 'gain-graph is-compact' : 'gain-graph'}>
      <svg viewBox="0 0 560 390" role="img" aria-label="Interactive six-vertex complex unit gain graph">
        <g className="gain-edges">
          {EDGES.map((edge) => {
            const source = NODES[edge.source]
            const target = NODES[edge.target]
            const live = liveEdges.get(edge.id)
            if (!source || !target || !live) return null
            const midpointX = (source.x + target.x) / 2
            const midpointY = (source.y + target.y) / 2
            const isSelected = edge.id === selectedEdgeId
            const select = () => onSelectEdge(edge.id)
            return (
              <g
                key={edge.id}
                className={isSelected ? 'gain-edge is-selected' : 'gain-edge'}
                role="button"
                tabIndex={0}
                aria-label={`Select ${edge.label}, phase ${phaseLabel(live.phase)}`}
                onClick={select}
                onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    select()
                  }
                }}
              >
                <line className="gain-edge-hit" x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
                <line
                  className="gain-edge-line"
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  style={{ stroke: phaseColor(live.phase) }}
                />
                <g className="gain-edge-phasor" transform={`translate(${midpointX} ${midpointY})`}>
                  <circle r={isSelected ? 15 : 12} />
                  <line
                    x1="0"
                    y1="0"
                    x2={Math.cos(live.phase) * (isSelected ? 11 : 8)}
                    y2={Math.sin(live.phase) * (isSelected ? 11 : 8)}
                    style={{ stroke: phaseColor(live.phase) }}
                  />
                  <circle
                    cx={Math.cos(live.phase) * (isSelected ? 11 : 8)}
                    cy={Math.sin(live.phase) * (isSelected ? 11 : 8)}
                    r="2.2"
                    style={{ fill: phaseColor(live.phase) }}
                  />
                </g>
                {compact ? null : (
                  <text x={midpointX} y={midpointY - 20} textAnchor="middle">{phaseLabel(live.phase)}</text>
                )}
              </g>
            )
          })}
        </g>
        <g className="gain-nodes">
          {NODES.map((node, index) => {
            const value = signal[index] ?? c()
            const magnitude = cAbs(value)
            const angle = cArg(value)
            const radius = 18 + (magnitude / maximumMagnitude) * 9
            const nodeColor = phaseColor(angle)
            return (
              <g key={node.label} transform={`translate(${node.x} ${node.y})`}>
                <circle className="gain-node-halo" r={radius + 8} />
                <circle className="gain-node" r={radius} style={{ stroke: nodeColor }} />
                <line
                  className="gain-node-phasor"
                  x1="0"
                  y1="0"
                  x2={Math.cos(angle) * (radius - 5)}
                  y2={Math.sin(angle) * (radius - 5)}
                  style={{ stroke: nodeColor }}
                />
                <circle
                  cx={Math.cos(angle) * (radius - 5)}
                  cy={Math.sin(angle) * (radius - 5)}
                  r="2.8"
                  style={{ fill: nodeColor }}
                />
                <text className="gain-node-label" y={radius + 23} textAnchor="middle">{node.label}</text>
              </g>
            )
          })}
        </g>
      </svg>
      <span className={analysis.balanced ? 'gain-balance is-balanced' : 'gain-balance'}>
        {analysis.balanced ? 'all cycle products = 1' : 'cycle inconsistency detected'}
      </span>
      {compact ? null : <figcaption>Edge phasors encode gains; node phasors encode the active eigenmode or diffusing signal.</figcaption>}
    </figure>
  )
}

function Spectrum({ values, activeIndex, operator, onSelect }: {
  values: number[]
  activeIndex: number
  operator: Operator
  onSelect: (index: number) => void
}) {
  const maximum = operator === 'normalized' ? 2 : Math.max(1, ...values) * 1.08
  return (
    <section className="gain-spectrum" aria-labelledby="gain-spectrum-title">
      <header>
        <div><span>Live eigensystem</span><h3 id="gain-spectrum-title">Every eigenvalue is recomputed</h3></div>
        <code>{operator === 'normalized' ? '0 ≤ λᵢ ≤ 2' : `max axis ${maximum.toFixed(2)}`}</code>
      </header>
      <div className="gain-spectrum-axis"><span>0</span><span>{(maximum / 2).toFixed(1)}</span><span>{maximum.toFixed(1)}</span></div>
      <div className="gain-spectrum-track">
        {values.map((value, index) => (
          <button
            key={`${index}-${value.toFixed(8)}`}
            type="button"
            className={activeIndex === index ? 'is-active' : ''}
            style={{ '--eigen-x': `${clamp(value / maximum, 0, 1) * 100}%` } as CSSProperties}
            onClick={() => onSelect(index)}
            aria-label={`Inspect eigenmode ${index + 1}, eigenvalue ${formatEigenvalue(value)}`}
          >
            <i /><span>λ{index + 1}</span><small>{formatEigenvalue(value)}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function Matrix({ matrix, selected }: {
  matrix: Complex[][]
  selected: EdgeSpec
}) {
  return (
    <section className="gain-matrix-panel" aria-labelledby="gain-matrix-title">
      <header><span>Hermitian operator</span><h3 id="gain-matrix-title">Graph change becomes matrix change</h3></header>
      <div className="gain-matrix" role="table" aria-label="Computed complex Laplacian matrix">
        {matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
          const highlight =
            (rowIndex === selected.source && columnIndex === selected.target) ||
            (rowIndex === selected.target && columnIndex === selected.source)
          return (
            <span
              role="cell"
              key={`${rowIndex}-${columnIndex}`}
              className={highlight ? 'is-highlighted' : ''}
              title={`row ${rowIndex + 1}, column ${columnIndex + 1}: ${complexLabel(value)}`}
            >
              {complexLabel(value)}
            </span>
          )
        }))}
      </div>
      <p>The selected edge contributes the highlighted conjugate pair.</p>
    </section>
  )
}

function Cycles({ analysis }: { analysis: GainAnalysis }) {
  return (
    <section className="gain-cycles" aria-labelledby="gain-cycles-title">
      <header><span>Cycle products</span><h3 id="gain-cycles-title">Balance is global consistency</h3></header>
      <div>
        {analysis.cycles.map((cycle) => (
          <article key={cycle.id}>
            <i style={{ '--cycle-phase': `${cycle.phase}rad` } as CSSProperties}><b /></i>
            <span><strong>{cycle.id}</strong><code>arg φ(C) = {phaseLabel(cycle.phase)}</code></span>
            <output>{(1 - Math.cos(cycle.phase)).toFixed(3)}</output>
          </article>
        ))}
      </div>
      <footer><span>Mean continuous defect</span><strong>{analysis.cycleDefect.toFixed(3)}</strong></footer>
    </section>
  )
}

function Bound({ analysis }: { analysis: GainAnalysis }) {
  const lambda = Math.max(0, analysis.combinatorialEigen.values[0] ?? 0)
  const frustration = analysis.frustrationIndex
  const maximum = Math.max(1, frustration)
  return (
    <section className="gain-bound" aria-labelledby="gain-bound-title">
      <header><span>Paper result · live instance</span><h3 id="gain-bound-title">λ₁(L(Φ)) ≤ ℓ(Φ)</h3></header>
      <p>ℓ(Φ) is found exactly by enumerating the smallest edge-deletion set that restores balance.</p>
      <div className="gain-bound-track">
        <span style={{ '--bound-x': `${clamp(lambda / maximum, 0, 1) * 100}%` } as CSSProperties}><i />λ₁ = {lambda.toFixed(3)}</span>
        <span className="is-frustration" style={{ '--bound-x': `${clamp(frustration / maximum, 0, 1) * 100}%` } as CSSProperties}><i />ℓ = {frustration}</span>
      </div>
      <footer>
        <strong>{lambda <= frustration + 1e-7 ? 'Bound satisfied' : 'Numerical failure'}</strong>
        <span>{analysis.balanced ? 'Balanced: both quantities collapse to zero.' : 'Unbalanced: the spectral certificate stays below the exact deletion cost.'}</span>
      </footer>
    </section>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="gain-segmented">
      <legend>{label}</legend>
      <div>{options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={option.value === value ? 'is-active' : ''}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >{option.label}</button>
      ))}</div>
    </fieldset>
  )
}

function Workbench({
  graph,
  analysis,
  selectedEdgeId,
  phaseOffset,
  activeStage,
  operator,
  signalMode,
  modeIndex,
  diffusionTime,
  gaugeOn,
  onSelectEdge,
  onPhaseChange,
  onOperatorChange,
  onSignalModeChange,
  onModeIndexChange,
  onDiffusionTimeChange,
  onGaugeChange,
  onReset,
}: {
  graph: GainGraph
  analysis: GainAnalysis
  selectedEdgeId: string
  phaseOffset: number
  activeStage: StoryStage
  operator: Operator
  signalMode: SignalMode
  modeIndex: number
  diffusionTime: number
  gaugeOn: boolean
  onSelectEdge: (id: string) => void
  onPhaseChange: (value: number) => void
  onOperatorChange: (value: Operator) => void
  onSignalModeChange: (value: SignalMode) => void
  onModeIndexChange: (value: number) => void
  onDiffusionTimeChange: (value: number) => void
  onGaugeChange: () => void
  onReset: () => void
}) {
  const selected = EDGES.find((edge) => edge.id === selectedEdgeId) ?? EDGES[0]
  const eigen = operator === 'normalized' ? analysis.normalizedEigen : analysis.combinatorialEigen
  const matrix = operator === 'normalized' ? analysis.normalized : analysis.combinatorial
  const safeModeIndex = Math.min(modeIndex, Math.max(0, eigen.vectors.length - 1))
  const signal = useMemo(
    () => signalMode === 'eigenmode'
      ? eigen.vectors[safeModeIndex] ?? INITIAL_SIGNAL
      : diffuse(INITIAL_SIGNAL, eigen, diffusionTime),
    [diffusionTime, eigen, safeModeIndex, signalMode],
  )

  if (!selected) return null

  return (
    <div className="gain-workbench" data-stage={activeStage}>
      <header className="gain-workbench-header">
        <div><span>Live mathematical state</span><strong>{analysis.balanced ? 'Balanced' : 'Unbalanced'} · selected {selected.label}</strong></div>
        <div>
          <button type="button" aria-pressed={gaugeOn} onClick={onGaugeChange}>Change gauge</button>
          <button type="button" onClick={onReset}>Restore balance</button>
        </div>
      </header>
      <div className="gain-controls">
        <Segmented
          label="Operator"
          value={operator}
          options={[{ value: 'normalized', label: 'Normalized ℒ' }, { value: 'combinatorial', label: 'Combinatorial L' }]}
          onChange={onOperatorChange}
        />
        <Segmented
          label="Signal"
          value={signalMode}
          options={[{ value: 'eigenmode', label: 'Eigenmode' }, { value: 'diffusion', label: 'Diffusion' }]}
          onChange={onSignalModeChange}
        />
        <PhaseSlider value={phaseOffset} onChange={onPhaseChange} compact />
      </div>
      <div className="gain-primary-grid">
        <GraphCanvas graph={graph} analysis={analysis} selectedEdgeId={selectedEdgeId} signal={signal} onSelectEdge={onSelectEdge} />
        <div className="gain-spectrum-column">
          <Spectrum
            values={eigen.values}
            activeIndex={safeModeIndex}
            operator={operator}
            onSelect={(index) => { onModeIndexChange(index); onSignalModeChange('eigenmode') }}
          />
          {signalMode === 'diffusion' ? (
            <label className="gain-time-control">
              <span>Diffusion time <output>{diffusionTime.toFixed(2)}</output></span>
              <input
                type="range"
                min="0"
                max="4"
                step="0.02"
                value={diffusionTime}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onDiffusionTimeChange(Number(event.target.value))}
              />
              <code>x(t) = exp(−t{operator === 'normalized' ? 'ℒ' : 'L'})x₀</code>
            </label>
          ) : (
            <div className="gain-mode-readout"><span>Selected mode</span><strong>φ{safeModeIndex + 1}</strong><code>λ = {formatEigenvalue(eigen.values[safeModeIndex] ?? 0)}</code></div>
          )}
        </div>
      </div>
      <div className="gain-secondary-grid">
        <Matrix matrix={matrix} selected={selected} />
        <Cycles analysis={analysis} />
        <Bound analysis={analysis} />
      </div>
    </div>
  )
}

function Hero({ graph, analysis, phaseOffset, selectedEdgeId, onPhaseChange, onSelectEdge }: {
  graph: GainGraph
  analysis: GainAnalysis
  phaseOffset: number
  selectedEdgeId: string
  onPhaseChange: (value: number) => void
  onSelectEdge: (id: string) => void
}) {
  const signal = analysis.normalizedEigen.vectors[0] ?? INITIAL_SIGNAL
  return (
    <section id="top" className="gain-hero" aria-labelledby="gain-hero-title">
      <div className="gain-hero-copy">
        <h1 id="gain-hero-title">Operate the idea, not the abstract.</h1>
        <p>
          This portfolio is being rebuilt around live scientific mechanisms. Begin with a complex-unit gain graph: rotate one edge and watch the cycles, Hermitian operator, spectrum, eigenmode, diffusion, and frustration certificate change together.
        </p>
        <div className="gain-hero-actions"><a href="#instrument">Enter the full instrument</a><a href="#evidence">Inspect the papers</a></div>
        <dl>
          <div><dt>Graph state</dt><dd>{analysis.balanced ? 'Balanced' : 'Unbalanced'}</dd></div>
          <div><dt>λ₁(ℒ)</dt><dd>{formatEigenvalue(analysis.normalizedEigen.values[0] ?? 0)}</dd></div>
          <div><dt>Frustration index</dt><dd>{analysis.frustrationIndex}</dd></div>
        </dl>
      </div>
      <div className="gain-hero-instrument">
        <GraphCanvas graph={graph} analysis={analysis} selectedEdgeId={selectedEdgeId} signal={signal} onSelectEdge={onSelectEdge} compact />
        <div className="gain-hero-spectrum" aria-label="Normalized spectrum from zero to two">
          {analysis.normalizedEigen.values.map((value, index) => (
            <i key={`${index}-${value.toFixed(8)}`} style={{ '--hero-eigen-x': `${clamp(value / 2, 0, 1) * 100}%` } as CSSProperties} />
          ))}
        </div>
        <PhaseSlider value={phaseOffset} onChange={onPhaseChange} />
        <small>Move the phase. Every displayed quantity is recomputed.</small>
      </div>
    </section>
  )
}

function StoryRail({ activeStage }: { activeStage: StoryStage }) {
  return (
    <div className="gain-story-rail">
      {STORY.map((stage) => (
        <article
          id={`gain-story-${stage.id}`}
          key={stage.id}
          data-stage={stage.id}
          className={stage.id === activeStage ? 'is-active' : ''}
        >
          <span>{stage.number}</span><h2>{stage.title}</h2><p>{stage.body}</p><strong>{stage.instruction}</strong>
        </article>
      ))}
    </div>
  )
}

function Evidence() {
  return (
    <section id="evidence" className="gain-evidence" aria-labelledby="gain-evidence-title">
      <header><h2 id="gain-evidence-title">The interaction ends where the papers begin.</h2><p>The browser computes one small, inspectable instance. It does not replace theorem assumptions, proofs, equality cases, or the full scope of either paper.</p></header>
      <div className="gain-paper-list">
        <a href="https://arxiv.org/abs/2009.13788" target="_blank" rel="noreferrer">
          <span>01</span><div><small>Published · American Journal of Combinatorics, 2022</small><h3>Normalized Laplacians for Gain Graphs</h3><p>Normalized gain Laplacians, spectral interval, balance, bipartiteness, interlacing, and characteristic polynomial.</p></div><i>↗</i>
        </a>
        <a href="https://arxiv.org/abs/2102.07560" target="_blank" rel="noreferrer">
          <span>02</span><div><small>Published · Linear Algebra and its Applications, 2021</small><h3>Bounds for the Extremal Eigenvalues of Gain Laplacian Matrices</h3><p>Gain-dependent extremal bounds and the relationship between the least eigenvalue and frustration.</p></div><i>↗</i>
        </a>
      </div>
      <div className="gain-evidence-contract">
        <article><h3>What this chapter establishes</h3><p>The matrices, spectra, cycle products, heat evolution, balance test, and edge-frustration index are calculated from the current graph state in the browser.</p></article>
        <article><h3>What it does not establish</h3><p>A six-vertex example cannot prove the general results or show that a scalar spectral certificate uniquely recovers the graph’s imbalance structure.</p></article>
      </div>
    </section>
  )
}

function Continuation() {
  return (
    <section id="continuation" className="gain-continuation" aria-labelledby="gain-continuation-title">
      <header><h2 id="gain-continuation-title">One finished instrument before five shallow imitations.</h2><p>The remaining work is an honest reconstruction queue. Each chapter will become public only when its native mechanism, failure boundary, evidence, mobile behaviour, and reduced-motion explanation pass the same bar.</p></header>
      <ol>{NEXT_WORK.map(([title, question, state], index) => (
        <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{question}</p></div><strong>{state}</strong></li>
      ))}</ol>
    </section>
  )
}

function Contact() {
  return (
    <section id="contact" className="gain-contact" aria-labelledby="gain-contact-title">
      <div><h2 id="gain-contact-title">A useful conversation can begin with the mechanism.</h2><p>Navish Kumar · PhD researcher in machine learning · University of Basel</p></div>
      <nav aria-label="Contact and research profiles">
        <a href="mailto:navish.kumar@unibas.ch"><span>Email</span><strong>navish.kumar@unibas.ch</strong></a>
        <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer"><span>Code</span><strong>GitHub ↗</strong></a>
        <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer"><span>Research</span><strong>Google Scholar ↗</strong></a>
        <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer"><span>Discussion</span><strong>OpenReview ↗</strong></a>
      </nav>
    </section>
  )
}

export function GainGraphPage() {
  const [selectedEdgeId, setSelectedEdgeId] = useState('e23')
  const [phaseOffset, setPhaseOffset] = useState(0)
  const [gaugeOn, setGaugeOn] = useState(false)
  const [operator, setOperator] = useState<Operator>('normalized')
  const [signalMode, setSignalMode] = useState<SignalMode>('eigenmode')
  const [modeIndex, setModeIndex] = useState(0)
  const [diffusionTime, setDiffusionTime] = useState(0.9)
  const [activeStage, setActiveStage] = useState<StoryStage>('question')
  const phaseTouched = useRef(false)

  const graph = useMemo(() => buildGraph(selectedEdgeId, phaseOffset, gaugeOn), [gaugeOn, phaseOffset, selectedEdgeId])
  const analysis = useMemo(() => analyzeGainGraph(graph), [graph])

  const changePhase = useCallback((value: number) => {
    phaseTouched.current = true
    setPhaseOffset(value)
  }, [])

  const changeStage = useCallback((stage: StoryStage) => {
    setActiveStage(stage)
    if (!phaseTouched.current && stage === 'question') setPhaseOffset(0)
    if (!phaseTouched.current && stage === 'perturb') setPhaseOffset(Math.PI * 0.58)
  }, [])
  useActiveStory(changeStage)

  const reset = useCallback(() => {
    phaseTouched.current = false
    setPhaseOffset(0)
    setModeIndex(0)
    setSignalMode('eigenmode')
  }, [])

  return (
    <div className="gain-page">
      <ThemeLock />
      <a className="gain-skip" href="#instrument">Skip to the live instrument</a>
      <PortfolioHeader compact />
      <main>
        <Hero graph={graph} analysis={analysis} phaseOffset={phaseOffset} selectedEdgeId={selectedEdgeId} onPhaseChange={changePhase} onSelectEdge={setSelectedEdgeId} />
        <section id="instrument" className="gain-instrument-story" aria-label="Gain graph explanatory sequence">
          <div className="gain-sticky">
            <Workbench
              graph={graph}
              analysis={analysis}
              selectedEdgeId={selectedEdgeId}
              phaseOffset={phaseOffset}
              activeStage={activeStage}
              operator={operator}
              signalMode={signalMode}
              modeIndex={modeIndex}
              diffusionTime={diffusionTime}
              gaugeOn={gaugeOn}
              onSelectEdge={setSelectedEdgeId}
              onPhaseChange={changePhase}
              onOperatorChange={setOperator}
              onSignalModeChange={setSignalMode}
              onModeIndexChange={setModeIndex}
              onDiffusionTimeChange={setDiffusionTime}
              onGaugeChange={() => setGaugeOn((value) => !value)}
              onReset={reset}
            />
          </div>
          <StoryRail activeStage={activeStage} />
        </section>
        <Evidence />
        <Continuation />
        <Contact />
      </main>
      <footer className="gain-footer"><span>Permanent light interface</span><span>Real computation · explicit boundaries</span><a href="#top">Return to beginning ↑</a></footer>
    </div>
  )
}
