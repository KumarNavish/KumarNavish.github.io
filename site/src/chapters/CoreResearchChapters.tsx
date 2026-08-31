import { useMemo, useState } from 'react'

import { ChapterScaffold, type ChapterEvidence, type ChapterStep } from './ChapterScaffold'

type Vec = { x: number; y: number }

function norm(vector: Vec): number {
  return Math.hypot(vector.x, vector.y)
}

function add(left: Vec, right: Vec): Vec {
  return { x: left.x + right.x, y: left.y + right.y }
}

function scale(vector: Vec, factor: number): Vec {
  return { x: vector.x * factor, y: vector.y * factor }
}

function subtract(left: Vec, right: Vec): Vec {
  return { x: left.x - right.x, y: left.y - right.y }
}

function polar(angle: number, magnitude: number): Vec {
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude }
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
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

function InspectGrid({
  items,
  formal,
}: {
  items: Array<[string, string, string]>
  formal: string
}) {
  return (
    <>
      <div className="chapter-inspect-grid">
        {items.map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </div>
      <div className="chapter-formal">{formal}</div>
    </>
  )
}

const NATURAL_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'The same numerical step can mean very different movement.',
    body: 'A Gaussian approximation has a mean and covariance. Euclidean updates treat their raw coordinates as though every direction has the same meaning, even when the distribution is highly stretched.',
    cue: 'Watch the circular step ignore the elongated geometry.',
  },
  {
    label: 'Why it matters',
    title: 'Bad geometry turns a sensible objective into unstable motion.',
    body: 'As covariance becomes anisotropic, the raw parameter surface becomes badly conditioned. An optimizer can oscillate, overreact, or require tiny learning rates.',
    cue: 'Increase anisotropy and compare the two paths.',
  },
  {
    label: 'Key idea',
    title: 'Measure movement in the geometry of distributions.',
    body: 'The natural gradient rescales a raw gradient by the local information geometry. A step then reflects how much the probability distribution changes, not only how much a coordinate changes.',
    cue: 'The blue path bends with the contours rather than cutting across them.',
  },
  {
    label: 'Mechanism',
    title: 'A square-root covariance makes the difficult part tractable.',
    body: 'Representing covariance through its matrix square root reveals a geometry in which the continuous flow and discrete updates can be analysed together.',
    cue: 'The factor deforms smoothly while covariance remains positive.',
  },
  {
    label: 'What changes',
    title: 'Practical behaviour acquires a formal convergence story.',
    body: 'The parameterization preserves the empirical advantage of natural-gradient updates while enabling convergence guarantees under the paper’s assumptions.',
    cue: 'The guaranteed region appears only for the analysed setting.',
  },
  {
    label: 'Contribution',
    title: 'The theory–practice gap becomes smaller, not invisible.',
    body: 'The result explains an important regime where a method known to work well in practice can also be understood rigorously.',
    cue: 'Inspect the exact claim boundary before treating this as universal.',
  },
]

const NATURAL_EVIDENCE: ChapterEvidence[] = [
  {
    label: 'Paper',
    title: 'Optimization Guarantees for Square-Root Natural-Gradient Variational Inference',
    note: 'The formal derivations, assumptions, experiments, and complete statement of the result.',
    href: 'https://arxiv.org/abs/2507.07853',
  },
  {
    label: 'Formal object',
    title: 'Gaussian covariance through a square-root factor',
    note: 'The instrument visualizes a two-dimensional projection of the matrix geometry; the paper contains the general result.',
  },
  {
    label: 'Claim boundary',
    title: 'A guarantee for the analysed variational-Gaussian setting',
    note: 'Not a claim that every natural-gradient system converges under arbitrary non-convex objectives.',
  },
]

function NaturalStage({
  step,
  anisotropy,
  rate,
}: {
  step: number
  anisotropy: number
  rate: number
}) {
  const naturalPath = Array.from({ length: 7 }, (_, index) => {
    const t = index / 6
    return { x: 76 + 358 * t, y: 330 - 218 * (1 - Math.pow(1 - t, 1.45)) }
  })
  const euclideanPath = Array.from({ length: 7 }, (_, index) => {
    const t = index / 6
    const wobble = Math.sin(t * Math.PI * 3) * anisotropy * 10 * (1 - t)
    return { x: 76 + 358 * t, y: 330 - 218 * t + wobble }
  })
  return (
    <svg
      viewBox="0 0 540 430"
      role="img"
      aria-label="Natural and Euclidean optimization paths across anisotropic Gaussian geometry"
    >
      <defs>
        <marker id="natural-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
        </marker>
      </defs>
      <rect width="540" height="430" fill="#f5f6f2" />
      {Array.from({ length: 6 }, (_, index) => {
        const size = 210 - index * 27
        return (
          <ellipse
            key={index}
            cx="410"
            cy="120"
            rx={size}
            ry={Math.max(18, size / (1.8 + anisotropy * 1.45))}
            transform={`rotate(-31 410 120)`}
            fill="none"
            stroke="rgba(40,94,196,.18)"
            strokeWidth="1.3"
            opacity={step >= 1 ? 1 : 0.44}
          />
        )
      })}
      <text x="34" y="38" fill="#666c64" fontSize="10">
        objective geometry · projected view
      </text>
      <circle cx="434" cy="104" r="7" fill="#111310" />
      <text x="448" y="102" fill="#111310" fontSize="10">
        optimum
      </text>
      <polyline
        points={euclideanPath.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="#c9472d"
        strokeWidth="2.1"
        strokeDasharray={step >= 2 ? '6 5' : undefined}
        opacity={step >= 1 ? 1 : 0.45}
      />
      <polyline
        points={naturalPath.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="#285ec4"
        strokeWidth={2.3 + rate * 1.2}
        opacity={step >= 2 ? 1 : 0.22}
      />
      {euclideanPath.map((point, index) => (
        <circle
          key={`e-${index}`}
          cx={point.x}
          cy={point.y}
          r="3.3"
          fill="#fff"
          stroke="#c9472d"
          opacity={step >= 1 ? 1 : 0.35}
        />
      ))}
      {naturalPath.map((point, index) => (
        <circle
          key={`n-${index}`}
          cx={point.x}
          cy={point.y}
          r={step === 3 && index === 4 ? 7 : 3.5}
          fill="#fff"
          stroke="#285ec4"
          opacity={step >= 2 ? 1 : 0.22}
        />
      ))}
      <g transform="translate(38 72)" opacity={step >= 3 ? 1 : 0.18}>
        <text x="0" y="0" fill="#666c64" fontSize="9">
          square-root covariance
        </text>
        <rect x="0" y="18" width="112" height="76" rx="5" fill="#fff" stroke="#d9ddd4" />
        <text x="18" y="49" fill="#111310" fontSize="17">
          S =
        </text>
        <text x="60" y="43" fill="#285ec4" fontSize="12">
          a b
        </text>
        <text x="60" y="65" fill="#285ec4" fontSize="12">
          c d
        </text>
        <path d="M53 31 h-6 v46 h6 M91 31 h6 v46 h-6" fill="none" stroke="#8f978b" />
        <text x="4" y="116" fill="#666c64" fontSize="9">
          Σ = SSᵀ ≻ 0
        </text>
      </g>
      <g transform="translate(310 340)" opacity={step >= 4 ? 1 : 0.18}>
        <rect width="194" height="48" rx="24" fill={step >= 4 ? '#111310' : '#e4e7e0'} />
        <text x="97" y="29" fill={step >= 4 ? '#fff' : '#777d74'} fontSize="10" textAnchor="middle">
          analysed convergence regime
        </text>
      </g>
      <g transform="translate(38 374)">
        <line x1="0" x2="28" y1="0" y2="0" stroke="#285ec4" strokeWidth="3" />
        <text x="38" y="4" fill="#111310" fontSize="9">
          natural geometry
        </text>
        <line x1="146" x2="174" y1="0" y2="0" stroke="#c9472d" strokeWidth="2" />
        <text x="184" y="4" fill="#111310" fontSize="9">
          raw Euclidean coordinates
        </text>
      </g>
    </svg>
  )
}

export function NaturalGradientChapter() {
  const [step, setStep] = useState(0)
  const [anisotropy, setAnisotropy] = useState(1.8)
  const [rate, setRate] = useState(0.55)
  const condition = (1 + anisotropy * 4.2).toFixed(1)
  return (
    <ChapterScaffold
      eyebrow="Variational inference · optimization geometry"
      title="Move through distributions, not coordinates."
      thesis="Natural-gradient variational inference is fast in practice. A square-root covariance parameterization helps explain when that behaviour can also be guaranteed."
      status="2025 · research manuscript"
      steps={NATURAL_STEPS}
      activeStep={step}
      onStepChange={setStep}
      stage={<NaturalStage step={step} anisotropy={anisotropy} rate={rate} />}
      insight={
        [
          'At first, both update rules seem like arrows. The missing object is the geometry beneath them.',
          'As the contours stretch, identical coordinate steps cease to represent identical distribution changes.',
          'The natural path is rescaled by local geometry and therefore follows the shape of the problem.',
          'The square-root factor changes smoothly while preserving a positive covariance matrix.',
          'The guarantee appears only after the parameterization and assumptions align.',
          'The contribution is a rigorous bridge for a specific, useful regime—not a universal convergence claim.',
        ][step]
      }
      controls={
        <div className="chapter-control-grid">
          <RangeControl
            label="Covariance anisotropy"
            value={anisotropy}
            min={0.2}
            max={3.2}
            step={0.05}
            display={`${anisotropy.toFixed(2)}×`}
            onChange={setAnisotropy}
          />
          <RangeControl
            label="Natural step scale"
            value={rate}
            min={0.15}
            max={1}
            step={0.05}
            display={rate.toFixed(2)}
            onChange={setRate}
          />
        </div>
      }
      inspect={
        <InspectGrid
          items={[
            [
              'projected condition',
              condition,
              'A visual conditioning proxy, not a theorem constant.',
            ],
            ['covariance', 'Σ = SSᵀ', 'Positive by construction in the instrument.'],
            [
              'geometry',
              'Fisher / natural',
              'The formal paper states the exact metric and assumptions.',
            ],
          ]}
          formal="Natural step:  θₖ₊₁ = θₖ − η F(θₖ)⁻¹ ∇ℒ(θₖ).  Square-root covariance: Σ = SSᵀ."
        />
      }
      contribution={[
        'A parameterization that makes natural-gradient behaviour formally tractable without discarding its practical geometry.',
        'Derive convergence guarantees for discrete natural-gradient updates in the analysed variational-Gaussian regime.',
        'Connect the discrete method with its continuous-time flow.',
        'Compare natural, Euclidean, and Wasserstein geometries empirically while keeping claim boundaries explicit.',
      ]}
      evidence={NATURAL_EVIDENCE}
      boundary="The visual is a faithful low-dimensional intuition. The guarantee depends on the paper’s log-concavity, smoothness, and parameterization assumptions; it does not erase difficult non-convex regimes."
      next={{
        title: 'Experience replay',
        question: 'Which remembered samples make a constrained update resemble joint training?',
        route: '/research/experience-replay-optimization',
      }}
    />
  )
}

const REPLAY_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'Learning the present can erase the past.',
    body: 'In online continual learning, each new batch supplies a gradient. Following it alone improves the current task but can move the model against earlier tasks.',
    cue: 'The red current-task arrow points away from the old-task region.',
  },
  {
    label: 'Why replay',
    title: 'Remembered examples can correct the update—but not all subsets agree.',
    body: 'A memory buffer contains many candidate gradients. A small replay batch is a computational constraint, so random selection may point far from the correction we actually need.',
    cue: 'Compare the grey candidate arrows with the dashed joint-training target.',
  },
  {
    label: 'Key idea',
    title: 'Define the update joint training would have requested.',
    body: 'The stage objective yields a concrete target correction: the difference between the current-only gradient and the minibatch approximation to joint training over tasks seen so far.',
    cue: 'The blue dashed vector is the target, not another heuristic score.',
  },
  {
    label: 'Mechanism',
    title: 'Select the replay subset that best matches that target.',
    body: 'Greedy Ball Replay adds candidates one by one, choosing the sample that most reduces the residual between the selected replay mean and the target correction.',
    cue: 'Increase the replay budget and watch the residual shrink—or refuse to disappear.',
  },
  {
    label: 'What changes',
    title: 'Replay quality becomes observable before the final metric.',
    body: 'The residual is an online diagnostic. It measures how well the available buffer and replay budget can express the desired steering at that step.',
    cue: 'A small residual is evidence of fit, not a promise of zero forgetting.',
  },
  {
    label: 'Boundary',
    title: 'Sometimes the buffer simply cannot represent the correction.',
    body: 'When the target lies outside the candidate geometry, better subset search cannot manufacture the missing direction. Buffer bias, minibatch noise, and representation drift remain separate failure sources.',
    cue: 'Rotate interference until every candidate sits on the wrong side.',
  },
]

const REPLAY_CANDIDATES: Vec[] = [
  polar(-2.65, 0.7),
  polar(-2.2, 0.85),
  polar(-1.75, 0.76),
  polar(-1.1, 0.64),
  polar(-0.48, 0.9),
  polar(0.08, 0.78),
  polar(0.52, 0.64),
  polar(0.9, 0.86),
  polar(1.32, 0.72),
  polar(1.78, 0.82),
  polar(2.23, 0.68),
  polar(2.72, 0.88),
]

function greedySelection(
  target: Vec,
  candidates: Vec[],
  budget: number,
): { selected: number[]; mean: Vec; residual: number } {
  const selected: number[] = []
  let sum = { x: 0, y: 0 }
  for (let round = 0; round < Math.min(budget, candidates.length); round += 1) {
    let best = -1
    let bestResidual = Number.POSITIVE_INFINITY
    candidates.forEach((candidate, index) => {
      if (selected.includes(index)) return
      const proposed = add(sum, candidate)
      const mean = scale(proposed, 1 / (selected.length + 1))
      const residual = norm(subtract(target, mean))
      if (residual < bestResidual) {
        bestResidual = residual
        best = index
      }
    })
    if (best >= 0) {
      selected.push(best)
      sum = add(sum, candidates[best])
    }
  }
  const mean = selected.length ? scale(sum, 1 / selected.length) : { x: 0, y: 0 }
  return { selected, mean, residual: norm(subtract(target, mean)) }
}

function arrowEnd(vector: Vec): Vec {
  return { x: 270 + vector.x * 170, y: 245 - vector.y * 170 }
}

function ReplayStage({
  step,
  target,
  budget,
  selected,
  mean,
}: {
  step: number
  target: Vec
  budget: number
  selected: number[]
  mean: Vec
}) {
  const targetEnd = arrowEnd(target)
  const meanEnd = arrowEnd(mean)
  return (
    <svg
      viewBox="0 0 540 430"
      role="img"
      aria-label="Candidate replay gradients approximate a joint-training correction target"
    >
      <defs>
        <marker
          id="replay-arrow"
          markerWidth="9"
          markerHeight="9"
          refX="8"
          refY="4.5"
          orient="auto"
        >
          <path d="M0,0 L9,4.5 L0,9 z" fill="context-stroke" />
        </marker>
      </defs>
      <rect width="540" height="430" fill="#f5f6f2" />
      <line x1="44" y1="245" x2="500" y2="245" stroke="#d0d5cc" />
      <line x1="270" y1="48" x2="270" y2="370" stroke="#d0d5cc" />
      <text x="30" y="34" fill="#666c64" fontSize="10">
        projected gradient space
      </text>
      <g opacity={step >= 1 ? 1 : 0.2}>
        {REPLAY_CANDIDATES.map((candidate, index) => {
          const end = arrowEnd(candidate)
          const chosen = selected.includes(index)
          return (
            <g key={index}>
              <line
                x1="270"
                y1="245"
                x2={end.x}
                y2={end.y}
                stroke={chosen ? '#1b6b50' : '#9da49a'}
                strokeWidth={chosen ? 2.9 : 1.1}
                markerEnd="url(#replay-arrow)"
              />
              <circle
                cx={end.x}
                cy={end.y}
                r={chosen ? 5 : 3}
                fill={chosen ? '#1b6b50' : '#fff'}
                stroke={chosen ? '#1b6b50' : '#8f978b'}
              />
            </g>
          )
        })}
      </g>
      <g opacity={step >= 0 ? 1 : 0.2}>
        <line
          x1="270"
          y1="245"
          x2="400"
          y2="330"
          stroke="#c9472d"
          strokeWidth="3"
          markerEnd="url(#replay-arrow)"
        />
        <text x="407" y="342" fill="#c9472d" fontSize="10">
          current gradient
        </text>
      </g>
      <g opacity={step >= 2 ? 1 : 0.12}>
        <line
          x1="270"
          y1="245"
          x2={targetEnd.x}
          y2={targetEnd.y}
          stroke="#285ec4"
          strokeWidth="2.5"
          strokeDasharray="7 5"
          markerEnd="url(#replay-arrow)"
        />
        <text x={targetEnd.x + 8} y={targetEnd.y - 8} fill="#285ec4" fontSize="10">
          joint-training correction
        </text>
      </g>
      <g opacity={step >= 3 ? 1 : 0.12}>
        <line
          x1="270"
          y1="245"
          x2={meanEnd.x}
          y2={meanEnd.y}
          stroke="#1b6b50"
          strokeWidth="3.3"
          markerEnd="url(#replay-arrow)"
        />
        <text x={meanEnd.x + 8} y={meanEnd.y + 16} fill="#1b6b50" fontSize="10">
          selected mean · k={budget}
        </text>
        <line
          x1={meanEnd.x}
          y1={meanEnd.y}
          x2={targetEnd.x}
          y2={targetEnd.y}
          stroke="#c9472d"
          strokeWidth="2.2"
          strokeDasharray="4 4"
        />
      </g>
      <g transform="translate(34 344)" opacity={step >= 4 ? 1 : 0.18}>
        <rect width="472" height="48" rx="5" fill="#fff" stroke="#d9ddd4" />
        <text x="17" y="20" fill="#666c64" fontSize="9">
          observable diagnostic
        </text>
        <text x="17" y="36" fill="#111310" fontSize="12">
          ρₜ = ‖ replay mean − target correction ‖
        </text>
      </g>
    </svg>
  )
}

export function ReplayOptimizationChapter() {
  const [step, setStep] = useState(0)
  const [budget, setBudget] = useState(3)
  const [interference, setInterference] = useState(0.58)
  const target = useMemo(() => polar(Math.PI * (0.18 + interference * 0.92), 0.86), [interference])
  const result = useMemo(() => greedySelection(target, REPLAY_CANDIDATES, budget), [target, budget])
  const expressible = result.residual < 0.3
  return (
    <ChapterScaffold
      eyebrow="Online continual learning · replay selection"
      title="Remember the examples that correct the update."
      thesis="Replay is not useful merely because data are old. It is useful when a constrained replay batch can steer the next update toward the behaviour of joint training."
      status="2026 · under revision"
      steps={REPLAY_STEPS}
      activeStep={step}
      onStepChange={setStep}
      stage={
        <ReplayStage
          step={step}
          target={target}
          budget={budget}
          selected={result.selected}
          mean={result.mean}
        />
      }
      insight={
        [
          'The current batch supplies a strong direction, but nothing in that arrow protects earlier tasks.',
          'A memory is a set of possible correction directions. A small replay batch cannot use them all.',
          'The dashed target comes from the stage objective: it says what correction would imitate joint training.',
          'GBR greedily chooses the candidate that most reduces mismatch at each selection round.',
          `The current mismatch is ${result.residual.toFixed(3)}. It is directly measurable before final-stage accuracy.`,
          expressible
            ? 'This setting is currently representable, but other error sources still remain.'
            : 'The residual remains large: the buffer geometry does not contain the needed correction.',
        ][step]
      }
      controls={
        <div className="chapter-control-grid">
          <RangeControl
            label="Replay budget k"
            value={budget}
            min={1}
            max={8}
            step={1}
            display={String(budget)}
            onChange={setBudget}
          />
          <RangeControl
            label="Task interference"
            value={interference}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(interference * 100)}%`}
            onChange={setInterference}
          />
        </div>
      }
      inspect={
        <InspectGrid
          items={[
            [
              'selected subset',
              result.selected.map((index) => `m${index + 1}`).join(', '),
              'Chosen greedily from the displayed candidate pool.',
            ],
            [
              'mismatch ρₜ',
              result.residual.toFixed(3),
              expressible ? 'Low in this projected example.' : 'A visible feasibility warning.',
            ],
            [
              'buffer verdict',
              expressible ? 'target represented' : 'missing direction',
              'Selection cannot repair buffer bias.',
            ],
          ]}
          formal="Selection objective:  Sₜ* ∈ argmin_{|S|=k} ‖ (1/k) Σᵢ∈S gᵢ − τₜ ‖².  Diagnostic: ρₜ = ‖gₜ,rep − τₜ‖."
        />
      }
      contribution={[
        'A replay objective that turns “remember old data” into a measurable update-correction problem.',
        'Derive a concrete correction target from the optimization dynamics of the stage objective.',
        'Formulate constrained replay as subset matching and propose Greedy Ball Replay as an approximation.',
        'Expose a step-wise residual and decompose what selection can—and cannot—explain about replay failure.',
      ]}
      evidence={[
        {
          label: 'OpenReview record',
          title: 'Experience Replay Through the Lens of Optimization',
          note: 'Submission history, reviews, rebuttal, and the dense-gradient baseline criticism are publicly inspectable.',
          href: 'https://openreview.net/forum?id=4z7il66fFb',
        },
        {
          label: 'Reviewer-forced boundary',
          title: 'Dense weighting is a serious baseline',
          note: 'The current revision must justify subset selection under a genuine compute or access constraint; the instrument does not hide that collision.',
        },
        {
          label: 'Diagnostic object',
          title: 'Correction mismatch before final outcomes',
          note: 'The residual is intended as a falsifiable mechanism signal, not a post-hoc explanation of every forgetting event.',
        },
      ]}
      boundary="Subset selection is not automatically better than using the full candidate mean. If dense weighting is feasible and stronger, it is the appropriate baseline; GBR must earn its use under a real replay constraint."
      next={{
        title: 'Rank feasibility',
        question: 'What if the adapter itself cannot express the correction?',
        route: '/research/rank-feasibility',
      }}
    />
  )
}

const RANK_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'An optimizer cannot find a direction the adapter cannot express.',
    body: 'LoRA restricts updates to a low-rank subspace. After learning a current task, each old task may require a corrective decrease in loss, but those correction gradients might not coexist inside the chosen rank.',
    cue: 'The desired point begins outside the pale feasible wedge.',
  },
  {
    label: 'Why rank matters',
    title: 'Increasing rank expands the available correction space.',
    body: 'Higher rank adds directions. That can turn an impossible set of task-wise constraints into a feasible one—but larger is not automatically useful or safe.',
    cue: 'Move the rank slider until the target enters the feasible region.',
  },
  {
    label: 'Key idea',
    title: 'Ask feasibility before asking the optimizer to work harder.',
    body: 'Projected old-task gradients define linear constraints. A small quadratic program tests whether any update inside the rank-r space can satisfy all of them.',
    cue: 'The constraint half-spaces either intersect or they do not.',
  },
  {
    label: 'Mechanism',
    title: 'Among feasible corrections, choose the smallest one.',
    body: 'The minimum-norm solution reduces unnecessary movement. It can then be checked against a current-task preservation guardrail on held-out data.',
    cue: 'Feasibility produces a candidate; validation determines whether it is usable.',
  },
  {
    label: 'What changes',
    title: 'Rank selection becomes a diagnosis of missing directions.',
    body: 'A failed rank is no longer merely “too small” empirically. The local geometry can reveal which combination of task constraints has no available correction direction.',
    cue: 'Inspect the local certificate and correction norm.',
  },
  {
    label: 'Boundary',
    title: 'Local feasibility is not global restoration.',
    body: 'The test relies on representative old-task examples and a local approximation. A feasible first-order correction can still fail after a finite update, and it does not guarantee better generalization.',
    cue: 'Tighten the guardrail until a feasible correction becomes practically rejected.',
  },
]

function RankStage({
  step,
  rank,
  tolerance,
  guardrail,
}: {
  step: number
  rank: number
  tolerance: number
  guardrail: number
}) {
  const reach = 76 + rank * 18
  const target = { x: 410, y: 104 }
  const feasible = reach >= 305 - tolerance * 70
  const correctionX = Math.min(target.x, 118 + reach)
  const correctionY = 350 - (correctionX - 118) * 0.69
  const retained = Math.max(0, 1 - (rank < 5 ? 0.55 : 0.06 + rank * 0.006) - guardrail * 0.08)
  return (
    <svg
      viewBox="0 0 540 430"
      role="img"
      aria-label="Nested low-rank correction spaces and task-wise feasibility constraints"
    >
      <rect width="540" height="430" fill="#f5f6f2" />
      <text x="30" y="34" fill="#666c64" fontSize="10">
        projected adapter update space
      </text>
      <g transform="translate(112 350)">
        {[8, 6, 4, 2].map((level, index) => {
          const width = 76 + level * 18
          return (
            <path
              key={level}
              d={`M0 0 L ${width} ${-width * 0.76} L ${width + 62} ${-width * 0.45} Z`}
              fill={`rgba(40,94,196,${0.035 + index * 0.025})`}
              stroke={`rgba(40,94,196,${0.16 + index * 0.1})`}
              opacity={rank >= level ? 1 : 0.16}
            />
          )
        })}
        <line x1="0" y1="0" x2="316" y2="-246" stroke="#8f978b" strokeDasharray="5 5" />
        <line x1="0" y1="0" x2="322" y2="-164" stroke="#8f978b" strokeDasharray="5 5" />
        <text x="250" y="-254" fill="#666c64" fontSize="9">
          old task 1 must improve
        </text>
        <text x="270" y="-149" fill="#666c64" fontSize="9">
          old task 2 must improve
        </text>
      </g>
      <circle
        cx={target.x}
        cy={target.y}
        r="9"
        fill={feasible ? '#1b6b50' : '#fff'}
        stroke={feasible ? '#1b6b50' : '#c9472d'}
        strokeWidth="2.5"
        opacity={step >= 1 ? 1 : 0.35}
      />
      <text x="426" y="99" fill={feasible ? '#1b6b50' : '#c9472d'} fontSize="10">
        desired task-wise correction
      </text>
      <g opacity={step >= 2 ? 1 : 0.15}>
        <line
          x1="112"
          y1="350"
          x2={correctionX}
          y2={correctionY}
          stroke="#285ec4"
          strokeWidth="3"
        />
        <circle
          cx={correctionX}
          cy={correctionY}
          r="6"
          fill="#fff"
          stroke="#285ec4"
          strokeWidth="2"
        />
        <text x={correctionX + 10} y={correctionY + 18} fill="#285ec4" fontSize="10">
          minimum-norm candidate
        </text>
      </g>
      <g transform="translate(32 300)" opacity={step >= 3 ? 1 : 0.18}>
        <rect width="205" height="72" rx="5" fill="#fff" stroke="#d9ddd4" />
        <text x="14" y="21" fill="#666c64" fontSize="9">
          held-out guardrail
        </text>
        <rect x="14" y="35" width="168" height="9" rx="4.5" fill="#e1e5dd" />
        <rect
          x="14"
          y="35"
          width={168 * retained}
          height="9"
          rx="4.5"
          fill={retained >= guardrail ? '#1b6b50' : '#c9472d'}
        />
        <text x="14" y="61" fill="#111310" fontSize="10">
          {(retained * 100).toFixed(1)}% current progress retained
        </text>
      </g>
      <g transform="translate(352 318)" opacity={step >= 4 ? 1 : 0.18}>
        <rect width="154" height="54" rx="5" fill="#111310" />
        <text x="14" y="21" fill="#fff" fontSize="9">
          local verdict
        </text>
        <text x="14" y="40" fill="#fff" fontSize="12">
          {!feasible
            ? 'infeasible'
            : retained < guardrail
              ? 'feasible · reject'
              : 'feasible · validate'}
        </text>
      </g>
    </svg>
  )
}

export function RankFeasibilityChapter() {
  const [step, setStep] = useState(0)
  const [rank, setRank] = useState(4)
  const [tolerance, setTolerance] = useState(0.18)
  const [guardrail, setGuardrail] = useState(0.9)
  const threshold = Math.max(1, Math.ceil(6 - tolerance * 3))
  const feasible = rank >= threshold
  const normValue = feasible ? (1.9 / (rank * 0.52 + tolerance)).toFixed(2) : '∞'
  const retained = Math.max(0, 1 - (rank < 5 ? 0.55 : 0.06 + rank * 0.006) - guardrail * 0.08)
  const usable = feasible && retained >= guardrail
  return (
    <ChapterScaffold
      eyebrow="Continual PEFT · geometric diagnosis"
      title="First ask whether the correction exists."
      thesis="A low-rank adapter can only move inside its available subspace. Rank selection should therefore begin with a feasibility question, then test whether the smallest correction preserves current-task progress."
      status="NeurIPS 2026 · under review / revision"
      steps={RANK_STEPS}
      activeStep={step}
      onStepChange={setStep}
      stage={<RankStage step={step} rank={rank} tolerance={tolerance} guardrail={guardrail} />}
      insight={
        [
          'The desired correction is not merely difficult to optimize; at low rank it lies outside the adapter’s available geometry.',
          `Rank ${rank} ${feasible ? 'now reaches' : 'still does not reach'} the task-wise feasible region in this local example.`,
          'The test uses the intersection of task-wise linear constraints, not average old-task loss alone.',
          `The minimum-norm candidate has local norm ${normValue}; held-out data must still judge its practical effect.`,
          usable
            ? 'This rank passes both the local feasibility check and the displayed preservation guardrail.'
            : feasible
              ? 'The correction exists locally but is rejected by the current-task guardrail.'
              : 'No optimizer can satisfy these displayed local constraints inside this rank.',
          'Representative old-task data, curvature, finite-step behaviour, and generalization remain outside the local certificate.',
        ][step]
      }
      controls={
        <div className="chapter-control-grid">
          <RangeControl
            label="LoRA rank"
            value={rank}
            min={1}
            max={8}
            step={1}
            display={String(rank)}
            onChange={setRank}
          />
          <RangeControl
            label="Constraint tolerance"
            value={tolerance}
            min={0}
            max={0.6}
            step={0.01}
            display={tolerance.toFixed(2)}
            onChange={setTolerance}
          />
          <RangeControl
            label="Progress guardrail"
            value={guardrail}
            min={0.7}
            max={0.99}
            step={0.01}
            display={`${Math.round(guardrail * 100)}%`}
            onChange={setGuardrail}
          />
        </div>
      }
      inspect={
        <InspectGrid
          items={[
            [
              'local feasibility',
              feasible ? 'yes' : 'no',
              `First feasible rank in this example: ${threshold}.`,
            ],
            [
              'minimum norm',
              normValue,
              'Smallest projected correction satisfying all local task constraints.',
            ],
            [
              'practical decision',
              usable ? 'pass' : 'reject',
              feasible
                ? 'Checked against current-task preservation.'
                : 'No correction is available to test.',
            ],
          ]}
          formal="Minimum-norm correction:  minᵤ ½‖u‖²  subject to  ⟨Pᵣgᵢ, u⟩ ≤ −δᵢ  for every old task i.  Infeasibility admits a Farkas-type certificate."
        />
      }
      contribution={[
        'A geometric distinction between rank that is large enough to express a correction and rank that is actually useful.',
        'Formulate task-wise old-loss repair as a rank-dependent system of local linear constraints.',
        'Use a minimum-norm quadratic program to construct a correction or expose infeasibility.',
        'Separate local feasibility from held-out current-task preservation and state the data and curvature limits explicitly.',
      ]}
      evidence={[
        {
          label: 'OpenReview record',
          title: 'Rank Feasibility in Continual PEFT',
          note: 'The public submission, reviews, meta-review, and expanded rebuttal evidence.',
          href: 'https://openreview.net/forum?id=CwmHHYCbjK',
        },
        {
          label: 'Empirical decision',
          title: 'Rank is screened, then the correction is validated',
          note: 'The diagnostic is useful only when held-out old-task and current-task measurements are representative.',
        },
        {
          label: 'Claim boundary',
          title: 'Local existence is not global optimality',
          note: 'The theorem diagnoses projected first-order geometry; it does not claim universal rank superiority or complete restoration.',
        },
      ]}
      boundary="The method is not rehearsal-free: it requires representative old-task evidence at the checkpoint. Its first-order certificate can reject an impossible local correction, but it cannot guarantee finite-step loss changes or generalization."
      next={{
        title: 'TiC-LM',
        question: 'What if the right correction also changes with historical age and domain drift?',
        route: '/research/ticlm',
      }}
    />
  )
}

const TIC_STEPS: ChapterStep[] = [
  {
    label: 'Problem',
    title: 'Replay spends current tokens.',
    body: 'In time-continual pretraining, a fixed update budget means every historical token displaces a token from the current window. Replay is therefore a resource allocation decision, not free regularization.',
    cue: 'The current window and archive compete for the same bar of tokens.',
  },
  {
    label: 'Why age fails',
    title: 'Old does not mean useful—and recent does not mean safe.',
    body: 'A stable domain may benefit from distant history, while a fast-evolving domain can be harmed by replaying stale information. Age alone cannot determine value.',
    cue: 'Raise drift speed and watch old-window value cross below zero.',
  },
  {
    label: 'Key idea',
    title: 'Compare replay against the current tokens it replaces.',
    body: 'For each old window, the correct local direction is its gradient minus the current-window gradient. The counterfactual asks whether that replacement improves the next temporal regret row.',
    cue: 'Positive arrows earn allocation; negative arrows are refused.',
  },
  {
    label: 'Mechanism',
    title: 'Preserve current, backward, and forward effects separately.',
    body: 'Replay can improve retention while hurting current adaptation or forward compatibility. Matrix-valued effects remain visible until a policy explicitly combines them.',
    cue: 'Read the three cells in each window’s value vector.',
  },
  {
    label: 'What changes',
    title: 'No replay becomes a legitimate optimum.',
    body: 'A conservative allocator penalizes uncertainty and applies guardrails. If every old window has non-positive value, the correct action is to spend the entire budget on current data.',
    cue: 'Push drift high enough to make every historical allocation vanish.',
  },
  {
    label: 'Boundary',
    title: 'The controller predicts; experiments must falsify it.',
    body: 'Local gradient effects and uncertainty estimates are not substitutes for trained checkpoints. The method is ongoing research until predicted regret-row changes are validated prospectively.',
    cue: 'Inspect the prediction rather than reading it as a completed empirical result.',
  },
]

function replayValues(time: number, drift: number) {
  return Array.from({ length: time }, (_, index) => {
    const age = time - index
    const backward = 0.72 * Math.exp(-age * (0.13 + drift * 0.19))
    const current = -drift * age * 0.1
    const forward = -Math.max(0, drift - 0.34) * age * 0.075
    const uncertainty = 0.045 + 0.018 * age
    return {
      index,
      age,
      backward,
      current,
      forward,
      uncertainty,
      total: backward + current + forward - uncertainty,
    }
  })
}

function TiCStage({
  step,
  time,
  budget,
  values,
}: {
  step: number
  time: number
  budget: number
  values: ReturnType<typeof replayValues>
}) {
  const positive = values.filter((value) => value.total > 0)
  const denominator = positive.reduce((sum, value) => sum + value.total, 0)
  return (
    <svg
      viewBox="0 0 540 430"
      role="img"
      aria-label="Historical windows compete with current tokens according to temporal replay value"
    >
      <rect width="540" height="430" fill="#f5f6f2" />
      <text x="30" y="34" fill="#666c64" fontSize="10">
        chronological training windows
      </text>
      {Array.from({ length: time + 2 }, (_, index) => {
        const x = 34 + index * (468 / (time + 1))
        const current = index === time
        return (
          <g key={index} opacity={index > time ? 0.25 : 1}>
            <rect
              x={x - 14}
              y="160"
              width="28"
              height="52"
              rx="3"
              fill={current ? '#111310' : index < time ? '#fff' : 'none'}
              stroke={current ? '#111310' : '#aeb4aa'}
              strokeDasharray={index > time ? '4 3' : undefined}
            />
            <text
              x={x}
              y="229"
              fill={current ? '#111310' : '#666c64'}
              fontSize="8"
              textAnchor="middle"
            >
              t{index + 1}
            </text>
          </g>
        )
      })}
      <g opacity={step >= 0 ? 1 : 0.2}>
        <rect x="34" y="265" width="472" height="22" rx="11" fill="#e1e5dd" />
        <rect x="34" y="265" width={472 * (1 - budget)} height="22" rx="11" fill="#285ec4" />
        <text x="34" y="306" fill="#666c64" fontSize="9">
          current tokens
        </text>
        <text x="458" y="306" fill="#666c64" fontSize="9">
          replay tokens
        </text>
      </g>
      <g opacity={step >= 1 ? 1 : 0.15}>
        {values.map((value) => {
          const x = 34 + value.index * (468 / (time + 1))
          const targetX = 34 + time * (468 / (time + 1))
          const positive = value.total > 0
          return (
            <g key={value.index}>
              <path
                d={`M ${x} 150 Q ${(x + targetX) / 2} ${70 + value.age * 5} ${targetX} 150`}
                fill="none"
                stroke={positive ? '#1b6b50' : '#c9472d'}
                strokeWidth={1.1 + Math.abs(value.total) * 3}
                strokeDasharray={positive ? undefined : '5 4'}
              />
              <text
                x={x}
                y="137"
                fill={positive ? '#1b6b50' : '#c9472d'}
                fontSize="8"
                textAnchor="middle"
              >
                {value.total > 0 ? '+' : ''}
                {value.total.toFixed(2)}
              </text>
            </g>
          )
        })}
      </g>
      <g transform="translate(30 326)" opacity={step >= 3 ? 1 : 0.16}>
        {values.slice(-Math.min(5, values.length)).map((value, row) => {
          const y = row * 15
          return (
            <g key={value.index}>
              <text x="0" y={y + 9} fill="#666c64" fontSize="7">
                t{value.index + 1}
              </text>
              {[value.backward, value.current, value.forward].map((cell, column) => (
                <rect
                  key={column}
                  x={32 + column * 38}
                  y={y}
                  width="33"
                  height="11"
                  fill={
                    cell >= 0
                      ? `rgba(27,107,80,${Math.min(0.8, 0.16 + Math.abs(cell))})`
                      : `rgba(201,71,45,${Math.min(0.8, 0.16 + Math.abs(cell) * 2)})`
                  }
                />
              ))}
            </g>
          )
        })}
        <text x="35" y="84" fill="#666c64" fontSize="7">
          backward
        </text>
        <text x="76" y="84" fill="#666c64" fontSize="7">
          current
        </text>
        <text x="119" y="84" fill="#666c64" fontSize="7">
          forward
        </text>
      </g>
      <g transform="translate(270 326)" opacity={step >= 4 ? 1 : 0.16}>
        <rect width="236" height="63" rx="5" fill="#fff" stroke="#d9ddd4" />
        <text x="14" y="20" fill="#666c64" fontSize="9">
          conservative allocation
        </text>
        <text x="14" y="43" fill="#111310" fontSize="13">
          {denominator > 0
            ? `${positive.length} window${positive.length === 1 ? '' : 's'} earn replay`
            : 'current only · zero replay'}
        </text>
      </g>
    </svg>
  )
}

export function TiCLMChapter() {
  const [step, setStep] = useState(0)
  const [time, setTime] = useState(6)
  const [drift, setDrift] = useState(0.42)
  const [budget, setBudget] = useState(0.22)
  const values = useMemo(() => replayValues(time, drift), [time, drift])
  const positive = values.filter((value) => value.total > 0)
  const best = [...values].sort((a, b) => b.total - a.total)[0]
  const allocation = positive.length ? budget : 0
  return (
    <ChapterScaffold
      eyebrow="Time-continual language models · replay allocation"
      title="Replay should earn the tokens it replaces."
      thesis="Historical data can preserve knowledge, but it also displaces current learning. The right object is counterfactual temporal value across backward, current, and forward regret—not a fixed replay ratio."
      status="Ongoing research · TiC-LM"
      steps={TIC_STEPS}
      activeStep={step}
      onStepChange={setStep}
      stage={<TiCStage step={step} time={time} budget={allocation} values={values} />}
      insight={
        [
          `A ${Math.round(budget * 100)}% replay ratio means the same fraction of current-window tokens is removed.`,
          best.total > 0
            ? `Window t${best.index + 1} currently has the highest conservative value (${best.total.toFixed(2)}).`
            : 'Every historical window is currently worse than displaced current tokens.',
          'Each historical gradient is scored as a replacement direction: gτ − gt, not as an isolated old-data benefit.',
          'Backward gain can coexist with current and forward harm; the cells remain separate until policy aggregation.',
          positive.length
            ? `${positive.length} window${positive.length === 1 ? '' : 's'} retain positive conservative value.`
            : 'No old window clears zero, so the displayed optimizer chooses no replay.',
          'These are local, falsifiable predictions. Trained temporal checkpoints are the decisive empirical test.',
        ][step]
      }
      controls={
        <div className="chapter-control-grid">
          <RangeControl
            label="Current time"
            value={time}
            min={3}
            max={9}
            step={1}
            display={`t${time + 1}`}
            onChange={setTime}
          />
          <RangeControl
            label="Domain drift speed"
            value={drift}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(drift * 100)}%`}
            onChange={setDrift}
          />
          <RangeControl
            label="Maximum replay budget"
            value={budget}
            min={0}
            max={0.5}
            step={0.01}
            display={`${Math.round(budget * 100)}%`}
            onChange={setBudget}
          />
        </div>
      }
      inspect={
        <InspectGrid
          items={[
            [
              'positive windows',
              String(positive.length),
              'Only these receive replay mass before normalization.',
            ],
            [
              'best historical window',
              best ? `t${best.index + 1}` : 'none',
              best
                ? `Conservative value ${best.total.toFixed(3)}.`
                : 'No archived candidate exists.',
            ],
            [
              'chosen replay',
              `${Math.round(allocation * 100)}%`,
              positive.length
                ? 'Budget allocated across positive windows.'
                : 'The no-replay solution is active.',
            ],
          ]}
          formal="Replacement direction: dₜ,τ = gτ − gt.  Local row effect: ΔRₜ,τ ≈ −η Jₜ dₜ,τ.  Allocate αₜ,τ ≥ 0 only when conservative policy value remains positive."
        />
      }
      contribution={[
        'A counterfactual definition of replay value for a fixed-token temporal stream.',
        'Use historical training windows—not assumed semantic domains—as the faithful default replay unit.',
        'Retain current, backward, and forward regret effects as a matrix-valued object before scalar policy choice.',
        'Make uncertainty, guardrails, replay lifetime, and a zero-replay action explicit and prospectively testable.',
      ]}
      evidence={[
        {
          label: 'Benchmark',
          title: 'TiC-LM: web-scale time-continual language-model pretraining',
          note: 'The external benchmark defines the chronological windows, checkpoints, and temporal evaluation matrices.',
          href: 'https://github.com/apple/ml-tic-lm',
        },
        {
          label: 'Research state',
          title: 'Counterfactual Window Replay',
          note: 'An active method direction. The portfolio distinguishes its formal proposal from results that have not yet been run.',
        },
        {
          label: 'Falsification target',
          title: 'Predicted regret-row changes',
          note: 'A useful controller must predict when replay helps stable domains, becomes stale, and should disappear.',
        },
      ]}
      boundary="The live allocator is a transparent scientific model of the proposed decision rule, not a claim of completed large-scale empirical validation. Prospective TiC-LM runs must confirm—or kill—its regret-matrix predictions."
      next={{
        title: 'Urban logistics',
        question: 'How does a learned model become a concrete operational decision?',
        route: '/research/urban-logistics',
      }}
    />
  )
}
