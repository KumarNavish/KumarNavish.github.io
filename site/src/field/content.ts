export type EntityKind =
  | 'paper'
  | 'system'
  | 'experiment'
  | 'prototype'
  | 'question'
  | 'direction'

export type EntityStatus =
  | 'published'
  | 'under-review'
  | 'under-revision'
  | 'ongoing'
  | 'prototype'
  | 'archived'

export interface EvidenceSource {
  id: string
  label: string
  kind: 'paper' | 'openreview' | 'repository' | 'artifact' | 'profile'
  href: string
  verifiedAt: string
  status: 'verified' | 'provisional' | 'historical'
}

export interface EvidenceClaim {
  id: string
  claim: string
  sourceIds: string[]
  supports: string
  boundary: string
}

export interface FieldEntity {
  id: string
  slug: string
  kind: EntityKind
  status: EntityStatus
  statusLabel: string
  title: string
  shortTitle: string
  thesis: string
  question: string
  year: string
  themes: string[]
  sourceIds: string[]
  featured: boolean
  public: boolean
}

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: 'er-openreview',
    label: 'Experience Replay Through the Lens of Optimization — OpenReview record',
    kind: 'openreview',
    href: 'https://openreview.net/forum?id=4z7il66fFb',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
  {
    id: 'er-paper',
    label: 'Experience Replay Through the Lens of Optimization — paper PDF',
    kind: 'paper',
    href: 'https://openreview.net/pdf?id=4z7il66fFb',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
  {
    id: 'rank-openreview',
    label: 'Rank Feasibility in Continual PEFT — OpenReview record',
    kind: 'openreview',
    href: 'https://openreview.net/forum?id=CwmHHYCbjK',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
  {
    id: 'rank-paper',
    label: 'Rank Feasibility in Continual PEFT — paper PDF',
    kind: 'paper',
    href: 'https://openreview.net/pdf?id=CwmHHYCbjK',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
  {
    id: 'github-profile',
    label: 'Navish Kumar — GitHub profile',
    kind: 'profile',
    href: 'https://github.com/KumarNavish',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
  {
    id: 'scholar-profile',
    label: 'Navish Kumar — Google Scholar profile',
    kind: 'profile',
    href: 'https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
  {
    id: 'portfolio-repository',
    label: 'Portfolio system — source repository',
    kind: 'repository',
    href: 'https://github.com/KumarNavish/KumarNavish.github.io',
    verifiedAt: '2026-08-28',
    status: 'verified',
  },
]

export const EVIDENCE_CLAIMS: EvidenceClaim[] = [
  {
    id: 'er-framing',
    claim:
      'The replay work frames constrained experience replay as matching a desired update correction rather than selecting examples by an unrelated heuristic score.',
    sourceIds: ['er-openreview', 'er-paper'],
    supports:
      'The paper defines the desired correction, a constrained subset-matching objective, and an observable replay mismatch.',
    boundary:
      'This framing does not by itself establish that subset selection is preferable to every dense replay alternative.',
  },
  {
    id: 'er-outcomes',
    claim:
      'In the locked 10-seed S-TinyImageNet / class-incremental comparison, GBR improved final average accuracy by 1.389 percentage points and reduced forgetting by 1.391 percentage points relative to the uniform-subset control.',
    sourceIds: ['er-openreview'],
    supports:
      'The paired final-stage comparison reports AvgAcc +1.389 pp [0.920, 1.858], AvgLoss −0.0456 [−0.0673, −0.0239], and Forgetting −1.391 pp [−1.945, −0.837].',
    boundary:
      'The result is specific to the locked configuration and does not establish universal superiority or a compute advantage over dense gradient weighting.',
  },
  {
    id: 'er-review-boundary',
    claim:
      'The decisive review challenge was whether constrained subset selection remains useful when dense gradient weighting is available.',
    sourceIds: ['er-openreview'],
    supports:
      'The public decision and review record identify the dense-weighting comparison and practical motivation for down-sampling as the central unresolved concern.',
    boundary:
      'The review record is an evaluation of the submitted version, not a permanent judgement on later revisions.',
  },
  {
    id: 'rank-framing',
    claim:
      'Rank Feasibility treats continual LoRA rank selection as a geometric feasibility problem: a rank is useful only when its subspace admits a sufficiently small correction for the old tasks while preserving current-task progress.',
    sourceIds: ['rank-openreview', 'rank-paper'],
    supports:
      'The paper formulates old-task constraints in the projected rank subspace and uses a minimum-norm feasibility problem to diagnose candidate ranks.',
    boundary:
      'Local feasibility is not a guarantee of held-out generalization; the paper uses held-out evaluation to test the constructed correction.',
  },
  {
    id: 'portfolio-system',
    claim:
      'This portfolio is implemented as a data-bound React and TypeScript product surface rather than a static résumé page.',
    sourceIds: ['portfolio-repository'],
    supports:
      'The public repository exposes the frontend application, typed content, tests, data pipeline, and deployment workflow.',
    boundary:
      'Repository structure demonstrates implementation, not the scientific validity of research claims shown elsewhere.',
  },
]

export const FIELD_ENTITIES: FieldEntity[] = [
  {
    id: 'spectral-foundations',
    slug: 'spectral-foundations',
    kind: 'paper',
    status: 'published',
    statusLabel: 'Published',
    title: 'Spectral structure for gain graphs',
    shortTitle: 'Structure',
    thesis: 'Make invariants and failure conditions explicit before optimizing a learning system.',
    question: 'What structure must remain true?',
    year: '2020–2021',
    themes: ['mathematical structure', 'spectral graph theory'],
    sourceIds: ['scholar-profile'],
    featured: false,
    public: true,
  },
  {
    id: 'square-root-ngi',
    slug: 'square-root-natural-gradient',
    kind: 'paper',
    status: 'published',
    statusLabel: 'Preprint',
    title: 'Optimization Guarantees for Square-Root Natural-Gradient Variational Inference',
    shortTitle: 'Guarantees',
    thesis: 'Choose a parameterization in which useful empirical behaviour can become analytically tractable.',
    question: 'Which geometry makes optimization reliable?',
    year: '2025',
    themes: ['optimization', 'variational inference'],
    sourceIds: ['scholar-profile'],
    featured: false,
    public: true,
  },
  {
    id: 'experience-replay',
    slug: 'experience-replay-optimization',
    kind: 'paper',
    status: 'under-revision',
    statusLabel: 'Under revision',
    title: 'Experience Replay Through the Lens of Optimization',
    shortTitle: 'Replay',
    thesis: 'Define the missing update before deciding which memories deserve the replay budget.',
    question: 'What should memory contribute now?',
    year: '2026',
    themes: ['continual learning', 'experience replay', 'optimization'],
    sourceIds: ['er-openreview', 'er-paper'],
    featured: true,
    public: true,
  },
  {
    id: 'rank-feasibility',
    slug: 'rank-feasibility-continual-peft',
    kind: 'paper',
    status: 'under-review',
    statusLabel: 'NeurIPS 2026 submission',
    title: 'Rank Feasibility in Continual PEFT',
    shortTitle: 'Feasibility',
    thesis: 'More rank helps only when it adds a direction capable of satisfying the old tasks at acceptable cost.',
    question: 'When is an adaptation subspace enough?',
    year: '2026',
    themes: ['PEFT', 'LoRA', 'continual adaptation'],
    sourceIds: ['rank-openreview', 'rank-paper'],
    featured: true,
    public: true,
  },
  {
    id: 'ticlm',
    slug: 'counterfactual-window-replay',
    kind: 'direction',
    status: 'ongoing',
    statusLabel: 'Ongoing research',
    title: 'Counterfactual Window Replay for Time-Continual Language Models',
    shortTitle: 'Temporal value',
    thesis: 'Historical data should earn the current tokens it replaces.',
    question: 'Which memories remain valuable as the world changes?',
    year: '2026—',
    themes: ['continual pretraining', 'temporal evaluation', 'language models'],
    sourceIds: [],
    featured: true,
    public: false,
  },
  {
    id: 'casepath',
    slug: 'casepath',
    kind: 'system',
    status: 'prototype',
    statusLabel: 'Live prototype',
    title: 'CasePath',
    shortTitle: 'Inspection',
    thesis: 'Make process, evidence, gates, and failure observable inside the product.',
    question: 'How should an agent expose its reasoning and limits?',
    year: '2026',
    themes: ['agentic systems', 'process intelligence', 'auditability'],
    sourceIds: ['github-profile'],
    featured: false,
    public: true,
  },
  {
    id: 'spatial-intelligence',
    slug: 'spatial-intelligence',
    kind: 'direction',
    status: 'ongoing',
    statusLabel: 'Research direction',
    title: 'Generative Spatial Intelligence',
    shortTitle: 'Embodiment',
    thesis: 'Turn intent into structured environments that people can inspect, manipulate, and inhabit.',
    question: 'What should the interface to intelligence become?',
    year: '2026—',
    themes: ['spatial computing', 'generative systems', 'VR'],
    sourceIds: [],
    featured: true,
    public: false,
  },
]

export function getEvidenceClaim(id: string): EvidenceClaim | undefined {
  return EVIDENCE_CLAIMS.find((claim) => claim.id === id)
}

export function getEvidenceSource(id: string): EvidenceSource | undefined {
  return EVIDENCE_SOURCES.find((source) => source.id === id)
}

export function getEntity(id: string): FieldEntity | undefined {
  return FIELD_ENTITIES.find((entity) => entity.id === id)
}
