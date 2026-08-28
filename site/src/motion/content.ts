export type ChapterId =
  | 'entry'
  | 'graph'
  | 'replay'
  | 'rank'
  | 'temporal'
  | 'casepath'
  | 'spatial'
  | 'atlas'
  | 'contact'

export type StageId =
  | 'question'
  | 'mechanism'
  | 'intervention'
  | 'consequence'
  | 'evidence'
  | 'boundary'
  | 'continuation'

export interface ChapterStage {
  id: StageId
  label: string
  title: string
  body: string
}

export interface ChapterDefinition {
  id: ChapterId
  index: string
  shortTitle: string
  title: string
  question: string
  accent: string
  status: string
  stages: ChapterStage[]
}

export interface EvidenceRecord {
  id: string
  chapter: ChapterId
  label: string
  claim: string
  supports: string
  boundary: string
  status: 'published' | 'submitted' | 'ongoing' | 'deployed'
  sources: Array<{ label: string; href: string }>
}

const stage = (
  id: StageId,
  label: string,
  title: string,
  body: string,
): ChapterStage => ({ id, label, title, body })

export const CHAPTERS: ChapterDefinition[] = [
  {
    id: 'graph',
    index: '01',
    shortTitle: 'Graph structure',
    title: 'When does a graph operator preserve the structure that matters?',
    question:
      'A graph Laplacian turns local relations into a global operator. Normalization and signed structure change what its spectrum means.',
    accent: '#79d8f2',
    status: 'Published foundations · 2020–2021',
    stages: [
      stage(
        'question',
        'Question',
        'How should unequal degree and signed relations enter the operator?',
        'Raw adjacency mixes topology, degree, and sign. The first task is to expose those ingredients rather than hide them in a static matrix.',
      ),
      stage(
        'mechanism',
        'Mechanism',
        'The Laplacian converts edge disagreement into spectral energy.',
        'Each edge contributes a local penalty. Their sum creates eigenmodes ordered from structurally smooth to rapidly varying.',
      ),
      stage(
        'intervention',
        'Intervention',
        'Normalize by degree, or change an edge sign, and recompute the operator.',
        'The visualization runs the actual signed combinatorial or normalized Laplacian and diagonalizes the resulting symmetric matrix.',
      ),
      stage(
        'consequence',
        'Observable consequence',
        'Diffusion suppresses high-energy modes at rates set by their eigenvalues.',
        'Move time forward: every coefficient decays by exp(−tλ). Flip a relation and the smooth modes reorganize immediately.',
      ),
      stage(
        'evidence',
        'Evidence',
        'The operator-level foundations lead to explicit spectral statements.',
        'The linked papers define normalized gain Laplacians and derive extremal eigenvalue bounds tied to graph imbalance.',
      ),
      stage(
        'boundary',
        'Boundary',
        'A spectral picture is not an automatic downstream learning guarantee.',
        'The live graph explains the operator faithfully; it does not claim that a particular graph-learning model inherits every property.',
      ),
      stage(
        'continuation',
        'Next question',
        'Can the same structural discipline guide learning updates?',
        'The portfolio moves from operators on graphs to operators on learning trajectories: first define the desired behavior, then inspect whether the available update can realize it.',
      ),
    ],
  },
  {
    id: 'replay',
    index: '02',
    shortTitle: 'Replay geometry',
    title: 'Which memories make the next update resemble joint training?',
    question:
      'Replay is useful only when a constrained subset can supply the correction missing from the current-task gradient.',
    accent: '#d6aa6d',
    status: 'Under revision · public review record',
    stages: [
      stage(
        'question',
        'Question',
        'What should a replay batch actually accomplish?',
        'Current-only learning moves in one direction; joint training would move in another. Replay must account for the difference under a fixed batch budget.',
      ),
      stage(
        'mechanism',
        'Mechanism',
        'The stage objective defines a replay-gradient target.',
        'The dense target is derived exactly from the current and desired gradients. Candidate examples become vectors that may or may not approximate it.',
      ),
      stage(
        'intervention',
        'Intervention',
        'Select the subset that minimizes the corrected-update residual.',
        'Greedy selection adds one candidate at a time; exact selection enumerates every subset in this small instrument; the random control uses a locked seed.',
      ),
      stage(
        'consequence',
        'Observable consequence',
        'A useful subset rotates the realized update toward the target.',
        'Increase the replay budget or change α. The visible residual is computed from the resulting mean gradient, not animated by hand.',
      ),
      stage(
        'evidence',
        'Evidence',
        'Locked paired experiments test outcomes beyond the mismatch objective.',
        'The monograph exposes the public paper, review discussion, ablations, outcome intervals, and the dense-reference challenge.',
      ),
      stage(
        'boundary',
        'Boundary',
        'Subset selection must earn its machinery against dense replay.',
        'The visualization does not erase the central criticism: when the dense candidate mean is affordable, a simpler weighted update can be stronger.',
      ),
      stage(
        'continuation',
        'Next question',
        'When does a restricted update space contain any acceptable correction?',
        'That shifts the problem from selecting examples to testing whether the parameter subspace itself can satisfy all required constraints.',
      ),
    ],
  },
  {
    id: 'rank',
    index: '03',
    shortTitle: 'Rank feasibility',
    title: 'When is a low-rank correction possible—and when is it usable?',
    question:
      'Increasing LoRA rank helps only if the enlarged subspace contains a low-norm correction that improves every old task without sacrificing the current one.',
    accent: '#a995f4',
    status: 'NeurIPS 2026 submission · public discussion',
    stages: [
      stage(
        'question',
        'Question',
        'Does the adapter subspace contain the correction the checkpoint needs?',
        'Old-task gaps become linear constraints after the current-task update. Rank limits the directions available to satisfy them.',
      ),
      stage(
        'mechanism',
        'Mechanism',
        'Each rank creates a nested correction space.',
        'The solver projects every old-task constraint into that space and enumerates active sets to find the minimum-norm feasible correction.',
      ),
      stage(
        'intervention',
        'Intervention',
        'Expand rank until a correction exists.',
        'Rank changes the basis, not a decorative radius. The feasibility state is recomputed from the constraints after every change.',
      ),
      stage(
        'consequence',
        'Observable consequence',
        'Feasible does not mean practically usable.',
        'A correction can satisfy every old task yet exceed the norm budget or damage current-task progress. Both thresholds remain visible.',
      ),
      stage(
        'evidence',
        'Evidence',
        'Held-out evaluation tests whether the local correction works beyond the linear model.',
        'The linked discussion shows ranks that are infeasible, ranks that exist but lose too much progress, and the first tested rank that passes both checks.',
      ),
      stage(
        'boundary',
        'Boundary',
        'Local feasibility is not a global training or generalization theorem.',
        'The method requires representative old-task information at the checkpoint and empirical validation after constructing the correction.',
      ),
      stage(
        'continuation',
        'Next question',
        'How should limited training tokens be allocated across time?',
        'The next chapter moves from parameter-space constraints to temporal data allocation, where every replay token displaces current learning.',
      ),
    ],
  },
  {
    id: 'temporal',
    index: '04',
    shortTitle: 'Temporal replay',
    title: 'Which historical windows still deserve current training tokens?',
    question:
      'In time-continual pretraining, replay is replacement rather than free augmentation. Old data should be used only while its row-level value remains positive.',
    accent: '#74d5ad',
    status: 'Ongoing TiC-LM research',
    stages: [
      stage(
        'question',
        'Question',
        'Should the next token come from history or the current window?',
        'A fixed token budget makes replay a counterfactual choice. Backward retention alone cannot price the current and forward costs.',
      ),
      stage(
        'mechanism',
        'Mechanism',
        'Each historical window receives a conservative temporal value.',
        'Value combines decayed backward benefit, current adaptation cost, forward interference, and uncertainty.',
      ),
      stage(
        'intervention',
        'Intervention',
        'Allocate only to windows whose conservative value is positive.',
        'The controller distributes the requested replay budget over positive-value windows and returns a no-replay solution when none qualify.',
      ),
      stage(
        'consequence',
        'Observable consequence',
        'Stable history can remain useful; stale history can become actively harmful.',
        'Change volatility and half-life. The allocation and the backward/current/forward regions of the regret row update together.',
      ),
      stage(
        'evidence',
        'Evidence',
        'The chapter makes falsifiable regret-matrix predictions.',
        'This is an ongoing research instrument: it exposes the current formal model and experimental targets without presenting simulated values as completed results.',
      ),
      stage(
        'boundary',
        'Boundary',
        'A local value estimate can be wrong under nonlinear training dynamics.',
        'Uncertainty penalties and held-out regret rows are required; the current instrument is a transparent hypothesis generator, not a reported benchmark result.',
      ),
      stage(
        'continuation',
        'Next question',
        'How should evidence move through a high-stakes agentic workflow?',
        'Temporal adaptation establishes the need for bounded, observable decisions. CasePath makes that discipline explicit at the system level.',
      ),
    ],
  },
  {
    id: 'casepath',
    index: '05',
    shortTitle: 'Bounded agents',
    title: 'Can an agent build a decision artifact without hiding its evidence chain?',
    question:
      'CasePath turns source material into reviewable process artifacts through bounded extraction, deterministic gates, typed state, and fail-closed execution.',
    accent: '#f08c78',
    status: 'Deployed system · active research platform',
    stages: [
      stage(
        'question',
        'Question',
        'What must remain inspectable when an agent reasons over documents?',
        'A fluent answer is insufficient. Source authority, document completeness, claim support, process coverage, and failure must remain visible.',
      ),
      stage(
        'mechanism',
        'Mechanism',
        'Evidence enters a deterministic gate sequence.',
        'Relevant sources are bounded, facts are extracted, and downstream construction remains blocked until authority, integrity, evidence, and whole-playbook gates pass.',
      ),
      stage(
        'intervention',
        'Intervention',
        'Make gates first-class product state.',
        'Toggle the source conditions. The workflow stops at the exact failed gate rather than allowing the model to improvise a plausible artifact.',
      ),
      stage(
        'consequence',
        'Observable consequence',
        'The final decision artifact exists only when the evidence chain is complete.',
        'Passing sources produce canonical facts, a process map, an evidence checklist, and a reviewable claim brief. Failure preserves the audit state.',
      ),
      stage(
        'evidence',
        'Evidence',
        'The deployed product exposes source, build, document, and check surfaces.',
        'The chapter links the live system and repository while the instrument demonstrates the deterministic core independently of any model provider.',
      ),
      stage(
        'boundary',
        'Boundary',
        'Deterministic gates do not make extracted facts automatically correct.',
        'Authority rules, source coverage, extraction quality, and domain scope still require explicit evaluation and governance.',
      ),
      stage(
        'continuation',
        'Next question',
        'What happens when the interface itself becomes a persistent environment?',
        'The final mechanism moves beyond chat: language specifies a world whose structure, tools, agents, and evidence remain spatially present.',
      ),
    ],
  },
  {
    id: 'spatial',
    index: '06',
    shortTitle: 'Spatial intelligence',
    title: 'What if language produced a persistent environment rather than another answer?',
    question:
      'Generative intelligence can become a spatial medium: intent is compiled into entities, relations, tools, situated agents, and a world state that can be inspected and changed.',
    accent: '#6fc6ff',
    status: 'Ongoing prototype direction',
    stages: [
      stage(
        'question',
        'Question',
        'How can an intelligent interface preserve context beyond a chat transcript?',
        'A spatial environment can keep questions, evidence, tools, and agents present at once, with location carrying meaning.',
      ),
      stage(
        'mechanism',
        'Mechanism',
        'Compile intent into a typed world plan.',
        'The local compiler extracts an objective, environment, entities, relations, and affordances using deterministic rules so the transformation remains inspectable.',
      ),
      stage(
        'intervention',
        'Intervention',
        'Turn the plan into a manipulable persistent scene.',
        'Edit the intent or information density. The world restructures while preserving semantic identities and explicit relations.',
      ),
      stage(
        'consequence',
        'Observable consequence',
        'The interface becomes a place for action, not a rendered illustration.',
        'Select an entity to reveal its role, move between overview and expert density, and inspect how evidence constrains competing questions.',
      ),
      stage(
        'evidence',
        'Evidence',
        'This chapter is a working interface thesis, not a claim of solved world generation.',
        'It demonstrates the durable interaction architecture locally; future model and rendering systems can improve without replacing the semantic harness.',
      ),
      stage(
        'boundary',
        'Boundary',
        'Semantic compilation is only one layer of a credible spatial system.',
        'High-quality assets, physics, embodiment, agent reliability, latency, and evaluation remain open engineering and research problems.',
      ),
      stage(
        'continuation',
        'Continuation',
        'The portfolio resolves into one question-driven atlas.',
        'Across graphs, replay, rank, time, agents, and space, the same standard recurs: make the desired behavior explicit, expose the available structure, and keep evidence attached to action.',
      ),
    ],
  },
]

export const EVIDENCE: EvidenceRecord[] = [
  {
    id: 'graph-normalized',
    chapter: 'graph',
    label: 'Normalized Laplacians for gain graphs',
    claim: 'Defines normalized Laplacians for gain graphs and studies balance, bipartiteness, spectrum, bounds, and interlacing.',
    supports: 'The operator and spectral relationships presented in the graph chapter.',
    boundary: 'Does not establish downstream neural-network performance guarantees.',
    status: 'published',
    sources: [
      { label: 'arXiv paper', href: 'https://arxiv.org/abs/2009.13788' },
    ],
  },
  {
    id: 'graph-extremal',
    chapter: 'graph',
    label: 'Extremal eigenvalue bounds',
    claim: 'Relates frustration measures to bounds on extremal eigenvalues of gain Laplacian matrices.',
    supports: 'The connection between signed imbalance and spectral quantities.',
    boundary: 'The live graph is an explanatory computation, not a reproduction of every theorem case.',
    status: 'published',
    sources: [
      {
        label: 'Linear Algebra and its Applications',
        href: 'https://www.sciencedirect.com/science/article/pii/S0024379521002111',
      },
    ],
  },
  {
    id: 'replay-openreview',
    chapter: 'replay',
    label: 'Experience Replay Through the Lens of Optimization',
    claim: 'Formulates replay as constrained correction matching and introduces Greedy Ball Replay with an observable residual.',
    supports: 'The target identity, subset-selection problem, public reviews, rebuttal evidence, and scientific boundary.',
    boundary: 'The ICML 2026 submission was rejected; dense gradient weighting remains a decisive comparison.',
    status: 'submitted',
    sources: [
      { label: 'OpenReview discussion', href: 'https://openreview.net/forum?id=4z7il66fFb' },
      { label: 'Paper PDF', href: 'https://openreview.net/pdf?id=4z7il66fFb' },
    ],
  },
  {
    id: 'rank-openreview',
    chapter: 'rank',
    label: 'Rank Feasibility in Continual PEFT',
    claim: 'Tests whether a rank-restricted adapter admits a minimum-norm correction satisfying task-wise constraints.',
    supports: 'The nested-space feasibility formulation and the distinction between existence and practical usability.',
    boundary: 'Local linear feasibility requires held-out empirical validation and representative old-task data.',
    status: 'submitted',
    sources: [
      { label: 'OpenReview discussion', href: 'https://openreview.net/forum?id=CwmHHYCbjK' },
      { label: 'Paper PDF', href: 'https://openreview.net/pdf?id=CwmHHYCbjK' },
    ],
  },
  {
    id: 'ticlm-ongoing',
    chapter: 'temporal',
    label: 'Counterfactual window replay for TiC-LM',
    claim: 'Ongoing work values historical windows by the regret-row improvement they provide relative to displaced current tokens.',
    supports: 'The research question, formal allocation object, and falsifiable backward/current/forward predictions.',
    boundary: 'The interactive values are transparent simulations; they are not presented as completed experimental results.',
    status: 'ongoing',
    sources: [
      { label: 'TiC-LM benchmark implementation', href: 'https://github.com/apple/ml-tic-lm' },
    ],
  },
  {
    id: 'casepath-live',
    chapter: 'casepath',
    label: 'CasePath',
    claim: 'A deployed, gated agentic workspace exposes sources, construction, documents, checks, and auditable run state.',
    supports: 'The product architecture and deterministic fail-closed design demonstrated in the chapter.',
    boundary: 'The local gate instrument abstracts the deployed runtime and does not substitute for domain evaluation.',
    status: 'deployed',
    sources: [
      { label: 'Live CasePath workspace', href: 'https://casepath.kumarnavish.chatgpt.site/' },
      { label: 'Portfolio and deployment repository', href: 'https://github.com/KumarNavish/KumarNavish.github.io' },
    ],
  },
  {
    id: 'spatial-prototype',
    chapter: 'spatial',
    label: 'Generative spatial intelligence direction',
    claim: 'A model-agnostic semantic harness can compile intent into persistent entities, relations, tools, and interaction affordances.',
    supports: 'The working local compiler and product thesis shown in the spatial chapter.',
    boundary: 'This does not claim photorealistic world generation, robust embodied agents, or completed VR evaluation.',
    status: 'ongoing',
    sources: [],
  },
]

export function chapterById(id: ChapterId): ChapterDefinition | undefined {
  return CHAPTERS.find((chapter) => chapter.id === id)
}

export function evidenceById(id: string): EvidenceRecord | undefined {
  return EVIDENCE.find((record) => record.id === id)
}
