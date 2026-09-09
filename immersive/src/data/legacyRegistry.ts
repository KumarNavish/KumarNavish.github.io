export const RESEARCH_STATUSES = [
  'published',
  'accepted',
  'preprint',
  'under-review',
  'under-revision',
  'ongoing',
  'prototype',
  'direction',
  'archived',
] as const

export const EXPERIENCE_STATUSES = [
  'full-interactive-chapter',
  'guided-preview',
  'evidence-page',
  'implementation-in-progress',
] as const

export const WORK_PERIODS = ['foundations', 'current', 'frontier'] as const
export const WORK_TYPES = ['paper', 'system', 'experiment', 'direction'] as const
export const RELATION_KINDS = [
  'direct-methodological-inheritance',
  'recurring-question',
  'adjacent-application',
  'later-extension',
] as const

export type ResearchStatus = (typeof RESEARCH_STATUSES)[number]
export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number]
export type WorkPeriod = (typeof WORK_PERIODS)[number]
export type WorkType = (typeof WORK_TYPES)[number]
export type RelationKind = (typeof RELATION_KINDS)[number]

export type EvidenceKind =
  | 'paper'
  | 'openreview'
  | 'repository'
  | 'demo'
  | 'context'
  | 'artifact'

export type WorkEvidence = {
  kind: EvidenceKind
  label: string
  url: string
  public: boolean
  note: string
}

export type WorkRelation = {
  targetId: string
  kind: RelationKind
  note: string
}

export type WorkRegistryEntry = {
  id: string
  title: string
  shortTitle: string
  date: string
  dateLabel: string
  year: number
  venue: string
  researchStatus: ResearchStatus
  researchStatusLabel: string
  statusNote: string
  experienceStatus: ExperienceStatus
  experienceStatusLabel: string
  period: WorkPeriod
  type: WorkType
  coauthors: string[]
  role: string
  route: string
  question: string
  explanation15: string
  explanation60: string[]
  contribution: string
  evidenceAvailableNow: string
  limitation: string
  relationToEarlierWork: string
  nextQuestion: string
  themes: string[]
  areas: string[]
  previewKind:
    | 'network'
    | 'gain-normalization'
    | 'gain-frustration'
    | 'urban'
    | 'natural-gradient'
    | 'replay'
    | 'rank'
    | 'temporal'
    | 'casepath'
    | 'spatial'
  evidence: WorkEvidence[]
  relations: WorkRelation[]
  updatedAt: string
  metadata: {
    title: string
    description: string
    socialImage: string
  }
}

const PUBLIC = true

export const WORK_REGISTRY: WorkRegistryEntry[] = [
  {
    id: 'counterspeech-dynamics',
    title: 'Interaction Dynamics Between Hate and Counter Users on Twitter',
    shortTitle: 'Hate and counterspeech dynamics',
    date: '2020-01-05',
    dateLabel: 'January 2020',
    year: 2020,
    venue: '7th ACM IKDD CoDS and 25th COMAD',
    researchStatus: 'published',
    researchStatusLabel: 'Published',
    statusNote: 'Peer-reviewed conference paper published by ACM in 2020.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Interactive explanation',
    period: 'foundations',
    type: 'paper',
    coauthors: ['Binny Mathew', 'Pawan Goyal', 'Animesh Mukherjee'],
    role:
      'Co-author; contributed to the paired-user dataset, empirical analysis, and interpretation of interaction and linguistic asymmetries.',
    route: '/work/counterspeech-dynamics',
    question:
      'How do people producing hate and people responding with counterspeech behave differently in real interaction networks?',
    explanation15:
      'The work compares paired hate and counter users, then makes their interaction, linguistic, and behavioural asymmetries measurable instead of treating both groups as one undifferentiated population.',
    explanation60: [
      'Platforms often react to hateful speech by removing content or accounts, but that does not explain how harmful and protective behaviour interact.',
      'We built and released a paired-user dataset and studied network, lexical, linguistic, and psycholinguistic differences between hate and counter users.',
      'The contribution is empirical: it exposes recurring asymmetries and context-dependent counterspeech strategies. It does not claim that the observed patterns prove a causal intervention policy.',
    ],
    contribution:
      'A released paired-account dataset and an empirical account of how harmful and protective users differ in activity, language, popularity, and response strategy.',
    evidenceAvailableNow:
      'Peer-reviewed ACM paper, DOI record, publication metadata, and public repository.',
    limitation:
      'Observational social-media evidence does not establish that a particular counterspeech strategy causally reduces harm, nor should it drive automatic enforcement.',
    relationToEarlierWork:
      'This is the earliest work in the portfolio and establishes a recurring habit: make an interaction system observable before proposing an intervention.',
    nextQuestion:
      'What mathematical structure can make consistency and failure visible before an operational decision is made?',
    themes: ['social computing', 'interaction networks', 'empirical evidence'],
    areas: ['Empirical AI', 'Human systems', 'Evidence'],
    previewKind: 'network',
    evidence: [
      {
        kind: 'paper',
        label: 'ACM paper',
        url: 'https://doi.org/10.1145/3371158.3371172',
        public: PUBLIC,
        note: 'Peer-reviewed publication record and DOI.',
      },
      {
        kind: 'repository',
        label: 'Dataset and code',
        url: 'https://github.com/KumarNavish/Twitter-Hate-and-counter-speakers',
        public: PUBLIC,
        note: 'Public repository associated with the study.',
      },
    ],
    relations: [
      {
        targetId: 'normalized-gain-laplacians',
        kind: 'recurring-question',
        note: 'Both works ask how local relationships aggregate into system-level structure.',
      },
      {
        targetId: 'casepath',
        kind: 'recurring-question',
        note: 'Both separate observable evidence from the authority to act on it.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Hate and Counterspeech Dynamics | Navish Kumar',
      description:
        'An interactive explanation of the published paired-user study of hate and counterspeech interaction dynamics.',
      socialImage: '/social/counterspeech.svg',
    },
  },
  {
    id: 'normalized-gain-laplacians',
    title: 'Normalized Laplacians for Gain Graphs',
    shortTitle: 'Normalized gain Laplacians',
    date: '2020-09-29',
    dateLabel: '2020 preprint · 2022 journal publication',
    year: 2020,
    venue: 'American Journal of Combinatorics 1 (2022), 20–39',
    researchStatus: 'published',
    researchStatusLabel: 'Published',
    statusNote:
      'Submitted as arXiv:2009.13788 in 2020 and published in the American Journal of Combinatorics in 2022.',
    experienceStatus: 'guided-preview',
    experienceStatusLabel: 'Guided explanation + full shared instrument',
    period: 'foundations',
    type: 'paper',
    coauthors: ['M. Rajesh Kannan', 'Shivaramakrishna Pragada'],
    role:
      'Co-author; contributed to the operator definitions, spectral analysis, examples, and exposition.',
    route: '/work/normalized-gain-laplacians',
    question:
      'How can a graph carry complex-valued relationships while retaining a normalized spectral operator with interpretable structure?',
    explanation15:
      'Each oriented edge carries a unit-complex gain. The paper defines the normalized gain Laplacian and studies how balance, bipartiteness, interlacing, and the spectrum fit together.',
    explanation60: [
      'An ordinary graph records whether two vertices are connected. A gain graph also records an orientation-sensitive complex phase on each edge.',
      'The normalized gain Laplacian turns those local phases into one Hermitian operator whose eigenvalues remain real and can be compared across vertices with different degrees.',
      'The paper establishes foundational spectral properties, equality cases, balance and bipartiteness relationships, edge interlacing, and characteristic-polynomial structure.',
    ],
    contribution:
      'A normalized Laplacian framework for complex unit gain graphs, with spectral bounds and structural characterizations that support later extremal analysis.',
    evidenceAvailableNow:
      'Journal article, DOI, arXiv manuscript, and a live browser instrument that recomputes the operator and spectrum.',
    limitation:
      'The browser visualizes one finite graph. It does not replace the general theorems, proofs, equality cases, or characteristic-polynomial analysis.',
    relationToEarlierWork:
      'Moves from observing interaction networks to formalizing how relationship consistency changes a network operator.',
    nextQuestion:
      'Can extremal eigenvalues quantify how far an inconsistent gain graph is from balance?',
    themes: ['spectral graph theory', 'gain graphs', 'normalized operators'],
    areas: ['Mathematical ML', 'Graph structure', 'Theory'],
    previewKind: 'gain-normalization',
    evidence: [
      {
        kind: 'paper',
        label: 'Journal article',
        url: 'https://doi.org/10.63151/amjc.v1i.3',
        public: PUBLIC,
        note: 'Published article and authoritative bibliographic record.',
      },
      {
        kind: 'paper',
        label: 'arXiv manuscript',
        url: 'https://arxiv.org/abs/2009.13788',
        public: PUBLIC,
        note: 'Public manuscript with the complete mathematical development.',
      },
      {
        kind: 'demo',
        label: 'Live gain-graph instrument',
        url: '/work/gain-graphs',
        public: PUBLIC,
        note: 'Computed graph, operator, eigensystem, cycle products, and diffusion.',
      },
    ],
    relations: [
      {
        targetId: 'extremal-gain-laplacian-bounds',
        kind: 'direct-methodological-inheritance',
        note: 'The normalized-operator foundations precede the later extremal frustration bounds.',
      },
      {
        targetId: 'square-root-natural-gradient',
        kind: 'recurring-question',
        note: 'Both use geometry to make optimization-relevant structure interpretable.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Normalized Laplacians for Gain Graphs | Navish Kumar',
      description:
        'A guided, computed explanation of normalized gain Laplacians, cycle balance, and spectral structure.',
      socialImage: '/social/gain-normalized.svg',
    },
  },
  {
    id: 'extremal-gain-laplacian-bounds',
    title: 'Bounds for the Extremal Eigenvalues of Gain Laplacian Matrices',
    shortTitle: 'Extremal gain-Laplacian bounds',
    date: '2021-09-15',
    dateLabel: 'September 2021',
    year: 2021,
    venue: 'Linear Algebra and its Applications 625, 212–240',
    researchStatus: 'published',
    researchStatusLabel: 'Published',
    statusNote: 'Peer-reviewed journal article published in 2021.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Full computed instrument',
    period: 'foundations',
    type: 'paper',
    coauthors: ['M. Rajesh Kannan', 'Shivaramakrishna Pragada'],
    role:
      'Co-author; contributed to the spectral bounds, frustration analysis, constructive arguments, and examples.',
    route: '/work/extremal-gain-laplacian-bounds',
    question:
      'Can the smallest and largest eigenvalues reveal how inconsistent a gain graph is?',
    explanation15:
      'Rotate one gain so a cycle no longer closes. The smallest gain-Laplacian eigenvalue leaves zero, and the paper relates that spectral signal to the edges or vertices required to restore balance.',
    explanation60: [
      'A gain graph is balanced when every cycle product equals one. Imbalance can be measured combinatorially by deleting the smallest number of edges or vertices needed to recover balance.',
      'The paper proves lower and upper bounds for extremal gain-Laplacian eigenvalues and connects the least eigenvalue to frustration number and frustration index.',
      'The live instrument lets one perturb a real graph and watch cycle defects, the matrix, eigenvalues, eigenmodes, diffusion, and the exact deletion cost change together.',
    ],
    contribution:
      'Explicit extremal spectral bounds that connect gain-graph inconsistency with frustration measures and structural repair cost.',
    evidenceAvailableNow:
      'Peer-reviewed journal article, DOI, arXiv manuscript, and the complete computed gain-graph instrument.',
    limitation:
      'A spectral certificate bounds inconsistency but does not uniquely reconstruct which edge caused it or which repair is operationally preferable.',
    relationToEarlierWork:
      'Directly extends the gain-Laplacian foundations from operator definition to extremal certificates of imbalance.',
    nextQuestion:
      'Can geometry similarly make the behaviour of a practical learning algorithm provable?',
    themes: ['spectral graph theory', 'frustration', 'eigenvalue bounds'],
    areas: ['Mathematical ML', 'Graph structure', 'Theory'],
    previewKind: 'gain-frustration',
    evidence: [
      {
        kind: 'paper',
        label: 'Journal article',
        url: 'https://doi.org/10.1016/j.laa.2021.05.009',
        public: PUBLIC,
        note: 'Published Linear Algebra and its Applications article.',
      },
      {
        kind: 'paper',
        label: 'arXiv manuscript',
        url: 'https://arxiv.org/abs/2102.07560',
        public: PUBLIC,
        note: 'Public manuscript and theorem statements.',
      },
      {
        kind: 'demo',
        label: 'Full live instrument',
        url: '/work/gain-graphs',
        public: PUBLIC,
        note: 'Computed frustration, cycles, spectrum, eigenmodes, and diffusion.',
      },
    ],
    relations: [
      {
        targetId: 'normalized-gain-laplacians',
        kind: 'direct-methodological-inheritance',
        note: 'Builds on the gain-Laplacian operator foundations.',
      },
      {
        targetId: 'square-root-natural-gradient',
        kind: 'recurring-question',
        note: 'Moves the recurring question of structural guarantees from graphs into optimization.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Extremal Gain-Laplacian Bounds | Navish Kumar',
      description:
        'A live explanation of how gain-graph frustration changes extremal Laplacian eigenvalues and repair bounds.',
      socialImage: '/social/gain-bounds.svg',
    },
  },
  {
    id: 'urban-microregion-logistics',
    title:
      'Modelling the Performance of Delivery Vehicles Across Urban Micro-Regions to Accelerate the Transition to Cargo-Bike Logistics',
    shortTitle: 'Urban micro-region logistics',
    date: '2023-01-30',
    dateLabel: 'January 2023',
    year: 2023,
    venue: 'NeurIPS 2022 Workshop on Tackling Climate Change with Machine Learning · arXiv:2301.12887',
    researchStatus: 'accepted',
    researchStatusLabel: 'Workshop paper',
    statusNote:
      'Presented in the NeurIPS 2022 climate-change workshop context and publicly available as arXiv:2301.12887.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Interactive decision model',
    period: 'foundations',
    type: 'paper',
    coauthors: [
      'Max Schrader',
      'Nicolas Collignon',
      'Esben Sørig',
      'Soonmyeong Yoon',
      'Akash Srivastava',
      'Kai Xu',
      'Maria Astefanoaei',
    ],
    role:
      'Co-author; contributed to machine-learning modelling, spatial data abstraction, and the translation from urban context to operational decisions.',
    route: '/work/urban-microregion-logistics',
    question:
      'Why can a cargo bike be the right delivery vehicle in one neighbourhood and the wrong one a few streets away?',
    explanation15:
      'The city is divided into small H3 micro-regions, local context is derived from OpenStreetMap, and service-time behaviour is modelled per region rather than hidden inside a city-wide average.',
    explanation60: [
      'A city-wide average hides parking, road, density, access, and walking conditions that determine last-mile performance.',
      'The work partitions cities into H3 hexagons, aggregates local OpenStreetMap features, and models service-time components for different vehicle types.',
      'The result is decision support: operators can compare where cargo-bike transition is plausible first. The public interface remains a scenario model and does not pretend to replace local field calibration.',
    ],
    contribution:
      'A reproducible spatial abstraction and modelling pipeline that makes cargo-bike fleet transition testable at operational micro-region scale.',
    evidenceAvailableNow:
      'Public paper, public data/code repositories, model description, and an interactive scenario surface.',
    limitation:
      'Transfer to a new city requires representative local data and calibration; the interactive scenario is explanatory, not a municipal deployment recommendation.',
    relationToEarlierWork:
      'Applies the same structure-first habit to an operational system: preserve local context instead of averaging it away.',
    nextQuestion:
      'Can optimization geometry preserve practical usefulness while also supporting guarantees?',
    themes: ['spatial modelling', 'sustainable logistics', 'decision support'],
    areas: ['Applied ML', 'Urban systems', 'Product decisions'],
    previewKind: 'urban',
    evidence: [
      {
        kind: 'paper',
        label: 'arXiv paper',
        url: 'https://arxiv.org/abs/2301.12887',
        public: PUBLIC,
        note: 'Public manuscript, data abstractions, and initial modelling results.',
      },
      {
        kind: 'repository',
        label: 'Green last mile',
        url: 'https://github.com/KumarNavish/green-last-mile',
        public: PUBLIC,
        note: 'Public project repository.',
      },
      {
        kind: 'repository',
        label: 'Hex2vec',
        url: 'https://github.com/KumarNavish/hex2vec',
        public: PUBLIC,
        note: 'Related public spatial representation work.',
      },
    ],
    relations: [
      {
        targetId: 'square-root-natural-gradient',
        kind: 'adjacent-application',
        note: 'Both ask whether modelling structure can improve decisions under practical constraints.',
      },
      {
        targetId: 'casepath',
        kind: 'recurring-question',
        note: 'Both turn structured evidence into reviewable operational choices.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Urban Micro-Region Logistics | Navish Kumar',
      description:
        'An interactive explanation of spatial service-time modelling for cargo-bike transition decisions.',
      socialImage: '/social/urban.svg',
    },
  },
  {
    id: 'square-root-natural-gradient',
    title: 'Optimization Guarantees for Square-Root Natural-Gradient Variational Inference',
    shortTitle: 'Square-root natural-gradient VI',
    date: '2025-07-10',
    dateLabel: 'July 2025',
    year: 2025,
    venue: 'arXiv:2507.07853',
    researchStatus: 'preprint',
    researchStatusLabel: 'Preprint',
    statusNote: 'Public research manuscript on arXiv; no published venue is claimed.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Full interactive chapter',
    period: 'foundations',
    type: 'paper',
    coauthors: ['Thomas Möllenhoff', 'Mohammad Emtiyaz Khan', 'Aurelien Lucchi'],
    role:
      'Lead author; developed the optimization perspective, theoretical analysis, experiments, and manuscript with collaborators.',
    route: '/work/square-root-natural-gradient',
    question:
      'Can a natural-gradient method that works well in practice acquire a rigorous convergence explanation?',
    explanation15:
      'Representing Gaussian covariance through a square-root factor changes the optimization geometry and enables convergence analysis without discarding the natural-gradient behaviour used in practice.',
    explanation60: [
      'Natural-gradient variational inference often converges quickly, but even simple Gaussian settings have resisted clean guarantees.',
      'The work uses a square-root covariance parameterization to make discrete updates and the continuous-time flow tractable under the stated concavity and smoothness assumptions.',
      'The contribution is a theory–practice bridge for a precise regime, supported by experiments comparing natural, Euclidean, and Wasserstein geometries.',
    ],
    contribution:
      'Convergence guarantees for square-root natural-gradient variational Gaussian inference and its continuous-time flow under explicit assumptions.',
    evidenceAvailableNow:
      'Public arXiv manuscript, complete theorem statements, proofs, and comparative experiments.',
    limitation:
      'The guarantees depend on the analysed variational-Gaussian setting and do not imply universal convergence for arbitrary non-convex objectives or parameterizations.',
    relationToEarlierWork:
      'Extends the portfolio’s recurring concern with geometry and guarantees from graph operators into optimization dynamics.',
    nextQuestion:
      'How should a learner choose a constrained correction when sequential updates interfere with earlier tasks?',
    themes: ['variational inference', 'natural gradients', 'optimization guarantees'],
    areas: ['Optimization', 'Bayesian ML', 'Theory'],
    previewKind: 'natural-gradient',
    evidence: [
      {
        kind: 'paper',
        label: 'arXiv manuscript',
        url: 'https://arxiv.org/abs/2507.07853',
        public: PUBLIC,
        note: 'Public paper with formal claims, assumptions, proofs, and experiments.',
      },
    ],
    relations: [
      {
        targetId: 'extremal-gain-laplacian-bounds',
        kind: 'recurring-question',
        note: 'Both use an appropriate geometry to expose a rigorous behavioural guarantee.',
      },
      {
        targetId: 'experience-replay-optimization',
        kind: 'later-extension',
        note: 'Moves from analysing one optimizer to steering constrained sequential updates.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Square-Root Natural-Gradient VI | Navish Kumar',
      description:
        'A motion-native explanation of square-root covariance geometry and natural-gradient convergence guarantees.',
      socialImage: '/social/natural-gradient.svg',
    },
  },
  {
    id: 'experience-replay-optimization',
    title: 'Experience Replay Through the Lens of Optimization',
    shortTitle: 'Experience replay as optimization',
    date: '2026-01-22',
    dateLabel: '2026 · revision in progress',
    year: 2026,
    venue: 'ICML 2026 public OpenReview record · revision for resubmission',
    researchStatus: 'under-revision',
    researchStatusLabel: 'Under revision',
    statusNote:
      'The ICML 2026 submission was rejected on 30 April 2026. The public portfolio presents the paper as under revision, not accepted or published.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Full interactive chapter',
    period: 'current',
    type: 'paper',
    coauthors: ['Aurelien Lucchi'],
    role:
      'Lead author; formulated replay as constrained correction matching, developed the diagnostics and method, and led the experimental and rebuttal work.',
    route: '/work/experience-replay-optimization',
    question:
      'Which remembered examples make the next constrained update resemble joint training?',
    explanation15:
      'The stage objective defines the correction that joint training would request. A replay subset is useful only insofar as its gradient contribution matches that target under memory and compute limits.',
    explanation60: [
      'Current-only learning improves the new task but can increase losses on earlier tasks. Replay adds old examples, yet random replay does not guarantee the right correction direction.',
      'The work derives a dense joint-training correction target, formulates replay selection as constrained subset matching, and exposes the residual mismatch at every step.',
      'Greedy Ball Replay approximates the target, but the public chapter also makes the practical boundary visible: dense gradient weighting can be simpler and stronger when its compute and memory are available, and no subset can succeed when the candidate buffer lacks the required direction.',
    ],
    contribution:
      'An optimization target for replay, a constrained subset-selection formulation, Greedy Ball Replay, and an observable residual that diagnoses when replay can and cannot realize the intended steering.',
    evidenceAvailableNow:
      'Public OpenReview submission, reviews, author responses, decision record, revised manuscript work, and a deterministic browser mechanism.',
    limitation:
      'The method does not dominate dense gradient weighting. Its usefulness depends on a genuine small-update-batch constraint and a candidate buffer that contains a representative correction direction.',
    relationToEarlierWork:
      'Applies the structure-and-diagnostics discipline of earlier theory to learning under interference and finite replay budgets.',
    nextQuestion:
      'Before searching for a correction, can we determine whether the available low-rank adaptation space contains one at all?',
    themes: ['continual learning', 'experience replay', 'gradient correction'],
    areas: ['Continual learning', 'Optimization', 'Diagnostics'],
    previewKind: 'replay',
    evidence: [
      {
        kind: 'openreview',
        label: 'Public OpenReview record',
        url: 'https://openreview.net/forum?id=4z7il66fFb',
        public: PUBLIC,
        note: 'Submission, reviews, rebuttal, final reviewer discussion, and reject decision.',
      },
    ],
    relations: [
      {
        targetId: 'square-root-natural-gradient',
        kind: 'later-extension',
        note: 'Moves from optimization geometry to constrained correction geometry.',
      },
      {
        targetId: 'rank-feasibility',
        kind: 'later-extension',
        note: 'Replay asks which examples approximate a correction; rank feasibility asks whether the adaptation space can represent one.',
      },
      {
        targetId: 'ticlm-replay-value',
        kind: 'later-extension',
        note: 'The temporal work changes the unit from examples to chronological windows and charges replay for displaced current tokens.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Experience Replay Through the Lens of Optimization | Navish Kumar',
      description:
        'A live explanation of joint-training correction, constrained replay selection, residual mismatch, and the dense-baseline boundary.',
      socialImage: '/social/replay.svg',
    },
  },
  {
    id: 'rank-feasibility',
    title: 'Rank Feasibility in Continual PEFT',
    shortTitle: 'Rank feasibility in continual PEFT',
    date: '2026-05-04',
    dateLabel: 'NeurIPS 2026 submission',
    year: 2026,
    venue: 'NeurIPS 2026 public OpenReview record',
    researchStatus: 'under-review',
    researchStatusLabel: 'Under review',
    statusNote:
      'The public OpenReview record contains reviews, meta-review, and author responses. This registry does not claim acceptance or rejection without a public final decision.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Full interactive chapter',
    period: 'current',
    type: 'paper',
    coauthors: ['Aurelien Lucchi'],
    role:
      'Lead author; developed the geometric feasibility formulation, minimum-norm correction, rank diagnostic, and empirical evaluation.',
    route: '/work/rank-feasibility',
    question:
      'Does a low-rank adapter contain any correction that improves every old task without sacrificing too much current-task progress?',
    explanation15:
      'Each LoRA rank defines an adaptation space. Old-task requirements become constraints inside that space; rank is useful only when a correction exists and its norm remains compatible with current-task preservation.',
    explanation60: [
      'A low-rank adapter restricts the directions in which a model can move. Optimizer choice cannot recover a correction that lies outside that space.',
      'The work formulates old-task improvement as linearized constraints and computes the minimum-norm correction available at each candidate rank.',
      'The first feasible rank is not automatically the usable rank: a correction may exist but be so large that it erases current-task progress. The chapter therefore separates infeasible, feasible-but-costly, and usable regions.',
    ],
    contribution:
      'A task-wise geometric feasibility test, dual certificate, and minimum-norm correction that distinguish whether a LoRA rank can support continual repair from whether it is practical to use.',
    evidenceAvailableNow:
      'Public NeurIPS 2026 OpenReview submission, reviews, meta-review, author responses, manuscript, and a deterministic rank-space instrument.',
    limitation:
      'The analysis is local and depends on representative old-task examples. Feasibility is necessary but does not guarantee finite-step optimization success, generalization, or complete restoration.',
    relationToEarlierWork:
      'Tightens the correction question exposed by replay: first test whether the constrained adaptation space contains a task-wise solution.',
    nextQuestion:
      'How should replay be valued when the candidate units are historical windows and every old token displaces current training?',
    themes: ['continual PEFT', 'LoRA rank', 'feasibility'],
    areas: ['Continual learning', 'Parameter-efficient adaptation', 'Optimization'],
    previewKind: 'rank',
    evidence: [
      {
        kind: 'openreview',
        label: 'Public OpenReview record',
        url: 'https://openreview.net/forum?id=CwmHHYCbjK',
        public: PUBLIC,
        note: 'Submission, public reviews, meta-review, and author responses.',
      },
    ],
    relations: [
      {
        targetId: 'experience-replay-optimization',
        kind: 'later-extension',
        note: 'Changes the question from selecting a correction source to testing the correction space itself.',
      },
      {
        targetId: 'ticlm-replay-value',
        kind: 'recurring-question',
        note: 'Both reject a fixed capacity choice in favour of an observable, decision-specific diagnostic.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Rank Feasibility in Continual PEFT | Navish Kumar',
      description:
        'An interactive explanation of nested LoRA spaces, task-wise correction feasibility, and usable-rank guardrails.',
      socialImage: '/social/rank.svg',
    },
  },
  {
    id: 'ticlm-replay-value',
    title: 'Counterfactual Window Replay for Time-Continual Language Model Pretraining',
    shortTitle: 'Temporal replay value for TiC-LM',
    date: '2026-06-19',
    dateLabel: 'Ongoing in 2026',
    year: 2026,
    venue: 'Ongoing research built against the public TiC-LM benchmark setting',
    researchStatus: 'ongoing',
    researchStatusLabel: 'Ongoing research',
    statusNote:
      'This is an active research programme, not a published result. Simulations on the site are labelled as such.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Interactive research simulation',
    period: 'current',
    type: 'experiment',
    coauthors: [],
    role:
      'Research lead; developing the counterfactual token-allocation objective, temporal diagnostics, and planned empirical protocol.',
    route: '/work/ticlm-replay-value',
    question:
      'Which historical windows improve the next temporal regret row enough to justify the current tokens they replace?',
    explanation15:
      'Replay is not free: under a fixed token budget, every historical token removes a current token. An old window deserves replay only when its predicted backward benefit remains positive after current and forward costs.',
    explanation60: [
      'Time-continual pretraining receives chronological data windows. Fixed replay ratios treat old data as free augmentation even though replay consumes the same finite token budget as current learning.',
      'The ongoing method defines a counterfactual replacement value for each historical window over backward, current, and forward parts of the TiC-LM regret row.',
      'A conservative allocation penalizes uncertainty and allows zero replay when all old windows have non-positive value. Stable and fast-evolving domains should emerge as observable replay-value curves rather than assumed labels.',
    ],
    contribution:
      'An ongoing counterfactual formulation of historical-window replay value that charges replay for displaced current tokens and preserves backward, current, and forward effects until the allocation decision.',
    evidenceAvailableNow:
      'A public benchmark context, a frozen ongoing-method specification, falsifiable predictions, and a transparent browser simulation—not yet completed large-scale empirical results.',
    limitation:
      'The local replay-value estimator and allocation policy remain hypotheses until prospective TiC-LM experiments validate regret-row predictions under matched token budgets.',
    relationToEarlierWork:
      'Extends replay optimization from selecting examples to valuing chronological windows under explicit displacement cost.',
    nextQuestion:
      'How can uncertain model interpretations be admitted into long-horizon actions only when source evidence and deterministic obligations permit them?',
    themes: ['time-continual pretraining', 'temporal regret', 'replay value'],
    areas: ['Continual language models', 'Decision under uncertainty', 'Evaluation'],
    previewKind: 'temporal',
    evidence: [
      {
        kind: 'context',
        label: 'TiC-LM benchmark context',
        url: 'https://github.com/apple/ml-tic-lm',
        public: PUBLIC,
        note: 'Public benchmark implementation used as context; this repository is not Navish’s authorship claim.',
      },
    ],
    relations: [
      {
        targetId: 'experience-replay-optimization',
        kind: 'later-extension',
        note: 'Replaces per-example correction matching with temporal-window counterfactual value.',
      },
      {
        targetId: 'rank-feasibility',
        kind: 'recurring-question',
        note: 'Both seek a diagnostic that can reject an intervention before spending the full adaptation budget.',
      },
      {
        targetId: 'casepath',
        kind: 'later-extension',
        note: 'Moves from model-update allocation to evidence-grounded action admission under changing information.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Temporal Replay Value for TiC-LM | Navish Kumar',
      description:
        'An ongoing, explicitly labelled simulation of historical-window value under fixed-token time-continual pretraining.',
      socialImage: '/social/ticlm.svg',
    },
  },
  {
    id: 'casepath',
    title: 'CasePath: Evidence-Grounded Claim Handling',
    shortTitle: 'CasePath',
    date: '2026-08-15',
    dateLabel: 'Active system · 2026',
    year: 2026,
    venue: 'Open system and research prototype',
    researchStatus: 'prototype',
    researchStatusLabel: 'System prototype',
    statusNote:
      'A working evidence-grounded claim-handling system and research substrate; method and benchmark claims remain under active development.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Interactive system chapter',
    period: 'current',
    type: 'system',
    coauthors: [],
    role:
      'Product and research lead; designed the interaction model, deterministic authority boundaries, typed process-evidence substrate, verification, replay, and deployment architecture.',
    route: '/systems/casepath',
    question:
      'How can fallible model interpretations become long-horizon actions without hiding missing evidence, conflicts, authority, or correction dependencies?',
    explanation15:
      'Models may propose bounded interpretations and actions, but deterministic gates compute obligations, admissible actions, provenance, and accept/hold/refuse certificates before the system can act.',
    explanation60: [
      'Operational claims begin as observable sources, not as a model-authored narrative. CasePath extracts bounded assertions with provenance and compiles them into a typed process–evidence graph.',
      'A deterministic kernel tracks unresolved obligations, admissible actions, correction dependencies, and exact accept, hold, or refuse certificates. The model proposes; the kernel retains authority.',
      'Every accepted action produces replayable evidence and process state, so later review or correction can propagate to dependent decisions without rewriting history invisibly.',
    ],
    contribution:
      'A product and systems architecture that separates model interpretation from deterministic authority through typed obligations, evidence provenance, proof-carrying action admission, replay, and scoped correction.',
    evidenceAvailableNow:
      'A deployed interactive system, public source tree, deterministic release tests, process-evidence architecture, and browser-verifiable workflows.',
    limitation:
      'The product substrate is real, but a genuinely non-reducible agentic learning method and scalable benchmark claim remain active research questions rather than settled achievements.',
    relationToEarlierWork:
      'Generalizes the portfolio’s recurring pattern—formal object, observable diagnostic, constrained intervention, explicit boundary—from model updates to agent actions.',
    nextQuestion:
      'What should intelligent systems become when language can edit a persistent world and agents can act inside it?',
    themes: ['evidence-grounded agents', 'deterministic gates', 'provenance'],
    areas: ['Agent systems', 'Product engineering', 'Insurance workflows'],
    previewKind: 'casepath',
    evidence: [
      {
        kind: 'demo',
        label: 'CasePath live application',
        url: '/casepath/',
        public: PUBLIC,
        note: 'Public deployed claim-handling experience.',
      },
      {
        kind: 'repository',
        label: 'Portfolio and CasePath source',
        url: 'https://github.com/KumarNavish/KumarNavish.github.io',
        public: PUBLIC,
        note: 'Public source, workflows, tests, and deployment history.',
      },
    ],
    relations: [
      {
        targetId: 'ticlm-replay-value',
        kind: 'later-extension',
        note: 'Both control long-horizon change with observable evidence, but CasePath governs actions rather than token allocation.',
      },
      {
        targetId: 'spatial-intelligence',
        kind: 'later-extension',
        note: 'Persistent provenance and world state become prerequisites for situated agents that can act safely.',
      },
      {
        targetId: 'counterspeech-dynamics',
        kind: 'recurring-question',
        note: 'Both separate empirical observations from intervention authority.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'CasePath: Evidence-Grounded Claim Handling | Navish Kumar',
      description:
        'A live systems chapter showing bounded model interpretation, deterministic gates, provenance, replay, and reviewable action decisions.',
      socialImage: '/social/casepath.svg',
    },
  },
  {
    id: 'spatial-intelligence',
    title: 'Language to Persistent Worlds',
    shortTitle: 'Generative AI × spatial computing',
    date: '2026-08-30',
    dateLabel: 'Frontier direction · 2026',
    year: 2026,
    venue: 'Live browser prototype and frontier research direction',
    researchStatus: 'direction',
    researchStatusLabel: 'Frontier direction',
    statusNote:
      'A working deterministic speech-to-scene prototype that demonstrates the interaction thesis; no claim of unconstrained generative 3D or embodied-agent research result.',
    experienceStatus: 'full-interactive-chapter',
    experienceStatusLabel: 'Live speech-to-scene laboratory',
    period: 'frontier',
    type: 'direction',
    coauthors: [],
    role:
      'Product and research direction; designed and implemented the persistent language-to-world interaction, typed scene state, direct manipulation, and situated action loop.',
    route: '/frontier/spatial-intelligence',
    question:
      'What changes when language edits an inhabited environment instead of producing disconnected outputs?',
    explanation15:
      'Speech or text becomes visible intent, entities, relations, world state, and an agent plan. Follow-up commands edit the same scene, so the world accumulates history rather than resetting.',
    explanation60: [
      'Most generative interfaces return a disposable answer or image. Spatial intelligence requires a persistent state that can be inspected, edited, and acted on over time.',
      'The prototype exposes the entire compilation path: transcript, deterministic local interpretation, entities, spatial relations, scene graph, rendered 2.5D environment, agent plan, and tool action.',
      'Follow-up commands produce explicit state diffs, direct manipulation changes the same world, and a non-WebGL renderer keeps the thesis accessible. The parser is labelled honestly and can later be replaced by a learned model without changing the state contract.',
    ],
    contribution:
      'A live interaction thesis and architecture for persistent language-to-world interfaces: visible interpretation, typed world state, incremental edits, direct spatial manipulation, and situated agent action.',
    evidenceAvailableNow:
      'A browser-native speech/text prototype, deterministic parser tests, persistent command history, world-state inspection, and accessible 2.5D fallback.',
    limitation:
      'This is a deterministic semantic prototype, not a foundation model, physical simulator, generative asset system, embodied policy, or immersive 6DoF application.',
    relationToEarlierWork:
      'Extends evidence, state, correction, and action from CasePath into persistent spatial environments.',
    nextQuestion:
      'How can learned interpretation, simulation, tools, and embodied policies be composed without losing inspectable state or correction?',
    themes: ['spatial computing', 'persistent worlds', 'situated agents'],
    areas: ['Human–AI interaction', 'Generative interfaces', 'Embodied systems'],
    previewKind: 'spatial',
    evidence: [
      {
        kind: 'demo',
        label: 'Live speech-to-scene lab',
        url: '/frontier/spatial-intelligence',
        public: PUBLIC,
        note: 'Public browser prototype with typed fallback and persistent state.',
      },
    ],
    relations: [
      {
        targetId: 'casepath',
        kind: 'later-extension',
        note: 'Carries persistent state, provenance, correction, and situated action into a spatial interface.',
      },
      {
        targetId: 'urban-microregion-logistics',
        kind: 'adjacent-application',
        note: 'Both treat space as operational state rather than decorative context.',
      },
    ],
    updatedAt: '2026-08-31',
    metadata: {
      title: 'Language to Persistent Worlds | Navish Kumar',
      description:
        'A live speech-to-scene laboratory for visible intent, persistent world state, direct edits, and situated agent action.',
      socialImage: '/social/spatial.svg',
    },
  },
]

export const WORK_BY_ID = new Map(WORK_REGISTRY.map((work) => [work.id, work]))
export const WORK_BY_ROUTE = new Map(WORK_REGISTRY.map((work) => [work.route, work]))

export function getWork(id: string): WorkRegistryEntry {
  const work = WORK_BY_ID.get(id)
  if (!work) throw new Error(`Unknown work registry id: ${id}`)
  return work
}

export function getWorksByPeriod(period: WorkPeriod): WorkRegistryEntry[] {
  return WORK_REGISTRY.filter((work) => work.period === period).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

export function getRelatedWorks(work: WorkRegistryEntry): WorkRegistryEntry[] {
  return work.relations
    .map((relation) => WORK_BY_ID.get(relation.targetId))
    .filter((candidate): candidate is WorkRegistryEntry => Boolean(candidate))
}

export function statusClass(status: ResearchStatus): string {
  return `status-${status.replace(/[^a-z-]/g, '')}`
}
