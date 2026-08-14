(() => {
  'use strict';

  const CONTRACT = 'casepath.persistent-artifact-canvas/1.0.0';
  const ROOT_ID = 'artifactCanvas';
  const READY_EVENT = 'casepath:artifact-canvas-ready';
  const INTERACTION_EVENT = 'casepath:artifact-canvas-interaction';
  const LATER_MEMORY_VALIDATION_CONTRACT = 'casepath.later-memory-validation/1.0.0';
  const LATER_CAUSAL_STEP_CONTRACT = 'casepath.later-causal-step/1.0.0';
  const PROCESS_NODE_PROGRESS_CONTRACT = 'casepath.process-node-progress/1.0.0';
  const VISUAL_ANNOTATION_CONTRACT = 'casepath.visual-reference-annotation/1.0.0';
  const VISUAL_ANNOTATION_VERSION = 'generated-demo-reference/2026-08-12';
  const VISUAL_ANNOTATION_PRODUCER = 'deterministic_reference_annotation';
  const VISUAL_ANNOTATION_AUTHORITY = 'generated_demo_reference_only';
  const API = (new URLSearchParams(location.search).get('api') || window.CASEPATH_API || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
  const SUCCESS_STATES = new Set(['accepted', 'complete', 'completed', 'passed', 'produced', 'succeeded', 'verified']);
  const PROCESS_GATE_ID = 'deterministic_process_gate';
  const PROCESS_ARTIFACT_IDS = new Set(['process_graph', 'accepted_process_graph']);
  const GRAPH_NODE_DWELL_MS = 1300;
  const GRAPH_SOURCE_DWELL_MS = 1900;
  const GRAPH_BRANCH_SOURCE_DWELL_MS = 1900;
  const PROCESS_NODE_PROGRESS_FORM_MS = 900;
  const PROCESS_NODE_PROGRESS_COMPLETE_MS = 500;
  const PROCESS_NODE_PROGRESS_HOLD_MS = 320;
  const OFFICIAL_LAW_DWELL_MS = 1900;
  const FACT_SOURCE_DWELL_MS = 1600;
  const FACT_NEUTRAL_READ_DWELL_MS = 900;
  const FACT_RESULT_DWELL_MS = 1400;
  const FACT_HERO_RESULT_DWELL_MS = 1800;
  const FACT_HERO_IDS = new Set(['fact_notification', 'fact_recurrence', 'fact_cause']);
  const CURSOR_TRAVEL_MS = 620;
  const CURSOR_SETTLE_MS = 260;
  const FACT_STORY_IDS = Object.freeze([
    'fact_tenancy',
    'fact_notification',
    'fact_recurrence',
    'fact_ventilation_allegation',
    'fact_cause',
  ]);
  const GRAPH_MOMENTS = new Set(['process', 'evidence', 'experience', 'verify', 'ready', 'review', 'review-applied', 'knowledge', 'later-work', 'later-result']);
  const SIMPLIFIED_SPINE_IDS = [
    'intake',
    'scope',
    'dispute',
    'urgency',
    'notification',
    'defect',
    'causation',
    'responsibility',
    'remedy',
    'resolution',
  ];
  const SPATIAL_SPINE_POSITIONS = Object.freeze({
    intake: [9, 15],
    scope: [24, 15],
    dispute: [39, 15],
    urgency: [54, 15],
    notification: [69, 15],
    defect: [84, 15],
    causation: [25, 38],
    responsibility: [48, 38],
    remedy: [65, 38],
    resolution: [82, 38],
    ventilation_dispute: [46, 57],
  });
  const CAUSATION_BRANCH_LAYOUT = Object.freeze([
    ['building_defect', 'Building issue?', 32, 57],
    ['tenant_use', 'Room-use issue?', 47, 57],
    ['mixed_cause', 'Both possible?', 62, 57],
    ['evidence_gap', 'Independent check needed', 78, 57],
  ]);
  const LAW_FIRST_NODE_IDS = new Set(['scope', 'dispute', 'responsibility', 'remedy']);
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const AGENTS = Object.freeze({
    canonical_facts: {
      order: 1,
      label: 'Claim reader',
      short: 'Claim',
      monogram: 'CF',
      signature: 'facts',
      task: 'Reading the claim and keeping only source-backed facts',
      why: 'Each fact must come from an exact passage, field, or image region.',
    },
    orchestrator_plan: {
      order: 2,
      label: 'Work planner',
      short: 'Plan',
      monogram: 'OR',
      signature: 'orchestrator',
      task: 'Giving each specialist one clear job',
      why: 'The team works from one shared claim and one shared plan.',
    },
    document_source_integrity: {
      order: 3,
      label: 'Source checker',
      short: 'Sources',
      monogram: 'DS',
      signature: 'sources',
      task: 'Checking the exact source behind each fact',
      why: 'The viewer can reopen the same source and verify what was used.',
    },
    process_decision_mapping: {
      order: 4,
      label: 'Process builder',
      short: 'Path',
      monogram: 'PM',
      signature: 'process',
      task: 'Building the claim-handling steps',
      why: 'Each step appears only after its reason has been inspected.',
    },
    evidence_checklist: {
      order: 5,
      label: 'Document finder',
      short: 'Docs',
      monogram: 'EC',
      signature: 'evidence',
      task: 'Working out which documents each step needs',
      why: 'Every document need comes from a fact the process must establish.',
    },
    final_claim_brief_audit: {
      order: 6,
      label: 'Result checker',
      short: 'Check',
      monogram: 'FB',
      signature: 'audit',
      task: 'Checking the full result before review',
      why: 'Anything unsupported must stop before it reaches the reviewer.',
    },
  });
  const AGENT_ICONS = Object.freeze({
    facts: '<path d="M4 5.5h16v11H9l-4.5 3v-3H4z"></path><path d="M8 10h.01M12 10h.01M16 10h.01"></path>',
    orchestrator: '<circle cx="12" cy="5.5" r="2.5"></circle><circle cx="5.5" cy="17.5" r="2.5"></circle><circle cx="18.5" cy="17.5" r="2.5"></circle><path d="m10.8 7.7-4 7.5M13.2 7.7l4 7.5M8 17.5h8"></path>',
    sources: '<path d="M5 3.5h9l4 4v5.2M14 3.5v4h4M5 3.5v17h7"></path><circle cx="15.5" cy="16" r="3.5"></circle><path d="m18 18.5 2.5 2.5"></path>',
    process: '<circle cx="7" cy="5" r="2"></circle><circle cx="7" cy="19" r="2"></circle><circle cx="18" cy="12" r="2"></circle><path d="M7 7v10M9 5h3v7h4M9 19h3v-7"></path>',
    evidence: '<path d="M3.5 7.5h6l2-2h9v14h-17z"></path><path d="m8 13 2.2 2.2 4.6-5"></path>',
    audit: '<path d="M12 3 20 6v5c0 5.1-3.1 8.5-8 10-4.9-1.5-8-4.9-8-10V6z"></path><path d="m8.5 12 2.2 2.2 4.8-5"></path>',
  });
  const CURSOR_AVATARS = Object.freeze({
    ...AGENT_ICONS,
    casepath: '<path d="M17.5 7.5A7 7 0 1 0 17.5 16.5"></path><path d="M10 9h5M10 15h5"></path>',
    law: '<path d="M12 4v16M6 7h12M7.5 7 4.5 13h6zM16.5 7l-3 6h6zM8 20h8"></path>',
    reference: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 4 4M8 10.5h5M10.5 8v5"></path>',
    gate: '<path d="M12 3 20 6v5c0 5.1-3.1 8.5-8 10-4.9-1.5-8-4.9-8-10V6z"></path><path d="m8.5 12 2.2 2.2 4.8-5"></path>',
    memory: '<path d="M6 8.5A7 7 0 1 1 5.2 15"></path><path d="M6 4v4.5H1.5M12 8v4l3 2"></path>',
  });

  function setCursorAvatar(cursor, identity = {}) {
    const avatar = cursor?.querySelector('[data-ac-cursor-avatar]');
    if (!avatar) return;
    const signature = String(identity.signature || 'casepath');
    avatar.dataset.agentAvatar = signature;
    avatar.dataset.agentMonogram = String(identity.monogram || 'CP');
    avatar.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${CURSOR_AVATARS[signature] || CURSOR_AVATARS.casepath}</svg>`;
  }
  const AGENT_MOMENTS = Object.freeze({
    canonical_facts: 'understand',
    orchestrator_plan: 'understand',
    document_source_integrity: 'understand',
    process_decision_mapping: 'process',
    evidence_checklist: 'evidence',
    final_claim_brief_audit: 'verify',
  });
  const AGENT_ARTIFACT_LABELS = Object.freeze({
    canonical_facts: 'Canonical claim state',
    orchestrator_plan: 'Bounded specialist focus plan',
    document_source_integrity: 'Source integrity findings',
    process_decision_mapping: 'Process decision contribution',
    evidence_checklist: 'Evidence requirement contribution',
    final_claim_brief_audit: 'Final claim brief audit',
  });

  const DEFAULT_NODE_COPY = Object.freeze({
    intake: ['What happened?', 'What did the customer submit?'],
    scope: ['Is this our claim?', 'Is this a Swiss residential-tenancy claim?'],
    dispute: ['What is disputed?', 'Is there a real disagreement that needs handling?'],
    urgency: ['Is it urgent?', 'Does health, safety, or a deadline require action now?'],
    notification: ['Was the landlord told?', 'Was the landlord or property manager told, and can we show it?'],
    defect: ['Is it recurring?', 'Do the sources show a recurring problem rather than one event?'],
    causation: ['Is the cause proven?', 'What is proven about the cause, and what is still only alleged?'],
    responsibility: ['Who is responsible?', 'Once the cause is proven, who is responsible for the next step?'],
    remedy: ['What happens next?', 'What response is supported by the cause, responsibility, and customer goal?'],
    resolution: ['What closes the claim?', 'Was the agreed action completed, or must the dispute be escalated?'],
  });
  const SPATIAL_NODE_LABELS = Object.freeze({
    intake: 'What happened?', scope: 'Is this our claim?', dispute: 'What is disputed?', urgency: 'Is it urgent?',
    notification: 'Was the landlord told?', defect: 'Is it recurring?', causation: 'Is the cause proven?',
    responsibility: 'Who is responsible?', remedy: 'What happens next?', resolution: 'What closes the claim?',
    ventilation_dispute: 'Ventilation check',
  });
  const CAUSATION_BRANCH_QUESTIONS = Object.freeze({
    building_defect: 'Does the building explain it?',
    tenant_use: 'Does room use explain it?',
    mixed_cause: 'Could both contribute?',
    evidence_gap: 'Is an independent check needed?',
  });
  const SPATIAL_EVIDENCE_LABELS = Object.freeze({
    moisture_measurements: 'Moisture measurements',
    building_envelope: 'Building envelope',
    technical_assessment: 'Independent assessment',
    management_position: 'Management allegation',
    use_evidence: 'Ventilation evidence',
  });

  const MOMENT_COPY = Object.freeze({
    opening: {
      title: 'Opening one shared claim context',
      detail: 'The message and original files remain the source of truth.',
      authority: 'Claim sources',
    },
    read: {
      title: 'Reading the customer message and original files',
      detail: 'Nothing enters the claim state without an exact source.',
      authority: 'Claim sources',
    },
    understand: {
      title: 'Showing the source behind each returned fact',
      detail: 'The active fact is kept beside the passage or image region that supports it.',
      authority: 'Claim reader',
    },
    research: {
      title: 'Opening the exact Swiss-law section',
      detail: 'A cached official passage frames the handling question without deciding technical cause.',
      authority: 'Swiss-law source · qualified review pending',
    },
    process: {
      title: 'Building the handling path',
      detail: 'The accepted process appears one grounded decision at a time.',
      authority: 'Process builder · accepted handling path',
    },
    evidence: {
      title: 'Attaching evidence to the decision it can resolve',
      detail: 'Only the active decision and its local evidence chain are expanded.',
      authority: 'Document finder',
    },
    experience: {
      title: 'Finding the closest reference pattern',
      detail: 'Relevance and provenance remain visible at the difficult branch.',
      authority: 'Reference patterns',
    },
    verify: {
      title: 'Checking the complete playbook',
      detail: 'Grounding, graph integrity and evidence relationships must agree.',
      authority: 'Result checker · accepted result checks',
    },
    ready: {
      title: 'A grounded handling path is ready for review',
      detail: 'Causation stays open; responsibility and remedy remain blocked until competent evidence arrives.',
      authority: 'Handling path ready for review',
    },
    review: {
      title: 'Expert correction',
      detail: 'Change one evidence relationship without resolving causation.',
      authority: 'Simulated demo review',
    },
    'review-applied': {
      title: 'The correction now changes the process',
      detail: 'A ventilation check is added while responsibility remains blocked.',
      authority: 'Unverified case correction',
    },
    knowledge: {
      title: 'Saving one correction for a future claim',
      detail: 'CasePath keeps the ventilation check as unverified case memory; the shared playbook does not change.',
      authority: 'Unverified case memory',
    },
    'later-work': {
      title: 'Checking a separate future claim',
      detail: 'The later claim remains source-isolated while eligible guidance is evaluated.',
      authority: 'New claim · comparing with saved case memory',
    },
    'later-result': {
      title: 'A later claim uses the correction',
      detail: 'Unverified case memory adds one conditional ventilation check; qualified review is still required.',
      authority: 'New claim · case-specific memory comparison',
    },
    failure: {
      title: 'The run stopped safely',
      detail: 'No partial or unsupported result was applied.',
      authority: 'Fail-closed safety boundary',
    },
  });

  const state = {
    root: null,
    moment: 'opening',
    activeAgentId: '',
    completedAgents: new Set(),
    neutralAuthority: '',
    currentEvent: null,
    currentSemanticEventId: '',
    currentSemanticChangeId: '',
    entityLineage: new Map(),
    agentLineage: new Map(),
    eventKeys: new Set(),
    result: null,
    laterResult: null,
    laterMemoryValidation: null,
    laterCausalStep: null,
    facts: [],
    process: null,
    legal: null,
    checklist: null,
    precedents: [],
    verification: null,
    review: null,
    knowledge: null,
    processAccepted: false,
    selectedNodeId: 'causation',
    activeChainKind: 'source',
    focusFactId: '',
    focusLawId: '',
    pendingLawId: '',
    officialLawTourTimer: 0,
    officialLawTourRunning: false,
    officialLawTourComplete: false,
    officialLawTourIndex: 0,
    officialLawTourVisitedIds: new Set(),
    factTourEligible: false,
    factTourRunning: false,
    factTourComplete: false,
    factTourIndex: 0,
    factTourPhase: 'select-source',
    factTourReadArmed: false,
    factTourTimer: 0,
    pendingFactId: '',
    focusEvidenceId: '',
    focusPrecedentId: '',
    visibleNodeIds: new Set(),
    graphRevealTimer: 0,
    graphRevealIndex: 0,
    graphRevealRunning: false,
    pendingGraphNodeId: '',
    pendingBranchNodeId: '',
    visibleBranchIds: new Set(),
    graphDwell: false,
    graphInspecting: false,
    graphInspectionPhase: 'select-source',
    processNodeProgress: null,
    groundingOpen: false,
    manualNodeInspection: false,
    agentAuditOpenId: '',
    cursorCommit: null,
    lastCursorKey: '',
    lastCursorChangeId: '',
    lastCursorEventId: '',
    lastCursorAgentId: '',
    cursorTimer: 0,
    cursorArrivalTimer: 0,
    cursorSettleTimer: 0,
    cursorClickTimer: 0,
    artifactChangeSerial: 0,
    artifactChangeKeys: new Set(),
    sourceExtractions: new Map(),
    sourceExtractionRequests: new Map(),
    claim: null,
  };

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function processNodeProgressLabel(phase, entityKind) {
    if (phase === 'search') return 'Finding source';
    if (phase === 'read') return 'Reading source';
    if (phase === 'extract') return 'Extracting fact';
    if (phase === 'form') return entityKind === 'branch' ? 'Testing outcome' : 'Forming decision';
    if (phase === 'complete') return entityKind === 'branch' ? 'Outcome ready' : 'Decision ready';
    return '';
  }

  function emitProcessNodeProgress(progress, visible) {
    if (!progress) return;
    window.dispatchEvent(new CustomEvent('casepath:process-node-progress', { detail: {
      contract: PROCESS_NODE_PROGRESS_CONTRACT,
      scope: 'visible_evidence_bound_construction',
      processId: state.process?.process_id || '',
      entityKind: progress.entityKind,
      nodeId: progress.nodeId,
      branchId: progress.branchId,
      phase: progress.phase,
      percent: progress.percent,
      label: progress.label,
      visible,
      changeId: progress.changeId,
      eventId: progress.eventId,
      agentId: progress.agentId,
    } }));
  }

  function setProcessNodeProgress(phase, percent, identity = null) {
    const prior = state.processNodeProgress;
    const next = {
      entityKind: String(identity?.entityKind || prior?.entityKind || 'node'),
      nodeId: String(identity?.nodeId || prior?.nodeId || state.pendingGraphNodeId || state.pendingBranchNodeId || ''),
      branchId: String(identity?.branchId || prior?.branchId || ''),
      phase,
      percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
      label: processNodeProgressLabel(phase, String(identity?.entityKind || prior?.entityKind || 'node')),
      changeId: String(identity?.changeId || prior?.changeId || state.lastCursorChangeId || ''),
      eventId: String(identity?.eventId || prior?.eventId || state.lastCursorEventId || ''),
      agentId: String(identity?.agentId || prior?.agentId || state.lastCursorAgentId || ''),
    };
    state.processNodeProgress = next;
    render();
    emitProcessNodeProgress(next, true);
  }

  function clearProcessNodeProgress() {
    const prior = state.processNodeProgress;
    if (!prior) return;
    const cleared = { ...prior, phase: 'cleared', percent: 100, label: '' };
    state.processNodeProgress = null;
    render();
    emitProcessNodeProgress(cleared, false);
  }

  function resetProcessNodeProgress() {
    state.processNodeProgress = null;
  }

  function finishProcessNodeProgress(dwellMs, commit) {
    const clearGapMs = Math.max(0, dwellMs
      - PROCESS_NODE_PROGRESS_FORM_MS
      - PROCESS_NODE_PROGRESS_COMPLETE_MS
      - PROCESS_NODE_PROGRESS_HOLD_MS);
    state.graphRevealTimer = window.setTimeout(() => {
      setProcessNodeProgress('form', 90);
      state.graphRevealTimer = window.setTimeout(() => {
        setProcessNodeProgress('complete', 100);
        state.graphRevealTimer = window.setTimeout(() => {
          clearProcessNodeProgress();
          state.graphRevealTimer = window.setTimeout(commit, clearGapMs);
        }, PROCESS_NODE_PROGRESS_HOLD_MS);
      }, PROCESS_NODE_PROGRESS_COMPLETE_MS);
    }, PROCESS_NODE_PROGRESS_FORM_MS);
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function valueFrom(value, ...keys) {
    for (const key of keys) {
      const returned = value?.[key];
      if (returned !== undefined && returned !== null && String(returned).trim()) return returned;
    }
    return '';
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function normalizeMoment(value) {
    const moment = String(value || '').trim().toLowerCase().replaceAll('_', '-');
    if (MOMENT_COPY[moment]) return moment;
    if (moment === 'complete') return 'ready';
    if (moment === 'later') return 'later-work';
    return '';
  }

  function eventStage(event) {
    return String(valueFrom(event, 'stage', 'moment') || '').trim().toLowerCase().replaceAll('_', '-');
  }

  function eventStatus(event) {
    return String(valueFrom(event, 'status', 'outcome', 'state') || valueFrom(event?.acceptance, 'state') || '').trim().toLowerCase();
  }

  function eventAgentId(event) {
    return String(valueFrom(event, 'agent_id', 'actor_id', 'agentId') || valueFrom(event?.actor, 'id') || '');
  }

  function eventActorType(event) {
    return String(valueFrom(event, 'actor_type', 'actorType') || valueFrom(event?.actor, 'type') || '');
  }

  function eventOutputArtifacts(event) {
    return unique([
      ...asArray(event?.output_artifacts).map(String),
      String(valueFrom(event, 'output_artifact', 'output_artifact_id', 'outputArtifact') || ''),
    ]);
  }

  function eventKey(event, source) {
    return String(valueFrom(event, 'dedupe_key', 'event_id', 'eventId') || [
      source,
      eventStage(event),
      eventStatus(event),
      eventAgentId(event),
      valueFrom(event, 'call_id', 'callId'),
      valueFrom(event, 'output_artifact', 'outputArtifact'),
      valueFrom(event, 'ordinal'),
    ].join(':'));
  }

  function resultFromDetail(detail) {
    const direct = asObject(detail?.result);
    const run = asObject(detail?.run);
    const event = asObject(detail?.event);
    return direct || asObject(run?.result) || asObject(event?.result) || null;
  }

  function storeRunFromDetail(detail) {
    const runId = String(valueFrom(detail, 'runId', 'run_id') || valueFrom(detail?.run, 'run_id'));
    return asObject(detail?.run)
      || (runId ? asObject(window.CasePathRunStore?.get?.(runId)) : null)
      || asObject(window.CasePathRunStore?.get?.());
  }

  function eventFromDetail(detail) {
    return asObject(detail?.event)
      || asObject(detail?.runEvent)
      || asObject(detail?.semanticEvent)
      || asObject(detail);
  }

  function isLaterPayload(detail, result) {
    const run = asObject(detail?.run);
    const claimId = String(valueFrom(result, 'claim_id') || valueFrom(run, 'claim_id') || valueFrom(detail, 'claimId', 'claim_id'));
    return detail?.later === true || claimId === 'DEMO-MOULD-002' || normalizeMoment(detail?.moment) === 'later-result';
  }

  function mergeCanonicalResult(detail) {
    const storeRun = storeRunFromDetail(detail);
    const result = resultFromDetail(detail) || asObject(storeRun?.result) || null;
    const direct = asObject(detail?.dto) || asObject(detail?.artifact);
    const source = result || direct || asObject(storeRun);
    if (!source) return;

    if (isLaterPayload(detail, source)) {
      state.laterResult = { ...(state.laterResult || {}), ...source };
      return;
    }

    state.result = { ...(state.result || {}), ...source };
    const understanding = asObject(source.understanding);
    const facts = asArray(source.facts).length ? source.facts : asArray(understanding?.facts);
    if (facts.length) state.facts = facts;
    if (asObject(source.process)) state.process = source.process;
    if (asObject(source.legal_research)) state.legal = source.legal_research;
    else if (asObject(source.legal)) state.legal = source.legal;
    if (asObject(source.checklist)) state.checklist = source.checklist;
    if (asArray(source.precedents).length) state.precedents = source.precedents;
    if (asObject(source.verification)) state.verification = source.verification;
    if (asObject(source.review)
      && (!state.review?.memory_id || source.review.memory_id)) state.review = source.review;
    if (asObject(source.knowledge)) state.knowledge = source.knowledge;

    const directFacts = asArray(detail?.facts);
    if (directFacts.length) state.facts = directFacts;
    if (asObject(detail?.process)) state.process = detail.process;
    if (asObject(detail?.legal)) state.legal = detail.legal;
    if (asObject(detail?.checklist)) state.checklist = detail.checklist;
    if (asArray(detail?.precedents).length) state.precedents = detail.precedents;
  }

  function isAcceptedProcessGate(event, detail) {
    if (detail?.processAccepted === true || detail?.acceptedProcess === true) return true;
    if (event?.type === 'process_node.created'
      && event?.acceptance?.state === 'accepted'
      && event?.acceptance?.gate_id
      && asObject(event?.entity?.value)) return true;
    const id = eventAgentId(event);
    const status = eventStatus(event);
    const outputs = eventOutputArtifacts(event);
    return eventActorType(event) === 'deterministic_gate'
      && id === PROCESS_GATE_ID
      && SUCCESS_STATES.has(status)
      && outputs.some(output => PROCESS_ARTIFACT_IDS.has(output));
  }

  function setMoment(moment) {
    const normalized = normalizeMoment(moment);
    if (!normalized) return;
    if (normalized !== state.moment) {
      state.manualNodeInspection = false;
      state.agentAuditOpenId = '';
      if (state.root && ['review', 'review-applied', 'knowledge', 'later-work', 'later-result'].includes(normalized)) {
        clearActiveSource();
      }
    }
    state.moment = normalized;
    if (normalized === 'later-result' && asObject(state.laterResult)) {
      const later = state.laterResult;
      if (asArray(later.facts).length) state.facts = later.facts;
      if (asObject(later.process)) state.process = later.process;
      if (asObject(later.legal_research)) state.legal = later.legal_research;
      if (asObject(later.checklist)) state.checklist = later.checklist;
      if (asArray(later.precedents).length) state.precedents = later.precedents;
      if (asObject(later.verification)) state.verification = later.verification;
      state.processAccepted = Boolean(state.process);
      const laterNodeIds = new Set(asArray(state.process?.nodes).map(node => node.node_id));
      state.visibleNodeIds = new Set(SIMPLIFIED_SPINE_IDS.filter(nodeId => laterNodeIds.has(nodeId)));
      if (laterNodeIds.has('ventilation_dispute')) state.visibleNodeIds.add('ventilation_dispute');
      state.selectedNodeId = laterNodeIds.has('ventilation_dispute') ? 'ventilation_dispute' : (state.process?.current_node || 'causation');
    }
    if (normalized === 'evidence' && state.focusEvidenceId) {
      const focusedEvidence = asArray(state.checklist?.items).find(item => item.item_id === state.focusEvidenceId);
      const ownerId = evidenceOwnerIds(focusedEvidence).find(nodeId => Boolean(nodeById(nodeId)));
      if (ownerId) state.selectedNodeId = ownerId;
    }
    if (normalized === 'experience' && state.precedents.length) {
      const focusedPrecedent = state.precedents.find(item => Number(item.ranking?.rank) === 1)
        || state.precedents.find(item => item.claim_id === state.focusPrecedentId)
        || state.precedents[0];
      state.focusPrecedentId = focusedPrecedent?.claim_id || '';
      const factor = asArray(focusedPrecedent?.ranking?.factors).find(item => (
        ['current_process_node', 'process_branch'].includes(item.factor) && nodeById(item.value)
      ));
      if (factor?.value) state.selectedNodeId = factor.value;
    }
    if (normalized === 'review') state.selectedNodeId = 'causation';
    if (normalized === 'review-applied' && nodeById('ventilation_dispute')) state.selectedNodeId = 'ventilation_dispute';
    if (['knowledge', 'later-work'].includes(normalized) && nodeById('ventilation_dispute')) state.selectedNodeId = 'ventilation_dispute';
    if (normalized === 'research') state.neutralAuthority = 'official-law-registry';
    else if (normalized === 'experience') state.neutralAuthority = 'historical-ranking';
    else if (normalized === 'verify') state.neutralAuthority = (
      state.activeAgentId === 'final_claim_brief_audit' || state.completedAgents.has('final_claim_brief_audit')
    ) ? '' : 'whole-playbook-gate';
    else if (normalized === 'later-work') state.neutralAuthority = 'case-memory-comparison';
    else state.neutralAuthority = '';
    chooseChainForMoment();
    if (normalized === 'process' && state.processAccepted && processProjectionReady() && !state.graphRevealRunning && state.visibleNodeIds.size === 0) {
      startGraphReveal();
    }
  }

  function chooseChainForMoment() {
    const preferred = {
      research: 'law',
      process: 'source',
      evidence: 'evidence',
      experience: 'reference',
      verify: 'evidence',
      ready: 'evidence',
    }[state.moment];
    if (preferred) state.activeChainKind = preferred;
  }

  function setAgent(agentId, event = null) {
    if (!AGENTS[agentId]) return;
    if (state.activeAgentId && state.activeAgentId !== agentId) state.completedAgents.add(state.activeAgentId);
    state.activeAgentId = agentId;
    state.neutralAuthority = '';
    const eventId = String(valueFrom(event, 'event_id', 'eventId', 'dedupe_key') || '');
    if (eventId) {
      state.agentLineage.set(agentId, {
        eventId,
        changeId: `event:${eventId}:agent:${agentId}`,
        agentId,
      });
    }
    if (SUCCESS_STATES.has(eventStatus(event))) state.completedAgents.add(agentId);
  }

  function entitySurfaceKind(kind) {
    if (kind === 'official_source' || kind === 'handling_principle') return 'law';
    if (kind === 'evidence_requirement') return 'evidence';
    if (kind === 'rejected_proposal' || kind === 'verification') return 'verification';
    return kind;
  }

  function entityLineageKey(kind, entityId) {
    return `${entitySurfaceKind(String(kind || ''))}:${String(entityId || '')}`;
  }

  function rememberSemanticLineage(event) {
    const entity = asObject(event?.entity);
    const eventId = String(valueFrom(event, 'event_id', 'eventId', 'dedupe_key') || '');
    if (!entity?.kind || !entity?.id || !eventId) return;
    const agentId = eventAgentId(event);
    const lineage = {
      eventId,
      changeId: `semantic:${eventId}`,
      agentId,
      actorType: eventActorType(event),
      eventType: String(event.type || ''),
    };
    state.entityLineage.set(entityLineageKey(entity.kind, entity.id), lineage);
    if (agentId) {
      const acceptedAgentLineage = state.agentLineage.get(agentId);
      if (lineage.actorType === 'nemotron_agent' || acceptedAgentLineage?.actorType !== 'nemotron_agent') {
        state.agentLineage.set(agentId, lineage);
      }
    }
  }

  function lineageFor(kind, entityId) {
    const exact = state.entityLineage.get(entityLineageKey(kind, entityId));
    if (exact) return exact;
    if (kind === 'agent_output') return state.agentLineage.get(String(entityId || '')) || null;
    if (kind === 'verification') {
      return state.entityLineage.get(entityLineageKey('verification', 'whole_playbook_verification'))
        || state.agentLineage.get('final_claim_brief_audit')
        || null;
    }
    return null;
  }

  function processProjectionReady() {
    return SIMPLIFIED_SPINE_IDS.every(nodeId => (
      state.entityLineage.has(entityLineageKey('process_node', nodeId))
      && Boolean(nodeById(nodeId))
    ));
  }

  function updateSemanticFocus(detail, event) {
    const entity = asObject(event?.entity) || {};
    const links = asObject(event?.links) || {};
    const factId = String(valueFrom(detail, 'factId', 'fact_id') || valueFrom(event, 'fact_id', 'factId') || (entity.kind === 'fact' ? entity.id : '') || links.fact_id || '');
    const nodeId = String(valueFrom(detail, 'nodeId', 'node_id') || valueFrom(event, 'node_id', 'nodeId') || (entity.kind === 'process_node' ? entity.id : '') || links.process_node_id || asArray(links.process_node_ids)[0] || '');
    const lawId = String(valueFrom(detail, 'lawId', 'law_id', 'sourceId', 'source_id') || valueFrom(event, 'law_id', 'source_id') || (['official_source', 'handling_principle'].includes(entity.kind) ? entity.id : '') || asArray(links.legal_source_ids)[0] || '');
    const evidenceId = String(valueFrom(detail, 'evidenceId', 'evidence_id', 'itemId', 'item_id') || valueFrom(event, 'item_id', 'evidence_id') || (entity.kind === 'evidence_requirement' ? entity.id : '') || '');
    const precedentId = String(valueFrom(detail, 'precedentId', 'precedent_id', 'claimId', 'claim_id') || valueFrom(event, 'precedent_id') || (entity.kind === 'precedent' ? entity.id : '') || '');
    if (factId) state.focusFactId = factId;
    if (nodeId && !state.graphRevealRunning) state.selectedNodeId = nodeId;
    if (lawId) state.focusLawId = lawId;
    if (evidenceId) state.focusEvidenceId = evidenceId;
    if (precedentId && /^HIST-|^DEF-|^DEMO-/.test(precedentId)) state.focusPrecedentId = precedentId;
  }

  function ingest(detail = {}, source = 'semantic') {
    mount();
    const event = eventFromDetail(detail) || {};
    const key = eventKey(event, source);
    const dedupeEvent = source !== 'render' && source !== 'snapshot';
    if (key && dedupeEvent && state.eventKeys.has(key)) return;
    if (key && dedupeEvent) state.eventKeys.add(key);

    mergeCanonicalResult(detail);
    if (detail?.later === true && (source === 'semantic' || source === 'snapshot')) return;
    if (source === 'run') {
      const runAgentId = eventAgentId(event);
      const runEventId = String(valueFrom(event, 'event_id', 'eventId', 'dedupe_key') || '');
      if (eventActorType(event) === 'nemotron_agent' && AGENTS[runAgentId] && runEventId) {
        state.agentLineage.set(runAgentId, {
          eventId: runEventId,
          changeId: `event:${runEventId}`,
          agentId: runAgentId,
          actorType: 'nemotron_agent',
          eventType: 'run.activity',
        });
      }
      return;
    }
    if (source !== 'render' && source !== 'semantic' && source !== 'snapshot') state.currentEvent = event;
    if (source === 'semantic') {
      state.currentSemanticEventId = String(valueFrom(event, 'event_id', 'eventId', 'dedupe_key') || '');
      state.currentSemanticChangeId = `semantic:${state.currentSemanticEventId || eventKey(event, source)}`;
      rememberSemanticLineage(event);
      mergeSemanticEntity(event);
      if (isAcceptedProcessGate(event, detail)) state.processAccepted = true;
      updateSemanticFocus(detail, event);
      maybeStartFactSourceTour();
      if (state.moment === 'process' && state.processAccepted && processProjectionReady()
        && !state.graphRevealRunning && state.visibleNodeIds.size === 0) {
        startGraphReveal();
      }
      return;
    }
    if (source === 'law-step' && detail?.sourceId) {
      if (detail.tourOwner === CONTRACT || state.officialLawTourRunning) return;
      const desiredLawId = String(detail.sourceId);
      const lineage = lineageFor('law', desiredLawId);
      state.moment = 'research';
      state.neutralAuthority = 'official-law-registry';
      state.pendingLawId = desiredLawId;
      state.lastCursorChangeId = visibleChangeId('law', desiredLawId, lineage);
      state.lastCursorEventId = lineage?.eventId || '';
      state.lastCursorAgentId = lineage?.agentId || 'official_law_registry';
      state.cursorCommit = () => {
        if (state.pendingLawId !== desiredLawId) return;
        state.pendingLawId = '';
        state.focusLawId = desiredLawId;
        setActiveSourceLocator(lawLocatorId({ source_id: desiredLawId }));
        render();
      };
      render();
      return;
    }
    updateSemanticFocus(detail, event);

    const explicitMoment = normalizeMoment(detail?.moment) || normalizeMoment(event?.moment);
    const stageMoment = normalizeMoment(eventStage(event));
    if (explicitMoment) setMoment(explicitMoment);
    else if (stageMoment && stageMoment !== 'agent-orchestration') setMoment(stageMoment);
    if (source === 'render' && eventActorType(state.currentEvent) === 'nemotron_agent') {
      const currentAgentMoment = AGENT_MOMENTS[eventAgentId(state.currentEvent)];
      if (currentAgentMoment && currentAgentMoment !== state.moment) state.currentEvent = null;
    }
    const actorType = eventActorType(event);
    const agentId = eventAgentId(event);
    if (actorType === 'nemotron_agent' && AGENTS[agentId]) setAgent(agentId, event);
    if (source === 'agent-focus' && AGENTS[String(detail?.agentId || '')]) setAgent(String(detail.agentId), event);

    if (isAcceptedProcessGate(event, detail)) acceptProcess();
    if (detail?.processAccepted === true && state.process) acceptProcess();
    const run = storeRunFromDetail(detail);
    const runStatus = String(valueFrom(run, 'status', 'state') || '').toLowerCase();
    const terminalSnapshot = source === 'snapshot'
      && (detail?.terminal === true || ['complete', 'completed', 'succeeded'].includes(runStatus));
    if (terminalSnapshot && state.process && state.verification) acceptProcess();

    if (state.moment === 'experience' && state.precedents.length && !state.focusPrecedentId) {
      state.focusPrecedentId = state.precedents[0]?.claim_id || '';
      const factor = asArray(state.precedents[0]?.ranking?.factors).find(item => (
        ['current_process_node', 'process_branch'].includes(item.factor) && nodeById(item.value)
      ));
      if (factor?.value) state.selectedNodeId = factor.value;
    }
    render();
  }

  function ingestClaim(detail = {}) {
    const claim = asObject(detail.claim);
    if (claim) {
      state.claim = claim;
      asArray(claim.artifacts).forEach(artifact => {
        if (!String(artifact?.media_type || '').startsWith('image/')) ensureSourceExtraction(artifact.artifact_id);
      });
    }
    mount();
    render();
  }

  function mergeSemanticEntity(event) {
    const entity = asObject(event?.entity);
    const value = asObject(entity?.value);
    if (!entity || !value) return;
    if (entity.kind === 'fact') {
      const next = state.facts.filter(item => item.fact_id !== entity.id);
      next.push(value);
      state.facts = next;
      return;
    }
    if (entity.kind === 'official_source' || entity.kind === 'handling_principle') {
      const legal = state.legal || { sources: [], handling_principles: [], questions: [], node_links: {} };
      const key = entity.kind === 'official_source' ? 'sources' : 'handling_principles';
      legal[key] = asArray(legal[key]).filter(item => item.source_id !== entity.id).concat(value);
      state.legal = legal;
      return;
    }
    if (entity.kind === 'precedent') {
      state.precedents = state.precedents.filter(item => item.claim_id !== entity.id).concat(value)
        .sort((a, b) => Number(a.ranking?.rank || 999) - Number(b.ranking?.rank || 999));
      return;
    }
    if (entity.kind === 'process_node') {
      const process = state.process || { nodes: [], edges: [], main_spine: SIMPLIFIED_SPINE_IDS };
      process.nodes = asArray(process.nodes).filter(item => item.node_id !== entity.id).concat(value);
      const incoming = asArray(event.links?.incoming_edges);
      if (incoming.length) {
        const incomingKeys = new Set(incoming.map(item => `${item.source}:${item.target}`));
        process.edges = asArray(process.edges).filter(item => !incomingKeys.has(`${item.source}:${item.target}`)).concat(incoming);
      }
      state.process = process;
      return;
    }
    if (entity.kind === 'evidence_requirement') {
      const checklist = state.checklist || { items: [] };
      checklist.items = asArray(checklist.items).filter(item => item.item_id !== entity.id).concat(value);
      state.checklist = checklist;
    }
  }

  function acceptProcess() {
    if (!state.process || !asArray(state.process.nodes).length) return;
    if (state.processAccepted) {
      if (state.moment === 'process' && processProjectionReady() && !state.graphRevealRunning && state.visibleNodeIds.size === 0) startGraphReveal();
      reconcileGraph();
      return;
    }
    state.processAccepted = true;
    state.selectedNodeId = state.process.current_overlay?.current_node_id || state.process.current_node || 'causation';
    if (state.moment === 'process' && processProjectionReady()) startGraphReveal();
    else reconcileGraph();
  }

  function simplifiedNodes() {
    const byId = new Map(asArray(state.process?.nodes).map(node => [node.node_id, node]));
    const projectedIds = [...SIMPLIFIED_SPINE_IDS];
    if (byId.has('ventilation_dispute')
      && state.moment !== 'later-work'
      && (state.result?.review_transform || state.moment === 'later-result')) {
      projectedIds.splice(projectedIds.indexOf('causation') + 1, 0, 'ventilation_dispute');
    }
    return projectedIds.map(nodeId => {
      const returned = byId.get(nodeId);
      const fallback = DEFAULT_NODE_COPY[nodeId] || [nodeId.replaceAll('_', ' '), ''];
      return returned || {
        node_id: nodeId,
        title: fallback[0],
        question: fallback[1],
        state: 'future',
        fact_ids: [],
        legal_source_ids: [],
        evidence_requirement_ids: [],
      };
    });
  }

  function startGraphReveal() {
    window.clearTimeout(state.graphRevealTimer);
    state.visibleNodeIds.clear();
    state.visibleBranchIds.clear();
    state.graphRevealIndex = 0;
    state.graphRevealRunning = true;
    state.pendingGraphNodeId = '';
    state.graphDwell = false;
    state.graphInspecting = false;
    state.graphInspectionPhase = 'select-source';
    resetProcessNodeProgress();
    state.cursorCommit = null;
    const nodes = simplifiedNodes();
    window.dispatchEvent(new CustomEvent('casepath:artifact-process-started', { detail: {
      processId: state.process?.process_id || '',
      nodeCount: nodes.length,
    } }));
    const revealNext = () => {
      const node = nodes[state.graphRevealIndex];
      if (!node) {
        startBranchReveal();
        return;
      }
      const lineage = lineageFor('process_node', node.node_id);
      state.pendingGraphNodeId = node.node_id;
      state.selectedNodeId = node.node_id;
      state.lastCursorChangeId = visibleChangeId('process_node', node.node_id, lineage);
      state.lastCursorEventId = lineage?.eventId || '';
      state.lastCursorAgentId = lineage?.agentId || '';
      state.graphInspecting = true;
      state.graphInspectionPhase = 'select-source';
      clearActiveSource();
      const commitNode = () => {
        if (state.pendingGraphNodeId !== node.node_id) return;
        state.pendingGraphNodeId = '';
        state.graphInspecting = false;
        state.graphInspectionPhase = 'select-source';
        state.visibleNodeIds.add(node.node_id);
        state.graphRevealIndex += 1;
        state.graphDwell = true;
        render();
        state.graphRevealTimer = window.setTimeout(() => {
          state.graphDwell = false;
          revealNext();
        }, GRAPH_NODE_DWELL_MS);
      };
      const highlightSource = () => {
        if (state.pendingGraphNodeId !== node.node_id) return;
        const inspectionTarget = state.root?.querySelector('[data-ac-inspection-target="true"]');
        if (!inspectionTarget || inspectionTarget.dataset.inspectionPhase !== 'read-source') return;
        const sourceKind = inspectionTarget.dataset.sourceId
          ? 'claim-source'
          : inspectionTarget.dataset.lawId
            ? 'swiss-law'
            : inspectionTarget.dataset.evidenceId
              ? 'evidence-requirement'
              : 'accepted-process-input';
        const sourceId = inspectionTarget.dataset.sourceId
          || inspectionTarget.dataset.lawId
          || inspectionTarget.dataset.evidenceId
          || inspectionTarget.dataset.inspectionId
          || '';
        const factId = inspectionTarget.dataset.factId || '';
        const locatorId = inspectionTarget.dataset.sourceLocatorId || '';
        const found = nodeInspectionBasis(node).finding || '';
        emitInteraction('confirm-source', inspectionTarget);
        state.graphInspectionPhase = 'highlight-source';
        state.cursorCommit = null;
        render();
        window.dispatchEvent(new CustomEvent('casepath:source-highlighted', { detail: {
          entityKind: 'node', nodeId: node.node_id, changeId: state.lastCursorChangeId,
          eventId: state.lastCursorEventId, agentId: state.lastCursorAgentId,
          sourceId, factId, locatorId,
        } }));
        window.dispatchEvent(new CustomEvent('casepath:source-inspection', { detail: {
          entityKind: 'node',
          nodeId: node.node_id,
          changeId: state.lastCursorChangeId,
          eventId: state.lastCursorEventId,
          agentId: state.lastCursorAgentId,
          sourceKind,
          sourceId,
          factId,
          locatorId,
          found,
        } }));
        setProcessNodeProgress('extract', 72);
        finishProcessNodeProgress(GRAPH_SOURCE_DWELL_MS, commitNode);
      };
      state.cursorCommit = () => {
        if (state.pendingGraphNodeId !== node.node_id) return;
        const inspectionTarget = state.root?.querySelector('[data-ac-inspection-target="true"]');
        if (!inspectionTarget || inspectionTarget.dataset.inspectionPhase !== 'select-source') return;
        if (inspectionTarget.dataset.sourceId) markSubmissionSource(inspectionTarget.dataset.sourceId);
        if (inspectionTarget.dataset.sourceLocatorId) setActiveSourceLocator(inspectionTarget.dataset.sourceLocatorId);
        emitInteraction(inspectionTarget.dataset.acAction || 'inspect', inspectionTarget);
        state.graphInspectionPhase = 'read-source';
        state.cursorCommit = highlightSource;
        setProcessNodeProgress('read', 38);
      };
      setProcessNodeProgress('search', 0, {
        entityKind: 'node',
        nodeId: node.node_id,
        changeId: state.lastCursorChangeId,
        eventId: state.lastCursorEventId,
        agentId: state.lastCursorAgentId,
      });
    };
    revealNext();
  }

  function branchRevealItems() {
    const causation = nodeById('causation');
    return CAUSATION_BRANCH_LAYOUT.flatMap(([nodeId]) => {
      const node = nodeById(nodeId);
      const branch = causation?.branches?.find(item => item.target === nodeId);
      const edge = asArray(state.process?.edges).find(item => item.source === 'causation' && item.target === nodeId);
      return node && branch && edge ? [{ node, branch }] : [];
    });
  }

  function finishGraphReveal() {
    state.graphRevealRunning = false;
    state.pendingGraphNodeId = '';
    state.pendingBranchNodeId = '';
    state.graphDwell = false;
    state.graphInspecting = false;
    state.graphInspectionPhase = 'select-source';
    resetProcessNodeProgress();
    state.cursorCommit = null;
    clearActiveSource();
    state.selectedNodeId = state.process?.current_overlay?.current_node_id || state.process?.current_node || 'causation';
    state.activeChainKind = 'source';
    render();
    window.dispatchEvent(new CustomEvent('casepath:artifact-process-complete', { detail: {
      processId: state.process?.process_id || '',
      nodeCount: simplifiedNodes().length,
    } }));
  }

  function startBranchReveal() {
    const items = branchRevealItems().filter(({ node }) => !state.visibleBranchIds.has(node.node_id));
    const current = items[0];
    if (!current) {
      finishGraphReveal();
      return;
    }
    const { node, branch } = current;
    const lineage = lineageFor('process_node', node.node_id) || lineageFor('branch', branch.branch_id);
    state.pendingGraphNodeId = '';
    state.pendingBranchNodeId = node.node_id;
    state.selectedNodeId = node.node_id;
    state.lastCursorChangeId = visibleChangeId('branch', branch.branch_id, lineage);
    state.lastCursorEventId = lineage?.eventId || '';
    state.lastCursorAgentId = lineage?.agentId || '';
    state.graphInspecting = true;
    state.graphInspectionPhase = 'select-source';
    clearActiveSource();
    const highlightSource = () => {
      if (state.pendingBranchNodeId !== node.node_id) return;
      const inspectionTarget = state.root?.querySelector('[data-ac-inspection-target="true"]');
      if (!inspectionTarget || inspectionTarget.dataset.inspectionPhase !== 'read-source') return;
      const sourceKind = inspectionTarget.dataset.sourceId ? 'claim-source' : inspectionTarget.dataset.lawId ? 'swiss-law' : inspectionTarget.dataset.evidenceId ? 'evidence-requirement' : 'accepted-process-input';
      const sourceId = inspectionTarget.dataset.sourceId || inspectionTarget.dataset.lawId || inspectionTarget.dataset.evidenceId || inspectionTarget.dataset.inspectionId || '';
      const factId = inspectionTarget.dataset.factId || '';
      const locatorId = inspectionTarget.dataset.sourceLocatorId || '';
      const found = nodeInspectionBasis(node).finding || '';
      emitInteraction('confirm-source', inspectionTarget);
      state.graphInspectionPhase = 'highlight-source';
      state.cursorCommit = null;
      render();
      window.dispatchEvent(new CustomEvent('casepath:source-highlighted', { detail: {
        entityKind: 'branch', nodeId: node.node_id, branchId: branch.branch_id,
        changeId: state.lastCursorChangeId, eventId: state.lastCursorEventId,
        agentId: state.lastCursorAgentId, sourceId, factId, locatorId,
      } }));
      window.dispatchEvent(new CustomEvent('casepath:source-inspection', { detail: {
        entityKind: 'branch',
        nodeId: node.node_id,
        branchId: branch.branch_id,
        changeId: state.lastCursorChangeId,
        eventId: state.lastCursorEventId,
        agentId: state.lastCursorAgentId,
        sourceKind,
        sourceId,
        factId,
        locatorId,
        found,
      } }));
      setProcessNodeProgress('extract', 72);
      finishProcessNodeProgress(GRAPH_BRANCH_SOURCE_DWELL_MS, () => {
        state.visibleBranchIds.add(node.node_id);
        state.pendingBranchNodeId = '';
        state.graphInspecting = false;
        state.graphInspectionPhase = 'select-source';
        state.cursorCommit = null;
        render();
        window.dispatchEvent(new CustomEvent('casepath:branch-visualized', { detail: {
          nodeId: node.node_id,
          branchId: branch.branch_id,
          changeId: state.lastCursorChangeId,
          eventId: state.lastCursorEventId,
          agentId: state.lastCursorAgentId,
        } }));
        state.graphRevealTimer = window.setTimeout(startBranchReveal, 350);
      });
    };
    state.cursorCommit = () => {
      if (state.pendingBranchNodeId !== node.node_id) return;
      const inspectionTarget = state.root?.querySelector('[data-ac-inspection-target="true"]');
      if (!inspectionTarget || inspectionTarget.dataset.inspectionPhase !== 'select-source') return;
      if (inspectionTarget.dataset.sourceId) markSubmissionSource(inspectionTarget.dataset.sourceId);
      if (inspectionTarget.dataset.sourceLocatorId) setActiveSourceLocator(inspectionTarget.dataset.sourceLocatorId);
      emitInteraction(inspectionTarget.dataset.acAction || 'inspect', inspectionTarget);
      state.graphInspectionPhase = 'read-source';
      state.cursorCommit = highlightSource;
      setProcessNodeProgress('read', 38);
    };
    setProcessNodeProgress('search', 0, {
      entityKind: 'branch',
      nodeId: node.node_id,
      branchId: branch.branch_id,
      changeId: state.lastCursorChangeId,
      eventId: state.lastCursorEventId,
      agentId: state.lastCursorAgentId,
    });
  }

  function nodeById(nodeId) {
    return asArray(state.process?.nodes).find(node => node.node_id === nodeId) || null;
  }

  function evidenceOwnerIds(item) {
    const returned = asArray(item?.node_ids).filter(value => typeof value === 'string' && value);
    return returned.length ? unique(returned) : item?.node_id ? [item.node_id] : [];
  }

  function evidenceForNode(nodeId) {
    return asArray(state.checklist?.items).filter(item => evidenceOwnerIds(item).includes(nodeId));
  }

  function factsForNode(node) {
    const ids = new Set(asArray(node?.fact_ids));
    evidenceForNode(node?.node_id).forEach(item => {
      if (item.fact_id) ids.add(item.fact_id);
    });
    return state.facts.filter(fact => ids.has(fact.fact_id));
  }

  function directFactsForNode(node) {
    const ids = new Set(asArray(node?.fact_ids));
    return state.facts.filter(fact => ids.has(fact.fact_id));
  }

  function lawsForNode(node) {
    const legal = state.legal || {};
    const joined = asArray(legal.questions)
      .filter(question => asArray(question.process_node_ids).includes(node?.node_id))
      .flatMap(question => [...asArray(question.source_ids), ...asArray(question.interpretation_ids)]);
    const ids = new Set([
      ...asArray(node?.legal_source_ids),
      ...asArray(legal.node_links?.[node?.node_id]),
      ...joined,
    ]);
    return [...asArray(legal.sources), ...asArray(legal.handling_principles)]
      .filter(source => ids.has(source.source_id));
  }

  function precedentsForNode(nodeId) {
    return state.precedents.filter(precedent => asArray(precedent?.ranking?.factors).some(factor => (
      ['current_process_node', 'process_branch'].includes(factor.factor) && factor.value === nodeId
    )));
  }

  function nodeState(node) {
    const overlay = state.process?.current_overlay || {};
    if (node.node_id === overlay.current_node_id || node.node_id === state.process?.current_node) return 'current';
    if (asArray(overlay.completed_node_ids).includes(node.node_id)) return 'complete';
    if (asArray(overlay.blocked_node_ids).includes(node.node_id)) return 'blocked';
    return node.state || 'future';
  }

  function priorityEvidence(items) {
    const order = { missing: 0, provided_insufficient: 1, conditional: 2, provided_sufficient: 3, not_applicable: 4 };
    return [...items].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }

  function relevantFact(facts) {
    return facts.find(fact => fact.fact_id === state.focusFactId)
      || facts.find(fact => ['unknown', 'conflicting'].includes(fact.state))
      || facts[0]
      || null;
  }

  function relevantLaw(laws) {
    return laws.find(law => law.source_id === state.focusLawId)
      || laws.find(isOfficialLaw)
      || laws[0]
      || null;
  }

  function isOfficialLaw(law) {
    return ['official_statute', 'official_guidance'].includes(law?.source_type);
  }

  function mirrorOfficialLawSource(source) {
    const browser = document.querySelector('.official-source-browser');
    if (!browser || !source) return;
    browser.querySelectorAll('.official-source-tab').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.officialSourceTab === source.source_id));
    });
    browser.querySelectorAll('.official-source-passage').forEach(panel => {
      panel.hidden = panel.dataset.officialSourcePanel !== source.source_id;
    });
    const url = browser.querySelector('[data-official-browser-url]');
    const host = browser.querySelector('[data-official-browser-host]');
    if (url) url.textContent = source.url || '';
    if (host) {
      try { host.textContent = new URL(String(source.url || '')).host; } catch (_) { host.textContent = 'official source'; }
    }
  }

  function finishOfficialLawTour(sources) {
    state.officialLawTourRunning = false;
    state.officialLawTourComplete = true;
    if (state.root) state.root.dataset.officialLawTourState = 'complete';
    window.dispatchEvent(new CustomEvent('casepath:official-source-tour-complete', { detail: {
      contract: CONTRACT,
      sourceIds: sources.map(source => source.source_id),
    } }));
  }

  function beginOfficialLawStep(sources, index) {
    if (!state.officialLawTourRunning || state.moment !== 'research') return;
    const source = sources[index];
    if (!source) return finishOfficialLawTour(sources);
    const sourceId = String(source.source_id);
    const lineage = lineageFor('law', sourceId);
    state.officialLawTourIndex = index;
    state.pendingLawId = sourceId;
    state.lastCursorChangeId = visibleChangeId('law', sourceId, lineage);
    state.lastCursorEventId = lineage?.eventId || '';
    state.lastCursorAgentId = lineage?.agentId || 'official_law_registry';
    if (state.root) {
      state.root.dataset.officialLawTourState = 'running';
      state.root.dataset.officialLawTourSourceId = sourceId;
    }
    state.cursorCommit = () => {
      if (!state.officialLawTourRunning || state.pendingLawId !== sourceId) return;
      state.pendingLawId = '';
      state.focusLawId = sourceId;
      state.officialLawTourVisitedIds.add(sourceId);
      setActiveSourceLocator(lawLocatorId(source));
      mirrorOfficialLawSource(source);
      render();
      window.dispatchEvent(new CustomEvent('casepath:official-source-step', { detail: {
        tourOwner: CONTRACT,
        sourceId,
        location: source.location || source.title || '',
        url: source.url || '',
        retrievalMethod: source.retrieval?.method || 'versioned_official_source_registry_lookup',
        registryVersion: source.retrieval?.registry_version || state.legal?.registry_version || '',
        cachePurpose: 'reliable_same-source_reuse',
      } }));
      window.clearTimeout(state.officialLawTourTimer);
      state.officialLawTourTimer = window.setTimeout(() => {
        if (index + 1 < sources.length) beginOfficialLawStep(sources, index + 1);
        else finishOfficialLawTour(sources);
      }, OFFICIAL_LAW_DWELL_MS);
    };
    render();
  }

  function startOfficialLawTour() {
    if (state.officialLawTourRunning || state.officialLawTourComplete) return;
    const sources = asArray(state.legal?.sources).filter(isOfficialLaw);
    if (!sources.length) return;
    state.officialLawTourRunning = true;
    state.officialLawTourIndex = 0;
    state.officialLawTourVisitedIds.clear();
    state.focusLawId = '';
    beginOfficialLawStep(sources, 0);
  }

  function representativeFactRef(fact) {
    const refs = asArray(fact?.source_refs);
    const exactText = pattern => refs.find(ref => ref?.locator_kind === 'text_quote' && pattern.test(String(ref?.excerpt || '')));
    if (fact?.fact_id === 'fact_tenancy') {
      return exactText(/residential use/i)
        || refs.find(ref => ['text_quote', 'metadata_field'].includes(ref?.locator_kind))
        || null;
    }
    if (fact?.fact_id === 'fact_notification') {
      return exactText(/arrange an inspection and repair/i)
        || refs.find(ref => ['text_quote', 'metadata_field'].includes(ref?.locator_kind))
        || null;
    }
    if (fact?.fact_id === 'fact_recurrence') {
      return refs.find(ref => isRenderableVisualRef(ref))
        || refs.find(ref => ['text_quote', 'metadata_field'].includes(ref?.locator_kind))
        || null;
    }
    if (fact?.fact_id === 'fact_ventilation_allegation') {
      return exactText(/insufficient ventilation/i)
        || refs.find(ref => ['text_quote', 'metadata_field'].includes(ref?.locator_kind))
        || null;
    }
    if (fact?.fact_id === 'fact_cause') {
      const supportedRefs = refs.filter(ref => ['text_quote', 'metadata_field'].includes(ref?.locator_kind) || isRenderableVisualRef(ref));
      return supportedRefs.find(ref => /independent|inspection/i.test(`${ref?.excerpt || ''} ${ref?.observation || ''}`))
        || refs.find(ref => ref?.locator_kind === 'text_quote')
        || null;
    }
    return refs.find(ref => ['text_quote', 'metadata_field'].includes(ref?.locator_kind) || isRenderableVisualRef(ref))
      || null;
  }

  function factStoryItems() {
    const facts = new Map(state.facts.map(fact => [String(fact?.fact_id || ''), fact]));
    return FACT_STORY_IDS.flatMap(factId => {
      const fact = facts.get(factId);
      const ref = representativeFactRef(fact);
      const lineage = lineageFor('fact', factId);
      return fact && ref && lineage?.eventId && lineage?.agentId ? [{ fact, ref, lineage }] : [];
    });
  }

  function sourceDisplayTitle(artifactId) {
    if (['message', 'intake'].includes(String(artifactId || ''))) return 'Claim message';
    const row = [...document.querySelectorAll('.attachment-row[data-artifact-id]')]
      .find(item => item.dataset.artifactId === String(artifactId || ''));
    return row?.querySelector('.attachment-title')?.textContent?.trim()
      || String(artifactId || 'Claim source').replace(/^art_/, '').replaceAll('_', ' ');
  }

  function sourceArtifactMeta(ref) {
    if (ref?.artifact_id === 'message') {
      return {
        title: 'Claim message',
        filename: 'Customer claim message',
        pageCount: 1,
      };
    }
    if (ref?.artifact_id === 'intake') {
      return {
        title: 'Claim details',
        filename: 'Observed intake fields',
        pageCount: 1,
      };
    }
    const artifact = asArray(state.claim?.artifacts)
      .find(item => String(item?.artifact_id || '') === String(ref?.artifact_id || ''));
    return {
      title: String(artifact?.title || sourceDisplayTitle(ref?.artifact_id) || 'Claim source'),
      filename: String(artifact?.filename || sourceDisplayTitle(ref?.artifact_id) || 'Claim source'),
      pageCount: Math.max(1, Number(artifact?.page_count) || 1),
    };
  }

  function ensureSourceExtraction(artifactId) {
    const sourceId = String(artifactId || '');
    if (!sourceId || ['message', 'intake'].includes(sourceId) || state.sourceExtractions.has(sourceId)) {
      return Promise.resolve(state.sourceExtractions.get(sourceId) || null);
    }
    if (state.sourceExtractionRequests.has(sourceId)) return state.sourceExtractionRequests.get(sourceId);
    const request = fetch(`${API}/api/artifacts/${encodeURIComponent(sourceId)}/extraction`, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Source extraction unavailable (${response.status})`);
        return response.json();
      })
      .then(extraction => {
        state.sourceExtractions.set(sourceId, asObject(extraction) || {});
        return extraction;
      })
      .catch(() => {
        state.sourceExtractions.set(sourceId, {});
        return null;
      })
      .finally(() => state.sourceExtractionRequests.delete(sourceId));
    state.sourceExtractionRequests.set(sourceId, request);
    return request;
  }

  function sourceArtifactText(ref) {
    const sourceId = String(ref?.artifact_id || '');
    if (sourceId === 'message') return String(state.claim?.message || '');
    if (sourceId === 'intake') return '';
    const extraction = state.sourceExtractions.get(sourceId);
    if (!extraction) {
      ensureSourceExtraction(sourceId);
      return '';
    }
    if (Array.isArray(extraction.pages)) {
      return String(extraction.pages[Math.max(0, Number(ref?.page || 1) - 1)] || '');
    }
    const email = asObject(extraction.email);
    if (email) {
      return [
        email.from ? `From: ${email.from}` : '',
        email.to ? `To: ${email.to}` : '',
        email.date ? `Date: ${email.date}` : '',
        email.subject ? `Subject: ${email.subject}` : '',
        String(email.body || ''),
      ].filter(Boolean).join('\n');
    }
    return '';
  }

  function sourceTextWindow(ref) {
    const exactReturned = sourceFinding(ref).trim();
    const sourceText = sourceArtifactText(ref);
    if (!sourceText || !exactReturned) return { before: '', exact: exactReturned, after: '', matched: false };
    const index = sourceText.toLocaleLowerCase().indexOf(exactReturned.toLocaleLowerCase());
    if (index < 0) return { before: '', exact: exactReturned, after: '', matched: false };
    let start = Math.max(0, index - 90);
    let end = Math.min(sourceText.length, index + exactReturned.length + 180);
    if (start > 0) {
      const nextBoundary = sourceText.slice(start).search(/\s/);
      if (nextBoundary >= 0) start += nextBoundary + 1;
    }
    if (end < sourceText.length) {
      const previousBoundary = sourceText.slice(0, end).lastIndexOf(' ');
      if (previousBoundary > index + exactReturned.length) end = previousBoundary;
    }
    return {
      before: `${start > 0 ? '…' : ''}${sourceText.slice(start, index).replace(/\s+/g, ' ')}`,
      exact: sourceText.slice(index, index + exactReturned.length),
      after: `${sourceText.slice(index + exactReturned.length, end).replace(/\s+/g, ' ')}${end < sourceText.length ? '…' : ''}`,
      matched: true,
    };
  }

  function sourceFinding(ref) {
    if (ref?.locator_kind === 'visual_observation') return String(ref.observation || 'Returned image region');
    if (ref?.locator_kind === 'metadata_field') {
      const field = String(ref.field || 'Returned field').replaceAll('_', ' ');
      return `${field} · ${String(ref.value ?? 'value not returned')}`;
    }
    return String(ref?.excerpt || ref?.observation || 'Returned source passage');
  }

  function sourceLocation(ref) {
    if (ref?.locator_kind === 'visual_observation') return 'Image region';
    if (ref?.locator_kind === 'metadata_field') return 'Returned field';
    return `Page ${String(ref?.page || 1)}`;
  }

  function markSubmissionSource(artifactId = '') {
    const sourceId = String(artifactId || '');
    const sourcePackage = document.querySelector('.v21-source-summary-toggle');
    const packageActive = ['message', 'intake'].includes(sourceId);
    if (sourcePackage) {
      sourcePackage.classList.toggle('is-active', packageActive);
      if (packageActive) {
        sourcePackage.dataset.activeSourceId = sourceId;
        sourcePackage.setAttribute('aria-current', 'true');
      } else {
        delete sourcePackage.dataset.activeSourceId;
        sourcePackage.removeAttribute('aria-current');
      }
    }
    document.querySelectorAll('.attachment-row[data-artifact-id]').forEach(row => {
      const active = Boolean(sourceId) && row.dataset.artifactId === sourceId;
      row.classList.toggle('is-active', active);
      if (active) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
  }

  function clearActiveSource() {
    markSubmissionSource('');
    setActiveSourceLocator('');
    document.querySelectorAll('.is-agent-clicked').forEach(item => item.classList.remove('is-agent-clicked'));
  }

  function normalizedVisualRegion(ref) {
    if (ref?.locator_kind !== 'visual_observation'
      || !String(ref?.observation || '').trim()
      || ref?.annotation_contract !== VISUAL_ANNOTATION_CONTRACT
      || ref?.annotation_version !== VISUAL_ANNOTATION_VERSION
      || ref?.producer !== VISUAL_ANNOTATION_PRODUCER
      || ref?.authority !== VISUAL_ANNOTATION_AUTHORITY
      || !/^[0-9a-f]{64}$/.test(String(ref?.image_sha256 || ''))) return null;
    const region = asArray(ref?.region).map(Number);
    if (region.length !== 4 || region.some(value => !Number.isFinite(value))) return null;
    const [x, y, width, height] = region;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) return null;
    return region;
  }

  function visualSourceImage(ref) {
    const artifact = asArray(state.claim?.artifacts)
      .find(item => String(item?.artifact_id || '') === String(ref?.artifact_id || ''));
    const image = [...document.querySelectorAll('.attachment-row[data-artifact-id]')]
      .find(row => row.dataset.artifactId === String(ref?.artifact_id || ''))
      ?.querySelector('.attachment-thumb img');
    const imageSource = image?.currentSrc || image?.getAttribute('src') || '';
    return imageSource
      && String(artifact?.media_type || '').startsWith('image/')
      && String(artifact?.sha256 || '') === String(ref?.image_sha256 || '')
      ? imageSource
      : '';
  }

  function isRenderableVisualRef(ref) {
    return Boolean(normalizedVisualRegion(ref) && visualSourceImage(ref));
  }

  function visualSourceMarkup(fact, ref, interactive = true, highlighted = false) {
    const region = normalizedVisualRegion(ref);
    const imageSource = visualSourceImage(ref);
    if (!region || !imageSource) return '';
    const [x, y, width, height] = region;
    const label = interactive && !highlighted
      ? 'Select the region the agent is inspecting'
      : String(ref?.observation || 'Curated generated-demo image region');
    const targetAttributes = interactive
      ? `data-ac-action="confirm-source" data-ac-inspection-target="true" data-ac-inspection-read-target="true" data-fact-inspection-target="true" data-inspection-phase="read-source" data-ac-cursor-target="true" ${sourceContextAttributes(fact, ref)}`
      : '';
    const sourceMeta = sourceArtifactMeta(ref);
    return `<figure class="ac-visual-source" ${sourceContextAttributes(fact, ref)}>
      <div class="ac-visual-source-frame">
        <img src="${esc(imageSource)}" alt="Bedroom condition source">
        ${interactive
          ? `<button type="button" class="ac-visual-region-target is-awaiting-click" ${targetAttributes} style="--region-x:${x * 100}%;--region-y:${y * 100}%;--region-width:${width * 100}%;--region-height:${height * 100}%" aria-label="Select this exact image region"></button>`
          : `<span class="ac-visual-region-target${highlighted ? ' is-highlighted' : ''}" style="--region-x:${x * 100}%;--region-y:${y * 100}%;--region-width:${width * 100}%;--region-height:${height * 100}%" aria-hidden="true"></span>`}
      </div>
      <figcaption><span>${esc(sourceMeta.title)}</span><small>Image</small><strong>${esc(label)}</strong></figcaption>
    </figure>`;
  }

  function sourceReadingMarkup(fact, ref, interactive = true, highlighted = false) {
    if (ref?.locator_kind === 'visual_observation') return visualSourceMarkup(fact, ref, interactive, highlighted);
    const finding = sourceFinding(ref);
    const sourceMeta = sourceArtifactMeta(ref);
    const page = Math.max(1, Number(ref?.page) || 1);
    const pageLabel = ref?.locator_kind === 'metadata_field'
      ? 'Returned field'
      : `Page ${page} of ${sourceMeta.pageCount}`;
    const documentHead = `<div class="ac-source-document-head"><strong>${esc(sourceMeta.title)}</strong><small>${esc(pageLabel)}</small></div>`;
    const targetAttributes = interactive
      ? `data-ac-action="confirm-source" data-ac-inspection-target="true" data-ac-inspection-read-target="true" data-fact-inspection-target="true" data-inspection-phase="read-source" data-ac-cursor-target="true" ${sourceContextAttributes(fact, ref)}`
      : '';
    if (ref?.locator_kind === 'metadata_field') {
      const field = String(ref?.field || 'Returned field').replaceAll('_', ' ');
      return `<div class="ac-source-document-preview">${documentHead}<div class="ac-source-field${interactive ? ' is-awaiting-click' : ''}${highlighted ? ' is-highlighted' : ''}" ${targetAttributes}>
        <small>${esc(field)}</small><strong>${esc(String(ref?.value ?? 'Value not returned'))}</strong>
      </div>
      </div>`;
    }
    const sourceWindow = sourceTextWindow(ref);
    return `<div class="ac-source-document-preview">${documentHead}<blockquote class="ac-source-passage ac-source-page-excerpt">${sourceWindow.before ? `<span>${esc(sourceWindow.before)}</span>` : ''}<mark class="ac-fact-reading-target${interactive ? ' is-awaiting-click' : ''}${highlighted ? ' is-highlighted' : ''}" ${targetAttributes}>${esc(sourceWindow.exact || finding)}</mark>${sourceWindow.after ? `<span>${esc(sourceWindow.after)}</span>` : ''}</blockquote></div>`;
  }

  function finishFactSourceTour(items) {
    window.clearTimeout(state.factTourTimer);
    state.factTourRunning = false;
    state.factTourComplete = true;
    state.factTourPhase = 'finding';
    state.factTourReadArmed = false;
    state.cursorCommit = null;
    clearActiveSource();
    render();
    window.dispatchEvent(new CustomEvent('casepath:fact-source-tour-complete', { detail: {
      contract: CONTRACT,
      factIds: items.map(item => item.fact.fact_id),
      count: items.length,
    } }));
  }

  function beginFactSourceStep(items, index) {
    if (!state.factTourRunning) return;
    if (index >= items.length) {
      finishFactSourceTour(items);
      return;
    }
    const { fact, ref, lineage } = items[index];
    state.factTourIndex = index;
    state.factTourPhase = 'select-source';
    state.factTourReadArmed = false;
    state.pendingFactId = fact.fact_id;
    state.focusFactId = fact.fact_id;
    state.lastCursorChangeId = visibleChangeId('fact', fact.fact_id, lineage);
    state.lastCursorEventId = lineage.eventId;
    state.lastCursorAgentId = lineage.agentId;
    clearActiveSource();
    const highlightSource = () => {
      if (!state.factTourRunning || state.pendingFactId !== fact.fact_id || state.factTourPhase !== 'read-source') return;
      const target = state.root?.querySelector('[data-fact-inspection-target="true"]');
      if (!target || target.dataset.factId !== fact.fact_id || target.dataset.sourceId !== String(ref.artifact_id || '') || target.dataset.inspectionPhase !== 'read-source') return;
      emitInteraction('confirm-source', target);
      state.factTourPhase = 'highlight-source';
      state.factTourReadArmed = false;
      state.cursorCommit = null;
      render();
      window.dispatchEvent(new CustomEvent('casepath:source-highlighted', { detail: {
        entityKind: 'fact', factId: fact.fact_id, changeId: state.lastCursorChangeId,
        eventId: state.lastCursorEventId, agentId: state.lastCursorAgentId,
        sourceId: String(ref.artifact_id || ''), locatorId: target.dataset.sourceLocatorId || '',
      } }));
      window.dispatchEvent(new CustomEvent('casepath:source-inspection', { detail: {
        entityKind: 'fact',
        factId: fact.fact_id,
        changeId: state.lastCursorChangeId,
        eventId: state.lastCursorEventId,
        agentId: state.lastCursorAgentId,
        sourceKind: 'claim-source',
        sourceId: String(ref.artifact_id || ''),
        locatorId: target.dataset.sourceLocatorId || '',
        found: sourceFinding(ref),
      } }));
      state.factTourTimer = window.setTimeout(() => {
        if (!state.factTourRunning || state.pendingFactId !== fact.fact_id) return;
        state.factTourPhase = 'finding';
        render();
        const resultDwell = FACT_HERO_IDS.has(fact.fact_id)
          ? FACT_HERO_RESULT_DWELL_MS
          : FACT_RESULT_DWELL_MS;
        state.factTourTimer = window.setTimeout(() => beginFactSourceStep(items, index + 1), resultDwell);
      }, FACT_SOURCE_DWELL_MS);
    };
    state.cursorCommit = () => {
      if (!state.factTourRunning || state.pendingFactId !== fact.fact_id || state.factTourPhase !== 'select-source') return;
      const target = state.root?.querySelector('[data-fact-inspection-target="true"]');
      if (!target || target.dataset.factId !== fact.fact_id || target.dataset.sourceId !== String(ref.artifact_id || '') || target.dataset.inspectionPhase !== 'select-source') return;
      markSubmissionSource(ref.artifact_id);
      setActiveSourceLocator(target.dataset.sourceLocatorId || '');
      emitInteraction('open-source', target);
      state.factTourPhase = 'read-source';
      state.factTourReadArmed = false;
      state.cursorCommit = null;
      render();
      state.factTourTimer = window.setTimeout(() => {
        if (!state.factTourRunning || state.pendingFactId !== fact.fact_id || state.factTourPhase !== 'read-source') return;
        state.factTourReadArmed = true;
        state.cursorCommit = highlightSource;
        render();
      }, FACT_NEUTRAL_READ_DWELL_MS);
    };
    render();
  }

  function maybeStartFactSourceTour() {
    if (!state.factTourEligible || state.factTourRunning || state.factTourComplete || state.moment !== 'understand') return;
    const items = factStoryItems();
    if (items.length !== FACT_STORY_IDS.length) return;
    state.factTourRunning = true;
    state.factTourIndex = 0;
    state.factTourPhase = 'select-source';
    beginFactSourceStep(items, 0);
  }

  function relevantEvidence(items) {
    return items.find(item => item.item_id === state.focusEvidenceId)
      || priorityEvidence(items)[0]
      || null;
  }

  function relevantPrecedent(items) {
    return items.find(item => item.claim_id === state.focusPrecedentId)
      || items[0]
      || null;
  }

  function sourceRefsForNode(node) {
    return factsForNode(node).flatMap(fact => asArray(fact.source_refs).map(ref => ({ fact, ref })));
  }

  function chainKinds(node) {
    const kinds = [];
    if (sourceRefsForNode(node).length) kinds.push('source');
    if (lawsForNode(node).length) kinds.push('law');
    if (evidenceForNode(node.node_id).length) kinds.push('evidence');
    if (precedentsForNode(node.node_id).length) kinds.push('reference');
    return kinds;
  }

  function ensureValidChain(node) {
    const kinds = chainKinds(node);
    if (!kinds.includes(state.activeChainKind)) state.activeChainKind = kinds[0] || 'source';
    return kinds;
  }

  function statusLabel(value) {
    return ({
      provided_sufficient: 'Available',
      provided_insufficient: 'Insufficient',
      missing: 'Missing',
      conditional: 'Conditional',
      not_applicable: 'Not needed on this path',
    })[value] || String(value || 'Status not returned').replaceAll('_', ' ');
  }

  function provenanceLabel(precedent) {
    if (precedent?.review_status === 'generated_reference') return 'Generated reference pattern · not qualified review';
    if (precedent?.review_status === 'unverified_demo_memory' && precedent?.memory_id) return 'Unverified generated-demo memory';
    if (['qualified_expert_reviewed', 'expert_reviewed_memory'].includes(precedent?.review_status) && precedent?.memory_id) return 'Qualified expert-reviewed case memory';
    return `Reference pattern${precedent?.review_status ? ` · ${String(precedent.review_status).replaceAll('_', ' ')}` : ''}`;
  }

  function sourceLocatorId(ref) {
    const artifactId = String(ref?.artifact_id || 'unknown-source');
    const kind = String(ref?.locator_kind || 'unknown-locator');
    if (kind === 'visual_observation') return `source:${artifactId}:region:${asArray(ref?.region).join(',')}`;
    if (kind === 'metadata_field') return `source:${artifactId}:field:${String(ref?.field || '')}`;
    return `source:${artifactId}:page:${String(ref?.page || '')}:quote:${String(ref?.excerpt || '')}`;
  }

  function sourceContextAttributes(fact, ref) {
    const region = asArray(ref?.region).length === 4 ? JSON.stringify(ref.region) : '';
    return `data-fact-id="${esc(fact?.fact_id || '')}" data-source-id="${esc(ref?.artifact_id || '')}" data-locator-kind="${esc(ref?.locator_kind || '')}" data-source-page="${esc(ref?.page || '')}" data-source-excerpt="${esc(ref?.excerpt || '')}" data-source-region="${esc(region)}" data-source-observation="${esc(ref?.observation || '')}" data-source-field="${esc(ref?.field || '')}" data-source-value="${esc(ref?.value ?? '')}" data-source-agent="${esc(ref?.agent || '')}" data-source-producer="${esc(ref?.producer || '')}" data-source-authority="${esc(ref?.authority || 'customer_submission')}" data-annotation-contract="${esc(ref?.annotation_contract || '')}" data-annotation-version="${esc(ref?.annotation_version || '')}" data-image-sha256="${esc(ref?.image_sha256 || '')}" data-fact-confidence="${esc(fact?.confidence ?? '')}" data-fact-state="${esc(fact?.state || '')}" data-source-locator-id="${esc(sourceLocatorId(ref))}"`;
  }

  function lawLocatorId(law) {
    return `law:${String(law?.source_id || 'unknown-law')}`;
  }

  function visibleChangeId(kind, entityId, lineage = lineageFor(kind, entityId)) {
    const base = lineage?.changeId || `local:${state.moment}`;
    return `${base}:${kind}:${String(entityId || '')}`;
  }

  function visibleActorId() {
    if (state.moment === 'verify') return 'final_claim_brief_audit';
    return eventAgentId(state.currentEvent) || (state.neutralAuthority ? '' : state.activeAgentId);
  }

  function lineageAttributes(kind, entityId) {
    const lineage = lineageFor(kind, entityId);
    const eventId = lineage?.eventId || '';
    const agentId = lineage?.agentId || '';
    const changeId = visibleChangeId(kind, entityId, lineage);
    return `data-change-id="${esc(changeId)}" data-event-id="${esc(eventId)}" data-agent-id="${esc(agentId)}" data-artifact-change-id="${esc(changeId)}" data-artifact-event-id="${esc(eventId)}" data-artifact-agent-id="${esc(agentId)}"`;
  }

  function renderShell() {
    const root = state.root;
    if (!root || root.dataset.shellReady === 'true') return;
    root.dataset.shellReady = 'true';
    root.innerHTML = `
      <header class="ac-work-header">
        <div class="ac-active-work" data-ac-active-work>
          <span class="ac-cursor-mark" aria-hidden="true" data-ac-active-monogram>CP</span>
          <div>
            <p data-ac-position>CasePath is opening the claim</p>
            <h2 data-ac-task>Opening one shared claim context</h2>
            <span data-ac-why>The message and original files remain the source of truth.</span>
          </div>
        </div>
        <ol class="ac-team" aria-label="Specialist activity" data-ac-team></ol>
      </header>
      <main class="ac-work-body" data-artifact-layout="persistent-source-process-focal">
        <section class="ac-process" id="artifactProcessGraph" aria-label="Accepted handling process" data-ac-process data-graph-projection="flagship-spine/1" data-process-construction-state="pending" data-process-graph-id="" hidden>
          <span class="ac-cursor-park" data-ac-cursor-park aria-hidden="true"></span>
          <div class="ac-process-copy">
            <span data-ac-process-count>Accepted handling process</span>
            <strong data-ac-process-focus>Grounded decision path</strong>
            <button type="button" class="ac-process-build-target" data-ac-build-target tabindex="-1" hidden></button>
          </div>
          <p class="ac-process-status" role="status" aria-live="polite" aria-atomic="true" data-ac-process-status>Waiting for the accepted process.</p>
          <div class="ac-spatial-viewport" data-spatial-canvas="claim-handling-process">
            <svg class="ac-spatial-edges" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-ac-spatial-edges></svg>
            <ol class="ac-process-track" data-ac-process-track></ol>
            <div class="ac-spatial-satellites" data-ac-spatial-satellites></div>
            <aside class="ac-spatial-detail" data-ac-spatial-detail></aside>
          </div>
        </section>
        <section class="ac-focal" aria-live="polite" aria-atomic="false" data-ac-focal data-artifact-focus="true" data-casepath-primary-artifact="true" data-casepath-focal="true"></section>
      </main>
      <dialog class="ac-law-viewer" data-ac-law-viewer aria-labelledby="artifactLawViewerTitle">
        <header><span data-ac-law-authority></span><button type="button" data-ac-action="close-law" aria-label="Close Swiss-law detail">×</button></header>
        <article data-ac-law-detail></article>
      </dialog>
      <dialog class="ac-grounding-viewer" data-ac-grounding-viewer aria-labelledby="artifactGroundingViewerTitle">
        <header><div><span>Why this step</span><h3 id="artifactGroundingViewerTitle">Law, documents and examples</h3></div><button type="button" data-ac-action="close-grounding" aria-label="Close supporting detail">×</button></header>
        <article data-ac-grounding-viewer-detail></article>
      </dialog>
      <aside class="ac-agent-audit" data-ac-agent-audit aria-labelledby="artifactAgentAuditTitle" hidden></aside>
      <footer class="ac-authority-line">
        <span data-ac-authority>Application source parser</span>
        <span data-ac-proof>Only validated outputs are shown.</span>
      </footer>
      <div class="ac-agent-cursor" id="artifactAgentCursor" aria-hidden="true" data-ac-cursor data-agent-signature="casepath">
        <b class="ac-cursor-role-icon" data-ac-cursor-monogram data-ac-cursor-avatar data-agent-avatar="casepath" data-agent-monogram="CP"><svg viewBox="0 0 24 24" focusable="false">${CURSOR_AVATARS.casepath}</svg></b>
        <span class="ac-agent-cursor-label">
          <span class="ac-agent-cursor-copy"><strong data-ac-cursor-agent>CasePath</strong><small data-ac-cursor-action>Opening the claim</small></span>
          <span class="ac-process-node-progress" data-ac-process-node-progress hidden><small data-ac-process-node-progress-phase></small><strong data-ac-process-node-progress-value>0%</strong></span>
        </span>
      </div>`;
    renderTeam();
    installGlobalAgentRail();
    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeydown);
    root.querySelector('[data-ac-grounding-viewer]')?.addEventListener('close', () => {
      root.querySelectorAll('[data-ac-action="toggle-grounding"]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    });
  }

  function renderTeam() {
    const team = document.querySelector('[data-ac-team]') || state.root?.querySelector('[data-ac-team]');
    if (!team || team.children.length) return;
    team.innerHTML = Object.entries(AGENTS)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([agentId, agent]) => `<li data-ac-agent-id="${esc(agentId)}" data-agent-label="${esc(agent.label)}" data-agent-monogram="${esc(agent.monogram)}" data-agent-signature="${esc(agent.signature)}"><button type="button" data-ac-action="open-agent-audit" data-agent-id="${esc(agentId)}" aria-label="Open ${esc(agent.label)} activity" aria-pressed="false"><span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${AGENT_ICONS[agent.signature] || ''}</svg></span><small>${esc(agent.short)}</small></button></li>`)
      .join('');
  }

  function installGlobalAgentRail() {
    const appbar = document.querySelector('.appbar');
    const team = state.root?.querySelector('[data-ac-team]');
    if (!appbar || !team) return;
    let host = appbar.querySelector('[data-ac-global-agent-work]');
    if (!host) {
      host = document.createElement('div');
      host.className = 'ac-global-agent-work';
      host.dataset.acGlobalAgentWork = 'true';
      host.innerHTML = '<div class="ac-global-task"><small data-ac-global-agent></small><strong data-ac-global-task></strong></div>';
      const auditButton = appbar.querySelector('#openAudit');
      appbar.insertBefore(host, auditButton || null);
      host.addEventListener('click', event => {
        const button = event.target.closest?.('[data-ac-action="open-agent-audit"]');
        if (!button) return;
        openAgentAudit(button.dataset.agentId || '');
      });
    }
    if (!host.contains(team)) host.prepend(team);
  }

  function orchestrationAudit() {
    return asObject(state.result?.agent_orchestration)
      || asObject(state.result?.audit?.agent_orchestration)
      || null;
  }

  function sourceIdsFromFacts(facts) {
    return unique(asArray(facts).flatMap(fact => asArray(fact?.source_refs).map(ref => String(ref?.artifact_id || ''))));
  }

  function agentHistoryData(agentId) {
    const audit = orchestrationAudit();
    const entry = asArray(audit?.agents).find(item => item?.agent_id === agentId);
    if (!entry || entry.actor_type !== 'nemotron_agent') return null;
    const acceptedIds = new Set(asArray(entry.accepted_ids).map(String));
    const artifacts = asObject(audit?.specialist_artifacts) || {};
    const flagshipFacts = asArray(state.result?.facts).length
      ? asArray(state.result.facts)
      : asArray(state.result?.understanding?.facts);
    const flagshipProcess = asObject(state.result?.process) || {};
    const flagshipChecklist = asObject(state.result?.checklist) || {};
    const artifact = agentId === 'canonical_facts'
      ? { facts: flagshipFacts }
      : agentId === 'final_claim_brief_audit'
        ? asObject(audit?.final_claim_brief) || asObject(artifacts[agentId]) || {}
        : asObject(artifacts[agentId]) || {};
    let sourceIds = [];
    let factIds = [];
    let extracted = [];
    let affected = [];
    let sourcesLabel = 'Sources cited';
    let emptySources = 'No source citation accepted';
    if (agentId === 'canonical_facts') {
      const acceptedFacts = flagshipFacts.filter(fact => acceptedIds.has(String(fact?.fact_id || '')));
      factIds = acceptedFacts.map(fact => fact.fact_id).filter(Boolean);
      sourceIds = sourceIdsFromFacts(acceptedFacts);
      extracted = acceptedFacts.map(fact => `${fact.label}: ${fact.value}`).filter(Boolean);
      affected = ['Shared fact state', 'Internal work plan'];
    } else if (agentId === 'orchestrator_plan') {
      const planAccepted = acceptedIds.has('model_priority_order');
      factIds = planAccepted ? asArray(artifact.model_priority_fact_ids).map(String) : [];
      extracted = planAccepted ? asArray(artifact.model_priority_task_codes || artifact.priority_task_codes).map(String) : [];
      sourcesLabel = 'Source coverage';
      emptySources = 'CasePath attached source coverage after the plan';
      affected = ['Source and Process work started in parallel'];
    } else if (agentId === 'document_source_integrity') {
      const acceptedArtifacts = asArray(artifact.artifacts).filter(item => acceptedIds.has(String(item?.artifact_id || '')));
      sourceIds = acceptedArtifacts.map(item => String(item?.artifact_id || '')).filter(Boolean);
      extracted = acceptedArtifacts.map(item => `${sourceDisplayTitle(item?.artifact_id)}: ${String(item?.integrity_class || 'checked').replaceAll('_', ' ')}`);
      affected = ['Process gate source check'];
    } else if (agentId === 'process_decision_mapping') {
      const decisions = asArray(artifact.decisions).filter(item => acceptedIds.has(String(item?.contribution_id || '')));
      factIds = decisions.map(item => String(item?.fact_id || '')).filter(Boolean);
      sourceIds = sourceIdsFromFacts(flagshipFacts.filter(fact => factIds.includes(fact.fact_id)));
      extracted = decisions.map(item => String(item?.decision_value || item?.fact_id || '')).filter(Boolean);
      affected = asArray(flagshipProcess.nodes).filter(node => asArray(node.fact_ids).some(factId => factIds.includes(factId))).map(node => nodeQuestion(node));
    } else if (agentId === 'evidence_checklist') {
      const items = asArray(artifact.items);
      const acceptedItems = items.flatMap(item => {
        const fields = asArray(item?.field_contributions).filter(field => acceptedIds.has(String(field?.contribution_id || ''))).map(field => String(field?.field || 'field'));
        return fields.length ? [{ item, fields }] : [];
      });
      factIds = acceptedItems.map(({ item }) => String(item?.fact_id || '')).filter(Boolean);
      sourceIds = unique(acceptedItems.filter(({ fields }) => fields.includes('artifact_ids')).flatMap(({ item }) => asArray(item?.artifact_ids).map(String)));
      extracted = acceptedItems.map(({ item, fields }) => `${String(item?.item_id || '')}: ${fields.join(' + ')}`);
      affected = asArray(flagshipChecklist.items).filter(item => acceptedItems.some(({ item: accepted }) => accepted?.item_id === item?.item_id)).map(item => item.title).filter(Boolean);
    } else if (agentId === 'final_claim_brief_audit') {
      factIds = acceptedIds.has('final:supporting_facts') ? asArray(artifact.supporting_fact_ids).map(String) : [];
      sourceIds = sourceIdsFromFacts(flagshipFacts.filter(fact => factIds.includes(fact.fact_id)));
      extracted = acceptedIds.has('final:audit_checks') ? asArray(artifact.audit_check_ids).map(String) : [];
      affected = [
        acceptedIds.has('final:current_node') ? nodeLabel(artifact.current_node_id) : '',
        acceptedIds.has('final:next_action') ? nodeLabel(artifact.next_action_node_id) : '',
      ].filter(Boolean);
    }
    const downstream = {
      canonical_facts: 'Internal work plan',
      orchestrator_plan: 'Sources + Process',
      document_source_integrity: 'Process gate',
      process_decision_mapping: 'Process gate',
      evidence_checklist: 'Documents gate',
      final_claim_brief_audit: 'Final safety gate',
    }[agentId] || 'Next check';
    return {
      entry,
      sourceIds: unique(sourceIds),
      factIds: unique(factIds),
      extracted: unique(extracted),
      affected: unique(affected),
      downstream,
      output: String(entry.output_artifact || AGENT_ARTIFACT_LABELS[agentId] || ''),
      sourcesLabel,
      emptySources,
    };
  }

  function compactHistoryList(values, emptyLabel) {
    const returned = unique(asArray(values).map(value => String(value || '').trim()).filter(Boolean));
    if (!returned.length) return `<span>${esc(emptyLabel)}</span>`;
    const visible = returned.slice(0, 3);
    return `<strong>${esc(visible.join(' · '))}</strong>${returned.length > visible.length ? `<span>+${returned.length - visible.length} more returned</span>` : ''}`;
  }

  function renderAgentAudit() {
    const panel = state.root?.querySelector('[data-ac-agent-audit]');
    if (!panel) return;
    const agentId = state.agentAuditOpenId;
    const agent = AGENTS[agentId];
    state.root.dataset.agentAuditOpen = String(Boolean(agent));
    if (!agent) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const audit = orchestrationAudit();
    const history = agentHistoryData(agentId);
    panel.hidden = false;
    panel.dataset.agentId = agentId;
    panel.dataset.agentSignature = agent.signature;
    panel.dataset.agentHistoryAvailable = String(Boolean(history));
    const runId = document.body.dataset.casepathActiveRunId || '';
    const receipt = history?.entry || {};
    const sources = history?.sourceIds.map(sourceId => sourceId.startsWith('art_') || ['message', 'intake'].includes(sourceId) ? sourceDisplayTitle(sourceId) : sourceId) || [];
    panel.innerHTML = `<header><div><span data-agent-signature="${esc(agent.signature)}"><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${AGENT_ICONS[agent.signature] || ''}</svg></span><div><small>${esc(agent.label)}</small><h2 id="artifactAgentAuditTitle">${esc(agent.short)} activity</h2></div></div><button type="button" data-ac-action="close-agent-audit" aria-label="Close agent activity">×</button></header>
      ${history ? `<ol class="ac-agent-history" data-agent-history-contract="casepath.agent-history/1.0.0" data-run-id="${esc(runId)}" data-agent-id="${esc(agentId)}">
        <li data-agent-history-task><i>1</i><div><small>Task</small><strong>${esc(agent.task)}</strong><span>${esc(agent.why)}</span></div></li>
        <li data-agent-history-sources><i>2</i><div><small>${esc(history.sourcesLabel)}</small>${compactHistoryList(sources, history.emptySources)}</div></li>
        <li data-agent-history-facts><i>3</i><div><small>${agentId === 'canonical_facts' ? 'Extracted' : 'Used'}</small>${compactHistoryList(history.extracted, 'No bounded item returned')}</div></li>
        <li data-agent-history-output><i>4</i><div><small>Produced</small><strong>${esc(history.output.replaceAll('_', ' '))}</strong>${compactHistoryList(history.affected, 'No downstream entity returned')}</div></li>
        <li data-agent-history-acceptance><i>5</i><div><small>Accepted</small><strong>${esc(String(receipt.outcome || 'outcome not returned').replaceAll('_', ' '))}</strong><span>${esc(String(receipt.accepted_count ?? 0))} accepted · ${esc(String(receipt.rejected_count ?? 0))} rejected${receipt.deterministic_fallback_applied === true ? ' · CasePath replaced rejected fields' : ''} · next: ${esc(history.downstream)}</span></div></li>
      </ol><details data-agent-history-receipt><summary>Technical receipt</summary><dl><div><dt>Call</dt><dd>${esc(receipt.call_id || 'not returned')}</dd></div><div><dt>Output hash</dt><dd>${esc(receipt.output_artifact_hash || 'not returned')}</dd></div><div><dt>Fallback</dt><dd>${esc(String(receipt.deterministic_fallback_applied === true))}</dd></div></dl></details>`
        : `<div class="ac-agent-history-empty"><small>Activity record</small><strong>${audit?.executed === false ? 'No agent calls were made in this reference replay.' : 'Call-bound history has not been returned yet.'}</strong><p>${audit?.executed === false ? 'This screen replays accepted reference output; it does not invent agent activity.' : 'This panel will fill only when exact call receipts arrive.'}</p></div>`}`;
  }

  function openAgentAudit(agentId) {
    if (!AGENTS[agentId]) return;
    state.agentAuditOpenId = agentId;
    renderHeader();
    renderAgentAudit();
  }

  function closeAgentAudit() {
    state.agentAuditOpenId = '';
    renderHeader();
    renderAgentAudit();
  }

  function renderHeader() {
    const root = state.root;
    if (!root) return;
    const graphProjectionActorId = state.graphRevealRunning
      ? lineageFor('process_node', state.pendingGraphNodeId || state.selectedNodeId)?.agentId || ''
      : '';
    const acceptedProcessAgentId = state.agentLineage.get('process_decision_mapping')?.actorType === 'nemotron_agent'
      ? 'process_decision_mapping'
      : '';
    const graphActorId = AGENTS[graphProjectionActorId]
      ? graphProjectionActorId
      : state.graphRevealRunning ? acceptedProcessAgentId : '';
    const factLineage = state.factTourRunning ? lineageFor('fact', state.pendingFactId) : null;
    const factActorId = AGENTS[factLineage?.agentId] ? factLineage.agentId : '';
    const effectiveAgentId = AGENTS[factActorId]
      ? factActorId
      : AGENTS[graphActorId]
        ? graphActorId
        : state.activeAgentId;
    const agent = AGENTS[effectiveAgentId];
    const copy = momentCopy();
    const neutral = state.factTourRunning && !factActorId
      ? { label: 'Claim reader', monogram: 'CF', signature: 'facts', visualAgentId: 'canonical_facts', task: 'Showing the exact source behind a returned fact', why: 'The fact appears only after the passage, field, or image region is selected.' }
      : state.graphRevealRunning && !graphActorId
      ? { label: 'Process builder', monogram: 'PM', signature: 'process', visualAgentId: 'process_decision_mapping', task: 'Building the handling path', why: 'Each step appears after the source or earlier decision that supports it.' }
      : state.neutralAuthority === 'official-law-registry'
      ? { label: 'Source checker', monogram: 'DS', signature: 'sources', visualAgentId: 'document_source_integrity', task: 'Showing the exact Swiss-law section', why: 'The official text is shown directly; legal interpretation still needs qualified review.' }
      : state.neutralAuthority === 'historical-ranking'
        ? { label: 'Reference lookup', monogram: '↗', signature: 'reference', task: copy.title, why: copy.detail }
      : state.neutralAuthority === 'whole-playbook-gate'
        ? { label: 'Result checker', monogram: 'FB', signature: 'audit', visualAgentId: 'final_claim_brief_audit', task: 'Checking the full result', why: 'A deterministic safety check still decides whether it may proceed.' }
      : state.neutralAuthority === 'case-memory-comparison'
        ? { label: 'Saved-case comparison', monogram: '↺', signature: 'memory', task: copy.title, why: copy.detail }
      : state.moment === 'ready'
        ? { label: 'Result checker', monogram: 'FB', signature: 'audit', visualAgentId: 'final_claim_brief_audit', task: 'The checked result is ready', why: 'Every source, process step, and document need remains open for review.' }
        : null;
    const identity = neutral || (agent ? {
      label: agent.label,
      monogram: agent.monogram,
      signature: agent.signature,
      task: agent.task,
      why: agent.why,
    } : {
      label: copy.authority,
      monogram: 'CP',
      signature: 'casepath',
      task: copy.title,
      why: copy.detail,
    });
    root.dataset.casepathMoment = state.moment;
    root.dataset.casepathScene = state.moment;
    const referenceReplay = orchestrationAudit()?.executed === false;
    root.dataset.referenceReplay = String(referenceReplay);
    root.dataset.factSourceTourState = state.factTourComplete ? 'complete' : state.factTourRunning ? 'running' : state.factTourEligible ? 'waiting' : 'idle';
    root.dataset.factSourceTourIndex = String(state.factTourIndex);
    root.dataset.factSourceTourPhase = state.factTourPhase;
    root.dataset.graphInspectionPhase = state.graphInspectionPhase;
    root.dataset.manualNodeInspection = String(state.manualNodeInspection);
    const nodeProgress = state.processNodeProgress;
    root.dataset.processNodeProgressState = nodeProgress ? 'active' : 'idle';
    if (nodeProgress) {
      root.dataset.processNodeProgress = String(nodeProgress.percent);
      root.dataset.processNodeProgressPhase = nodeProgress.phase;
      root.dataset.processNodeProgressNodeId = nodeProgress.nodeId;
    } else {
      delete root.dataset.processNodeProgress;
      delete root.dataset.processNodeProgressPhase;
      delete root.dataset.processNodeProgressNodeId;
    }
    if (state.moment === 'later-result') {
      const validatedMemory = validatedLaterMemory();
      root.dataset.laterMemoryValidated = String(Boolean(validatedMemory));
      root.dataset.laterMemoryApplicationHash = validatedMemory?.applicationHash || '';
    } else {
      delete root.dataset.laterMemoryValidated;
      delete root.dataset.laterMemoryApplicationHash;
    }
    root.dataset.reviewEditState = state.moment === 'review-applied' ? 'applied' : state.moment === 'review' ? 'pending' : 'not-active';
    root.dataset.activeAgentId = neutral ? '' : effectiveAgentId;
    root.dataset.visualActiveAgentId = neutral?.visualAgentId || (!neutral ? effectiveAgentId : '');
    root.dataset.activeSignature = identity.signature;
    root.dataset.workAuthority = identity.label;
    root.querySelector('[data-ac-active-work]').dataset.agentSignature = identity.signature;
    root.querySelector('[data-ac-active-monogram]').textContent = identity.monogram;
    root.querySelector('[data-ac-position]').textContent = identity.label;
    root.querySelector('[data-ac-task]').textContent = identity.task;
    root.querySelector('[data-ac-why]').textContent = identity.why;
    root.querySelector('[data-ac-authority]').textContent = copy.authority;
    const cursor = root.querySelector('[data-ac-cursor]');
    cursor.dataset.agentSignature = identity.signature;
    setCursorAvatar(cursor, identity);
    root.querySelector('[data-ac-cursor-agent]').textContent = identity.label;
    root.querySelector('[data-ac-cursor-action]').textContent = identity.task;
    const progressIndicator = cursor.querySelector('[data-ac-process-node-progress]');
    if (nodeProgress) {
      cursor.dataset.processNodeProgress = 'active';
      cursor.style.setProperty('--ac-process-node-progress', `${nodeProgress.percent}%`);
      progressIndicator.hidden = false;
      progressIndicator.dataset.progress = String(nodeProgress.percent);
      progressIndicator.dataset.phase = nodeProgress.phase;
      progressIndicator.dataset.nodeId = nodeProgress.nodeId;
      progressIndicator.querySelector('[data-ac-process-node-progress-phase]').textContent = nodeProgress.label;
      progressIndicator.querySelector('[data-ac-process-node-progress-value]').textContent = `${nodeProgress.percent}%`;
    } else {
      delete cursor.dataset.processNodeProgress;
      cursor.style.removeProperty('--ac-process-node-progress');
      progressIndicator.hidden = true;
      delete progressIndicator.dataset.progress;
      delete progressIndicator.dataset.phase;
      delete progressIndicator.dataset.nodeId;
    }

    document.querySelectorAll('.ac-global-agent-work [data-ac-agent-id]').forEach(item => {
      const agentId = item.dataset.acAgentId;
      item.dataset.agentState = agentId === root.dataset.visualActiveAgentId
        ? 'active'
        : state.completedAgents.has(agentId) ? 'complete' : 'waiting';
      item.querySelector('button')?.setAttribute('aria-pressed', String(agentId === state.agentAuditOpenId));
    });
    const globalAgent = document.querySelector('[data-ac-global-agent]');
    const globalTask = document.querySelector('[data-ac-global-task]');
    const globalHost = document.querySelector('[data-ac-global-agent-work]');
    if (globalHost) globalHost.dataset.referenceReplay = String(referenceReplay);
    if (globalAgent) globalAgent.textContent = referenceReplay ? `Live reference run · ${identity.label}` : identity.label;
    if (globalTask) globalTask.textContent = identity.task;
  }

  function spatialPosition(nodeId) {
    const branchPosition = CAUSATION_BRANCH_LAYOUT.find(([branchNodeId]) => branchNodeId === nodeId);
    if (branchPosition) return [branchPosition[2], branchPosition[3]];
    return SPATIAL_SPINE_POSITIONS[nodeId] || [50, 50];
  }

  function laterMemoryDelta() {
    return validatedLaterMemory() || {
      originId: '',
      nodeId: '',
      edges: [],
      evidenceIds: [],
      receiptBound: false,
    };
  }

  function validatedLaterMemory() {
    const validation = asObject(state.laterMemoryValidation);
    const later = asObject(state.laterResult) || {};
    const receipt = asObject(later.memory_application);
    const delta = asObject(validation?.delta);
    if (!validation
      || validation.contract !== LATER_MEMORY_VALIDATION_CONTRACT
      || validation.validated !== true
      || validation.proofReady !== true
      || validation.memoryUsed !== true
      || validation.sharedPlaybookUnchanged !== true
      || !receipt
      || receipt.contract !== 'casepath.memory-application-receipt/1.0.0'
      || later.shared_rule_applied !== false
      || String(validation.runId || '') !== String(receipt.target?.run_id || '')
      || String(validation.applicationHash || '') !== String(receipt.application_hash || '')
      || String(validation.memoryOriginId || '') !== String(receipt.source_memory?.memory_id || '')) return null;
    const nodeIds = unique(asArray(delta?.nodeIds).map(value => String(value || '')).filter(Boolean));
    const edges = asArray(delta?.edges)
      .map(edge => ({ source: String(edge?.source || ''), target: String(edge?.target || '') }))
      .filter(edge => edge.source && edge.target);
    const evidenceIds = unique(asArray(delta?.evidenceIds).map(value => String(value || '')).filter(Boolean));
    if (nodeIds.length !== 1 || edges.length !== 2 || evidenceIds.length !== 3) return null;
    const returnedNodeIds = new Set(asArray(later.process?.nodes).map(node => String(node?.node_id || '')));
    const returnedEdges = new Set(asArray(later.process?.edges).map(edge => `${edge?.source || ''}:${edge?.target || ''}`));
    const returnedEvidenceIds = new Set(asArray(later.checklist?.items).map(item => String(item?.item_id || '')));
    if (!nodeIds.every(nodeId => returnedNodeIds.has(nodeId))
      || !edges.every(edge => returnedEdges.has(`${edge.source}:${edge.target}`))
      || !evidenceIds.every(itemId => returnedEvidenceIds.has(itemId))) return null;
    return {
      originId: String(validation.memoryOriginId),
      nodeId: nodeIds[0],
      edges,
      evidenceIds,
      applicationHash: String(validation.applicationHash),
      receiptBound: true,
    };
  }

  function reviewedKnowledgeState() {
    const result = asObject(state.result) || {};
    const knowledge = asObject(state.review?.knowledge) || asObject(result.knowledge) || asObject(state.knowledge) || {};
    const candidate = asObject(state.review?.candidate) || asObject(knowledge.candidate) || asObject(knowledge.reusable_rule_candidate) || asObject(result.reusable_rule_candidate) || {};
    const memoryId = String(valueFrom(state.review, 'memory_id') || valueFrom(knowledge, 'memory_id') || valueFrom(result, 'memory_id') || '');
    const available = Boolean(state.review?.accepted === true && knowledge.reviewed_memory_available === true && memoryId);
    const sharedChanged = Boolean(candidate.shared_knowledge_changed === true && candidate.status === 'released');
    return { memoryId, available, sharedChanged, candidate, knowledge };
  }

  function reviewAppliedTruth() {
    const nodeAdded = Boolean(nodeById('ventilation_dispute'));
    const useEvidence = asArray(state.checklist?.items).find(item => item.item_id === 'use_evidence');
    const buildingEnvelope = asArray(state.checklist?.items).find(item => item.item_id === 'building_envelope');
    const useEvidenceMoved = evidenceOwnerIds(useEvidence).includes('ventilation_dispute');
    const buildingRemainsConditional = buildingEnvelope?.status === 'conditional';
    return {
      nodeAdded,
      useEvidenceMoved,
      buildingRemainsConditional,
      verified: nodeAdded && useEvidenceMoved && buildingRemainsConditional,
    };
  }

  function acceptedLaterCausalStep(detail) {
    if (!detail || detail.contract !== LATER_CAUSAL_STEP_CONTRACT) return null;
    const phase = String(detail.phase || '');
    if (phase === 'waiting') {
      const memory = reviewedKnowledgeState();
      const originId = String(detail.memoryOriginId || '');
      if (!memory.available || !originId || originId !== memory.memoryId) return null;
      return { phase, memoryOriginId: originId, runId: String(detail.runId || '') };
    }
    if (!asObject(state.laterResult)) return null;
    if (phase === 'source') {
      const fact = asArray(state.laterResult.facts).find(item => item.fact_id === String(detail.factId || ''));
      const receipt = asObject(state.laterResult.memory_application);
      const runId = String(detail.runId || '');
      const ref = asArray(fact?.source_refs).find(item => (
        item.artifact_id === String(detail.sourceId || '')
        && sourceLocatorId(item) === String(detail.locatorId || '')
      ));
      if (!fact
        || fact.semantic_role !== 'management_ventilation_allegation'
        || !ref
        || !runId
        || String(receipt?.target?.run_id || '') !== runId) return null;
      return { phase, fact, ref, runId };
    }
    if (phase === 'memory') {
      const receipt = asObject(state.laterResult.memory_application);
      const originId = String(detail.memoryOriginId || '');
      const runId = String(detail.runId || '');
      const retrieved = state.laterResult.reviewed_memory_retrieved === true
        || state.laterResult.knowledge?.reviewed_memory_retrieved === true;
      if (!retrieved
        || receipt?.contract !== 'casepath.memory-application-receipt/1.0.0'
        || String(receipt.source_memory?.memory_id || '') !== originId
        || !runId
        || String(receipt.target?.run_id || '') !== runId
        || !originId) return null;
      return { phase, memoryOriginId: originId, runId };
    }
    if (phase === 'eligibility') {
      const receipt = asObject(state.laterResult.memory_application);
      const eligibility = asObject(receipt.eligibility);
      const checks = asObject(eligibility.checks);
      const fact = asArray(state.laterResult.facts).find(item => item.semantic_role === 'management_ventilation_allegation');
      const originId = String(detail.memoryOriginId || '');
      const runId = String(detail.runId || '');
      if (receipt?.applied !== true
        || eligibility?.eligible !== true
        || eligibility?.contract !== 'casepath.semantic-memory-eligibility/1.0.0'
        || fact?.semantic_role !== 'management_ventilation_allegation'
        || String(detail.eligibilityContract || '') !== String(eligibility.contract || '')
        || String(detail.ruleId || '') !== String(eligibility.rule_id || '')
        || String(detail.semanticRole || '') !== String(fact?.semantic_role || '')
        || !Object.keys(checks).length
        || !Object.values(checks).every(value => value === true)
        || !originId
        || originId !== String(receipt.source_memory?.memory_id || '')
        || !runId
        || runId !== String(receipt.target?.run_id || '')) return null;
      return {
        phase,
        memoryOriginId: originId,
        runId,
        eligibilityContract: String(eligibility.contract),
        ruleId: String(eligibility.rule_id),
        semanticRole: String(fact.semantic_role),
      };
    }
    return null;
  }

  function momentCopy() {
    const copy = MOMENT_COPY[state.moment] || MOMENT_COPY.opening;
    if (state.moment === 'review-applied' && !reviewAppliedTruth().verified) {
      return {
        ...copy,
        title: 'The correction could not be verified.',
        detail: 'No process change is claimed until every returned review consequence agrees.',
        authority: 'Unverified correction · incomplete result',
      };
    }
    if (state.moment !== 'later-result' || validatedLaterMemory()) return copy;
    const validation = asObject(state.laterMemoryValidation) || {};
    const detail = validation.retrievedOnly === true
      ? 'Unverified memory was retrieved but not applied.'
      : validation.memoryRetrieved === true
        ? 'Memory retrieval returned, but application proof did not agree.'
        : 'No saved-memory change was validated.';
    return {
      ...copy,
      title: 'No memory-driven process change is claimed.',
      detail,
      authority: 'Saved-case comparison · application not proven',
    };
  }

  function nodeLabel(nodeId) {
    return SPATIAL_NODE_LABELS[nodeId] || nodeById(nodeId)?.title || String(nodeId || '').replaceAll('_', ' ');
  }

  function nodeQuestion(node) {
    return DEFAULT_NODE_COPY[node?.node_id]?.[0]
      || CAUSATION_BRANCH_QUESTIONS[node?.node_id]
      || node?.question
      || node?.title
      || 'What must this step establish?';
  }

  function verificationGraphMarkup() {
    const verification = asObject(state.verification) || {};
    const checksTotal = asArray(verification.checks).length || Number(verification.checks_total) || 0;
    const rejectedCount = asArray(verification.rejected_proposals).length || Number(verification.rejected_count) || 0;
    const verified = verification.valid === true && verification.computed === true && checksTotal > 0;
    return `<section class="ac-graph-verification" style="--spatial-x:49;--spatial-y:72" data-spatial-anchor-node-id="causation" data-node-attachment-kind="verification" ${lineageAttributes('verification', 'whole_playbook_verification')} data-verification-status="${verified ? 'accepted' : 'incomplete'}" data-verification-check-count="${esc(checksTotal)}" data-verification-rejected-count="${esc(rejectedCount)}" data-ac-cursor-target="true">
      <small>Final audit</small>
      <strong>${verified ? `${esc(checksTotal)} checks agree` : 'Verification incomplete'}</strong>
      <span>${verified ? rejectedCount ? `${esc(rejectedCount)} unsupported proposal${rejectedCount === 1 ? '' : 's'} rejected` : 'No unsupported proposals retained' : 'No complete result is claimed.'}</span>
    </section>`;
  }

  function knowledgeGraphMarkup() {
    const memory = reviewedKnowledgeState();
    return `<section class="ac-knowledge-graph-note" style="--spatial-x:43;--spatial-y:67" data-spatial-anchor-node-id="ventilation_dispute" data-memory-id="${esc(memory.memoryId)}" data-memory-status="${memory.available ? 'unverified_demo_memory' : 'not-confirmed'}" data-shared-rule-applied="${esc(String(memory.sharedChanged))}">
      <small>What CasePath learned</small>
      <strong>${memory.available ? 'Check ventilation allegations separately' : 'No demo memory was confirmed'}</strong>
      <span>${memory.sharedChanged ? 'A released shared-playbook change was returned.' : 'Saved as unverified case memory · Shared playbook unchanged'}</span>
    </section>`;
  }

  function laterCausalGraphMarkup() {
    const step = state.laterCausalStep;
    const memory = reviewedKnowledgeState();
    if (step?.phase === 'source') {
      const finding = step.ref.excerpt || step.ref.observation || `${step.fact.label}: ${step.fact.value}`;
      if (!step.opened) {
        return `<section class="ac-later-memory-retrieval ac-later-source-step" style="--spatial-x:42;--spatial-y:65" data-later-causal-phase="source" data-later-source-opened="false" data-spatial-anchor-node-id="causation">
          <small>Held-out claim · new evidence</small>
          <strong>${esc(step.fact.label || 'Management allegation')}</strong>
          <span>Open the exact source before testing saved memory.</span>
          <button type="button" data-ac-action="open-source" data-ac-inspection-target="true" data-ac-cursor-target="true" ${sourceContextAttributes(step.fact, step.ref)}>Open this source</button>
        </section>`;
      }
      if (!step.highlighted) {
        return `<section class="ac-later-memory-retrieval ac-later-source-step" style="--spatial-x:42;--spatial-y:65" data-later-causal-phase="source" data-later-source-opened="true" data-later-source-highlighted="false" data-spatial-anchor-node-id="causation">
          <small>Held-out claim · source opened</small>
          <strong>${esc(sourceDisplayTitle(step.ref.artifact_id))}</strong>
          ${sourceReadingMarkup(step.fact, step.ref, true, false)}
          <span>Select the exact passage before testing saved memory.</span>
        </section>`;
      }
      return `<section class="ac-later-memory-retrieval ac-later-source-step" style="--spatial-x:42;--spatial-y:65" data-later-causal-phase="source" data-later-source-opened="true" data-spatial-anchor-node-id="causation">
        <small>Held-out claim · exact source opened</small>
        ${sourceReadingMarkup(step.fact, step.ref, false, true) || `<strong><mark class="is-highlighted">${esc(finding)}</mark></strong>`}
        <span>Unresolved allegation extracted · now comparing with the saved correction.</span>
        <button type="button" data-ac-action="open-source" ${sourceContextAttributes(step.fact, step.ref)}>View source</button>
      </section>`;
    }
    if (step?.phase === 'memory') {
      return `<section class="ac-later-memory-retrieval" style="--spatial-x:42;--spatial-y:65" data-later-causal-phase="memory" data-spatial-anchor-node-id="causation" data-memory-origin-id="${esc(step.memoryOriginId)}" data-ac-cursor-target="true">
        <small>Saved case memory</small>
        <strong>Check ventilation allegations separately</strong>
        <span>Unverified case memory found · now checking whether it fits this claim.</span>
      </section>`;
    }
    if (step?.phase === 'eligibility') {
      return `<section class="ac-later-memory-retrieval ac-later-eligibility-step" style="--spatial-x:42;--spatial-y:65" data-later-causal-phase="eligibility" data-spatial-anchor-node-id="causation" data-memory-origin-id="${esc(step.memoryOriginId)}" data-eligibility-contract="${esc(step.eligibilityContract)}" data-eligibility-rule-id="${esc(step.ruleId)}" data-semantic-role="${esc(step.semanticRole)}" data-ac-cursor-target="true">
        <small>Match confirmed</small>
        <strong>Same unresolved ventilation allegation</strong>
        <span>Adding one conditional check to this claim.</span>
      </section>`;
    }
    return `<section class="ac-later-memory-retrieval" style="--spatial-x:42;--spatial-y:65" data-later-causal-phase="waiting" data-spatial-anchor-node-id="causation" data-memory-origin-id="${esc(step?.memoryOriginId || memory.memoryId)}">
      <small>Separate future claim</small>
      <strong>Checking whether the saved lesson applies</strong>
      <span>Source first · saved lesson next · graph changes only when the match is confirmed.</span>
    </section>`;
  }

  function reviewGraphEditMarkup() {
    return `<section class="ac-review-graph-edit" style="--spatial-x:62;--spatial-y:68" data-review-edit-state="pending" data-review-node-id="causation" data-spatial-anchor-node-id="causation">
      <small>Process and evidence correction</small>
      <div class="ac-review-change"><span>Implicit allegation</span><b aria-hidden="true">→</b><strong>Add ventilation decision</strong></div>
      <p>Move use evidence to the new decision; building-envelope assessment remains conditional.</p>
      <button type="button" data-ac-action="submit-review" data-review-mode="conditional" data-casepath-primary-action="true" data-ac-cursor-target="true">Apply correction</button>
    </section>`;
  }

  function reviewAppliedMarkup() {
    const truth = reviewAppliedTruth();
    return `<section class="ac-review-applied-note" style="--spatial-x:43;--spatial-y:67" data-review-edit-state="applied" data-review-delta-verified="${esc(String(truth.verified))}" data-review-node-id="ventilation_dispute" data-spatial-anchor-node-id="ventilation_dispute" data-review-node-added="${esc(String(truth.nodeAdded))}" data-review-use-evidence-moved="${esc(String(truth.useEvidenceMoved))}" data-review-building-conditional="${esc(String(truth.buildingRemainsConditional))}">
      <small>${truth.verified ? 'Correction applied to this case' : 'Correction result incomplete'}</small>
      <strong>${truth.verified ? 'Ventilation check added' : 'No correction is claimed'}</strong>
      <span data-review-effect="evidence-moved">${truth.useEvidenceMoved ? 'Ventilation evidence moved here' : 'Evidence move not returned'}</span>
      <span data-review-effect="testing-conditional">${truth.buildingRemainsConditional ? 'Building-envelope test remains conditional' : 'Conditional testing state not returned'}</span>
      <em>${truth.verified ? 'Unverified demo correction · model acceptance not reused · responsibility remains blocked.' : 'Returned review consequences did not agree · existing process retained.'}</em>
    </section>`;
  }

  function laterMemoryDeltaMarkup() {
    const delta = laterMemoryDelta();
    if (!delta.receiptBound || !delta.originId || !delta.nodeId || delta.edges.length !== 2 || delta.evidenceIds.length !== 3) return '';
    const links = delta.edges.map(edge => `<span class="ac-memory-process-link" data-memory-origin-id="${esc(delta.originId)}" data-edge-source="${esc(edge.source)}" data-edge-target="${esc(edge.target)}"><b>${esc(nodeLabel(edge.source))}</b><i aria-hidden="true">→</i><strong>${esc(nodeLabel(edge.target))}</strong></span>`).join('');
    const evidence = delta.evidenceIds.map(itemId => `<span class="ac-memory-evidence-change" data-memory-effect="evidence-changed" data-memory-origin-id="${esc(delta.originId)}" data-item-id="${esc(itemId)}"><b>${esc(SPATIAL_EVIDENCE_LABELS[itemId] || itemId.replaceAll('_', ' '))}</b><small>Updated</small></span>`).join('');
    return `<section class="ac-memory-graph-delta" style="--spatial-x:44;--spatial-y:67" data-memory-receipt="true" data-memory-origin-id="${esc(delta.originId)}" data-spatial-anchor-node-id="${esc(delta.nodeId)}" data-memory-payoff="single-action" data-memory-status="unverified-case-memory" data-responsibility-state="blocked" data-shared-playbook-changed="false">
      <small>Saved lesson used on this claim</small>
      <strong class="ac-memory-action">Check ventilation before assigning responsibility.</strong>
      <p>Cause still unproven · responsibility stays blocked · qualified review required.</p>
      <details><summary>Inspect proof</summary><div class="ac-memory-proof-summary">1 decision · 2 connections · 3 document needs</div><div class="ac-memory-process-links" aria-label="Two process links added from saved case memory">${links}</div><div class="ac-memory-evidence-changes" aria-label="Three evidence needs updated from saved case memory">${evidence}</div><small>Unverified case memory · only this claim changed · Shared playbook unchanged.</small></details>
    </section>`;
  }

  function edgeMarkup(source, target, path, stateValue = '', sourcePosition = null, targetPosition = null, extraAttributes = '') {
    const [sourceX, sourceY] = sourcePosition || spatialPosition(source);
    const [targetX, targetY] = targetPosition || spatialPosition(target);
    const x1 = sourceX * 10;
    const y1 = sourceY * 6.2;
    const x2 = targetX * 10;
    const y2 = targetY * 6.2;
    const control = Math.max(25, Math.abs(x2 - x1) * .44);
    const d = Math.abs(y2 - y1) < 2
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`;
    return `<path d="${d}" data-spatial-edge="${esc(path)}" data-spatial-path="${esc(path)}" data-edge-source="${esc(source)}" data-edge-target="${esc(target)}" data-edge-state="${esc(stateValue)}" ${extraAttributes}></path>`;
  }

  function spatialEdgesMarkup(nodes) {
    const visible = new Set(nodes.filter(node => state.visibleNodeIds.has(node.node_id)).map(node => node.node_id));
    const paths = [];
    const explanatorySpineEdges = new Set(
      SIMPLIFIED_SPINE_IDS.slice(1, SIMPLIFIED_SPINE_IDS.indexOf('causation') + 1)
        .map((target, index) => `${SIMPLIFIED_SPINE_IDS[index]}:${target}`),
    );
    const focusMemoryPath = ['review-applied', 'knowledge', 'later-work', 'later-result'].includes(state.moment);
    const laterDelta = state.moment === 'later-result' ? laterMemoryDelta() : null;
    const renderedMemoryEdges = new Set();
    asArray(state.process?.edges).forEach(edge => {
      if (!visible.has(edge.source) || !visible.has(edge.target)) return;
      const edgeKey = `${edge.source}:${edge.target}`;
      const reviewAdded = state.moment === 'review-applied'
        && edge.source === 'ventilation_dispute'
        && edge.target === 'causation';
      const isMemoryEdge = Boolean(laterDelta?.receiptBound && laterDelta.originId && !renderedMemoryEdges.has(edgeKey) && laterDelta.edges.some(item => (
        item.source === edge.source && item.target === edge.target
      )));
      if (!explanatorySpineEdges.has(edgeKey) && !reviewAdded && !isMemoryEdge) return;
      const path = edge.state === 'selected'
        ? 'accepted'
        : edge.state === 'loop'
          ? 'loop'
          : 'future';
      if (isMemoryEdge) renderedMemoryEdges.add(edgeKey);
      const memoryAttributes = isMemoryEdge
        ? `data-memory-effect="edge-added" data-memory-origin-id="${esc(laterDelta.originId)}"`
        : reviewAdded ? 'data-review-effect="edge-added"' : '';
      paths.push(edgeMarkup(edge.source, edge.target, path, edge.state || '', null, null, memoryAttributes));
    });
    if (laterDelta?.receiptBound && laterDelta.originId) {
      laterDelta.edges.forEach(edge => {
        const edgeKey = `${edge.source}:${edge.target}`;
        const exactVisibleBranch = nodeId => {
          const returnedBranch = nodeById('causation')?.branches?.find(item => item.target === nodeId);
          const returnedEdge = asArray(state.process?.edges).find(item => item.source === 'causation' && item.target === nodeId);
          return Boolean(!state.graphRevealRunning && nodeById(nodeId) && returnedBranch && returnedEdge);
        };
        const sourceVisible = visible.has(edge.source) || exactVisibleBranch(edge.source);
        const targetVisible = visible.has(edge.target) || exactVisibleBranch(edge.target);
        if (renderedMemoryEdges.has(edgeKey) || !sourceVisible || !targetVisible) return;
        renderedMemoryEdges.add(edgeKey);
        paths.push(edgeMarkup(
          edge.source,
          edge.target,
          'memory-added',
          'added',
          spatialPosition(edge.source),
          spatialPosition(edge.target),
          `data-memory-effect="edge-added" data-memory-origin-id="${esc(laterDelta.originId)}"`,
        ));
      });
    }
    if (visible.has('causation')) {
      CAUSATION_BRANCH_LAYOUT.forEach(([target, , x, y]) => {
        if (focusMemoryPath && target !== 'evidence_gap') return;
        if (state.graphRevealRunning && !state.visibleBranchIds.has(target)) return;
        const targetNode = nodeById(target);
        const returnedBranch = nodeById('causation')?.branches?.find(item => item.target === target);
        const returnedEdge = asArray(state.process?.edges).find(edge => edge.source === 'causation' && edge.target === target);
        if (!targetNode || !returnedBranch || !returnedEdge) return;
        const routePath = returnedEdge.state === 'selected' ? 'next-action' : 'uncertainty';
        paths.push(edgeMarkup('causation', target, routePath, returnedEdge.state || '', spatialPosition('causation'), [x, y]));
      });
    }
    if (state.moment === 'review-applied' && visible.has('ventilation_dispute')) {
      const reviewEdge = asArray(state.process?.edges).find(edge => (
        edge.source === 'evidence_gap' && edge.target === 'ventilation_dispute'
      ));
      if (reviewEdge && nodeById('evidence_gap')) {
        paths.push(edgeMarkup(
          reviewEdge.source,
          reviewEdge.target,
          'review-added',
          reviewEdge.state || 'added',
          spatialPosition('evidence_gap'),
          spatialPosition('ventilation_dispute'),
          'data-review-effect="edge-added"',
        ));
      }
    }
    const detailNodeId = state.graphInspecting
      ? state.pendingGraphNodeId || state.pendingBranchNodeId || state.selectedNodeId
      : state.selectedNodeId;
    const detailIsVisible = visible.has(detailNodeId)
      || CAUSATION_BRANCH_LAYOUT.some(([nodeId]) => nodeId === detailNodeId && nodeById(nodeId));
    if (detailIsVisible && !['review', 'review-applied', 'later-work'].includes(state.moment)) {
      const [detailX, detailY] = spatialPosition(detailNodeId);
      const connectorX = detailX * 10;
      paths.push(`<path d="M ${connectorX} ${detailY * 6.2} L ${connectorX} ${63 * 6.2}" data-spatial-edge="source-proof" data-spatial-path="source-proof" data-source-proof="true"></path>`);
    }
    return paths.join('');
  }

  function spatialSatellitesMarkup() {
    if (!state.processAccepted || !state.visibleNodeIds.has('causation')) return '';
    const causation = nodeById('causation');
    const law = relevantLaw(lawsForNode(causation));
    const next = relevantEvidence(evidenceForNode('evidence_gap'));
    const evidence = priorityEvidence(evidenceForNode('causation')).filter(item => item.item_id !== next?.item_id).slice(0, 2);
    const branchMarkup = CAUSATION_BRANCH_LAYOUT.map(([nodeId, shortLabel, x, y], index) => {
      if (['review-applied', 'knowledge', 'later-work', 'later-result'].includes(state.moment) && nodeId !== 'evidence_gap') return '';
      if (state.graphRevealRunning && !state.visibleBranchIds.has(nodeId)) return '';
      const returnedNode = nodeById(nodeId);
      if (!returnedNode) return '';
      const branch = causation?.branches?.find(item => item.target === nodeId);
      const returnedEdge = asArray(state.process?.edges).find(edge => edge.source === 'causation' && edge.target === nodeId);
      if (!branch || !returnedEdge) return '';
      return `<button type="button" class="ac-spatial-branch" style="--spatial-x:${x};--spatial-y:${y}" data-ac-action="select-node" data-spatial-id="${esc(nodeId)}" data-spatial-role="branch" data-spatial-path="${returnedEdge.state === 'selected' ? 'next-action' : 'uncertainty'}" data-node-id="${esc(nodeId)}" data-branch-id="${esc(branch.branch_id)}" data-branch-state="${esc(branch.state || '')}" aria-label="${esc(CAUSATION_BRANCH_QUESTIONS[nodeId] || returnedNode.title)}"><span aria-hidden="true">H${index + 1}</span><strong>${esc(shortLabel)}</strong></button>`;
    }).join('');
    const lawLabel = law?.location?.match(/Art(?:icle)?\.?\s*\d+/i)?.[0]?.replace(/^Article/i, 'Art.') || 'Swiss law';
    const lawMarkup = !state.graphRevealRunning && law ? `<button type="button" class="ac-spatial-law-marker" style="--spatial-x:62;--spatial-y:27" data-ac-action="open-law" data-law-id="${esc(law.source_id)}" data-spatial-id="${esc(law.source_id)}" data-spatial-anchor-node-id="causation" data-spatial-role="law" data-spatial-path="legal-grounding" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}" aria-label="${esc(`${law.title || law.source_id} ${law.location || ''}`)}"><span aria-hidden="true">§</span><strong>${esc(lawLabel)}</strong></button>` : '';
    const evidenceMarkup = evidence.map(item => `<button type="button" class="ac-evidence-chip" data-ac-action="inspect-evidence" data-evidence-id="${esc(item.item_id)}" data-spatial-id="${esc(item.item_id)}" data-spatial-anchor-node-id="causation" data-spatial-role="evidence" data-spatial-path="evidence-support" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', item.item_id)} data-evidence-status="${esc(item.status || '')}" data-fact-id="${esc(item.fact_id || '')}" aria-label="${esc(`${item.title} · ${statusLabel(item.status)}`)}">${esc(SPATIAL_EVIDENCE_LABELS[item.item_id] || item.title)}</button>`).join('<span aria-hidden="true">·</span>');
    const nextMarkup = next && nodeById('evidence_gap') && evidenceOwnerIds(next).includes('evidence_gap') ? `<button type="button" class="ac-evidence-need" data-ac-action="inspect-evidence" data-spatial-id="${esc(next.item_id)}" data-spatial-role="next-action" data-spatial-path="next-action" data-spatial-next-action="true" data-spatial-anchor-node-id="causation" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', next.item_id)} data-node-id="evidence_gap" data-evidence-id="${esc(next.item_id)}"><span>Needed next</span><strong>${esc(SPATIAL_EVIDENCE_LABELS[next.item_id] || next.title)}</strong><b aria-hidden="true">→</b></button>` : '';
    const checklistCount = asArray(state.checklist?.items).length;
    const evidencePanel = !state.graphRevealRunning && (nextMarkup || evidenceMarkup) ? `<section class="ac-evidence-relationship" style="--spatial-x:53;--spatial-y:75" aria-label="Documents created by the current process decision"><small>Documents created by this decision</small><p class="ac-evidence-origin">Causation is unresolved</p>${nextMarkup}${evidenceMarkup ? `<div><span>Later, if required</span>${evidenceMarkup}</div>` : ''}${state.moment === 'ready' && checklistCount ? `<button type="button" class="ac-document-needs-link" data-ac-action="open-documents" aria-controls="v20DocumentSheet" aria-haspopup="dialog">See all ${checklistCount} across the process</button>` : ''}</section>` : '';
    if (state.moment === 'review') return `${branchMarkup}${reviewGraphEditMarkup()}`;
    if (state.moment === 'review-applied') return `${branchMarkup}${reviewAppliedMarkup()}`;
    if (state.moment === 'verify') return `${lawMarkup}${branchMarkup}${verificationGraphMarkup()}`;
    if (state.moment === 'knowledge') return `${branchMarkup}${knowledgeGraphMarkup()}`;
    if (state.moment === 'later-work') return `${branchMarkup}${laterCausalGraphMarkup()}`;
    if (state.moment === 'later-result') return `${branchMarkup}${laterMemoryDeltaMarkup()}`;
    return `${lawMarkup}${branchMarkup}${evidencePanel}`;
  }

  function graphEvidenceDetailMarkup(node) {
    const focused = asArray(state.checklist?.items).find(item => item.item_id === state.focusEvidenceId);
    const localItems = evidenceForNode(node.node_id);
    const item = localItems.find(candidate => candidate.item_id === focused?.item_id)
      || relevantEvidence(localItems);
    if (!item) return '';
    return `<article class="ac-spatial-node-detail ac-graph-local-object ac-graph-local-evidence" data-spatial-role="active-detail" data-active-focal-path="true" data-node-id="${esc(node.node_id)}" data-spatial-anchor-node-id="${esc(node.node_id)}" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', item.item_id)} data-evidence-id="${esc(item.item_id)}" data-evidence-status="${esc(item.status || '')}" data-fact-id="${esc(item.fact_id || '')}">
      <span>${esc(statusLabel(item.status))} · evidence for this decision</span>
      <strong>${esc(item.title)}</strong>
      <p>${esc(item.why || 'This process decision generates the requirement.')}</p>
      <button type="button" data-ac-action="inspect-evidence" data-node-id="${esc(node.node_id)}" data-evidence-id="${esc(item.item_id)}" data-casepath-primary-action="true" data-ac-cursor-target="true">Inspect requirement</button>
    </article>`;
  }

  function graphReferenceDetailMarkup(node) {
    const local = precedentsForNode(node.node_id);
    const precedent = local.find(item => item.claim_id === state.focusPrecedentId)
      || relevantPrecedent(local)
      || null;
    if (!precedent) return '';
    const ranking = precedent.ranking || {};
    return `<article class="ac-spatial-node-detail ac-graph-local-object ac-graph-local-reference" data-spatial-role="active-detail" data-active-focal-path="true" data-node-id="${esc(node.node_id)}" data-spatial-anchor-node-id="${esc(node.node_id)}" data-node-attachment-kind="precedent" ${lineageAttributes('precedent', precedent.claim_id)} data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-ranking-contract="${esc(ranking.contract || '')}" data-ranking-rank="${esc(ranking.rank ?? '')}" data-ranking-score-basis-points="${esc(ranking.score_basis_points ?? '')}" data-ranking-context-hash="${esc(ranking.context_hash || '')}">
      <span>${esc(provenanceLabel(precedent))}</span>
      <strong>${esc(precedent.title)}</strong>
      <p>${esc(precedent.why_useful || 'A generated reference pattern attached to this decision.')}</p>
      <button type="button" data-ac-action="open-reference" data-node-id="${esc(node.node_id)}" data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-casepath-primary-action="true" data-ac-cursor-target="true">Inspect generated pattern</button>
    </article>`;
  }

  function spatialDetailMarkup(node) {
    if (!node) return '';
    const specialMoment = ['verify', 'review', 'review-applied', 'knowledge', 'later-work', 'later-result'].includes(state.moment);
    if (specialMoment && !state.manualNodeInspection) return '';
    if (['review', 'review-applied', 'later-work'].includes(state.moment)) return '';
    if (state.moment === 'evidence') return graphEvidenceDetailMarkup(node) || spatialGroundingMarkup(node);
    if (state.moment === 'experience') return graphReferenceDetailMarkup(node) || spatialGroundingMarkup(node);
    if (state.graphInspecting && [state.pendingGraphNodeId, state.pendingBranchNodeId].includes(node.node_id)) return nodeInspectionMarkup(node);
    const facts = asArray(node.fact_ids);
    const laws = asArray(node.legal_source_ids);
    const evidence = asArray(node.evidence_requirement_ids);
    return `<div class="ac-spatial-node-detail" data-spatial-role="active-detail" data-spatial-path="active" data-active-focal-path="true" data-node-id="${esc(node.node_id)}" data-basis-fact-ids="${esc(facts.join(','))}" data-basis-law-ids="${esc(laws.join(','))}" data-basis-evidence-requirement-ids="${esc(evidence.join(','))}"><span>Process question</span><strong>${esc(nodeQuestion(node))}</strong>${spatialGroundingMarkup(node)}</div>`;
  }

  function emitGraphContextualArtifact(detail, satellites) {
    if (state.graphRevealRunning || !['evidence', 'experience', 'verify'].includes(state.moment)) return;
    const attachment = state.moment === 'verify'
      ? satellites?.querySelector('.ac-graph-verification[data-node-attachment-kind="verification"]')
      : detail?.querySelector('.ac-graph-local-object[data-node-attachment-kind]');
    const kind = attachment?.dataset.nodeAttachmentKind || '';
    const entityId = kind === 'evidence'
      ? attachment?.dataset.evidenceId
      : kind === 'precedent'
        ? attachment?.dataset.precedentId
        : kind === 'verification' ? 'whole_playbook_verification' : '';
    if (!entityId) return;
    emitArtifactChange(kind, entityId);
  }

  function nodeCausalChainMarkup(node, fact, evidence) {
    if (!evidence) return '';
    const evidenceFact = state.facts.find(item => item.fact_id === evidence.fact_id) || fact;
    const alternatives = unique(asArray(evidence.acceptable_alternatives).map(String));
    const returnedArtifacts = unique(asArray(evidence.artifact_ids).map(String));
    const status = String(evidence.status || '');
    const labels = {
      provided_sufficient: ['Fact already shown', 'Evidence available', 'Source available'],
      provided_insufficient: ['Fact not yet settled', 'Evidence incomplete', 'More evidence needed'],
      missing: ['Fact to establish', 'Evidence needed', 'Document required'],
      conditional: ['Fact to establish if needed', 'Evidence if needed', 'Document if needed'],
      not_applicable: ['Fact not needed on this path', 'Evidence not needed', 'No document required'],
    }[status] || ['Fact to establish', 'Evidence needed', 'Document required'];
    const factCopy = evidenceFact
      ? `${evidenceFact.label}: ${evidenceFact.value}`
      : evidence.fact_label || 'A fact still needs to be established';
    const evidenceCopy = evidence.title || evidence.why || 'Returned evidence requirement';
    const documentCopy = status === 'not_applicable'
      ? 'None on the current path'
      : returnedArtifacts.length
        ? returnedArtifacts.map(sourceDisplayTitle).join(' · ')
        : alternatives[0] || evidence.title || 'Document type returned in the plan';
    return `<section class="ac-node-causal-chain" data-node-document-chain="true" data-node-id="${esc(node.node_id)}" data-evidence-id="${esc(evidence.item_id || '')}" data-evidence-status="${esc(status)}" data-fact-id="${esc(evidenceFact?.fact_id || evidence.fact_id || '')}">
      <div data-chain-part="decision"><small>Process question</small><strong>${esc(nodeQuestion(node))}</strong></div><i aria-hidden="true">→</i>
      <div data-chain-part="fact"><small>${esc(labels[0])}</small><strong>${esc(factCopy)}</strong></div><i aria-hidden="true">→</i>
      <div data-chain-part="evidence"><small>${esc(labels[1])}</small><strong>${esc(evidenceCopy)}</strong></div><i aria-hidden="true">→</i>
      <div data-chain-part="document"><small>${esc(labels[2])}</small><strong>${esc(documentCopy)}</strong><button type="button" data-ac-action="open-documents" data-node-id="${esc(node.node_id)}">Open plan →</button></div>
    </section>`;
  }

  function spatialGroundingMarkup(node) {
    const directFact = relevantFact(directFactsForNode(node));
    const fact = directFact || relevantFact(factsForNode(node));
    const ref = representativeFactRef(directFact);
    const nodeLaws = lawsForNode(node);
    const laws = [nodeLaws.find(isOfficialLaw), nodeLaws.find(item => !isOfficialLaw(item))].filter(Boolean);
    const evidence = relevantEvidence(evidenceForNode(node.node_id));
    const nodePrecedents = precedentsForNode(node.node_id);
    const precedent = nodePrecedents.find(item => Number(item.ranking?.rank) === 1)
      || relevantPrecedent(nodePrecedents);
    let sourcePreview = '';
    const items = [];
    if (fact && ref) {
      sourcePreview = `<div class="ac-node-source-preview${ref.locator_kind === 'visual_observation' ? ' ac-node-source-preview-visual' : ''}" data-node-attachment-kind="fact" ${lineageAttributes('fact', fact.fact_id)} ${sourceContextAttributes(fact, ref)}>${sourceReadingMarkup(fact, ref, false, true)}<button type="button" class="ac-node-source-open" data-ac-action="open-source" data-node-id="${esc(node.node_id)}" ${sourceContextAttributes(fact, ref)}>Open original →</button></div>`;
    }
    if (!sourcePreview && laws[0]) {
      const law = laws[0];
      sourcePreview = `<button type="button" class="ac-node-source-preview ac-node-basis-preview" data-basis-kind="law" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-ac-action="open-law" data-node-id="${esc(node.node_id)}" data-law-id="${esc(law.source_id)}" data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}"><span>${isOfficialLaw(law) ? 'Swiss law' : 'Handling rule'}</span><small>${esc(law.location || law.title || 'Returned legal basis')}</small><strong>${esc(law.passage_text || law.passage_summary || law.role || law.title)}</strong><em>Open law →</em></button>`;
    }
    if (!sourcePreview && evidence) {
      sourcePreview = `<button type="button" class="ac-node-source-preview ac-node-basis-preview" data-basis-kind="evidence" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', evidence.item_id)} data-ac-action="inspect-evidence" data-node-id="${esc(node.node_id)}" data-evidence-id="${esc(evidence.item_id)}"><span>${['missing', 'provided_insufficient'].includes(evidence.status) ? 'Evidence gap' : 'Evidence status'}</span><small>${esc(statusLabel(evidence.status))}</small><strong>${esc(evidence.title)}</strong><em>Open document plan →</em></button>`;
    }
    if (!sourcePreview) {
      const incoming = asArray(state.process?.edges).find(edge => edge.target === node.node_id && nodeById(edge.source));
      const prior = incoming ? nodeById(incoming.source) : null;
      sourcePreview = `<button type="button" class="ac-node-source-preview ac-node-basis-preview" data-basis-kind="accepted-decision" data-ac-action="select-node" data-node-id="${esc(prior?.node_id || node.node_id)}"><span>${prior ? 'Previous accepted step' : 'Claim received'}</span><small>${esc(prior ? nodeQuestion(prior) : 'Starting point')}</small><strong>${esc(nodeQuestion(node))}</strong><em>${prior ? 'Open previous step →' : 'View this step →'}</em></button>`;
    }
    laws.forEach(law => {
      items.push(`<button type="button" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-ac-action="open-law" data-node-id="${esc(node.node_id)}" data-law-id="${esc(law.source_id)}" data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}"><span>${isOfficialLaw(law) ? 'Swiss law' : 'Handling principle'} · ${esc(law.location || '')}</span><strong>${esc(law.passage_text || law.passage_summary || law.role || law.title)}</strong></button>`);
    });
    if (evidence) {
      items.push(`<button type="button" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', evidence.item_id)} data-ac-action="inspect-evidence" data-node-id="${esc(node.node_id)}" data-evidence-id="${esc(evidence.item_id)}" data-fact-id="${esc(evidence.fact_id || '')}"><span>Evidence needed</span><strong>${esc(evidence.title)}</strong></button>`);
    }
    if (precedent) {
      items.push(`<button type="button" data-node-attachment-kind="precedent" ${lineageAttributes('precedent', precedent.claim_id)} data-ac-action="open-reference" data-node-id="${esc(node.node_id)}" data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}"><span>${esc(provenanceLabel(precedent))}</span><strong>${esc(precedent.title)}</strong></button>`);
    }
    return `<div class="ac-grounding-disclosure" data-grounding-open="false">${sourcePreview}${nodeCausalChainMarkup(node, fact, evidence)}${items.length ? `<button type="button" class="ac-grounding-toggle" data-ac-action="toggle-grounding" aria-haspopup="dialog" aria-expanded="false">View law and examples</button><div hidden>${items.join('')}</div>` : ''}</div>`;
  }

  function nodeInspectionBasis(node) {
    const nodeFacts = directFactsForNode(node);
    const fact = node?.node_id === 'intake'
      ? nodeFacts.find(candidate => String(candidate?.fact_id || '').includes('customer_objective')) || relevantFact(nodeFacts)
      : relevantFact(nodeFacts);
    const ref = representativeFactRef(fact);
    const law = relevantLaw(lawsForNode(node));
    const isCausationBranch = CAUSATION_BRANCH_LAYOUT.some(([branchNodeId]) => branchNodeId === node.node_id);
    if (LAW_FIRST_NODE_IDS.has(node.node_id) && law) {
      return {
        action: 'open-law',
        attributes: `data-law-id="${esc(law.source_id)}" data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}"`,
        sourceLabel: isOfficialLaw(law) ? 'official Swiss law' : 'handling principle',
        law,
        title: law.location || law.title,
        location: law.location || 'exact Swiss-law section',
        finding: law.passage_text || law.passage_summary || law.role || law.title,
        relation: `Shapes the next decision · ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`,
        effect: 'Shapes',
      };
    }
    if (fact && ref) {
      const locator = ref.locator_kind === 'visual_observation'
        ? `Image region · ${asArray(ref.region).map(value => Number(value).toFixed(2)).join(', ')}`
        : `Page ${ref.page || 'not returned'}`;
      const found = ref.excerpt || ref.observation || `${fact.label}: ${fact.value}`;
      const basis = node.node_id === 'evidence_gap'
        ? 'Missing-fact basis · causation remains unresolved'
        : isCausationBranch
          ? `Unresolved allegation · does not establish ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`
          : `Supports the next decision · ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`;
      const sourceKind = isCausationBranch ? 'unresolved claim evidence' : 'customer source';
      return {
        action: 'open-source',
        attributes: sourceContextAttributes(fact, ref),
        fact,
        ref,
        sourceLabel: sourceKind,
        title: sourceDisplayTitle(ref.artifact_id),
        location: locator,
        finding: found,
        relation: basis,
        effect: isCausationBranch || node.node_id === 'evidence_gap' ? 'Keeps open' : 'Supports',
      };
    }
    if (law) {
      const relation = isCausationBranch
        ? `Missing-fact basis · does not establish ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`
        : `Shapes the next decision · ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`;
      return {
        action: 'open-law',
        attributes: `data-law-id="${esc(law.source_id)}" data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}"`,
        sourceLabel: isOfficialLaw(law) ? 'official Swiss law' : 'handling principle',
        law,
        title: law.location || law.title,
        location: law.location || 'exact Swiss-law section',
        finding: law.passage_text || law.passage_summary || law.role || law.title,
        relation,
        effect: isCausationBranch ? 'Keeps open' : 'Shapes',
      };
    }
    const evidence = relevantEvidence(evidenceForNode(node.node_id));
    if (evidence) {
      const relation = isCausationBranch
        ? `Missing-fact basis · this requirement can test, not establish, ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`
        : evidence.why || `Determines the next decision · ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`;
      return {
        action: 'inspect-evidence',
        attributes: `data-evidence-id="${esc(evidence.item_id)}"`,
        sourceLabel: 'evidence need',
        title: evidence.title,
        location: 'required by this decision',
        finding: evidence.title,
        relation,
        effect: ['missing', 'provided_insufficient'].includes(evidence.status) ? 'Keeps open' : 'Supports',
      };
    }
    const incoming = asArray(state.process?.edges).find(edge => edge.target === node.node_id && nodeById(edge.source));
    const prior = incoming ? nodeById(incoming.source) : null;
    const relation = isCausationBranch
      ? `Missing-fact basis · ${SPATIAL_NODE_LABELS[node.node_id] || node.title} remains hypothetical`
      : prior
        ? `Follows the accepted answer to · ${nodeQuestion(prior)}`
        : 'Starts from the accepted claim record';
    return {
      action: 'select-node',
      attributes: `data-inspection-id="${esc(node.node_id)}" data-prior-node-id="${esc(prior?.node_id || '')}"`,
      sourceLabel: 'accepted process record',
      title: prior ? nodeQuestion(prior) : (SPATIAL_NODE_LABELS[node.node_id] || node.title),
      location: 'prior accepted decision',
      finding: node.why || node.question || node.title,
      relation,
      effect: prior ? 'Follows' : 'Starts',
    };
  }

  function nodeInspectionMarkup(node) {
    const basis = nodeInspectionBasis(node);
    const common = `data-ac-inspection-target="true" data-inspection-phase="${esc(state.graphInspectionPhase)}" data-node-id="${esc(node.node_id)}" data-ac-action="${esc(basis.action)}" ${basis.attributes}`;
    if (state.graphInspectionPhase === 'select-source') {
      return `<button type="button" class="ac-build-inspection ac-build-source-select" ${common}><small>Source for the next decision</small><strong>${esc(basis.title)}</strong><span>Click to open · ${esc(basis.location)}</span></button>`;
    }
    const highlighted = state.graphInspectionPhase === 'highlight-source';
    const exactSource = basis.ref ? sourceReadingMarkup(basis.fact, basis.ref, !highlighted, highlighted) : '';
    const interactionAttributes = highlighted ? '' : common;
    const fallbackFinding = highlighted
      ? `<strong><mark class="is-highlighted">${esc(basis.finding)}</mark></strong>`
      : `<strong><mark class="is-awaiting-click" data-ac-inspection-read-target="true">${esc(basis.finding)}</mark></strong>`;
    const extractedLabel = basis.fact?.label || (basis.sourceLabel === 'official Swiss law' ? 'Legal question' : 'Decision basis');
    const extractedValue = basis.fact?.value || basis.relation || basis.finding;
    const fullSourceAction = highlighted && basis.ref
      ? `<button type="button" class="ac-build-open-source" data-ac-action="open-source" data-node-id="${esc(node.node_id)}" ${sourceContextAttributes(basis.fact, basis.ref)}>Open original →</button>`
      : highlighted && basis.law
        ? `<button type="button" class="ac-build-open-source" data-ac-action="open-law" data-node-id="${esc(node.node_id)}" data-law-id="${esc(basis.law.source_id)}" data-source-authority="${isOfficialLaw(basis.law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(basis.law))}">Open law →</button>`
        : '';
    return `<div class="ac-build-inspection ac-build-source-reading${highlighted ? ' ac-build-source-highlight' : ''}" ${interactionAttributes}>
      <header><small>${highlighted ? 'Selected from' : 'Opened from'} · ${esc(basis.sourceLabel)}</small><strong>${esc(basis.title)}</strong><span>${esc(basis.location)}</span></header>
      ${exactSource || fallbackFinding}
      ${highlighted ? `<div class="ac-build-finding"><small>Extracted for this decision</small><strong>${esc(extractedLabel)}</strong><span>${esc(extractedValue)}</span></div>` : ''}
      <span>${highlighted ? `${esc(basis.effect || 'Supports')} · ${esc(nodeLabel(node.node_id))}` : 'Select the exact passage, field, region, or prior decision before this step appears.'}</span>
      ${fullSourceAction}
      ${highlighted ? '<i class="ac-source-to-decision" aria-hidden="true"></i>' : ''}
    </div>`;
  }

  function reconcileGraph() {
    const processRegion = state.root?.querySelector('[data-ac-process]');
    const track = state.root?.querySelector('[data-ac-process-track]');
    const buildTarget = state.root?.querySelector('[data-ac-build-target]');
    const edgeLayer = state.root?.querySelector('[data-ac-spatial-edges]');
    const satellites = state.root?.querySelector('[data-ac-spatial-satellites]');
    const detail = state.root?.querySelector('[data-ac-spatial-detail]');
    const status = state.root?.querySelector('[data-ac-process-status]');
    if (!processRegion || !track || !buildTarget || !edgeLayer || !satellites || !detail || !status) return;
    const graphVisible = state.processAccepted && (state.graphRevealRunning || GRAPH_MOMENTS.has(state.moment));
    processRegion.hidden = !graphVisible;
    state.root.dataset.graphVisible = String(graphVisible);
    const focalRegion = state.root.querySelector('[data-ac-focal]');
    if (graphVisible) {
      processRegion.dataset.artifactFocus = 'true';
      processRegion.dataset.casepathPrimaryArtifact = 'true';
      processRegion.dataset.casepathFocal = 'true';
      focalRegion?.removeAttribute('data-artifact-focus');
      focalRegion?.removeAttribute('data-casepath-primary-artifact');
      focalRegion?.removeAttribute('data-casepath-focal');
    } else {
      processRegion.removeAttribute('data-artifact-focus');
      processRegion.removeAttribute('data-casepath-primary-artifact');
      processRegion.removeAttribute('data-casepath-focal');
      if (focalRegion) {
        focalRegion.dataset.artifactFocus = 'true';
        focalRegion.dataset.casepathPrimaryArtifact = 'true';
        focalRegion.dataset.casepathFocal = 'true';
      }
    }
    processRegion.dataset.reviewEditState = state.moment === 'review-applied'
      ? 'applied'
      : state.moment === 'review' ? 'pending' : 'not-active';
    const acceptedProjectionComplete = SIMPLIFIED_SPINE_IDS.every(nodeId => state.visibleNodeIds.has(nodeId));
    processRegion.dataset.processConstructionState = !state.processAccepted
      ? 'pending'
      : state.graphRevealRunning
        ? 'building'
        : acceptedProjectionComplete ? 'complete' : 'pending';
    processRegion.dataset.processNodeProgressState = state.processNodeProgress ? 'active' : 'idle';
    if (state.processNodeProgress) {
      processRegion.dataset.processNodeProgress = String(state.processNodeProgress.percent);
      processRegion.dataset.processNodeProgressPhase = state.processNodeProgress.phase;
      processRegion.dataset.processNodeProgressNodeId = state.processNodeProgress.nodeId;
    } else {
      delete processRegion.dataset.processNodeProgress;
      delete processRegion.dataset.processNodeProgressPhase;
      delete processRegion.dataset.processNodeProgressNodeId;
    }
    if (!state.processAccepted) return;
    if (!state.graphRevealRunning && ['evidence', 'experience'].includes(state.moment) && nodeById('causation')) {
      state.selectedNodeId = 'causation';
    }
    if (state.moment === 'review-applied' && nodeById('ventilation_dispute')) {
      state.visibleNodeIds.add('ventilation_dispute');
    }
    processRegion.dataset.processGraphId = state.process?.process_id || '';
    processRegion.dataset.processId = state.process?.process_id || '';

    const nodes = simplifiedNodes();
    const expected = new Set(nodes.map(node => node.node_id));
    track.querySelectorAll('[data-ac-node-id]').forEach(item => {
      if (!expected.has(item.dataset.acNodeId)) item.remove();
    });
    nodes.forEach((node, index) => {
      let item = track.querySelector(`[data-ac-node-id="${CSS.escape(node.node_id)}"]`);
      if (!item) {
        item = document.createElement('li');
        item.dataset.acNodeId = node.node_id;
        item.innerHTML = `<button type="button" data-ac-action="select-node"><span data-ac-node-marker></span><small data-ac-node-title></small></button>`;
        track.append(item);
      }
      const previousBuildState = item.dataset.processBuildState || '';
      item.dataset.nodeId = node.node_id;
      item.style.setProperty('--ac-node-index', index);
      const [spatialX, spatialY] = spatialPosition(node.node_id);
      item.style.setProperty('--spatial-x', spatialX);
      item.style.setProperty('--spatial-y', spatialY);
      item.dataset.spatialRole = node.node_id === 'causation' ? 'hub' : 'spine';
      item.dataset.spatialPath = SIMPLIFIED_SPINE_IDS.indexOf(node.node_id) > SIMPLIFIED_SPINE_IDS.indexOf('causation')
        ? 'future'
        : 'accepted';
      item.dataset.nodeState = nodeState(node);
      item.dataset.reviewChange = node.node_id === 'ventilation_dispute' && state.result?.review_transform ? 'added' : '';
      const laterDelta = state.moment === 'later-result' ? laterMemoryDelta() : null;
      const memoryAdded = Boolean(laterDelta?.receiptBound && laterDelta.originId && laterDelta.nodeId === node.node_id);
      if (memoryAdded) {
        item.dataset.memoryEffect = 'node-added';
        item.dataset.memoryOriginId = laterDelta.originId;
      } else {
        delete item.dataset.memoryEffect;
        delete item.dataset.memoryOriginId;
      }
      if (state.moment === 'later-work' && node.node_id === 'ventilation_dispute') item.dataset.memoryCandidate = 'true';
      else delete item.dataset.memoryCandidate;
      item.dataset.revealState = state.visibleNodeIds.has(node.node_id) ? 'visible' : 'pending';
      item.dataset.processBuildState = state.visibleNodeIds.has(node.node_id)
        ? state.graphRevealRunning && state.graphDwell && index === state.graphRevealIndex - 1 ? 'building' : 'built'
        : 'pending';
      item.dataset.selected = String(node.node_id === state.selectedNodeId);
      item.querySelector('[data-ac-node-marker]').textContent = String(index + 1);
      item.querySelector('[data-ac-node-title]').textContent = SPATIAL_NODE_LABELS[node.node_id] || node.title || DEFAULT_NODE_COPY[node.node_id]?.[0] || node.node_id;
      item.querySelector('button').setAttribute('aria-label', `${nodeLabel(node.node_id)}: ${nodeQuestion(node)}`);
      item.querySelector('button').disabled = !state.visibleNodeIds.has(node.node_id);
      item.querySelector('button').tabIndex = state.visibleNodeIds.has(node.node_id) ? 0 : -1;
      item.querySelector('button').dataset.nodeId = node.node_id;
      if (node.node_id === state.selectedNodeId) item.querySelector('button').setAttribute('aria-current', 'step');
      else item.querySelector('button').removeAttribute('aria-current');
      const lineage = lineageFor('process_node', node.node_id);
      item.dataset.artifactEventId = lineage?.eventId || '';
      item.dataset.artifactAgentId = lineage?.agentId || '';
      item.dataset.artifactChangeId = visibleChangeId('process_node', node.node_id, lineage);
      track.append(item);
      if (item.dataset.processBuildState === 'building' && previousBuildState !== 'building') {
        emitArtifactChange('process_node', node.node_id);
      }
    });
    if (!state.graphRevealRunning && state.visibleNodeIds.size >= nodes.length) {
      track.querySelectorAll('[data-ac-node-id]').forEach(item => { item.dataset.processBuildState = 'built'; });
    }

    const count = state.root.querySelector('[data-ac-process-count]');
    const focus = state.root.querySelector('[data-ac-process-focus]');
    const pendingNode = nodes.find(node => node.node_id === state.pendingGraphNodeId);
    buildTarget.hidden = !pendingNode || (state.graphInspecting && state.graphInspectionPhase !== 'read-source');
    buildTarget.dataset.nodeId = pendingNode?.node_id || '';
    const [buildX, buildY] = spatialPosition(pendingNode?.node_id);
    buildTarget.style.setProperty('--spatial-x', buildX);
    buildTarget.style.setProperty('--spatial-y', buildY);
    buildTarget.textContent = pendingNode ? `Next · ${nodeLabel(pendingNode.node_id)}` : '';
    if (state.graphRevealRunning) {
      const pendingBranch = CAUSATION_BRANCH_LAYOUT.find(([nodeId]) => nodeId === state.pendingBranchNodeId);
      if (pendingBranch) {
        const branchNumber = Math.min(state.visibleBranchIds.size + 1, CAUSATION_BRANCH_LAYOUT.length);
        count.textContent = `Testing causation branch ${branchNumber} of ${CAUSATION_BRANCH_LAYOUT.length}`;
        focus.textContent = pendingBranch[1];
        status.textContent = state.processNodeProgress
          ? `${state.processNodeProgress.label} · ${state.processNodeProgress.percent}% · ${focus.textContent}`
          : `Causation branch ${branchNumber} of ${CAUSATION_BRANCH_LAYOUT.length}: ${focus.textContent}`;
      } else {
        const decisionNumber = Math.min(state.graphRevealIndex + (state.graphDwell ? 0 : 1), nodes.length);
        count.textContent = `Building decision ${decisionNumber} of ${nodes.length}`;
        focus.textContent = nodeLabel(state.selectedNodeId) || 'Grounded decision';
        status.textContent = state.processNodeProgress
          ? `${state.processNodeProgress.label} · ${state.processNodeProgress.percent}% · ${focus.textContent}`
          : `Decision ${decisionNumber} of ${nodes.length}: ${focus.textContent}`;
      }
    } else {
      count.textContent = `${nodes.length} decisions · core handling spine`;
      focus.textContent = nodeLabel(state.selectedNodeId) || 'Select one decision';
      if (state.moment === 'review') {
        count.textContent = 'Expert correction';
        focus.textContent = 'Causation · responsibility remains blocked';
      } else if (state.moment === 'review-applied') {
        const truth = reviewAppliedTruth();
        count.textContent = truth.verified ? 'Correction applied to this case' : 'Correction result incomplete';
        focus.textContent = truth.verified
          ? 'Ventilation check added · broader testing remains conditional'
          : 'No process correction is claimed';
      } else if (state.moment === 'verify') {
        count.textContent = 'Final audit · complete graph';
        focus.textContent = 'Causation stays open · unsupported conclusions fail closed';
      } else if (state.moment === 'knowledge') {
        count.textContent = 'One correction saved for governed reuse';
        focus.textContent = 'Check ventilation allegations separately · unverified case memory';
      } else if (state.moment === 'later-work') {
        count.textContent = 'Separate future claim · checking the saved correction';
        focus.textContent = state.laterCausalStep?.phase === 'source'
          ? 'New claim source · ventilation allegation'
          : state.laterCausalStep?.phase === 'memory'
            ? 'Unverified case memory retrieved'
            : state.laterCausalStep?.phase === 'eligibility'
              ? 'Match confirmed · adding one conditional check'
            : 'New claim · checking whether the saved lesson applies';
      } else if (state.moment === 'later-result') {
        count.textContent = validatedLaterMemory() ? 'A later claim uses the correction' : 'Memory application not proven';
        focus.textContent = validatedLaterMemory()
          ? 'One conditional ventilation check · qualified review still required'
          : 'No memory-driven change claimed';
      }
      status.textContent = `${nodes.length} accepted decisions. Current decision: ${focus.textContent}.`;
    }
    edgeLayer.innerHTML = spatialEdgesMarkup(nodes);
    satellites.innerHTML = spatialSatellitesMarkup();
    const detailNodeId = state.graphInspecting
      ? state.pendingGraphNodeId || state.pendingBranchNodeId || state.selectedNodeId
      : state.selectedNodeId;
    detail.innerHTML = spatialDetailMarkup(nodeById(detailNodeId));
    emitGraphContextualArtifact(detail, satellites);
  }

  function stageFocalMarkup() {
    const copy = momentCopy();
    if (['opening', 'read'].includes(state.moment)) return sourcePreludeMarkup();
    if (state.moment === 'understand' && !state.factTourRunning && !state.factTourComplete) return sourcePreludeMarkup({ readyToInspect: true });
    if (state.moment === 'understand' && (state.factTourRunning || state.factTourComplete)) return factSourceStageMarkup(copy);
    if (state.moment === 'research') return lawStageMarkup(copy);
    if (state.moment === 'evidence') return evidenceStageMarkup(copy);
    if (state.moment === 'experience') return referenceStageMarkup(copy);
    if (['knowledge', 'later-work', 'later-result'].includes(state.moment)) return learningMarkup(copy);
    if (['review', 'review-applied'].includes(state.moment)) return reviewMarkup(copy);
    const event = state.currentEvent || {};
    const headline = String(valueFrom(event, 'headline', 'question', 'label') || copy.title);
    const detail = String(valueFrom(event, 'detail') || copy.detail);
    const output = eventOutputArtifacts(event)[0];
    const verificationAttachment = state.moment === 'verify'
      ? `data-node-attachment-kind="verification" ${lineageAttributes('verification', 'whole_playbook_verification')}`
      : '';
    return `<article class="ac-stage-focus" data-ac-focal-object="stage" ${verificationAttachment} data-ac-cursor-target="true">
      <span>${esc(copy.authority)}</span>
      <h3>${esc(headline)}</h3>
      <p>${esc(detail)}</p>
      ${output ? `<strong data-ac-output-artifact="${esc(output)}">Produced · ${esc(output.replaceAll('_', ' '))}</strong>` : ''}
    </article>`;
  }

  function sourcePreludeMarkup({ readyToInspect = false } = {}) {
    const artifacts = asArray(state.claim?.artifacts);
    const sources = [
      { title: 'Customer message', kind: 'Message' },
      ...artifacts.map(artifact => ({
        title: artifact.title || artifact.filename || artifact.artifact_id || 'Source file',
        kind: String(artifact.media_type || '').startsWith('image/')
          ? 'Image'
          : String(artifact.media_type || '').includes('message') ? 'Message' : 'Document',
      })),
    ];
    return `<article class="ac-source-prelude" data-ac-focal-object="source-prelude" data-source-count="${esc(sources.length)}" data-ac-cursor-target="true">
      <header><span>${readyToInspect ? 'Source package ready' : 'Opening source package'}</span><strong>${esc(sources.length)} originals · no conclusions yet</strong></header>
      <div class="ac-source-prelude-strip" aria-label="Claim sources being prepared">${sources.map((source, index) => `<span style="--source-order:${index}" data-source-kind="${esc(source.kind.toLowerCase())}"><i aria-hidden="true"></i><small>${esc(source.kind)}</small><strong>${esc(source.title)}</strong></span>`).join('')}</div>
      <footer><i aria-hidden="true"></i><span>${readyToInspect ? 'Starting with the exact passage that supports the first fact.' : 'Preserving each file before inspection.'}</span></footer>
    </article>`;
  }

  function sourceTrailKind(ref) {
    if (['message', 'intake'].includes(String(ref?.artifact_id || ''))) return ['message', 'Customer message'];
    const artifact = asArray(state.claim?.artifacts)
      .find(item => String(item?.artifact_id || '') === String(ref?.artifact_id || ''));
    const title = String(artifact?.title || sourceDisplayTitle(ref?.artifact_id) || '').toLowerCase();
    const mediaType = String(artifact?.media_type || '').toLowerCase();
    if (mediaType.startsWith('image/')) return ['photo', 'Photo'];
    if (/timeline|chronology/.test(title)) return ['timeline', 'Timeline'];
    if (/delivery|receipt/.test(title)) return ['receipt', 'Delivery proof'];
    if (/management|landlord|reply/.test(title)) return ['letter', 'Landlord letter'];
    if (mediaType.includes('message')) return ['message', 'Message'];
    return ['pdf', 'PDF'];
  }

  function factSourceTrailMarkup(items, currentIndex, phase) {
    const opened = [];
    items.slice(0, Math.max(0, currentIndex) + 1).forEach((item, index) => {
      const sourceId = String(item.ref?.artifact_id || '');
      const existing = opened.find(entry => entry.sourceId === sourceId);
      const current = index === currentIndex;
      if (existing) {
        if (current) existing.current = true;
        return;
      }
      const [kind, kindLabel] = sourceTrailKind(item.ref);
      opened.push({
        sourceId,
        title: sourceDisplayTitle(sourceId),
        kind,
        kindLabel,
        image: kind === 'photo' ? visualSourceImage(item.ref) : '',
        current,
      });
    });
    return `<ol class="ac-source-inspection-trail" aria-label="Sources opened so far">${opened.map((source, index) => {
      const stateLabel = source.current ? (phase === 'select-source' ? 'opening' : 'active') : 'inspected';
      const icon = source.image
        ? `<i data-source-kind="photo" aria-hidden="true"><img src="${esc(source.image)}" alt=""></i>`
        : `<i data-source-kind="${esc(source.kind)}" aria-hidden="true"></i>`;
      return `<li style="--trail-order:${index}" data-source-id="${esc(source.sourceId)}" data-source-kind="${esc(source.kind)}" data-source-trail-state="${stateLabel}">${icon}<span><small>${esc(source.kindLabel)}</small><strong>${esc(source.title)}</strong></span></li>`;
    }).join('')}</ol>`;
  }

  function factSourceStageMarkup(copy) {
    const items = factStoryItems();
    const item = items.find(candidate => candidate.fact.fact_id === state.pendingFactId)
      || items[Math.min(state.factTourIndex, Math.max(0, items.length - 1))];
    if (!item) return `<article class="ac-stage-focus" data-ac-focal-object="fact-inspection"><span>${esc(copy.authority)}</span><h3>${esc(copy.title)}</h3><p>Opening the first exact source.</p></article>`;
    const { fact, ref } = item;
    const finding = sourceFinding(ref);
    const sourceTitle = sourceDisplayTitle(ref.artifact_id);
    const step = state.factTourIndex + 1;
    const sourceHeader = `<header><span>Source ${step} of ${FACT_STORY_IDS.length}</span><strong>${esc(sourceTitle)}</strong><small>${esc(sourceLocation(ref))}</small></header>`;
    const sourceReading = sourceReadingMarkup(fact, ref, state.factTourReadArmed, false);
    const sourceHighlight = sourceReadingMarkup(fact, ref, false, true);
    const sourceFindingMarkup = sourceReadingMarkup(fact, ref, false, true);
    const sourceTrail = factSourceTrailMarkup(items, state.factTourIndex, state.factTourPhase);
    const unverifiedVisual = `<p class="ac-visual-source-unverified">Image-region provenance could not be verified. No visual observation is claimed.</p>`;
    const sourceMarkup = `<section class="ac-fact-source" data-source-authority="${esc(ref.authority || 'customer_submission')}">
      ${sourceHeader}
      ${sourceFindingMarkup || unverifiedVisual}
    </section>`;
    if (state.factTourPhase === 'select-source' && state.factTourRunning) {
      return `<article class="ac-stage-focus ac-fact-source-focus" data-ac-focal-object="fact-inspection" data-fact-tour-phase="select-source" data-fact-id="${esc(fact.fact_id)}">
        <span>${esc(copy.authority)} · source not yet opened</span>
        <h3>Open the source.</h3>
        ${sourceTrail}
        <button type="button" class="ac-fact-source-picker" data-ac-action="open-source" data-ac-inspection-target="true" data-fact-inspection-target="true" data-inspection-phase="select-source" data-ac-cursor-target="true" ${sourceContextAttributes(fact, ref)}>
          <small>Source ${step} of ${FACT_STORY_IDS.length}</small><strong>${esc(sourceTitle)}</strong><span>Open ${esc(sourceLocation(ref))}</span>
        </button>
      </article>`;
    }
    if (state.factTourPhase === 'read-source' && state.factTourRunning) {
      return `<article class="ac-stage-focus ac-fact-source-focus" data-ac-focal-object="fact-inspection" data-fact-tour-phase="read-source" data-fact-id="${esc(fact.fact_id)}">
        <span>${esc(copy.authority)} · Source opened</span>
        <h3>Select the exact part.</h3>
        ${sourceTrail}
        <section class="ac-fact-source" data-source-authority="${esc(ref.authority || 'customer_submission')}">
          ${sourceHeader}
          ${sourceReading || unverifiedVisual}
          <div class="ac-extraction-pending"><span>Nothing selected yet</span><strong>The fact will appear only after this source is selected.</strong></div>
        </section>
      </article>`;
    }
    if (state.factTourPhase === 'highlight-source' && state.factTourRunning) {
      return `<article class="ac-stage-focus ac-fact-source-focus" data-ac-focal-object="fact-inspection" data-fact-tour-phase="highlight-source" data-fact-id="${esc(fact.fact_id)}">
        <span>${esc(copy.authority)} · Source selected</span>
        <h3>One fact comes from this selection.</h3>
        ${sourceTrail}
        <section class="ac-fact-source is-source-selected" data-source-authority="${esc(ref.authority || 'customer_submission')}">
          ${sourceHeader}
          ${sourceHighlight || unverifiedVisual}
          <div class="ac-extraction-pending is-extracting"><span>Selected from this source</span><strong>${esc(fact.label || 'Preparing the source-bound fact')}</strong></div>
        </section>
      </article>`;
    }
    return `<article class="ac-stage-focus ac-fact-source-focus" data-ac-focal-object="fact-inspection" data-fact-tour-phase="finding" data-fact-id="${esc(fact.fact_id)}">
      <span>${esc(copy.authority)} · Verified from this source</span>
      ${sourceTrail}
      <div class="ac-fact-resolution">
        ${sourceMarkup}
        <span class="ac-fact-causal-link" aria-hidden="true">Extracted</span>
        <section class="ac-fact-finding" data-node-attachment-kind="fact" ${lineageAttributes('fact', fact.fact_id)} ${sourceContextAttributes(fact, ref)} data-fact-id="${esc(fact.fact_id)}">
          <small>Fact added from this source</small>
          <h3>${esc(fact.label || 'Returned fact')}</h3>
          <strong>${esc(fact.value || 'Value not returned')}</strong>
        </section>
      </div>
    </article>`;
  }

  function evidenceStageMarkup(copy) {
    const item = asArray(state.checklist?.items).find(candidate => candidate.item_id === 'technical_assessment')
      || priorityEvidence(asArray(state.checklist?.items))[0];
    if (!item) return `<article class="ac-stage-focus" data-ac-focal-object="evidence" data-ac-cursor-target="true"><span>${esc(copy.authority)}</span><h3>${esc(copy.title)}</h3><p>${esc(copy.detail)}</p></article>`;
    return `<article class="ac-stage-focus ac-evidence-focus" data-ac-focal-object="evidence" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', item.item_id)} data-evidence-id="${esc(item.item_id)}" data-evidence-status="${esc(item.status || '')}" data-fact-id="${esc(item.fact_id || '')}" data-ac-cursor-target="true">
      <span>${esc(copy.authority)} · ${esc(statusLabel(item.status))}</span>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.why || copy.detail)}</p>
      <strong>Required because · ${esc(evidenceOwnerIds(item).map(nodeId => SPATIAL_NODE_LABELS[nodeId] || nodeById(nodeId)?.title || nodeId).join(' · '))}</strong>
    </article>`;
  }

  function referenceStageMarkup(copy) {
    const precedent = state.precedents.find(item => Number(item.ranking?.rank) === 1)
      || state.precedents[0];
    if (!precedent) return `<article class="ac-stage-focus" data-ac-focal-object="reference" data-ac-cursor-target="true"><span>${esc(copy.authority)}</span><h3>${esc(copy.title)}</h3><p>${esc(copy.detail)}</p></article>`;
    const ranking = precedent.ranking || {};
    return `<article class="ac-stage-focus ac-reference-focus" data-ac-focal-object="reference" data-node-attachment-kind="precedent" ${lineageAttributes('precedent', precedent.claim_id)} data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-ranking-contract="${esc(ranking.contract || '')}" data-ranking-rank="${esc(ranking.rank ?? '')}" data-ranking-score-basis-points="${esc(ranking.score_basis_points ?? '')}" data-ranking-context-hash="${esc(ranking.context_hash || '')}" data-ac-cursor-target="true">
      <span>${esc(copy.authority)} · ${esc(provenanceLabel(precedent))}</span>
      <h3>${esc(precedent.title)}</h3>
      <p>${esc(precedent.why_useful || copy.detail)}</p>
      <button type="button" data-ac-action="open-reference" data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-casepath-primary-action="true">Inspect this generated pattern</button>
    </article>`;
  }

  function agentArtifactMarkup() {
    const event = state.currentEvent || {};
    const agentId = eventAgentId(event);
    const agent = AGENTS[agentId];
    if (!agent) return '';
    const returnedOutput = eventOutputArtifacts(event)[0] || '';
    const artifactLabel = AGENT_ARTIFACT_LABELS[agentId] || returnedOutput.replaceAll('_', ' ') || 'Bounded specialist contribution';
    const finalLineage = agentId === 'final_claim_brief_audit'
      ? `data-node-attachment-kind="verification" ${lineageAttributes('verification', 'whole_playbook_verification')}`
      : '';
    return `<article class="ac-stage-focus ac-agent-artifact" data-ac-focal-object="agent-artifact" data-agent-id="${esc(agentId)}" data-call-id="${esc(valueFrom(event, 'call_id', 'callId'))}" data-output-artifact="${esc(returnedOutput)}" ${finalLineage} data-ac-cursor-target="true">
      <span>Specialist ${agent.order} of 6 · ${esc(agent.label)}</span>
      <h3>${esc(agent.task)}</h3>
      <p>${esc(agent.why)}</p>
      <strong>Produced · ${esc(artifactLabel)}</strong>
    </article>`;
  }

  function lawStageMarkup(copy) {
    const sources = asArray(state.legal?.sources).filter(isOfficialLaw);
    const law = sources.find(item => item.source_id === state.focusLawId)
      || (!state.officialLawTourRunning && !state.pendingLawId ? sources[0] : null);
    const cursorLawId = state.pendingLawId || law?.source_id || '';
    const lawTabs = sources.map(source => {
      const article = String(source.location || '').match(/Art(?:icle)?\.?\s*\d+[a-z]?/i)?.[0]?.replace(/^Article/i, 'Art.');
      const label = article || (/conciliation|schlichtung/i.test(`${source.title || ''} ${source.location || ''}`) ? 'Conciliation' : source.title || source.location);
      return `<button type="button" data-ac-action="select-law" data-law-id="${esc(source.source_id)}" data-source-authority="official_registry" data-source-locator-id="${esc(lawLocatorId(source))}" aria-current="${String(source.source_id === law?.source_id)}" ${source.source_id === cursorLawId ? 'data-ac-cursor-target="true"' : ''} aria-label="${esc(source.location || source.title)}">${esc(label)}</button>`;
    }).join('');
    if (!law) {
      const pending = sources.find(item => item.source_id === state.pendingLawId) || sources[0];
      let pendingHost = 'official source';
      try { pendingHost = new URL(String(pending?.url || '')).host || pendingHost; } catch (_) {}
      return `<article class="ac-stage-focus ac-law-focus ac-law-pending" data-ac-focal-object="law">
        <div class="ac-browser-bar"><i aria-hidden="true"></i><span><strong>${esc(pendingHost)}</strong><code>${esc(pending?.url || 'Official URL not returned')}</code></span><small>Not opened yet</small></div>
        <nav class="ac-law-tabs" aria-label="Exact official Swiss-law sections">${lawTabs}</nav>
        <span>Official Swiss-law registry · qualified review pending</span>
        <h3>Select the exact section before its passage appears.</h3>
        <div class="ac-law-pending-surface"><i aria-hidden="true"></i><strong>No passage selected</strong><small>The source text is revealed by the cursor click.</small></div>
      </article>`;
    }
    const retrieval = law.retrieval || {};
    let officialHost = 'official source';
    try { officialHost = new URL(String(law.url || '')).host || officialHost; } catch (_) {}
    return `<article class="ac-stage-focus ac-law-focus" data-ac-focal-object="law" data-ac-law-id="${esc(law.source_id)}" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-source-authority="official_registry" data-source-locator-id="${esc(lawLocatorId(law))}">
      <div class="ac-browser-bar"><i aria-hidden="true"></i><span><strong>${esc(officialHost)}</strong><code>${esc(law.url || 'Official URL not returned')}</code></span><small>Cached exact passage</small></div>
      <nav class="ac-law-tabs" aria-label="Exact official Swiss-law sections">${lawTabs}</nav>
      <span>Cached exact official source · qualified review pending</span>
      <h3>${esc(law.title)}</h3>
      <blockquote lang="${esc(law.passage_language || '')}">${esc(law.passage_text || 'Official passage not returned.')}</blockquote>
      <p>${esc(law.passage_summary || '')}</p>
      <footer><small>${esc(law.location || '')} · ${esc(law.version_date || 'version not returned')} · ${esc(retrieval.registry_version || state.legal?.registry_version || '')}</small>${isOfficialLaw(law) && law.url ? `<a class="ac-official-link" href="${esc(law.url)}" target="_blank" rel="noopener" data-casepath-primary-action="true">Verify on official website ↗</a>` : ''}</footer>
    </article>`;
  }

  function reviewMarkup(copy) {
    const delta = state.review?.candidate?.delta || state.review?.delta || state.result?.review_delta || state.result?.computed_delta || {};
    const changedNodes = unique([
      ...asArray(delta.nodes_added),
      ...asArray(delta.nodes_changed),
      ...asArray(delta.process_nodes_added),
      ...asArray(delta.process_nodes_changed),
      ...(nodeById('ventilation_dispute') && state.result?.review_transform ? ['ventilation_dispute'] : []),
    ]);
    const applied = state.moment === 'review-applied';
    const reviewHeadline = applied
      ? 'One new decision now protects the causal sequence.'
      : 'Use one neutral assessment first.';
    return `<article class="ac-stage-focus ac-review-focus" data-ac-focal-object="review" data-review-state="${applied ? 'applied' : 'pending'}" data-review-edit-state="${applied ? 'applied' : 'pending'}" data-review-node-id="causation" data-ac-cursor-target="true">
      <span>${esc(copy.authority)}</span>
      <h3>${esc(reviewHeadline)}</h3>
      <p>${esc(copy.detail)}</p>
      ${applied
        ? `<strong>${changedNodes.length ? `${changedNodes.length} returned process decision${changedNodes.length === 1 ? '' : 's'} changed` : 'Returned graph and evidence relationships recomputed'}</strong>`
        : `<div class="ac-review-decision"><small>Process consequence</small><strong>Keep broader building testing conditional.</strong><p>Causation remains unresolved until competent evidence supports the next branch.</p></div><button type="button" data-ac-action="submit-review" data-review-mode="conditional" data-casepath-primary-action="true">Apply demo correction</button>`}
    </article>`;
  }

  function graphBuildFocalMarkup(node) {
    const facts = factsForNode(node);
    const laws = lawsForNode(node).filter(isOfficialLaw);
    const evidence = evidenceForNode(node.node_id);
    const basis = [
      facts.length ? `${facts.length} claim fact${facts.length === 1 ? '' : 's'}` : '',
      laws.length ? `${laws.length} official source${laws.length === 1 ? '' : 's'}` : '',
      evidence.length ? `${evidence.length} evidence requirement${evidence.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(' · ');
    return `<article class="ac-stage-focus ac-build-focus" data-ac-focal-object="process-decision">
      <span>Grounded process decision</span>
      <h3>${esc(node.question || node.title)}</h3>
      <p>${esc(node.why || node.answer || 'This decision is retained only because it belongs to the accepted handling path.')}</p>
      ${basis ? `<strong>${esc(basis)}</strong>` : ''}
    </article>`;
  }

  function learningMarkup(copy) {
    const later = state.laterResult || {};
    const result = state.result || {};
    const memory = later.memory_application || result.memory_application || {};
    const knowledge = state.review?.knowledge || result.knowledge || state.knowledge || {};
    const candidate = state.review?.candidate || knowledge.candidate || knowledge.reusable_rule_candidate || result.reusable_rule_candidate || {};
    const memoryId = valueFrom(memory, 'memory_id') || valueFrom(state.review, 'memory_id') || valueFrom(result, 'memory_id') || valueFrom(knowledge, 'memory_id');
    const laterValidation = state.moment === 'later-result' ? validatedLaterMemory() : null;
    const memoryOriginId = String(laterValidation?.originId || (state.moment === 'later-result' ? '' : valueFrom(memory?.source_memory, 'memory_id') || valueFrom(memory, 'memory_id') || memoryId || valueFrom(memory, 'application_hash')) || '');
    const receipt = state.moment === 'later-result'
      ? Boolean(laterValidation)
      : memory.contract === 'casepath.memory-application-receipt/1.0.0';
    const sharedChanged = later.shared_rule_applied === true || result.shared_rule_applied === true;
    const headline = state.moment === 'later-result'
      ? receipt ? 'Case-specific memory changed the next step.' : copy.title
      : memoryId ? 'Case memory saved for governed reuse.' : copy.title;
    const detail = state.moment === 'later-result'
      ? receipt ? 'The later claim now asks for one neutral assessment before broader building tests.' : copy.detail
      : memoryId ? 'It remains unverified and does not change the shared playbook.' : copy.detail;
    const memoryEffects = state.moment === 'later-result' && receipt && memoryOriginId && !state.processAccepted ? `
      <ol class="ac-memory-effects" aria-label="Receipt-bound case-specific changes">
        <li data-memory-effect="node-added" data-memory-origin-id="${esc(memoryOriginId)}">One decision node added</li>
        <li data-memory-effect="edge-added" data-memory-origin-id="${esc(memoryOriginId)}">Connection into the learned decision</li>
        <li data-memory-effect="edge-added" data-memory-origin-id="${esc(memoryOriginId)}">Connection back to the supported process</li>
        <li data-memory-effect="evidence-changed" data-memory-origin-id="${esc(memoryOriginId)}">Neutral assessment sequence changed</li>
        <li data-memory-effect="evidence-changed" data-memory-origin-id="${esc(memoryOriginId)}">Ventilation evidence ownership changed</li>
        <li data-memory-effect="evidence-changed" data-memory-origin-id="${esc(memoryOriginId)}">Building-envelope timing changed</li>
      </ol>` : '';
    return `<article class="ac-stage-focus ac-learning-focus" data-ac-focal-object="knowledge" data-memory-id="${esc(memoryId)}" data-memory-origin-id="${esc(memoryOriginId)}" data-memory-status="${esc(memoryId ? 'unverified_demo_memory' : 'not-returned')}" data-memory-receipt="${esc(String(receipt))}" data-shared-rule-applied="${esc(String(sharedChanged))}" data-ac-cursor-target="true">
      <span>${esc(copy.authority)}</span>
      <h3>${esc(headline)}</h3>
      <p>${esc(detail)}</p>
      <div class="ac-learning-outcome"><strong>${memoryId ? `Memory ${esc(memoryId)}` : 'No memory identifier returned'}</strong><small>Shared playbook ${sharedChanged ? 'changed by an explicit released result' : 'unchanged'}${candidate.status ? ` · candidate ${esc(candidate.status)}` : ''}</small></div>
      ${memoryEffects}
    </article>`;
  }

  function nodeFocalMarkup(node) {
    const facts = factsForNode(node);
    const laws = lawsForNode(node);
    const evidence = evidenceForNode(node.node_id);
    const references = precedentsForNode(node.node_id);
    const kinds = ensureValidChain(node);
    const stateLabel = nodeState(node);
    const selectedBranch = node.branches?.find(branch => branch.state === 'selected');
    return `<article class="ac-decision-focus" data-ac-focal-object="decision" data-node-id="${esc(node.node_id)}" data-node-state="${esc(stateLabel)}">
      <header data-ac-cursor-target="true">
        <span>${stateLabel === 'current' ? 'Current decision' : stateLabel === 'complete' ? 'Established decision' : stateLabel === 'blocked' ? 'Blocked until earlier evidence' : 'Handling decision'}</span>
        <h3>${esc(node.question || node.title)}</h3>
        <p>${esc(node.why || node.answer || '')}</p>
        ${selectedBranch ? `<strong class="ac-selected-branch" data-branch-id="${esc(selectedBranch.branch_id)}" data-target-node-id="${esc(selectedBranch.target)}">Next · ${esc(selectedBranch.label)}</strong>` : ''}
      </header>
      ${kinds.length ? `<nav class="ac-chain-tabs" aria-label="Evidence chain for ${esc(node.title || node.node_id)}">${kinds.map(kind => `<button type="button" data-ac-action="select-chain" data-chain-kind="${kind}" aria-current="${String(kind === state.activeChainKind)}">${({ source: 'Claim source', law: 'Swiss law', evidence: 'Evidence', reference: 'Reference' })[kind]}</button>`).join('')}</nav>` : ''}
      <section class="ac-chain-detail" data-chain-kind="${esc(state.activeChainKind)}">${chainDetailMarkup(state.activeChainKind, node, { facts, laws, evidence, references })}</section>
    </article>`;
  }

  function chainDetailMarkup(kind, node, values) {
    if (kind === 'law') return lawChainMarkup(node, values.laws);
    if (kind === 'evidence') return evidenceChainMarkup(node, values.evidence);
    if (kind === 'reference') return referenceChainMarkup(node, values.references);
    return sourceChainMarkup(node, values.facts);
  }

  function sourceChainMarkup(node, facts) {
    const fact = relevantFact(facts);
    const refs = asArray(fact?.source_refs);
    const ref = representativeFactRef(fact);
    if (!fact || !ref) return '<p class="ac-empty-chain">No exact source reference was returned for this decision.</p>';
    const locator = ref.locator_kind === 'visual_observation'
      ? `Image region ${asArray(ref.region).map(value => Number(value).toFixed(2)).join(', ')}`
      : ref.locator_kind === 'metadata_field'
        ? `${ref.field || 'Metadata field'}: ${ref.value ?? 'value not returned'}`
        : `Page ${ref.page || 'not returned'} · “${ref.excerpt || 'passage not returned'}”`;
    return `<div class="ac-chain-object ac-source-object" data-node-attachment-kind="fact" ${lineageAttributes('fact', fact.fact_id)} ${sourceContextAttributes(fact, ref)}>
      <div><span>What is established</span><strong>${esc(fact.label)} · ${esc(fact.value)}</strong><p>${esc(fact.explanation || '')}</p></div>
      <aside><small>${esc(locator)}</small>${ref.observation ? `<p>${esc(ref.observation)}</p>` : ''}<button type="button" data-ac-action="open-source" data-node-id="${esc(node.node_id)}" ${sourceContextAttributes(fact, ref)} data-casepath-primary-action="true">Open exact source</button></aside>
      ${refs.length > 1 ? `<em>${refs.length - 1} corroborating source${refs.length === 2 ? '' : 's'} kept in this fact</em>` : ''}
    </div>`;
  }

  function lawChainMarkup(node, laws) {
    const law = relevantLaw(laws);
    if (!law) return '<p class="ac-empty-chain">No legal source was returned for this decision.</p>';
    const official = isOfficialLaw(law);
    const sourceAuthority = official ? 'official_registry' : 'deterministic_principle';
    const locatorId = lawLocatorId(law);
    return `<div class="ac-chain-object ac-law-object" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-law-id="${esc(law.source_id)}" data-law-authority="${official ? 'official-source-registry' : 'deterministic-application-proposal'}" data-source-authority="${sourceAuthority}" data-source-locator-id="${esc(locatorId)}">
      <div><span>${official ? 'Official registry source · qualified review pending' : 'Deterministic handling proposal · not expert approved'}</span><strong>${esc(law.title)}</strong><p>${esc(law.passage_summary || law.role || '')}</p></div>
      <aside>${official ? `<blockquote lang="${esc(law.passage_language || '')}">${esc(law.passage_text || 'Official passage not returned.')}</blockquote><small>${esc(law.location || '')} · ${esc(law.version_date || '')}</small>` : `<p>${esc(law.role || '')}</p><small>${esc(law.validation_status || 'status not returned')}</small>`}<button type="button" data-ac-action="open-law" data-node-id="${esc(node.node_id)}" data-law-id="${esc(law.source_id)}" data-source-authority="${sourceAuthority}" data-source-locator-id="${esc(locatorId)}" data-casepath-primary-action="true">${official ? 'Inspect official source' : 'Inspect handling proposal'}</button></aside>
      ${official && laws.some(item => !isOfficialLaw(item)) ? '<em>Operational interpretation remains separate from the official passage.</em>' : ''}
    </div>`;
  }

  function evidenceChainMarkup(node, items) {
    const item = relevantEvidence(items);
    if (!item) return '<p class="ac-empty-chain">No evidence requirement was returned for this decision.</p>';
    const alternatives = asArray(item.acceptable_alternatives);
    return `<div class="ac-chain-object ac-evidence-object" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', item.item_id)} data-evidence-id="${esc(item.item_id)}" data-evidence-status="${esc(item.status || '')}" data-fact-id="${esc(item.fact_id || '')}">
      <div><span>${esc(statusLabel(item.status))} · owned by ${esc(node.title || node.node_id)}</span><strong>${esc(item.title)}</strong><p>${esc(item.why || '')}</p></div>
      <aside><small>${item.status === 'conditional' ? `Only if: ${esc(item.applies_when || 'the linked branch is reached')}` : item.status === 'missing' ? 'Needed to advance this decision' : `Current status: ${esc(statusLabel(item.status))}`}</small>${alternatives.length ? `<p>Acceptable: ${esc(alternatives.slice(0, 2).join(' · '))}</p>` : ''}<button type="button" data-ac-action="inspect-evidence" data-node-id="${esc(node.node_id)}" data-evidence-id="${esc(item.item_id)}">Inspect requirement</button></aside>
      ${items.length > 1 ? `<em>${items.length - 1} other requirement${items.length === 2 ? '' : 's'} remain attached to this decision.</em>` : ''}
    </div>`;
  }

  function referenceChainMarkup(node, references) {
    const precedent = relevantPrecedent(references);
    if (!precedent) return '<p class="ac-empty-chain">No node-local reference pattern was returned.</p>';
    const ranking = precedent.ranking || {};
    return `<div class="ac-chain-object ac-reference-object" data-node-attachment-kind="precedent" ${lineageAttributes('precedent', precedent.claim_id)} data-precedent-id="${esc(precedent.claim_id)}" data-review-status="${esc(precedent.review_status || '')}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-ranking-contract="${esc(ranking.contract || '')}" data-ranking-rank="${esc(ranking.rank ?? '')}" data-ranking-score-basis-points="${esc(ranking.score_basis_points ?? '')}" data-ranking-context-hash="${esc(ranking.context_hash || '')}">
      <div><span>${esc(provenanceLabel(precedent))}</span><strong>${esc(precedent.title)}</strong><p>${esc(precedent.why_useful || '')}</p></div>
      <aside><p>${esc((precedent.shared_features || []).slice(0, 3).join(' · '))}</p><button type="button" data-ac-action="open-reference" data-node-id="${esc(node.node_id)}" data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-casepath-primary-action="true">Open reference pattern</button></aside>
      ${references.length > 1 ? `<em>${references.length - 1} more ranked pattern${references.length === 2 ? '' : 's'} available.</em>` : ''}
    </div>`;
  }

  function renderFocal() {
    const focal = state.root?.querySelector('[data-ac-focal]');
    if (!focal) return;
    const specialMoment = ['verify', 'review', 'review-applied', 'knowledge', 'later-work', 'later-result', 'failure'].includes(state.moment);
    const semanticArtifactMoment = ['evidence', 'experience'].includes(state.moment);
    const factTourMoment = state.moment === 'understand' && (state.factTourRunning || state.factTourComplete);
    const node = nodeById(state.selectedNodeId);
    const modelArtifact = eventActorType(state.currentEvent) === 'nemotron_agent' && AGENTS[eventAgentId(state.currentEvent)];
    const markup = factTourMoment
      ? stageFocalMarkup()
      : state.graphRevealRunning && node
      ? graphBuildFocalMarkup(node)
      : semanticArtifactMoment
        ? stageFocalMarkup()
      : modelArtifact
        ? agentArtifactMarkup()
      : state.processAccepted && GRAPH_MOMENTS.has(state.moment) && node && !specialMoment && !state.graphRevealRunning
        ? nodeFocalMarkup(node)
        : stageFocalMarkup();
    if (focal.innerHTML === markup) return;
    focal.innerHTML = markup;
    focal.dataset.focalKind = focal.firstElementChild?.dataset.acFocalObject || 'stage';
    const attachment = focal.querySelector('[data-node-attachment-kind]');
    const ownedAgentId = focal.querySelector('[data-agent-id]')?.dataset.agentId || '';
    const kind = attachment?.dataset.nodeAttachmentKind || (ownedAgentId ? 'agent_output' : 'focal');
    const attachmentEntityId = kind === 'fact'
      ? attachment?.dataset.factId
      : kind === 'law'
        ? attachment?.dataset.lawId
        : kind === 'evidence'
          ? attachment?.dataset.evidenceId
          : kind === 'precedent'
            ? attachment?.dataset.precedentId
            : kind === 'verification'
              ? 'whole_playbook_verification'
              : '';
    const entityId = attachmentEntityId
      || attachment?.dataset.nodeId
      || attachment?.dataset.acLawId
      || focal.firstElementChild?.dataset.memoryId
      || ownedAgentId
      || focal.dataset.focalKind;
    const tourBoundLaw = kind !== 'law'
      || state.moment !== 'research'
      || state.officialLawTourVisitedIds.has(String(entityId || ''));
    const sourceBeforeFact = Boolean(focal.querySelector('[data-fact-tour-phase="select-source"], [data-fact-tour-phase="read-source"]'));
    if (!sourceBeforeFact && tourBoundLaw && focal.dataset.artifactFocus === 'true' && !state.graphRevealRunning && !state.pendingLawId) {
      emitArtifactChange(kind, entityId);
    }
  }

  function emitArtifactChange(kind, entityId) {
    if (!state.root) return;
    const lineage = lineageFor(kind, entityId);
    const eventId = lineage?.eventId || '';
    const agentId = lineage?.agentId || '';
    const changeId = visibleChangeId(kind, entityId, lineage);
    const mutationKey = changeId;
    if (state.artifactChangeKeys.has(mutationKey)) return;
    state.artifactChangeKeys.add(mutationKey);
    state.artifactChangeSerial += 1;
    state.lastCursorChangeId = changeId;
    state.lastCursorEventId = eventId;
    state.lastCursorAgentId = agentId;
    window.dispatchEvent(new CustomEvent('casepath:artifact-change', { detail: {
      changeId,
      eventId,
      agentId,
      kind,
      entityId: String(entityId || ''),
    } }));
  }

  function renderProofLine() {
    const proof = state.root?.querySelector('[data-ac-proof]');
    if (!proof) return;
    if (['opening', 'read'].includes(state.moment)) {
      proof.textContent = 'Original claim package · no conclusion yet';
      return;
    }
    if (state.moment === 'understand') {
      proof.textContent = 'One exact source at a time · no conclusion yet';
      return;
    }
    if (state.moment === 'research') {
      proof.textContent = 'Checking exact Swiss-law sections · process path not shown yet';
      return;
    }
    if (state.processAccepted) {
      if (state.moment === 'review-applied') {
        proof.textContent = reviewAppliedTruth().verified
          ? 'Unverified correction · ventilation check added · responsibility still blocked'
          : 'Correction not verified · existing process retained';
        return;
      }
      if (state.moment === 'knowledge') {
        proof.textContent = 'Unverified case memory saved · shared playbook unchanged';
        return;
      }
      if (state.moment === 'later-work') {
        proof.textContent = 'New claim source → saved lesson → confirmed graph change';
        return;
      }
      if (state.moment === 'later-result') {
        proof.textContent = validatedLaterMemory()
          ? 'Saved lesson used here · responsibility still blocked'
          : 'No saved-memory change was proven';
        return;
      }
      const current = state.process?.current_overlay?.current_node_id || state.process?.current_node || 'not returned';
      const next = state.process?.current_overlay?.next_action_node_id || 'not returned';
      proof.textContent = ['causation', 'evidence_gap'].includes(current)
        ? 'Cause not proven → independent check needed → responsibility waits'
        : `Verified path · ${nodeLabel(current)} open · ${nodeLabel(next)} next`;
    } else {
      proof.textContent = 'Only validated outputs are shown.';
    }
  }

  function render() {
    mount();
    if (!state.root) return;
    const submission = document.querySelector('.submission-pane');
    if (submission) {
      submission.dataset.sourceDockState = submission.dataset.activeSourceLocator
        ? 'active'
        : submission.classList.contains('collapsed') ? 'closed' : 'open';
    }
    renderHeader();
    renderAgentAudit();
    reconcileGraph();
    renderFocal();
    syncGraphCursorTarget();
    renderProofLine();
    const journeyNext = document.querySelector('#journeyNext');
    if (journeyNext) {
      if (['ready', 'review-applied', 'knowledge', 'later-result'].includes(state.moment)) journeyNext.dataset.casepathPrimaryAction = 'true';
      else journeyNext.removeAttribute('data-casepath-primary-action');
    }
    scheduleCursor();
  }

  function syncGraphCursorTarget() {
    if (!state.graphRevealRunning) return;
    state.root.querySelectorAll('[data-ac-cursor-target="true"]').forEach(item => item.removeAttribute('data-ac-cursor-target'));
    if (state.graphDwell) return;
    if (state.graphInspecting) {
      if (state.graphInspectionPhase === 'highlight-source') return;
      const inspection = state.root.querySelector('[data-ac-inspection-target="true"]');
      const readingTarget = state.graphInspectionPhase === 'read-source'
        ? inspection?.querySelector('[data-ac-inspection-read-target="true"]')
        : null;
      (readingTarget || inspection)?.setAttribute('data-ac-cursor-target', 'true');
      return;
    }
    const buildTarget = state.root?.querySelector('[data-ac-build-target]:not([hidden])');
    buildTarget?.setAttribute('data-ac-cursor-target', 'true');
  }

  function interactionDetail(action, button) {
    const selectedNode = nodeById(button.dataset.nodeId || state.selectedNodeId);
    let region = null;
    try { region = button.dataset.sourceRegion ? JSON.parse(button.dataset.sourceRegion) : null; } catch (_) {}
    return {
      contract: CONTRACT,
      action,
      origin: ROOT_ID,
      moment: state.moment,
      nodeId: button.dataset.nodeId || state.selectedNodeId || '',
      nodeState: selectedNode ? nodeState(selectedNode) : '',
      chainKind: button.dataset.chainKind || state.activeChainKind || '',
      factId: button.dataset.factId || '',
      sourceId: button.dataset.sourceId || '',
      locatorKind: button.dataset.locatorKind || '',
      page: button.dataset.sourcePage ? Number(button.dataset.sourcePage) : null,
      excerpt: button.dataset.sourceExcerpt || '',
      region,
      observation: button.dataset.sourceObservation || '',
      field: button.dataset.sourceField || '',
      value: button.dataset.sourceValue || '',
      sourceAgent: button.dataset.sourceAgent || '',
      sourceProducer: button.dataset.sourceProducer || '',
      sourceAuthority: button.dataset.sourceAuthority || '',
      annotationContract: button.dataset.annotationContract || '',
      annotationVersion: button.dataset.annotationVersion || '',
      imageSha256: button.dataset.imageSha256 || '',
      factConfidence: button.dataset.factConfidence || '',
      factState: button.dataset.factState || '',
      lawId: button.dataset.lawId || '',
      evidenceId: button.dataset.evidenceId || '',
      precedentId: button.dataset.precedentId || '',
      activeAgentId: visibleActorId(),
      authority: state.root?.dataset.workAuthority || '',
    };
  }

  function emitInteraction(action, button) {
    const detail = interactionDetail(action, button);
    state.root.dispatchEvent(new CustomEvent(INTERACTION_EVENT, { bubbles: true, detail }));
    if (action === 'open-source') {
      markSubmissionSource(detail.sourceId || '');
      setActiveSourceLocator(button.dataset.sourceLocatorId || '');
      // During automatic construction the exact excerpt is already the focal
      // artifact. Keep the graph visible; reserve the full source viewer for
      // an explicit user request from the completed decision disclosure.
      if (button.dataset.acInspectionTarget !== 'true') {
        document.dispatchEvent(new CustomEvent('casepath:open-source', { detail: {
          artifactId: detail.sourceId,
          page: detail.page || 1,
          context: {
            factId: detail.factId,
            nodeId: detail.nodeId,
            locator_kind: detail.locatorKind,
            page: detail.page || 1,
            excerpt: detail.excerpt,
            region: detail.region,
            observation: detail.observation,
            field: detail.field,
            value: detail.value,
            agent: detail.sourceAgent,
            producer: detail.sourceProducer,
            authority: detail.sourceAuthority,
            annotation_contract: detail.annotationContract,
            annotation_version: detail.annotationVersion,
            image_sha256: detail.imageSha256,
            confidence: detail.factConfidence,
            state: detail.factState,
          },
        } }));
      }
    } else if (action === 'open-reference') {
      const locatorId = button.dataset.sourceLocatorId || '';
      if (!detail.precedentId || locatorId !== `reference:${detail.precedentId}`) return;
      setActiveSourceLocator(locatorId);
      const index = state.precedents.findIndex(item => item.claim_id === detail.precedentId);
      if (index >= 0) document.dispatchEvent(new CustomEvent('casepath:open-precedent', { detail: { index } }));
    } else if (action === 'request-review') {
      document.dispatchEvent(new CustomEvent('casepath:begin-review'));
    } else if (action === 'submit-review') {
      document.dispatchEvent(new CustomEvent('casepath:submit-review', { detail: {
        buildingEnvelopeMode: button.dataset.reviewMode || 'conditional',
        justification: 'Keep causation unresolved. Use one neutral inspection first, then test the ventilation allegation or building envelope only when the first assessment supports that branch.',
      } }));
    } else if (action === 'continue-journey') {
      document.dispatchEvent(new CustomEvent('casepath:continue-journey'));
    } else if (action === 'open-law') {
      setActiveSourceLocator(button.dataset.sourceLocatorId || '');
      // Automatic graph construction already presents the exact passage as the
      // sole focal artifact. Reserve the modal for an explicit post-build click.
      if (button.dataset.acInspectionTarget !== 'true') {
        openLawDetail(button.dataset.lawId || '', button.dataset.sourceLocatorId || '');
      }
    }
  }

  function openLawDetail(lawId, locatorId) {
    const dialog = state.root?.querySelector('[data-ac-law-viewer]');
    const detail = dialog?.querySelector('[data-ac-law-detail]');
    const law = [...asArray(state.legal?.sources), ...asArray(state.legal?.handling_principles)]
      .find(item => item.source_id === lawId);
    if (!dialog || !detail || !law) return;
    const official = isOfficialLaw(law);
    dialog.dataset.lawId = law.source_id;
    dialog.dataset.sourceAuthority = official ? 'official_registry' : 'deterministic_principle';
    dialog.dataset.sourceLocatorId = locatorId || lawLocatorId(law);
    dialog.querySelector('[data-ac-law-authority]').textContent = official
      ? 'Cached official Swiss-law passage · qualified review pending'
      : 'Deterministic handling principle · not expert approved';
    detail.innerHTML = `<h3 id="artifactLawViewerTitle">${esc(law.title || law.source_id)}</h3>
      <p>${esc(law.location || '')}${law.version_date ? ` · ${esc(law.version_date)}` : ''}</p>
      <blockquote lang="${esc(law.passage_language || '')}">${esc(law.passage_text || law.passage_summary || law.role || 'No passage returned.')}</blockquote>
      ${official && law.url ? `<a href="${esc(law.url)}" target="_blank" rel="noopener noreferrer">Verify on the official source</a>` : '<small>Operational interpretation remains separate from official source text.</small>'}`;
    if (!dialog.open) dialog.showModal();
  }

  function setActiveSourceLocator(locatorId) {
    const dockState = locatorId ? 'active' : 'open';
    state.root.dataset.activeSourceLocator = locatorId;
    state.root.dataset.sourceDockState = dockState;
    const submission = document.querySelector('.submission-pane');
    if (submission) {
      submission.dataset.activeSourceLocator = locatorId;
      submission.dataset.sourceDockState = dockState;
    }
  }

  function handleClick(event) {
    const button = event.target.closest?.('[data-ac-action]');
    if (!button || !state.root?.contains(button)) return;
    const action = button.dataset.acAction;
    if (action === 'toggle-grounding') {
      event.preventDefault();
      const disclosure = button.closest('.ac-grounding-disclosure');
      const panel = disclosure?.querySelector(':scope > div');
      const viewer = state.root.querySelector('[data-ac-grounding-viewer]');
      const detail = viewer?.querySelector('[data-ac-grounding-viewer-detail]');
      if (panel && viewer && detail) {
        detail.innerHTML = panel.innerHTML;
        button.setAttribute('aria-expanded', 'true');
        if (!viewer.open) viewer.showModal();
      }
      return;
    }
    if (action === 'close-grounding') {
      state.root.querySelector('[data-ac-grounding-viewer]')?.close();
      state.root.querySelectorAll('[data-ac-action="toggle-grounding"]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
      return;
    }
    if (action === 'close-law') {
      state.root.querySelector('[data-ac-law-viewer]')?.close();
      return;
    }
    if (action === 'close-agent-audit') {
      closeAgentAudit();
      return;
    }
    if (action === 'open-agent-audit') {
      openAgentAudit(button.dataset.agentId || '');
      return;
    }
    if (action === 'open-documents') {
      event.preventDefault();
      const nodeId = button.dataset.nodeId || state.selectedNodeId || '';
      const existingAction = document.querySelector('[data-v20-open-documents]');
      if (existingAction) existingAction.click();
      else {
        const sheet = document.querySelector('#v20DocumentSheet');
        if (sheet && !sheet.open) sheet.showModal();
      }
      window.requestAnimationFrame(() => {
        if (!nodeId) return;
        document.querySelector(`#v20DocumentSheet [data-v20-document-node="${CSS.escape(nodeId)}"]`)?.click();
      });
      return;
    }
    if (action === 'select-node') {
      state.selectedNodeId = button.dataset.nodeId;
      state.activeChainKind = 'source';
      state.groundingOpen = false;
      state.manualNodeInspection = true;
      const selectedNode = nodeById(state.selectedNodeId);
      const selectedFact = relevantFact(directFactsForNode(selectedNode));
      const selectedRef = representativeFactRef(selectedFact);
      if (selectedRef) {
        markSubmissionSource(selectedRef.artifact_id || '');
        setActiveSourceLocator(sourceLocatorId(selectedRef));
      } else {
        clearActiveSource();
      }
      emitInteraction(action, button);
      render();
      return;
    }
    if (action === 'select-chain') {
      state.activeChainKind = button.dataset.chainKind;
      emitInteraction(action, button);
      render();
      return;
    }
    if (action === 'select-law') {
      state.focusLawId = button.dataset.lawId || '';
      setActiveSourceLocator(button.dataset.sourceLocatorId || '');
      emitInteraction(action, button);
      render();
      return;
    }
    if (button.closest('[data-ac-grounding-viewer]')) {
      state.root.querySelector('[data-ac-grounding-viewer]')?.close();
      state.root.querySelectorAll('[data-ac-action="toggle-grounding"]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    }
    emitInteraction(action, button);
    markCursorTarget(button);
  }

  function handleKeydown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const button = event.target.closest?.('[data-ac-action="select-chain"]');
    if (!button) return;
    const buttons = [...state.root.querySelectorAll('[data-ac-action="select-chain"]')];
    const index = buttons.indexOf(button);
    const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    event.preventDefault();
    next?.focus();
    next?.click();
  }

  function markCursorTarget(target) {
    state.root?.querySelectorAll('[data-ac-cursor-target="true"]').forEach(item => item.removeAttribute('data-ac-cursor-target'));
    target?.setAttribute('data-ac-cursor-target', 'true');
    scheduleCursor();
  }

  function scheduleCursor() {
    window.clearTimeout(state.cursorTimer);
    state.cursorTimer = window.setTimeout(positionCursor, 80);
  }

  function specialistForCursorTarget(target) {
    if (state.graphRevealRunning) {
      return { agentId: 'process_decision_mapping', agent: AGENTS.process_decision_mapping };
    }
    const candidates = [
      ['process_node', target?.dataset.nodeId],
      ['evidence_requirement', target?.dataset.evidenceId],
      ['fact', target?.dataset.factId],
      ['verification', target?.dataset.verificationId],
      ['agent_output', target?.dataset.agentId],
    ];
    let lineage = null;
    for (const [kind, entityId] of candidates) {
      if (!entityId) continue;
      lineage = lineageFor(kind, entityId);
      if (lineage) break;
    }
    if (!lineage && state.lastCursorAgentId) {
      const agentLineage = state.agentLineage.get(state.lastCursorAgentId);
      if (agentLineage?.eventId && agentLineage.eventId === state.lastCursorEventId) lineage = agentLineage;
    }
    const acceptedAgentLineage = lineage?.agentId ? state.agentLineage.get(lineage.agentId) : null;
    let agentId = AGENTS[lineage?.agentId]
      && (Boolean(lineage.eventId)
        || (acceptedAgentLineage?.actorType === 'nemotron_agent'
          && acceptedAgentLineage.agentId === lineage.agentId))
      ? lineage.agentId
      : '';
    if (!agentId && state.graphRevealRunning
      && state.agentLineage.get('process_decision_mapping')?.actorType === 'nemotron_agent') {
      agentId = 'process_decision_mapping';
    }
    return agentId ? { agentId, agent: AGENTS[agentId] } : null;
  }

  function cursorActionLabel(target, specialist) {
    const action = target?.dataset.acAction || '';
    const phase = target?.dataset.inspectionPhase || '';
    if (phase === 'select-source') return 'Opening source';
    if (phase === 'read-source' || action === 'confirm-source') return 'Selecting exact evidence';
    if (phase === 'highlight-source') return 'Adding what was found';
    if (action === 'open-law' || action === 'select-law') return 'Reading Swiss law';
    if (action === 'inspect-evidence' || action === 'open-documents') return 'Finding the document need';
    if (action === 'open-reference') return 'Checking a past pattern';
    if (action === 'select-node') return 'Checking this step';
    return specialist?.agent.task || 'Working on this artifact';
  }

  function sourceRailTarget(sourceId) {
    const id = String(sourceId || '');
    if (!id) return null;
    if (['message', 'intake'].includes(id)) return document.querySelector('.v21-source-summary-toggle');
    return [...document.querySelectorAll('.attachment-row[data-artifact-id]')]
      .find(row => row.dataset.artifactId === id) || null;
  }

  function positionCursor() {
    const root = state.root;
    const cursor = root?.querySelector('[data-ac-cursor]');
    const focus = root?.querySelector('[data-artifact-focus="true"]');
    const parked = ['review-applied', 'knowledge', 'later-result'].includes(state.moment);
    const target = parked
      ? focus?.querySelector('[data-ac-cursor-park]')
      : focus?.querySelector('[data-ac-cursor-target="true"]')
      || (!state.graphRevealRunning && !state.graphDwell ? focus?.querySelector('[data-selected="true"] button') : null);
    if (!root || !cursor || !target) return;
    const visualTarget = target.dataset.inspectionPhase === 'select-source'
      ? sourceRailTarget(target.dataset.sourceId)
      : null;
    const targetBox = (visualTarget || target).getBoundingClientRect();
    if (!targetBox.width) return;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const x = Math.round(Math.max(18, Math.min(viewportWidth - 56, targetBox.right - 22)) / 2) * 2;
    const y = Math.round(Math.max(18, Math.min(viewportHeight - 52, targetBox.top + Math.min(targetBox.height * .55, 54))) / 2) * 2;
    const identityTarget = target.closest?.('[data-ac-inspection-target="true"]') || target;
    const targetId = identityTarget.dataset.lawId
      || identityTarget.dataset.sourceId
      || identityTarget.dataset.evidenceId
      || identityTarget.dataset.inspectionId
      || identityTarget.dataset.factId
      || identityTarget.dataset.nodeId
      || identityTarget.dataset.precedentId
      || identityTarget.dataset.acFocalObject
      || identityTarget.dataset.acAction
      || target.tagName.toLowerCase();
    const laterSourcePhase = state.laterCausalStep?.phase === 'source'
      ? `${String(state.laterCausalStep.opened)}:${String(state.laterCausalStep.highlighted)}`
      : '';
    const key = `${state.lastCursorChangeId}:${state.activeAgentId}:${state.neutralAuthority}:${state.moment}:${state.factTourPhase}:${state.graphInspectionPhase}:${laterSourcePhase}:${targetId}:${Math.round(x)}:${Math.round(y)}`;
    if (state.lastCursorKey === key) return;
    state.lastCursorKey = key;
    window.clearTimeout(state.cursorArrivalTimer);
    window.clearTimeout(state.cursorSettleTimer);
    window.clearTimeout(state.cursorClickTimer);
    document.querySelectorAll('.is-agent-clicked').forEach(item => item.classList.remove('is-agent-clicked'));
    cursor.classList.remove('is-clicking');
    cursor.style.setProperty('--ac-cursor-x', `${x}px`);
    cursor.style.setProperty('--ac-cursor-y', `${y}px`);
    cursor.dataset.changeId = state.lastCursorChangeId;
    cursor.dataset.eventId = state.lastCursorEventId;
    cursor.dataset.agentId = state.lastCursorAgentId;
    cursor.dataset.targetId = targetId;
    cursor.dataset.cursorPhase = 'moving';
    cursor.dataset.parked = String(parked);
    const specialist = specialistForCursorTarget(identityTarget);
    const cursorAgent = cursor.querySelector('[data-ac-cursor-agent]');
    const cursorAction = cursor.querySelector('[data-ac-cursor-action]');
    cursor.dataset.specialistBound = String(Boolean(specialist));
    cursor.dataset.labelSide = x > viewportWidth * .56 ? 'left' : 'right';
    if (specialist) {
      cursor.dataset.agentSignature = specialist.agent.signature;
      setCursorAvatar(cursor, specialist.agent);
      if (cursorAgent) cursorAgent.textContent = specialist.agent.short;
    }
    if (cursorAction) cursorAction.textContent = cursorActionLabel(identityTarget, specialist);
    const cursorDetail = () => ({
      changeId: state.lastCursorChangeId,
      eventId: state.lastCursorEventId,
      agentId: state.lastCursorAgentId,
      targetId,
      moment: state.moment,
      action: identityTarget.dataset.acAction || target.dataset.acAction || '',
      inspectionPhase: identityTarget.dataset.inspectionPhase || target.dataset.inspectionPhase || '',
    });
    window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: { ...cursorDetail(), phase: 'move' } }));
    state.cursorArrivalTimer = window.setTimeout(() => {
      if (!cursor.isConnected || !target.isConnected) {
        state.lastCursorKey = '';
        scheduleCursor();
        return;
      }
      cursor.dataset.cursorPhase = 'settled';
      window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: { ...cursorDetail(), phase: 'arrived' } }));
      if (parked) return;
      state.cursorSettleTimer = window.setTimeout(() => {
        if (!cursor.isConnected || !target.isConnected) {
          state.lastCursorKey = '';
          scheduleCursor();
          return;
        }
        cursor.dataset.cursorPhase = 'clicking';
        cursor.classList.add('is-clicking');
        target.classList.add('is-agent-clicked');
        visualTarget?.classList.add('is-agent-clicked');
        window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: { ...cursorDetail(), phase: 'click' } }));
        const commit = state.cursorCommit;
        state.cursorCommit = null;
        commit?.();
        state.cursorClickTimer = window.setTimeout(() => {
          cursor.classList.remove('is-clicking');
          target.classList.remove('is-agent-clicked');
          visualTarget?.classList.remove('is-agent-clicked');
          if (cursor.dataset.cursorPhase === 'clicking') cursor.dataset.cursorPhase = 'settled';
        }, 260);
      }, REDUCED_MOTION ? 0 : CURSOR_SETTLE_MS);
    }, REDUCED_MOTION ? 0 : CURSOR_TRAVEL_MS);
  }

  function mount() {
    if (state.root?.isConnected) return state.root;
    const live = document.querySelector('#liveWorkspace');
    if (!live) return null;
    let root = document.querySelector(`#${ROOT_ID}`);
    if (!root) {
      root = document.createElement('section');
      root.id = ROOT_ID;
      root.className = 'casepath-artifact-canvas';
      root.dataset.contract = CONTRACT;
      root.dataset.layout = 'source-canvas';
      root.dataset.casepathScene = state.moment;
      root.dataset.persistence = 'workspace-lifetime';
      root.dataset.sourcePane = 'persistent-visible';
      root.dataset.sourceDockState = 'open';
      root.dataset.activeSourceLocator = '';
      root.setAttribute('aria-label', 'CasePath persistent claim-handling workspace');
      const canvas = live.querySelector('#stageCanvas');
      live.insertBefore(root, canvas || live.querySelector('#journeyActions'));
    }
    state.root = root;
    live.classList.add('has-artifact-canvas');
    const submission = document.querySelector('.submission-pane');
    if (submission) {
      submission.dataset.sourceDockState = 'open';
      if (!submission.hasAttribute('data-active-source-locator')) submission.dataset.activeSourceLocator = '';
    }
    document.body.dataset.casepathArtifactCanvas = 'ready';
    renderShell();
    window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: {
      contract: CONTRACT,
      rootId: ROOT_ID,
      interactionEvent: INTERACTION_EVENT,
      agentIds: Object.keys(AGENTS),
      simplifiedSpineIds: [...SIMPLIFIED_SPINE_IDS],
    } }));
    return root;
  }

  function snapshot() {
    return {
      contract: CONTRACT,
      moment: state.moment,
      activeAgentId: state.activeAgentId,
      neutralAuthority: state.neutralAuthority,
      processAccepted: state.processAccepted,
      selectedNodeId: state.selectedNodeId,
      activeChainKind: state.activeChainKind,
      visibleNodeIds: [...state.visibleNodeIds],
      factSourceTourState: state.factTourComplete ? 'complete' : state.factTourRunning ? 'running' : state.factTourEligible ? 'waiting' : 'idle',
      factSourceTourIndex: state.factTourIndex,
      hasResult: Boolean(state.result),
      hasLaterResult: Boolean(state.laterResult),
    };
  }

  function onRender(event) {
    ingest({ moment: event.detail?.moment || document.querySelector('#stageCanvas')?.dataset.casepathMoment || document.body.dataset.casepathMoment }, 'render');
  }

  function onAgentFocus(event) {
    const detail = event.detail || {};
    const moment = AGENT_MOMENTS[detail.agentId] || state.moment;
    ingest({ ...detail, event: {
      stage: 'agent_orchestration',
      moment,
      actor_type: 'nemotron_agent',
      agent_id: detail.agentId,
      call_id: detail.callId,
      event_id: detail.eventId,
      output_artifact: detail.outputArtifact,
      status: 'completed',
    }, moment }, 'agent-focus');
  }

  window.addEventListener('casepath:semantic-event', event => ingest(event.detail || {}, 'semantic'));
  window.addEventListener('casepath:run-event', event => ingest(event.detail || {}, 'run'));
  window.addEventListener('casepath:run-snapshot', event => ingest(event.detail || {}, 'snapshot'));
  window.addEventListener('casepath:later-memory-validation', event => {
    const detail = asObject(event.detail);
    const delta = asObject(detail?.delta) || {};
    state.laterMemoryValidation = detail?.contract === LATER_MEMORY_VALIDATION_CONTRACT ? {
      contract: detail.contract,
      runId: String(detail.runId || ''),
      validated: detail.validated === true,
      proofReady: detail.proofReady === true,
      memoryUsed: detail.memoryUsed === true,
      memoryRetrieved: detail.memoryRetrieved === true,
      retrievedOnly: detail.retrievedOnly === true,
      applicationHash: String(detail.applicationHash || ''),
      memoryOriginId: String(detail.memoryOriginId || ''),
      sharedPlaybookUnchanged: detail.sharedPlaybookUnchanged === true,
      delta: {
        nodeIds: unique(asArray(delta.nodeIds).map(value => String(value || '')).filter(Boolean)),
        edges: asArray(delta.edges).map(edge => ({ source: String(edge?.source || ''), target: String(edge?.target || '') })).filter(edge => edge.source && edge.target),
        evidenceIds: unique(asArray(delta.evidenceIds).map(value => String(value || '')).filter(Boolean)),
      },
    } : null;
    markSubmissionSource('');
  });
  window.addEventListener('casepath:later-causal-step', event => {
    const step = acceptedLaterCausalStep(asObject(event.detail));
    if (!step) return;
    state.laterCausalStep = step;
    state.moment = 'later-work';
    state.neutralAuthority = 'case-memory-comparison';
    state.selectedNodeId = step.phase === 'source' || step.phase === 'memory' || step.phase === 'eligibility'
      ? 'causation'
      : state.selectedNodeId;
    state.lastCursorChangeId = step.phase === 'source'
      ? `later-source:${step.fact.fact_id}:${sourceLocatorId(step.ref)}`
      : step.phase === 'eligibility'
        ? `later-memory-eligibility:${step.ruleId}`
        : `later-memory-retrieval:${step.memoryOriginId}`;
    state.lastCursorEventId = step.runId;
    state.lastCursorAgentId = '';
    clearActiveSource();
    const highlightLaterSource = () => {
      if (state.laterCausalStep !== step || !step.opened || step.highlighted) return;
      const target = state.root?.querySelector('[data-later-causal-phase="source"] [data-ac-inspection-target="true"]');
      if (!target) return;
      emitInteraction('confirm-source', target);
      step.highlighted = true;
      state.cursorCommit = null;
      render();
      window.dispatchEvent(new CustomEvent('casepath:source-highlighted', { detail: {
        entityKind: 'later-fact', factId: step.fact.fact_id,
        changeId: state.lastCursorChangeId, eventId: step.runId, agentId: '',
        sourceId: step.ref.artifact_id, locatorId: sourceLocatorId(step.ref),
      } }));
      window.dispatchEvent(new CustomEvent('casepath:later-source-opened', { detail: {
        contract: LATER_CAUSAL_STEP_CONTRACT,
        runId: step.runId,
        factId: step.fact.fact_id,
        sourceId: step.ref.artifact_id,
        locatorId: sourceLocatorId(step.ref),
      } }));
    };
    state.cursorCommit = step.phase === 'source' ? () => {
      if (state.laterCausalStep !== step) return;
      const target = state.root?.querySelector('[data-later-causal-phase="source"] [data-ac-inspection-target="true"]');
      if (!target) return;
      markSubmissionSource(step.ref.artifact_id);
      setActiveSourceLocator(sourceLocatorId(step.ref));
      emitInteraction('open-source', target);
      step.opened = true;
      step.highlighted = false;
      state.cursorCommit = highlightLaterSource;
      render();
    } : null;
    render();
    window.dispatchEvent(new CustomEvent('casepath:later-causal-step-visible', { detail: {
      contract: LATER_CAUSAL_STEP_CONTRACT,
      phase: step.phase,
      runId: step.runId,
      memoryOriginId: step.memoryOriginId || '',
      ruleId: step.ruleId || '',
    } }));
  });
  window.addEventListener('casepath:review-saved', event => {
    const detail = event.detail || {};
    if (asObject(detail.review)) state.review = detail.review;
    if (asObject(detail.review?.knowledge)) state.knowledge = detail.review.knowledge;
    ingest(detail, 'review');
  });
  window.addEventListener('casepath:demo-ready', event => ingestClaim(event.detail || {}));
  window.addEventListener('casepath:claim-rendered', event => ingestClaim(event.detail || {}));
  window.addEventListener('casepath:render', onRender);
  window.addEventListener('casepath:agent-focus', onAgentFocus);
  window.addEventListener('casepath:presentation', event => {
    const detail = event.detail || {};
    if (detail.phase === 'artifact' && detail.moment === 'understand') {
      state.factTourEligible = true;
      maybeStartFactSourceTour();
    }
    if (detail.phase === 'artifact' && detail.moment === 'research') startOfficialLawTour();
  });
  window.addEventListener('casepath:official-source-step', event => ingest({ ...event.detail, moment: 'research' }, 'law-step'));
  window.addEventListener('resize', scheduleCursor, { passive: true });

  window.CasePathArtifactCanvas = Object.freeze({
    contract: CONTRACT,
    mount,
    ingest,
    render,
    snapshot,
    selectNode(nodeId) {
      if (!nodeById(nodeId)) return false;
      state.selectedNodeId = nodeId;
      state.activeChainKind = 'source';
      state.groundingOpen = true;
      render();
      return true;
    },
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => {
    mount();
    render();
  }, { once: true });
  else {
    mount();
    render();
  }
})();
