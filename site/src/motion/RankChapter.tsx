import { useMemo, useState, type CSSProperties } from 'react'

import {
  solveRankFeasibility,
  type RankConstraint,
} from './mechanisms'
import {
  ChapterShell,
  EvidenceButton,
  RangeControl,
  SegmentedControl,
  formatNumber,
} from './shared'

const BASIS = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
]

const CONSTRAINTS: RankConstraint[] = [
  {
    id: 'task-a',
    label: 'Old task A',
    gradient: [1, 0.12, 0.08, 0],
    requiredDecrease: 0.32,
  },
  {
    id: 'task-b',
    label: 'Old task B',
    gradient: [-0.12, 1, 0.14, 0.02],
    requiredDecrease: 0.3,
  },
  {
    id: 'task-c',
    label: 'Old task C',
    gradient: [0.04, 0.1, 1, 0.12],
    requiredDecrease: 0.28,
  },
]

const CURRENT_GRADIENT = [0.08, -0.04, -0.42, 0.28]

const CONSTRAINT_COLORS = ['#79d8f2', '#f08c78', '#d6aa6d']

function projectCorrection(correction: number[]): { x: number; y: number } {
  return {
    x: 260 + (correction[0] ?? 0) * 210 + (correction[2] ?? 0) * 70,
    y: 205 - (correction[1] ?? 0) * 190 + (correction[2] ?? 0) * 45,
  }
}

export function RankChapter({
  reducedMotion,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  onOpenEvidence: (id: string) => void
}) {
  const [rank, setRank] = useState(2)
  const [maxNorm, setMaxNorm] = useState(0.82)
  const [maxDamage, setMaxDamage] = useState(0.12)
  const [gapScale, setGapScale] = useState(1)

  const constraints = useMemo(
    () =>
      CONSTRAINTS.map((constraint) => ({
        ...constraint,
        requiredDecrease: constraint.requiredDecrease * gapScale,
      })),
    [gapScale],
  )
  const solution = useMemo(
    () =>
      solveRankFeasibility(
        BASIS,
        rank,
        constraints,
        CURRENT_GRADIENT,
        maxNorm,
        maxDamage,
      ),
    [constraints, maxDamage, maxNorm, rank],
  )
  const correctionPoint = projectCorrection(solution.correction)
  const normRatio = solution.feasible ? solution.correctionNorm / maxNorm : 1.3
  const damageRatio = solution.feasible ? solution.currentDamage / maxDamage : 1.3
  const status = !solution.feasible
    ? 'Infeasible'
    : solution.practicallyUsable
      ? 'Feasible + usable'
      : 'Feasible, not usable'

  return (
    <ChapterShell chapterId="rank" reducedMotion={reducedMotion}>
      {({ activeStage, progress }) => (
        <div className="mn-instrument mn-rank-instrument" data-active-stage={activeStage}>
          <div className="mn-instrument-toolbar">
            <SegmentedControl
              label="Adapter rank"
              value={rank}
              options={[1, 2, 3, 4].map((value) => ({ value, label: `r = ${value}` }))}
              onChange={setRank}
            />
            <RangeControl
              label="Old-task gap scale"
              value={gapScale}
              minimum={0.55}
              maximum={1.35}
              step={0.05}
              display={`${Math.round(gapScale * 100)}%`}
              onChange={setGapScale}
            />
          </div>

          <div className="mn-rank-layout">
            <figure className="mn-rank-space">
              <svg viewBox="0 0 520 410" role="img" aria-label="Nested rank correction spaces and minimum-norm correction">
                <defs>
                  <marker id="rank-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                  <radialGradient id="rank-plane-fill">
                    <stop offset="0%" stopColor="var(--chapter-accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--chapter-accent)" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <g className="mn-rank-grid" aria-hidden="true">
                  {Array.from({ length: 9 }, (_, index) => (
                    <line key={`v-${index}`} x1={48 + index * 52} y1="34" x2={48 + index * 52} y2="366" />
                  ))}
                  {Array.from({ length: 7 }, (_, index) => (
                    <line key={`h-${index}`} x1="42" y1={52 + index * 52} x2="478" y2={52 + index * 52} />
                  ))}
                </g>

                <g className="mn-rank-subspaces" style={{ opacity: 0.45 + progress * 0.55 }}>
                  <line x1="82" y1="205" x2="438" y2="205" className={rank >= 1 ? 'is-active' : ''} />
                  <ellipse cx="260" cy="205" rx="174" ry="86" className={rank >= 2 ? 'is-active' : ''} />
                  <ellipse cx="260" cy="205" rx="193" ry="126" className={rank >= 3 ? 'is-active is-depth' : ''} />
                  <ellipse cx="260" cy="205" rx="208" ry="153" className={rank >= 4 ? 'is-active is-ambient' : ''} />
                  <ellipse cx="260" cy="205" rx={88 + rank * 28} ry={34 + rank * 21} fill="url(#rank-plane-fill)" />
                </g>

                <g className="mn-rank-constraints">
                  {constraints.map((constraint, index) => {
                    const angle = [-34, 41, 108][index] ?? 0
                    const radians = (angle * Math.PI) / 180
                    const x = 260 + Math.cos(radians) * 145
                    const y = 205 + Math.sin(radians) * 145
                    const slack = solution.slacks[index] ?? Number.NEGATIVE_INFINITY
                    return (
                      <g key={constraint.id}>
                        <line
                          x1="260"
                          y1="205"
                          x2={x}
                          y2={y}
                          stroke={CONSTRAINT_COLORS[index]}
                          className={slack >= -1e-6 ? 'is-satisfied' : 'is-violated'}
                        />
                        <circle cx={x} cy={y} r="9" fill={CONSTRAINT_COLORS[index]} />
                        <text x={x + 12} y={y - 10}>{constraint.label}</text>
                        <text x={x + 12} y={y + 8} className="mn-constraint-gap">
                          gap {constraint.requiredDecrease.toFixed(2)}
                        </text>
                      </g>
                    )
                  })}
                </g>

                {solution.feasible ? (
                  <g className="mn-rank-correction">
                    <line
                      x1="260"
                      y1="205"
                      x2={correctionPoint.x}
                      y2={correctionPoint.y}
                      markerEnd="url(#rank-arrow)"
                    />
                    <circle cx={correctionPoint.x} cy={correctionPoint.y} r="11" />
                    <text x={correctionPoint.x + 15} y={correctionPoint.y - 12}>δᵣ*</text>
                  </g>
                ) : (
                  <g className="mn-rank-infeasible-mark">
                    <path d="M226 171 294 239M294 171 226 239" />
                    <text x="260" y="270" textAnchor="middle">no common correction</text>
                  </g>
                )}

                <text x="84" y="193" className="mn-rank-label">rank 1</text>
                <text x="93" y="115" className="mn-rank-label">rank 2</text>
                <text x="70" y="78" className="mn-rank-label">rank 3</text>
                <text x="52" y="42" className="mn-rank-label">rank 4</text>
              </svg>
              <figcaption>
                The nested shapes encode available basis directions. The correction and constraint state are solved from the projected inequalities.
              </figcaption>
            </figure>

            <aside className="mn-rank-readout">
              <div className={`mn-rank-status ${solution.practicallyUsable ? 'is-usable' : solution.feasible ? 'is-costly' : 'is-infeasible'}`}>
                <span>Rank {rank}</span>
                <strong>{status}</strong>
                <p>{solution.reason}</p>
              </div>
              <div className="mn-threshold-meter">
                <div>
                  <span>Correction norm</span>
                  <strong>{formatNumber(solution.correctionNorm, 3)}</strong>
                  <i style={{ '--meter': Math.min(1.3, normRatio) } as CSSProperties} />
                  <small>limit {maxNorm.toFixed(2)}</small>
                </div>
                <div>
                  <span>Current-task damage</span>
                  <strong>{formatNumber(solution.currentDamage, 3)}</strong>
                  <i style={{ '--meter': Math.min(1.3, Math.max(0, damageRatio)) } as CSSProperties} />
                  <small>limit {maxDamage.toFixed(2)}</small>
                </div>
              </div>
              <div className="mn-slack-list">
                {constraints.map((constraint, index) => (
                  <div key={constraint.id}>
                    <span>{constraint.label}</span>
                    <strong>{solution.feasible ? formatNumber(solution.slacks[index] ?? 0, 3) : '—'}</strong>
                    <small>constraint slack</small>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div className="mn-instrument-controls">
            <RangeControl
              label="Maximum correction norm"
              value={maxNorm}
              minimum={0.35}
              maximum={1.4}
              step={0.05}
              display={maxNorm.toFixed(2)}
              onChange={setMaxNorm}
            />
            <RangeControl
              label="Maximum current damage"
              value={maxDamage}
              minimum={0.02}
              maximum={0.35}
              step={0.01}
              display={maxDamage.toFixed(2)}
              onChange={setMaxDamage}
            />
            <div className="mn-formula-strip">
              <code>min ‖δ‖₂  s.t.  gᵢᵀδ ≤ −Δᵢ</code>
              <code>δ ∈ span(Bᵣ)</code>
            </div>
            <EvidenceButton evidenceId="rank-openreview" onOpen={onOpenEvidence} compact />
          </div>
        </div>
      )}
    </ChapterShell>
  )
}
