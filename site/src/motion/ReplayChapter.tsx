import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import {
  selectReplaySubset,
  targetReplayGradient,
  type ReplayCandidate,
  type ReplayMethod,
} from './mechanisms'
import {
  ChapterShell,
  EvidenceButton,
  RangeControl,
  SegmentedControl,
  formatNumber,
} from './shared'

const CANDIDATES: ReplayCandidate[] = [
  { id: 'c1', label: 'c₁', gradient: [1.55, 0.55] },
  { id: 'c2', label: 'c₂', gradient: [0.82, 1.58] },
  { id: 'c3', label: 'c₃', gradient: [1.42, 1.24] },
  { id: 'c4', label: 'c₄', gradient: [-0.35, 1.72] },
  { id: 'c5', label: 'c₅', gradient: [1.88, -0.12] },
  { id: 'c6', label: 'c₆', gradient: [0.52, 0.38] },
  { id: 'c7', label: 'c₇', gradient: [1.1, 0.93] },
  { id: 'c8', label: 'c₈', gradient: [0.15, 1.08] },
]

const CURRENT: [number, number] = [0.5, 0.24]

function desiredGradient(difficulty: number): [number, number] {
  return [0.82 + difficulty * 0.2, 0.62 + difficulty * 0.26]
}

function toScreen(vector: [number, number]): { x: number; y: number } {
  const origin = { x: 205, y: 236 }
  const scale = 102
  return {
    x: origin.x + vector[0] * scale,
    y: origin.y - vector[1] * scale,
  }
}

function polylinePath(values: number[]): string {
  if (values.length === 0) {
    return ''
  }
  const maximum = Math.max(...values, 0.001)
  return values
    .map((value, index) => {
      const x = 12 + index * (172 / Math.max(1, values.length - 1))
      const y = 78 - (value / maximum) * 62
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function ReplayChapter({
  reducedMotion,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  onOpenEvidence: (id: string) => void
}) {
  const [alpha, setAlpha] = useState(0.4)
  const [count, setCount] = useState(3)
  const [method, setMethod] = useState<ReplayMethod>('greedy')
  const [difficulty, setDifficulty] = useState(0.35)
  const [visibleSteps, setVisibleSteps] = useState(count)
  const [playing, setPlaying] = useState(false)
  const desired = useMemo(() => desiredGradient(difficulty), [difficulty])
  const result = useMemo(
    () => selectReplaySubset(CANDIDATES, CURRENT, desired, alpha, count, method, 23),
    [alpha, count, desired, method],
  )
  const denseTarget = useMemo(
    () => targetReplayGradient(CURRENT, desired, alpha),
    [alpha, desired],
  )

  useEffect(() => {
    if (!playing || reducedMotion) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setVisibleSteps((value) => {
        if (value >= count) {
          setPlaying(false)
          return count
        }
        return value + 1
      })
    }, 620)
    return () => window.clearInterval(timer)
  }, [count, playing, reducedMotion])

  const visibleSelected = result.selected.slice(0, visibleSteps)
  const selectedIds = new Set(visibleSelected.map((candidate) => candidate.id))
  const currentPoint = toScreen(CURRENT)
  const desiredPoint = toScreen(desired)
  const targetPoint = toScreen(denseTarget)
  const correctedPoint = toScreen(result.correctedGradient)
  const meanPoint = toScreen(result.selectedMean)
  const maxResidual = Math.max(...result.residualPath, result.residual, 0.001)

  return (
    <ChapterShell chapterId="replay" reducedMotion={reducedMotion}>
      {({ activeStage }) => (
        <div className="mn-instrument mn-replay-instrument" data-active-stage={activeStage}>
          <div className="mn-instrument-toolbar">
            <SegmentedControl
              label="Selection"
              value={method}
              options={[
                { value: 'random', label: 'Random' },
                { value: 'greedy', label: 'Greedy' },
                { value: 'exact', label: 'Exact' },
              ]}
              onChange={(value) => {
                setMethod(value)
                setVisibleSteps(count)
                setPlaying(false)
              }}
            />
            <RangeControl
              label="Replay batch k"
              value={count}
              minimum={1}
              maximum={5}
              step={1}
              display={`${count} examples`}
              onChange={(value) => {
                const next = Math.round(value)
                setCount(next)
                setVisibleSteps(next)
                setPlaying(false)
              }}
            />
            <RangeControl
              label="Replay weight α"
              value={alpha}
              minimum={0.2}
              maximum={0.8}
              step={0.05}
              display={alpha.toFixed(2)}
              onChange={(value) => {
                setAlpha(value)
                setVisibleSteps(count)
                setPlaying(false)
              }}
            />
          </div>

          <div className="mn-replay-layout">
            <figure className="mn-vector-field">
              <svg viewBox="0 0 510 370" role="img" aria-label="Replay gradient target and selected subset geometry">
                <defs>
                  <marker id="arrow-current" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                  <marker id="arrow-target" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                  <marker id="arrow-corrected" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                </defs>
                <g className="mn-vector-grid" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <line key={`vertical-${index}`} x1={46 + index * 54} y1="28" x2={46 + index * 54} y2="334" />
                  ))}
                  {Array.from({ length: 6 }, (_, index) => (
                    <line key={`horizontal-${index}`} x1="42" y1={56 + index * 54} x2="476" y2={56 + index * 54} />
                  ))}
                </g>
                <g className="mn-candidate-field">
                  {CANDIDATES.map((candidate) => {
                    const point = toScreen(candidate.gradient)
                    const selected = selectedIds.has(candidate.id)
                    return (
                      <g
                        key={candidate.id}
                        className={selected ? 'mn-candidate is-selected' : 'mn-candidate'}
                        transform={`translate(${point.x} ${point.y})`}
                      >
                        <circle r={selected ? 11 : 7} />
                        <text y="-13" textAnchor="middle">{candidate.label}</text>
                      </g>
                    )
                  })}
                </g>
                <circle cx="205" cy="236" r="4" className="mn-origin-point" />
                <line
                  x1="205"
                  y1="236"
                  x2={currentPoint.x}
                  y2={currentPoint.y}
                  className="mn-vector-current"
                  markerEnd="url(#arrow-current)"
                />
                <text x={currentPoint.x + 8} y={currentPoint.y + 18} className="mn-vector-label">g current</text>

                <line
                  x1="205"
                  y1="236"
                  x2={desiredPoint.x}
                  y2={desiredPoint.y}
                  className="mn-vector-desired"
                  markerEnd="url(#arrow-target)"
                />
                <text x={desiredPoint.x + 8} y={desiredPoint.y - 10} className="mn-vector-label">g desired</text>

                <line
                  x1="205"
                  y1="236"
                  x2={targetPoint.x}
                  y2={targetPoint.y}
                  className="mn-vector-replay-target"
                  markerEnd="url(#arrow-target)"
                />
                <text x={targetPoint.x + 7} y={targetPoint.y - 10} className="mn-vector-label">target replay mean</text>

                <line
                  x1="205"
                  y1="236"
                  x2={correctedPoint.x}
                  y2={correctedPoint.y}
                  className="mn-vector-corrected"
                  markerEnd="url(#arrow-corrected)"
                />
                <text x={correctedPoint.x + 8} y={correctedPoint.y + 18} className="mn-vector-label">realized update</text>

                <line
                  x1={correctedPoint.x}
                  y1={correctedPoint.y}
                  x2={desiredPoint.x}
                  y2={desiredPoint.y}
                  className="mn-residual-segment"
                />
                <line
                  x1={meanPoint.x}
                  y1={meanPoint.y}
                  x2={targetPoint.x}
                  y2={targetPoint.y}
                  className="mn-mean-residual"
                />
              </svg>
              <figcaption>
                Every point is a candidate example gradient. The selected mean determines the realized update.
              </figcaption>
            </figure>

            <aside className="mn-replay-readout">
              <div className="mn-residual-orbit" style={{ '--residual': result.residual / maxResidual } as CSSProperties}>
                <span>Correction residual</span>
                <strong>{formatNumber(result.residual, 3)}</strong>
                <i aria-hidden="true" />
              </div>
              <div className="mn-selection-sequence">
                <p>Selection sequence</p>
                <ol>
                  {result.selected.map((candidate, index) => (
                    <li key={candidate.id} className={index < visibleSteps ? 'is-visible' : ''}>
                      <span>{index + 1}</span>
                      {candidate.label}
                      <small>ρ {formatNumber(result.residualPath[index] ?? 0, 3)}</small>
                    </li>
                  ))}
                </ol>
              </div>
              <svg className="mn-residual-chart" viewBox="0 0 200 90" role="img" aria-label="Residual after each selected example">
                <path d={polylinePath(result.residualPath)} />
                {result.residualPath.map((value, index) => {
                  const x = 12 + index * (172 / Math.max(1, result.residualPath.length - 1))
                  const y = 78 - (value / maxResidual) * 62
                  return <circle key={`${index}-${value}`} cx={x} cy={y} r="3" />
                })}
              </svg>
            </aside>
          </div>

          <div className="mn-instrument-controls">
            <RangeControl
              label="Target difficulty"
              value={difficulty}
              minimum={0}
              maximum={1}
              step={0.02}
              display={difficulty.toFixed(2)}
              onChange={(value) => {
                setDifficulty(value)
                setVisibleSteps(count)
                setPlaying(false)
              }}
            />
            <button
              type="button"
              className="mn-play-button"
              onClick={() => {
                if (playing) {
                  setPlaying(false)
                } else {
                  setVisibleSteps(0)
                  setPlaying(true)
                }
              }}
            >
              {playing ? 'Pause selection' : 'Run selection'}
            </button>
            <div className="mn-formula-strip">
              <code>gᴿ* = gᴮ + (g* − gᴮ) / α</code>
              <code>ρ(S) = ‖(1−α)gᴮ + α mean(S) − g*‖₂</code>
            </div>
            <EvidenceButton evidenceId="replay-openreview" onOpen={onOpenEvidence} compact />
          </div>
        </div>
      )}
    </ChapterShell>
  )
}
