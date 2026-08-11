# CasePath Master Knowledge Transfer

> **Purpose:** operational memory for the next AI agent, researcher, engineer, or product designer with no prior conversation context.  
> **Canonical product baseline inspected:** `KumarNavish/KumarNavish.github.io` at `a867bb506d8e3f790806fc21f2a24a011c1cd0bc`.  
> **Live product:** <https://casepath-swiss-claim-lab.onrender.com/>  
> **Live API:** <https://casepath-agentic-api.onrender.com/>  
> **Retained browser evidence:** <https://casepath-guided-canonical-qa.onrender.com/>  
> **Reconstruction date:** 11 August 2026.

---

## Read this first

CasePath has several generations of code, data, experiments, papers, product redesigns, and release branches. They are related, but they are **not one synchronized system**.

Three assets must never be conflated:

| Layer | What it is | Truth status | What it establishes |
|---|---|---|---|
| Original bilingual corpus | 150 generated claims and 2,251 files across three broad tenant-law categories | **Prototype / generated-reference only** | Reproducible generation infrastructure and the importance of shortcut audits |
| Hardened defects vertical slice | 48 generated journeys, 136 episodes, 1,148 attachments, longitudinal and negative cases | **Prototype / generated-reference only** | A materially harder research benchmark for process-grounded planning and sparse adaptation |
| Deployed v20 flagship demo | Two generated recurring-moisture claims, nine artifacts, deterministic typed reference pipeline | **Implemented and browser-verified as a demonstration** | The complete product story can be shown from source intake through reviewed memory and later-claim reuse |

The deployed product does **not** run the 150-claim corpus. It does **not** currently call LangChain, Nemotron, or OpenRouter. Its legal component is not a live RAG service. Its review and promotion results are generated reference behavior. Its SQLite state is ephemeral. These are not minor qualifications; they determine what can honestly be claimed.

### Truth-status vocabulary

Use exactly these labels:

- **Implemented and verified** — current code or deployment plus aligned test, API, browser, or artifact evidence.
- **Implemented but not fully verified** — code exists, but current release evidence is incomplete or source/deployment differs.
- **Prototype / generated-reference only** — generated inputs, deterministic reference logic, static fixtures, simulated reviewers, or hard-coded evaluation outputs.
- **Planned** — specified but not implemented in the current inspected system.
- **Rejected / abandoned** — tried and found misleading, unsafe, weak, or contrary to the north star.

Do not use `implemented` as a synonym for `validated`. Do not use `agentic` as a synonym for `model-driven`. Do not call generated labels expert truth.

---

## Table of contents

1. [Original mission](#1-original-mission)
2. [Operational reason for the project](#2-operational-reason-for-the-project)
3. [Current project truth](#3-current-project-truth)
4. [Benchmark and data landscape](#4-benchmark-and-data-landscape)
5. [Synthetic claim generator](#5-synthetic-claim-generator)
6. [Agent architecture](#6-agent-architecture)
7. [Deterministic boundary](#7-deterministic-boundary)
8. [Process discovery](#8-process-discovery)
9. [Process-derived evidence and documents](#9-process-derived-evidence-and-documents)
10. [Swiss-law grounding](#10-swiss-law-grounding)
11. [Historical claim retrieval](#11-historical-claim-retrieval)
12. [Expert feedback and organizational learning](#12-expert-feedback-and-organizational-learning)
13. [Evaluation and research findings](#13-evaluation-and-research-findings)
14. [Do not rediscover](#14-do-not-rediscover)
15. [UX journey and design history](#15-ux-journey-and-design-history)
16. [Deployment and release history](#16-deployment-and-release-history)
17. [Model-cost constraints](#17-model-cost-constraints)
18. [Repository map](#18-repository-map)
19. [Canonical schemas and examples](#19-canonical-schemas-and-examples)
20. [Precise current-state table](#20-precise-current-state-table)
21. [Irreducible research questions](#21-irreducible-research-questions)
22. [Immediate next milestone](#22-immediate-next-milestone)
23. [First 60 minutes](#23-first-60-minutes)
24. [Glossary](#24-glossary)
25. [Operating rules for future agents](#25-operating-rules-for-future-agents)

---

# 1. Original mission

## 1.1 North star

CasePath is not primarily a claim classifier, next-action predictor, missing-document detector, or claims dashboard.

> **Given the customer's first claim message and actual attachments, coordinated agents should infer the complete claim-handling process, derive the evidence and document requirements from that process and relevant Swiss law, retrieve useful historical experience, allow an expert to validate or correct the result, and turn validated cases into reusable organizational knowledge that improves future claims.**

The target loop is:

```text
Claim intake
→ Understand message and attachments
→ Research Swiss tenant law
→ Construct full claim-specific process graph
→ Derive process-grounded evidence and document model
→ Retrieve useful historical claims
→ Expert review
→ Approved case memory
→ Candidate reusable process knowledge
→ Regression testing and governance
→ Updated knowledge base
→ Future claim benefits
```

The defining causal relationship is:

> **Process determines what must be established. Evidence and documents exist to establish those facts.**

If process and checklist are predicted independently, the project has drifted from its core contribution.

## 1.2 Bounded operational role

CasePath may prepare a claim for competent human handling by organizing source material, exposing supported and unresolved facts, proposing a handling graph, linking evidence to decisions, surfacing relevant law and experience, and recording expert corrections.

It must not, without separate institutional authorization:

- provide legal advice;
- decide insurance coverage or legal merits;
- calculate or guarantee deadlines;
- accept or deny a claim;
- contact a customer;
- autonomously escalate a case;
- or alter shared procedure from one unreviewed event.

## 1.3 Research formulations already explored

The project has used three related formulations:

1. **Claim-readiness planning:** infer current state, unresolved fact, evidence needed now, and next safe action.
2. **Claim-specific process and evidence reasoning:** infer the complete process graph and derive evidence from reached decisions.
3. **Playbook induction from reviewed contrasts:** learn non-default trigger conditions inside an approved workflow while retaining deterministic execution and regression gates.

A future paper or experiment must explicitly choose one. Combining them without a clear primary estimand causes conceptual confusion.

---

# 2. Operational reason for the project

Experienced handlers implicitly know:

- whether a real dispute exists;
- whether tenant-law scope applies;
- which questions must be answered first;
- which decisions depend on earlier decisions;
- which facts are supported, alleged, conflicting, or unknown;
- which legal sources matter;
- which evidence can resolve each decision;
- which internal route follows;
- and how exceptional cases differ from routine ones.

Much of this knowledge lives in people, local templates, emails, and habits rather than an explicit reusable system. Static category checklists flatten the reasoning: they request evidence for inactive branches, miss exceptions, and force experts to reconstruct the process repeatedly.

CasePath aims to turn this tacit knowledge into a **living, expert-validated playbook library** containing:

- allowed process structure;
- decision questions and branch conditions;
- evidence goals and acceptable alternatives;
- source authority;
- ownership and handoffs;
- exceptions and effective dates;
- review history;
- versioning and rollback.

The practical hypotheses are less repetitive expert reasoning, more consistent handling, faster onboarding, fewer unnecessary requests, better first-request completeness, reusable precedent, stronger transparency, and continually improving organizational memory. These remain hypotheses for real operations; generated simulations do not establish real workload or customer-friction reduction.

---

# 3. Current project truth

## 3.1 Authoritative product components

| Component | Inspected state | Truth status |
|---|---|---|
| Frontend | CasePath v20, static two-pane workspace, product baseline `a867bb5` | **Implemented and verified** |
| API | `pipeline_v15.py`, deterministic typed reference pipeline | **Implemented and verified** |
| Canonical QA | Focused Playwright journey retained on a QA-only commit | **Implemented and verified, but source alignment is imperfect** |
| Persistence | SQLite under `/tmp` by default | **Implemented but not durable** |
| Model runtime | No current model call path | **Not implemented in public runtime** |
| Legal retrieval | Static official-source registry and handcrafted interpretation | **Prototype / generated-reference only** |
| Knowledge promotion | Generated support, target-test, and protected-regression outputs | **Prototype / generated-reference only** |

The repository is a broader personal-site repository. The root README is not the CasePath README. Current CasePath code is concentrated in:

```text
casepath/
casepath-api/
casepath-qa/
```

## 3.2 Deployment SHA reality

At the inspected release:

| Service | SHA | Meaning |
|---|---|---|
| Frontend | `a867bb506d8e3f790806fc21f2a24a011c1cd0bc` | Frozen v20 interaction baseline |
| API | `550c42175c2dfa432dd32eb4c5f82361ce1c2f25` | Earlier SHA; API source did not change in the frontend-only v20 pass |
| Canonical QA | `7be18c72f353366930cd5dcace637884e06e63a7` | QA-only corrections not merged into product baseline |

Do not claim that all services run one SHA. The code may still be functionally compatible, but release governance is unsynchronized.

## 3.3 What the public journey verifies

The focused production gate verified 57 checks with zero failures. It exercised one uninterrupted route that:

- shows an intentional loading shell;
- renders a generated customer message and six source attachments;
- opens a six-page PDF and source photograph;
- starts analysis through one action;
- shows source-level backend events and one current specialist;
- keeps the source claim visible;
- makes an 11-stage process graph the dominant artifact;
- displays current and blocked decisions;
- places evidence status on graph decisions;
- shows reviewed-reference cases at the relevant decision;
- performs one consequential expert correction beside the graph;
- distinguishes reviewed memory, correction, and shared rule;
- opens a second generated claim;
- shows later-claim before/after behavior;
- creates two backend runs;
- has no console, page, or public request failures;
- has no page-level overflow at 390 or 320 pixels;
- and resets to playbook v3 after QA.

Browser correctness is not research validity. The same run does not prove that a model inferred facts, discovered law, learned a process, or safely promoted knowledge.

## 3.4 Public data and execution profile

The deployed API contains exactly two claims:

- `DEF-027-E0-DEMO` — flagship recurring-mould claim.
- `DEMO-MOULD-002` — later recurring-condensation claim.

It exposes nine generated artifacts. It identifies itself as:

```text
profile: full-process-reference-agents
orchestrator: casepath-reference-orchestrator/15.0
implementation: typed_reference_agent
generated_data_only: true
real_claims_approved: false
```

The specialist stages are deterministic Python functions with typed events. Deliberate pacing makes the work observable. There is no current LLM invocation.

## 3.5 Important discrepancies

- `casepath/index.html` says product release `20.0.0`.
- API health reports pipeline `15.0.0`.
- `casepath/release.json` is stale at `12.0.2`.
- `casepath/source-manifest.json` is stale at `10.0.0`.
- Frontend behavior still depends on v16–v20 scripts and styles.
- The default-branch QA wrapper is not exactly the source used for the retained passing canonical QA.
- Legacy backend tests import `pipeline.py`, while `app.py` imports `pipeline_v15.py`.
- API build runs a direct smoke rather than an aligned v15 test suite.

These defects are documented technical debt, not reasons to restart the architecture.

---

# 4. Benchmark and data landscape

## 4.1 Original bilingual corpus

**Truth status:** Prototype / generated-reference only.

Reported contract and provenance:

```text
contract: casepath.private-candidate-corpus/2.0.0
claims: 150
files: 2,251
languages: German and English
corpus SHA-256:
84d827d30c8688c3e0ccfc71d89a3d64e96048eb2d2e43c32dd719a54209e966
reported source commit:
7bebdf3f9fc35641ee91262f61180b27362e99cc
```

The reported source commit was not found in the inspected repository. Recover the actual archive origin before making commit-level reproducibility claims.

The corpus covered three initial tenant-law subtypes:

- mould or moisture defects;
- rent increase;
- security deposit.

It packaged customer messages, rendered PDFs and images, correspondence, canonical JSON, reference process graphs, checklists, and generation provenance. It was a strong infrastructure proof, but a weak final benchmark because:

- subject lines leaked category;
- each category largely shared one process skeleton;
- all claims were intake snapshots;
- negative and out-of-scope cases were missing;
- attachments were not always decisive;
- and ground truth was generated rather than adjudicated.

## 4.2 Hardened defects vertical slice

**Truth status:** Prototype / generated-reference only, stronger than the original corpus.

Reported contract:

```text
casepath.defects-vertical-slice-benchmark/1.0.0
```

Key scale:

```text
48 journeys
136 episodes
1,148 attachments
28 process paths
12 current process nodes
longitudinal evidence arrival
negative and out-of-scope cases
withheld recurring-condensation / ventilation pattern
```

The release introduced attachment-decisive cases, neutral or misleading subjects, staged evidence, duplicate and irrelevant files, scope negatives, branch reversal, multiple valid targets, and disagreement-aware review packages. It is the strongest existing generated research asset, but it is not part of the current public runtime and is not independently expert-approved.

## 4.3 Observable information

The downstream system is allowed to see only:

- the first customer message or the messages available at the episode;
- submitted PDFs, images, email files, and documents;
- metadata available at intake;
- source hashes and provenance needed for integrity;
- and canonical facts derived only from those observable materials.

A defensible observable claim object must not expose answer-bearing labels.

## 4.4 Hidden reference information

Generation and evaluation may retain:

- category and subtype;
- complete reference process;
- checklist and expected facts;
- branch conditions;
- reference next actions;
- future artifacts;
- process ownership;
- generation prompts and model provenance;
- synthetic scenario controls;
- and expert or simulated-review targets.

These belong in a physically and logically separate hidden package.

## 4.5 Leakage prohibition

Hidden-ground-truth leakage is forbidden because it collapses the scientific problem. The evaluated system must not see:

- category labels encoded in filenames or metadata;
- reference branch names;
- future episode evidence;
- checklist answers;
- scenario IDs that map to targets;
- words such as `synthetic`, `generated`, `sample`, or `ground truth` inside evaluated artifacts;
- or generation notes that reveal the intended cause.

Current public-demo artifacts visibly disclose that they are generated. That is acceptable for a public demo boundary, but not for a leakage-clean benchmark package. Separate disclosure in the product shell from bytes supplied to the evaluated model.

## 4.6 Reproducibility status

- Original corpus: generated and checksummed, but source-repository provenance must be recovered.
- Hardened benchmark: reported clean internal releases and manifests, but current default branch does not contain the complete package.
- Public v20: browser-reproducible product story, but not integrated with the hardened benchmark.
- Real-world benchmark: not yet approved or released.

---

# 5. Synthetic claim generator

## 5.1 Why generation was necessary

Real Mobiliar or Protekta claims were not initially approved for research use. Generated claims enabled rapid iteration on schemas, provenance, artifact rendering, process targets, leakage controls, and evaluation without exposing customer data.

Generation is infrastructure for testing a method; it is not evidence that the method transfers to real claims.

## 5.2 Intended generation pipeline

```text
scenario specification
→ model-generated claim narrative and hidden plan
→ deterministic schema normalization
→ cross-document consistency checks
→ PDF, email, image, and JSON rendering
→ observable/hidden split
→ leakage scan
→ provenance and checksum manifest
→ benchmark validation
```

The model is useful for linguistic and scenario diversity. Deterministic code must own identifiers, timestamps, schema conformance, cross-file references, checksums, page rendering, and separation of observable from hidden data.

## 5.3 Current public artifact generation

`casepath-api/generate_artifacts.py` creates demo PDFs, emails, and images. `casepath-api/render-build.sh` regenerates artifacts, verifies photographic hashes, and runs a direct API smoke.

**Truth status:** Implemented and verified for the public generated demo; not a leakage-clean benchmark generator.

## 5.4 Major lesson

> The visible claim package must resemble genuine operational input. The evaluated model must not see generation artefacts.

Do not label source files `synthetic`, `sample`, or `generated`. Keep research disclosure in the surrounding application or manifest inaccessible to the evaluated model.

## 5.5 Current realism weakness

The flagship artifacts are inspectable, but not yet at blind operational realism. Remaining quality requirements include:

- complete multi-page leases with realistic clauses and annexes;
- landlord letters and notices with credible headers, references, dates, and signatures;
- invoices and inspection reports with realistic structure and terminology;
- email threads with quoted history and consistent participants;
- high-quality photographs whose geometry, lighting, damage pattern, and metadata are plausible;
- consistent names, addresses, dates, amounts, and incident chronology across files;
- realistic missingness, duplicates, ambiguity, and irrelevant material;
- and independent human realism review.

A polished PDF generated by code is still a generated reference. Do not call it a real customer document.

---

# 6. Agent architecture

## 6.1 Current deployed architecture

**Truth status:** Implemented and verified as deterministic reference agents.

`casepath-api/casepath_api/app.py` imports `ClaimPipeline` from `pipeline_v15.py`. The pipeline creates one run, opens one shared claim context, emits typed events, and executes specialist stages in a background thread.

Canonical principle:

> Specialist implementations may change. Canonical data contracts and validators should not.

## 6.2 Current specialist contracts

| Specialist | Purpose | Canonical input | Canonical output | Validation | Downstream consumer |
|---|---|---|---|---|---|
| Attachment Parsing Agent | Preserve and parse source package | Observable message and artifacts | Source package, artifact inventory, source refs | Artifact existence, type, hashes, page bounds | Claim Understanding |
| Claim Understanding Agent | Separate supported, alleged, conflicting, and unknown facts | Source package | Canonical claim state and facts | Source-ref requirement, confidence/state checks | Law, process, evidence |
| Legal Research Agent | Formulate tenant-law handling questions and connect official sources | Canonical claim state | Legal questions, source links, operational implications | Source registry and node-link checks | Process Discovery |
| Process Discovery Agent | Build complete handling spine and claim overlay | Facts, law, active playbook | Process graph, nodes, edges, branches, current node | Node/edge integrity, reachable states, legal/evidence links | Evidence Agent and UI |
| Document Requirements Agent | Derive evidence from reached process questions | Process graph and facts | Evidence items with `node_id`, `fact_id`, status, alternatives, reason | Process/fact linkage, no-repeat checks, status vocabulary | Handler, review, verifier |
| Historical Claims Agent | Retrieve useful organizational experience | Current process state, unresolved facts, evidence needs | Ranked precedents and usefulness rationale | Exclude current claim, source/status checks | Process inspector and expert |
| Verification Agent | Reject unsupported or inconsistent relationships | Full graph, evidence, legal links, precedents | Verification report and rejected proposals | Deterministic graph/evidence checks | Expert review |
| Expert Feedback step | Capture one consequential correction | Proposed playbook plus expert choice | Structured correction and downstream delta | Typed choice, reviewed source, audit event | Memory and consolidation |
| Knowledge Consolidation Agent | Separate case memory from candidate shared knowledge | Reviewed run and correction | Reviewed memory, candidate patch, version/rollback metadata | Support, target/protected gates, approval state | Future retrieval and playbook registry |

The current implementations are deterministic functions, despite the agent names.

## 6.3 Shared run context

A run records:

- claim ID and run ID;
- profile and release;
- orchestrator identity;
- shared context version;
- accepted artifacts;
- typed events;
- source and prompt/validator versions;
- review;
- memory;
- candidate update;
- and final result.

The public event stream is real backend state, not a browser timer, but its content is generated by deterministic reference logic.

## 6.4 Historical LangChain/LangGraph implementation

Archived branches contained `langchain_agents.py` using LangChain `create_agent` on the LangGraph runtime, structured Pydantic outputs, a shared context, and specialist tools. Historical provider code used OpenRouter and Nemotron.

**Truth status:** Implemented historically, not present in current master and not verified in the current deployment.

Do not claim that the live product runs LangChain, LangGraph, OpenRouter, or Nemotron. Recover the archived source only for a deliberate experiment against the current canonical contracts.

## 6.5 Provider abstraction

The desired model interface is configuration-driven:

```text
provider
model ID
reasoning options
temperature
structured output schema
prompt version
retry policy
cache key
provider-routing constraints
```

The orchestrating model and every specialist must be swappable without changing canonical claim, process, evidence, memory, or candidate-patch schemas.

## 6.6 Replacement rule

A new agent implementation is acceptable only if it:

1. consumes the same observable and canonical inputs;
2. emits the same typed contract;
3. preserves provenance and source references;
4. passes deterministic validators;
5. is evaluated against the same frozen benchmark split;
6. reports provider/model identity;
7. and does not silently bypass uncertainty or governance.

---

# 7. Deterministic boundary

Fully agentic does not mean agents control everything.

Deterministic infrastructure must own:

- schemas and migrations;
- source provenance and hashes;
- observable/hidden separation;
- evidence state vocabulary;
- graph integrity and reachability;
- process-to-fact-to-evidence linkage;
- duplicate and no-repeat request checks;
- permissions and role boundaries;
- effective dates and versions;
- release gates;
- target and protected regression evaluation;
- audit logs;
- approval state;
- rollback;
- and persistence transactions.

Agents may propose:

- canonical interpretations;
- legal questions;
- graph nodes and branch conditions;
- evidence alternatives;
- precedent candidates;
- corrections;
- and candidate reusable rules.

Deterministic validation and human approval control consequential shared changes.

A strong default is:

```text
agent proposal
→ schema validation
→ source/provenance validation
→ semantic consistency checks
→ human review where consequential
→ target evaluation
→ protected regression
→ versioned release
→ rollback retained
```

---

# 8. Process discovery

## 8.1 Category template versus process instance

A category template is a reusable superset or approved workflow family. A claim-specific process instance is the graph instantiated from this claim's supported facts, unresolved questions, legal context, and current evidence.

CasePath must not classify `mould` and copy a fixed graph while calling that process discovery.

## 8.2 Required graph semantics

A useful graph may include:

- intake and scope;
- dispute existence;
- urgency and health/safety;
- notification and prerequisites;
- factual assessment;
- causation;
- responsibility;
- remedy selection;
- conditional branches;
- escalation;
- resolution and closure;
- evidence loops;
- ownership and handoff;
- and terminal states.

The desired output is the **complete handling graph**. The current claim's position is an overlay: supported path, unresolved decision, blocked downstream nodes, and inactive alternatives.

## 8.3 Current public graph

The flagship graph contains an 11-stage main spine from intake through closure. Causation is current; responsibility and remedy remain blocked. Causation alternatives are progressively disclosed. The later claim adds an explicit ventilation-dispute decision and changes evidence ordering.

**Truth status:** Implemented and browser-verified for two handcrafted reference claims; not evidence of general graph inference.

## 8.4 Benchmark lesson

The original corpus largely used one graph skeleton per category, making process recovery artificially easy. The hardened defects release introduced 28 process paths and 12 current nodes. Branch accuracy then exposed the difference:

| Method | Branch accuracy |
|---|---:|
| Category template | 0.068 |
| Static process library | 0.705 |
| Generated reference | 1.000 |

The static process library is a strong baseline and must remain in every evaluation. The scientific question is not whether a model can outscore a deliberately weak category lookup.

## 8.5 Evaluation challenge

Multiple process graphs may be operationally equivalent. Evaluate:

- required decisions covered;
- allowed partial order;
- branch conditions;
- current state;
- safety-critical omissions;
- evidence applicability;
- terminal behavior;
- and expert disagreement type.

Do not rely on raw graph exact match alone.

---

# 9. Process-derived evidence and documents

## 9.1 Canonical dependency

```text
Legal or operational requirement
→ Process question
→ Fact that must be established
→ Evidence capable of establishing it
→ Document or evidence type
→ Current evidence state
```

A document checklist is a compiled operational view, not the primary reasoning object.

## 9.2 Evidence states

The long-term contract should support:

- `sufficient` or `provided_sufficient`;
- `insufficient` or `provided_insufficient`;
- `missing`;
- `conditional`;
- `not_applicable`;
- `present_unreviewed`;
- `conflicting`;
- `future_expected` for longitudinal evaluation only, never exposed to the model at the current episode.

The current public runtime uses sufficient, insufficient, missing, conditional, and not applicable.

## 9.3 Strong design rule

> **Do not request documents because this category usually needs them. Request evidence because a specific process question requires facts that are not established.**

Multiple evidence types may satisfy the same factual need. A technical assessment, moisture measurement, inspection photograph, expert statement, or repair record may each contribute differently. The system should represent evidence goals and acceptable alternatives, not one mandatory filename.

## 9.4 Current public evidence model

Every reference item carries:

- `item_id`;
- title;
- `node_id`;
- `fact_id`;
- current status;
- `why`;
- and sometimes source or acceptance information.

The validator checks that process and fact links exist and that already submitted evidence is not requested again. The UI places evidence state on process decisions and exposes the complete list only as a derived view.

**Truth status:** Implemented and verified as a reference compiler; not model-generated in the public runtime.

## 9.5 Longitudinal behavior

The hardened benchmark evaluates removal of satisfied requests, addition of newly required evidence, branch changes, obsolete-branch removal, readiness timing, and future-evidence leakage. This is necessary because a checklist that is correct only at initial intake is not an operational system.

---

# 10. Swiss-law grounding

## 10.1 Intended pipeline

```text
Claim understanding
→ Claim-specific legal questions
→ Retrieval
→ Official sources and passages
→ Operational interpretation
→ Process implications
→ Evidence implications
```

RAG should not merely return legal text. It should explain why a process decision exists, which condition it constrains, and what uncertainty remains.

## 10.2 Keep four objects distinct

1. **Official source** — legislation, court or authority material, approved internal source.
2. **Retrieved passage** — exact versioned excerpt with source and effective date.
3. **Operational interpretation** — claim-specific explanation generated or written from the passage.
4. **Expert-approved handling rule** — reviewed organizational procedure; not identical to the legal passage.

A source does not automatically validate an interpretation. An interpretation does not automatically become a shared rule.

## 10.3 Current implementation

`data.py` holds a small static law registry. `pipeline_v15.py` creates legal questions, sources, and node links by deterministic reference logic. The frontend attaches source markers to relevant nodes.

**Truth status:** Prototype / generated-reference only. It demonstrates the product relationship but does not establish retrieval quality, legal completeness, currentness, or expert approval.

## 10.4 Required next legal-RAG standard

- approved official-source registry;
- source version and effective date;
- passage-level retrieval with exact citation;
- retrieval recall evaluation on expert questions;
- distinction between retrieved text and generated interpretation;
- qualified Swiss-law review;
- abstention when authority is insufficient or conflicting;
- and regression tests when sources or interpretations change.

---

# 11. Historical claim retrieval

## 11.1 Purpose

The system retrieves up to three cases to provide organizational memory at a difficult decision, not to show generic vector similarity.

Useful dimensions include:

- same legal question;
- same process branch;
- same unresolved fact;
- same evidence need or conflict;
- same exception;
- same downstream correction;
- and useful expert rationale.

A lexically similar claim on a different branch may be useless. A differently worded claim with the same evidence-order correction may be highly valuable.

## 11.2 Current public behavior

The public reference pipeline ranks static historical cases and, after review, places the reviewed flagship memory first for the later claim. Each precedent includes a usefulness explanation and appears inside the relevant decision inspector.

**Truth status:** Prototype / generated-reference only.

## 11.3 Self-retrieval bug

An earlier retrieval path could return the current claim as its own precedent. The fix is a hard exclusion by claim/run identity before ranking. Keep this as a regression test. Similarity score must never override identity exclusion.

## 11.4 Memory value hierarchy

Prefer:

1. qualified expert-reviewed case memory;
2. adjudicated benchmark reference;
3. approved internal playbook examples;
4. generated reference cases;
5. unreviewed model output.

Generated references must not outrank reviewed operational cases merely because their text is closer.

## 11.5 Evaluation

Measure retrieval by downstream usefulness:

- whether the controlling branch matches;
- whether the evidence gap matches;
- whether the correction transfers safely;
- whether the expert finds it useful;
- whether it improves the plan;
- and whether it causes false activation on protected cases.

Recall@k on category labels is insufficient.

---

# 12. Expert feedback and organizational learning

## 12.1 Two distinct outcomes

### One approved case

Becomes **reviewed case memory**. It may immediately help future retrieval, with its source package, process path, evidence context, correction, reviewer, and version preserved.

### Repeated compatible corrections

May become a **candidate reusable process rule or playbook patch**. It must remain quarantined until it passes:

- a support threshold;
- target evaluation;
- adversarial and protected regression;
- expert or process-owner approval;
- versioning;
- effective-date controls;
- and rollback preservation.

One correction must not silently change shared organizational knowledge.

## 12.2 Recurring-condensation and ventilation example

The flagship recurring-mould claim contains disputed causation. The expert correction keeps causation unresolved, arranges one neutral technical assessment first, makes broader building-envelope testing conditional, and introduces explicit testing of the ventilation allegation only when evidence supports that branch.

The later claim uses the reviewed flagship memory and v4 reference playbook. It exposes the ventilation-dispute decision and avoids treating broader building testing as an immediate default request.

This example illustrates:

```text
reviewed case memory
→ candidate evidence-order pattern
→ target and protected checks
→ versioned playbook
→ later claim effect
```

In the public runtime, the support count and evaluation results are generated reference values. The lifecycle is visible; the learning experiment is not genuinely executed.

## 12.3 Review contract

A correction should record:

- target decision or relationship;
- previous value;
- reviewed value;
- reason;
- affected process nodes;
- affected evidence items;
- next-action delta;
- reviewer identity and role;
- timestamp;
- source version;
- and whether it is case-specific or a candidate reusable pattern.

## 12.4 Current public review

The UI offers one consequential choice beside the graph and displays downstream process, evidence, and next-action changes. The API stores a structured review, memory, and candidate.

**Truth status:** Interaction and storage are implemented; the reviewer and promotion evidence are generated-reference only; persistence is ephemeral.

---

# 13. Evaluation and research findings

All numerical results below are generated-fixture results unless explicitly stated otherwise.

## 13.1 Original shortcut audit

| Question | Setup | Result | Interpretation | Change |
|---|---|---|---|---|
| Does category accuracy measure understanding? | 150 bilingual generated claims | Subject-only accuracy **95.3%** | Surface text leaked category | Build neutral/misleading-subject vertical slice |
| Does process performance measure recovery? | Audit original graph targets | One graph skeleton and one intake node per category; all claims submitted | Process recovery reduced largely to category recognition | Add process paths, current nodes, longitudinal episodes, negatives |

## 13.2 Original sparse-feedback experiment

Compared static playbooks, legal-RAG-only, nearest-case reuse, and an adaptive process agent over 4,800 method-claim observations.

At ten examples:

```text
subcategory accuracy: 27.1%
process-node F1: 71.6%
checklist F1: 94.7%
next-action accuracy: 75.0%
whole-plan exact: 2.1%
```

Performance was effectively unchanged from zero examples. Retrieval could reuse outputs but did not reliably induce the controlling rule. The project narrowed to an explicit withheld branch with contrastive and rule-induction methods.

## 13.3 Hardened intake-understanding audit

Two archived snapshots disagree and must remain separate.

Deep-recovery snapshot:

| Input | Balanced accuracy |
|---|---:|
| Subject only | 0.500 |
| First sentence only | 0.500 |
| Message bag of words | 0.500 |
| Attachment names only | 0.550 |
| Full message and attachment text | 0.988 |
| Transparent full-package reference | 1.000 |

Earlier experiment snapshot:

| Input | Balanced accuracy |
|---|---:|
| Subject only | 0.812 |
| Full observable package | 1.000 |
| Transparent reference | 1.000 |

Do not average or silently select a number. Recover the exact split and report version before publication.

## 13.4 Attachment-decisive cases

For 35 attachment-decisive initial episodes:

```text
message-only whole-plan constraint match: 0.200
full observable package: 0.914
```

Attachments materially changed the plan. Attachment sufficiency, conflicts, misleading names, duplicates, irrelevant files, and evidence ownership became first-class.

## 13.5 Process instantiation

| Method | Branch accuracy |
|---|---:|
| Category template | 0.068 |
| Static process library | 0.705 |
| Generated reference | 1.000 |

Category is not enough once within-category branches vary. The static library is a mandatory strong baseline.

## 13.6 Longitudinal claims

The deep report states:

```text
satisfied requests removed: 1.000
newly required requests added: 1.000
required branch changes: 1.000
obsolete branches retained: 0.000
correct readiness timing: 1.000
transition constraints satisfied: 0.977
future-artifact leaks: 0
```

An earlier simplified report says all transition constraints were 1.000 over 88 transitions. Reconcile at case level before a definitive claim.

## 13.7 Negative and out-of-scope cases

The hardened benchmark includes no current dispute, advisory-only, hotel, owner-occupied, wrong jurisdiction, duplicate, insufficient tenancy/dispute evidence, and an adjacent rent issue after a resolved defect.

A safe system must return `not this process`, `insufficient information`, or `no current dispute`; it must not only choose positive branches.

## 13.8 Whole-plan and disagreement-aware evaluation

The expert-ready release contains 30 generated constraint targets, seven disagreement probes, multiple valid alternatives, and typed disagreements: factual, legal, process preference, and annotation error. Exact match alone over-penalizes valid alternatives and hides disagreement cause.

## 13.9 Sparse adaptation methods

Methods already compared:

- static playbook;
- direct few-shot prediction over canonical facts;
- text-similarity retrieval;
- process-state retrieval;
- graph-edit retrieval;
- contrastive demonstrations;
- structured rule induction;
- small decision tree;
- verified program synthesis;
- prepared LLM rule-proposal contract.

The provider-backed LLM arm was not run.

Selected generated-fixture method at three examples:

| Metric | Verified program synthesis |
|---|---:|
| Branch accuracy | 1.000 |
| Critical-document recall | 1.000 |
| Confirmatory false activation | 0.000 |
| Development false activation | 0.000 |
| Protected regression | 0.000 |

Development false activation:

| Method | Rate |
|---|---:|
| Graph-edit retrieval | 0.500 |
| Contrastive demonstrations | 0.250 |
| Decision tree | 0.625 |
| Verified program synthesis | 0.000 |

Verification and narrow predicates mattered more than expressive complexity in this fixture. The result is not yet validated from genuine expert corrections and is not deployed.

## 13.10 Canonical-fact error propagation

| Fact source | Whole-plan match |
|---|---:|
| Perfect reference facts | 1.000 |
| Deterministic extracted facts | 0.917 |
| Local model-extracted facts | 0.000 |

Highest-impact facts were `heating_emergency`, `health_risk`, `deadline_status`, and `landlord_notified`.

> Strong process execution cannot compensate for a weak canonicalizer.

Report mechanism-track results on reference facts separately from end-to-end results on predicted facts.

## 13.11 Operational back-and-forth simulation

Verified-patch process per generated journey:

```text
customer-contact rounds: 1.313
unnecessary requests: 0.000
critical evidence missed: 0.000
expert interventions: 0.208
wrong-ready decisions: 0.000
```

Static category checklist:

```text
9.938 unnecessary requests per journey
```

This supports a generated-simulation hypothesis, not a real customer-friction claim.

## 13.12 Simulated review dry run

Two simulated reviewer profiles completed 60 reviews over 30 items:

```text
approved: 41
approved with edits: 12
escalated: 6
alternative valid plan: 1
exact decision agreement: 0.567
unresolved disagreements: 13
structured edits: 12
median simulated time: 280 seconds
```

The interface can represent disagreement. Simulated reviewers do not validate labels, usability, or review time.

## 13.13 Public product gate

```text
focused checks: 57/57
backend UI-created runs: 2
console errors: 0
page errors: 0
public request failures: 0
390 px overflow: 0
320 px overflow: 0
demo reset: v3
```

This validates the product mechanics only.

## 13.14 Missing confirmatory evidence

Still missing:

- independent Swiss-law review;
- independent process and checklist review;
- blind artifact-realism study;
- source-isolated naturalistic claims;
- equally informed direct-model baseline on expert targets;
- live provider-backed model results;
- timed expert comparison;
- real customer-contact reduction;
- durable multi-version update study;
- and independent reproduction of the integrated product plus hardened benchmark.

---

# 14. Do not rediscover

| Attempt or idea | Why tried | Result | Lesson | Current decision |
|---|---|---|---|---|
| Category-template graphs | Fast baseline | High apparent original scores; 0.068 branch accuracy on hardened variation | Category is not a process instance | **Rejected as primary method; retain baseline** |
| Checklist as independent prediction | Simple supervised task | Plausible but procedurally irrelevant lists | Applicability depends on reached decisions | **Rejected as core; retain baseline** |
| Static category checklist | Simple operational comparator | 9.938 unnecessary requests per generated journey | Generic lists over-request inactive branches | **Rejected for product; mandatory baseline** |
| Next-blocker-centric UX | Focus attention | Hid complete process and made CasePath look like a next-action tool | Full graph plus current overlay | **Rejected as main UX** |
| Giant process modal | Preserve dashboard | Made principal output supplementary | Graph is the claim map | **Abandoned** |
| Report-like result pages | Expose every artifact | User reconstructed relationships mentally | One dominant artifact; detail on demand | **Abandoned** |
| Dense three-column dashboard | Show claim, graph, checklist | High density, low comprehension | Persistent source plus one evolving work pane | **Abandoned for flagship** |
| All agents visible simultaneously | Demonstrate orchestration | Architecture theater and clutter | One current specialist; agent recedes | **Abandoned** |
| Permanent agent rail | Preserve history | Competed with graph | Collapse completed activity | **Removed in v20** |
| Repeated Inspect buttons | Expose technical detail | Control noise | Contextual links plus one audit drawer | **Abandoned** |
| Static safe previews | Avoid raw artifacts | Broke operational realism | Render actual generated PDF, image, email | **Abandoned** |
| Browser-local corrections as learning | Fast demo | No durable inspectable update | Server review, memory, versioned candidate | **Rejected** |
| Text-similarity retrieval | Simple precedent baseline | Vocabulary match, weak decision match | Evaluate downstream usefulness | **Insufficient; retain baseline** |
| Nearest-case reuse | Reuse outputs | 0.556 branch accuracy on withheld pattern | Reuse does not induce a rule | **Insufficient** |
| Exact process-state retrieval | Structured match | 0.333 branch accuracy | Brittle equality misses controlling literals | **Insufficient** |
| Graph-edit retrieval | Reuse prior correction | 0.500 dev false activation | Edit similarity is not trigger validity | **Rejected for promotion** |
| Contrastive demonstrations | Highlight difference | 0.250 dev false activation | Contrast helps but needs verification | **Research baseline** |
| Small decision tree | Transparent induction | 0.625 dev false activation | Transparency is not safety | **Rejected for promotion** |
| Structured rule induction | Learn explicit trigger | Improved generated withheld branch | Needs counterexamples and verification | **Useful, not deployed** |
| Verified program synthesis | Constrained rule search | Perfect selected fixture metrics at three examples | Verification controlled false activation in fixture | **Selected synthetic method; not operationally validated** |
| Provider-backed LLM rule proposal | Flexible induction | Contract prepared; call not run | Never invent provider results | **Planned experiment** |
| Subject-only classification | Cheap intake | 95.3% original accuracy | Surface shortcut | **Rejected as understanding evidence** |
| One graph per category | Easy generation | Predetermined process | Vary branch facts and current state | **Rejected benchmark design** |
| Positive-only cases | Simpler generation | Scope gate could not fail | Include negatives and insufficiency | **Rejected benchmark design** |
| Intake-only snapshots | Simpler labels | No evidence arrival or reversal | Use journeys and episodes | **Rejected benchmark design** |
| Generated exact match as expert truth | Needed targets | No domain validity | Label generated and adjudicate | **Rejected wording** |
| Hard-coded regression as real learning | Show lifecycle | Useful demo only | Keep explicit generated-reference label | **Prototype only** |
| LangChain/Nemotron as current claim | Stronger architecture story | Historical source, unverified current deployment | Separate architecture from deployment truth | **Do not claim current use** |
| Continuous Render deployment during redesign | Immediate feedback | Regressions and SHA confusion | Local acceptance, freeze, deploy once | **Rejected workflow** |
| Endless layered UI patches | Avoid rewrite | v16–v20 dependency and selector drift | Consolidate after truth milestone | **Current debt; do not add v21 casually** |
| Composite usefulness score | Single headline | Hides severe safety failures | Report dimensions and failures separately | **Do not use alone** |
| Broad process-mining platform first | Generality | Infrastructure before feasibility | Validate one bounded vertical slice | **Deferred** |

---

# 15. UX journey and design history

## 15.1 Repeated failure mode

> **Backend sophistication increased while practical usefulness remained hidden behind report-like interfaces.**

Several releases displayed process, evidence, law, precedents, counts, agent metadata, and audit text simultaneously. The product described what happened instead of letting the user experience it.

## 15.2 Accepted flagship journey

```text
Customer submission
→ Agents working
→ Process emerges
→ Evidence attaches to process
→ Relevant experience appears
→ Expert edits reasoning
→ Knowledge is saved
→ Next claim benefits
```

## 15.3 Accepted design principles

- Keep the source claim visible.
- Make generated PDFs, images, and emails inspectable.
- Drive visible analysis from backend events.
- Show one current specialist, not the architecture.
- Let agent activity recede after its artifact appears.
- Make the process graph the hero artifact.
- Never hide the graph in a modal.
- Put evidence state inside decisions.
- Put law on the node it shapes.
- Put prior cases where they help.
- Keep the complete document list derived and secondary.
- Review the actual reasoning artifact.
- Reduce learning to a few comprehensible outcomes.
- End with a later claim.
- Keep audit detail hidden by default.
- Show one dominant idea and one next action at a time.
- Use task language, not paper headings.

## 15.4 Negative examples to preserve

Archived screenshots include dense three-column dashboards, `desktop-review.png`, `desktop-edited.png`, safe-preview placeholders, giant graph modals, permanent team rails, blank loading canvases, and v17/v18 report dumps. Keep them as regression evidence.

## 15.5 Current v20 model

Start: source claim plus one question and `Analyse claim`.

Early analysis: one current specialist and real event rows.

Process onward: orchestrator/progress chrome recedes; graph dominates.

Evidence and experience: node status and focused inspector.

Ready: graph remains primary; document needs open as a temporary derived sheet.

Review: graph plus one consequential choice and delta.

Learning: reviewed case, correction, and shared change.

Later claim: trace recedes; before/after becomes primary.

## 15.6 Current UX debt

- v20 is a DOM-enhancement layer over v16–v19.
- CSS hides legacy components rather than deleting all old presentation code.
- several scripts set mutable release markers;
- internal selectors have already drifted;
- current product master does not contain the exact canonical QA wrapper;
- accessibility testing is basic;
- no first-time-viewer comprehension study exists.

Do not add another additive `live-v21-*` layer. Consolidate only after the evidence-validity milestone and with pixel and interaction parity tests.

---

# 16. Deployment and release history

## 16.1 Current architecture

```text
GitHub repository
├── casepath/       → Render static site
├── casepath-api/   → Render Python web service
└── casepath-qa/    → Render Node/Playwright evidence service
```

### Frontend

```text
service: casepath-swiss-claim-lab
branch: master
publish path: casepath
URL: https://casepath-swiss-claim-lab.onrender.com/
```

### API

```text
service: casepath-agentic-api
branch: master
build: bash casepath-api/render-build.sh
start: bash casepath-api/start.sh
region: Frankfurt
plan: free
URL: https://casepath-agentic-api.onrender.com/
```

### Canonical QA

```text
service: casepath-guided-canonical-qa
runtime: Node plus Playwright Chromium
output: screenshots, report, uninterrupted recording
URL: https://casepath-guided-canonical-qa.onrender.com/
```

## 16.2 Persistence

`storage.py` stores runs, events, reviews, memories, and candidates in SQLite. Default:

```text
CASEPATH_DB_PATH=/tmp/casepath-useful-demo/casepath.db
```

Render `/tmp` is ephemeral. A pilot needs PostgreSQL, migrations, transactions, backups, tenant separation, retention policy, audit immutability, and tested rollback.

## 16.3 Environment variables

Current:

| Variable | Purpose |
|---|---|
| `PORT` | Uvicorn or static evidence server port |
| `CASEPATH_DB_PATH` | SQLite location |
| `BASE_URL` | QA frontend target |
| `API_URL` | QA API target |
| frontend `api` query | local or QA API override |

Historical model prototype required an OpenRouter credential and provider/model configuration. Never store credentials in source, logs, screenshots, or this document.

## 16.4 Preferred workflow

```text
local iteration
→ visual acceptance screenshots
→ full local uninterrupted demo
→ deterministic and browser tests
→ freeze candidate
→ deploy once
→ deployment-only fixes
→ retained production evidence
```

Repeated deployment during design caused regressions, stale caches, SHA confusion, and sideways progress.

## 16.5 Render troubleshooting

- **Stale frontend:** confirm branch, deploy SHA, `publishPath=casepath`, HTML release meta, and loaded asset URLs before clearing cache.
- **Old API behavior:** confirm `app.py` imports `pipeline_v15`, check `/healthz` and `/deployment-health`, compare deploy SHA.
- **QA failure:** distinguish product regression from selector assumption; preserve failure screenshot; do not weaken assertions merely to pass.
- **Late 404 after reset:** close browser context before deleting run state.
- **No open port:** use `$PORT`; QA serves generated output; API uses `start.sh`.
- **Cold start:** use long timeouts and warm before an approved recording; do not add fake progress.

## 16.6 Release discipline

Record separately:

- product SHA;
- API SHA;
- QA SHA;
- benchmark hash;
- schema version;
- model profile;
- legal-source registry version;
- and playbook version.

One `latest` label is insufficient.

---

# 17. Model-cost constraints

Historical model IDs include:

```text
nvidia/nemotron-3-super-120b-a12b:free
nvidia/nemotron-3-ultra-550b-a55b:free
```

Do not assume either remains free or available. Verify current OpenRouter terms before use.

Historical integration used OpenRouter Chat Completions through `ChatOpenAI`, NVIDIA-only routing, fallback disabled, data collection denied, Pydantic structured output, temperature zero, explicit reasoning configuration, and source validation. It is not in the current runtime.

A prior plan budgeted roughly 50 calls: provider/schema smoke, representative English/German cases, adversarial attachment cases, longitudinal cases, regression, deployed acceptance, and reserve. The record stated zero authorized calls had been used.

Rules:

1. Run deterministic schemas, leakage scans, validators, unit tests, and browser tests first.
2. Cache by observable-input hash, claim version, provider, model, prompt, schema, and agent role.
3. Do not spend model calls on UI debugging.
4. Use reference canonical states for mechanism tests.
5. Reserve calls for questions deterministic fixtures cannot answer.
6. Log secret-stripped request/response envelopes.
7. Report provider, parsing, and fallback failures.
8. Never claim Nemotron if another provider or fallback answered.
9. Keep the public demo usable with no model credential.
10. The first live experiment should be a bounded canonicalizer contract, not full autonomous orchestration.

---

# 18. Repository map

## 18.1 Current default branch

| Path | Why open it |
|---|---|
| `casepath/index.html` | Frontend entry, release meta, loading shell, two-pane structure, script order |
| `casepath/assets/live-v16.js` | Core journey and rendering runtime |
| `casepath/assets/live-v16.css` | Base visual system and responsive layout |
| `casepath/assets/live-v16-stability.js` | Core stability protections |
| `casepath/assets/live-v17.js` | Process/evidence/law/precedent enhancements and derived checklist |
| `casepath/assets/live-v17-continuity.css` | Graph continuity styling |
| `casepath/assets/live-v18.js` | Expert-review and learning presentation enhancements |
| `casepath/assets/live-v18-handoff.js` | Event-backed handoff presentation |
| `casepath/assets/live-v18-insertion-guard.js` | Duplicate insertion and polling protections |
| `casepath/assets/live-v19-active-stage.js` | Active-stage synchronization |
| `casepath/assets/live-v19-runtime-stability.js` | Runtime coalescing and observer stability |
| `casepath/assets/live-v19.css` | Node signals, review path, team rail styles inherited by v20 |
| `casepath/assets/live-v20-focus.js` | Focused graph-first interaction, document sheet, review, learning, later-claim result |
| `casepath/assets/live-v20-focus.css` | One-third/two-thirds workspace and suppression of report framing |
| `casepath/release.json` | Stale release metadata; inspect to repair, not as current truth |
| `casepath/source-manifest.json` | Stale source manifest; inspect before replacing |
| `casepath-api/casepath_api/app.py` | Public API routes and deployed pipeline import |
| `casepath-api/casepath_api/pipeline_v15.py` | Current deterministic lifecycle and agent contracts |
| `casepath-api/casepath_api/data.py` | Two public claims, artifacts, law sources, historical references |
| `casepath-api/casepath_api/storage.py` | SQLite schema, run/event/review/memory/candidate persistence |
| `casepath-api/generate_artifacts.py` | Public PDF/email/image generation |
| `casepath-api/render-build.sh` | Build-time artifact generation, hash checks, API smoke |
| `casepath-api/start.sh` | Uvicorn startup |
| `casepath-api/requirements.txt` | Current dependencies; absence of LangChain is important |
| `casepath-api/pipeline.py` | Legacy pipeline; do not confuse with deployed v15 |
| `casepath-api/tests/test_pipeline.py` | Legacy-aligned tests that currently miss v15 |
| `casepath-api/tests/test_api.py` | API tests; verify imports and release assumptions before use |
| `casepath-qa/browser-focused-v20.mjs` | Focused uninterrupted acceptance contract |
| `casepath-qa/browser-guided-v13-smoke.mjs` | Wrapper; current source has drifted from retained passing QA |
| `casepath-qa/package.json` | QA dependencies and scripts |
| `.github/workflows/` | Deployment and QA history; many workflows are release-specific or stale |

## 18.2 Archived research assets to recover

The following names occur in archived releases or reports rather than the current integrated default branch:

```text
corpus-audit-v2.json
manifest.json for the defects vertical slice
benchmark.py
experiment-results.json
experiment-report.md
adaptation comparison report
error-propagation report
interaction-simulation report
expert-review package
run_all.py
bootstrap_and_verify.sh
langchain_agents.py
model profiles and call-budget plan
```

Recover them into an immutable `research/releases/<version>/` structure with checksums. Do not silently re-create from prose.

## 18.3 Recommended future structure

After the immediate milestone, not before:

```text
casepath/
  frontend/
  api/
  contracts/
  validators/
  agents/
  providers/
  law/
  retrieval/
  governance/
  benchmarks/
  experiments/
  tests/
  releases/
```

Do not perform this refactor during evidence validation.

---

# 19. Canonical schemas and examples

These are compact representative examples, not substitutes for source schemas.

## 19.1 Observable claim

```json
{
  "claim_id": "DEF-027-E0-DEMO",
  "language": "de",
  "received_at": "2026-07-28T08:42:00+02:00",
  "subject": "Schimmel im Schlafzimmer",
  "message_artifact_id": "art_customer_email",
  "artifact_ids": [
    "art_lease",
    "art_photo",
    "art_notification",
    "art_management_reply",
    "art_timeline",
    "art_delivery_receipt"
  ]
}
```

No category, branch, checklist, reference process, or future artifact belongs here.

## 19.2 Canonical claim state

```json
{
  "claim_id": "DEF-027-E0-DEMO",
  "facts": [
    {
      "fact_id": "mould_recurring",
      "label": "Recurring mould",
      "value": true,
      "state": "supported",
      "confidence": 0.98,
      "source_refs": [{"artifact_id": "art_customer_email"}]
    },
    {
      "fact_id": "technical_cause",
      "label": "Technical cause",
      "value": null,
      "state": "unknown",
      "confidence": 0.0,
      "source_refs": []
    }
  ],
  "conflicts": ["landlord attributes cause to ventilation"],
  "unknowns": ["technical cause"]
}
```

## 19.3 Process node

```json
{
  "node_id": "causation",
  "title": "Causation assessment",
  "question": "What caused the recurring mould?",
  "kind": "decision",
  "state": "current",
  "fact_ids": ["technical_cause"],
  "legal_source_ids": ["or_259a"],
  "evidence_requirement_ids": ["neutral_assessment", "moisture_measurement"],
  "branches": [
    {"answer": "building_defect", "target": "responsibility"},
    {"answer": "use_related", "target": "responsibility"},
    {"answer": "mixed", "target": "responsibility"},
    {"answer": "insufficient_evidence", "target": "evidence_gap"}
  ]
}
```

## 19.4 Process graph

```json
{
  "graph_id": "mould-process-instance/DEF-027-E0-DEMO",
  "template_version": "mould-playbook-v3",
  "current_node": "causation",
  "nodes": [{"node_id": "intake"}, {"node_id": "causation"}],
  "edges": [
    {"source": "intake", "target": "scope", "condition": "submission received"}
  ],
  "main_spine": [
    "intake", "scope", "dispute", "urgency", "notification",
    "defect", "causation", "responsibility", "remedy", "escalation", "resolution"
  ]
}
```

## 19.5 Evidence item

```json
{
  "item_id": "neutral_technical_assessment",
  "title": "Independent technical assessment",
  "node_id": "causation",
  "fact_id": "technical_cause",
  "goal": "Distinguish building-related, use-related, mixed, or unresolved cause",
  "acceptable_evidence": ["inspection report", "qualified expert statement"],
  "status": "missing",
  "why": "Responsibility and remedy remain blocked until causation is supported"
}
```

## 19.6 Derived document requirement

```json
{
  "document_type": "technical_assessment",
  "derived_from": {
    "node_id": "causation",
    "fact_id": "technical_cause",
    "evidence_item_id": "neutral_technical_assessment"
  },
  "priority": "next",
  "condition": "always while causation remains unresolved",
  "already_satisfied_by": []
}
```

## 19.7 Reviewed case memory

```json
{
  "memory_id": "memory/DEF-027-E0-DEMO/review-1",
  "claim_id": "DEF-027-E0-DEMO",
  "review_status": "approved_with_edit",
  "reviewed_process_path": ["causation", "evidence_gap"],
  "corrections": ["neutral assessment before broader testing"],
  "evidence_context": ["technical cause unresolved"],
  "reviewer_role": "qualified_claim_expert",
  "source_run_id": "run_...",
  "created_at": "..."
}
```

## 19.8 Expert correction

```json
{
  "correction_id": "correction/review-1/evidence-order",
  "target": "causation.building_envelope_mode",
  "before": "required_now",
  "after": "conditional",
  "reason": "Obtain one neutral assessment before activating broader testing",
  "downstream_delta": {
    "process_nodes_added": ["ventilation_dispute"],
    "evidence_changed": ["building_envelope"],
    "next_action": "arrange neutral assessment"
  }
}
```

## 19.9 Candidate knowledge patch

```json
{
  "candidate_id": "candidate/mould-playbook-v4",
  "base_version": "mould-playbook-v3",
  "proposed_change": "Make broader building testing conditional after a neutral assessment",
  "support_memories": ["memory-1", "memory-2", "memory-3"],
  "target_evaluation": {"status": "passed", "manifest": "target-v1"},
  "protected_regression": {"status": "passed", "manifest": "protected-v1"},
  "approval": {"status": "approved", "owner": "process-owner"},
  "new_version": "mould-playbook-v4",
  "rollback_target": "mould-playbook-v3"
}
```

The public demo currently generates an object of this shape, but does not execute genuine target/protected experiments before release.

---

# 20. Precise current-state table

| Capability | State | Evidence | Main limitation | Next action |
|---|---|---|---|---|
| Claim generation | **Prototype / generated-reference only** | Original corpus, hardened benchmark, public artifact generator | Source release fragmented; no blind realism proof | Recover immutable generator release and run realism/leakage audit |
| Document realism | **Implemented but not fully verified** | Inspectable public PDFs, emails, images | Demo disclosure leaks generation; limited realism | Rebuild flagship package to blind operational quality |
| Claim browsing | **Planned for broad corpus; intentionally frozen in v20** | Earlier corpus and UI generations | Current public product exposes two claims only | Do not expand until flagship truth milestone passes |
| Attachment rendering | **Implemented and verified** | Six-page PDF, image, email viewer, extraction separation | Generated artifacts only; accessibility incomplete | Preserve, then test keyboard/screen-reader use |
| Claim interpretation | **Prototype / generated-reference only** | Typed facts and source refs; hardened canonicalizer studies | Public facts predefined; local model result failed | Implement bounded model canonicalizer and fact-level evaluation |
| Legal RAG | **Prototype / generated-reference only** | Static source registry and node links | No live retrieval or expert legal validation | Build versioned official corpus and retrieval benchmark |
| Process discovery | **Prototype / generated-reference only** | Complete public graph and hardened variation experiments | Public graph handcrafted; topology versus instantiation unresolved | Evaluate claim-specific instantiation from predicted facts |
| Checklist generation | **Implemented as deterministic reference compiler** | `node_id`, `fact_id`, `why`, validator, derived view | Not currently model-generated or expert-approved | Compare deterministic compiler, model, and static baseline |
| Historical retrieval | **Prototype / generated-reference only** | Three contextual references and reviewed memory priority | Static cases and deterministic ranking | Evaluate usefulness on reviewed memories and protected negatives |
| Expert review | **Implemented interaction, not domain-validated** | Graph-side choice and stored correction | Simulated/generated reviewer evidence | Conduct qualified independent review |
| Reviewed case memory | **Implemented but ephemeral** | Memory table and later retrieval | `/tmp` SQLite, generated reviewer | Move to durable store and use real approved review |
| Shared knowledge evolution | **Prototype / generated-reference only** | v3→v4 lifecycle and rollback display | Support/tests hard-coded | Execute real manifests and keep candidate quarantined |
| Model/provider swapping | **Implemented historically, absent in current runtime** | Archived provider and LangChain code | Not recovered into current tested architecture | Reintroduce only through canonical adapter after benchmark recovery |
| Live Nemotron | **Not currently implemented or verified** | Historical model profiles only | No authorized current run | Run a bounded cached canonicalizer experiment |
| UI | **Implemented and browser-verified** | v20 focused gate 57/57 | Layered v16–v20 architecture; no comprehension study | Freeze design; validate silent comprehension |
| Persistence | **Implemented but not durable** | SQLite storage | Ephemeral Render filesystem | PostgreSQL, migrations, backup, transactions |
| Deployment | **Implemented** | Live frontend, API, QA | Different SHAs and stale manifests | Generate one release manifest and align QA source |
| Benchmark validity | **Prototype / generated-reference only** | Shortcut audits and hardened release | No expert-approved or real transfer set | Independent adjudication and source-isolated transfer panel |
| Expert validation | **Planned / missing** | Generated review package and simulated dry run | No qualified independent review | Run blinded review with disagreement adjudication |

---

# 21. Irreducible research questions

| Research question | Why engineering alone cannot answer it | Minimum experiment |
|---|---|---|
| Can useful claim-specific handling graphs be inferred from limited operational inputs? | A handcrafted graph or category lookup does not test inference | Frozen claims with expert-adjudicated graph constraints; compare category, static library, model instantiation, and direct-plan baselines |
| Does explicit process reasoning improve evidence requirements? | A plausible checklist may be produced without process | Equal-information comparison: static category checklist, direct checklist model, process-grounded compiler; measure critical recall, false activation, no-repeat, whole-plan validity |
| How should multiple valid graphs be evaluated? | Exact match treats equivalent paths as errors | Expert-defined partial-order and constraint evaluation plus typed disagreement adjudication |
| How much feedback is needed for reusable knowledge? | Generated support counts do not estimate sample complexity | Pre-register withheld pattern; acquire sequential independent expert corrections; evaluate after each support count |
| Which adaptation method avoids false activation? | Positive fit can hide damage to protected cases | Target and adversarial protected manifests comparing retrieval, rule induction, program synthesis, and LLM proposal |
| How do canonical-fact errors propagate? | Reference facts hide end-to-end failure | Report oracle-fact, deterministic-extractor, and model-extractor tracks with per-fact interventions |
| How can old playbooks be protected? | Version labels alone do not show safety | Sequential multi-version update study with rollback drills and protected old-policy cases |
| Does generated performance transfer to real claims? | Synthetic labels and language may encode generator artifacts | Approved source-isolated real or naturalistic panel, blind expert targets, frozen evaluation before tuning |
| Are legal links correct and useful? | Official URLs alone do not validate interpretation | Passage-retrieval recall plus qualified Swiss-law review of source, interpretation, and process implication |
| Does CasePath reduce operational back-and-forth? | Simulation schedule predetermines responses | Timed handler study or controlled pilot measuring contacts, unnecessary requests, missed critical evidence, time, and intervention |
| Do first-time viewers understand the product? | Browser tests validate mechanics, not comprehension | Silent walkthrough with executives, handlers, and researchers; score the ten lifecycle questions without narration |

---

# 22. Immediate next milestone

## 22.1 Milestone

> **Make one flagship recurring-mould claim simultaneously realistic, leakage-clean, model-truthful, expert-reviewed, regression-tested, durable, and visually clear from source intake to later-claim reuse.**

The v20 interaction is already close enough. The next milestone is evidence validity and implementation alignment, not another broad redesign.

## 22.2 Required end-to-end lifecycle

```text
realistic observable package
→ model-backed canonical claim state
→ legal questions and retrieved official passages
→ claim-specific process instantiation
→ process-grounded evidence model
→ reviewed precedent retrieval
→ direct expert correction
→ durable reviewed memory
→ quarantined candidate rule
→ actual target/protected evaluation
→ approved or rejected versioned patch
→ unseen later claim uses only approved knowledge
```

## 22.3 Completion criteria

### Claim reality

- one complete coherent multi-page lease;
- realistic correspondence and email history;
- high-quality photographs;
- consistent identities, dates, address, chronology, and allegation;
- no answer-bearing or generation metadata in evaluated bytes;
- blind realism review by people not involved in generation.

### Canonicalization

- model sees only observable package;
- every fact has exact source refs;
- supported, unknown, conflicting, and alleged states are explicit;
- no hidden-label leakage;
- fact-level evaluation against adjudicated target;
- severe errors on urgency, health, notification, and deadlines surfaced separately.

### Process and evidence

- full graph instantiated from canonical facts and approved playbook, not copied by category;
- current state and blocked downstream decisions correct;
- evidence derived from node and fact;
- no present sufficient evidence requested again;
- conditional evidence activates only on its branch;
- static process-library and direct-checklist baselines included.

### Law

- official source registry versioned;
- passages retrieved and cited exactly;
- operational interpretation separated from source;
- qualified reviewer approves or corrects the claim-specific implications.

### Review and learning

- independent qualified expert edits the graph/evidence artifact;
- reviewed case stored durably;
- one case does not auto-promote a shared rule;
- candidate support is computed from real reviewed memories;
- target and protected manifests execute, not hard-code;
- approval and rollback are transactional and auditable.

### Reuse

- second claim is unseen before freeze;
- reviewed memory and approved playbook source are shown;
- before/after difference comes from actual pipeline outputs;
- no invented benefit;
- protected cases remain unchanged.

### Product and release

- one uninterrupted silent demo answers the ten comprehension questions;
- deterministic tests, fact tests, graph/evidence tests, browser QA, and deployment smoke pass;
- one release manifest records all component SHAs and versions;
- persistence survives service restart;
- retained screenshots, recording, reports, and hashes are published.

## 22.4 Do not work on until this passes

- more claim categories;
- a larger claim browser;
- new agent types;
- another orchestration framework;
- a new frontend redesign;
- more metrics or report pages;
- generalized process mining;
- paper expansion beyond evidence supported by the milestone;
- production integrations;
- or a v21 patch layer.

---

# 23. First 60 minutes

## First 10 minutes — read truth before code

Read:

1. this file through Sections 3, 20, and 22;
2. `casepath/index.html`;
3. `casepath-api/casepath_api/app.py`;
4. the opening, execution, review, and consolidation parts of `pipeline_v15.py`;
5. `casepath-api/casepath_api/data.py`;
6. `casepath-qa/browser-focused-v20.mjs`.

Be able to say:

- public v20 is a deterministic reference demo;
- 150 claims and 48 journeys are separate research assets;
- process→fact→evidence is the central contract;
- current biggest blocker is validity and alignment, not missing UI.

## Next 15 minutes — run current code

```bash
git clone https://github.com/KumarNavish/KumarNavish.github.io.git
cd KumarNavish.github.io
python3 -m venv .venv
source .venv/bin/activate
pip install -r casepath-api/requirements.txt
bash casepath-api/render-build.sh
PORT=8000 bash casepath-api/start.sh
```

In a second terminal:

```bash
python3 -m http.server 8080 --directory casepath
```

Open:

```text
http://localhost:8080/?api=http://localhost:8000
```

Check:

```bash
curl -s http://localhost:8000/healthz
curl -s http://localhost:8000/api/demo
curl -s -X POST http://localhost:8000/api/demo/reset
```

## Next 15 minutes — inspect product states

- inspect the customer message;
- open the lease, photograph, and extraction view;
- click `Analyse claim`;
- watch actual events;
- inspect causation, evidence status, law markers, and precedents;
- review the evidence-order choice;
- approve;
- inspect memory/learning;
- run the later claim.

Do not use a pre-opened result route.

## Next 20 minutes — audit alignment

Create a one-page discrepancy list:

```text
what the UI shows
what pipeline_v15 computes
what the hardened benchmark evaluates
what archived papers claim
what qualified experts have actually validated
```

Then recover:

- hardened benchmark manifest;
- split IDs;
- checksums;
- exact report versions;
- archived LangChain/provider source if needed;
- and the QA-only fixes behind the retained 57/57 pass.

Run the focused QA only after repairing its stale assumptions. Do not weaken product-level assertions.

> **Do not modify code until you can explain the complete current lifecycle and the main unresolved product/research problem in your own words.**

---

# 24. Glossary

| Term | CasePath meaning |
|---|---|
| Observable Claim Package | Customer-visible intake material genuinely available at the current episode: message, files, and intake metadata, excluding hidden labels and future evidence |
| Canonical Claim State | Typed, source-grounded representation of supported, alleged, conflicting, and unknown facts derived only from observable material |
| Process Graph | Complete decision and action structure for handling a claim family or instance, including branches, dependencies, ownership, and terminal states |
| Process Instance | Claim-specific instantiation and current overlay of an approved process graph from this claim's facts, law, and evidence |
| Evidence Requirement | A factual goal and acceptable evidence alternatives needed to resolve a specific process question |
| Document Checklist | Derived operational list of available, missing, conditional, insufficient, and not-applicable evidence or document items |
| Reviewed Case Memory | Versioned record of one expert-reviewed claim, its source context, process path, evidence state, correction, and reviewer provenance |
| Playbook | Approved reusable process, conditions, evidence rules, source links, ownership, version, and rollback metadata |
| Candidate Knowledge Patch | Quarantined proposed change inferred from reviewed evidence; not active until target/protected gates and approval pass |
| Protected Regression Set | Cases, policy versions, branches, and safety constraints that a candidate change must not damage |
| Agent | Replaceable specialist implementation that proposes one canonical artifact under a typed contract; may be deterministic or model-driven |
| Orchestrator | Component that manages shared claim context, stage order, artifact handoffs, retries, and audit; it is not authority over release gates |
| Expert Review | Human validation or correction of the actual process/evidence reasoning artifact, with provenance and downstream delta |
| Knowledge Consolidation | Deterministic and reviewed separation of immediate case memory from candidate reusable knowledge, followed by testing, approval, versioning, and rollback |

---

# 25. Operating rules for future agents

## 25.1 Preserve truth boundaries

Always state whether a result is current, archived, generated, simulated, model-driven, deterministic, expert-reviewed, or merely planned. Never silently upgrade a status.

## 25.2 Keep observable and hidden data physically separate

A prompt instruction is not enough. Use separate paths, schemas, processes, access controls, and leakage tests.

## 25.3 Start from the strong baseline

Every research comparison should include:

- category template;
- static process library;
- direct plan/checklist model with equal information;
- process-grounded method;
- and, where relevant, oracle-fact mechanism track.

Do not manufacture novelty by omitting the static library.

## 25.4 Report mechanism and end-to-end performance separately

Use:

```text
reference canonical facts → process/evidence mechanism quality
predicted canonical facts → end-to-end quality
```

Report the gap and highest-impact fact errors.

## 25.5 Treat severe safety failures separately

Averages must not hide:

- urgency miss;
- health-risk miss;
- wrong jurisdiction;
- unsupported legal implication;
- critical evidence omission;
- premature readiness;
- false shared-rule activation;
- or protected regression.

## 25.6 No shared learning from one case

One approved case becomes memory. Shared change requires repeated compatible support, target evaluation, protected regression, approval, versioning, and rollback.

## 25.7 No sideways product work

Before any change ask:

> Does this make the flagship lifecycle more truthful, understandable, useful, or valid?

If not, do not do it now.

## 25.8 No deployment during active redesign

Work locally, capture every major state, run the uninterrupted demo, freeze the candidate, deploy once, and apply only deployment-specific fixes.

## 25.9 Avoid another architecture reset

The project has already explored static playbooks, deterministic compilers, retrieval, rule induction, program synthesis, durable state graphs, LangChain agents, provider abstraction, and several orchestration narratives. The next milestone needs empirical truth and expert validation, not another framework.

## 25.10 Final self-test

Before modifying code, answer:

1. What is the real problem?
2. Which current component is deterministic?
3. Which current component is model-driven?
4. Which data are observable?
5. Which labels are hidden?
6. Which benchmark is being used?
7. What makes an evidence item applicable?
8. Why is causation unresolved in the flagship?
9. What did the expert correction change?
10. What is saved immediately?
11. What remains quarantined?
12. Which results are generated-reference only?
13. Which current tests are misaligned?
14. What is the next milestone?
15. Which tempting work is out of scope?

If any answer is unclear, do not begin a broad code change.

---

## Evidence registry

### Current product

- [`casepath/index.html`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath/index.html)
- [`casepath/assets/live-v20-focus.js`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath/assets/live-v20-focus.js)
- [`casepath/assets/live-v20-focus.css`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath/assets/live-v20-focus.css)
- [`casepath-api/casepath_api/app.py`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-api/casepath_api/app.py)
- [`casepath-api/casepath_api/pipeline_v15.py`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-api/casepath_api/pipeline_v15.py)
- [`casepath-api/casepath_api/data.py`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-api/casepath_api/data.py)
- [`casepath-api/casepath_api/storage.py`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-api/casepath_api/storage.py)
- [`casepath-api/generate_artifacts.py`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-api/generate_artifacts.py)
- [`casepath-api/render-build.sh`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-api/render-build.sh)
- [`casepath-qa/browser-focused-v20.mjs`](https://github.com/KumarNavish/KumarNavish.github.io/blob/master/casepath-qa/browser-focused-v20.mjs)
- [Live product](https://casepath-swiss-claim-lab.onrender.com/)
- [Live API](https://casepath-agentic-api.onrender.com/)
- [Canonical QA](https://casepath-guided-canonical-qa.onrender.com/)
- [Frozen product commit `a867bb5`](https://github.com/KumarNavish/KumarNavish.github.io/commit/a867bb506d8e3f790806fc21f2a24a011c1cd0bc)

### Known critical defects

1. Release markers disagree across HTML, API, `release.json`, and `source-manifest.json`.
2. Retained QA passes on a QA-only patch not fully merged into product master.
3. Backend tests target legacy `pipeline.py` rather than deployed `pipeline_v15.py`.
4. API build does not run an aligned v15 unit suite.
5. SQLite persistence is ephemeral.
6. Public facts, graph, evidence, law, and promotion are deterministic reference output.
7. Legal grounding lacks qualified review.
8. No independent expert validation exists.
9. No real-world transfer evaluation exists.
10. Current artifacts leak generated-demo markers and are not benchmark-clean.
11. Layered frontend architecture is fragile.
12. No user-comprehension evidence exists.
13. Original benchmark source commit provenance is unresolved.
14. Archived metric snapshots disagree.
15. Several Nemotron IDs occur without one current validated profile.
16. Some papers assume supplied workflow topology while product language says process discovery.

---

## Capability claim matrix

| Topic | Allowed wording now | Forbidden wording now |
|---|---|---|
| Product | Live browser-verified research demonstration | Production claim-handling system |
| Agents | Typed reference-agent stages emit real backend events | Nemotron agents handled the claim |
| Documents | Generated source artifacts are inspectable | Real customer documents |
| Process | Demo constructs and displays a complete reference process graph | System learned the true process |
| Evidence | Reference evidence is linked to decisions and facts | System proved legally required documents |
| Law | Official-source references are linked to nodes | Workflow is legally validated |
| Precedents | Generated references and reviewed demo memory are retrieved | Production historical claims improve decisions |
| Review | Structured demo correction changes downstream artifacts | Experts validated the method |
| Learning | Demo illustrates memory and generated v4 promotion | Organization safely learned a new rule |
| Benefit | Generated simulation reduced unnecessary requests | CasePath reduces customer follow-up |
| Benchmark | Generated bilingual corpus and hardened defects benchmark | Real-world benchmark |
| Reproducibility | Specific archived releases reported internal verification | Current integrated system is independently reproduced |
| Live model | Historical OpenRouter and Nemotron integration exists | Current deployment runs Nemotron |

---

## Final handoff directive

Before adding code, reproduce the flagship journey, recover the hardened benchmark release, and write a one-page discrepancy list between:

```text
what the current product shows
what the current API computes
what the benchmark evaluates
what the paper claims
what experts have actually validated
```

Then pursue Section 22.

The best next contribution is not more machinery. It is to make one lifecycle simultaneously:

- visually clear;
- technically aligned;
- source-grounded;
- model-truthful;
- expert-reviewed;
- regression-tested;
- durable;
- and honestly described.
