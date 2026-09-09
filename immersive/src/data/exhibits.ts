import { WORK_REGISTRY, type WorkRegistryEntry } from './legacyRegistry';
import type { ScienceKind } from '../engine/scientificModels';
export type Step={title:string;body:string;notice:string};
export type Exhibit={work:WorkRegistryEntry;kind:ScienceKind;name:string;question:string;steps:Step[];primaryLabel:string;min:number;max:number;initial:number;secondary:number;unit:string;formula:string;modelNote:string};
const step=(title:string,body:string,notice:string):Step=>({title,body,notice});
const byId=(id:string)=>WORK_REGISTRY.find(w=>w.id===id)!;
const entry=(id:string,details:Omit<Exhibit,'work'>):Exhibit=>({work:byId(id),...details});
export const EXHIBITS:Exhibit[]=[
 entry('counterspeech-dynamics',{
  kind:'network',name:'Interaction dynamics',question:'What does an isolated message leave out?',primaryLabel:'Network lens',min:0,max:4,initial:2,secondary:0,unit:'',
  formula:'Paired users → interaction structure → group-level descriptive measurements',
  modelNote:'Synthetic network, not the paper’s dataset. No causal moderation claim is made.',
  steps:[
   step('Start with the people, not just the posts.','The paper pairs users producing hate with users responding through counterspeech. A message is part of an interaction, not an isolated observation.','Each node represents an anonymous user in a synthetic example.'),
   step('Follow the replies.','Connections reveal who responds to whom. Different interaction patterns can disappear when all users are averaged together.','Cross-group links expose the relationships that a text-only view misses.'),
   step('Change the measurement lens.','The research compares activity, language, popularity, and response patterns across paired groups.','The height change illustrates measuring the same network in another way.'),
   step('Make the empirical contribution explicit.','The contribution is a paired-account dataset and an analysis of observed asymmetries, with collaborators.','The published analysis—not this synthetic graph—is the evidence.'),
   step('Observation is not intervention.','Describing a pattern does not establish that a particular response will reduce harm.','No automatic moderation or causal effectiveness is inferred.')
  ]}),
 entry('normalized-gain-laplacians',{
  kind:'graph',name:'Gain graph structure',question:'What happens when one relationship stops agreeing?',primaryLabel:'Edge phase',min:0,max:180,initial:100,secondary:0,unit:'°',
  formula:'L = D − A;  L_normalized = I − D^(−1/2) A D^(−1/2);  A_ji = conjugate(A_ij)',
  modelNote:'Computed six-vertex gain graph. Its matrix and eigenvalues are recalculated, not prerecorded.',
  steps:[
   step('Begin with connections.','An ordinary graph records which vertices are connected.','The six numbered nodes form two connected cycles.'),
   step('Give an edge a phase.','A gain edge also carries an orientation-sensitive relationship. Reversing it conjugates its gain.','The small dial is the phase of the highlighted edge.'),
   step('Ask whether the cycle closes.','A balanced cycle has gain product one. Local relationships agree after a complete circuit.','Follow the marked path around the cycle.'),
   step('Rotate just one relationship.','One phase change can make multiple cycles inconsistent. The operator changes with it.','The least eigenvalue moves away from zero.'),
   step('Normalize without losing the structure.','Degree normalization makes the operator comparable across vertices with different connectivity.','The spectrum remains real because the operator is Hermitian.'),
   step('Connect the picture to the paper.','The work studies normalized spectral bounds, balance, interlacing, and equality cases.','This computed example illustrates the object; the paper supplies the general results.')
  ]}),
 entry('extremal-gain-laplacian-bounds',{
  kind:'frustration',name:'Spectral certificates',question:'Can the spectrum tell us how much repair a graph needs?',primaryLabel:'Cycle defect',min:0,max:180,initial:120,secondary:0,unit:'°',
  formula:'Frustration index = minimum number of edge deletions that restore cycle balance.',
  modelNote:'Exact eigenvalues and edge-repair count for this finite example. It does not identify a unique general repair.',
  steps:[
   step('Start in agreement.','When every cycle closes, this connected graph has a zero least gain-Laplacian eigenvalue.','A zero spectral mode accompanies balance.'),
   step('Introduce a local defect.','Rotate one gain while leaving the connectivity unchanged.','The defective edge belongs to more than one cycle.'),
   step('Read the global response.','The least eigenvalue is now positive. A local disagreement has altered a global property.','The leftmost spectral column is no longer zero.'),
   step('Ask what repair would cost.','Frustration counts the fewest edges or vertices that must be removed to restore balance.','For this example, removing the highlighted edge is sufficient.'),
   step('Distinguish a certificate from a diagnosis.','The paper relates extremal eigenvalues to structural bounds. A spectral signal need not locate a unique culprit.','The formal bounds belong to the paper, not to an arbitrary visual rule.'),
   step('Repair and recompute.','Delete the inconsistent edge. The remaining graph is balanced and the least eigenvalue returns to zero.','Use Explore to compare the intact and repaired operators.')
  ]}),
 entry('urban-microregion-logistics',{
  kind:'urban',name:'Urban micro-regions',question:'Why does the better delivery vehicle change a few streets away?',primaryLabel:'Parking delay',min:0,max:8,initial:3,secondary:2,unit:' min',
  formula:'Service time = travel + parking + walking + unloading',
  modelNote:'Illustrative service-time scenario. No live-city recommendation or measured paper result is implied.',
  steps:[
   step('A city average hides a local decision.','Parking, access, walking distance, and density vary even between neighbouring streets.','The two neighbourhoods have different operational anatomy.'),
   step('Preserve the local context.','The research partitions cities into H3 cells and derives local features from OpenStreetMap.','Each hexagonal district represents a micro-region.'),
   step('Compare the same job.','A van and a cargo bike pay different costs for travel, parking, walking, and unloading.','The service-time decomposition is shown beside the scene.'),
   step('Change one operational variable.','Increasing the van’s parking delay can reverse which vehicle is faster.','Move the parking slider in Explore; the totals are recomputed.'),
   step('Make transition decisions testable.','The contribution is a spatial modelling pipeline for evaluating local fleet scenarios.','Transfer to a new city requires representative local data and calibration.')
  ]}),
 entry('square-root-natural-gradient',{
  kind:'gaussian',name:'Optimization geometry',question:'Can a change of representation make learning easier to explain?',primaryLabel:'Anisotropy',min:1,max:12,initial:5,secondary:0,unit:'×',
  formula:'q = N(μ, SSᵀ); illustrative diagonal Fisher flow: μ̇ = −S²Pμ; Ṡ = ½(S − PS³)',
  modelNote:'Diagonal-Gaussian flow illustration. It is not a reproduction of every update or experiment in the paper.',
  steps:[
   step('An approximation has to move.','Variational inference adjusts a distribution to approximate a target. Its coordinates affect that movement.','The surface represents a Gaussian quadratic target.'),
   step('The coordinates are not neutral.','A step of the same coordinate size can mean a very different change in distribution.','Anisotropy stretches the geometry.'),
   step('Compare geometries.','Euclidean and Fisher updates traverse the same illustrative objective along different paths.','Blue and warm paths are computed from explicit update equations.'),
   step('Represent covariance through a square root.','Writing covariance as SSᵀ makes the parameterization central to the analysis.','The paper connects this representation to natural-gradient guarantees.'),
   step('Keep the theorem’s boundary.','The convergence result concerns a specified variational-Gaussian setting under stated assumptions.','A persuasive trajectory outside that regime would not extend the theorem.')
  ]}),
 entry('experience-replay-optimization',{
  kind:'replay',name:'Experience Replay',question:'Which memories actually counter forgetting?',primaryLabel:'Replay examples',min:1,max:12,initial:3,secondary:155,unit:'',
  formula:'g_joint = ½(g_current + mean(g_memory)); residual = ‖g_replay − g_joint‖₂',
  modelNote:'Computed quadratic correction-matching example. The selection shown illustrates the formulation, not benchmark performance.',
  steps:[
   step('A model already knows something.','The current parameter state has learned from earlier examples. A new task now asks it to move.','The ball is a parameter state, not an accuracy score.'),
   step('Learning something new can damage the old.','The current-only update lowers the new-task loss but can increase old-task loss.','The warm arrow and old-loss readout make that conflict visible.'),
   step('Reveal the unavailable ideal.','Joint training would use old and new data together. Its update supplies a principled comparison target.','The teal arrow is the joint-training update for this example.'),
   step('Turn memories into corrections.','Each stored example contributes a gradient. Their aggregate direction matters, not just their relevance.','The smaller arrows are actual candidate gradients.'),
   step('Choose a constrained subset.','A selected replay subset brings the realized update closer to the target. The remaining distance is observable.','Compare greedy selection, a fixed random subset, and dense replay.'),
   step('Expose what the buffer cannot express.','A restricted buffer may lack the required correction direction. Even careful selection then leaves a residual.','The residual diagnoses mismatch; it does not guarantee long-term generalization.')
  ]}),
 entry('rank-feasibility',{
  kind:'rank',name:'Rank Feasibility',question:'What if the correction does not fit inside the model?',primaryLabel:'Illustration rank',min:1,max:3,initial:2,secondary:2,unit:'',
  formula:'min ½‖δ‖² subject to A_r δ ≥ b; usable only when ‖δ‖ ≤ chosen budget',
  modelNote:'Exact two-constraint QP in fixed nested subspaces. This is not the full nonlinear LoRA parameterization.',
  steps:[
   step('Restrict the ways a model can change.','A low-rank adapter permits movement only in a limited correction space.','One channel gives the model a line, not every possible direction.'),
   step('Make the conflict geometric.','Here, one old-task requirement asks for movement one way; another asks for the opposite.','No point on the line satisfies both inequalities.'),
   step('Expand the available space.','A second channel permits a solution, but the required correction is large.','The minimum-norm feasible point lies far away.'),
   step('Feasible is not automatically useful.','A correction can repair old tasks yet exceed the budget for changing the current model.','The wire sphere is a chosen update budget, not a theorem about accuracy.'),
   step('Find a smaller feasible correction.','In the third nested space, both requirements can be met with a much shorter move.','The point now lies inside the budget.'),
   step('Separate local geometry from final success.','The research asks whether rank admits a task-wise repair. Held-out behavior still needs empirical validation.','Local feasibility is not a promise of optimization or generalization.')
  ]}),
 entry('ticlm-replay-value',{
  kind:'temporal',name:'Temporal replay value',question:'When does memory become inertia?',primaryLabel:'Historical tokens',min:0,max:80,initial:25,secondary:.85,unit:' / 100',
  formula:'Fixed budget: current tokens + replay tokens = 100. Value = −mean(Δpast, Δpresent, Δforward proxy).',
  modelNote:'Transparent trade-off simulation for an ongoing research direction. Not a completed TiC-LM empirical result.',
  steps:[
   step('Data arrives through time.','A language model receives chronological windows. It cannot train on everything at every step.','The stack on the right is the current window.'),
   step('Charge memory for what it replaces.','Under a fixed token budget, replaying old data removes an equal amount of current data.','Every warm token replaces a blue token; the total stays 100.'),
   step('Useful history can protect the past.','In a stable illustrative regime, replay can improve retention enough to justify its cost.','The past, present, and forward-proxy effects remain separate.'),
   step('Stale history can obstruct adaptation.','In an evolving regime, backward benefit can coexist with worse present and forward-proxy performance.','Positive loss changes are costs, not improvements.'),
   step('Evaluate the counterfactual.','The ongoing direction values historical windows against spending the same tokens on current data.','The objective and its weights are explicit.'),
   step('Allow no replay.','When the estimated net value is non-positive, zero replay is a legitimate decision.','This proposal requires prospective, matched-budget validation.')
  ]}),
 entry('casepath',{
  kind:'evidence',name:'CasePath',question:'Should a plausible answer be allowed to become an action?',primaryLabel:'Process step',min:0,max:5,initial:3,secondary:0,unit:'',
  formula:'Source assertions → active obligations → deterministic admission → human-review packet',
  modelNote:'Synthetic, deterministic source-conflict demonstration. It does not establish source truth or authorize a legal or insurance decision.',
  steps:[
   step('Keep the source in view.','The system starts from identifiable source material rather than a model-written story.','The accompanying source excerpts remain readable throughout.'),
   step('Extract a bounded assertion.','An assertion names a field, value, and source. It is narrower than a free-form case narrative.','Here the only disputed field is an inspection date.'),
   step('Ask what permits the next step.','A process obligation requires one current, supported date before a review packet can proceed.','A model proposal does not decide whether the obligation is satisfied.'),
   step('Hold when evidence conflicts.','The sources currently give different dates. The deterministic gate leaves the obligation open.','No persuasive explanation can turn this HOLD into permission.'),
   step('Correct without rewriting history.','An explicit superseding source changes which assertion is current. The earlier record remains in the history.','Apply the correction below and inspect which source is superseded.'),
   step('Prepare a reviewable artifact.','The resulting packet records active sources, the gate result, and the unresolved human responsibility.','Ready for review is not the same as legally or factually correct.')
  ]}),
 entry('spatial-intelligence',{
  kind:'atlas',name:'Persistent worlds',question:'What changes when your next sentence edits the same world?',primaryLabel:'World revision',min:0,max:5,initial:0,secondary:0,unit:'',
  formula:'Language → declared intent → typed world state → 3D scene → situated demonstration action',
  modelNote:'Real WebGL geometry and camera. Deterministic local language parser; no model-generated assets or physical simulation.',
  steps:[
   step('Describe a place.','Start with a mountain laboratory, objects, relationships, and a task.','Speech is optional; every command also works as text.'),
   step('Make interpretation visible.','The interface shows exactly which environment, objects, and relations were recognized.','Unsupported commands fail visibly rather than pretending to understand.'),
   step('Instantiate real spatial state.','Objects occupy persistent world coordinates in a lit three-dimensional scene.','Orbit the camera; the geometry has depth and occlusion.'),
   step('Edit, do not regenerate.','A follow-up instruction moves an existing microscope or adds another sample.','Object identifiers and unaffected objects survive each edit.'),
   step('Act inside the world.','A demonstration robot approaches a selected sample along the laboratory aisle.','The motion follows explicit waypoints, not a learned embodied policy.')
  ]})
];
export const PERIOD_NAMES={foundations:'Past',current:'Now',frontier:'Next'} as const;
export const statusLabel=(work:WorkRegistryEntry)=>['experience-replay-optimization','rank-feasibility'].includes(work.id)?'Research manuscript':work.researchStatusLabel;
export const exhibitById=(id:string)=>EXHIBITS.find(e=>e.work.id===id);
export const exhibitByPath=(path:string)=>EXHIBITS.find(e=>e.work.route===path);
export const SOURCE_DATE='2026-09-01';
export const RELEASE_DATE='2026-09-05';
