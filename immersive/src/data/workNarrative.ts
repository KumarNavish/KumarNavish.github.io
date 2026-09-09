export type WorkNarrative = {
  mechanism: string;
  observableConsequence: string;
  realWorldImplication: string;
  physicalExample: string;
  predecessorIds: string[];
  successorIds: string[];
  currentExperiment?: string;
};

export const WORK_NARRATIVE: Record<string, WorkNarrative> = {
  "counterspeech-dynamics": {
    mechanism: "Pair hate and counter users, then measure network, activity, and language asymmetries instead of treating posts as isolated labels.",
    observableConsequence: "The same platform population separates into visibly different interaction and linguistic signatures under several descriptive lenses.",
    realWorldImplication: "Intervention design should begin from how people actually interact, not from the assumption that every harmful or protective message is an independent event.",
    physicalExample: "Follow two groups through the same conversation network and watch aggregate differences emerge from individual replies.",
    predecessorIds: [],
    successorIds: ["normalized-gain-laplacians", "casepath"],
  },
  "normalized-gain-laplacians": {
    mechanism: "Attach unit-complex gains to oriented edges, test cycle products for balance, and encode the structure in a Hermitian normalized Laplacian.",
    observableConsequence: "Rotating one local phase can break cycle closure, change the gain Laplacian, and move the spectrum of the whole graph.",
    realWorldImplication: "Locally reasonable pairwise relationships can become mutually inconsistent around a loop; the operator makes that global incompatibility measurable.",
    physicalExample: "Change one relationship in a six-node network and watch the affected cycles and least eigenvalue respond.",
    predecessorIds: ["counterspeech-dynamics"],
    successorIds: ["extremal-gain-laplacian-bounds"],
  },
  "extremal-gain-laplacian-bounds": {
    mechanism: "Relate extremal gain-Laplacian eigenvalues to frustration: the minimum structural repair needed to restore balance.",
    observableConsequence: "A local phase defect lifts the least eigenvalue from zero; deleting a sufficient defective relation restores balance in the finite example.",
    realWorldImplication: "A global spectral signal can certify that a network cannot satisfy all local relationships simultaneously, even when it does not identify one unique repair.",
    physicalExample: "Break one cycle, compare spectral movement with exact repair cost, then remove the defective edge and recompute.",
    predecessorIds: ["normalized-gain-laplacians"],
    successorIds: ["square-root-natural-gradient"],
  },
  "urban-microregion-logistics": {
    mechanism: "Preserve neighborhood-scale context with H3 cells and model delivery service-time components by vehicle and location.",
    observableConsequence: "Changing local parking, access, walking distance, or density can reverse which vehicle has the lower service time between neighboring regions.",
    realWorldImplication: "A city-wide average can hide the operational conditions that determine whether a cargo bike or van is the better local choice.",
    physicalExample: "Run the same delivery through two nearby cells and decompose travel, parking, walking, and unloading time.",
    predecessorIds: ["counterspeech-dynamics"],
    successorIds: ["spatial-intelligence"],
  },
  "square-root-natural-gradient": {
    mechanism: "Represent Gaussian covariance through a square-root factor so natural-gradient dynamics become analytically tractable under explicit assumptions.",
    observableConsequence: "The same target produces different optimization trajectories under Euclidean and distribution-aware geometry, while the theorem boundary remains explicit.",
    realWorldImplication: "The representation of uncertainty changes how learning moves and can determine whether useful behavior is merely observed or can be proved in a stated regime.",
    physicalExample: "Move the same Gaussian approximation toward one anisotropic target using different geometries and compare the paths.",
    predecessorIds: ["extremal-gain-laplacian-bounds"],
    successorIds: ["experience-replay-optimization"],
  },
  "experience-replay-optimization": {
    mechanism: "Treat joint training as an unavailable target update and choose replay memories whose aggregate gradients approximate the missing correction under a memory budget.",
    observableConsequence: "Current-only learning improves the new task while old loss rises; selected memories redirect the update toward joint training and the residual exposes the remaining mismatch.",
    realWorldImplication: "A deployed learner should remember examples because their update counteracts destructive change, not simply because those examples are old or individually relevant.",
    physicalExample: "Let a new-task update damage an old task, reveal the missing joint correction, then build a replay correction from candidate memories.",
    predecessorIds: ["square-root-natural-gradient"],
    successorIds: ["rank-feasibility", "ticlm-replay-value"],
    currentExperiment: "Compare constrained replay selection with dense weighting and expose buffers whose candidate directions cannot represent the target correction.",
  },
  "rank-feasibility": {
    mechanism: "Project old-task repair constraints into nested low-rank correction spaces and solve a minimum-norm feasibility problem at each rank.",
    observableConsequence: "A correction can be impossible at low rank, become feasible as the space expands, and still remain unusable if its minimum-norm move exceeds a current-task budget.",
    realWorldImplication: "Training can fail because the model was not given enough freedom to express the required repair—not only because an optimizer searched badly.",
    physicalExample: "Expand a correction space from a line to higher-dimensional regions until all constraints intersect inside an allowed update budget.",
    predecessorIds: ["experience-replay-optimization"],
    successorIds: ["ticlm-replay-value"],
    currentExperiment: "Test whether local feasibility certificates predict held-out behavior better than simpler rank-search baselines under matched budgets.",
  },
  "ticlm-replay-value": {
    mechanism: "Value each historical window counterfactually against the current tokens it displaces under a fixed training budget.",
    observableConsequence: "The same old data can protect past performance in a stable regime yet become net harmful as temporal shift makes present or forward adaptation more valuable.",
    realWorldImplication: "Remembering the past is valuable only while that past remains relevant enough to justify what the learner gives up in the present.",
    physicalExample: "Advance time, swap old tokens into a fixed budget, and watch backward, current, and forward effects change with staleness.",
    predecessorIds: ["experience-replay-optimization", "rank-feasibility"],
    successorIds: ["casepath"],
    currentExperiment: "Prospectively compare predicted historical-window value with realized next-row temporal-regret changes under matched token budgets.",
  },
  casepath: {
    mechanism: "Separate source-grounded assertions and model interpretations from deterministic obligations, action admission, correction dependencies, and provenance.",
    observableConsequence: "Conflicting sources produce HOLD rather than a fluent completion; an authoritative correction supersedes one fact and only dependent state is replayed before review becomes admissible.",
    realWorldImplication: "A plausible answer is not permission to act. Operational authority should come from explicit evidence and process obligations, not model confidence.",
    physicalExample: "Give two records different inspection dates, watch the action gate refuse progress, then apply a superseding source and replay only what depends on it.",
    predecessorIds: ["ticlm-replay-value", "counterspeech-dynamics"],
    successorIds: ["spatial-intelligence"],
    currentExperiment: "Turn the synthetic conflict demonstration into a genuine intake-driven workflow and validate refusal/correction behavior before claiming production readiness.",
  },
  "spatial-intelligence": {
    mechanism: "Compile language into typed objects, relations, world coordinates, revision history, and a bounded situated-agent goal inside one persistent world state.",
    observableConsequence: "A follow-up command moves or adds objects without regenerating the scene; unaffected identities persist, relations update, lighting changes, and the agent acts on the current revision.",
    realWorldImplication: "Language becomes more useful as an interface when it edits an inspectable world that survives the next instruction instead of producing disconnected outputs.",
    physicalExample: "Create a mountain laboratory, move the same microscope beside a window, add a sample, change the light, and ask an agent to approach it.",
    predecessorIds: ["casepath", "urban-microregion-logistics"],
    successorIds: [],
    currentExperiment: "Extend the deterministic semantic-world prototype toward richer spatial assets, explicit relation constraints, tool use, and situated interaction without hiding state or authority boundaries.",
  },
};

export const narrativeFor = (id: string) => WORK_NARRATIVE[id];
