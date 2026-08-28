import { useMemo, useState, type CSSProperties } from 'react'

import {
  runCasePath,
  type CaseSource,
  type GateState,
} from './mechanisms'
import {
  ChapterShell,
  EvidenceButton,
} from './shared'

const BASE_SOURCES: CaseSource[] = [
  {
    id: 'lease',
    label: 'Signed lease',
    authority: 0.96,
    relevant: true,
    complete: true,
    supportsClaim: true,
    facts: ['Lease parties are identified', 'Lease term is recorded'],
  },
  {
    id: 'notice',
    label: 'Registered notice',
    authority: 0.91,
    relevant: true,
    complete: true,
    supportsClaim: true,
    facts: ['Notice date is recorded', 'Claimed deadline is visible'],
  },
  {
    id: 'message',
    label: 'Message fragment',
    authority: 0.64,
    relevant: false,
    complete: false,
    supportsClaim: false,
    facts: ['Informal statement mentions a disputed charge'],
  },
]

const STATE_LABEL: Record<GateState, string> = {
  pass: 'Pass',
  fail: 'Fail',
  blocked: 'Blocked',
}

export function CasePathChapter({
  reducedMotion,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  onOpenEvidence: (id: string) => void
}) {
  const [sourceState, setSourceState] = useState<Record<string, CaseSource>>(
    Object.fromEntries(BASE_SOURCES.map((source) => [source.id, source])),
  )
  const sources = useMemo(
    () => BASE_SOURCES.map((source) => sourceState[source.id] ?? source),
    [sourceState],
  )
  const result = useMemo(() => runCasePath(sources), [sources])

  const updateSource = (id: string, patch: Partial<CaseSource>) => {
    setSourceState((current) => ({
      ...current,
      [id]: { ...(current[id] ?? BASE_SOURCES.find((source) => source.id === id)!), ...patch },
    }))
  }

  return (
    <ChapterShell chapterId="casepath" reducedMotion={reducedMotion}>
      {({ activeStage }) => (
        <div className="mn-instrument mn-casepath-instrument" data-active-stage={activeStage}>
          <div className="mn-casepath-layout">
            <section className="mn-source-bay" aria-labelledby="source-bay-title">
              <header>
                <p className="mn-eyebrow">Evidence entering the system</p>
                <h3 id="source-bay-title">Source bay</h3>
                <p>Change the source conditions. Downstream construction is recomputed and fails closed.</p>
              </header>
              <div className="mn-source-cards">
                {sources.map((source, index) => (
                  <article
                    key={source.id}
                    className={source.relevant ? 'is-relevant' : ''}
                    style={{ '--source-order': index } as CSSProperties}
                  >
                    <header>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{source.label}</strong>
                    </header>
                    <label>
                      <input
                        type="checkbox"
                        checked={source.relevant}
                        onChange={(event) => updateSource(source.id, { relevant: event.target.checked })}
                      />
                      Relevant to claim
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={source.complete}
                        onChange={(event) => updateSource(source.id, { complete: event.target.checked })}
                      />
                      Complete document
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={source.supportsClaim}
                        onChange={(event) => updateSource(source.id, { supportsClaim: event.target.checked })}
                      />
                      Direct claim support
                    </label>
                    <label className="mn-authority-control">
                      <span>Authority <output>{Math.round(source.authority * 100)}%</output></span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={source.authority}
                        onChange={(event) => updateSource(source.id, { authority: Number(event.target.value) })}
                      />
                    </label>
                  </article>
                ))}
              </div>
            </section>

            <section className="mn-gate-workflow" aria-labelledby="gate-workflow-title">
              <header>
                <p className="mn-eyebrow">Deterministic execution trace</p>
                <h3 id="gate-workflow-title">Gate sequence</h3>
              </header>
              <div className="mn-gate-track">
                <article className="mn-extraction-node">
                  <span>01</span>
                  <strong>Bounded extraction</strong>
                  <p>{result.facts.length} canonical facts retained</p>
                </article>
                {result.gates.map((gate, index) => (
                  <article key={gate.id} className={`mn-gate-node is-${gate.state}`}>
                    <span>{String(index + 2).padStart(2, '0')}</span>
                    <div>
                      <strong>{gate.label}</strong>
                      <p>{gate.explanation}</p>
                    </div>
                    <i aria-hidden="true" />
                    <small>{STATE_LABEL[gate.state]}</small>
                  </article>
                ))}
                <article className={result.artifactReady ? 'mn-artifact-node is-ready' : 'mn-artifact-node is-blocked'}>
                  <span>06</span>
                  <strong>Decision artifact</strong>
                  <p>{result.artifactReady ? 'Reviewable and source-bound' : 'Not emitted'}</p>
                </article>
              </div>
            </section>
          </div>

          <div className="mn-casepath-output">
            <section>
              <p className="mn-eyebrow">Canonical facts</p>
              <ul>
                {result.facts.length > 0 ? (
                  result.facts.map((fact) => <li key={fact}>{fact}</li>)
                ) : (
                  <li>No facts can be promoted from the current source state.</li>
                )}
              </ul>
            </section>
            <section>
              <p className="mn-eyebrow">Process construction</p>
              <ol>
                {result.process.map((step, index) => (
                  <li key={step}><span>{index + 1}</span>{step}</li>
                ))}
              </ol>
            </section>
            <section className={result.artifactReady ? 'is-ready' : 'is-stopped'}>
              <p className="mn-eyebrow">Deterministic decision</p>
              <strong>{result.artifactReady ? 'Build' : 'Stop'}</strong>
              <p>{result.decision}</p>
            </section>
          </div>

          <div className="mn-instrument-controls">
            <button
              type="button"
              className="mn-state-button"
              onClick={() =>
                setSourceState(Object.fromEntries(BASE_SOURCES.map((source) => [source.id, source])))
              }
            >
              Restore verified source state
            </button>
            <div className="mn-formula-strip">
              <code>source → bounded facts → deterministic gates</code>
              <code>failure ⇒ preserve audit state, emit no claim artifact</code>
            </div>
            <EvidenceButton evidenceId="casepath-live" onOpen={onOpenEvidence} compact />
          </div>
        </div>
      )}
    </ChapterShell>
  )
}
