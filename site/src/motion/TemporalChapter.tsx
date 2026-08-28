import { useMemo, useState, type CSSProperties } from 'react'

import type { TemporalWindow } from './mechanisms'
import { allocateTemporalReplayWithFuture } from './temporalReplay'
import {
  ChapterShell,
  EvidenceButton,
  RangeControl,
  formatNumber,
} from './shared'

const WINDOWS: TemporalWindow[] = [
  {
    id: 'b1',
    label: 'Bₜ₋₈',
    age: 8,
    stability: 0.88,
    backwardBenefit: 1.04,
    currentCost: 0.13,
    forwardCost: 0.08,
    uncertainty: 0.08,
  },
  {
    id: 'b2',
    label: 'Bₜ₋₅',
    age: 5,
    stability: 0.58,
    backwardBenefit: 0.8,
    currentCost: 0.2,
    forwardCost: 0.19,
    uncertainty: 0.1,
  },
  {
    id: 'b3',
    label: 'Bₜ₋₃',
    age: 3,
    stability: 0.94,
    backwardBenefit: 0.92,
    currentCost: 0.12,
    forwardCost: 0.1,
    uncertainty: 0.05,
  },
  {
    id: 'b4',
    label: 'Bₜ₋₂',
    age: 2,
    stability: 0.36,
    backwardBenefit: 0.56,
    currentCost: 0.29,
    forwardCost: 0.32,
    uncertainty: 0.12,
  },
  {
    id: 'b5',
    label: 'Bₜ₋₁',
    age: 1,
    stability: 0.74,
    backwardBenefit: 0.72,
    currentCost: 0.17,
    forwardCost: 0.14,
    uncertainty: 0.06,
  },
]

function regretColor(value: number, minimum: number, maximum: number): string {
  const span = Math.max(0.001, maximum - minimum)
  const normalized = (value - minimum) / span
  const lightness = 78 - normalized * 54
  const saturation = 30 + normalized * 44
  return `hsl(173 ${saturation}% ${lightness}%)`
}

export function TemporalChapter({
  reducedMotion,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  onOpenEvidence: (id: string) => void
}) {
  const [replayBudget, setReplayBudget] = useState(0.28)
  const [halfLife, setHalfLife] = useState(4.8)
  const [volatility, setVolatility] = useState(0.34)
  const [uncertaintyPenalty, setUncertaintyPenalty] = useState(0.8)

  const result = useMemo(
    () =>
      allocateTemporalReplayWithFuture(WINDOWS, {
        replayBudget,
        halfLife,
        volatility,
        uncertaintyPenalty,
        backwardWeight: 1,
        currentWeight: 0.82,
        forwardWeight: 0.68,
      }),
    [halfLife, replayBudget, uncertaintyPenalty, volatility],
  )
  const currentIndex = WINDOWS.length
  const allRegrets = result.regretMatrix.flat()
  const minimumRegret = Math.min(...allRegrets)
  const maximumRegret = Math.max(...allRegrets)
  const allocated = result.allocation.reduce((sum, value) => sum + value, 0)
  const backwardDelta = result.updatedRow
    .slice(0, currentIndex)
    .reduce(
      (sum, value, index) => sum + value - (result.baselineRow[index] ?? 0),
      0,
    ) / Math.max(1, currentIndex)
  const currentDelta =
    (result.updatedRow[currentIndex] ?? 0) - (result.baselineRow[currentIndex] ?? 0)
  const forwardValues = result.updatedRow.slice(currentIndex + 1)
  const forwardDelta =
    forwardValues.reduce(
      (sum, value, localIndex) =>
        sum + value - (result.baselineRow[currentIndex + 1 + localIndex] ?? 0),
      0,
    ) / Math.max(1, forwardValues.length)

  return (
    <ChapterShell chapterId="temporal" reducedMotion={reducedMotion}>
      {({ activeStage, progress }) => (
        <div className="mn-instrument mn-temporal-instrument" data-active-stage={activeStage}>
          <div className="mn-instrument-toolbar">
            <RangeControl
              label="Replay budget"
              value={replayBudget}
              minimum={0}
              maximum={0.55}
              step={0.01}
              display={`${Math.round(replayBudget * 100)}%`}
              onChange={setReplayBudget}
            />
            <RangeControl
              label="Replay half-life"
              value={halfLife}
              minimum={0.8}
              maximum={10}
              step={0.2}
              display={`${halfLife.toFixed(1)} windows`}
              onChange={setHalfLife}
            />
            <RangeControl
              label="Stream volatility"
              value={volatility}
              minimum={0}
              maximum={1}
              step={0.02}
              display={`${Math.round(volatility * 100)}%`}
              onChange={setVolatility}
            />
          </div>

          <div className="mn-temporal-layout">
            <figure className="mn-window-timeline">
              <div className="mn-time-axis" aria-hidden="true">
                <span>historical archive</span>
                <i />
                <span>current</span>
                <i />
                <span>future evaluation</span>
              </div>
              <div className="mn-window-stream">
                {WINDOWS.map((window, index) => {
                  const value = result.conservativeValues[index] ?? 0
                  const allocation = result.allocation[index] ?? 0
                  return (
                    <article
                      key={window.id}
                      className={value > 0 ? 'is-positive' : 'is-negative'}
                      style={{ '--window-delay': `${index * 70}ms` } as CSSProperties}
                    >
                      <header>
                        <strong>{window.label}</strong>
                        <span>{window.age} windows old</span>
                      </header>
                      <div className="mn-value-curve">
                        <i
                          style={
                            {
                              '--value': Math.min(1, Math.abs(value) * 2.8),
                              '--sign': value >= 0 ? 1 : -1,
                            } as CSSProperties
                          }
                        />
                      </div>
                      <dl>
                        <div><dt>value</dt><dd>{value >= 0 ? '+' : ''}{formatNumber(value, 3)}</dd></div>
                        <div><dt>allocation</dt><dd>{Math.round(allocation * 100)}%</dd></div>
                      </dl>
                      <div className="mn-token-allocation" aria-label={`${Math.round(allocation * 100)} percent token allocation`}>
                        <i style={{ width: `${Math.min(100, allocation * 100 / Math.max(0.01, replayBudget))}%` }} />
                      </div>
                    </article>
                  )
                })}
                <article className="is-current">
                  <header>
                    <strong>Bₜ</strong>
                    <span>current window</span>
                  </header>
                  <div className="mn-current-token-share">
                    <i style={{ width: `${Math.max(0, (1 - allocated) * 100)}%` }} />
                  </div>
                  <dl>
                    <div><dt>current tokens</dt><dd>{Math.round((1 - allocated) * 100)}%</dd></div>
                  </dl>
                </article>
              </div>
              <figcaption>
                Replay tokens replace current tokens. A window receives allocation only when its uncertainty-adjusted value is positive.
              </figcaption>
            </figure>

            <aside className="mn-regret-panel">
              <header>
                <div>
                  <p className="mn-eyebrow">Temporal evaluation object</p>
                  <h3>Regret matrix</h3>
                </div>
                <div className="mn-budget-readout">
                  <span>allocated replay</span>
                  <strong>{Math.round(allocated * 100)}%</strong>
                </div>
              </header>
              <div
                className="mn-regret-matrix"
                style={{ '--matrix-size': result.regretMatrix.length } as CSSProperties}
                role="img"
                aria-label="Temporal regret matrix with backward, current, and forward regions"
              >
                {result.regretMatrix.map((row, rowIndex) =>
                  row.map((value, columnIndex) => (
                    <span
                      key={`${rowIndex}-${columnIndex}`}
                      className={
                        rowIndex === currentIndex
                          ? columnIndex < currentIndex
                            ? 'is-backward is-active-row'
                            : columnIndex === currentIndex
                              ? 'is-current-cell is-active-row'
                              : 'is-forward is-active-row'
                          : ''
                      }
                      title={`checkpoint ${rowIndex + 1}, evaluation ${columnIndex + 1}: ${value.toFixed(3)}`}
                      style={{ backgroundColor: regretColor(value, minimumRegret, maximumRegret) }}
                    >
                      {rowIndex === currentIndex ? value.toFixed(2) : ''}
                    </span>
                  )),
                )}
              </div>
              <div className="mn-regret-deltas">
                <div><span>Backward</span><strong>{backwardDelta >= 0 ? '+' : ''}{formatNumber(backwardDelta, 3)}</strong><small>lower is better</small></div>
                <div><span>Current</span><strong>{currentDelta >= 0 ? '+' : ''}{formatNumber(currentDelta, 3)}</strong><small>adaptation cost</small></div>
                <div><span>Forward</span><strong>{forwardDelta >= 0 ? '+' : ''}{formatNumber(forwardDelta, 3)}</strong><small>interference</small></div>
              </div>
            </aside>
          </div>

          <div className="mn-instrument-controls">
            <RangeControl
              label="Uncertainty penalty"
              value={uncertaintyPenalty}
              minimum={0}
              maximum={1.8}
              step={0.05}
              display={uncertaintyPenalty.toFixed(2)}
              onChange={setUncertaintyPenalty}
            />
            <div className="mn-formula-strip">
              <code>vτ = Δbwd − λcurΔcur − λfwdΔfwd − κσ</code>
              <code>ατ &gt; 0 only if conservative vτ &gt; 0</code>
            </div>
            <EvidenceButton evidenceId="ticlm-ongoing" onOpen={onOpenEvidence} compact />
            <p className="mn-simulation-note">Transparent simulation · not reported experimental data</p>
          </div>
        </div>
      )}
    </ChapterShell>
  )
}
