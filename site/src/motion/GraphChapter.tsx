import { useEffect, useMemo, useState } from 'react'

import {
  diffuseGraphSignal,
  rayleighQuotient,
  signedLaplacian,
  type GraphEdge,
} from './mechanisms'
import {
  ChapterShell,
  EvidenceButton,
  RangeControl,
  SegmentedControl,
  formatNumber,
  signalColor,
} from './shared'

const NODE_POSITIONS = [
  { x: 132, y: 104, label: 'v₁' },
  { x: 278, y: 62, label: 'v₂' },
  { x: 420, y: 126, label: 'v₃' },
  { x: 390, y: 278, label: 'v₄' },
  { x: 230, y: 326, label: 'v₅' },
  { x: 82, y: 240, label: 'v₆' },
]

const BASE_EDGES: GraphEdge[] = [
  { source: 0, target: 1, weight: 1.1 },
  { source: 1, target: 2, weight: 0.72 },
  { source: 2, target: 3, weight: 1.3 },
  { source: 3, target: 4, weight: 0.9 },
  { source: 4, target: 5, weight: 1.15 },
  { source: 5, target: 0, weight: 0.64 },
  { source: 0, target: 4, weight: 0.48 },
  { source: 1, target: 4, weight: 0.83 },
  { source: 2, target: 5, weight: 0.54 },
]

const INITIAL_SIGNAL = [1, 0.05, -0.2, -0.62, 0.14, 0.52]

function matrixValue(value: number): string {
  return Math.abs(value) < 0.005 ? '0' : value.toFixed(2)
}

export function GraphChapter({
  reducedMotion,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  onOpenEvidence: (id: string) => void
}) {
  const [normalized, setNormalized] = useState(true)
  const [negativeEdge, setNegativeEdge] = useState(false)
  const [view, setView] = useState<'diffusion' | 'mode'>('diffusion')
  const [time, setTime] = useState(0.8)
  const [modeIndex, setModeIndex] = useState(1)
  const [playing, setPlaying] = useState(false)

  const edges = useMemo(
    () =>
      BASE_EDGES.map((edge, index) =>
        index === 7 && negativeEdge ? { ...edge, weight: -Math.abs(edge.weight) } : edge,
      ),
    [negativeEdge],
  )
  const spectrum = useMemo(
    () => signedLaplacian(NODE_POSITIONS.length, edges, normalized),
    [edges, normalized],
  )

  useEffect(() => {
    if (!playing || reducedMotion) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setTime((value) => (value >= 3.95 ? 0 : value + 0.05))
    }, 55)
    return () => window.clearInterval(timer)
  }, [playing, reducedMotion])

  const visibleSignal = useMemo(() => {
    if (view === 'mode') {
      return spectrum.eigen.vectors.map((row) => row[modeIndex] ?? 0)
    }
    return diffuseGraphSignal(INITIAL_SIGNAL, spectrum.eigen, time)
  }, [modeIndex, spectrum.eigen, time, view])
  const maximumSignal = Math.max(...visibleSignal.map((value) => Math.abs(value)), 0.001)
  const energy = rayleighQuotient(visibleSignal, spectrum.laplacian)
  const maximumEigenvalue = Math.max(...spectrum.eigen.values, 0.001)

  return (
    <ChapterShell chapterId="graph" reducedMotion={reducedMotion}>
      {({ activeStage, progress }) => (
        <div className="mn-instrument mn-graph-instrument" data-active-stage={activeStage}>
          <div className="mn-instrument-toolbar">
            <SegmentedControl
              label="Operator"
              value={normalized ? 'normalized' : 'combinatorial'}
              options={[
                { value: 'combinatorial', label: 'D − A' },
                { value: 'normalized', label: 'I − D⁻¹ᐟ²AD⁻¹ᐟ²' },
              ]}
              onChange={(value) => setNormalized(value === 'normalized')}
            />
            <SegmentedControl
              label="View"
              value={view}
              options={[
                { value: 'diffusion', label: 'Diffusion' },
                { value: 'mode', label: 'Eigenmode' },
              ]}
              onChange={setView}
            />
            <button
              type="button"
              className={negativeEdge ? 'mn-state-button is-active' : 'mn-state-button'}
              aria-pressed={negativeEdge}
              onClick={() => setNegativeEdge((value) => !value)}
            >
              {negativeEdge ? 'Signed edge active' : 'Flip one edge sign'}
            </button>
          </div>

          <div className="mn-graph-layout">
            <figure className="mn-graph-canvas">
              <svg viewBox="0 0 500 390" role="img" aria-label="Live signed graph and diffusing graph signal">
                <defs>
                  <filter id="node-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.2" />
                  </filter>
                </defs>
                <g className="mn-graph-edges">
                  {edges.map((edge, index) => {
                    const source = NODE_POSITIONS[edge.source]
                    const target = NODE_POSITIONS[edge.target]
                    if (!source || !target) {
                      return null
                    }
                    return (
                      <g key={`${edge.source}-${edge.target}-${index}`}>
                        <line
                          x1={source.x}
                          y1={source.y}
                          x2={target.x}
                          y2={target.y}
                          className={edge.weight < 0 ? 'is-negative' : ''}
                          strokeWidth={1.2 + Math.abs(edge.weight) * 2.1}
                          style={{ opacity: 0.28 + progress * 0.52 }}
                        />
                        <text
                          x={(source.x + target.x) / 2}
                          y={(source.y + target.y) / 2 - 6}
                          className="mn-edge-weight"
                        >
                          {edge.weight.toFixed(2)}
                        </text>
                      </g>
                    )
                  })}
                </g>
                <g className="mn-graph-nodes">
                  {NODE_POSITIONS.map((node, index) => {
                    const value = visibleSignal[index] ?? 0
                    const radius = 17 + Math.abs(value / maximumSignal) * 10
                    return (
                      <g key={node.label} transform={`translate(${node.x} ${node.y})`}>
                        <circle
                          r={radius}
                          fill={signalColor(value, maximumSignal)}
                          filter="url(#node-soft-shadow)"
                        />
                        <circle r={radius + 5} className="mn-node-orbit" />
                        <text y="4" textAnchor="middle" className="mn-node-label">
                          {node.label}
                        </text>
                        <text y={radius + 20} textAnchor="middle" className="mn-node-value">
                          {value >= 0 ? '+' : ''}{value.toFixed(2)}
                        </text>
                      </g>
                    )
                  })}
                </g>
              </svg>
              <figcaption>
                Node colour is the signed signal value. Edge width is |w|; a dashed edge has negative gain.
              </figcaption>
            </figure>

            <aside className="mn-graph-readout">
              <div className="mn-readout-primary">
                <span>Spectral energy</span>
                <strong>{formatNumber(energy, 3)}</strong>
                <small>xᵀLx / xᵀx</small>
              </div>
              <div className="mn-eigen-spectrum" aria-label="Laplacian eigenvalues">
                {spectrum.eigen.values.map((value, index) => (
                  <button
                    key={`${index}-${value}`}
                    type="button"
                    className={view === 'mode' && modeIndex === index ? 'is-active' : ''}
                    aria-label={`Inspect eigenmode ${index + 1}, eigenvalue ${value.toFixed(3)}`}
                    onClick={() => {
                      setModeIndex(index)
                      setView('mode')
                    }}
                  >
                    <i style={{ height: `${Math.max(3, (value / maximumEigenvalue) * 86)}%` }} />
                    <span>λ{index + 1}</span>
                    <small>{value.toFixed(2)}</small>
                  </button>
                ))}
              </div>
              <div className="mn-matrix-preview" aria-label="Computed Laplacian matrix">
                {spectrum.laplacian.map((row, rowIndex) =>
                  row.map((value, columnIndex) => (
                    <span key={`${rowIndex}-${columnIndex}`}>{matrixValue(value)}</span>
                  )),
                )}
              </div>
            </aside>
          </div>

          <div className="mn-instrument-controls">
            {view === 'diffusion' ? (
              <>
                <RangeControl
                  label="Diffusion time t"
                  value={time}
                  minimum={0}
                  maximum={4}
                  step={0.05}
                  display={time.toFixed(2)}
                  onChange={setTime}
                />
                <button
                  type="button"
                  className="mn-play-button"
                  aria-pressed={playing}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? 'Pause diffusion' : 'Run diffusion'}
                </button>
              </>
            ) : (
              <RangeControl
                label="Eigenmode"
                value={modeIndex + 1}
                minimum={1}
                maximum={spectrum.eigen.values.length}
                step={1}
                display={`φ${modeIndex + 1}`}
                onChange={(value) => setModeIndex(Math.round(value) - 1)}
              />
            )}
            <div className="mn-formula-strip">
              <code>{normalized ? 'Lₙ = I − D⁻¹ᐟ² A D⁻¹ᐟ²' : 'L = D − A'}</code>
              <code>x(t) = Σᵢ e⁻ᵗλⁱ ⟨φᵢ,x₀⟩ φᵢ</code>
            </div>
            <div className="mn-evidence-row">
              <EvidenceButton evidenceId="graph-normalized" onOpen={onOpenEvidence} compact />
              <EvidenceButton evidenceId="graph-extremal" onOpen={onOpenEvidence} compact />
            </div>
          </div>
        </div>
      )}
    </ChapterShell>
  )
}
