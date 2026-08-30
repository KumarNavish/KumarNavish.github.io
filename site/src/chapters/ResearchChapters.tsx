import { useCallback, useMemo, useState } from 'react'

import {
  ChapterScaffold,
  type ChapterStep,
} from './ChapterScaffold'

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function lineEnd(originX: number, originY: number, angleDegrees: number, length: number) {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    x: originX + Math.cos(radians) * length,
    y: originY - Math.sin(radians) * length,
  }
}

function RangeControl({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="chapter-control">
      <span>
        {label}
        <output>{display}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function NaturalGradientVisual({
  step,
  condition,
  geometry,
}: {
  step: number
  condition: number
  geometry: 'natural' | 'euclidean'
}) {
  const target = { x: 494, y: 244 }
  const start = { x: 96, y: 400 }
  const eccentricity = 1 + condition * 2.1
  const naturalProgress = [0.04, 0.2, 0.42, 0.78, 0.95][step] ?? 0.95
  const euclideanProgress = [0.02, 0.12, 0.27, 0.52, 0.72][step] ?? 0.72
  const progress = geometry === 'natural' ? naturalProgress : euclideanProgress
  const currentX = start.x + (target.x - start.x) * progress
  const curveOffset = geometry === 'natural' ? 90 * (1 - progress) : -90 * Math.sin(progress * Math.PI * 3)
  const currentY = start.y + (target.y - start.y) * progress - curveOffset

  return (
    <svg className="chapter-svg natural-stage" viewBox="0 0 720 520" role="img" aria-label="Optimization geometry and covariance stage">
      <defs>
        <marker id="natural-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0 0L8 4L0 8Z" fill="currentColor" />
        </marker>
      </defs>

      <g transform={`rotate(-20 ${target.x} ${target.y})`}>
        {[1, 0.78, 0.56, 0.34].map((scaleValue, index) => (
          <ellipse
            key={scaleValue}
            cx={target.x}
            cy={target.y}
            rx={175 * scaleValue * eccentricity}
            ry={92 * scaleValue}
            fill="none"
            stroke={index === 3 ? '#9ea59b' : '#d3d7d0'}
            strokeWidth={index === 3 ? 2 : 1.3}
            opacity={step === 0 ? 0.58 : 1}
          />
        ))}
      </g>

      <circle cx={target.x} cy={target.y} r="8" fill="#c9472d" />
      <text x={target.x + 15} y={target.y - 14} className="stage-label">best Gaussian approximation</text>

      <path
        d={`M${start.x} ${start.y} L178 280 L248 386 L326 252 L398 318 L${target.x} ${target.y}`}
        fill="none"
        stroke="#aeb4aa"
        strokeWidth="2.4"
        strokeDasharray="8 7"
        opacity={geometry === 'euclidean' || step === 1 ? 1 : 0.25}
      />
      <path
        d={`M${start.x} ${start.y} C210 330 305 262 ${target.x} ${target.y}`}
        fill="none"
        stroke="#1b6b50"
        strokeWidth="3.2"
        strokeDasharray="420"
        strokeDashoffset={420 * (1 - naturalProgress)}
        opacity={geometry === 'natural' || step === 1 ? 1 : 0.25}
        style={{ transition: 'stroke-dashoffset 700ms ease, opacity 250ms ease' }}
      />

      <g transform={`translate(${currentX} ${currentY}) rotate(${geometry === 'natural' ? -20 : 20})`}>
        <ellipse
          cx="0"
          cy="0"
          rx={30 + step * 5}
          ry={14 + step * 2}
          fill="rgba(40, 94, 196, 0.12)"
          stroke="#285ec4"
          strokeWidth="2"
        />
        <line x1={-26 - step * 4} y1="0" x2={26 + step * 4} y2="0" stroke="#285ec4" strokeWidth="2" />
        <line x1="0" y1={-11 - step} x2="0" y2={11 + step} stroke="#285ec4" strokeWidth="1.4" />
      </g>

      <g transform="translate(78 76)">
        <rect width="210" height="102" rx="16" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="28" className="stage-label">Parameterization</text>
        <text x="20" y="54">Σ = S Sᵀ</text>
        <text x="20" y="77" className="stage-caption">Optimize a square root, not arbitrary covariance entries.</text>
      </g>

      <g transform="translate(78 205)" opacity={step >= 1 ? 1 : 0.28}>
        <rect width="210" height="88" rx="16" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="29" className="stage-label">Geometry</text>
        <text x="20" y="56">Δθ ∝ F(θ)⁻¹ ∇ℒ(θ)</text>
      </g>

      <g transform="translate(78 321)" opacity={step >= 3 ? 1 : 0.28}>
        <rect width="210" height="88" rx="16" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="29" className="stage-label">Consequence</text>
        <text x="20" y="56">stable path + convergence guarantee</text>
      </g>

      <g transform="translate(470 448)">
        <line x1="0" y1="0" x2="154" y2="0" stroke="#d0d5cd" />
        <circle cx={geometry === 'natural' ? 132 : 76} cy="0" r="7" fill={geometry === 'natural' ? '#1b6b50' : '#aeb4aa'} />
        <text x="0" y="28">progress through the same loss geometry</text>
      </g>
    </svg>
  )
}

const NATURAL_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'The most useful geometry was theoretically awkward.',
    body:
      'Natural-gradient variational inference often moves efficiently because it respects the geometry of probability distributions. Yet even simple Gaussian cases had resisted a clean convergence argument.',
    takeaway: 'Empirical strength and theoretical understanding were misaligned.',
  },
  {
    label: 'Geometry',
    title: 'The update should follow distribution geometry, not raw coordinates.',
    body:
      'A Euclidean step treats every parameter direction alike. The natural gradient rescales the update by the local information geometry, changing the path through the same objective.',
    takeaway: 'The same loss surface admits radically different optimization trajectories.',
  },
  {
    label: 'Key object',
    title: 'Write covariance as a square root.',
    body:
      'Representing covariance as Σ = SSᵀ exposes a parameterization in which the natural-gradient dynamics become tractable without discarding the Gaussian approximation used in practice.',
    takeaway: 'The square-root representation is the bridge between geometry and analysis.',
  },
  {
    label: 'Mechanism',
    title: 'The geometry now yields a controlled path.',
    body:
      'The discrete update and its continuous-time flow can be analyzed under concave log-likelihood assumptions. The visualization shows the distribution adapting both its center and shape.',
    takeaway: 'Optimization behavior becomes something that can be guaranteed, not only observed.',
  },
  {
    label: 'Contribution',
    title: 'Practical natural gradients acquire a convergence story.',
    body:
      'The work supplies convergence guarantees and compares natural, Euclidean, and Wasserstein geometries empirically, clarifying why the natural route can be both fast and stable.',
    takeaway: 'A practical inference method becomes formally defensible.',
  },
]

export function NaturalGradientChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [condition, setCondition] = useState(0.62)
  const [geometry, setGeometry] = useState<'natural' | 'euclidean'>('natural')
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])

  return (
    <ChapterScaffold
      eyebrow="Optimization geometry"
      status="Published · 2025"
      title="Natural-Gradient Variational Inference"
      question="Can an optimization method known to work in practice also admit a clean convergence theory?"
      thesis="The key is to represent Gaussian covariance through its square root, making natural-gradient variational inference analytically tractable while preserving the geometry that gives it practical strength."
      steps={NATURAL_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<NaturalGradientVisual step={activeStep} condition={condition} geometry={geometry} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl
            label="Loss anisotropy"
            value={condition}
            display={`${(1 + condition * 9).toFixed(1)}×`}
            min={0}
            max={1}
            step={0.01}
            onChange={setCondition}
          />
          <div className="chapter-control">
            <span>Optimization geometry</span>
            <div className="chapter-preset-row">
              {(['natural', 'euclidean'] as const).map((item) => (
                <button key={item} type="button" className={geometry === item ? 'is-active' : ''} onClick={() => setGeometry(item)}>
                  {item === 'natural' ? 'Natural gradient' : 'Euclidean gradient'}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`q(z) = 𝒩(m, Σ),   Σ = S Sᵀ\n\nNatural update:  Δθ ∝ F(θ)⁻¹ ∇ℒ(θ)\n\nObject of analysis: discrete updates and continuous-time flow.`}</code>
          <dl>
            <dt>Approximation family</dt><dd>Gaussian</dd>
            <dt>Covariance coordinates</dt><dd>square root S</dd>
            <dt>Geometries compared</dt><dd>natural / Euclidean / Wasserstein</dd>
          </dl>
        </div>
      }
      contribution={[
        'Identified square-root covariance geometry as the representation that removes the main analytical obstruction.',
        'Established convergence guarantees for natural-gradient variational Gaussian inference and its continuous-time flow.',
        'Connected the formal result to empirical comparisons across competing optimization geometries.',
      ]}
      evidence={[
        {
          label: 'Paper',
          title: 'Optimization Guarantees for Square-Root Natural-Gradient Variational Inference',
          detail: 'Navish Kumar, Thomas Möllenhoff, Mohammad Emtiyaz Khan, and Aurelien Lucchi.',
          href: 'https://arxiv.org/abs/2507.07853',
        },
        {
          label: 'Result',
          title: 'Discrete and continuous dynamics',
          detail: 'The analysis covers both the update rule used by an algorithm and its corresponding gradient flow.',
        },
        {
          label: 'Interpretation',
          title: 'Geometry is not presentation',
          detail: 'Changing geometry changes the actual direction and conditioning of each optimization step.',
        },
      ]}
      boundary="The guarantee is established for the assumptions studied in the paper, including concave log-likelihood settings and Gaussian approximation. It is not a universal convergence claim for arbitrary non-convex variational models."
      links={[{ label: 'Read paper', href: 'https://arxiv.org/abs/2507.07853' }]}
      next={{ label: 'Next explanation', title: 'Experience Replay / GBR', route: '/research/experience-replay-optimization' }}
    />
  )
}

function GbrVisual({ step, budget, interference }: { step: number; budget: number; interference: number }) {
  const origin = { x: 358, y: 378 }
  const current = lineEnd(origin.x, origin.y, 18, 205)
  const targetAngle = 45 + interference * 48
  const target = lineEnd(origin.x, origin.y, targetAngle, 215)
  const fit = clamp((budget - 1) / 8)
  const replayAngle = targetAngle - (1 - fit) * (18 + interference * 22)
  const replayLength = 180 + fit * 30
  const replay = lineEnd(origin.x, origin.y, replayAngle, replayLength)
  const residual = Math.hypot(target.x - replay.x, target.y - replay.y)
  const candidates = [
    [122, 112], [182, 168], [132, 244], [228, 94], [260, 197], [204, 286],
    [90, 312], [275, 304], [166, 338], [303, 128], [82, 188], [244, 252],
  ]
  const selected = candidates
    .map((point, index) => ({ point, index, score: Math.abs(point[1] - (320 - point[0] * 0.55)) }))
    .sort((left, right) => left.score - right.score)
    .slice(0, budget)
    .map((item) => item.index)

  return (
    <svg className="chapter-svg gbr-stage" viewBox="0 0 720 520" role="img" aria-label="Replay gradient selection stage">
      <defs>
        <marker id="gbr-current-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#c9472d" /></marker>
        <marker id="gbr-target-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#111310" /></marker>
        <marker id="gbr-replay-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#285ec4" /></marker>
      </defs>

      <g opacity={step >= 1 ? 1 : 0.36}>
        <rect x="46" y="54" width="282" height="350" rx="24" fill="#ffffff" stroke="#d9ddd4" />
        <text x="72" y="86" className="stage-label">Memory candidates</text>
        <text x="72" y="106" className="stage-caption">Each dot carries a different replay gradient.</text>
        {candidates.map(([x, y], index) => (
          <g key={`${x}-${y}`}>
            <circle
              cx={x}
              cy={y}
              r={selected.includes(index) && step >= 2 ? 10 : 7}
              fill={selected.includes(index) && step >= 2 ? '#285ec4' : '#cbd0c8'}
              opacity={selected.includes(index) && step >= 2 ? 1 : 0.72}
              style={{ transition: 'r 350ms ease, fill 350ms ease' }}
            />
            {selected.includes(index) && step >= 2 ? <circle cx={x} cy={y} r="16" fill="none" stroke="rgba(40,94,196,.25)" /> : null}
          </g>
        ))}
        <text x="72" y="382">selected {Math.min(budget, candidates.length)} / {candidates.length}</text>
      </g>

      <g>
        <line x1={origin.x} y1={origin.y} x2={current.x} y2={current.y} stroke="#c9472d" strokeWidth="4" markerEnd="url(#gbr-current-arrow)" />
        <text x={current.x - 4} y={current.y + 26} className="stage-label">current batch</text>
      </g>

      <g opacity={step >= 1 ? 1 : 0.2}>
        <line x1={origin.x} y1={origin.y} x2={target.x} y2={target.y} stroke="#111310" strokeWidth="4" markerEnd="url(#gbr-target-arrow)" />
        <text x={target.x - 32} y={target.y - 18} className="stage-label">joint-training target</text>
      </g>

      <g opacity={step >= 2 ? 1 : 0.18}>
        <line
          x1={origin.x}
          y1={origin.y}
          x2={replay.x}
          y2={replay.y}
          stroke="#285ec4"
          strokeWidth="4"
          markerEnd="url(#gbr-replay-arrow)"
          style={{ transition: 'x2 500ms ease, y2 500ms ease' }}
        />
        <text x={replay.x - 38} y={replay.y + 24} className="stage-label">selected replay correction</text>
        <line x1={replay.x} y1={replay.y} x2={target.x} y2={target.y} stroke="#c9472d" strokeWidth="2.4" strokeDasharray="7 5" />
      </g>

      <g transform="translate(424 408)" opacity={step >= 2 ? 1 : 0.3}>
        <rect width="244" height="76" rx="16" fill="#ffffff" stroke="#d9ddd4" />
        <text x="18" y="27" className="stage-label">observable mismatch ρ</text>
        <rect x="18" y="43" width="192" height="10" rx="5" fill="#e1e4dd" />
        <rect x="18" y="43" width={Math.min(192, residual * 1.8)} height="10" rx="5" fill="#c9472d" style={{ transition: 'width 500ms ease' }} />
        <text x="218" y="53">{residual.toFixed(1)}</text>
      </g>

      <g transform="translate(425 62)" opacity={step >= 3 ? 1 : 0.22}>
        <rect width="244" height="108" rx="16" fill="#ffffff" stroke="#d9ddd4" />
        <text x="18" y="29" className="stage-label">Downstream consequence</text>
        <text x="18" y="55">smaller mismatch → better retained direction</text>
        <path d="M18 88C68 84 102 74 139 56C166 44 191 37 220 34" fill="none" stroke="#1b6b50" strokeWidth="3" />
      </g>

      {step === 4 ? (
        <g transform="translate(425 194)">
          <rect width="244" height="122" rx="16" fill="rgba(201,71,45,.06)" stroke="#c9472d" />
          <text x="18" y="30" className="stage-label">Hard boundary</text>
          <text x="18" y="56">If the target lies outside the candidate span,</text>
          <text x="18" y="76">no subset can eliminate the residual.</text>
          <text x="18" y="101">The diagnostic exposes that failure.</text>
        </g>
      ) : null}
    </svg>
  )
}

const GBR_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'Learning the present can erase the past.',
    body:
      'In online continual learning, the current batch supplies the update now. Its gradient can point against previous tasks, causing catastrophic forgetting even when a memory buffer exists.',
    takeaway: 'Replay is useful only when its update actually counters destructive interference.',
  },
  {
    label: 'Target',
    title: 'Joint training defines the direction we wanted.',
    body:
      'Imagine the update that would have been produced by training on current and past data together. That dense direction becomes a concrete correction target rather than an informal hope that replay will help.',
    takeaway: 'The replay problem becomes directional approximation.',
  },
  {
    label: 'Selection',
    title: 'Choose the remembered examples that best match the correction.',
    body:
      'Candidate memory gradients differ. Greedy Ball Replay selects a small replay subset whose aggregate gradient most closely approximates the target correction under the replay budget.',
    takeaway: 'Replay content—not merely replay quantity—determines the update.',
  },
  {
    label: 'Diagnostic',
    title: 'The remaining mismatch is observable.',
    body:
      'The residual ρ reports how much of the desired correction the selected replay batch failed to realize. It can be tracked step by step and related to practical loss and forgetting outcomes.',
    takeaway: 'A hidden failure mode becomes a measurable system signal.',
  },
  {
    label: 'Boundary',
    title: 'Selection cannot invent missing directions.',
    body:
      'If the candidate pool does not contain gradients capable of expressing the desired correction, no selector can close the gap. The diagnostic remains valuable because it reveals that structural failure.',
    takeaway: 'GBR identifies both a better subset and when the buffer itself is insufficient.',
  },
]

export function GbrChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [budget, setBudget] = useState(4)
  const [interference, setInterference] = useState(0.58)
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])
  const mismatch = useMemo(() => (1 - clamp((budget - 1) / 8)) * (0.34 + interference * 0.46), [budget, interference])

  return (
    <ChapterScaffold
      eyebrow="Continual learning"
      status="Under revision · ICML 2026 OpenReview record"
      title="Experience Replay Through the Lens of Optimization"
      question="Which remembered examples make the next update resemble the joint training we can no longer afford?"
      thesis="Replay can be posed as a constrained correction problem: define the direction joint training would have induced, select a small replay subset that approximates it, and expose the residual when the buffer cannot."
      steps={GBR_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<GbrVisual step={activeStep} budget={budget} interference={interference} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl label="Replay batch size k" value={budget} display={`${budget} examples`} min={1} max={9} step={1} onChange={setBudget} />
          <RangeControl label="Current–past interference" value={interference} display={`${Math.round(interference * 90)}°`} min={0} max={1} step={0.01} onChange={setInterference} />
          <div className="chapter-formal-object">
            <dl>
              <dt>Estimated normalized mismatch</dt><dd>{mismatch.toFixed(3)}</dd>
              <dt>Candidate pool</dt><dd>12 examples</dd>
              <dt>Replay budget</dt><dd>{budget}</dd>
            </dl>
          </div>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`Dense target:\n g*ₜ = (1 − αₛ) gₜ,current + αₛ gₜ,past\n\nReplay correction target:\n τₜ = g*ₜ − gₜ,current\n\nObservable selection mismatch:\n ρₜ = ‖gₜ,replay − τₜ‖`}</code>
          <dl>
            <dt>Optimization object</dt><dd>correction mismatch</dd>
            <dt>Constraint</dt><dd>k-example replay batch</dd>
            <dt>Selector</dt><dd>greedy subset approximation</dd>
          </dl>
        </div>
      }
      contribution={[
        'Reframed replay as steering each update toward the direction induced by a joint current-and-past objective.',
        'Derived a concrete replay correction target and a budget-constrained subset-matching problem.',
        'Introduced Greedy Ball Replay and an observable residual that diagnoses how well replay realizes the intended correction.',
        'Separated selection fit from other error sources so failure claims become testable rather than anecdotal.',
      ]}
      evidence={[
        {
          label: 'OpenReview',
          title: 'Submission, reviews, and rebuttal record',
          detail: 'The public record preserves the central dense-gradient criticism, author response, added ablations, and final decision.',
          href: 'https://openreview.net/forum?id=4z7il66fFb',
        },
        {
          label: 'Controlled result',
          title: 'Greedy subset versus random subset',
          detail: 'Matched candidate pools test whether selecting the replay subset changes outcomes when only k examples may be used.',
        },
        {
          label: 'Current status',
          title: 'Being revised for resubmission',
          detail: 'The revision sharpens the practical setting, dense baseline comparison, computational claim boundaries, and evidence architecture.',
        },
      ]}
      boundary="The method does not make dense target computation free, and the public ICML record includes a serious criticism that dense gradient weighting may be simpler and stronger in some settings. The revision must earn the subset-selection setting through an explicit resource contract and fair dense baselines."
      links={[
        { label: 'OpenReview discussion', href: 'https://openreview.net/forum?id=4z7il66fFb' },
        { label: 'Review materials', href: 'https://github.com/KumarNavish/review-materials-ayw79juc' },
      ]}
      next={{ label: 'Next explanation', title: 'Rank Feasibility in Continual PEFT', route: '/research/rank-feasibility' }}
    />
  )
}

function RankVisual({ step, rank, demand }: { step: number; rank: number; demand: number }) {
  const origin = { x: 110, y: 410 }
  const targetAngle = 55 + demand * 30
  const target = lineEnd(origin.x, origin.y, targetAngle, 300)
  const aperture = 7 + Math.log2(Math.max(rank, 1)) * 8.6
  const centerAngle = 43
  const low = lineEnd(origin.x, origin.y, centerAngle - aperture / 2, 345)
  const high = lineEnd(origin.x, origin.y, centerAngle + aperture / 2, 345)
  const feasible = targetAngle <= centerAngle + aperture / 2
  const projectionAngle = clamp(targetAngle, centerAngle - aperture / 2, centerAngle + aperture / 2)
  const projection = lineEnd(origin.x, origin.y, projectionAngle, 260)
  const correctionNorm = feasible ? 0.42 + demand * 0.76 + 16 / Math.max(rank, 1) : 2.8 + demand
  const progressRetained = clamp(1.12 - correctionNorm * 0.17)

  return (
    <svg className="chapter-svg rank-stage" viewBox="0 0 720 520" role="img" aria-label="Low-rank correction feasibility stage">
      <defs>
        <linearGradient id="rank-space-fill" x1="0" x2="1">
          <stop offset="0" stopColor="#285ec4" stopOpacity="0.18" />
          <stop offset="1" stopColor="#285ec4" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      <path d={`M${origin.x} ${origin.y}L${low.x} ${low.y}A345 345 0 0 0 ${high.x} ${high.y}Z`} fill="url(#rank-space-fill)" stroke="#285ec4" strokeWidth="2" style={{ transition: 'd 500ms ease' }} />
      <line x1={origin.x} y1={origin.y} x2={low.x} y2={low.y} stroke="#285ec4" strokeDasharray="7 6" />
      <line x1={origin.x} y1={origin.y} x2={high.x} y2={high.y} stroke="#285ec4" strokeDasharray="7 6" />
      <text x="82" y="450" className="stage-label">current checkpoint</text>
      <text x="220" y="414" className="stage-caption">rank-{rank} correction space</text>

      <line x1={origin.x} y1={origin.y} x2={target.x} y2={target.y} stroke="#c9472d" strokeWidth="3.4" opacity={step >= 0 ? 1 : 0.2} />
      <circle cx={target.x} cy={target.y} r="9" fill="#c9472d" />
      <text x={target.x - 45} y={target.y - 20} className="stage-label">needed correction</text>

      <line x1={origin.x} y1={origin.y} x2={projection.x} y2={projection.y} stroke={feasible ? '#1b6b50' : '#8e948c'} strokeWidth="3" opacity={step >= 1 ? 1 : 0.18} />
      <circle cx={projection.x} cy={projection.y} r="7" fill={feasible ? '#1b6b50' : '#8e948c'} />
      {!feasible ? <line x1={projection.x} y1={projection.y} x2={target.x} y2={target.y} stroke="#c9472d" strokeWidth="2.4" strokeDasharray="7 5" /> : null}

      <g transform="translate(414 64)" opacity={step >= 2 ? 1 : 0.28}>
        <rect width="252" height="150" rx="18" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="31" className="stage-label">Task-wise constraints</text>
        {[0, 1, 2, 3].map((index) => {
          const width = 118 + index * 21
          const pass = feasible || index < 1
          return (
            <g key={index} transform={`translate(20 ${54 + index * 22})`}>
              <rect width={width} height="9" rx="4.5" fill={pass ? 'rgba(27,107,80,.28)' : 'rgba(201,71,45,.22)'} />
              <circle cx={width + 16} cy="4.5" r="5" fill={pass ? '#1b6b50' : '#c9472d'} />
            </g>
          )
        })}
      </g>

      <g transform="translate(414 238)" opacity={step >= 3 ? 1 : 0.28}>
        <rect width="252" height="102" rx="18" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="31" className="stage-label">Local verdict</text>
        <text x="20" y="60" fill={feasible ? '#1b6b50' : '#c9472d'}>{feasible ? 'feasible correction exists' : 'no correction satisfies every task'}</text>
        <text x="20" y="82">minimum norm {correctionNorm.toFixed(2)}</text>
      </g>

      <g transform="translate(414 364)" opacity={step >= 4 ? 1 : 0.28}>
        <rect width="252" height="102" rx="18" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="31" className="stage-label">Practical guardrail</text>
        <text x="20" y="57">current-task progress retained</text>
        <rect x="20" y="72" width="188" height="10" rx="5" fill="#e1e4dd" />
        <rect x="20" y="72" width={188 * progressRetained} height="10" rx="5" fill={progressRetained >= 0.9 ? '#1b6b50' : '#c9472d'} />
        <text x="216" y="82">{Math.round(progressRetained * 100)}%</text>
      </g>
    </svg>
  )
}

const RANK_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'A low-rank adapter cannot move everywhere.',
    body:
      'After learning a new task, repairing old tasks requires another parameter update. LoRA restricts that update to a rank-dependent space, so some needed corrections may simply be inexpressible.',
    takeaway: 'Forgetting can be geometric, not merely an optimization failure.',
  },
  {
    label: 'Projection',
    title: 'The closest available direction may still miss the target.',
    body:
      'At low rank, the desired correction is projected into a narrow subspace. If the target sits outside it, no optimizer operating within that adapter can recover the full task-wise correction.',
    takeaway: 'More training cannot overcome a missing direction.',
  },
  {
    label: 'Constraints',
    title: 'Every old task contributes a separate requirement.',
    body:
      'The correction must reduce each old-task gap while preserving current-task progress. Combinations of these constraints determine whether the rank-dependent space is feasible.',
    takeaway: 'Average improvement is insufficient when one protected task can still fail.',
  },
  {
    label: 'Rank test',
    title: 'Increasing rank expands the feasible correction space.',
    body:
      'Candidate ranks define nested spaces. For each rank, a small optimization problem either constructs the minimum-norm correction or certifies that no local correction satisfies the constraints.',
    takeaway: 'Rank becomes a testable capacity decision rather than a default hyperparameter.',
  },
  {
    label: 'Usefulness',
    title: 'Feasible is necessary, not sufficient.',
    body:
      'A correction may exist but be so large that it destroys progress on the current task. Held-out evaluation must therefore check both old-task repair and current-task retention.',
    takeaway: 'The smallest useful rank passes both the local feasibility test and the empirical guardrail.',
  },
]

export function RankChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [rank, setRank] = useState(16)
  const [demand, setDemand] = useState(0.58)
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])

  return (
    <ChapterScaffold
      eyebrow="Continual parameter-efficient adaptation"
      status="NeurIPS 2026 submission · under revision"
      title="Rank Feasibility in Continual PEFT"
      question="Does the adapter contain a correction that improves every old task without undoing the current one?"
      thesis="LoRA rank is not only a capacity knob. It defines the geometry of available corrections. A rank works only when that space contains a sufficiently small task-wise correction."
      steps={RANK_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<RankVisual step={activeStep} rank={rank} demand={demand} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl label="Candidate LoRA rank" value={rank} display={`r = ${rank}`} min={1} max={128} step={1} onChange={setRank} />
          <RangeControl label="Correction demand" value={demand} display={`${Math.round(demand * 100)}%`} min={0} max={1} step={0.01} onChange={setDemand} />
          <div className="chapter-preset-row">
            {[1, 8, 16, 32, 64, 128].map((value) => (
              <button key={value} type="button" className={rank === value ? 'is-active' : ''} onClick={() => setRank(value)}>
                rank {value}
              </button>
            ))}
          </div>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`For candidate rank r:\n\nfind minimum ‖δ‖\nsubject to task-wise local improvement constraints\nand δ ∈ Sᵣ\n\nInfeasibility certificate:\na nonnegative combination of required improvements\nhas no available direction in Sᵣ.`}</code>
          <dl>
            <dt>Decision</dt><dd>smallest rank passing both checks</dd>
            <dt>Local object</dt><dd>rank-dependent correction space Sᵣ</dd>
            <dt>Empirical guardrail</dt><dd>current progress retained</dd>
          </dl>
        </div>
      }
      contribution={[
        'Recast continual LoRA rank selection as a geometric feasibility problem at an existing checkpoint.',
        'Derived a task-wise minimum-norm correction and a certificate explaining when no correction exists in the rank space.',
        'Separated theoretical feasibility from practical usability through held-out old-task and current-task checks.',
        'Used the diagnostic to identify the first candidate rank that passes both requirements in tested checkpoints.',
      ]}
      evidence={[
        {
          label: 'OpenReview',
          title: 'Rank Feasibility in Continual PEFT',
          detail: 'The public submission and discussion contain the theorem framing, reviewer concerns, expanded checkpoints, and baseline comparisons.',
          href: 'https://openreview.net/forum?id=CwmHHYCbjK',
        },
        {
          label: 'Held-out decision',
          title: 'Reject infeasible and destructive ranks',
          detail: 'In the discussed Yahoo Answers checkpoint, ranks 1–8 were locally infeasible, rank 16 harmed current-task progress, and rank 32 first passed both tests.',
        },
        {
          label: 'Current status',
          title: 'Breadth and practicality being strengthened',
          detail: 'The revision must expand evidence while keeping the claim local, checkpoint-specific, and explicitly dependent on representative old-task data.',
        },
      ]}
      boundary="The analysis is local to a checkpoint and requires representative old-task examples. It does not claim rehearsal-free adaptation, guaranteed global restoration, or that higher rank is always better. Held-out data remain necessary to test the actual nonlinear losses."
      links={[{ label: 'OpenReview discussion', href: 'https://openreview.net/forum?id=CwmHHYCbjK' }]}
      next={{ label: 'Next explanation', title: 'Time-Continual Language Models', route: '/research/ticlm' }}
    />
  )
}

function TiclmVisual({ step, shift, replay }: { step: number; shift: number; replay: number }) {
  const windowCount = 7
  const values = Array.from({ length: windowCount - 1 }, (_, index) => {
    const age = (windowCount - 2 - index) / (windowCount - 2)
    return 0.75 - age * 0.42 - shift * (0.28 + age * 0.88)
  })
  const bestIndex = values.reduce((best, value, index) => value > values[best] ? index : best, 0)
  const totalPositive = values.reduce((sum, value) => sum + Math.max(0, value), 0)
  const allocations = values.map((value) => totalPositive > 0 ? replay * Math.max(0, value) / totalPositive : 0)
  const currentCost = replay * (0.18 + shift * 0.55)
  const backwardGain = allocations.reduce((sum, value, index) => sum + value * (0.5 + index * 0.08), 0)
  const forwardCost = allocations.reduce((sum, value, index) => sum + value * shift * (0.85 - index * 0.07), 0)

  return (
    <svg className="chapter-svg ticlm-stage" viewBox="0 0 720 520" role="img" aria-label="Time continual replay stage">
      <g transform="translate(42 56)">
        <text x="0" y="0" className="stage-label">chronological training windows</text>
        {Array.from({ length: windowCount }, (_, index) => {
          const x = index * 88
          const isCurrent = index === windowCount - 1
          const value = values[index]
          return (
            <g key={index} transform={`translate(${x} 28)`}>
              <rect width="66" height="48" rx="10" fill={isCurrent ? '#285ec4' : value !== undefined && value < 0 ? 'rgba(201,71,45,.19)' : '#eef0eb'} stroke={isCurrent ? '#285ec4' : '#c8cdc4'} />
              <text x="33" y="29" textAnchor="middle" fill={isCurrent ? '#ffffff' : undefined}>{isCurrent ? 'Bₜ' : `B${index + 1}`}</text>
              {!isCurrent ? <text x="33" y="70" textAnchor="middle">{value !== undefined ? value.toFixed(2) : ''}</text> : null}
            </g>
          )
        })}
        {values.map((value, index) => {
          const startX = index * 88 + 33
          const endX = (windowCount - 1) * 88 + 33
          const height = 56 + index * 8
          const allocation = allocations[index] ?? 0
          return (
            <path
              key={`replay-${index}`}
              d={`M${startX} 28C${startX} ${-height},${endX} ${-height},${endX} 28`}
              fill="none"
              stroke={value >= 0 ? '#1b6b50' : '#c9472d'}
              strokeWidth={1.2 + allocation * 18}
              strokeDasharray="7 6"
              opacity={step >= 1 ? 0.28 + Math.min(0.72, Math.abs(value)) : 0.12}
            />
          )
        })}
      </g>

      <g transform="translate(78 202)" opacity={step >= 2 ? 1 : 0.28}>
        <text x="0" y="0" className="stage-label">next-checkpoint temporal regret row</text>
        {Array.from({ length: 7 }, (_, column) => {
          const isCurrent = column === 5
          const isFuture = column === 6
          const raw = isCurrent ? currentCost : isFuture ? forwardCost : Math.max(0, 0.58 - backwardGain * (0.6 + column * 0.07))
          return (
            <g key={column} transform={`translate(${column * 78} 24)`}>
              <rect width="62" height="62" rx="9" fill={raw < 0.2 ? 'rgba(27,107,80,.26)' : raw < 0.45 ? 'rgba(157,100,5,.22)' : 'rgba(201,71,45,.2)'} stroke="#cbd0c8" />
              <text x="31" y="36" textAnchor="middle">{raw.toFixed(2)}</text>
              <text x="31" y="82" textAnchor="middle">{isCurrent ? 'current' : isFuture ? 'forward' : `past ${column + 1}`}</text>
            </g>
          )
        })}
      </g>

      <g transform="translate(78 354)" opacity={step >= 3 ? 1 : 0.28}>
        <rect width="562" height="116" rx="20" fill="#ffffff" stroke="#d9ddd4" />
        <text x="22" y="31" className="stage-label">counterfactual allocation</text>
        {allocations.map((value, index) => (
          <g key={index} transform={`translate(${22 + index * 80} 50)`}>
            <rect width="58" height="35" rx="8" fill="#eef0eb" />
            <rect y={35 - value * 130} width="58" height={value * 130} rx="8" fill={index === bestIndex ? '#1b6b50' : '#285ec4'} opacity={0.52 + value} />
            <text x="29" y="57" textAnchor="middle">B{index + 1}</text>
          </g>
        ))}
        <g transform="translate(510 50)">
          <rect width="30" height="35" rx="8" fill={totalPositive === 0 ? '#c9472d' : '#d9ddd4'} />
          <text x="15" y="57" textAnchor="middle">none</text>
        </g>
      </g>

      {step === 4 ? (
        <g transform="translate(438 118)">
          <rect width="202" height="70" rx="16" fill={totalPositive === 0 ? 'rgba(201,71,45,.07)' : 'rgba(27,107,80,.07)'} stroke={totalPositive === 0 ? '#c9472d' : '#1b6b50'} />
          <text x="18" y="27" className="stage-label">policy verdict</text>
          <text x="18" y="51">{totalPositive === 0 ? 'spend zero tokens on history' : `replay from B${bestIndex + 1} first`}</text>
        </g>
      ) : null}
    </svg>
  )
}

const TICLM_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'Replay replaces current tokens; it is not free.',
    body:
      'Continual pretraining has a fixed token budget. Every historical token used now displaces a token from the current window, so replay must beat the current learning opportunity it consumes.',
    takeaway: 'The decision is counterfactual token allocation, not a generic replay ratio.',
  },
  {
    label: 'Staleness',
    title: 'Old windows can help, decay, or become harmful.',
    body:
      'Stable domains may preserve useful signal over long lags. Fast-evolving domains can make old windows stale, causing backward gains to be outweighed by current or forward interference.',
    takeaway: 'Age alone cannot determine replay value.',
  },
  {
    label: 'Evaluation object',
    title: 'Judge the whole temporal regret row.',
    body:
      'The next checkpoint is evaluated on earlier, current, and near-future data. Replay value is matrix-valued until a policy explicitly trades backward retention against current adaptation and forward compatibility.',
    takeaway: 'Forgetting alone hides the costs that matter most during change.',
  },
  {
    label: 'Allocation',
    title: 'Replay only from windows with positive replacement value.',
    body:
      'A local approximation scores the direction gτ − gt: the gradient from an old window minus the current gradient it replaces. Conservative values drive a small allocation problem.',
    takeaway: 'History receives tokens only after earning them against the current alternative.',
  },
  {
    label: 'No-replay state',
    title: 'The correct replay ratio can be zero.',
    body:
      'When every historical window has nonpositive conservative value, the allocation should collapse to current-only training rather than preserve an arbitrary minimum amount of replay.',
    takeaway: 'A useful controller must know when memory should disappear from the update.',
  },
]

export function TiclmChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [shift, setShift] = useState(0.44)
  const [replay, setReplay] = useState(0.28)
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])

  return (
    <ChapterScaffold
      eyebrow="Time-continual pretraining"
      status="Ongoing research"
      title="Replay Should Earn the Tokens It Replaces"
      question="When does a historical window improve the next temporal evaluation profile more than current data?"
      thesis="The scientific object is not a fixed replay ratio. It is the counterfactual change in the next regret row when current tokens are replaced by a particular historical window."
      steps={TICLM_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<TiclmVisual step={activeStep} shift={shift} replay={replay} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl label="Rate of temporal change" value={shift} display={`${Math.round(shift * 100)}%`} min={0} max={1} step={0.01} onChange={setShift} />
          <RangeControl label="Maximum replay budget" value={replay} display={`${Math.round(replay * 100)}% tokens`} min={0} max={0.6} step={0.01} onChange={setReplay} />
          <div className="chapter-preset-row">
            <button type="button" onClick={() => { setShift(0.12); setReplay(0.32) }}>Stable domain</button>
            <button type="button" onClick={() => { setShift(0.55); setReplay(0.25) }}>Mixed regime</button>
            <button type="button" onClick={() => { setShift(0.92); setReplay(0.18) }}>Fast evolution</button>
          </div>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`Replay mixture direction:\nGₜ(α) = gₜ + Στ αₜ,τ (gτ − gₜ)\n\nLocal effect on a regret-row metric M:\nΔMτ ≈ −η ∇M(θₜ)ᵀ (gτ − gₜ)\n\nAllocate only while conservative row-level value > 0.`}</code>
          <dl>
            <dt>Training candidates</dt><dd>historical time windows</dd>
            <dt>Evaluation object</dt><dd>backward / current / forward row</dd>
            <dt>Null action</dt><dd>current-only training</dd>
          </dl>
        </div>
      }
      contribution={[
        'Defined historical replay as a replacement decision against current-window tokens under a fixed budget.',
        'Kept backward, current, and forward temporal effects visible in a matrix-valued replay object.',
        'Derived a local replay value around the cost-adjusted direction gτ − gt and a conservative allocation rule.',
        'Made stable and fast-evolving domains observable through replay-value curves rather than assumed labels.',
      ]}
      evidence={[
        {
          label: 'Research object',
          title: 'TiC-LM temporal evaluation matrix',
          detail: 'Training and evaluation time remain separate axes, so each replay choice can be judged across earlier, current, and future regions.',
          href: 'https://github.com/apple/ml-tic-lm',
        },
        {
          label: 'Falsifiable prediction',
          title: 'Replay lifetime and half-life',
          detail: 'The framework predicts when a window’s conservative value should cross zero and when its usefulness decays by half.',
        },
        {
          label: 'Current status',
          title: 'Method and protocol being reset adversarially',
          detail: 'The work is being tested against algebraic collapses, baseline reductions, causal usefulness, and prospective necessity before experimental commitment.',
        },
      ]}
      boundary="This is ongoing research, not a finished empirical result. The local value is an approximation to an unavailable counterfactual training experiment; its usefulness must be established prospectively through regret-row prediction and intervention tests."
      next={{ label: 'Next explanation', title: 'Urban Micro-Region Logistics', route: '/research/urban-logistics' }}
    />
  )
}

function UrbanVisual({ step, lanes, volatility }: { step: number; lanes: number; volatility: number }) {
  const cells = Array.from({ length: 24 }, (_, index) => {
    const column = index % 6
    const row = Math.floor(index / 6)
    const x = 94 + column * 78 + (row % 2) * 39
    const y = 90 + row * 68
    const context = ((index * 17) % 23) / 22
    const bikeScore = clamp(0.18 + lanes * 0.78 + context * 0.3 - volatility * (0.24 + context * 0.2))
    return { x, y, bikeScore, index }
  })
  const bikeShare = cells.filter((cell) => cell.bikeScore > 0.58).length / cells.length
  const serviceReliability = clamp(0.91 + lanes * 0.08 - volatility * 0.07 + bikeShare * 0.03)

  return (
    <svg className="chapter-svg urban-stage" viewBox="0 0 720 520" role="img" aria-label="Urban micro-region fleet planning stage">
      <g opacity={step >= 1 ? 1 : 0.5}>
        {cells.map((cell) => {
          const points = `${cell.x},${cell.y - 26} ${cell.x + 23},${cell.y - 13} ${cell.x + 23},${cell.y + 13} ${cell.x},${cell.y + 26} ${cell.x - 23},${cell.y + 13} ${cell.x - 23},${cell.y - 13}`
          const selected = cell.bikeScore > 0.58 && step >= 3
          return (
            <g key={cell.index}>
              <polygon points={points} fill={selected ? 'rgba(27,107,80,.24)' : cell.bikeScore < 0.36 ? 'rgba(201,71,45,.12)' : '#eef0eb'} stroke={selected ? '#1b6b50' : '#c7ccc3'} strokeWidth={selected ? 2 : 1} />
              {step >= 2 ? <text x={cell.x} y={cell.y + 4} textAnchor="middle">{cell.bikeScore.toFixed(2)}</text> : null}
            </g>
          )
        })}
      </g>

      <g transform="translate(58 36)">
        <rect width="228" height="54" rx="14" fill="#ffffff" stroke="#d9ddd4" />
        <text x="16" y="24" className="stage-label">city context → service-time prediction</text>
        <text x="16" y="42">H3 cells + OpenStreetMap features</text>
      </g>

      <path d="M106 392C182 340 242 408 325 332C405 259 493 322 610 214" fill="none" stroke="#1b6b50" strokeWidth="4" strokeDasharray="9 7" opacity={step >= 3 ? 1 : 0.18} />
      <circle cx="106" cy="392" r="9" fill="#1b6b50" opacity={step >= 3 ? 1 : 0.18} />
      <path d="M108 415C211 440 294 401 388 428C489 457 558 394 636 420" fill="none" stroke="#c9472d" strokeWidth="3" opacity={step >= 3 ? 0.78 : 0.18} />

      <g transform="translate(442 52)" opacity={step >= 4 ? 1 : 0.25}>
        <rect width="218" height="128" rx="18" fill="#ffffff" stroke="#d9ddd4" />
        <text x="18" y="29" className="stage-label">transition plan</text>
        <text x="18" y="58">cargo-bike share</text>
        <text x="188" y="58" textAnchor="end">{Math.round(bikeShare * 100)}%</text>
        <text x="18" y="83">service reliability</text>
        <text x="188" y="83" textAnchor="end">{(serviceReliability * 100).toFixed(1)}%</text>
        <text x="18" y="108">first wave</text>
        <text x="188" y="108" textAnchor="end">highest-score cells</text>
      </g>
    </svg>
  )
}

const URBAN_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'A city-wide sustainability claim is too coarse to operate.',
    body:
      'Cargo bikes can replace some vans, but service conditions differ block by block. A useful transition plan must know where parking, walking, density, and street structure change the relative advantage.',
    takeaway: 'The decision belongs at micro-region scale, not city average.',
  },
  {
    label: 'Spatial object',
    title: 'Partition the city into comparable cells.',
    body:
      'Uber H3 creates a consistent hexagonal spatial index. Each cell becomes a unit where OpenStreetMap context and observed service-time components can be aggregated.',
    takeaway: 'A messy city becomes a reproducible spatial dataset.',
  },
  {
    label: 'Prediction',
    title: 'Estimate vehicle performance from neighborhood context.',
    body:
      'Features describing the built environment help predict cruising, unloading, and walking time. The same vehicle can therefore have very different service profiles across nearby cells.',
    takeaway: 'Urban context is operational signal, not visual backdrop.',
  },
  {
    label: 'Decision',
    title: 'Compare candidate fleet choices cell by cell.',
    body:
      'Cells with strong bike-lane access and favorable service-time structure become transition candidates, while volatile or poorly connected cells remain van-dominant.',
    takeaway: 'Model output becomes a staged fleet decision.',
  },
  {
    label: 'Contribution',
    title: 'Sustainability becomes testable before rollout.',
    body:
      'The pipeline turns an abstract replacement ambition into evidence that operators can inspect, update, and use to prioritize an initial deployment wave.',
    takeaway: 'Machine learning supports a concrete operational transition rather than a generic prediction.',
  },
]

export function UrbanChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [lanes, setLanes] = useState(0.57)
  const [volatility, setVolatility] = useState(0.38)
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])

  return (
    <ChapterScaffold
      eyebrow="Urban AI and sustainable logistics"
      status="Published · 2023"
      title="Urban Micro-Region Logistics"
      question="Where can cargo bikes replace vans without sacrificing the service system around them?"
      thesis="The transition becomes actionable when urban context is represented at micro-region scale and tied to the actual components of delivery service time."
      steps={URBAN_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<UrbanVisual step={activeStep} lanes={lanes} volatility={volatility} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl label="Bike-lane coverage" value={lanes} display={`${Math.round(lanes * 100)}%`} min={0} max={1} step={0.01} onChange={setLanes} />
          <RangeControl label="Demand volatility" value={volatility} display={`${Math.round(volatility * 100)}%`} min={0} max={1} step={0.01} onChange={setVolatility} />
          <div className="chapter-preset-row">
            <button type="button" onClick={() => { setLanes(0.82); setVolatility(0.18) }}>Bike-ready core</button>
            <button type="button" onClick={() => { setLanes(0.48); setVolatility(0.42) }}>Mixed city</button>
            <button type="button" onClick={() => { setLanes(0.18); setVolatility(0.74) }}>Van-dominant edge</button>
          </div>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`Spatial unit: Uber H3 hexagonal cell\nContext: aggregated OpenStreetMap tags\nTargets: delivery service-time components\nDecision: compare vehicle performance by micro-region`}</code>
          <dl>
            <dt>Question</dt><dd>where to transition first</dd>
            <dt>Resolution</dt><dd>urban micro-region</dd>
            <dt>Output</dt><dd>vehicle-relative service profile</dd>
          </dl>
        </div>
      }
      contribution={[
        'Introduced spatial datasets and a replicable micro-region representation for delivery operations.',
        'Demonstrated that urban context is a critical predictor of delivery service performance.',
        'Connected predictive modeling to a concrete fleet-transition and routing decision.',
      ]}
      evidence={[
        {
          label: 'Paper',
          title: 'Modelling the performance of delivery vehicles across urban micro-regions',
          detail: 'The paper introduces two datasets and initial models for cargo-bike versus light-goods-vehicle service performance.',
          href: 'https://arxiv.org/abs/2301.12887',
        },
        {
          label: 'Data abstraction',
          title: 'H3 plus OpenStreetMap',
          detail: 'A global spatial index and open geospatial features make the analysis reproducible beyond a single proprietary map.',
        },
        {
          label: 'Operational use',
          title: 'Prioritize rollout rather than predict in isolation',
          detail: 'The relevant output is a transition decision with reliability, cost, and environmental implications.',
        },
      ]}
      boundary="The study provides initial modeling evidence, not a universal claim that cargo bikes dominate vans. Real deployment still requires local demand, weather, labor, infrastructure, routing, and operational cost validation."
      links={[{ label: 'Read paper', href: 'https://arxiv.org/abs/2301.12887' }]}
      next={{ label: 'Next explanation', title: 'Hate and Counterspeech Dynamics', route: '/research/counterspeech' }}
    />
  )
}

function CounterspeechVisual({ step, counterRate, threshold }: { step: number; counterRate: number; threshold: number }) {
  const nodes = [
    { x: 110, y: 228, type: 'hate' }, { x: 208, y: 124, type: 'hate' }, { x: 214, y: 320, type: 'counter' },
    { x: 354, y: 184, type: 'counter' }, { x: 362, y: 338, type: 'neutral' }, { x: 512, y: 118, type: 'hate' },
    { x: 530, y: 268, type: 'counter' }, { x: 622, y: 372, type: 'neutral' },
  ]
  const edges = [[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[3,6],[4,6],[5,6],[6,7]]
  const escalation = clamp(0.72 - counterRate * 0.38 + threshold * 0.22)
  const intervention = escalation >= threshold

  return (
    <svg className="chapter-svg counter-stage" viewBox="0 0 720 520" role="img" aria-label="Hate and counterspeech interaction stage">
      <g opacity={step >= 1 ? 1 : 0.52}>
        {edges.map(([from, to], index) => (
          <line key={index} x1={nodes[from]?.x} y1={nodes[from]?.y} x2={nodes[to]?.x} y2={nodes[to]?.y} stroke="#c8cdc4" strokeWidth="2" strokeDasharray={index % 2 ? '6 6' : undefined} />
        ))}
        {nodes.map((node, index) => (
          <g key={index}>
            <circle cx={node.x} cy={node.y} r={node.type === 'hate' ? 18 : node.type === 'counter' ? 16 : 12} fill={node.type === 'hate' ? 'rgba(201,71,45,.2)' : node.type === 'counter' ? 'rgba(40,94,196,.17)' : '#eef0eb'} stroke={node.type === 'hate' ? '#c9472d' : node.type === 'counter' ? '#285ec4' : '#aeb4aa'} strokeWidth="2" />
            <text x={node.x} y={node.y + 4} textAnchor="middle">{node.type === 'hate' ? 'H' : node.type === 'counter' ? 'C' : '·'}</text>
          </g>
        ))}
      </g>

      <path d="M110 228C148 252 176 286 214 320" fill="none" stroke="#c9472d" strokeWidth="7" strokeLinecap="round" strokeDasharray="4 18" opacity={step >= 2 ? 0.9 : 0.15} />
      <path d="M214 320C264 284 305 226 354 184" fill="none" stroke="#285ec4" strokeWidth={3 + counterRate * 7} strokeLinecap="round" strokeDasharray="5 17" opacity={step >= 2 ? 0.95 : 0.15} />

      <g transform="translate(455 190)" opacity={step >= 3 ? 1 : 0.25}>
        <rect width="214" height="132" rx="18" fill="#ffffff" stroke="#d9ddd4" />
        <text x="18" y="30" className="stage-label">observed asymmetries</text>
        <text x="18" y="56">activity · popularity · sentiment</text>
        <text x="18" y="78">strategy differs by community</text>
        <text x="18" y="103">pairs reveal interaction, not isolated posts</text>
      </g>

      <g transform="translate(70 402)" opacity={step >= 4 ? 1 : 0.24}>
        <rect width="600" height="76" rx="18" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="29" className="stage-label">intervention layer</text>
        <rect x="20" y="45" width="430" height="10" rx="5" fill="#e1e4dd" />
        <rect x="20" y="45" width={430 * escalation} height="10" rx="5" fill={intervention ? '#c9472d' : '#1b6b50'} />
        <line x1={20 + 430 * threshold} y1="37" x2={20 + 430 * threshold} y2="63" stroke="#111310" strokeWidth="2" />
        <text x="474" y="54">{intervention ? 'review signal' : 'observe'}</text>
      </g>
    </svg>
  )
}

const COUNTER_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'A harmful post is part of an interaction system.',
    body:
      'Platform moderation often treats messages or accounts in isolation. Counterspeech introduces another behavioral actor: people who respond to hate without simply removing the conversation.',
    takeaway: 'The scientific object is the interaction between user types, not a single text label.',
  },
  {
    label: 'Dataset',
    title: 'Pair hate and counter users explicitly.',
    body:
      'The work constructs and releases an annotated paired-user dataset, making it possible to compare behavior, language, popularity, and response strategy across connected accounts.',
    takeaway: 'A new dataset turns an informal social phenomenon into measurable structure.',
  },
  {
    label: 'Dynamics',
    title: 'Protective speech changes the network response.',
    body:
      'Counterspeakers use different strategies across community contexts, while hate users show distinct activity, sentiment, and audience patterns. The animation keeps these roles and flows visible.',
    takeaway: 'Counterspeech is heterogeneous behavior, not one universal template.',
  },
  {
    label: 'Evidence',
    title: 'Behavioral asymmetries matter for intervention design.',
    body:
      'Lexical, linguistic, psycholinguistic, and account-level analyses reveal why blunt account removal can miss important variation in how harm and response unfold.',
    takeaway: 'Intervention should be informed by interaction context and strategy.',
  },
  {
    label: 'Contribution',
    title: 'Moderation gains a richer unit of analysis.',
    body:
      'The paper contributes both the paired-user resource and empirical evidence that hate and counterspeech communities behave differently in ways relevant to platform policy.',
    takeaway: 'The work expands what can be measured before deciding how to intervene.',
  },
]

export function CounterspeechChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [counterRate, setCounterRate] = useState(0.58)
  const [threshold, setThreshold] = useState(0.66)
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])

  return (
    <ChapterScaffold
      eyebrow="Social computing"
      status="Published · ACM CoDS-COMAD 2020"
      title="Hate and Counterspeech Dynamics"
      question="What becomes visible when harmful speech and the people countering it are studied as an interaction?"
      thesis="A paired-user dataset reveals behavioral and linguistic asymmetries that isolated message classification cannot expose, creating a richer basis for moderation and intervention research."
      steps={COUNTER_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<CounterspeechVisual step={activeStep} counterRate={counterRate} threshold={threshold} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl label="Counterspeech response strength" value={counterRate} display={`${Math.round(counterRate * 100)}%`} min={0} max={1} step={0.01} onChange={setCounterRate} />
          <RangeControl label="Review threshold" value={threshold} display={threshold.toFixed(2)} min={0.3} max={0.95} step={0.01} onChange={setThreshold} />
          <p>This control is an explanatory decision layer, not a reproduced platform policy or causal intervention estimate.</p>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`Unit of analysis: annotated hate–counter user pairs\nEvidence: lexical + linguistic + psycholinguistic + account behavior\nQuestion: how do strategies and interaction patterns differ by community context?`}</code>
          <dl>
            <dt>Primary artifact</dt><dd>released paired-user dataset</dd>
            <dt>Study type</dt><dd>observational behavioral analysis</dd>
            <dt>Policy relevance</dt><dd>context-sensitive intervention</dd>
          </dl>
        </div>
      }
      contribution={[
        'Constructed and released an annotated dataset pairing hate and counterspeech users.',
        'Measured behavioral, lexical, linguistic, and psycholinguistic differences across the paired communities.',
        'Showed that counterspeech strategies vary with target-community context and that hate users exhibit important account-level asymmetries.',
      ]}
      evidence={[
        {
          label: 'Paper',
          title: 'Interaction dynamics between hate and counter users on Twitter',
          detail: 'Published in the Proceedings of the 7th ACM IKDD CoDS and 25th COMAD.',
          href: 'https://dl.acm.org/doi/abs/10.1145/3371158.3371172',
        },
        {
          label: 'Research artifact',
          title: 'Paired-user dataset',
          detail: 'The dataset makes hate–counter interaction a directly inspectable empirical object.',
          href: 'https://github.com/KumarNavish/Twitter-Hate-and-counter-speakers',
        },
        {
          label: 'Impact',
          title: 'Most-cited work in the current Scholar record',
          detail: 'The portfolio links the citation record to the concrete data and analytical contribution rather than treating it as a vanity metric.',
        },
      ]}
      boundary="The study is observational and does not establish that a particular counterspeech strategy causally reduces harm. The interactive threshold shown here is a conceptual interface for reasoning about evidence, not a validated moderation model."
      links={[
        { label: 'Read ACM paper', href: 'https://dl.acm.org/doi/abs/10.1145/3371158.3371172' },
        { label: 'Open repository', href: 'https://github.com/KumarNavish/Twitter-Hate-and-counter-speakers' },
      ]}
      next={{ label: 'Next explanation', title: 'CasePath', route: '/systems/casepath' }}
    />
  )
}

function CasePathVisual({ step, completeness, strictness }: { step: number; completeness: number; strictness: number }) {
  const extracted = Math.round(completeness * 7)
  const required = Math.round(3 + strictness * 4)
  const passed = extracted >= required
  const nodes = [
    { x: 486, y: 104, label: 'identify issue' },
    { x: 420, y: 206, label: 'verify facts' },
    { x: 552, y: 206, label: 'resolve missing' },
    { x: 420, y: 318, label: 'select path' },
    { x: 552, y: 318, label: 'human review' },
    { x: 486, y: 424, label: 'action artifact' },
  ]

  return (
    <svg className="chapter-svg casepath-stage" viewBox="0 0 720 520" role="img" aria-label="Evidence to process pipeline stage">
      <g transform="translate(42 68)">
        <rect width="170" height="284" rx="22" fill="#ffffff" stroke="#d9ddd4" />
        <text x="22" y="34" className="stage-label">source evidence</text>
        {[0,1,2].map((documentIndex) => (
          <g key={documentIndex} transform={`translate(${22 + documentIndex * 11} ${58 + documentIndex * 64})`}>
            <rect width="126" height="74" rx="10" fill="#f4f5f1" stroke="#cbd0c8" />
            <line x1="14" y1="19" x2="104" y2="19" stroke="#aeb4aa" />
            <line x1="14" y1="34" x2="92" y2="34" stroke="#aeb4aa" />
            <line x1="14" y1="49" x2="110" y2="49" stroke="#aeb4aa" />
          </g>
        ))}
      </g>

      <path d="M221 210H266" stroke="#111310" strokeWidth="2.5" strokeDasharray="7 6" opacity={step >= 1 ? 1 : 0.2} />

      <g transform="translate(270 92)" opacity={step >= 1 ? 1 : 0.24}>
        <rect width="150" height="234" rx="22" fill="#ffffff" stroke="#d9ddd4" />
        <text x="20" y="34" className="stage-label">bounded extraction</text>
        {Array.from({ length: 7 }, (_, index) => (
          <g key={index} transform={`translate(20 ${60 + index * 23})`}>
            <circle cx="5" cy="5" r="5" fill={index < extracted ? '#285ec4' : '#d8dcd5'} />
            <line x1="18" y1="5" x2={94 + (index % 3) * 10} y2="5" stroke={index < extracted ? '#777e75' : '#d3d7d0'} strokeWidth="2" />
          </g>
        ))}
        <text x="20" y="215">{extracted} cited facts</text>
      </g>

      <g transform="translate(270 352)" opacity={step >= 2 ? 1 : 0.24}>
        <rect width="150" height="88" rx="18" fill={passed ? 'rgba(27,107,80,.08)' : 'rgba(201,71,45,.07)'} stroke={passed ? '#1b6b50' : '#c9472d'} />
        <text x="18" y="29" className="stage-label">deterministic gate</text>
        <text x="18" y="55">need {required} · have {extracted}</text>
        <text x="18" y="75" fill={passed ? '#1b6b50' : '#c9472d'}>{passed ? 'permit transition' : 'stop and request evidence'}</text>
      </g>

      <g opacity={step >= 3 && passed ? 1 : 0.18}>
        {[[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]].map(([from, to], index) => (
          <line key={index} x1={nodes[from]?.x} y1={nodes[from]?.y} x2={nodes[to]?.x} y2={nodes[to]?.y} stroke="#9fa69c" strokeWidth="2" />
        ))}
        {nodes.map((node, index) => (
          <g key={node.label}>
            <rect x={node.x - 54} y={node.y - 20} width="108" height="40" rx="12" fill={index === 5 ? '#111310' : '#ffffff'} stroke={index === 5 ? '#111310' : '#bfc5bb'} />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fill={index === 5 ? '#ffffff' : undefined}>{node.label}</text>
          </g>
        ))}
      </g>

      {step >= 4 ? (
        <g transform="translate(482 454)">
          <text x="0" y="0" className="stage-caption">process + checklist + evidence trace + review state</text>
        </g>
      ) : null}
    </svg>
  )
}

const CASEPATH_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'A model-generated answer is not a safe process.',
    body:
      'Operational work begins with incomplete, conflicting, and evolving evidence. Jumping directly from documents to a recommendation hides uncertainty, authority, and the conditions under which the path should stop.',
    takeaway: 'The system needs an inspectable state between evidence and action.',
  },
  {
    label: 'Extraction',
    title: 'Turn text into bounded, cited facts.',
    body:
      'The first layer extracts only the fields needed by the process, preserves provenance, and leaves unsupported values unresolved instead of filling them through fluent inference.',
    takeaway: 'Evidence remains attached to every claim that can change the path.',
  },
  {
    label: 'Gates',
    title: 'Critical transitions are deterministic.',
    body:
      'Rules check whether the required evidence, authority, and consistency conditions are satisfied. Missing or conflicting facts stop the transition and create an explicit review task.',
    takeaway: 'The model may propose; the gate decides whether the process may advance.',
  },
  {
    label: 'Process',
    title: 'Validated facts instantiate a reviewable graph.',
    body:
      'The system constructs the relevant procedural path, document checklist, and unresolved branches from validated state rather than from a single freeform completion.',
    takeaway: 'Procedure becomes an executable object with visible alternatives.',
  },
  {
    label: 'Artifact',
    title: 'Every output keeps its evidence and failure surface.',
    body:
      'The resulting action artifact includes provenance, gate decisions, missing evidence, and review state so corrections can propagate without silently corrupting later steps.',
    takeaway: 'Usefulness comes from controlled revision, not confident finality.',
  },
]

export function CasePathChapter() {
  const [activeStep, setActiveStep] = useState(0)
  const [completeness, setCompleteness] = useState(0.72)
  const [strictness, setStrictness] = useState(0.64)
  const onStepChange = useCallback((value: number) => setActiveStep(value), [])

  return (
    <ChapterScaffold
      eyebrow="Evidence-grounded agent systems"
      status="System under active development"
      title="CasePath"
      question="How can fallible semantic hypotheses become safe, correction-stable procedural action?"
      thesis="Instead of letting an agent leap from documents to decisions, CasePath separates bounded extraction, deterministic permission gates, explicit process state, and provenance-carrying artifacts."
      steps={CASEPATH_STEPS}
      activeStep={activeStep}
      onStepChange={onStepChange}
      stage={<CasePathVisual step={activeStep} completeness={completeness} strictness={strictness} />}
      controls={
        <div className="chapter-control-stack">
          <RangeControl label="Evidence completeness" value={completeness} display={`${Math.round(completeness * 100)}%`} min={0} max={1} step={0.01} onChange={setCompleteness} />
          <RangeControl label="Gate strictness" value={strictness} display={`${Math.round(strictness * 100)}%`} min={0} max={1} step={0.01} onChange={setStrictness} />
          <div className="chapter-preset-row">
            <button type="button" onClick={() => { setCompleteness(0.92); setStrictness(0.64) }}>Complete case</button>
            <button type="button" onClick={() => { setCompleteness(0.43); setStrictness(0.72) }}>Missing evidence</button>
            <button type="button" onClick={() => { setCompleteness(0.78); setStrictness(0.94) }}>High authority bar</button>
          </div>
        </div>
      }
      inspect={
        <div className="chapter-formal-object">
          <code>{`source documents\n  → cited field hypotheses\n  → deterministic validation gates\n  → explicit process state\n  → checklist / action artifact / review queue\n\nInvariant: unsupported evidence never becomes an invisible fact.`}</code>
          <dl>
            <dt>Model role</dt><dd>bounded semantic proposal</dd>
            <dt>Gate role</dt><dd>permission to transition</dd>
            <dt>Output</dt><dd>reviewable, provenance-carrying artifact</dd>
          </dl>
        </div>
      }
      contribution={[
        'Separated semantic hypothesis generation from authoritative process transitions.',
        'Designed provenance-carrying state so corrections can propagate through downstream artifacts.',
        'Made missing evidence, conflicting evidence, and review requirements first-class system outputs.',
        'Turned procedural expertise into an executable process graph rather than a static answer template.',
      ]}
      evidence={[
        {
          label: 'Live system',
          title: 'CasePath public interface',
          detail: 'The portfolio repository contains the evolving public CasePath system, verification workflows, and release infrastructure.',
          href: 'https://kumarnavish.github.io/casepath/',
        },
        {
          label: 'Architecture',
          title: 'Evidence → state → gates → artifacts',
          detail: 'The system is organized around reviewable transitions and correction stability rather than unrestricted autonomous completion.',
        },
        {
          label: 'Research frontier',
          title: 'Nonseparable evidence-policy learning',
          detail: 'Current method work is stress-testing whether genuinely new principles are needed beyond active acquisition, planning, and correction-commuting baselines.',
        },
      ]}
      boundary="CasePath is not autonomous legal or insurance authority. It requires a defined domain contract, maintained rules, representative evidence, and human review for consequential decisions. The public chapter describes the architecture and direction, not a claim of production certification."
      links={[{ label: 'Open live system', href: 'https://kumarnavish.github.io/casepath/' }]}
      next={{ label: 'Next experiment', title: 'Generative AI × Spatial Computing', route: '/research/spatial-intelligence' }}
    />
  )
}
