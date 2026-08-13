(() => {
  'use strict';

  const CONTRACT = 'casepath.persistent-artifact-canvas/1.0.0';
  const ROOT_ID = 'artifactCanvas';
  const READY_EVENT = 'casepath:artifact-canvas-ready';
  const INTERACTION_EVENT = 'casepath:artifact-canvas-interaction';
  const SUCCESS_STATES = new Set(['accepted', 'complete', 'completed', 'passed', 'produced', 'succeeded', 'verified']);
  const PROCESS_GATE_ID = 'deterministic_process_gate';
  const PROCESS_ARTIFACT_IDS = new Set(['process_graph', 'accepted_process_graph']);
  const GRAPH_NODE_DWELL_MS = 2400;
  const GRAPH_SOURCE_DWELL_MS = 1200;
  const OFFICIAL_LAW_DWELL_MS = 1900;
  const GRAPH_MOMENTS = new Set(['process', 'ready', 'review-applied']);
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
    intake: [5, 48],
    scope: [14, 48],
    dispute: [23, 48],
    urgency: [32, 48],
    notification: [41, 48],
    defect: [50, 48],
    causation: [62, 48],
    responsibility: [83, 48],
    remedy: [89, 48],
    resolution: [96, 48],
    ventilation_dispute: [73, 83],
  });
  const CAUSATION_BRANCH_LAYOUT = Object.freeze([
    ['building_defect', 'Building cause', 76, 24],
    ['tenant_use', 'Use-related cause', 79, 36],
    ['mixed_cause', 'Mixed cause', 79, 64],
    ['evidence_gap', 'Investigate', 76, 76],
  ]);
  const LAW_FIRST_NODE_IDS = new Set(['scope', 'dispute', 'responsibility', 'remedy']);
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const AGENTS = Object.freeze({
    canonical_facts: {
      order: 1,
      label: 'Guarded Canonical Facts Agent',
      short: 'Claim facts',
      monogram: 'CF',
      signature: 'facts',
      task: 'Separating supported facts from allegations and unknowns',
      why: 'Only source-bound facts should shape the handling process.',
    },
    orchestrator_plan: {
      order: 2,
      label: 'Nemotron Orchestrator',
      short: 'Orchestration',
      monogram: 'OR',
      signature: 'orchestrator',
      task: 'Setting one bounded focus for every specialist',
      why: 'A shared plan keeps specialist contributions coherent.',
    },
    document_source_integrity: {
      order: 3,
      label: 'Document and Source Integrity Agent',
      short: 'Sources',
      monogram: 'DS',
      signature: 'sources',
      task: 'Checking the source behind the active decision',
      why: 'A decision is trustworthy only when its evidence can be reopened.',
    },
    process_decision_mapping: {
      order: 4,
      label: 'Process Decision Mapping Agent',
      short: 'Process',
      monogram: 'PM',
      signature: 'process',
      task: 'Mapping grounded facts into the handling process',
      why: 'Every process node must exist for an inspectable reason.',
    },
    evidence_checklist: {
      order: 5,
      label: 'Evidence and Checklist Agent',
      short: 'Evidence',
      monogram: 'EC',
      signature: 'evidence',
      task: 'Attaching evidence to the decision it can resolve',
      why: 'Evidence becomes useful when its process owner is explicit.',
    },
    final_claim_brief_audit: {
      order: 6,
      label: 'Final Claim Brief Agent',
      short: 'Final audit',
      monogram: 'FB',
      signature: 'audit',
      task: 'Auditing the complete claim-handling brief',
      why: 'Unsupported conclusions must fail closed before review.',
    },
  });
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
    intake: ['Claim intake', 'Are the message and source files readable and attributable?'],
    scope: ['Tenant-law scope', 'Is this a Swiss residential-tenancy matter?'],
    dispute: ['Existence of a dispute', 'Is there a concrete disagreement requiring legal handling?'],
    urgency: ['Urgency and safety', 'Is immediate health, safety or deadline action required?'],
    notification: ['Landlord notification', 'Was the landlord told about the defect?'],
    defect: ['Defect and recurrence', 'Is a recurring condition sufficiently documented?'],
    causation: ['Causation assessment', 'What caused the recurring moisture condition?'],
    responsibility: ['Responsibility', 'Who is responsible for the established cause?'],
    remedy: ['Remedy selection', 'Which supported remedy branch applies?'],
    resolution: ['Resolution and closure', 'Has the agreed outcome been completed and documented?'],
  });
  const SPATIAL_NODE_LABELS = Object.freeze({
    intake: 'Claim intake', scope: 'Tenancy scope', dispute: 'Dispute', urgency: 'Urgency',
    notification: 'Notice', defect: 'Recurrence', causation: 'Causation assessment',
    responsibility: 'Owner', remedy: 'Remedy', resolution: 'Close',
    ventilation_dispute: 'Ventilation check',
  });
  const SPATIAL_EVIDENCE_LABELS = Object.freeze({
    moisture_measurements: 'Moisture measurements',
    building_envelope: 'Building envelope',
    technical_assessment: 'Independent assessment',
  });

  const MOMENT_COPY = Object.freeze({
    opening: {
      title: 'Opening one shared claim context',
      detail: 'The message and original files remain the source of truth.',
      authority: 'Application source parser',
    },
    read: {
      title: 'Reading the customer message and original files',
      detail: 'Nothing enters the claim state without an exact source.',
      authority: 'Application source parser',
    },
    understand: {
      title: 'Separating facts, allegations and unknowns',
      detail: 'The active fact is kept beside the passage or image region that supports it.',
      authority: 'Guarded claim-state contract',
    },
    research: {
      title: 'Opening the exact Swiss-law section',
      detail: 'A cached official passage frames the handling question without deciding technical cause.',
      authority: 'Versioned official-source registry · qualified review pending',
    },
    process: {
      title: 'Building the claim-handling process',
      detail: 'The accepted process appears one grounded decision at a time.',
      authority: 'Accepted process projection · deterministic gate',
    },
    evidence: {
      title: 'Attaching evidence to the decision it can resolve',
      detail: 'Only the active decision and its local evidence chain are expanded.',
      authority: 'Accepted evidence projection · deterministic gate',
    },
    experience: {
      title: 'Finding the closest reference pattern',
      detail: 'Relevance and provenance remain visible at the difficult branch.',
      authority: 'Deterministic generated-pattern ranking',
    },
    verify: {
      title: 'Checking the complete playbook',
      detail: 'Grounding, graph integrity and evidence relationships must agree.',
      authority: 'Final brief audit · deterministic acceptance gate',
    },
    ready: {
      title: 'A grounded handling path is ready for review',
      detail: 'Causation stays open; responsibility and remedy remain blocked until competent evidence arrives.',
      authority: 'Deterministically verified demo result',
    },
    review: {
      title: 'Reviewing the decision that changes the process',
      detail: 'The demonstration review is not qualified expert approval.',
      authority: 'Simulated demo review',
    },
    'review-applied': {
      title: 'Applying the correction across the process',
      detail: 'The returned graph and evidence relationships change together.',
      authority: 'Deterministic review transform · unverified review',
    },
    knowledge: {
      title: 'Keeping learning bounded and inspectable',
      detail: 'Case-specific memory can be stored without silently changing the shared playbook.',
      authority: 'Unverified demo memory · governed knowledge boundary',
    },
    'later-work': {
      title: 'Checking a separate future claim',
      detail: 'The later claim remains source-isolated while eligible guidance is evaluated.',
      authority: 'Receipt-bound deterministic comparison',
    },
    'later-result': {
      title: 'Showing exactly what the future claim gained',
      detail: 'Only receipt-backed, case-specific changes are presented as reuse.',
      authority: 'Deterministic comparison · shared playbook unchanged unless released',
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
    groundingOpen: false,
    cursorCommit: null,
    lastCursorKey: '',
    lastCursorChangeId: '',
    lastCursorEventId: '',
    lastCursorAgentId: '',
    cursorTimer: 0,
    cursorArrivalTimer: 0,
    cursorClickTimer: 0,
    artifactChangeSerial: 0,
    artifactChangeKeys: new Set(),
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
    if (normalized === 'review-applied' && nodeById('ventilation_dispute')) state.selectedNodeId = 'ventilation_dispute';
    if (normalized === 'research') state.neutralAuthority = 'official-law-registry';
    else if (normalized === 'experience') state.neutralAuthority = 'historical-ranking';
    else if (normalized === 'verify') state.neutralAuthority = (
      state.activeAgentId === 'final_claim_brief_audit' || state.completedAgents.has('final_claim_brief_audit')
    ) ? '' : 'whole-playbook-gate';
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
    if (agentId) state.agentLineage.set(agentId, lineage);
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
    if (nodeId) state.selectedNodeId = nodeId;
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
    }
    if (source === 'render' && state.moment === 'research') startOfficialLawTour();
    render();
  }

  function ingestClaim(detail = {}) {
    const claim = asObject(detail.claim);
    if (claim) state.claim = claim;
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
    if (state.result?.review_transform && byId.has('ventilation_dispute')) {
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
    state.cursorCommit = null;
    const nodes = simplifiedNodes();
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
      const commitNode = () => {
        if (state.pendingGraphNodeId !== node.node_id) return;
        state.pendingGraphNodeId = '';
        state.graphInspecting = false;
        state.visibleNodeIds.add(node.node_id);
        state.graphRevealIndex += 1;
        state.graphDwell = true;
        render();
        state.graphRevealTimer = window.setTimeout(() => {
          state.graphDwell = false;
          revealNext();
        }, GRAPH_NODE_DWELL_MS);
      };
      state.cursorCommit = () => {
        if (state.pendingGraphNodeId !== node.node_id) return;
        const inspectionTarget = state.root?.querySelector('[data-ac-inspection-target="true"]');
        if (inspectionTarget?.dataset.sourceLocatorId) setActiveSourceLocator(inspectionTarget.dataset.sourceLocatorId);
        if (inspectionTarget) emitInteraction(inspectionTarget.dataset.acAction || 'inspect', inspectionTarget);
        const sourceKind = inspectionTarget?.dataset.sourceId
          ? 'claim-source'
          : inspectionTarget?.dataset.lawId
            ? 'swiss-law'
            : inspectionTarget?.dataset.evidenceId
              ? 'evidence-requirement'
              : 'accepted-process-input';
        window.dispatchEvent(new CustomEvent('casepath:source-inspection', { detail: {
          entityKind: 'node',
          nodeId: node.node_id,
          changeId: state.lastCursorChangeId,
          eventId: state.lastCursorEventId,
          agentId: state.lastCursorAgentId,
          sourceKind,
          sourceId: inspectionTarget?.dataset.sourceId
            || inspectionTarget?.dataset.lawId
            || inspectionTarget?.dataset.evidenceId
            || inspectionTarget?.dataset.inspectionId
            || '',
          factId: inspectionTarget?.dataset.factId || '',
          locatorId: inspectionTarget?.dataset.sourceLocatorId || '',
          found: inspectionTarget?.querySelector('strong')?.textContent?.trim() || '',
        } }));
        state.graphRevealTimer = window.setTimeout(() => {
          state.graphInspecting = false;
          state.cursorCommit = commitNode;
          render();
        }, GRAPH_SOURCE_DWELL_MS);
      };
      render();
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
    state.cursorCommit = null;
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
    state.cursorCommit = () => {
      if (state.pendingBranchNodeId !== node.node_id) return;
      const inspectionTarget = state.root?.querySelector('[data-ac-inspection-target="true"]');
      if (inspectionTarget?.dataset.sourceLocatorId) setActiveSourceLocator(inspectionTarget.dataset.sourceLocatorId);
      if (inspectionTarget) emitInteraction(inspectionTarget.dataset.acAction || 'inspect', inspectionTarget);
      window.dispatchEvent(new CustomEvent('casepath:source-inspection', { detail: {
        entityKind: 'branch',
        nodeId: node.node_id,
        branchId: branch.branch_id,
        changeId: state.lastCursorChangeId,
        eventId: state.lastCursorEventId,
        agentId: state.lastCursorAgentId,
        sourceKind: inspectionTarget?.dataset.sourceId ? 'claim-source' : inspectionTarget?.dataset.lawId ? 'swiss-law' : inspectionTarget?.dataset.evidenceId ? 'evidence-requirement' : 'accepted-process-input',
        sourceId: inspectionTarget?.dataset.sourceId || inspectionTarget?.dataset.lawId || inspectionTarget?.dataset.evidenceId || inspectionTarget?.dataset.inspectionId || '',
        factId: inspectionTarget?.dataset.factId || '',
        locatorId: inspectionTarget?.dataset.sourceLocatorId || '',
        found: inspectionTarget?.querySelector('strong')?.textContent?.trim() || '',
      } }));
      state.graphRevealTimer = window.setTimeout(() => {
        state.visibleBranchIds.add(node.node_id);
        state.pendingBranchNodeId = '';
        state.graphInspecting = false;
        state.cursorCommit = null;
        render();
        window.dispatchEvent(new CustomEvent('casepath:branch-visualized', { detail: {
          nodeId: node.node_id,
          branchId: branch.branch_id,
          changeId: state.lastCursorChangeId,
          eventId: state.lastCursorEventId,
          agentId: state.lastCursorAgentId,
        } }));
        state.graphRevealTimer = window.setTimeout(startBranchReveal, 700);
      }, GRAPH_SOURCE_DWELL_MS);
    };
    render();
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
    if (!document.querySelector('.official-source-browser')) return;
    const sources = asArray(state.legal?.sources).filter(isOfficialLaw);
    if (!sources.length) return;
    state.officialLawTourRunning = true;
    state.officialLawTourIndex = 0;
    state.officialLawTourVisitedIds.clear();
    state.focusLawId = sources[0].source_id;
    beginOfficialLawStep(sources, 0);
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
        <ol class="ac-team" aria-label="Six Nemotron specialist roles" data-ac-team></ol>
      </header>
      <main class="ac-work-body" data-artifact-layout="persistent-source-process-focal">
        <section class="ac-process" id="artifactProcessGraph" aria-label="Accepted handling process" data-ac-process data-graph-projection="flagship-spine/1" data-process-construction-state="pending" data-process-graph-id="" hidden>
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
      <footer class="ac-authority-line">
        <span data-ac-authority>Application source parser</span>
        <span data-ac-proof>Only returned, contract-bound work is shown.</span>
      </footer>
      <div class="ac-agent-cursor" id="artifactAgentCursor" aria-hidden="true" data-ac-cursor data-agent-signature="casepath">
        <svg viewBox="0 0 24 24"><path d="M5 3.8v14.5l3.7-3.3 2.7 5.2 2.5-1.3-2.7-5.1 4.9-.7L5 3.8Z"/></svg>
        <b data-ac-cursor-monogram>CP</b>
      </div>`;
    renderTeam();
    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeydown);
  }

  function renderTeam() {
    const team = state.root?.querySelector('[data-ac-team]');
    if (!team || team.children.length) return;
    team.innerHTML = Object.entries(AGENTS)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([agentId, agent]) => `<li data-ac-agent-id="${esc(agentId)}" data-agent-signature="${esc(agent.signature)}" title="${esc(agent.label)}"><span>${esc(agent.monogram)}</span><small>${esc(agent.short)}</small></li>`)
      .join('');
  }

  function renderHeader() {
    const root = state.root;
    if (!root) return;
    const graphActorId = state.graphRevealRunning
      ? lineageFor('process_node', state.pendingGraphNodeId || state.selectedNodeId)?.agentId || ''
      : '';
    const effectiveAgentId = AGENTS[graphActorId] ? graphActorId : state.activeAgentId;
    const agent = AGENTS[effectiveAgentId];
    const copy = MOMENT_COPY[state.moment] || MOMENT_COPY.opening;
    const neutral = state.graphRevealRunning && !AGENTS[graphActorId]
      ? { label: 'Accepted process projection · deterministic gate', monogram: '◇', signature: 'gate', task: copy.title, why: copy.detail }
      : state.neutralAuthority === 'official-law-registry'
      ? { label: 'Swiss source lookup · deterministic tool', monogram: '§', signature: 'law', task: copy.title, why: copy.detail }
      : state.neutralAuthority === 'historical-ranking'
        ? { label: 'Historical reference lookup · deterministic tool', monogram: '↗', signature: 'reference', task: copy.title, why: copy.detail }
      : state.neutralAuthority === 'whole-playbook-gate'
        ? { label: 'Whole-playbook verification gate', monogram: '✓', signature: 'gate', task: copy.title, why: copy.detail }
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
    root.dataset.reviewEditState = state.moment === 'review-applied' ? 'applied' : state.moment === 'review' ? 'pending' : 'not-active';
    root.dataset.activeAgentId = neutral ? '' : effectiveAgentId;
    root.dataset.workAuthority = identity.label;
    root.querySelector('[data-ac-active-work]').dataset.agentSignature = identity.signature;
    root.querySelector('[data-ac-active-monogram]').textContent = identity.monogram;
    root.querySelector('[data-ac-position]').textContent = identity.label;
    root.querySelector('[data-ac-task]').textContent = identity.task;
    root.querySelector('[data-ac-why]').textContent = identity.why;
    root.querySelector('[data-ac-authority]').textContent = copy.authority;
    root.querySelector('[data-ac-cursor]').dataset.agentSignature = identity.signature;
    root.querySelector('[data-ac-cursor-monogram]').textContent = identity.monogram;

    root.querySelectorAll('[data-ac-agent-id]').forEach(item => {
      const agentId = item.dataset.acAgentId;
      item.dataset.agentState = agentId === effectiveAgentId && !neutral
        ? 'active'
        : state.completedAgents.has(agentId) ? 'complete' : 'waiting';
    });
  }

  function spatialPosition(nodeId) {
    return SPATIAL_SPINE_POSITIONS[nodeId] || [50, 50];
  }

  function edgeMarkup(source, target, path, stateValue = '', sourcePosition = null, targetPosition = null) {
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
    return `<path d="${d}" data-spatial-edge="${esc(path)}" data-spatial-path="${esc(path)}" data-edge-source="${esc(source)}" data-edge-target="${esc(target)}" data-edge-state="${esc(stateValue)}"></path>`;
  }

  function spatialEdgesMarkup(nodes) {
    const visible = new Set(nodes.filter(node => state.visibleNodeIds.has(node.node_id)).map(node => node.node_id));
    const paths = [];
    asArray(state.process?.edges).forEach(edge => {
      if (!visible.has(edge.source) || !visible.has(edge.target)) return;
      const path = edge.state === 'selected' || edge.state === 'loop' ? 'accepted' : 'future';
      paths.push(edgeMarkup(edge.source, edge.target, path, edge.state || ''));
    });
    if (visible.has('causation') && !['review', 'review-applied'].includes(state.moment)) {
      CAUSATION_BRANCH_LAYOUT.forEach(([target, , x, y]) => {
        if (state.graphRevealRunning && !state.visibleBranchIds.has(target)) return;
        const targetNode = nodeById(target);
        const returnedBranch = nodeById('causation')?.branches?.find(item => item.target === target);
        const returnedEdge = asArray(state.process?.edges).find(edge => edge.source === 'causation' && edge.target === target);
        if (!targetNode || !returnedBranch || !returnedEdge) return;
        paths.push(edgeMarkup('causation', target, target === 'evidence_gap' ? 'next-action' : 'uncertainty', returnedEdge.state || '', spatialPosition('causation'), [x, y]));
      });
      CAUSATION_BRANCH_LAYOUT.forEach(([source, , x, y]) => {
        if (state.graphRevealRunning && !state.visibleBranchIds.has(source)) return;
        if (!nodeById(source)) return;
        asArray(state.process?.edges).filter(edge => edge.source === source && ['responsibility', 'causation'].includes(edge.target)).forEach(edge => {
          paths.push(edgeMarkup(edge.source, edge.target, edge.state === 'loop' ? 'loop' : 'branch-resolution', edge.state || '', [x, y], spatialPosition(edge.target)));
        });
      });
    }
    return paths.join('');
  }

  function spatialSatellitesMarkup() {
    if (!state.processAccepted || !state.visibleNodeIds.has('causation')) return '';
    if (['review', 'review-applied'].includes(state.moment)) return '';
    const causation = nodeById('causation');
    const law = relevantLaw(lawsForNode(causation));
    const next = relevantEvidence(evidenceForNode('evidence_gap'));
    const evidence = priorityEvidence(evidenceForNode('causation')).filter(item => item.item_id !== next?.item_id).slice(0, 2);
    const branchMarkup = CAUSATION_BRANCH_LAYOUT.map(([nodeId, shortLabel, x, y]) => {
      if (state.graphRevealRunning && !state.visibleBranchIds.has(nodeId)) return '';
      const returnedNode = nodeById(nodeId);
      if (!returnedNode) return '';
      const branch = causation?.branches?.find(item => item.target === nodeId);
      const returnedEdge = asArray(state.process?.edges).find(edge => edge.source === 'causation' && edge.target === nodeId);
      if (!branch || !returnedEdge) return '';
      return `<button type="button" class="ac-spatial-branch" style="--spatial-x:${x};--spatial-y:${y}" data-ac-action="select-node" data-spatial-id="${esc(nodeId)}" data-spatial-role="branch" data-spatial-path="${nodeId === 'evidence_gap' ? 'next-action' : 'uncertainty'}" data-node-id="${esc(nodeId)}" data-branch-id="${esc(branch.branch_id)}" data-branch-state="${esc(branch.state || '')}" aria-label="${esc(returnedNode.title)}"><span aria-hidden="true"></span><strong>${esc(shortLabel)}</strong></button>`;
    }).join('');
    const lawLabel = law?.location?.match(/Art(?:icle)?\.?\s*\d+/i)?.[0]?.replace(/^Article/i, 'Art.') || 'Swiss law';
    const lawMarkup = !state.graphRevealRunning && law ? `<button type="button" class="ac-spatial-law-marker" style="--spatial-x:62;--spatial-y:27" data-ac-action="open-law" data-law-id="${esc(law.source_id)}" data-spatial-id="${esc(law.source_id)}" data-spatial-anchor-node-id="causation" data-spatial-role="law" data-spatial-path="legal-grounding" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}" aria-label="${esc(`${law.title || law.source_id} ${law.location || ''}`)}"><span aria-hidden="true">§</span><strong>${esc(lawLabel)}</strong></button>` : '';
    const evidenceMarkup = evidence.map(item => `<button type="button" class="ac-evidence-chip" data-ac-action="inspect-evidence" data-evidence-id="${esc(item.item_id)}" data-spatial-id="${esc(item.item_id)}" data-spatial-anchor-node-id="causation" data-spatial-role="evidence" data-spatial-path="evidence-support" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', item.item_id)} data-evidence-status="${esc(item.status || '')}" data-fact-id="${esc(item.fact_id || '')}" aria-label="${esc(`${item.title} · ${statusLabel(item.status)}`)}">${esc(SPATIAL_EVIDENCE_LABELS[item.item_id] || item.title)}</button>`).join('<span aria-hidden="true">·</span>');
    const nextMarkup = next && nodeById('evidence_gap') && evidenceOwnerIds(next).includes('evidence_gap') ? `<button type="button" class="ac-evidence-need" data-ac-action="inspect-evidence" data-spatial-id="${esc(next.item_id)}" data-spatial-role="next-action" data-spatial-path="next-action" data-spatial-next-action="true" data-spatial-anchor-node-id="causation" data-node-attachment-kind="evidence" ${lineageAttributes('evidence', next.item_id)} data-node-id="evidence_gap" data-evidence-id="${esc(next.item_id)}"><span>Need</span><strong>${esc(SPATIAL_EVIDENCE_LABELS[next.item_id] || next.title)}</strong><b aria-hidden="true">→</b></button>` : '';
    const evidencePanel = !state.graphRevealRunning && (nextMarkup || evidenceMarkup) ? `<section class="ac-evidence-relationship" style="--spatial-x:53;--spatial-y:82" aria-label="Evidence generated by the current process decision"><small>Causation unresolved</small>${nextMarkup}${evidenceMarkup ? `<div><span>Later</span>${evidenceMarkup}</div>` : ''}</section>` : '';
    return `${lawMarkup}${branchMarkup}${evidencePanel}`;
  }

  function spatialDetailMarkup(node) {
    if (!node) return '';
    if (state.graphInspecting && [state.pendingGraphNodeId, state.pendingBranchNodeId].includes(node.node_id)) return nodeInspectionMarkup(node);
    const facts = asArray(node.fact_ids);
    const laws = asArray(node.legal_source_ids);
    const evidence = asArray(node.evidence_requirement_ids);
    return `<div class="ac-spatial-node-detail" data-spatial-role="active-detail" data-spatial-path="active" data-active-focal-path="true" data-node-id="${esc(node.node_id)}" data-basis-fact-ids="${esc(facts.join(','))}" data-basis-law-ids="${esc(laws.join(','))}" data-basis-evidence-requirement-ids="${esc(evidence.join(','))}"><span>${nodeState(node) === 'current' ? 'Current decision' : 'Grounded decision'}</span><strong>${esc(node.question || node.title)}</strong><p>${esc(node.why || node.answer || '')}</p>${spatialGroundingMarkup(node)}</div>`;
  }

  function spatialGroundingMarkup(node) {
    const fact = relevantFact(factsForNode(node));
    const ref = asArray(fact?.source_refs)[0];
    const nodeLaws = lawsForNode(node);
    const laws = [nodeLaws.find(isOfficialLaw), nodeLaws.find(item => !isOfficialLaw(item))].filter(Boolean);
    const evidence = relevantEvidence(evidenceForNode(node.node_id));
    const nodePrecedents = precedentsForNode(node.node_id);
    const precedent = nodePrecedents.find(item => Number(item.ranking?.rank) === 1)
      || relevantPrecedent(nodePrecedents);
    const items = [];
    if (fact && ref) {
      const found = ref.excerpt || ref.observation || `${fact.label}: ${fact.value}`;
      items.push(`<button type="button" data-node-attachment-kind="fact" ${lineageAttributes('fact', fact.fact_id)} data-ac-action="open-source" data-node-id="${esc(node.node_id)}" data-fact-id="${esc(fact.fact_id)}" data-source-id="${esc(ref.artifact_id)}" data-locator-kind="${esc(ref.locator_kind || '')}" data-source-page="${esc(ref.page || '')}" data-source-excerpt="${esc(ref.excerpt || '')}" data-source-region="${esc(asArray(ref.region).length === 4 ? JSON.stringify(ref.region) : '')}" data-source-authority="customer_submission" data-source-locator-id="${esc(sourceLocatorId(ref))}"><span>Claim source</span><strong>${esc(found)}</strong></button>`);
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
    if (!items.length) return '';
    return `<div class="ac-grounding-disclosure" data-grounding-open="${String(state.groundingOpen)}"><button type="button" class="ac-grounding-toggle" data-ac-action="toggle-grounding" aria-expanded="${String(state.groundingOpen)}">View grounding</button><div ${state.groundingOpen ? '' : 'hidden'}>${items.join('')}</div></div>`;
  }

  function nodeInspectionMarkup(node) {
    const fact = relevantFact(factsForNode(node));
    const ref = asArray(fact?.source_refs)[0];
    const law = relevantLaw(lawsForNode(node));
    if (LAW_FIRST_NODE_IDS.has(node.node_id) && law) {
      return `<button type="button" class="ac-build-inspection" data-ac-inspection-target="true" data-node-id="${esc(node.node_id)}" data-ac-action="open-law" data-law-id="${esc(law.source_id)}" data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}"><small>Looking at · ${isOfficialLaw(law) ? 'official Swiss law' : 'handling principle'} · ${esc(law.location || '')}</small><strong>${esc(law.passage_text || law.passage_summary || law.role || law.title)}</strong><span>Shapes the next decision · ${esc(SPATIAL_NODE_LABELS[node.node_id] || node.title)}</span></button>`;
    }
    if (fact && ref) {
      const locator = ref.locator_kind === 'visual_observation'
        ? `Image region · ${asArray(ref.region).map(value => Number(value).toFixed(2)).join(', ')}`
        : `Page ${ref.page || 'not returned'}`;
      const found = ref.excerpt || ref.observation || `${fact.label}: ${fact.value}`;
      return `<button type="button" class="ac-build-inspection" data-ac-inspection-target="true" data-node-id="${esc(node.node_id)}" data-ac-action="open-source" data-fact-id="${esc(fact.fact_id)}" data-source-id="${esc(ref.artifact_id)}" data-locator-kind="${esc(ref.locator_kind || '')}" data-source-page="${esc(ref.page || '')}" data-source-excerpt="${esc(ref.excerpt || '')}" data-source-region="${esc(asArray(ref.region).length === 4 ? JSON.stringify(ref.region) : '')}" data-source-authority="customer_submission" data-source-locator-id="${esc(sourceLocatorId(ref))}"><small>Looking at · customer source · ${esc(locator)}</small><strong>${esc(found)}</strong><span>Supports the next decision · ${esc(SPATIAL_NODE_LABELS[node.node_id] || node.title)}</span></button>`;
    }
    if (law) {
      return `<button type="button" class="ac-build-inspection" data-ac-inspection-target="true" data-node-id="${esc(node.node_id)}" data-ac-action="open-law" data-law-id="${esc(law.source_id)}" data-source-authority="${isOfficialLaw(law) ? 'official_registry' : 'deterministic_principle'}" data-source-locator-id="${esc(lawLocatorId(law))}"><small>Looking at · ${isOfficialLaw(law) ? 'official Swiss law' : 'handling principle'} · ${esc(law.location || '')}</small><strong>${esc(law.passage_text || law.passage_summary || law.role || law.title)}</strong><span>Shapes the next decision · ${esc(SPATIAL_NODE_LABELS[node.node_id] || node.title)}</span></button>`;
    }
    const evidence = relevantEvidence(evidenceForNode(node.node_id));
    if (evidence) {
      return `<button type="button" class="ac-build-inspection" data-ac-inspection-target="true" data-node-id="${esc(node.node_id)}" data-ac-action="inspect-evidence" data-evidence-id="${esc(evidence.item_id)}"><small>Looking at · exact evidence requirement</small><strong>${esc(evidence.title)}</strong><span>${esc(evidence.why || `Determines the next decision · ${SPATIAL_NODE_LABELS[node.node_id] || node.title}`)}</span></button>`;
    }
    return `<button type="button" class="ac-build-inspection" data-ac-inspection-target="true" data-node-id="${esc(node.node_id)}" data-ac-action="select-node" data-inspection-id="${esc(node.node_id)}"><small>Looking at · exact accepted process record</small><strong>${esc(node.why || node.question || node.title)}</strong><span>Creates the next decision · ${esc(SPATIAL_NODE_LABELS[node.node_id] || node.title)}</span></button>`;
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
    processRegion.dataset.processConstructionState = !state.processAccepted
      ? 'pending'
      : state.graphRevealRunning ? 'building' : 'complete';
    if (!state.processAccepted) return;
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
      item.dataset.spatialPath = 'accepted';
      item.dataset.nodeState = nodeState(node);
      item.dataset.reviewChange = node.node_id === 'ventilation_dispute' && state.result?.review_transform ? 'added' : '';
      item.dataset.revealState = state.visibleNodeIds.has(node.node_id) ? 'visible' : 'pending';
      item.dataset.processBuildState = state.visibleNodeIds.has(node.node_id)
        ? state.graphRevealRunning && state.graphDwell && index === state.graphRevealIndex - 1 ? 'building' : 'built'
        : 'pending';
      item.dataset.selected = String(node.node_id === state.selectedNodeId);
      item.querySelector('[data-ac-node-marker]').textContent = nodeState(node) === 'complete' ? '✓' : String(index + 1);
      item.querySelector('[data-ac-node-title]').textContent = SPATIAL_NODE_LABELS[node.node_id] || node.title || DEFAULT_NODE_COPY[node.node_id]?.[0] || node.node_id;
      item.querySelector('button').setAttribute('aria-label', `${node.title || node.node_id}: ${node.answer || node.question || nodeState(node)}`);
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
    buildTarget.hidden = !pendingNode || state.graphInspecting;
    buildTarget.dataset.nodeId = pendingNode?.node_id || '';
    const [buildX, buildY] = spatialPosition(pendingNode?.node_id);
    buildTarget.style.setProperty('--spatial-x', buildX);
    buildTarget.style.setProperty('--spatial-y', buildY);
    buildTarget.textContent = pendingNode ? `Add decision · ${pendingNode.title || pendingNode.node_id}` : '';
    if (state.graphRevealRunning) {
      count.textContent = `Building decision ${Math.min(state.graphRevealIndex + (state.graphDwell ? 0 : 1), nodes.length)} of ${nodes.length}`;
      focus.textContent = nodeById(state.selectedNodeId)?.title || DEFAULT_NODE_COPY[state.selectedNodeId]?.[0] || 'Grounded decision';
      status.textContent = `Decision ${Math.min(state.graphRevealIndex + (state.graphDwell ? 0 : 1), nodes.length)} of ${nodes.length}: ${focus.textContent}`;
    } else {
      count.textContent = state.moment === 'review-applied'
        ? `Unverified demo correction · ${nodes.length} accepted decisions`
        : `${nodes.length} accepted decisions · complete path available`;
      focus.textContent = nodeById(state.selectedNodeId)?.title || 'Select one decision';
      status.textContent = `${nodes.length} accepted decisions. Current decision: ${focus.textContent}.`;
    }
    edgeLayer.innerHTML = spatialEdgesMarkup(nodes);
    satellites.innerHTML = spatialSatellitesMarkup();
    detail.innerHTML = spatialDetailMarkup(nodeById(state.selectedNodeId));
  }

  function stageFocalMarkup() {
    const copy = MOMENT_COPY[state.moment] || MOMENT_COPY.opening;
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
    return `<article class="ac-stage-focus ac-reference-focus" data-ac-focal-object="reference" data-node-attachment-kind="precedent" ${lineageAttributes('precedent', precedent.claim_id)} data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-ac-cursor-target="true">
      <span>${esc(copy.authority)} · ${esc(provenanceLabel(precedent))}</span>
      <h3>${esc(precedent.title)}</h3>
      <p>${esc(precedent.why_useful || copy.detail)}</p>
      <strong>Rank ${esc(ranking.rank ?? 'not returned')} · ${esc(ranking.score_basis_points ?? 'score not returned')} points</strong>
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
    const law = sources.find(item => item.source_id === state.focusLawId) || sources[0];
    const cursorLawId = state.pendingLawId || law?.source_id || '';
    if (!law) return `<article class="ac-stage-focus ac-law-focus" data-ac-focal-object="law" data-ac-cursor-target="true"><span>${esc(copy.authority)}</span><h3>${esc(copy.title)}</h3><p>${esc(copy.detail)}</p></article>`;
    const retrieval = law.retrieval || {};
    let officialHost = 'official source';
    try { officialHost = new URL(String(law.url || '')).host || officialHost; } catch (_) {}
    return `<article class="ac-stage-focus ac-law-focus" data-ac-focal-object="law" data-ac-law-id="${esc(law.source_id)}" data-node-attachment-kind="law" ${lineageAttributes('law', law.source_id)} data-source-authority="official_registry" data-source-locator-id="${esc(lawLocatorId(law))}">
      <div class="ac-browser-bar"><i aria-hidden="true"></i><span><strong>${esc(officialHost)}</strong><code>${esc(law.url || 'Official URL not returned')}</code></span><small>Cached exact passage</small></div>
      <nav class="ac-law-tabs" aria-label="Exact official Swiss-law sections">${sources.map(source => `<button type="button" data-ac-action="select-law" data-law-id="${esc(source.source_id)}" data-source-authority="official_registry" data-source-locator-id="${esc(lawLocatorId(source))}" aria-current="${String(source.source_id === law.source_id)}" ${source.source_id === cursorLawId ? 'data-ac-cursor-target="true"' : ''}>${esc(source.location || source.title)}</button>`).join('')}</nav>
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
    const memoryOriginId = String(valueFrom(memory?.source_memory, 'memory_id') || valueFrom(memory, 'memory_id') || memoryId || valueFrom(memory, 'application_hash') || '');
    const receipt = memory.contract === 'casepath.memory-application-receipt/1.0.0';
    const sharedChanged = later.shared_rule_applied === true || result.shared_rule_applied === true;
    const headline = state.moment === 'later-result' && receipt
      ? 'Case-specific memory changed the next step.'
      : memoryId
        ? 'Case memory saved for governed reuse.'
        : copy.title;
    const detail = state.moment === 'later-result' && receipt
      ? 'The later claim now asks for one neutral assessment before broader building tests.'
      : memoryId
        ? 'It remains unverified and does not change the shared playbook.'
        : copy.detail;
    const memoryEffects = state.moment === 'later-result' && memoryOriginId ? `
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
    const ref = refs[0];
    if (!fact || !ref) return '<p class="ac-empty-chain">No exact source reference was returned for this decision.</p>';
    const locator = ref.locator_kind === 'visual_observation'
      ? `Image region ${asArray(ref.region).map(value => Number(value).toFixed(2)).join(', ')}`
      : ref.locator_kind === 'metadata_field'
        ? `${ref.field || 'Metadata field'}: ${ref.value ?? 'value not returned'}`
        : `Page ${ref.page || 'not returned'} · “${ref.excerpt || 'passage not returned'}”`;
    const locatorId = sourceLocatorId(ref);
    return `<div class="ac-chain-object ac-source-object" data-node-attachment-kind="fact" ${lineageAttributes('fact', fact.fact_id)} data-fact-id="${esc(fact.fact_id)}" data-source-id="${esc(ref.artifact_id)}" data-locator-kind="${esc(ref.locator_kind || '')}" data-source-authority="customer_submission" data-source-locator-id="${esc(locatorId)}">
      <div><span>What is established</span><strong>${esc(fact.label)} · ${esc(fact.value)}</strong><p>${esc(fact.explanation || '')}</p></div>
      <aside><small>${esc(locator)}</small>${ref.observation ? `<p>${esc(ref.observation)}</p>` : ''}<button type="button" data-ac-action="open-source" data-node-id="${esc(node.node_id)}" data-fact-id="${esc(fact.fact_id)}" data-source-id="${esc(ref.artifact_id)}" data-locator-kind="${esc(ref.locator_kind || '')}" data-source-page="${esc(ref.page || '')}" data-source-excerpt="${esc(ref.excerpt || '')}" data-source-region="${esc(asArray(ref.region).length === 4 ? JSON.stringify(ref.region) : '')}" data-source-authority="customer_submission" data-source-locator-id="${esc(locatorId)}" data-casepath-primary-action="true">Open exact source</button></aside>
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
    return `<div class="ac-chain-object ac-reference-object" data-node-attachment-kind="precedent" ${lineageAttributes('precedent', precedent.claim_id)} data-precedent-id="${esc(precedent.claim_id)}" data-review-status="${esc(precedent.review_status || '')}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}">
      <div><span>${esc(provenanceLabel(precedent))}</span><strong>${esc(precedent.title)}</strong><p>${esc(precedent.why_useful || '')}</p></div>
      <aside><small>Rank ${esc(ranking.rank ?? 'not returned')} · ${esc(ranking.score_basis_points ?? 'score not returned')} points</small><p>${esc((precedent.shared_features || []).slice(0, 3).join(' · '))}</p><button type="button" data-ac-action="open-reference" data-node-id="${esc(node.node_id)}" data-precedent-id="${esc(precedent.claim_id)}" data-reference-status="${esc(precedent.review_status || '')}" data-source-authority="generated_reference" data-source-locator-id="reference:${esc(precedent.claim_id)}" data-casepath-primary-action="true">Open reference pattern</button></aside>
      ${references.length > 1 ? `<em>${references.length - 1} more ranked pattern${references.length === 2 ? '' : 's'} available.</em>` : ''}
    </div>`;
  }

  function renderFocal() {
    const focal = state.root?.querySelector('[data-ac-focal]');
    if (!focal) return;
    const specialMoment = ['verify', 'review', 'review-applied', 'knowledge', 'later-work', 'later-result', 'failure'].includes(state.moment);
    const semanticArtifactMoment = ['evidence', 'experience'].includes(state.moment);
    const node = nodeById(state.selectedNodeId);
    const modelArtifact = eventActorType(state.currentEvent) === 'nemotron_agent' && AGENTS[eventAgentId(state.currentEvent)];
    const markup = state.graphRevealRunning && node
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
    if (tourBoundLaw && focal.dataset.artifactFocus === 'true' && !state.graphRevealRunning && !state.pendingLawId) {
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
    if (state.processAccepted) {
      if (state.moment === 'review-applied') {
        proof.textContent = 'Accepted correction · causation → ventilation check → evidence loop';
        return;
      }
      const current = state.process?.current_overlay?.current_node_id || state.process?.current_node || 'not returned';
      const next = state.process?.current_overlay?.next_action_node_id || 'not returned';
      proof.textContent = `Accepted path · current ${current} · next ${next}`;
    } else {
      proof.textContent = 'Only returned, contract-bound work is shown.';
    }
  }

  function render() {
    mount();
    if (!state.root) return;
    const submission = document.querySelector('.submission-pane');
    if (submission) {
      submission.classList.remove('collapsed');
      submission.dataset.sourceDockState = submission.dataset.activeSourceLocator ? 'active' : 'open';
      document.querySelector('#toggleSource')?.setAttribute('aria-expanded', 'true');
    }
    renderHeader();
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
      state.root.querySelector('[data-ac-inspection-target="true"]')?.setAttribute('data-ac-cursor-target', 'true');
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
            excerpt: detail.excerpt,
            region: detail.region,
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
    state.root.dataset.activeSourceLocator = locatorId;
    state.root.dataset.sourceDockState = 'open';
    const submission = document.querySelector('.submission-pane');
    if (submission) {
      submission.dataset.activeSourceLocator = locatorId;
      submission.dataset.sourceDockState = 'open';
    }
  }

  function handleClick(event) {
    const button = event.target.closest?.('[data-ac-action]');
    if (!button || !state.root?.contains(button)) return;
    const action = button.dataset.acAction;
    if (action === 'toggle-grounding') {
      event.preventDefault();
      state.groundingOpen = !state.groundingOpen;
      const disclosure = button.closest('.ac-grounding-disclosure');
      if (disclosure) {
        disclosure.dataset.groundingOpen = String(state.groundingOpen);
        button.setAttribute('aria-expanded', String(state.groundingOpen));
        const panel = disclosure.querySelector(':scope > div');
        if (panel) panel.hidden = !state.groundingOpen;
      }
      return;
    }
    if (action === 'close-law') {
      state.root.querySelector('[data-ac-law-viewer]')?.close();
      return;
    }
    if (action === 'select-node') {
      state.selectedNodeId = button.dataset.nodeId;
      state.activeChainKind = 'source';
      state.groundingOpen = false;
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

  function positionCursor() {
    const root = state.root;
    const cursor = root?.querySelector('[data-ac-cursor]');
    const focus = root?.querySelector('[data-artifact-focus="true"]');
    const target = focus?.querySelector('[data-ac-cursor-target="true"]')
      || (!state.graphRevealRunning && !state.graphDwell ? focus?.querySelector('[data-selected="true"] button') : null);
    if (!root || !cursor || !target) return;
    const rootBox = root.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    if (!rootBox.width || !targetBox.width) return;
    const x = Math.round(Math.max(18, Math.min(rootBox.width - 56, targetBox.right - rootBox.left - 22)) / 2) * 2;
    const y = Math.round(Math.max(74, Math.min(rootBox.height - 52, targetBox.top - rootBox.top + Math.min(targetBox.height * .55, 54))) / 2) * 2;
    const targetId = target.dataset.lawId
      || target.dataset.sourceId
      || target.dataset.evidenceId
      || target.dataset.inspectionId
      || target.dataset.factId
      || target.dataset.nodeId
      || target.dataset.precedentId
      || target.dataset.acFocalObject
      || target.dataset.acAction
      || target.tagName.toLowerCase();
    const key = `${state.lastCursorChangeId}:${state.activeAgentId}:${state.neutralAuthority}:${state.moment}:${targetId}:${Math.round(x)}:${Math.round(y)}`;
    if (state.lastCursorKey === key) return;
    state.lastCursorKey = key;
    window.clearTimeout(state.cursorArrivalTimer);
    window.clearTimeout(state.cursorClickTimer);
    cursor.style.setProperty('--ac-cursor-x', `${x}px`);
    cursor.style.setProperty('--ac-cursor-y', `${y}px`);
    cursor.dataset.changeId = state.lastCursorChangeId;
    cursor.dataset.eventId = state.lastCursorEventId;
    cursor.dataset.agentId = state.lastCursorAgentId;
    cursor.dataset.targetId = targetId;
    cursor.dataset.cursorPhase = 'moving';
    const cursorDetail = () => ({
      changeId: state.lastCursorChangeId,
      eventId: state.lastCursorEventId,
      agentId: state.lastCursorAgentId,
      targetId,
      moment: state.moment,
    });
    window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: { ...cursorDetail(), phase: 'move' } }));
    state.cursorArrivalTimer = window.setTimeout(() => {
      if (!cursor.isConnected) return;
      cursor.dataset.cursorPhase = 'settled';
      window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: { ...cursorDetail(), phase: 'arrived' } }));
      cursor.classList.add('is-clicking');
      window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: { ...cursorDetail(), phase: 'click' } }));
      const commit = state.cursorCommit;
      state.cursorCommit = null;
      commit?.();
      state.cursorClickTimer = window.setTimeout(() => cursor.classList.remove('is-clicking'), 240);
    }, REDUCED_MOTION ? 0 : 560);
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
