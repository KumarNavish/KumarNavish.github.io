import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import {
  compileSpatialIntent,
  type SpatialEntity,
} from './mechanisms'
import {
  ChapterShell,
  EvidenceButton,
  RangeControl,
  SegmentedControl,
} from './shared'

const DEFAULT_INTENT = 'Create a calm lab to compare competing hypotheses through situated evidence.'

const KIND_LABEL: Record<SpatialEntity['kind'], string> = {
  question: 'Question',
  evidence: 'Evidence',
  tool: 'Tool',
  agent: 'Agent',
  environment: 'Boundary',
  action: 'Action',
}

function scenePosition(
  entity: SpatialEntity,
  index: number,
  total: number,
  layout: 'semantic' | 'evidence-axis',
): { x: number; y: number } {
  if (layout === 'semantic') {
    return {
      x: 300 + entity.x * 92,
      y: 215 + entity.y * 92 - entity.z * 28,
    }
  }
  const centered = index - (total - 1) / 2
  const evidenceOffset = entity.kind === 'evidence' ? -125 : entity.kind === 'question' ? 115 : 0
  return {
    x: 300 + evidenceOffset,
    y: 215 + centered * Math.min(58, 280 / Math.max(1, total - 1)),
  }
}

export function SpatialChapter({
  reducedMotion,
  onOpenEvidence,
}: {
  reducedMotion: boolean
  onOpenEvidence: (id: string) => void
}) {
  const [intent, setIntent] = useState(() =>
    window.localStorage.getItem('motion-native-spatial-intent') ?? DEFAULT_INTENT,
  )
  const [density, setDensity] = useState(0.68)
  const [layout, setLayout] = useState<'semantic' | 'evidence-axis'>('semantic')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const plan = useMemo(() => compileSpatialIntent(intent, density), [density, intent])
  const selected = plan.entities.find((entity) => entity.id === selectedId) ?? plan.entities[0]
  const positions = useMemo(
    () =>
      Object.fromEntries(
        plan.entities.map((entity, index) => [
          entity.id,
          scenePosition(entity, index, plan.entities.length, layout),
        ]),
      ),
    [layout, plan.entities],
  )

  useEffect(() => {
    window.localStorage.setItem('motion-native-spatial-intent', intent)
  }, [intent])

  return (
    <ChapterShell chapterId="spatial" reducedMotion={reducedMotion}>
      {({ activeStage, progress }) => (
        <div className="mn-instrument mn-spatial-instrument" data-active-stage={activeStage}>
          <div className="mn-spatial-compiler">
            <section className="mn-intent-console" aria-labelledby="intent-console-title">
              <header>
                <p className="mn-eyebrow">Language as world specification</p>
                <h3 id="intent-console-title">Intent compiler</h3>
              </header>
              <label>
                <span>Describe the environment and the work it should support</span>
                <textarea
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  rows={4}
                />
              </label>
              <dl>
                <div><dt>Objective</dt><dd>{plan.objective}</dd></div>
                <div><dt>Environment</dt><dd>{plan.environment}</dd></div>
                <div><dt>Persistent entities</dt><dd>{plan.entities.length}</dd></div>
                <div><dt>Explicit relations</dt><dd>{plan.relations.length}</dd></div>
              </dl>
            </section>

            <figure className="mn-spatial-world">
              <div className="mn-world-caption">
                <span>{plan.environment}</span>
                <strong>{layout === 'semantic' ? 'Semantic field' : 'Evidence axis'}</strong>
              </div>
              <svg viewBox="0 0 600 430" role="img" aria-label="Persistent spatial plan compiled from the current intent">
                <defs>
                  <filter id="world-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.26" />
                  </filter>
                </defs>
                <g className="mn-world-floor" aria-hidden="true">
                  {Array.from({ length: 9 }, (_, index) => (
                    <line key={`world-v-${index}`} x1={60 + index * 60} y1="55" x2={60 + index * 60} y2="385" />
                  ))}
                  {Array.from({ length: 6 }, (_, index) => (
                    <line key={`world-h-${index}`} x1="45" y1={75 + index * 58} x2="555" y2={75 + index * 58} />
                  ))}
                </g>
                <g className="mn-world-relations">
                  {plan.relations.map((relation, index) => {
                    const source = positions[relation.source]
                    const target = positions[relation.target]
                    if (!source || !target) {
                      return null
                    }
                    return (
                      <g key={`${relation.source}-${relation.target}-${index}`}>
                        <line
                          x1={source.x}
                          y1={source.y}
                          x2={target.x}
                          y2={target.y}
                          style={{ opacity: 0.25 + progress * 0.65 }}
                        />
                        <text
                          x={(source.x + target.x) / 2}
                          y={(source.y + target.y) / 2 - 7}
                          textAnchor="middle"
                        >
                          {relation.label}
                        </text>
                      </g>
                    )
                  })}
                </g>
                <g className="mn-world-entities">
                  {plan.entities.map((entity, index) => {
                    const position = positions[entity.id]
                    if (!position) {
                      return null
                    }
                    const isSelected = entity.id === selected?.id
                    return (
                      <g
                        key={entity.id}
                        className={`is-${entity.kind}${isSelected ? ' is-selected' : ''}`}
                        transform={`translate(${position.x} ${position.y})`}
                        style={{ '--entity-order': index } as CSSProperties}
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect ${entity.label}, ${KIND_LABEL[entity.kind]}`}
                        onClick={() => setSelectedId(entity.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedId(entity.id)
                          }
                        }}
                      >
                        {entity.kind === 'question' ? (
                          <circle r={isSelected ? 31 : 25} />
                        ) : entity.kind === 'evidence' ? (
                          <rect x={isSelected ? -36 : -30} y={isSelected ? -24 : -20} width={isSelected ? 72 : 60} height={isSelected ? 48 : 40} rx="3" />
                        ) : entity.kind === 'tool' ? (
                          <path d="M-28-21h56v42h-56zM-18-10h36M-18 0h26M-18 10h31" />
                        ) : entity.kind === 'environment' ? (
                          <path d="M0-29 30 23h-60z" />
                        ) : (
                          <path d="M-25-18h50v36h-50z" />
                        )}
                        <text y={entity.kind === 'question' ? 45 : 39} textAnchor="middle">{entity.label}</text>
                        <text
                          y={entity.kind === 'question' ? 56 : 50}
                          textAnchor="middle"
                          className="mn-world-entity-kind"
                        >
                          {KIND_LABEL[entity.kind]}
                        </text>
                      </g>
                    )
                  })}
                </g>
              </svg>
              <figcaption>
                Every object corresponds to a typed semantic entity. Relations are preserved as the layout changes.
              </figcaption>
            </figure>
          </div>

          <div className="mn-spatial-inspector">
            <section>
              <p className="mn-eyebrow">Selected world entity</p>
              <h3>{selected?.label ?? 'No entity selected'}</h3>
              <p>{selected ? KIND_LABEL[selected.kind] : '—'} · persistent id: <code>{selected?.id ?? '—'}</code></p>
            </section>
            <section>
              <p className="mn-eyebrow">Available actions</p>
              <ul>
                {plan.affordances.map((affordance) => <li key={affordance}>{affordance}</li>)}
              </ul>
            </section>
            <section>
              <p className="mn-eyebrow">World state</p>
              <p>
                Editing intent recompiles the structure. Selection and the intent itself persist locally rather than disappearing into a transcript.
              </p>
            </section>
          </div>

          <div className="mn-instrument-controls">
            <RangeControl
              label="Information density"
              value={density}
              minimum={0.2}
              maximum={1}
              step={0.02}
              display={density < 0.45 ? 'Overview' : density < 0.72 ? 'Working' : 'Expert'}
              onChange={setDensity}
            />
            <SegmentedControl
              label="Spatial organization"
              value={layout}
              options={[
                { value: 'semantic', label: 'Semantic field' },
                { value: 'evidence-axis', label: 'Evidence axis' },
              ]}
              onChange={setLayout}
            />
            <button type="button" className="mn-state-button" onClick={() => setIntent(DEFAULT_INTENT)}>
              Restore reference intent
            </button>
            <EvidenceButton evidenceId="spatial-prototype" onOpen={onOpenEvidence} compact />
          </div>
        </div>
      )}
    </ChapterShell>
  )
}
