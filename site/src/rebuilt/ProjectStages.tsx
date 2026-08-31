import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { getWork } from '../data/workRegistry'
import './projectStages.css'

export const PROGRAMME_MOMENTS = [
  {
    id: 'counterspeech-dynamics',
    verb: 'Observe',
    period: 'Foundation',
    title: 'Make the interaction visible before proposing an intervention.',
    consequence: 'Evidence becomes a map of behaviour rather than a vague impression.',
  },
  {
    id: 'normalized-gain-laplacians',
    verb: 'Formalise',
    period: 'Foundation',
    title: 'Turn local relationships into a global consistency test.',
    consequence: 'One changed relation can be traced through a cycle, an operator, and a spectrum.',
  },
  {
    id: 'square-root-natural-gradient',
    verb: 'Reparameterise',
    period: 'Foundation',
    title: 'Let geometry determine how learning moves.',
    consequence: 'The same objective can become stable and provable under a better representation.',
  },
  {
    id: 'experience-replay-optimization',
    verb: 'Correct',
    period: 'Current',
    title: 'Expose the update that current-only learning is missing.',
    consequence: 'Replay becomes a measurable correction problem instead of a sampling ritual.',
  },
  {
    id: 'casepath',
    verb: 'Constrain',
    period: 'Current',
    title: 'Separate model interpretation from authority to act.',
    consequence: 'A plausible answer can be held when the evidence does not permit a decision.',
  },
  {
    id: 'spatial-intelligence',
    verb: 'Inhabit',
    period: 'Frontier',
    title: 'Let language edit a world that persists.',
    consequence: 'The interface becomes an inspectable environment, not another disconnected answer.',
  },
] as const

export const PROJECT_STEP_COPY: Record<string, Array<{ label: string; takeaway: string }>> = {
  'counterspeech-dynamics': [
    { label: 'Observe the network', takeaway: 'Start with who interacts with whom—not with an assumed intervention.' },
    { label: 'Pair comparable users', takeaway: 'Matched groups make behavioural differences easier to inspect.' },
    { label: 'Reveal asymmetry', takeaway: 'Activity, language, and response patterns are not distributed uniformly.' },
    { label: 'Trace counterspeech', takeaway: 'Protective responses travel through context-dependent interaction paths.' },
    { label: 'Keep the boundary', takeaway: 'Observed association is evidence; it is not causal proof for enforcement.' },
  ],
  'normalized-gain-laplacians': [
    { label: 'Begin balanced', takeaway: 'Every relationship agrees when multiplied around the cycle.' },
    { label: 'Rotate one edge', takeaway: 'A single local change introduces a phase defect.' },
    { label: 'Trace the cycle', takeaway: 'The inconsistency propagates through every cycle containing that edge.' },
    { label: 'Update the operator', takeaway: 'The graph Laplacian changes because the relationship structure changed.' },
    { label: 'Read the spectrum', takeaway: 'The smallest eigenvalue moves away from zero and certifies imbalance.' },
    { label: 'Interpret repair', takeaway: 'Frustration measures how much structure must change to restore balance.' },
  ],
  'extremal-gain-laplacian-bounds': [
    { label: 'Create a defect', takeaway: 'An inconsistent cycle produces a non-zero structural signal.' },
    { label: 'Measure the least mode', takeaway: 'The smallest eigenvalue responds to the graph’s distance from balance.' },
    { label: 'Compare extremal bounds', takeaway: 'Lower and upper spectral limits constrain the possible inconsistency.' },
    { label: 'Delete one relation', takeaway: 'A candidate repair removes the smallest set of conflicting edges.' },
    { label: 'Recover balance', takeaway: 'The spectrum returns toward its balanced boundary after repair.' },
  ],
  'urban-microregion-logistics': [
    { label: 'Split the city', takeaway: 'Neighbourhoods with different streets, demand, and slopes should not be averaged together.' },
    { label: 'Expose local conditions', takeaway: 'Density and service friction alter vehicle performance block by block.' },
    { label: 'Compare vehicles', takeaway: 'A cargo bike can dominate in one micro-region and fail in another.' },
    { label: 'Sequence the rollout', takeaway: 'Operational transition starts where the evidence is strongest.' },
    { label: 'Keep uncertainty visible', takeaway: 'The model supports field decisions; it does not replace local calibration.' },
  ],
  'square-root-natural-gradient': [
    { label: 'Show the geometry', takeaway: 'The same numerical step has different meaning in an anisotropic distribution.' },
    { label: 'Follow Euclidean descent', takeaway: 'A straight coordinate step can zigzag across the statistical geometry.' },
    { label: 'Use the natural metric', takeaway: 'The update follows the distribution rather than the arbitrary coordinates.' },
    { label: 'Factor the covariance', takeaway: 'A square-root parameterisation keeps the covariance valid by construction.' },
    { label: 'Connect to the guarantee', takeaway: 'The visual stability corresponds to a theorem only under its stated assumptions.' },
  ],
  'experience-replay-optimization': [
    { label: 'Learn the new task', takeaway: 'Current-only training improves the present task while old-task loss rises.' },
    { label: 'Freeze the damage', takeaway: 'Forgetting is an update-direction problem, not merely a missing-data problem.' },
    { label: 'Reveal the ideal correction', takeaway: 'Joint training defines the unavailable update we would like to recover.' },
    { label: 'Expose memory gradients', takeaway: 'Each remembered example contributes a different correction direction.' },
    { label: 'Select a constrained subset', takeaway: 'The method chooses memories whose combined update approaches the ideal.' },
    { label: 'Measure the residual', takeaway: 'A non-zero residual reveals when the buffer cannot express the required correction.' },
  ],
  'rank-feasibility': [
    { label: 'Start low rank', takeaway: 'A small adapter can express only a narrow family of corrections.' },
    { label: 'Add old-task constraints', takeaway: 'The required correction may lie outside the available adaptation space.' },
    { label: 'Increase rank', takeaway: 'Each rank expands the set of representable updates.' },
    { label: 'Reach feasibility', takeaway: 'The first feasible rank is the first point where all constraints can be met.' },
    { label: 'Apply the utility budget', takeaway: 'Feasible does not mean useful when the current task is damaged.' },
  ],
  'ticlm-replay-value': [
    { label: 'Advance time', takeaway: 'Training data arrives in chronological windows rather than one stationary dataset.' },
    { label: 'Fix the token budget', takeaway: 'Replaying old tokens displaces current tokens; it does not add free compute.' },
    { label: 'Replay a stable window', takeaway: 'Historical data can improve backward retention when the domain remains stable.' },
    { label: 'Replay a stale window', takeaway: 'Old data can harm current and future performance after the world changes.' },
    { label: 'Estimate replay value', takeaway: 'The right decision can legitimately be to replay nothing.' },
  ],
  casepath: [
    { label: 'Observe sources', takeaway: 'The system begins with inspectable documents, not a model conclusion.' },
    { label: 'Propose bounded assertions', takeaway: 'Every interpretation remains attached to the span that supports it.' },
    { label: 'Compute obligations', takeaway: 'Missing evidence becomes explicit work rather than hidden uncertainty.' },
    { label: 'Introduce conflict', takeaway: 'A newer source can invalidate an apparently complete interpretation.' },
    { label: 'Hold the action', takeaway: 'The deterministic gate refuses fluency when authority is missing.' },
    { label: 'Correct and replay', takeaway: 'A corrected source propagates through the process and produces a verifiable packet.' },
  ],
  'spatial-intelligence': [
    { label: 'Capture language', takeaway: 'Speech or text enters as an editable instruction, not a finished image.' },
    { label: 'Expose intent', takeaway: 'Objects, relations, environment, and agent goals become visible structure.' },
    { label: 'Instantiate a world', takeaway: 'The structured state becomes a spatial scene with depth and coordinates.' },
    { label: 'Act inside the scene', takeaway: 'The agent resolves a target in the current world before moving.' },
    { label: 'Edit persistently', takeaway: 'A follow-up instruction changes only the relevant state; the world survives.' },
  ],
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

function NetworkStage({ step }: { step: number }) {
  const nodes = [
    [88, 202], [152, 102], [214, 224], [292, 118], [372, 204], [454, 92], [526, 220],
  ]
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6]]
  return (
    <svg className="mechanism-svg network-stage" viewBox="0 0 620 320" role="img" aria-label="Paired interaction network showing behavioural asymmetry and response paths">
      <path className="stage-horizon" d="M42 268 H578" />
      {edges.map(([a, b], index) => (
        <line key={`${a}-${b}`} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} className={step >= 3 && index >= 3 ? 'is-emphasised' : ''} />
      ))}
      {nodes.map(([x, y], index) => (
        <g key={`${x}-${y}`} className={index < 3 ? 'network-harm' : 'network-counter'}>
          <circle cx={x} cy={y} r={step >= 1 && (index === 1 || index === 5) ? 18 : 11} />
          {step >= 2 ? <circle className="network-orbit" cx={x} cy={y} r={25 + (index % 3) * 5} /> : null}
        </g>
      ))}
      {step >= 2 ? (
        <g className="network-metrics">
          <text x="74" y="52">activity ↑</text>
          <text x="438" y="52">response diversity ↑</text>
        </g>
      ) : null}
      {step >= 3 ? <path className="network-response" d="M292 118 C340 60 418 52 454 92" /> : null}
      {step >= 4 ? <text className="stage-boundary" x="310" y="300" textAnchor="middle">association ≠ causal intervention</text> : null}
    </svg>
  )
}

function GainStage({ step, bounds = false }: { step: number; bounds?: boolean }) {
  const angle = step === 0 ? 0 : Math.min(115, 22 + step * 21)
  const lambda = Math.abs(Math.sin((angle * Math.PI) / 360)) * (bounds ? 1.8 : 1.15)
  const points = [[112, 236], [206, 76], [384, 72], [502, 230], [302, 258]]
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 4], [2, 4]]
  return (
    <div className="gain-stage-grid">
      <svg className="mechanism-svg gain-stage" viewBox="0 0 620 320" role="img" aria-label="Gain graph in which rotating one edge breaks cycle consistency and changes the smallest eigenvalue">
        {edges.map(([a, b], index) => (
          <line key={`${a}-${b}`} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]} className={index === 1 && step >= 1 ? 'gain-defect-edge' : step >= 2 && [1, 5, 6].includes(index) ? 'gain-cycle-edge' : ''} />
        ))}
        {points.map(([x, y], index) => <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 4 ? 15 : 12} />)}
        <g className={step >= 1 ? 'gain-phase is-rotated' : 'gain-phase'} transform={`translate(298 54) rotate(${angle})`}>
          <line x1="0" y1="0" x2="34" y2="0" />
          <path d="M34 0 l-8 -5 v10 z" />
        </g>
        {step >= 2 ? <path className="gain-cycle-trace" d="M206 76 L384 72 L302 258 Z" /> : null}
        {step >= 3 ? (
          <g className="gain-matrix" transform="translate(438 24)">
            <rect width="142" height="108" />
            <text x="18" y="28">L(θ)</text>
            <text x="18" y="56">off-diagonal</text>
            <text x="18" y="82">e⁻ⁱθ</text>
          </g>
        ) : null}
        {step >= 4 ? <path className="gain-mode" d="M96 260 C166 194 202 246 270 182 S396 112 512 176" /> : null}
        {step >= 5 || (bounds && step >= 3) ? <text className="stage-boundary" x="310" y="304" textAnchor="middle">repair cost ↔ frustration</text> : null}
      </svg>
      <div className="gain-readout" aria-label="Spectral readout">
        <span>cycle phase</span><strong>{angle}°</strong>
        <span>λ₀</span><strong>{lambda.toFixed(3)}</strong>
        <div className="gain-spectrum"><i style={{ width: `${Math.min(100, lambda * 55)}%` }} /></div>
      </div>
    </div>
  )
}

function UrbanStage({ step }: { step: number }) {
  const cells = [
    { x: 40, y: 46, label: 'A1', density: 0.82, slope: 0.16 },
    { x: 150, y: 46, label: 'A2', density: 0.64, slope: 0.28 },
    { x: 260, y: 46, label: 'B1', density: 0.35, slope: 0.72 },
    { x: 40, y: 150, label: 'B2', density: 0.91, slope: 0.12 },
    { x: 150, y: 150, label: 'C1', density: 0.48, slope: 0.46 },
    { x: 260, y: 150, label: 'C2', density: 0.24, slope: 0.78 },
  ]
  return (
    <div className="urban-stage">
      <svg className="mechanism-svg" viewBox="0 0 620 320" role="img" aria-label="City micro-regions with different operating conditions and vehicle suitability">
        <g transform="translate(34 22)">
          {cells.map((cell) => {
            const bikeWins = cell.density - cell.slope > 0.18
            return (
              <g key={cell.label} transform={`translate(${cell.x} ${cell.y})`} className={step >= 3 ? (bikeWins ? 'urban-bike-cell' : 'urban-van-cell') : ''}>
                <path d="M0 26 L48 0 L96 26 L48 52 Z" />
                {step >= 1 ? <path className="urban-density" d={`M8 28 L48 ${28 - cell.density * 20} L88 28 L48 48 Z`} /> : null}
                {step >= 2 ? <path className="urban-slope" d={`M12 42 L84 ${42 - cell.slope * 25}`} /> : null}
                <text x="48" y="68" textAnchor="middle">{cell.label}</text>
              </g>
            )
          })}
        </g>
        {step >= 3 ? (
          <g className="urban-comparison" transform="translate(408 72)">
            <text x="0" y="0">service time</text>
            <text x="0" y="44">cargo bike</text><rect x="100" y="28" width="76" height="18" />
            <text x="0" y="86">van</text><rect x="100" y="70" width="128" height="18" />
          </g>
        ) : null}
        {step >= 4 ? <path className="urban-rollout" d="M74 234 C176 278 274 230 404 178" /> : null}
      </svg>
      <div className="urban-legend"><span>density</span><span>slope</span><span>{step >= 3 ? 'local vehicle fit' : 'micro-region evidence'}</span></div>
    </div>
  )
}

function NaturalGradientStage({ step }: { step: number }) {
  const euclid = 'M88 246 L174 104 L258 218 L338 92 L420 188 L516 70'
  const natural = 'M88 246 C168 206 174 156 244 138 S362 108 516 70'
  return (
    <svg className="mechanism-svg natural-stage" viewBox="0 0 620 320" role="img" aria-label="Euclidean and natural-gradient optimisation paths across anisotropic distribution geometry">
      {[0, 1, 2, 3].map((ring) => (
        <ellipse key={ring} cx="310" cy="164" rx={242 - ring * 48} ry={112 - ring * 20} transform="rotate(-22 310 164)" />
      ))}
      {step >= 1 ? <path className="natural-euclid" d={euclid} /> : null}
      {step >= 2 ? <path className="natural-path" d={natural} /> : null}
      <circle cx="516" cy="70" r="14" className="natural-optimum" />
      {step >= 3 ? (
        <g className="natural-factor" transform="translate(418 208)">
          <text x="0" y="0">Σ = LLᵀ</text>
          <path d="M0 18 H124" />
          <text x="0" y="42">valid covariance</text>
        </g>
      ) : null}
      {step >= 4 ? <text className="stage-boundary" x="310" y="302" textAnchor="middle">guarantee applies under theorem assumptions</text> : null}
    </svg>
  )
}

function ReplayStage({ step }: { step: number }) {
  const oldLoss = Math.min(84, 22 + step * 13)
  const residual = step < 2 ? 78 : step === 2 ? 66 : step === 3 ? 48 : step === 4 ? 22 : 34
  const candidates = [[318, 248], [382, 202], [436, 262], [474, 166], [524, 226]]
  return (
    <div className="replay-stage">
      <svg className="mechanism-svg" viewBox="0 0 620 320" role="img" aria-label="Current-only learning increases old-task loss before replay gradients reconstruct an ideal correction">
        <defs><marker id="replay-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" /></marker></defs>
        <g className="replay-tasks">
          <circle cx="116" cy="174" r="74" />
          <circle cx="224" cy="174" r="74" />
          <text x="90" y="276">old task</text>
          <text x="210" y="276">new task</text>
        </g>
        <path className="replay-current" d="M154 210 L276 92" markerEnd="url(#replay-arrow)" />
        {step >= 2 ? <path className="replay-ideal" d="M154 210 L246 142" markerEnd="url(#replay-arrow)" /> : null}
        {step >= 3 ? candidates.map(([x, y], index) => (
          <g key={`${x}-${y}`} className={step >= 4 && [1, 3].includes(index) ? 'replay-candidate is-selected' : 'replay-candidate'}>
            <circle cx={x} cy={y} r="10" />
            <path d={`M${x} ${y} l${22 + index * 3} ${-30 - index * 6}`} markerEnd="url(#replay-arrow)" />
          </g>
        )) : null}
        {step >= 4 ? <path className="replay-realised" d="M154 210 L235 151" markerEnd="url(#replay-arrow)" /> : null}
        <g className="replay-loss" transform="translate(504 40)">
          <text x="0" y="0">old-task loss</text>
          <rect x="0" y="20" width="26" height="202" />
          <rect className="replay-loss-fill" x="0" y={222 - oldLoss * 2} width="26" height={oldLoss * 2} />
          <text x="36" y={222 - oldLoss * 2 + 8}>{oldLoss}%</text>
        </g>
        {step >= 5 ? <path className="replay-residual" d="M246 142 L235 151" markerEnd="url(#replay-arrow)" /> : null}
      </svg>
      <div className="replay-readout"><span>correction residual</span><strong>{residual}%</strong><i><b style={{ width: `${residual}%` }} /></i></div>
    </div>
  )
}

function RankStage({ step }: { step: number }) {
  const rank = Math.min(5, 1 + step)
  const feasible = step >= 3
  return (
    <div className="rank-stage">
      <svg className="mechanism-svg" viewBox="0 0 620 320" role="img" aria-label="Nested low-rank adaptation spaces expanding until old-task constraints become feasible">
        {[5, 4, 3, 2, 1].map((level) => {
          const visible = level <= rank
          return <rect key={level} x={78 + level * 24} y={46 + level * 17} width={408 - level * 48} height={220 - level * 34} className={visible ? 'rank-space is-visible' : 'rank-space'} />
        })}
        <circle cx="454" cy="96" r="11" className="rank-constraint" />
        <circle cx="404" cy="222" r="11" className="rank-constraint" />
        <circle cx="202" cy="126" r="11" className="rank-current" />
        <path className={feasible ? 'rank-correction is-feasible' : 'rank-correction'} d="M202 126 C294 66 346 82 454 96 C468 158 454 188 404 222" />
        <text x="84" y="286">rank {rank}</text>
        <text x="516" y="94">old task A</text>
        <text x="448" y="246">old task B</text>
        {step >= 4 ? <path className="rank-budget" d="M164 96 A72 72 0 0 1 252 196" /> : null}
      </svg>
      <div className="rank-readout"><span>{feasible ? 'first feasible rank reached' : 'constraints outside adaptation space'}</span><strong>{step >= 4 ? 'feasible ≠ useful' : `r = ${rank}`}</strong></div>
    </div>
  )
}

function TemporalStage({ step }: { step: number }) {
  const windows = Array.from({ length: 7 }, (_, index) => index)
  const active = 5
  return (
    <div className="temporal-stage">
      <svg className="mechanism-svg" viewBox="0 0 620 320" role="img" aria-label="Chronological data windows competing for a fixed token budget while replay value changes over time">
        <path className="temporal-axis" d="M52 236 H572" />
        {windows.map((window) => (
          <g key={window} transform={`translate(${56 + window * 74} 0)`} className={window === active ? 'temporal-window is-current' : window < active ? 'temporal-window is-past' : 'temporal-window is-future'}>
            <rect x="0" y={96 + (window % 2) * 18} width="48" height="112" />
            <text x="24" y="260" textAnchor="middle">t{window + 1}</text>
          </g>
        ))}
        {step >= 1 ? <path className="temporal-budget" d="M430 74 H548" /> : null}
        {step >= 2 ? <path className="temporal-replay is-helpful" d="M426 120 C344 30 174 42 130 110" /> : null}
        {step >= 3 ? <path className="temporal-replay is-stale" d="M426 146 C310 66 114 70 56 148" /> : null}
        {step >= 2 ? <text x="96" y="38">backward regret ↓</text> : null}
        {step >= 3 ? <text x="356" y="42">current / future regret ↑</text> : null}
        {step >= 4 ? (
          <g className="temporal-value" transform="translate(426 250)">
            <text x="0" y="0">estimated replay value</text>
            <text x="0" y="28">max(0, value) = 0</text>
          </g>
        ) : null}
      </svg>
      <div className="temporal-token-bar"><span>fixed training budget</span><i><b style={{ width: step >= 1 ? '64%' : '100%' }} /><em style={{ width: step >= 1 ? '36%' : '0%' }} /></i><small>{step >= 1 ? 'current tokens displaced by replay' : 'all current tokens'}</small></div>
    </div>
  )
}

function CasePathStage({ step }: { step: number }) {
  const states = ['sources', 'assertions', 'obligations', 'gate', 'packet']
  const conflict = step >= 3 && step < 5
  return (
    <div className="casepath-stage">
      <svg className="mechanism-svg" viewBox="0 0 620 320" role="img" aria-label="Sources becoming bounded assertions, obligations, a deterministic hold, and a replayable provenance packet">
        {states.map((state, index) => {
          const x = 34 + index * 118
          const completed = index <= Math.min(4, step)
          return (
            <g key={state} transform={`translate(${x} ${84 + (index % 2) * 34})`} className={completed ? 'case-node is-complete' : 'case-node'}>
              <rect width="92" height="82" />
              <text x="12" y="24">0{index + 1}</text>
              <text x="12" y="58">{state}</text>
              {index < states.length - 1 ? <path d={`M92 41 L${118} ${index % 2 === 0 ? 75 : 7}`} /> : null}
            </g>
          )
        })}
        {step >= 1 ? <path className="case-citation" d="M56 66 L142 116" /> : null}
        {step >= 2 ? <text className="case-obligation" x="292" y="246">missing authority proof</text> : null}
        {conflict ? (
          <g className="case-conflict" transform="translate(52 224)">
            <rect width="172" height="54" />
            <text x="14" y="22">source B contradicts A</text>
            <text x="14" y="42">new obligation created</text>
          </g>
        ) : null}
        {step >= 4 ? <text className="case-hold" x="452" y="54">HOLD</text> : null}
        {step >= 5 ? <path className="case-proof" d="M506 246 L536 270 L582 214" /> : null}
      </svg>
      <div className={step >= 4 && step < 5 ? 'case-gate-readout is-held' : step >= 5 ? 'case-gate-readout is-accepted' : 'case-gate-readout'}>
        <span>deterministic authority</span>
        <strong>{step >= 5 ? 'ACCEPT + REPLAY' : step >= 4 ? 'HOLD' : 'NOT YET EVALUATED'}</strong>
      </div>
    </div>
  )
}

function SpatialStage({ step }: { step: number }) {
  return (
    <div className={`spatial-stage-preview spatial-step-${step}`}>
      <div className="spatial-sky"><i /><i /><i /></div>
      <div className="spatial-mountain mountain-a" /><div className="spatial-mountain mountain-b" /><div className="spatial-mountain mountain-c" />
      <div className="spatial-floor">
        {step >= 2 ? <div className="spatial-lab-shell"><span>LAB</span></div> : null}
        {step >= 2 ? <div className="spatial-object-preview microscope"><i /><b /></div> : null}
        {step >= 2 ? <div className="spatial-object-preview robotic-arm"><i /><b /><em /></div> : null}
        {step >= 3 ? <div className="spatial-object-preview sample"><i /></div> : null}
        {step >= 3 ? <div className="spatial-agent-preview"><i /><span>agent</span></div> : null}
        {step >= 4 ? <div className="spatial-agent-path" /> : null}
      </div>
      {step >= 1 ? (
        <div className="spatial-intent-preview">
          <span>environment · mountain</span><span>time · sunset</span><span>relations · beside</span><span>goal · inspect sample</span>
        </div>
      ) : null}
      {step >= 4 ? <div className="spatial-diff-preview">+ sample-2<br />light: sunset → night</div> : null}
    </div>
  )
}

export function ProjectMechanism({
  workId,
  step,
  compact = false,
}: {
  workId: string
  step: number
  compact?: boolean
}) {
  const boundedStep = Math.max(0, Math.min(step, (PROJECT_STEP_COPY[workId]?.length ?? 1) - 1))
  const className = compact ? `project-mechanism is-compact mechanism-${workId}` : `project-mechanism mechanism-${workId}`

  let visual
  switch (workId) {
    case 'counterspeech-dynamics': visual = <NetworkStage step={boundedStep} />; break
    case 'normalized-gain-laplacians': visual = <GainStage step={boundedStep} />; break
    case 'extremal-gain-laplacian-bounds': visual = <GainStage step={boundedStep} bounds />; break
    case 'urban-microregion-logistics': visual = <UrbanStage step={boundedStep} />; break
    case 'square-root-natural-gradient': visual = <NaturalGradientStage step={boundedStep} />; break
    case 'experience-replay-optimization': visual = <ReplayStage step={boundedStep} />; break
    case 'rank-feasibility': visual = <RankStage step={boundedStep} />; break
    case 'ticlm-replay-value': visual = <TemporalStage step={boundedStep} />; break
    case 'casepath': visual = <CasePathStage step={boundedStep} />; break
    case 'spatial-intelligence': visual = <SpatialStage step={boundedStep} />; break
    default: visual = <NetworkStage step={boundedStep} />
  }

  return <div className={className} data-mechanism={workId} data-step={boundedStep}>{visual}</div>
}

export function GuidedMechanism({
  workId,
  autoplay = false,
  compact = false,
  link = true,
}: {
  workId: string
  autoplay?: boolean
  compact?: boolean
  link?: boolean
}) {
  const steps = PROJECT_STEP_COPY[workId] ?? [{ label: 'Inspect the work', takeaway: 'Open the evidence and mechanism.' }]
  const reducedMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(autoplay && !reducedMotion)
  const titleId = useId()
  const work = getWork(workId)

  useEffect(() => {
    if (!playing || reducedMotion) return undefined
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), compact ? 3500 : 5200)
    return () => window.clearInterval(timer)
  }, [compact, playing, reducedMotion, steps.length])

  const move = (delta: number) => {
    setPlaying(false)
    setStep((current) => (current + delta + steps.length) % steps.length)
  }

  const current = steps[step]
  return (
    <section className={compact ? 'guided-mechanism is-compact' : 'guided-mechanism'} aria-labelledby={titleId} data-guided-work={workId}>
      <div className="guided-visual"><ProjectMechanism workId={workId} step={step} compact={compact} /></div>
      <div className="guided-explanation" aria-live="polite">
        <span className="guided-count">{String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        <h3 id={titleId}>{current.label}</h3>
        <p>{current.takeaway}</p>
        {link ? <Link to={work.route}>Open the complete work <span aria-hidden="true">↗</span></Link> : null}
      </div>
      <div className="guided-transport" aria-label={`${work.shortTitle} explanation controls`}>
        <button type="button" onClick={() => move(-1)} aria-label="Previous step">←</button>
        <button type="button" onClick={() => setPlaying((value) => !value)} aria-pressed={playing} disabled={reducedMotion}>
          {reducedMotion ? 'Step mode' : playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => move(1)} aria-label="Next step">→</button>
        <button type="button" onClick={() => { setPlaying(false); setStep(0) }}>Restart</button>
      </div>
      <div className="guided-scrubber" role="tablist" aria-label={`${work.shortTitle} explanation steps`}>
        {steps.map((item, index) => (
          <button key={item.label} type="button" role="tab" aria-selected={index === step} onClick={() => { setPlaying(false); setStep(index) }}>
            <span>{String(index + 1).padStart(2, '0')}</span><i />
          </button>
        ))}
      </div>
    </section>
  )
}

export function ProgrammeStage({
  index: controlledIndex,
  onIndexChange,
  autoplay = true,
}: {
  index?: number
  onIndexChange?: (index: number) => void
  autoplay?: boolean
} = {}) {
  const reducedMotion = useReducedMotion()
  const [internalIndex, setInternalIndex] = useState(0)
  const [playing, setPlaying] = useState(autoplay && !reducedMotion)
  const index = controlledIndex ?? internalIndex
  const changeIndex = (nextIndex: number) => {
    if (controlledIndex === undefined) setInternalIndex(nextIndex)
    onIndexChange?.(nextIndex)
  }
  const moment = PROGRAMME_MOMENTS[index]
  const work = getWork(moment.id)
  const stageStep = useMemo(() => {
    const length = PROJECT_STEP_COPY[moment.id]?.length ?? 1
    return Math.min(length - 1, Math.max(0, index === 0 ? 2 : index === PROGRAMME_MOMENTS.length - 1 ? 3 : 4))
  }, [index, moment.id])

  useEffect(() => {
    if (!playing || reducedMotion) return undefined
    const timer = window.setInterval(() => changeIndex((index + 1) % PROGRAMME_MOMENTS.length), 6500)
    return () => window.clearInterval(timer)
  }, [index, onIndexChange, playing, reducedMotion])

  const move = (delta: number) => {
    setPlaying(false)
    changeIndex((index + delta + PROGRAMME_MOMENTS.length) % PROGRAMME_MOMENTS.length)
  }

  return (
    <section className="programme-stage" data-programme-index={index}>
      <div className="programme-stage-topline">
        <span>{moment.period}</span>
        <span>{work.year}</span>
        <span>{work.researchStatusLabel}</span>
      </div>
      <div className="programme-stage-body">
        <div className="programme-stage-visual"><ProjectMechanism workId={moment.id} step={stageStep} /></div>
        <div className="programme-stage-copy" aria-live="polite">
          <span>{String(index + 1).padStart(2, '0')} — {moment.verb}</span>
          <h2>{moment.title}</h2>
          <p>{moment.consequence}</p>
          <Link to={work.route}>{work.shortTitle} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <div className="programme-transport">
        <button type="button" onClick={() => move(-1)} aria-label="Previous research moment">←</button>
        <button type="button" onClick={() => setPlaying((value) => !value)} aria-pressed={playing} disabled={reducedMotion}>{reducedMotion ? 'Step mode' : playing ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => move(1)} aria-label="Next research moment">→</button>
      </div>
      <div className="programme-rail" role="tablist" aria-label="Research programme moments">
        {PROGRAMME_MOMENTS.map((item, itemIndex) => (
          <button key={item.id} type="button" role="tab" aria-selected={itemIndex === index} onClick={() => { setPlaying(false); changeIndex(itemIndex) }}>
            <span>{item.verb}</span><i /><small>{item.period}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
