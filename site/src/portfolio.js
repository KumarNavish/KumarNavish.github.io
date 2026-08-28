const compass = {
  structure: ['01 / 04', 'Structure', 'Expose the mathematical structure that makes a difficult system legible before making it larger.'],
  adaptation: ['02 / 04', 'Adaptation', 'Let a system learn new information without silently erasing what still matters.'],
  assurance: ['03 / 04', 'Assurance', 'Build systems whose decisions, constraints, evidence, and failure states remain visible.'],
  interaction: ['04 / 04', 'Interaction', 'Move beyond chat toward generative worlds, tools, and agents people can inhabit, manipulate, and test.'],
}

const systems = {
  casepath: {
    title: 'CasePath', status: 'Active research system', live: '/casepath/', source: 'https://github.com/KumarNavish/KumarNavish.github.io/tree/master/casepath',
    thesis: 'A useful agent should not merely produce a plausible answer. It should expose exactly which evidence supports each bounded assertion—and preserve uncertainty when evidence is insufficient.',
    process: ['Observable sources', 'Bounded assertions', 'Validation gates', 'Deterministic projection', 'Reviewable process'],
    role: 'Scientific framing, product architecture, schema design, evaluation design, frontend, backend, release governance, and end-to-end implementation.',
    chapters: {
      problem: ['Problem', 'Fluent systems can turn missing evidence into confident process advice.', 'Document-heavy workflows need extraction, synthesis, and procedural guidance, but the cost of a plausible unsupported inference can be much higher than the cost of admitting uncertainty.', ['Source artifacts can disagree, omit essential facts, or expose only partial evidence.', 'A free-form response makes observation and interpretation difficult to separate.', 'A trustworthy product needs useful failure states rather than silent optimism.']],
      decision: ['Decision', 'Constrain the model to select from predeclared assertions.', 'The model proposes only a bounded assertion and exact source references. Application-owned logic validates the selection and materializes every user-facing statement.', ['The model does not own legal or procedural conclusions.', 'Evidence selection is validated independently of generated prose.', 'Unknown and conflicting states are first-class product outcomes.']],
      architecture: ['Architecture', 'Separate observation, model judgment, and deterministic product behavior.', 'A fixed source registry, assertion catalogue, provider-native schema, validation layer, and deterministic projection form a chain in which every boundary can be inspected and tested.', ['Typed contracts keep provider output narrow.', 'Release evidence binds model behavior to one exact source and commit state.', 'The interface reveals the chain without exposing implementation noise.']],
      evidence: ['Evidence', 'Evaluate the process, not only the final answer.', 'The system is tested for source binding, assertion validity, schema admission, deterministic replay, conflict handling, and useful failure behavior across a frozen synthetic scope.', ['Regression gates cover the full source-to-decision path.', 'Provider provenance and release manifests remain reviewable.', 'Negative boundaries are preserved rather than edited away.']],
      next: ['Next question', 'How much process can be discovered without allowing the model to invent it?', 'The next scientific question is whether bounded evidence proposals can support process-graph discovery and checklist generation while keeping every promoted edge independently testable.', ['Separate extraction quality from process quality.', 'Measure robustness under source conflict and missing evidence.', 'Preserve human override as explicit evidence, not hidden preference.']],
    },
  },
  safepatch: {
    title: 'SafePatch', status: 'Interactive geometry system', live: '/safepatch/', source: 'https://github.com/KumarNavish/safepatch',
    thesis: 'A model update should not be called safe because it looks small. It should be projected into an explicit feasible region, with the active constraints and refusal state visible.',
    process: ['Proposed update', 'Safety halfspaces', 'QP projection', 'Dual certificate', 'Ship / hold state'],
    role: 'Optimization framing, interaction model, geometry engine, solver behavior, visual system, accessibility, tests, and static deployment.',
    chapters: {
      problem: ['Problem', 'A useful patch can improve the new objective while violating an old constraint.', 'Model editing and continual updates are often discussed in aggregate metrics. The failure can happen in the geometry of one proposed step, before a dashboard reveals it.', ['A small norm does not imply compatibility with protected behaviors.', 'Aggregate evaluation can hide which constraint became active.', 'A refusal to ship needs a reason a practitioner can inspect.']],
      decision: ['Decision', 'Make the feasible region the primary interface object.', 'The demo renders safety constraints as halfspaces, the unconstrained update as a proposal, and the projected update as the nearest admissible decision.', ['The geometry changes directly with user-controlled gradients and tolerances.', 'The original proposal remains visible after projection.', 'Infeasibility produces HOLD rather than a decorative warning.']],
      architecture: ['Architecture', 'Keep solver, geometry, rendering, and product state separate.', 'A small typed core computes polygon intersections and the constrained optimum. Rendering consumes the result, while the interface owns explanation and interaction state.', ['Deterministic geometry makes visual regression meaningful.', 'Dual multipliers connect solver output to active constraints.', 'Tests cover intersections, feasibility, and projection behavior.']],
      evidence: ['Evidence', 'Let the visitor falsify the claim by changing the problem.', 'The useful artifact is not a screenshot. A visitor can move constraints, change the update, and observe when projection succeeds, which multiplier activates, or why shipping is denied.', ['Every control updates real local state.', 'The safe and unsafe updates remain visually comparable.', 'The certificate changes with the active boundary.']],
      next: ['Next question', 'How should a high-dimensional certificate collapse into an honest interface?', 'The 2D demo makes the mechanism legible. The harder design problem is preserving the same inspectability when constraints come from large models and approximate curvature.', ['Show approximation error without overwhelming the user.', 'Distinguish numerical failure from scientific infeasibility.', 'Connect local certificates to held-out behavior.']],
    },
  },
  edgealign: {
    title: 'EdgeAlign-DR', status: 'Production-style decision tool', live: 'https://kumarnavish.github.io/promopilot/', source: 'https://github.com/KumarNavish/promopilot',
    thesis: 'Guardrail policy should be chosen from an estimate of what would happen under each intervention—not from outcomes produced by a confounded historical policy.',
    process: ['Confounded logs', 'Outcome models', 'Propensity model', 'Doubly robust value', 'Policy recommendation'],
    role: 'Causal framing, synthetic data design, model pipeline, FastAPI service, decision UI, tests, deployment, and product narrative.',
    chapters: {
      problem: ['Problem', 'Logged outcomes reward the policy that chose the easiest cases.', 'Riskier prompts are often assigned stricter guardrails. A naive comparison can therefore confuse assignment bias with policy quality and recommend the wrong intervention level.', ['Treatment is multi-level rather than binary.', 'Prompt risk affects both assignment and outcome.', 'A production recommendation must respect a declared policy cap.']],
      decision: ['Decision', 'Compare policies with doubly robust counterfactual estimates.', 'The tool combines an outcome model with inverse-propensity correction, then recommends a policy level for the selected objective and segment.', ['Naive and doubly robust policies remain visible side by side.', 'The user controls objective, segmentation, and maximum intervention.', 'The interface leads with one decision and the evidence needed to question it.']],
      architecture: ['Architecture', 'Precompute the scientific artifact; keep inference fast and inspectable.', 'A reproducible training pipeline exports compact recommendation artifacts. A FastAPI service and static fallback expose the same bounded decision surface to the frontend.', ['Synthetic logs make the confounding mechanism explicit.', 'Backend and static export share one model artifact.', 'Container and Pages deployments exercise different operating constraints.']],
      evidence: ['Evidence', 'Construct a world where the naive estimator should fail.', 'The evaluation is deliberately causal: synthetic assignment creates known confounding, allowing the system to test whether the doubly robust estimator recovers better policy choices.', ['Unit tests cover recommendation contracts.', 'End-to-end tests cover the decision path.', 'Exported results make API and static behavior comparable.']],
      next: ['Next question', 'When should an estimated policy refuse to recommend an intervention?', 'The next step is uncertainty-aware abstention: separate a low estimated value from a region where overlap, model fit, or sample support is too weak for a credible decision.', ['Expose overlap and effective sample size.', 'Calibrate uncertainty by segment and treatment level.', 'Turn unsupported optimization into an explicit hold state.']],
    },
  },
}

const research = {
  spectral: {status:'Published',year:'2020–2021',tone:'published',title:'Spectral foundations',question:'Which global properties of a structured graph are visible in its spectrum?',contribution:'Developed normalized Laplacians and extremal eigenvalue bounds for gain graphs, connecting balance and frustration to spectral quantities.',boundary:'The results describe mathematical structure; they do not by themselves prescribe a learning algorithm.',unresolved:'How can spectral structure become an operational constraint inside adaptive learning systems?',link:'https://www.sciencedirect.com/science/article/pii/S0024379521002111',label:'Published paper ↗'},
  natural: {status:'Preprint',year:'2025',tone:'published',title:'Optimization Guarantees for Square-Root Natural-Gradient Variational Inference',question:'What parameterization makes natural-gradient Gaussian inference analyzable and stable?',contribution:'Establishes convergence guarantees through a square-root covariance parameterization that makes the update geometry explicit.',boundary:'The guarantees apply to the analyzed variational setting; broader optimizer and model behavior remains outside the theorem.',unresolved:'Which geometric guarantees remain useful once the model, data, and objective all move over time?',link:'https://arxiv.org/abs/2507.07853',label:'Read preprint ↗'},
  replay: {status:'Under revision',year:'2026',tone:'revision',title:'Experience Replay Through the Lens of Optimization',question:'What update is experience replay actually trying to recover?',contribution:'Recasts replay as correction toward the update joint training would have taken, derives a discrete replay selection objective, and introduces Greedy Ball Replay.',boundary:'Mechanism studies and end-to-end experiments connect smaller replay error to better continual-learning outcomes while exposing when the approximation is weak.',unresolved:'How far can the correction view scale when representations, optimizers, and data distributions all move at once?',link:'https://openreview.net/forum?id=yCe0QP7OJQ',label:'OpenReview discussion ↗'},
  rank: {status:'Under revision',year:'2026',tone:'revision',title:'Rank Feasibility in Continual PEFT',question:'When does an adapter have enough rank to learn a new task without violating old-task constraints?',contribution:'Separates feasible rank from usable rank by checking whether a bounded correction exists and whether it preserves enough current-task progress.',boundary:'The diagnostic is local, requires representative old-task information, and does not replace held-out validation.',unresolved:'Can feasibility be estimated earlier and more cheaply than training and validating a full rank sweep?',link:'https://openreview.net/forum?id=CwmHHYCbjK',label:'OpenReview discussion ↗'},
  temporal: {status:'Ongoing',year:'Now',tone:'ongoing',title:'Counterfactual replay value for TiC-LM',question:'Which historical windows are still worth spending scarce training tokens on now?',contribution:'Develops a replay-value view tied to counterfactual changes in the TiC-LM regret row, rather than age, forgetting, or a fixed replay ratio alone.',boundary:'This is ongoing work. The local value estimator, future-regret proxy, and large-scale calibration still require empirical validation.',unresolved:'Can a conservative online estimator stop replay exactly when history becomes stale or harmful?',link:'https://aclanthology.org/2025.acl-long.1551/',label:'TiC-LM benchmark ↗'},
  spatial: {status:'Frontier',year:'Next',tone:'frontier',title:'Generative AI × spatial computing',question:'What changes when an intelligent system produces a world rather than a response?',contribution:'Explores a direction in which language creates persistent spatial environments, tools, simulations, and agents that people can directly manipulate.',boundary:'This is a declared direction, not a completed research result. The interaction model and evaluation framework are still being formed.',unresolved:'How should generated worlds expose state, causality, uncertainty, and revision without collapsing back into chat?',link:'#frontier',label:'Inspect frontier →'},
}

const frontier = {
  intent: ['01 / 03','Language becomes a construction medium.','A person should be able to describe an environment, goal, or transformation at the level of intent while retaining direct control over the result.',['What representation can preserve intent across generation, editing, and interaction?','How should ambiguous language become inspectable choices rather than hidden assumptions?','Which parts of creation should remain deterministic even when generation is model-produced?']],
  world: ['02 / 03','The world becomes editable.','Generated scenes need spatial semantics, physics, persistence, and direct manipulation so people can revise them through action.',['How do we evaluate a generated environment as a useful interface rather than an impressive scene?','How should a person inspect and revise the hidden state behind spatial generation?','What must remain deterministic when the world, tools, and agents are model-produced?']],
  agent: ['03 / 03','The agent becomes situated.','An intelligent agent in a shared space must perceive persistent state, act through tools, expose its plan, and remain interruptible by the people around it.',['What should an embodied agent remember, and what should remain outside the model?','How can action traces become legible without turning the world into a dashboard?','How should multiple people and agents negotiate control of one evolving environment?']],
}

const $ = (selector, root=document) => root.querySelector(selector)
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)]

function setCompass(id) {
  const value = compass[id]
  if (!value) return
  $('.compass').dataset.stage = id
  $('[data-compass-position]').textContent = value[0]
  $('[data-compass-label]').textContent = value[1]
  $('[data-compass-title]').textContent = value[2]
  $$('[data-compass-stage]').forEach(button => { const active=button.dataset.compassStage===id; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)) })
}

let activeSystem = 'casepath'
function setChapter(id) {
  const chapter = systems[activeSystem].chapters[id]
  if (!chapter) return
  $('[data-chapter-label]').textContent=chapter[0]; $('[data-chapter-title]').textContent=chapter[1]; $('[data-chapter-body]').textContent=chapter[2]
  $('[data-chapter-bullets]').innerHTML=chapter[3].map(item=>`<li>${item}</li>`).join('')
  $$('[data-chapter]').forEach(button=>button.classList.toggle('active',button.dataset.chapter===id))
}
function setSystem(id) {
  const system=systems[id]; if(!system)return; activeSystem=id
  $('[data-system-title]').textContent=system.title; $('[data-system-status]').textContent=system.status; $('[data-system-thesis]').textContent=system.thesis; $('[data-system-role]').textContent=system.role
  $('[data-system-live]').href=system.live; $('[data-system-source]').href=system.source
  $('[data-system-process]').innerHTML=system.process.map((item,index)=>`<li><span>${String(index+1).padStart(2,'0')}</span><strong>${item}</strong></li>`).join('')
  $$('[data-system]').forEach(button=>{const active=button.dataset.system===id;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))})
  setChapter('problem')
}

function setResearch(id) {
  const item=research[id]; if(!item)return
  $('#research-detail').dataset.tone=item.tone; $('[data-research-status]').textContent=item.status; $('[data-research-year]').textContent=item.year; $('[data-research-title]').textContent=item.title; $('[data-research-question]').textContent=item.question; $('[data-research-contribution]').textContent=item.contribution; $('[data-research-boundary]').textContent=item.boundary; $('[data-research-unresolved]').textContent=item.unresolved
  const link=$('[data-research-link]'); link.href=item.link; link.textContent=item.label; if(item.link.startsWith('#')){link.removeAttribute('target');link.removeAttribute('rel')}else{link.target='_blank';link.rel='noreferrer'}
  $$('[data-research]').forEach(button=>{const active=button.dataset.research===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})
}

function setFrontier(id) {
  const item=frontier[id]; if(!item)return
  $('[data-frontier-count]').textContent=item[0]; $('[data-frontier-title]').textContent=item[1]; $('[data-frontier-body]').textContent=item[2]; $('[data-frontier-questions]').innerHTML=item[3].map(question=>`<li>${question}</li>`).join('')
  $$('[data-frontier]').forEach(button=>{const active=button.dataset.frontier===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})
}

const searchItems = [
  ['Trajectory','From structure to spatial interaction','#trajectory'],['CasePath','Evidence-bounded agentic workflows','#systems','casepath'],['SafePatch','Constrained model updates you can inspect','#systems','safepatch'],['EdgeAlign-DR','Counterfactual policy design','#systems','edgealign'],['Experience Replay Through the Lens of Optimization','Under revision · OpenReview','#research','replay'],['Rank Feasibility in Continual PEFT','Under revision · OpenReview','#research','rank'],['Counterfactual replay value for TiC-LM','Ongoing research','#research','temporal'],['Generative AI × spatial computing','Frontier direction','#frontier','spatial'],['Google Scholar','Published research record','https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en'],
]
function renderSearch(query='') {
  const q=query.trim().toLowerCase(); const matches=searchItems.filter(item=>!q||`${item[0]} ${item[1]}`.toLowerCase().includes(q)).slice(0,8)
  $('[data-command-results]').innerHTML=matches.map((item,index)=>`<button type="button" data-result="${index}"><span><strong>${item[0]}</strong><small>${item[1]}</small></span><b>→</b></button>`).join('')||'<p>No match. Try “replay”, “spatial”, or “CasePath”.</p>'
  $$('[data-result]').forEach((button,index)=>button.addEventListener('click',()=>{const item=matches[index];closeCommand();if(item[3]&&systems[item[3]])setSystem(item[3]);if(item[3]&&research[item[3]])setResearch(item[3]);if(item[2].startsWith('http'))window.open(item[2],'_blank','noopener');else $(item[2])?.scrollIntoView({behavior:'smooth'})}))
}
const dialog=$('#command-palette'); const input=$('[data-command-input]')
function openCommand(){renderSearch();dialog.showModal();setTimeout(()=>input.focus(),0)}
function closeCommand(){if(dialog.open)dialog.close()}

$$('[data-compass-stage]').forEach(button=>button.addEventListener('click',()=>setCompass(button.dataset.compassStage)))
$$('[data-system]').forEach(button=>button.addEventListener('click',()=>setSystem(button.dataset.system)))
$$('[data-chapter]').forEach(button=>button.addEventListener('click',()=>setChapter(button.dataset.chapter)))
$$('[data-research]').forEach(button=>button.addEventListener('click',()=>setResearch(button.dataset.research)))
$$('[data-frontier]').forEach(button=>button.addEventListener('click',()=>setFrontier(button.dataset.frontier)))
$$('[data-open-command]').forEach(button=>button.addEventListener('click',openCommand)); $('[data-close-command]').addEventListener('click',closeCommand); input.addEventListener('input',()=>renderSearch(input.value))
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();dialog.open?closeCommand():openCommand()}if(event.key==='Escape')closeCommand()})
dialog.addEventListener('click',event=>{if(event.target===dialog)closeCommand()})

document.documentElement.classList.add('js')
const revealObserver = new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -8% 0px'})
$$('.reveal:not(.visible)').forEach(item=>revealObserver.observe(item))
const sectionObserver = new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;$$('[data-nav-section]').forEach(link=>link.classList.toggle('active',link.dataset.navSection===visible.target.id));document.body.classList.toggle('frontier-view',visible.target.id==='frontier')},{rootMargin:'-20% 0px -65% 0px',threshold:[0,.1,.3]})
$$('main > section[id]').forEach(section=>sectionObserver.observe(section))
$$('.mobile-nav a').forEach(link=>link.addEventListener('click',()=>$('.mobile-nav').removeAttribute('open')))
$('[data-year]').textContent=String(new Date().getFullYear())
