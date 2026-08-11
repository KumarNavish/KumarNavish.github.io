(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const API = (params.get('api') || window.CASEPATH_API || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const PACE = reduceMotion ? 20 : 520;
  const SESSION_STORAGE_KEY = 'casepath:demo-session';
  const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

  function createSessionId() {
    const token = crypto.randomUUID?.() || [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
    return `ui-${token}`;
  }

  function demoSessionId() {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored && SESSION_ID_PATTERN.test(stored)) return stored;
      const created = createSessionId();
      sessionStorage.setItem(SESSION_STORAGE_KEY, created);
      return created;
    } catch (_) {
      return createSessionId();
    }
  }

  const SESSION_ID = demoSessionId();

  const STAGES = [
    { id: 'read', label: 'Read evidence', short: 'Read', job: 'Reading the message and every original attachment.' },
    { id: 'understand', label: 'Understand claim', short: 'Understand', job: 'Separating supported facts, allegations, conflicts, and unknowns.' },
    { id: 'research', label: 'Research law', short: 'Law', job: 'Finding the Swiss-law questions that shape the handling process.' },
    { id: 'process', label: 'Build process', short: 'Process', job: 'Working out every decision needed from intake to resolution.' },
    { id: 'evidence', label: 'Map evidence', short: 'Evidence', job: 'Connecting each process decision to the facts and evidence it needs.' },
    { id: 'experience', label: 'Find experience', short: 'Experience', job: 'Looking for provenance-labelled reference precedents at difficult branches.' },
    { id: 'verify', label: 'Verify plan', short: 'Verify', job: 'Checking graph integrity, grounding, and document traceability.' },
  ];

  const state = {
    demo: null,
    claim: null,
    flagshipClaim: null,
    laterClaim: null,
    runId: null,
    run: null,
    flagshipRun: null,
    baselineLaterRun: null,
    laterRun: null,
    review: null,
    reviewBefore: null,
    proof: null,
    selectedNodeId: 'causation',
    branchesExpanded: false,
    activeStage: null,
    stageMode: null,
    eventQueue: [],
    queuedEventIds: new Set(),
    presentedEvents: [],
    presenting: false,
    polling: false,
    runComplete: false,
    journey: 'start',
    viewer: { artifact: null, extraction: null, page: 1, zoom: 1, tab: 'original', context: null, searchMatches: [] },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function renderCanvas(markup, moment = '') {
    const canvas = $('#stageCanvas');
    if (!canvas) return;
    canvas.innerHTML = markup;
    canvas.dataset.casepathMoment = moment;
    canvas.setAttribute('aria-busy', 'false');
    window.dispatchEvent(new CustomEvent('casepath:render', { detail: { moment } }));
  }

  function announceRender(moment = '') {
    const canvas = $('#stageCanvas');
    if (canvas && moment) canvas.dataset.casepathMoment = moment;
    window.dispatchEvent(new CustomEvent('casepath:render', { detail: { moment } }));
  }

  const EXPLICIT_ACTOR_TYPES = new Set(['nemotron_agent', 'deterministic_tool', 'deterministic_gate']);
  const SUCCESS_EVENT_STATES = new Set(['accepted', 'cache_hit', 'completed', 'passed', 'succeeded', 'succeeded_with_guarded_fallback', 'success']);

  function returnedValue(event, ...keys) {
    for (const key of keys) {
      const value = event?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value);
    }
    return '';
  }

  function eventKind(event) {
    const actorType = returnedValue(event, 'actor_type');
    if (EXPLICIT_ACTOR_TYPES.has(actorType)) return actorType;
    const eventType = returnedValue(event, 'event_type', 'type');
    const implementation = returnedValue(event, 'implementation');
    if (/gate/i.test(eventType) || /gate/i.test(implementation)) return 'legacy_deterministic_gate';
    if (returnedValue(event, 'model', 'requested_model', 'response_model')) return 'legacy_model_event';
    if (/deterministic|reference/i.test(implementation)) return 'legacy_deterministic_event';
    return 'legacy_event';
  }

  function eventIsGate(event) {
    return ['deterministic_gate', 'legacy_deterministic_gate'].includes(eventKind(event));
  }

  function eventState(event) {
    return returnedValue(event, 'outcome', 'status');
  }

  function eventSucceeded(event) {
    return SUCCESS_EVENT_STATES.has(eventState(event).toLowerCase());
  }

  function eventArtifacts(event) {
    const returned = [];
    if (Array.isArray(event?.output_artifacts)) returned.push(...event.output_artifacts);
    const single = event?.output_artifact ?? event?.output_artifact_id;
    if (single !== undefined && single !== null && String(single).trim()) returned.push(single);
    return [...new Set(returned.map(value => String(value)))];
  }

  function returnedActorName(event, { preferLabel = false } = {}) {
    const actor = returnedValue(event, 'actor_name', 'agent_name', 'actor_id', 'agent_id', 'agent');
    const label = returnedValue(event, 'label');
    return preferLabel ? label || actor : actor || label;
  }

  function eventReceiptKey(event) {
    return returnedValue(event, 'event_id') || (event?.ordinal !== undefined ? `ordinal:${event.ordinal}` : [event?.stage, event?.status, event?.label, event?.output_artifact].map(value => String(value || '')).join(':'));
  }

  function rememberPresentedEvent(event) {
    const key = eventReceiptKey(event);
    if (!state.presentedEvents.some(item => eventReceiptKey(item) === key)) state.presentedEvents.push(event);
  }

  function actorKindLabel(kind) {
    return ({
      nemotron_agent: 'Nemotron agent',
      deterministic_tool: 'Deterministic tool',
      deterministic_gate: 'Deterministic gate',
      legacy_model_event: 'Model-assisted legacy event',
      legacy_deterministic_gate: 'Legacy deterministic gate',
      legacy_deterministic_event: 'Deterministic reference event',
      legacy_event: 'Legacy event contract',
    })[kind] || 'Returned event';
  }

  function proofMeta(label, value, key = '') {
    if (!value) return '';
    return `<span${key ? ` data-proof-field="${esc(key)}"` : ''}><small>${esc(label)}</small><code>${esc(value)}</code></span>`;
  }

  function actorInitials(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'N';
  }

  function returnedFramework(event) {
    const framework = event?.orchestration_framework ?? event?.framework;
    if (typeof framework === 'string') return framework;
    if (!framework || typeof framework !== 'object' || Array.isArray(framework)) return '';
    const labels = { langchain: 'LangChain', langgraph: 'LangGraph', langchain_openrouter: 'LangChain OpenRouter' };
    return Object.entries(labels).flatMap(([key, label]) => {
      const value = framework[key];
      return typeof value === 'string' && value.trim() ? [`${label} ${value}`] : [];
    }).join(' · ');
  }

  function safeEventMetrics(event) {
    const allowed = {
      accepted_count: 'Accepted',
      rejected_count: 'Rejected',
      accepted_fact_count: 'Facts accepted',
      rejected_fact_count: 'Facts rejected',
      source_reference_projection_count: 'Source bindings projected',
      facts: 'Facts',
      unknowns: 'Unknowns',
      conflicts: 'Conflicts',
      nodes: 'Process nodes',
      edges: 'Connections',
      items: 'Evidence links',
      files: 'Files',
      pages: 'Pages',
      images: 'Images',
      precedents: 'Precedents',
      checks: 'Checks',
      checks_passed: 'Checks passed',
      canonical_artifacts: 'Canonical artifacts',
    };
    const metrics = event?.metrics && typeof event.metrics === 'object' && !Array.isArray(event.metrics) ? event.metrics : {};
    return Object.entries(allowed).flatMap(([key, label]) => {
      const raw = event?.[key] ?? metrics[key];
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? [{ key, label, value }] : [];
    });
  }

  function renderSafeEventMetrics(event) {
    const metrics = safeEventMetrics(event);
    if (!metrics.length) return '';
    return `<div class="orchestration-result-metrics" aria-label="Returned bounded result counts">${metrics.map(metric => `<span data-result-metric="${esc(metric.key)}"><strong>${esc(metric.value)}</strong><small>${esc(metric.label)}</small></span>`).join('')}</div>`;
  }

  function renderActorCard(event) {
    if (!event) return '';
    const kind = eventKind(event);
    const isNemotron = kind === 'nemotron_agent';
    const isModelLegacy = kind === 'legacy_model_event';
    const deterministic = ['deterministic_tool', 'legacy_deterministic_event', 'legacy_event'].includes(kind);
    const actorName = returnedActorName(event, { preferLabel: deterministic });
    const detail = returnedValue(event, 'result_summary', 'safe_summary', 'headline', 'detail', 'question');
    const status = eventState(event);
    const model = returnedValue(event, 'requested_model', 'model');
    const responseModel = returnedValue(event, 'response_model');
    const callId = returnedValue(event, 'call_id');
    const delegationId = returnedValue(event, 'delegation_id');
    const artifacts = eventArtifacts(event).join(', ');
    const artifactLabel = returnedValue(event, 'output_artifact_label', 'artifact_label');
    const outputHash = returnedValue(event, 'output_artifact_hash', 'output_hash', 'artifact_hash');
    const inputArtifacts = Array.isArray(event?.input_artifacts) ? event.input_artifacts.map(value => String(value)).join(', ') : returnedValue(event, 'input_artifact', 'input_artifact_id');
    const inputHash = returnedValue(event, 'input_artifact_hash', 'input_hash');
    const cacheHit = event?.cache_hit === true || returnedValue(event, 'cache_hit').toLowerCase() === 'true';
    const originCallId = returnedValue(event, 'cache_origin_call_id', 'origin_call_id');
    const actorId = returnedValue(event, 'actor_id', 'agent_id', 'agent');
    const isCanonicalRoot = actorId === 'canonical_facts';
    const missingResponseIdentity = eventSucceeded(event) && !responseModel && !(cacheHit && originCallId);
    const missingCallProof = isNemotron && (
      !model ||
      (eventSucceeded(event) && (
        !callId ||
        (!isCanonicalRoot && !delegationId) ||
        !artifacts ||
        !outputHash ||
        missingResponseIdentity
      ))
    );
    const meta = [
      isNemotron ? proofMeta('Orchestration', returnedFramework(event), 'orchestration-framework') : '',
      (isNemotron || isModelLegacy) ? proofMeta('Requested model', model, 'model') : '',
      (isNemotron || isModelLegacy) ? proofMeta('Response model', responseModel, 'response-model') : '',
      (isNemotron || isModelLegacy) ? proofMeta('Call', callId, 'call-id') : '',
      isNemotron ? proofMeta('Delegation', delegationId, 'delegation-id') : '',
      proofMeta('Output artifact', artifactLabel ? `${artifactLabel} · ${artifacts}` : artifacts, 'artifact-id'),
      proofMeta('Output hash', outputHash, 'artifact-hash'),
      proofMeta('Input artifact', inputArtifacts, 'input-artifact-id'),
      proofMeta('Input hash', inputHash, 'input-hash'),
      cacheHit ? proofMeta('Cache origin call', originCallId, 'cache-origin-call-id') : '',
      deterministic ? proofMeta('Implementation', returnedValue(event, 'implementation'), 'implementation') : '',
    ].filter(Boolean).join('');
    return `<article class="orchestration-actor-card ${isNemotron ? 'is-nemotron' : 'is-non-agent'}" data-actor-type="${esc(kind)}" data-actor-id="${esc(actorId)}" data-call-id="${esc(callId)}" data-delegation-id="${esc(delegationId)}" data-output-artifact="${esc(artifacts)}" data-event-status="${esc(status)}">
      ${isNemotron ? `<span class="orchestration-agent-avatar" aria-hidden="true">${esc(actorInitials(actorName))}</span>` : ''}
      <div class="orchestration-actor-copy"><small>${esc(actorKindLabel(kind))}${status ? ` · ${esc(status)}` : ''}</small><strong>${esc(actorName || 'Actor identity not returned')}</strong>${detail ? `<p>${esc(detail)}</p>` : ''}${renderSafeEventMetrics(event)}${missingCallProof ? '<p class="orchestration-proof-warning">Call-bound model, call, delegation, artifact, or accepted-output hash identity was not fully returned.</p>' : ''}</div>
      ${meta ? `<div class="orchestration-actor-meta">${meta}</div>` : ''}
    </article>`;
  }

  function renderHandoffReceipt(event) {
    if (!event) return '';
    const handoffTo = returnedValue(event, 'handoff_to');
    if (!handoffTo) return '';
    const handoffFrom = returnedValue(event, 'handoff_from') || returnedActorName(event);
    const artifacts = eventArtifacts(event).join(', ');
    const outputHash = returnedValue(event, 'output_artifact_hash', 'output_hash', 'artifact_hash');
    return `<article class="orchestration-receipt handoff-receipt" data-receipt-type="handoff" data-handoff-from="${esc(handoffFrom)}" data-handoff-to="${esc(handoffTo)}" data-artifact-id="${esc(artifacts)}" data-artifact-hash="${esc(outputHash)}">
      <span class="receipt-mark" aria-hidden="true">→</span><div><small>Returned handoff${eventState(event) ? ` · ${esc(eventState(event))}` : ''}</small><strong>${esc(handoffFrom || 'Source actor not returned')} → ${esc(handoffTo)}</strong>${artifacts ? `<code>${esc(artifacts)}</code>` : ''}${outputHash ? `<code>${esc(outputHash)}</code>` : ''}</div>
    </article>`;
  }

  function renderGateReceipt(event) {
    if (!event) return '';
    const gateName = returnedValue(event, 'gate_id', 'agent_id', 'validator', 'label');
    const artifact = eventArtifacts(event).join(', ');
    const outcome = eventState(event);
    const gateMark = eventSucceeded(event) ? '✓' : /fail|reject/i.test(outcome) ? '×' : '◇';
    return `<article class="orchestration-receipt gate-receipt" data-receipt-type="gate" data-actor-type="${esc(eventKind(event))}" data-gate-id="${esc(gateName)}" data-gate-outcome="${esc(outcome)}" data-artifact-id="${esc(artifact)}">
      <span class="receipt-mark" aria-hidden="true">${gateMark}</span><div><small>Deterministic gate receipt${outcome ? ` · ${esc(outcome)}` : ''}</small><strong>${esc(gateName || 'Gate identity not returned')}</strong>${artifact ? `<code>${esc(artifact)}</code>` : ''}</div>
    </article>`;
  }

  function renderTeamTrace(events, open = false) {
    const artifacts = [...new Set(events.flatMap(eventArtifacts))];
    const gates = events.filter(eventIsGate);
    const modelCalls = [...new Set(events.map(event => returnedValue(event, 'call_id')).filter(Boolean))];
    const rows = events.map(event => {
      const kind = eventKind(event);
      const name = returnedActorName(event, { preferLabel: kind !== 'nemotron_agent' && kind !== 'legacy_model_event' });
      const artifact = eventArtifacts(event).join(', ');
      const callId = returnedValue(event, 'call_id');
      const delegationId = returnedValue(event, 'delegation_id');
      const outputHash = returnedValue(event, 'output_artifact_hash', 'output_hash', 'artifact_hash');
      const identities = [artifact ? `artifact ${artifact}` : '', outputHash ? `hash ${outputHash}` : '', callId ? `call ${callId}` : '', delegationId ? `delegation ${delegationId}` : ''].filter(Boolean);
      return `<li data-event-id="${esc(returnedValue(event, 'event_id'))}" data-actor-type="${esc(kind)}" data-call-id="${esc(callId)}" data-delegation-id="${esc(delegationId)}"><span>${esc(actorKindLabel(kind))}</span><strong>${esc(name || 'Identity not returned')}</strong>${eventState(event) ? `<em>${esc(eventState(event))}</em>` : ''}${identities.length ? `<code>${identities.map(value => esc(value)).join('<br>')}</code>` : ''}</li>`;
    }).join('');
    return `<details class="orchestration-team-trace" id="teamTrace" ${open ? 'open' : ''}><summary><span>Team Trace</span><strong>${events.length} returned event${events.length === 1 ? '' : 's'} · ${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'} · ${gates.length} gate${gates.length === 1 ? '' : 's'}${modelCalls.length ? ` · ${modelCalls.length} call${modelCalls.length === 1 ? '' : 's'}` : ''}</strong><i aria-hidden="true">⌄</i></summary><ol>${rows}</ol></details>`;
  }

  function renderOrchestrationProof() {
    const proof = $('#orchestrationProof');
    if (!proof || !state.presentedEvents.length) return;
    const events = state.presentedEvents;
    const traceOpen = $('#teamTrace')?.open || false;
    const reversed = [...events].reverse();
    const actorEvent = reversed.find(event => !eventIsGate(event) && event.stage !== 'complete') || null;
    const handoffEvent = reversed.find(event => returnedValue(event, 'handoff_to') && eventSucceeded(event));
    const gateEvent = reversed.find(eventIsGate);
    const graphAccepted = events.some(event => eventArtifacts(event).includes('process_graph') && eventSucceeded(event));
    const runReady = events.some(event => event.stage === 'complete' && eventSucceeded(event));
    const nemotronPlanEvent = reversed.find(event => returnedValue(event, 'agent_id') === 'orchestrator_plan' && eventKind(event) === 'nemotron_agent');
    const topologySetupEvent = reversed.find(event => event.stage === 'orchestrator' || returnedValue(event, 'actor_role') === 'orchestrator');
    const expectsNemotronPlan = currentRun()?.model_mode === 'openrouter_nemotron';
    const label = $('#orchestratorLabel');
    if (label) {
      label.textContent = nemotronPlanEvent
        ? 'Nemotron focus plan · deterministic LangGraph topology'
        : topologySetupEvent
          ? expectsNemotronPlan
            ? 'Deterministic LangGraph setup · awaiting returned focus plan'
            : 'Deterministic reference pipeline'
          : 'Orchestration status';
    }
    proof.hidden = false;
    proof.classList.toggle('is-artifact-dominant', graphAccepted);
    proof.classList.toggle('is-run-ready', runReady);
    proof.dataset.proofActorType = actorEvent ? eventKind(actorEvent) : '';
    proof.innerHTML = `<h2 class="visually-hidden" id="orchestrationProofTitle">Returned agent activity and deterministic proof</h2>${renderActorCard(actorEvent)}<div class="orchestration-receipts">${renderHandoffReceipt(handoffEvent)}${renderGateReceipt(gateEvent)}</div>${renderTeamTrace(events, traceOpen)}<p class="orchestration-boundary">Generated fictional claim · no coverage or legal decision · legal interpretations remain unapproved · simulated review is not expert approval · candidate knowledge remains quarantined pending qualified support, tests, and approval.</p>`;
    document.body.dataset.orchestrationProof = 'true';
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-CasePath-Session': SESSION_ID, ...(options.headers || {}) },
    });
    if (!response.ok) {
      let detail = `${response.status}`;
      try { detail = (await response.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? response.json() : response;
  }

  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2300);
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function mimeLabel(artifact) {
    if (artifact.media_type === 'application/pdf') return `PDF · ${artifact.page_count || 1} page${artifact.page_count === 1 ? '' : 's'}`;
    if (artifact.media_type === 'message/rfc822') return 'Email correspondence';
    if (artifact.media_type?.startsWith('image/')) return 'Photograph';
    return artifact.document_type || artifact.kind || 'Attachment';
  }

  function formatConfidence(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : 'not returned';
  }

  function sourcePage(ref) {
    const numeric = Number(ref?.page);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  function normalizedRegion(ref) {
    const region = ref?.region;
    if (!Array.isArray(region) || region.length !== 4) return null;
    const values = region.map(Number);
    if (!values.every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return null;
    const [x, y, width, height] = values;
    return width > 0 && height > 0 && x + width <= 1 && y + height <= 1 ? values : null;
  }

  function sourceLocatorMarkup(ref, className = 'source-locator') {
    const kind = ref?.locator_kind || '';
    const agent = esc(ref?.agent || 'Agent not returned');
    if (kind === 'text_quote') {
      const page = sourcePage(ref);
      const excerpt = String(ref?.excerpt || '').trim();
      const exactQuote = page !== null && excerpt.length > 0;
      const title = page === null ? 'Text quote · page not returned' : `Text quote · page ${page}`;
      return `<span class="${className} text-quote" data-locator-kind="text_quote" data-source-page="${page ?? ''}" data-source-excerpt="${esc(ref.excerpt || '')}" data-source-agent="${esc(ref.agent || '')}"><span>${esc(title)} · ${agent}</span>${exactQuote ? `<q>${esc(ref.excerpt)}</q>` : '<span class="locator-detail">A complete page-and-passage locator was not returned; no exact quotation is claimed.</span>'}</span>`;
    }
    if (kind === 'visual_observation') {
      const region = normalizedRegion(ref);
      const regionLabel = region ? region.map(value => Number(value).toFixed(2)).join(', ') : 'region not returned';
      return `<span class="${className} visual-observation" data-locator-kind="visual_observation" data-source-region="${esc(region ? JSON.stringify(region) : '')}" data-source-observation="${esc(ref.observation || '')}" data-source-agent="${esc(ref.agent || '')}"><span>Visual observation · region [${esc(regionLabel)}] · ${agent}</span><span class="locator-detail">${esc(ref.observation || 'Observation not returned.')} <em>This is an observation, not an exact quote.</em></span></span>`;
    }
    if (kind === 'metadata_field') {
      return `<span class="${className} metadata-field" data-locator-kind="metadata_field" data-source-field="${esc(ref.field || '')}" data-source-value="${esc(ref.value ?? '')}" data-source-agent="${esc(ref.agent || '')}"><span>Metadata field · ${agent}</span><span class="locator-detail"><strong>${esc(ref.field || 'Field not returned')}:</strong> <code>${esc(ref.value ?? 'Value not returned')}</code></span></span>`;
    }
    return `<span class="${className} unknown-locator" data-locator-kind="${esc(kind)}" data-source-agent="${esc(ref?.agent || '')}"><span>Locator type not returned · ${agent}</span><span class="locator-detail">No exact quote or visual region is claimed.</span></span>`;
  }

  function sourceTitle(artifactId) {
    if (artifactId === 'message') return 'Customer message';
    if (artifactId === 'intake') return 'Intake metadata';
    return findArtifact(artifactId)?.title || artifactId || 'Unknown source';
  }

  function sourceRefButton(fact, ref, nodeId = '') {
    const region = normalizedRegion(ref);
    return `<button class="grounding-ref source-link" type="button" data-source-ref="${esc(ref.artifact_id)}" data-source-locator-kind="${esc(ref.locator_kind || '')}" data-source-page="${sourcePage(ref) ?? ''}" data-source-excerpt="${esc(ref.excerpt || '')}" data-source-region="${esc(region ? JSON.stringify(region) : '')}" data-source-observation="${esc(ref.observation || '')}" data-source-field="${esc(ref.field || '')}" data-source-value="${esc(ref.value ?? '')}" data-source-agent="${esc(ref.agent || '')}" data-fact-id="${esc(fact.fact_id || '')}" data-node-id="${esc(nodeId)}" data-fact-confidence="${esc(fact.confidence ?? '')}" data-fact-state="${esc(fact.state || '')}"><strong class="grounding-source-title">${esc(sourceTitle(ref.artifact_id))}</strong>${sourceLocatorMarkup(ref, 'grounding-locator')}<small>confidence ${formatConfidence(fact.confidence)} · ${esc(fact.state || 'state not returned')}</small></button>`;
  }

  function artifactUrl(artifactId) {
    return `${API}/api/artifacts/${encodeURIComponent(artifactId)}`;
  }

  function pageUrl(artifactId, page) {
    return `${API}/api/artifacts/${encodeURIComponent(artifactId)}/pages/${page}`;
  }

  async function boot() {
    try {
      state.demo = await api('/api/demo');
      state.flagshipClaim = state.demo.claim;
      state.claim = state.flagshipClaim;
      renderClaim(state.claim);
      renderProgress();
      bindGlobalInteractions();
    } catch (error) {
      $('#startState').innerHTML = `<div class="start-copy"><span class="quiet-label">CasePath could not open</span><h2>The claim workspace is unavailable.</h2><p>${esc(error.message)}</p></div><button class="primary-button" type="button" onclick="location.reload()">Retry</button>`;
    }
  }

  function renderClaim(claim) {
    if (!claim) return;
    $('#headerClaimTitle').textContent = claim.subject;
    $('#headerClaimId').textContent = `${claim.claim_id} · ${claim.language?.toUpperCase() || 'EN'} · received ${formatDate(claim.received_at)}`;
    $('#customerEmail').innerHTML = `
      <header class="email-head">
        <h2 class="email-subject">${esc(claim.subject)}</h2>
        <div class="email-meta">
          <strong>From</strong><span>${esc(claim.customer?.name || 'Customer')}</span>
          <strong>Address</strong><span>${esc(claim.customer?.address || '')}</span>
          <strong>Policy</strong><span>${esc(claim.customer?.policy || '')}</span>
          <strong>Received</strong><span>${esc(formatDate(claim.received_at))}</span>
        </div>
      </header>
      <div class="email-body">${esc(claim.message || '')}</div>`;
    $('#customerEmail').setAttribute('aria-busy', 'false');
    const artifacts = claim.artifacts || [];
    $('#attachmentCount').textContent = `${artifacts.length} files`;
    $('#attachmentList').innerHTML = artifacts.map(artifact => {
      let thumb = `<span>${artifact.media_type === 'application/pdf' ? 'PDF' : artifact.media_type === 'message/rfc822' ? 'EML' : 'IMG'}</span>`;
      if (artifact.media_type === 'application/pdf') thumb = `<img src="${pageUrl(artifact.artifact_id, 1)}" alt="">`;
      if (artifact.media_type?.startsWith('image/')) thumb = `<img src="${artifactUrl(artifact.artifact_id)}" alt="">`;
      return `
        <button class="attachment-row" type="button" data-artifact-id="${esc(artifact.artifact_id)}">
          <span class="attachment-thumb">${thumb}</span>
          <span><span class="attachment-title">${esc(artifact.title)}</span><span class="attachment-meta">${esc(artifact.filename)} · ${esc(mimeLabel(artifact))}</span></span>
          <span class="attachment-open">Open</span>
        </button>`;
    }).join('');
  }

  function renderProgress(activeId = null) {
    const run = currentRun();
    const completed = new Set((run?.events || []).filter(event => event.status === 'completed').map(event => event.stage));
    $('#agentProgress').innerHTML = STAGES.map((stage, index) => {
      const isComplete = completed.has(stage.id);
      const isActive = stage.id === activeId && !isComplete;
      return `<span class="agent-step ${isComplete ? 'complete' : isActive ? 'active' : ''}" data-progress-stage="${stage.id}"><span class="agent-step-dot">${isComplete ? '✓' : index + 1}</span>${esc(stage.short)}</span>`;
    }).join('');
  }

  function currentRun() {
    return state.journey === 'later' ? state.laterRun : state.run;
  }

  function setOrchestrator(status, done = false) {
    $('#orchestratorStatus').textContent = status;
    $('#liveChip').textContent = done ? 'Ready' : 'Live';
    $('#liveChip').classList.toggle('done', done);
  }

  async function startFlagshipRun() {
    if (state.polling || state.journey !== 'start') return;
    const button = $('#runCasePath');
    button.disabled = true;
    button.querySelector('span').textContent = 'Opening the claim context…';
    try {
      if (!params.has('preserve')) await api('/api/demo/reset', { method: 'POST' });
      state.demo = await api('/api/demo');
      state.flagshipClaim = state.demo.claim;
      state.claim = state.flagshipClaim;
      renderClaim(state.claim);
      const created = await api('/api/runs', { method: 'POST', body: JSON.stringify({ claim_id: state.demo.demo_claim_id }) });
      state.runId = created.run_id;
      document.body.dataset.casepathActiveRunId = created.run_id;
      state.journey = 'live';
      state.eventQueue = [];
      state.queuedEventIds.clear();
      state.presentedEvents = [];
      state.runComplete = false;
      $('#startState').hidden = true;
      $('#liveWorkspace').hidden = false;
      $('#openAudit').disabled = false;
      $('#journeyActions').hidden = true;
      setOrchestrator('Opening one shared claim context');
      renderProgress();
      state.polling = true;
      pollRun(state.runId, false);
    } catch (error) {
      button.disabled = false;
      button.querySelector('span').textContent = 'Watch CasePath handle this claim';
      toast(`Could not start: ${error.message}`);
    }
  }

  async function pollRun(runId, later) {
    try {
      const run = await api(`/api/runs/${encodeURIComponent(runId)}`);
      if (later) {
        state.laterRun = run;
      } else {
        state.run = run;
        state.flagshipRun = run;
      }
      enqueueNewEvents(run, later);
      if (!state.presenting) presentQueuedEvents(later);
      if (run.status === 'failed') throw new Error(run.error || 'The run stopped safely.');
      if (run.status === 'complete') {
        if (!later) state.runComplete = true;
        if (later) state.laterRunComplete = true;
      } else {
        setTimeout(() => pollRun(runId, later), 250);
      }
    } catch (error) {
      state.polling = false;
      renderFailure(error.message);
    }
  }

  function enqueueNewEvents(run, later) {
    for (const event of run.events || []) {
      const key = `${later ? 'later' : 'flagship'}:${event.event_id || event.ordinal}`;
      if (state.queuedEventIds.has(key)) continue;
      state.queuedEventIds.add(key);
      state.eventQueue.push({ event, later, key });
    }
  }

  async function presentQueuedEvents(later) {
    if (state.presenting) return;
    state.presenting = true;
    while (state.eventQueue.length) {
      const entry = state.eventQueue.shift();
      if (entry.later !== later) {
        state.eventQueue.push(entry);
        break;
      }
      if (later) {
        appendLaterEvent(entry.event);
      } else {
        presentFlagshipEvent(entry.event);
      }
      await wait(entry.event.status === 'completed' ? PACE * 1.35 : PACE);
    }
    state.presenting = false;
    const run = later ? state.laterRun : state.run;
    if (run?.status === 'complete' && !state.eventQueue.some(entry => entry.later === later)) {
      if (later) finishLaterRun();
      else finishFlagshipRun();
    }
  }

  function presentFlagshipEvent(event) {
    rememberPresentedEvent(event);
    renderOrchestrationProof();
    if (event.stage === 'orchestrator') {
      setOrchestrator(event.headline || event.label);
      renderOpeningContext(event);
      return;
    }
    if (event.stage === 'complete') {
      setOrchestrator(returnedValue(event, 'headline', 'label') || 'Final run event returned', false);
      return;
    }
    const stage = STAGES.find(item => item.id === event.stage);
    if (!stage) return;
    const status = eventState(event).toLowerCase();
    const started = ['started', 'running', 'in_progress'].includes(status);
    if (!started && !eventSucceeded(event)) return;
    state.activeStage = stage.id;
    state.stageMode = stage.id;
    const actor = returnedActorName(event);
    const update = returnedValue(event, 'headline', 'detail', 'question', 'label');
    setOrchestrator([actor, update].filter(Boolean).join(': ') || 'Returned run event received');
    renderProgress(stage.id);
    if (started) renderStageStarted(stage, event);
    else renderStageCompleted(stage, event);
  }

  function stageHeader(stage, title, intro) {
    return `<div class="stage-kicker"><span class="agent-avatar">${esc(stage.short.slice(0, 2).toUpperCase())}</span><span><strong>${esc(stage.label)}</strong> · ${esc(stage.job)}</span></div><h2 class="stage-title">${esc(title)}</h2><p class="stage-intro">${esc(intro)}</p>`;
  }

  function renderOpeningContext(event) {
    const kind = eventKind(event);
    const expectsNemotronPlan = currentRun()?.model_mode === 'openrouter_nemotron';
    const orchestrationBoundary = kind === 'nemotron_agent'
      ? 'A call-bound Nemotron orchestration event was returned for this shared context.'
      : kind === 'deterministic_tool' && expectsNemotronPlan
        ? 'Application code opened the shared context; no model call is claimed for this setup step. The call-bound Nemotron plan appears only when its returned event arrives.'
        : 'This run returned legacy deterministic reference orchestration; no Nemotron orchestrator is claimed.';
    renderCanvas(`<div class="stage-shell">${stageHeader({ label: 'Orchestrator', short: 'CP', job: 'One shared claim context' }, 'CasePath has opened the claim.', event.detail || '')}<div class="live-question"><small>Orchestration boundary</small><strong>${esc(orchestrationBoundary)}</strong></div></div>`, 'opening');
  }

  function renderStageStarted(stage, event) {
    let title = event.headline || stage.job;
    let intro = event.detail || stage.job;
    if (stage.id === 'process') title = 'CasePath is building the handling process.';
    if (stage.id === 'evidence') title = 'CasePath is attaching evidence needs to the process.';
    if (stage.id === 'experience') title = 'CasePath is asking organizational memory for help.';
    renderCanvas(`<div class="stage-shell">${stageHeader(stage, title, intro)}<div class="live-question"><small>Question being answered</small><strong>${esc(event.question || stage.job)}</strong></div></div>`, stage.id);
  }

  function renderStageCompleted(stage, event) {
    if (stage.id === 'read') return renderReadStage(stage, event);
    if (stage.id === 'understand') return renderUnderstandStage(stage, event);
    if (stage.id === 'research') return renderLawStage(stage, event);
    if (stage.id === 'process') return renderProcessStage(stage, event, { evidence: false, precedents: false });
    if (stage.id === 'evidence') return renderProcessStage(stage, event, { evidence: true, precedents: false });
    if (stage.id === 'experience') return renderProcessStage(stage, event, { evidence: true, precedents: true });
    if (stage.id === 'verify') return renderVerifyStage(stage, event);
  }

  function renderReadStage(stage, event) {
    const parsed = state.run?.parsed_submission || {};
    const rows = (parsed.files || []).map(file => `<div class="event-row"><span class="event-mark">✓</span><div><strong>${esc(file.title)}</strong><p>${esc(file.read_detail)}</p></div></div>`).join('');
    renderCanvas(`<div class="stage-shell">${stageHeader(stage, 'The original submission is in the shared claim context.', event.detail || '')}<div class="event-list"><div class="event-row"><span class="event-mark">✓</span><div><strong>Customer message</strong><p>${parsed.message_chars || 0} characters preserved as submitted.</p></div></div>${rows}</div></div>`, 'read');
    $$('.attachment-row').forEach(row => row.classList.add('is-active'));
    setTimeout(() => $$('.attachment-row').forEach(row => row.classList.remove('is-active')), PACE * 2.2);
  }

  function renderUnderstandStage(stage, event) {
    const understanding = state.run?.result || state.run?.understanding || {};
    const facts = understanding.facts || [];
    renderCanvas(`<div class="stage-shell">${stageHeader(stage, 'CasePath has separated what is known from what is still open.', event.detail || '')}<div class="fact-stream">${facts.map(fact => {
      const refs = fact.source_refs || [];
      return `<article class="fact-row ${esc(fact.state)}" data-fact-id="${esc(fact.fact_id)}"><span class="fact-state"></span><div><strong>${esc(fact.label)} — ${esc(fact.value)}</strong><p>${esc(fact.explanation)}</p><small>${esc(fact.state || 'unclassified')} · confidence ${formatConfidence(fact.confidence)}</small>${refs.length ? `<div class="fact-source-list">${refs.map(ref => sourceRefButton(fact, ref)).join('')}</div>` : '<p class="grounding-warning">No source reference returned.</p>'}</div></article>`;
    }).join('')}</div></div>`, 'understand');
    bindSourceLinks($('#stageCanvas'));
  }

  function renderLawStage(stage, event) {
    const legal = state.run?.result?.legal_research || state.run?.legal_research || {};
    renderCanvas(`<div class="stage-shell">${stageHeader(stage, 'Swiss law has become handling questions.', 'CasePath keeps a legal source only when it creates or constrains a decision in the process.')}<div class="law-flow">${(legal.questions || []).map((question, index) => `<div class="law-query"><span class="law-number">${index + 1}</span><div><strong>${esc(question)}</strong><p>${esc((legal.handling_principles || [])[index]?.role || (legal.sources || [])[index]?.role || 'This question will shape the process graph.')}</p></div><span class="law-source-count">${index < (legal.sources || []).length ? 'Official source' : 'Model interpretation · unapproved handling proposal'}</span></div>`).join('')}</div></div>`, 'research');
  }

  function processData() {
    const run = currentRun();
    return run?.result?.process || run?.process || null;
  }

  function checklistData() {
    const run = currentRun();
    return run?.result?.checklist || run?.checklist || null;
  }

  function understandingData() {
    const run = currentRun();
    return run?.result || run?.understanding || null;
  }

  function legalData() {
    const run = currentRun();
    return run?.result?.legal_research || run?.legal_research || null;
  }

  function nodeById(nodeId) {
    return processData()?.nodes?.find(node => node.node_id === nodeId) || null;
  }

  function owningNodeForFact(factId) {
    if (!factId) return null;
    const process = processData();
    const direct = (process?.nodes || []).find(node => (node.fact_ids || []).includes(factId));
    if (direct) return direct;
    const item = (checklistData()?.items || []).find(entry => entry.fact_id === factId && entry.node_id);
    return item ? nodeById(item.node_id) : null;
  }

  function edgeStateLabel(stateValue) {
    return ({ selected: 'current path', possible: 'available branch', inactive: 'inactive branch', loop: 'evidence loop', blocked: 'blocked', future: 'later path' })[stateValue] || stateValue || 'connected';
  }

  function precedentProvenance(precedent) {
    if (precedent?.review_status === 'expert_reviewed_memory' && precedent?.memory_id) return 'Qualified-review case memory returned by the server';
    if (precedent?.review_status === 'unverified_demo_memory' && precedent?.memory_id) return 'Unverified generated-demo review memory returned by the server';
    const review = precedent?.review_status ? ` · ${precedent.review_status.replaceAll('_', ' ')}` : '';
    return `Generated reference precedent${review}`;
  }

  function legalProvenance(source) {
    if (source?.url) return { kind: 'official', label: 'Official source' };
    return { kind: 'interpretation', label: 'Model interpretation · unapproved handling proposal' };
  }

  function nodeState(nodeId) {
    const process = processData();
    const overlay = process?.current_overlay || currentRun()?.result?.current_overlay || {};
    if (nodeId === overlay.current_node_id || nodeId === process?.current_node) return 'current';
    if ((overlay.completed_node_ids || []).includes(nodeId)) return 'complete';
    if ((overlay.blocked_node_ids || []).includes(nodeId)) return 'blocked';
    return 'future';
  }

  function evidenceForNode(nodeId) {
    return (checklistData()?.items || []).filter(item => item.node_id === nodeId);
  }

  function factsForNode(node) {
    const ids = new Set(node?.fact_ids || []);
    for (const item of evidenceForNode(node?.node_id)) if (item.fact_id) ids.add(item.fact_id);
    return (understandingData()?.facts || []).filter(fact => ids.has(fact.fact_id));
  }

  function legalForNode(node) {
    const legal = legalData() || {};
    const all = [...(legal.sources || []), ...(legal.handling_principles || [])];
    const ids = new Set(node?.legal_source_ids || []);
    return all.filter(source => ids.has(source.source_id));
  }

  function statusLabel(status) {
    return ({
      provided_sufficient: 'Available',
      provided_insufficient: 'Insufficient',
      missing: 'Missing',
      conditional: 'Conditional',
      not_applicable: 'Not needed on this path',
    })[status] || status?.replaceAll('_', ' ') || '';
  }

  function renderProcessStage(stage, event, options) {
    state.stageMode = options.precedents ? 'experience' : options.evidence ? 'evidence' : 'process';
    const title = options.precedents ? 'Previous cases are helping with the difficult decision.' : options.evidence ? 'Evidence now follows directly from the process.' : 'The complete handling process is taking shape.';
    const intro = options.precedents ? 'CasePath searched reference precedents with the same branch, unresolved fact, and evidence need. Each result carries its provenance and review state.' : options.evidence ? 'Each process node now carries the facts and evidence it needs. The checklist is only an aggregate of these links.' : 'The main handling spine is visible first. The current claim is overlaid inside it, and alternative branches stay folded until they matter.';
    renderCanvas(`<div class="stage-shell">${stageHeader(stage, title, intro)}${renderProcessWorkspace(options)}</div>`, state.stageMode);
    bindProcessInteractions();
  }

  function renderProcessWorkspace({ evidence = false, precedents = false } = {}) {
    const process = processData();
    if (!process) return '<p>Process artifact is not ready.</p>';
    const spine = (process.main_spine || []).map(nodeById).filter(Boolean);
    const spineIds = new Set(spine.map(node => node.node_id));
    const branchNodes = (process.nodes || []).filter(node => !spineIds.has(node.node_id));
    if (!state.selectedNodeId || !nodeById(state.selectedNodeId)) state.selectedNodeId = process.current_node || 'causation';
    return `<div class="process-layout"><div class="process-map"><div class="process-spine">${spine.map((node, index) => {
      const status = nodeState(node.node_id);
      const count = evidenceForNode(node.node_id).length;
      return `<div class="process-node ${status}" style="animation-delay:${index * 55}ms"><span class="process-marker">${status === 'complete' ? '✓' : status === 'current' ? '?' : index + 1}</span><button class="process-node-button" type="button" data-node-id="${esc(node.node_id)}"><span><small>${status === 'current' ? 'Current decision' : status === 'complete' ? 'Established' : status === 'blocked' ? 'Waits for earlier answer' : 'Later stage'}</small><strong>${esc(node.title)}</strong><span class="node-answer">${esc(node.answer || node.question)}</span></span>${evidence && count ? `<span class="node-evidence-count">${count} evidence link${count === 1 ? '' : 's'}</span>` : ''}</button>${node.node_id === (process.current_node || 'causation') ? renderBranches(node) : ''}</div>`;
    }).join('')}</div>${renderBranchExplorer(branchNodes, process.edges || [], evidence)}</div>${renderInspector(state.selectedNodeId, { evidence, precedents })}</div>`;
  }

  function renderBranches(node) {
    if (!node.branches?.length) return '';
    return `<div class="branch-fork"><button type="button" data-toggle-node-branches aria-expanded="false"><span>${node.branches.length} possible causation outcomes</span><strong>Reveal outcomes</strong></button><div class="branch-options" hidden>${node.branches.map(branch => `<button type="button" class="branch-option ${branch.state === 'selected' ? 'selected' : ''}" data-node-id="${esc(branch.target)}"><strong>${esc(branch.label)}</strong><p>${esc(branch.condition)}</p><small>${esc(edgeStateLabel(branch.state))} · opens ${esc(branch.target)}</small></button>`).join('')}</div></div>`;
  }

  function renderBranchExplorer(nodes, edges, evidence) {
    if (!nodes.length && !edges.length) return '';
    const nodeExplorer = nodes.length ? `<button class="branch-explorer-toggle" type="button" data-toggle-all-branches aria-expanded="${state.branchesExpanded}" aria-controls="processBranchGrid"><span><small>Branches and evidence loops</small><strong id="processBranchesTitle">Explore ${nodes.length} connected decisions</strong></span><span>${state.branchesExpanded ? 'Collapse' : 'Expand'}</span></button><div class="process-branch-grid" id="processBranchGrid" ${state.branchesExpanded ? '' : 'hidden'}>${nodes.map(node => {
      const incoming = edges.filter(edge => edge.target === node.node_id);
      const outgoing = edges.filter(edge => edge.source === node.node_id);
      const count = evidenceForNode(node.node_id).length;
      return `<button type="button" class="process-branch-node ${esc(node.state || nodeState(node.node_id))}" data-node-id="${esc(node.node_id)}"><span class="branch-node-meta">${esc(node.kind || 'decision')} · ${esc(node.state || 'available')}</span><strong>${esc(node.title)}</strong><p>${esc(node.answer || node.question)}</p><small>Active when: ${esc(node.activation || 'connected path')}</small>${evidence && count ? `<span class="node-evidence-count">${count} evidence link${count === 1 ? '' : 's'}</span>` : ''}<span class="branch-edge-summary">${incoming.map(edge => `${edge.source} → ${edgeStateLabel(edge.state)}`).concat(outgoing.map(edge => `${edgeStateLabel(edge.state)} → ${edge.target}`)).map(label => `<i>${esc(label)}</i>`).join('')}</span></button>`;
    }).join('')}</div>` : '<h3 id="processBranchesTitle" class="visually-hidden">Process connections</h3>';
    const edgeLedger = edges.length ? `<details class="process-edge-ledger"><summary>All ${edges.length} graph connections</summary><div>${edges.map(edge => `<button type="button" class="process-edge" data-node-id="${esc(edge.target)}" data-edge-source="${esc(edge.source)}" data-edge-target="${esc(edge.target)}" data-edge-state="${esc(edge.state || '')}"><strong>${esc(edge.source)} → ${esc(edge.target)}</strong><span>${esc(edge.condition || edge.label || edgeStateLabel(edge.state))}</span><small>${esc(edgeStateLabel(edge.state))} · inspect destination decision</small></button>`).join('')}</div></details>` : '';
    return `<section class="process-branches" aria-labelledby="processBranchesTitle">${nodeExplorer}${edgeLedger}</section>`;
  }

  function renderInspector(nodeId, { evidence = false, precedents = false } = {}) {
    const node = nodeById(nodeId) || nodeById(processData()?.current_node);
    if (!node) return '<aside class="decision-inspector"></aside>';
    const facts = factsForNode(node);
    const items = evidenceForNode(node.node_id);
    const laws = legalForNode(node);
    const run = currentRun();
    const previous = run?.result?.precedents || run?.precedents || [];
    return `<aside class="decision-inspector" data-inspector-node="${esc(node.node_id)}" tabindex="-1"><div class="inspector-label"><span>${esc(node.kind === 'outcome' ? 'Outcome' : node.kind === 'action' ? 'Action' : 'Process decision')} · ${esc(node.node_id)}</span><span>${esc(nodeState(node.node_id) === 'current' ? 'Current claim' : '')}</span></div><h3>${esc(node.question)}</h3><p>${esc(node.why || node.answer || '')}</p>
      ${facts.length ? `<section class="inspector-section"><h4>What this decision knows</h4>${facts.map(fact => `<article class="inspector-fact ${fact.state === 'unknown' || fact.state === 'conflicting' ? 'conditional' : ''}" data-fact-id="${esc(fact.fact_id)}" data-node-id="${esc(node.node_id)}"><header><strong>${esc(fact.label)}:</strong> ${esc(fact.value)}</header><p>${esc(fact.explanation)}</p><small>${esc(fact.fact_id)} · ${esc(fact.state || 'unclassified')} · confidence ${formatConfidence(fact.confidence)}</small>${(fact.source_refs || []).length ? `<div class="fact-source-list">${fact.source_refs.map(ref => sourceRefButton(fact, ref, node.node_id)).join('')}</div>` : '<p class="grounding-warning">No source reference returned.</p>'}</article>`).join('')}</section>` : ''}
      ${evidence ? `<section class="inspector-section"><h4>What this decision requires</h4>${items.length ? items.map(item => `<article class="inspector-row ${item.status === 'missing' ? 'missing' : item.status === 'conditional' || item.status === 'provided_insufficient' ? 'conditional' : ''}" data-item-id="${esc(item.item_id)}" data-node-id="${esc(item.node_id)}" data-fact-id="${esc(item.fact_id)}"><i></i><span><strong>${esc(item.title)} — ${esc(statusLabel(item.status))}</strong><br>${esc(item.why)}<br><small>${esc(item.item_id)} · fact ${esc(item.fact_id)}</small>${item.applies_when && item.status === 'conditional' ? `<br><em>Only if: ${esc(item.applies_when)}</em>` : ''}${(item.artifact_ids || []).map(artifactId => ` <button class="source-link evidence-artifact-link" type="button" data-source-ref="${esc(artifactId)}" data-fact-id="${esc(item.fact_id)}" data-node-id="${esc(item.node_id)}">Open ${esc(sourceTitle(artifactId))}</button>`).join('')}</span></article>`).join('') : '<div class="inspector-row"><i></i><span>No separate evidence requirement is linked to this decision.</span></div>'}</section>` : ''}
      ${laws.length ? `<section class="inspector-section"><h4>Why this step exists</h4>${laws.map(source => { const provenance = legalProvenance(source); return `<button class="law-marker ${provenance.kind}" type="button" data-law-id="${esc(source.source_id)}"><small>${esc(provenance.label)}</small>§ ${esc(source.title)}</button><div class="law-detail" data-law-detail="${esc(source.source_id)}" hidden><p>${esc(source.role)}</p><p><strong>Review state:</strong> ${esc(source.validation_status || legalData()?.review_status || (source.url ? 'Official source; handling interpretation remains reviewable' : 'Unapproved handling proposal'))}</p>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">Open official source</a>` : ''}</div>`; }).join('')}</section>` : ''}
      ${precedents && previous.length ? `<section class="precedent-inline"><header><h4>Previous cases that help</h4><span>${previous.length} returned</span></header>${previous.map((item, index) => `<button class="precedent-mini" type="button" data-precedent-index="${index}"><small>${esc(precedentProvenance(item))}</small><strong>${esc(item.claim_id)} · ${esc(item.title)}</strong><p>${esc(item.why_useful)}</p></button>`).join('')}</section>` : ''}
    </aside>`;
  }

  function bindProcessInteractions() {
    $$('.process-node-button[data-node-id],.process-branch-node[data-node-id],.branch-option[data-node-id],.process-edge[data-node-id]').forEach(button => button.addEventListener('click', () => {
      state.selectedNodeId = button.dataset.nodeId;
      const options = { evidence: state.stageMode !== 'process', precedents: state.stageMode === 'experience' };
      const layout = $('.process-layout');
      if (layout) layout.outerHTML = renderProcessWorkspace(options);
      bindProcessInteractions();
      announceRender($('#stageCanvas')?.dataset.casepathMoment || state.stageMode);
      requestAnimationFrame(() => $(`.decision-inspector[data-inspector-node="${CSS.escape(state.selectedNodeId)}"]`)?.focus?.());
    }));
    $$('[data-toggle-node-branches]').forEach(button => button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      button.querySelector('strong').textContent = expanded ? 'Reveal outcomes' : 'Hide outcomes';
      button.nextElementSibling.hidden = expanded;
    }));
    $$('[data-toggle-all-branches]').forEach(button => button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      state.branchesExpanded = !expanded;
      button.setAttribute('aria-expanded', String(!expanded));
      button.lastElementChild.textContent = expanded ? 'Expand' : 'Collapse';
      const grid = $(`#${CSS.escape(button.getAttribute('aria-controls'))}`);
      if (grid) grid.hidden = expanded;
    }));
    $$('[data-law-id]').forEach(button => button.addEventListener('click', () => {
      const detail = $(`[data-law-detail="${CSS.escape(button.dataset.lawId)}"]`);
      if (detail) detail.hidden = !detail.hidden;
    }));
    $$('[data-precedent-index]').forEach(button => button.addEventListener('click', () => openPrecedent(Number(button.dataset.precedentIndex))));
    bindSourceLinks();
  }

  function renderVerifyStage(stage, event) {
    const verification = state.run?.result?.verification || state.run?.verification || {};
    const checks = verification.checks || verification.accepted_checks || [];
    const rejected = verification.rejected_proposals || [];
    renderCanvas(`<div class="stage-shell">${stageHeader(stage, 'The playbook passed its acceptance checks.', 'The verifier checks the complete graph and every process-to-evidence link before the result reaches a reviewer.')}<div class="process-synthesis"><section class="synthesis-primary"><h3>The process remains the map of the claim.</h3><p>CasePath preserved the supported path, kept unresolved causation open, and blocked responsibility and remedy until competent evidence arrives.</p>${renderProcessWorkspace({ evidence: true, precedents: true })}</section><section><span class="quiet-label">Verification</span><div class="verification-list">${checks.map(check => `<div class="verification-row"><span>✓</span><div>${esc(typeof check === 'string' ? check : check.label || check.name || JSON.stringify(check))}</div></div>`).join('')}${rejected.map(item => `<div class="verification-row rejected"><span>×</span><div>${esc(item.reason || item.title || item)}</div></div>`).join('')}</div></section></div></div>`, 'verify');
    bindProcessInteractions();
  }

  function finishFlagshipRun() {
    if (state.journey !== 'live' || !state.runComplete || state.presenting) return;
    state.polling = false;
    state.journey = 'ready';
    state.flagshipRun = state.run;
    setOrchestrator('The handling playbook is ready for a simulated demo review', true);
    renderProgress();
    renderReadyMoment();
  }

  function renderReadyMoment() {
    const result = state.run.result;
    const verification = result.verification || {};
    const accepted = verification.checks || verification.accepted_checks || [];
    renderCanvas(`<div class="stage-shell"><div class="process-synthesis"><section class="synthesis-primary"><span class="quiet-label">Handling playbook ready</span><h3>CasePath has reconstructed how this claim should be handled.</h3><p>The full process stays visible. The current claim sits at causation, and the evidence needed for that decision is attached directly to the graph.</p>${renderProcessWorkspace({ evidence: true, precedents: true })}</section><section><span class="quiet-label">What was constructed</span><div class="artifact-summary"><div class="artifact-row"><span class="artifact-icon">P</span><div><strong>Handling process</strong><p>From claim intake through responsibility, remedy, escalation, and closure.</p></div><span>Ready</span></div><div class="artifact-row"><span class="artifact-icon">E</span><div><strong>Evidence across the process</strong><p>Every requirement retains the decision, fact, reason, and current status.</p></div><span>Ready</span></div><div class="artifact-row"><span class="artifact-icon">H</span><div><strong>Previous cases that help</strong><p>Returned references retain generated, qualified-review, or unverified-demo provenance.</p></div><span>Ready</span></div></div><span class="quiet-label" style="margin-top:22px">Acceptance checks</span><div class="verification-list">${accepted.slice(0, 5).map(check => `<div class="verification-row"><span>✓</span><div>${esc(typeof check === 'string' ? check : check.label || check.name || JSON.stringify(check))}</div></div>`).join('')}</div></section></div></div>`, 'ready');
    bindProcessInteractions();
    showJourneyActions({ back: false, next: 'Review the proposed playbook' });
  }

  function showJourneyActions({ back = true, next = 'Continue' } = {}) {
    $('#journeyActions').hidden = false;
    $('#journeyBack').hidden = !back;
    $('#journeyNext span').textContent = next;
  }

  function hideJourneyActions() {
    $('#journeyActions').hidden = true;
  }

  function showReview() {
    state.journey = 'review';
    hideJourneyActions();
    setOrchestrator('Simulated demo review: testing one correction', true);
    state.selectedNodeId = 'causation';
    renderCanvas(`<div class="stage-shell"><div class="stage-kicker"><span class="agent-avatar">DR</span><span><strong>Simulated demo review</strong> · unverified reviewer workflow</span></div><h2 class="stage-title">Review the decision that controls the rest of the process.</h2><p class="stage-intro">This generated demo uses an unverified reviewer choice. It shows how one evidence-order correction propagates; it is not qualified expert approval.</p><div class="review-layout"><div class="review-graph">${renderProcessWorkspace({ evidence: true, precedents: false })}</div><form class="review-panel" id="reviewForm"><span class="quiet-label">Proposed demo correction</span><h3>How should broader building testing be sequenced?</h3><p>CasePath proposes one neutral inspection first. Broader building-envelope testing should remain conditional unless the first assessment cannot establish the cause.</p><label class="review-choice"><input type="radio" name="building_envelope_mode" value="conditional" checked><strong>Neutral assessment first</strong><p>Keep building-envelope testing conditional. Add an explicit step to test the ventilation allegation only when competent evidence makes it relevant.</p></label><label class="review-choice"><input type="radio" name="building_envelope_mode" value="required_now"><strong>Request broader testing now</strong><p>Keep the existing immediate building-envelope request.</p></label><div class="review-impact" id="reviewImpact"></div><textarea class="review-note" name="justification" placeholder="Optional simulated-review reason">Keep causation unresolved. Use one neutral inspection first, then test the ventilation allegation or building envelope only when the first assessment supports that branch.</textarea><button class="primary-button review-submit" type="submit"><span>Apply demo correction</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form></div></div>`, 'review');
    bindProcessInteractions();
    renderReviewImpact('conditional');
    $$('input[name="building_envelope_mode"]').forEach(input => input.addEventListener('change', () => renderReviewImpact(input.value)));
    $('#reviewForm').addEventListener('submit', submitReview);
  }

  function renderReviewImpact(mode) {
    const recommended = mode === 'conditional';
    $('#reviewImpact').innerHTML = `<div class="review-impact-row"><small>Process</small><strong>${recommended ? 'Add “Test the ventilation allegation” after the neutral assessment.' : 'No new process decision.'}</strong></div><div class="review-impact-row"><small>Evidence</small><strong>${recommended ? 'Building-envelope testing becomes conditional; use evidence moves to the new branch.' : 'Broad building-envelope testing remains immediately missing.'}</strong></div><div class="review-impact-row"><small>Next action</small><strong>${recommended ? 'Arrange one competent neutral assessment first.' : 'Request neutral and broader testing together.'}</strong></div>`;
  }

  function snapshot(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  async function awaitCompletedRun(runId) {
    while (true) {
      const run = await api(`/api/runs/${encodeURIComponent(runId)}`);
      if (run.status === 'complete') return run;
      if (run.status === 'failed') throw new Error(run.error || 'Comparison run failed.');
      await wait(250);
    }
  }

  async function ensureBaselineLaterRun() {
    if (state.baselineLaterRun?.status === 'complete') return state.baselineLaterRun;
    const created = await api('/api/runs', { method: 'POST', body: JSON.stringify({ claim_id: state.demo.later_claim_id, knowledge_mode: 'baseline' }) });
    state.baselineLaterRun = await awaitCompletedRun(created.run_id);
    return state.baselineLaterRun;
  }

  function computedReviewDelta(beforeResult, afterResult) {
    const beforeNodes = new Map((beforeResult?.process?.nodes || []).map(node => [node.node_id, node]));
    const afterNodes = new Map((afterResult?.process?.nodes || []).map(node => [node.node_id, node]));
    const beforeItems = new Map((beforeResult?.checklist?.items || []).map(item => [item.item_id, item]));
    const afterItems = new Map((afterResult?.checklist?.items || []).map(item => [item.item_id, item]));
    const edgeKey = edge => `${edge.source}\u0000${edge.target}\u0000${edge.branch_id || edge.label || ''}`;
    const beforeEdges = new Map((beforeResult?.process?.edges || []).map(edge => [edgeKey(edge), edge]));
    const afterEdges = new Map((afterResult?.process?.edges || []).map(edge => [edgeKey(edge), edge]));
    const nodesAdded = [...afterNodes.keys()].filter(id => !beforeNodes.has(id));
    const nodesRemoved = [...beforeNodes.keys()].filter(id => !afterNodes.has(id));
    const nodesChanged = [...afterNodes.entries()].filter(([id, node]) => beforeNodes.has(id) && JSON.stringify(beforeNodes.get(id)) !== JSON.stringify(node)).map(([id]) => id);
    const edgesAdded = [...afterEdges.keys()].filter(key => !beforeEdges.has(key));
    const edgesRemoved = [...beforeEdges.keys()].filter(key => !afterEdges.has(key));
    const edgesChanged = [...afterEdges.entries()].filter(([key, edge]) => beforeEdges.has(key) && JSON.stringify(beforeEdges.get(key)) !== JSON.stringify(edge)).map(([key]) => key.replaceAll('\u0000', ' → '));
    const evidenceChanged = [...afterItems.values()].filter(item => {
      const prior = beforeItems.get(item.item_id);
      return !prior || JSON.stringify(prior) !== JSON.stringify(item);
    });
    return { nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved, edgesChanged, evidenceChanged };
  }

  function renderReviewedChecklist(items) {
    return `<details class="reviewed-checklist" open><summary>Server-returned demo-corrected checklist · ${items.length} items</summary><div>${items.map(item => `<article data-item-id="${esc(item.item_id)}" data-node-id="${esc(item.node_id)}" data-fact-id="${esc(item.fact_id)}"><header><strong>${esc(item.title)}</strong><span>${esc(statusLabel(item.status))}</span></header><p>${esc(item.why)}</p><small>${esc(item.item_id)} · decision ${esc(item.node_id)} · fact ${esc(item.fact_id)}</small></article>`).join('')}</div></details>`;
  }

  function showReviewApplied() {
    state.journey = 'review-applied';
    state.stageMode = 'experience';
    const result = state.review?.result || state.run?.result || {};
    const delta = computedReviewDelta(state.reviewBefore, result);
    const reviewer = state.review?.reviewer || {};
    renderCanvas(`<div class="stage-shell review-applied"><header class="review-applied-heading"><span class="quiet-label">Server-confirmed simulated-review result</span><h2>The demo-corrected graph and checklist are now visible.</h2><p>This is the result returned after the simulated review—not a preview or qualified approval. The reviewer is recorded as ${esc(reviewer.type || 'type not returned')} with qualification ${esc(reviewer.qualification_status || 'not returned')}. This outcome is unverified, and the model acceptance from the pre-review result is not reused.</p></header><div class="review-applied-delta"><article><small>Process nodes added</small><strong>${delta.nodesAdded.length}</strong><p>${delta.nodesAdded.length ? delta.nodesAdded.map(id => esc(id)).join(', ') : 'None'}</p></article><article><small>Process nodes removed / changed</small><strong>${delta.nodesRemoved.length} / ${delta.nodesChanged.length}</strong><p>${delta.nodesRemoved.concat(delta.nodesChanged).length ? delta.nodesRemoved.concat(delta.nodesChanged).map(id => esc(id)).join(', ') : 'None'}</p></article><article><small>Connections added / removed / changed</small><strong>${delta.edgesAdded.length} / ${delta.edgesRemoved.length} / ${delta.edgesChanged.length}</strong><p>Computed from every returned graph edge.</p></article><article><small>Evidence relationships changed</small><strong>${delta.evidenceChanged.length}</strong><p>${delta.evidenceChanged.length ? delta.evidenceChanged.map(item => esc(item.item_id)).join(', ') : 'None'}</p></article></div><div class="review-applied-layout"><section><h3>Returned demo-corrected process graph</h3>${renderProcessWorkspace({ evidence: true, precedents: false })}</section><section>${renderReviewedChecklist(result.checklist?.items || [])}</section></div></div>`, 'review-applied');
    bindProcessInteractions();
    setOrchestrator('Simulated review saved; inspect the returned graph before demo-memory consolidation', true);
    showJourneyActions({ back: false, next: 'Inspect unverified learning outcome' });
  }

  async function submitReview(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('span').textContent = 'Capturing a comparison and saving review…';
    try {
      state.reviewBefore = snapshot(state.run?.result);
      await ensureBaselineLaterRun();
      state.review = await api(`/api/runs/${encodeURIComponent(state.runId)}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'approve_with_edit',
          building_envelope_mode: form.get('building_envelope_mode'),
          confidence: .94,
          justification: form.get('justification') || '',
        }),
      });
      state.run = await api(`/api/runs/${encodeURIComponent(state.runId)}`);
      state.flagshipRun = state.run;
      showReviewApplied();
    } catch (error) {
      button.disabled = false;
      button.querySelector('span').textContent = 'Apply demo correction';
      toast(`Could not save review: ${error.message}`);
    }
  }

  async function showKnowledgeConsolidation() {
    state.journey = 'knowledge';
    hideJourneyActions();
    setOrchestrator('Knowledge Agent is deciding what can safely be reused', false);
    const events = (state.run.events || []).filter(event => ['review', 'consolidate'].includes(event.stage));
    renderCanvas(`<div class="stage-shell knowledge-agent"><div class="stage-kicker"><span class="agent-avatar">KA</span><span><strong>Knowledge Agent</strong> · governed organizational learning</span></div><h2 class="stage-title">CasePath is reviewing what the organization can learn.</h2><p class="stage-intro">Unverified demo memory and shared organizational rules have separate gates. Candidate output remains quarantined until qualified support, tests, and approval exist.</p><div class="knowledge-thinking"><div class="orchestrator-mark"><span></span><i></i></div><div><strong id="knowledgeThinkingTitle">Reading the demo review result</strong><p id="knowledgeThinkingDetail">Checking what became unverified demo memory and what remains quarantined.</p></div></div><div id="knowledgeResult"></div></div>`, 'knowledge');
    for (const event of events) {
      $('#knowledgeThinkingTitle').textContent = event.headline || event.label;
      $('#knowledgeThinkingDetail').textContent = event.detail || '';
      await wait(PACE * 1.5);
    }
    renderKnowledgeResult();
  }

  function renderKnowledgeResult() {
    const candidate = state.review?.candidate || null;
    const knowledge = state.review?.knowledge || {};
    const memoryAvailable = state.review?.accepted === true && knowledge.reviewed_memory_available === true && Boolean(state.review?.memory_id);
    const supportReturned = Number.isFinite(Number(candidate?.support_count)) && Number.isFinite(Number(candidate?.required_support));
    const support = supportReturned ? `${Number(candidate.support_count)} of ${Number(candidate.required_support)} support records` : 'Support count not returned';
    const sharedChanged = candidate?.shared_knowledge_changed === true && knowledge.shared_playbook_version && candidate?.status === 'released';
    const sharedVersion = knowledge.shared_playbook_version || candidate?.base_version || 'Version not returned';
    const targetStatus = candidate?.target_tests?.status || 'not returned';
    const regressionStatus = candidate?.protected_regression?.status || 'not returned';
    const approvalStatus = candidate?.approval?.status || 'not returned';
    $('#knowledgeResult').innerHTML = `<section class="v20-learning-summary" data-learning-status="${esc(candidate?.status || 'not-returned')}"><span>What CasePath learned</span><h2>${memoryAvailable ? 'One unverified demo memory is available; the shared playbook is unchanged.' : 'No reusable demo-review memory was confirmed.'}</h2><article class="v20-learning-row" data-outcome="reviewed-memory"><span>${memoryAvailable ? '✓' : '!'}</span><div><small>Unverified demo review memory</small><strong>${memoryAvailable ? 'Saved and available as an explicitly unverified precedent.' : 'Not confirmed by the review response.'}</strong><p>${memoryAvailable ? `Memory ${esc(state.review.memory_id)} preserves the source package, returned graph, checklist, correction, and unverified reviewer status.` : 'CasePath will not claim memory reuse without a server-returned memory identifier.'}</p></div></article><article class="v20-learning-row quarantined" data-outcome="candidate"><span>Q</span><div><small>Reusable-rule candidate · ${esc(candidate?.status || 'status not returned')}</small><strong>${esc(support)}; required support has not been met.</strong><p>Target tests: ${esc(targetStatus)} · protected regression: ${esc(regressionStatus)} · approval: ${esc(approvalStatus)}. Proposed version ${esc(candidate?.proposed_version || 'not returned')} is quarantined.</p></div></article><article class="v20-learning-row unchanged" data-outcome="shared-playbook"><span>${sharedChanged ? 'changed' : '—'}</span><div><small>Shared playbook ${sharedChanged ? 'changed' : 'unchanged'}</small><strong>${esc(sharedVersion)} remains the active shared version.</strong><p>${sharedChanged ? 'The server explicitly returned a released shared change.' : 'The simulated correction is not a shared rule. No release, target-test pass, or regression pass is implied.'}</p></div></article></section>`;
    document.body.dataset.casepathLearningReady = 'true';
    announceRender('knowledge');
    setOrchestrator(memoryAvailable ? 'Unverified demo memory saved; shared-rule candidate quarantined' : 'No demo-review memory was confirmed', true);
    showJourneyActions({ back: false, next: memoryAvailable ? 'Test unverified memory on a new claim' : 'Restart the demo' });
  }

  async function startLaterClaim() {
    state.journey = 'later';
    hideJourneyActions();
    setOrchestrator('Opening an unseen related claim with unverified demo memory available', false);
    try {
      state.laterClaim = await api(`/api/claims/${encodeURIComponent(state.demo.later_claim_id)}`);
      state.claim = state.laterClaim;
      renderClaim(state.claim);
      const created = await api('/api/runs', { method: 'POST', body: JSON.stringify({ claim_id: state.demo.later_claim_id, knowledge_mode: 'current' }) });
      state.laterRun = { run_id: created.run_id, events: [], status: 'queued' };
      document.body.dataset.casepathActiveRunId = created.run_id;
      state.laterRunComplete = false;
      state.eventQueue = [];
      state.queuedEventIds.clear();
      renderCanvas(`<div class="stage-shell later-run"><div class="later-source-banner"><div><span class="quiet-label">Unseen related claim</span><h3>${esc(state.laterClaim.subject)}</h3><p>CasePath may retrieve the explicitly unverified demo case as precedent. The quarantined candidate must not change the shared ${esc(state.review?.knowledge?.shared_playbook_version || 'playbook')}.</p></div><span class="new-knowledge">Unverified demo memory available</span></div><div class="later-agent-stream" id="laterAgentStream"></div><div id="laterResult"></div></div>`, 'later-work');
      renderProgress();
      pollRun(created.run_id, true);
    } catch (error) {
      renderFailure(error.message);
    }
  }

  function appendLaterEvent(event) {
    if (event.stage === 'orchestrator') {
      setOrchestrator(event.headline || event.label, false);
      return;
    }
    if (event.stage === 'complete') return;
    const stage = STAGES.find(item => item.id === event.stage);
    if (!stage || event.status !== 'completed') return;
    renderProgress(stage.id);
    setOrchestrator(`${event.agent}: ${event.headline}`, false);
    const stream = $('#laterAgentStream');
    if (!stream) return;
    stream.insertAdjacentHTML('beforeend', `<div class="later-agent-row"><span>✓</span><strong>${esc(stage.label)}</strong><p>${esc(event.headline || event.detail || '')}</p></div>`);
    stream.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  async function finishLaterRun() {
    if (state.journey !== 'later' || !state.laterRunComplete || state.laterFinishing) return;
    state.laterFinishing = true;
    try {
      const baselineId = state.baselineLaterRun?.run_id;
      const laterId = state.laterRun?.run_id;
      if (!baselineId || !laterId) throw new Error('Both completed comparison run identifiers are required.');
      state.proof = await api(`/api/learning-proof?baseline_run_id=${encodeURIComponent(baselineId)}&later_run_id=${encodeURIComponent(laterId)}`);
      renderLaterResult();
      const memoryUsed = state.laterRun?.result?.reviewed_memory_used === true && state.proof?.reviewed_memory_proof?.used === true;
      setOrchestrator(memoryUsed ? 'The unseen claim retrieved unverified demo memory; shared playbook stayed unchanged' : 'Demo-memory use was not confirmed for the unseen claim', true);
      renderProgress();
      showJourneyActions({ back: false, next: 'Restart the demo' });
    } catch (error) {
      renderFailure(error.message);
    }
  }

  function renderLaterResult() {
    const result = state.laterRun.result || {};
    const process = result.process || state.laterRun.process || {};
    const proof = state.proof || {};
    const before = proof.before || {};
    const after = proof.after || {};
    const changes = proof.changes || {};
    const memoryUsed = result.reviewed_memory_used === true && proof.reviewed_memory_proof?.used === true;
    const sharedApplied = result.shared_rule_applied === true && proof.shared_rule?.applied === true;
    const beforePrecedents = (before.precedents || []).map(item => item.claim_id);
    const addedPrecedents = changes.precedent_claim_ids_added || [];
    const addedNodes = changes.process_node_ids_added || [];
    const evidenceChanges = ['required_now_added', 'required_now_removed', 'conditional_added', 'conditional_removed'].flatMap(key => changes[key] || []);
    const currentNodeId = process.current_overlay?.current_node_id || process.current_node || (process.nodes || []).find(node => node.state === 'current')?.node_id || '';
    if (currentNodeId) state.selectedNodeId = currentNodeId;
    state.stageMode = 'experience';
    const processMarkup = (process.nodes || []).length
      ? `<section class="later-process-result" data-run-id="${esc(state.laterRun.run_id || '')}" data-current-node-id="${esc(currentNodeId)}"><header><small>Returned claim state</small><h3>${esc(result.category || 'Category not returned')}</h3><p>${esc(result.scope || 'Scope not returned')}</p></header>${renderProcessWorkspace({ evidence: true, precedents: true })}</section>`
      : '<section class="later-process-result"><p>Process artifact was not returned for this claim.</p></section>';
    $('#laterResult').innerHTML = `<header class="v20-later-heading" data-memory-used="${memoryUsed}"><small>${memoryUsed ? 'Unverified demo memory used' : 'Demo-memory use not confirmed'}</small><h2>${memoryUsed ? 'The next claim retrieved an unverified demo precedent.' : 'The next claim stayed on the returned shared process.'}</h2><p>${memoryUsed ? 'The run and computed proof both returned the unverified demo memory. This is precedent retrieval, not qualified review or a released shared-rule change.' : 'CasePath does not claim demo-memory reuse because both the run and computed proof did not confirm it.'}</p></header>${processMarkup}<div class="final-proof"><span class="quiet-label">Computed comparison</span><strong>Baseline ${esc(before.result_hash || 'hash not returned')} → after ${esc(after.result_hash || 'hash not returned')}</strong><p>Both sides are completed later-claim runs. Shared rule applied: ${esc(String(sharedApplied))}.</p></div><div class="before-after"><section><h4>Before demo memory</h4><h3>${esc(before.playbook_version || 'Version not returned')}</h3><ul><li>Run ${esc(before.run_id || 'not returned')}</li><li>Precedents: ${esc(beforePrecedents.join(', ') || 'none returned')}</li><li>Process nodes: ${esc(String((before.process_node_ids || []).length))}</li></ul></section><section><h4>After unverified demo memory</h4><h3>${esc(after.playbook_version || 'Version not returned')}</h3><ul><li class="${memoryUsed ? 'reused' : ''}">Run ${esc(after.run_id || 'not returned')}</li><li class="${memoryUsed ? 'reused' : ''}">Precedents added: ${esc(addedPrecedents.join(', ') || 'none')}</li><li>Process nodes added: ${esc(addedNodes.join(', ') || 'none')}</li><li>Evidence status changes: ${esc(String(evidenceChanges.length))}</li></ul></section></div><section class="reuse-boundary"><strong>Shared playbook unchanged</strong><p>${esc(proof.shared_rule?.version_after || result.playbook?.version || 'Version not returned')} remains active; candidate status ${esc(proof.shared_rule?.candidate_status || proof.candidate?.status || 'not returned')}.</p></section>`;
    bindProcessInteractions();
    announceRender('later-result');
  }

  function restartDemo() {
    const url = new URL(location.href);
    url.searchParams.delete('preserve');
    url.searchParams.set('restart', String(Date.now()));
    location.href = url.toString();
  }

  function renderFailure(message) {
    setOrchestrator('CasePath stopped safely', true);
    renderCanvas(`<div class="stage-shell">${stageHeader({ label: 'Safe failure', short: '!', job: 'No canonical state was changed' }, 'The claim was not changed.', message)}<button class="primary-button" type="button" onclick="location.reload()">Retry</button></div>`, 'failure');
  }

  function bindSourceLinks(root = document) {
    $$('[data-source-ref]', root).forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = 'true';
      button.addEventListener('click', event => {
        event.stopPropagation();
        const returnedPage = Number(button.dataset.sourcePage);
        let region = null;
        try { region = button.dataset.sourceRegion ? JSON.parse(button.dataset.sourceRegion) : null; } catch (_) {}
        openSource(button.dataset.sourceRef, Number.isInteger(returnedPage) && returnedPage > 0 ? returnedPage : 1, {
          factId: button.dataset.factId || '',
          nodeId: button.dataset.nodeId || '',
          locator_kind: button.dataset.sourceLocatorKind || '',
          excerpt: button.dataset.sourceExcerpt || '',
          region,
          observation: button.dataset.sourceObservation || '',
          field: button.dataset.sourceField || '',
          value: button.dataset.sourceValue || '',
          agent: button.dataset.sourceAgent || '',
          confidence: button.dataset.factConfidence || '',
          state: button.dataset.factState || '',
        });
      });
    });
  }

  function findArtifact(artifactId) {
    return (state.claim?.artifacts || []).find(item => item.artifact_id === artifactId)
      || (state.flagshipClaim?.artifacts || []).find(item => item.artifact_id === artifactId)
      || (state.laterClaim?.artifacts || []).find(item => item.artifact_id === artifactId)
      || null;
  }

  async function openSource(artifactId, page = 1, context = null) {
    if (artifactId === 'message') return openMessageSource(page, context);
    if (artifactId === 'intake') return openIntakeSource(context);
    const artifact = findArtifact(artifactId);
    if (!artifact) {
      toast('That source is not in the current claim package.');
      return;
    }
    const returnFocus = $('#sourceViewer').open ? state.viewer.returnFocus : document.activeElement;
    state.viewer = { artifact, extraction: null, page: Math.max(1, page), zoom: 1, tab: 'original', context, searchMatches: [], query: '', returnFocus };
    $('#sourceViewerKind').textContent = 'Original attachment';
    $('#sourceViewerTitle').textContent = artifact.title;
    $('#sourceViewerMeta').textContent = `${artifact.filename} · ${mimeLabel(artifact)} · received ${formatDate(artifact.received_at)}`;
    $('#openOriginal').href = artifactUrl(artifact.artifact_id);
    $('#openOriginal').hidden = false;
    $('#openOriginal').removeAttribute('aria-disabled');
    $('#sourceSearch').value = '';
    $('#sourceSearchStatus').textContent = '';
    $('#sourceSearchResults').innerHTML = '';
    renderGalleryControls();
    if (!$('#sourceViewer').open) $('#sourceViewer').showModal();
    $('#closeSourceViewer').focus();
    setSourceTab('original');
    renderSourceEvidence(artifact.artifact_id);
  }

  function openMessageSource(_page = 1, context = null) {
    const claim = state.claim || state.flagshipClaim;
    const returnFocus = $('#sourceViewer').open ? state.viewer.returnFocus : document.activeElement;
    state.viewer = { artifact: { artifact_id: 'message', title: 'Customer message', filename: 'customer-message', media_type: 'message/rfc822', page_count: 1 }, extraction: null, page: 1, zoom: 1, tab: 'original', context, searchMatches: [], query: '', returnFocus };
    $('#sourceViewerKind').textContent = 'Original customer message';
    $('#sourceViewerTitle').textContent = claim.subject;
    $('#sourceViewerMeta').textContent = `${claim.customer?.name || 'Customer'} · received ${formatDate(claim.received_at)}`;
    $('#openOriginal').removeAttribute('href');
    $('#openOriginal').hidden = true;
    $('#openOriginal').setAttribute('aria-disabled', 'true');
    $('#sourceSearch').value = '';
    $('#sourceSearchStatus').textContent = '';
    $('#sourceSearchResults').innerHTML = '';
    renderGalleryControls();
    if (!$('#sourceViewer').open) $('#sourceViewer').showModal();
    $('#closeSourceViewer').focus();
    setSourceTab('original');
    renderSourceEvidence('message');
  }

  function intakePayload() {
    const claim = state.claim || state.flagshipClaim || {};
    return {
      claim_id: claim.claim_id || '',
      subject: claim.subject || '',
      received_at: claim.received_at || '',
      customer_name: claim.customer?.name || '',
      customer_address: claim.customer?.address || '',
      policy_reference: claim.customer?.policy || '',
    };
  }

  function openIntakeSource(context = null) {
    const returnFocus = $('#sourceViewer').open ? state.viewer.returnFocus : document.activeElement;
    state.viewer = { artifact: { artifact_id: 'intake', title: 'Intake metadata', filename: 'observed-intake-fields', media_type: 'application/casepath-intake+json', page_count: 1 }, extraction: null, page: 1, zoom: 1, tab: 'original', context, searchMatches: [], query: '', returnFocus };
    $('#sourceViewerKind').textContent = 'Observed intake metadata';
    $('#sourceViewerTitle').textContent = 'Intake metadata';
    $('#sourceViewerMeta').textContent = 'Fields received with the current claim submission';
    $('#openOriginal').removeAttribute('href');
    $('#openOriginal').hidden = true;
    $('#openOriginal').setAttribute('aria-disabled', 'true');
    $('#sourceSearch').value = '';
    $('#sourceSearchStatus').textContent = '';
    $('#sourceSearchResults').innerHTML = '';
    renderGalleryControls();
    if (!$('#sourceViewer').open) $('#sourceViewer').showModal();
    $('#closeSourceViewer').focus();
    setSourceTab('original');
    renderSourceEvidence('intake');
  }

  function imageArtifacts() {
    return (state.claim?.artifacts || []).filter(artifact => artifact.media_type?.startsWith('image/'));
  }

  function renderGalleryControls() {
    const gallery = imageArtifacts();
    const index = gallery.findIndex(artifact => artifact.artifact_id === state.viewer.artifact?.artifact_id);
    const nav = $('#sourceGalleryNav');
    const useful = index >= 0 && gallery.length > 1;
    nav.hidden = !useful;
    if (!useful) return;
    $('#sourcePosition').textContent = `Image ${index + 1} of ${gallery.length}`;
    $('#sourcePrevious').disabled = index === 0;
    $('#sourceNext').disabled = index === gallery.length - 1;
    nav.dataset.galleryIndex = String(index);
  }

  function moveImage(offset) {
    const gallery = imageArtifacts();
    const index = gallery.findIndex(artifact => artifact.artifact_id === state.viewer.artifact?.artifact_id);
    const target = gallery[index + offset];
    if (target) openSource(target.artifact_id, 1, null);
  }

  function renderImageSource(artifact, zoom) {
    const context = state.viewer.context || {};
    const region = context.locator_kind === 'visual_observation' ? normalizedRegion(context) : null;
    const highlight = region ? `<span class="visual-region-highlight" role="img" aria-label="Visual observation region: ${esc(context.observation || 'observation not returned')}" data-highlight-region="${esc(JSON.stringify(region))}" style="left:${region[0] * 100}%;top:${region[1] * 100}%;width:${region[2] * 100}%;height:${region[3] * 100}%"><span>Observation region</span></span>` : '';
    return `<figure class="source-image-frame" style="transform:scale(${zoom})"><img id="sourceImage" src="${artifactUrl(artifact.artifact_id)}" alt="${esc(artifact.title)}">${highlight}</figure>`;
  }

  async function renderSourceViewer() {
    const { artifact, page, zoom, tab } = state.viewer;
    if (!artifact) return;
    $('#sourceViewer').setAttribute('aria-busy', 'true');
    $('#sourceStage').setAttribute('aria-busy', 'true');
    $('#zoomValue').textContent = `${Math.round(zoom * 100)}%`;
    $('#sourceSearchForm').hidden = artifact.media_type?.startsWith('image/');
    try {
      if (tab === 'extraction') {
        await renderExtraction();
      } else {
        $('#pageThumbnails').hidden = artifact.media_type !== 'application/pdf';
        if (artifact.media_type === 'application/pdf') {
          $('#pageThumbnails').innerHTML = Array.from({ length: artifact.page_count || 1 }, (_, index) => `<button class="page-thumb" type="button" data-page="${index + 1}" aria-current="${index + 1 === page ? 'page' : 'false'}"><img src="${pageUrl(artifact.artifact_id, index + 1)}" alt="Page ${index + 1}"><span>${index + 1}</span></button>`).join('');
          $('#sourceStage').innerHTML = `<img id="documentPage" src="${pageUrl(artifact.artifact_id, page)}" alt="${esc(artifact.title)}, page ${page}" style="transform:scale(${zoom})">`;
          $$('.page-thumb', $('#sourceViewer')).forEach(button => button.addEventListener('click', () => {
            state.viewer.page = Number(button.dataset.page);
            renderSourceViewer();
          }));
        } else if (artifact.media_type?.startsWith('image/')) {
          $('#pageThumbnails').hidden = true;
          $('#sourceStage').innerHTML = renderImageSource(artifact, zoom);
        } else if (artifact.artifact_id === 'message') {
          $('#pageThumbnails').hidden = true;
          const claim = state.claim || state.flagshipClaim;
          $('#sourceStage').innerHTML = `<article class="email-document" style="transform:scale(${zoom})"><dl><dt>From</dt><dd>${esc(claim.customer?.name || 'Customer')}</dd><dt>To</dt><dd>Legal protection claims</dd><dt>Received</dt><dd>${esc(formatDate(claim.received_at))}</dd><dt>Subject</dt><dd>${esc(claim.subject)}</dd></dl><pre>${esc(claim.message)}</pre></article>`;
        } else if (artifact.artifact_id === 'intake') {
          $('#pageThumbnails').hidden = true;
          const intake = intakePayload();
          $('#sourceStage').innerHTML = `<article class="email-document intake-document" style="transform:scale(${zoom})"><dl>${Object.entries(intake).map(([key, value]) => `<dt>${esc(key.replaceAll('_', ' '))}</dt><dd>${esc(value)}</dd>`).join('')}</dl></article>`;
        } else {
          $('#pageThumbnails').hidden = true;
          if (!state.viewer.extraction) state.viewer.extraction = await api(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}/extraction`);
          const email = state.viewer.extraction.email || {};
          $('#sourceStage').innerHTML = `<article class="email-document" style="transform:scale(${zoom})"><dl><dt>From</dt><dd>${esc(email.from || '')}</dd><dt>To</dt><dd>${esc(email.to || '')}</dd><dt>Date</dt><dd>${esc(email.date || '')}</dd><dt>Subject</dt><dd>${esc(email.subject || artifact.title)}</dd></dl><pre>${esc(email.body || '')}</pre></article>`;
        }
      }
    } catch (error) {
      $('#sourceStage').innerHTML = `<p role="alert">${esc(error.message)}</p>`;
    } finally {
      $('#sourceStage').setAttribute('aria-busy', 'false');
      $('#sourceViewer').setAttribute('aria-busy', 'false');
    }
  }

  function highlightedText(value, query) {
    if (!query) return esc(value);
    const safe = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(value).split(new RegExp(`(${safe})`, 'ig')).map(part => part.toLowerCase() === query.toLowerCase() ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
  }

  async function renderExtraction() {
    const artifact = state.viewer.artifact;
    $('#pageThumbnails').hidden = true;
    if (artifact.artifact_id === 'message') {
      const claim = state.claim || state.flagshipClaim;
      $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page" data-extraction-page="1"><h3>Machine-visible customer message</h3><pre>${highlightedText(claim.message, state.viewer.query)}</pre></div></div>`;
      return;
    }
    if (artifact.artifact_id === 'intake') {
      $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page" data-extraction-page="1"><h3>Observed intake fields</h3><pre>${highlightedText(JSON.stringify(intakePayload(), null, 2), state.viewer.query)}</pre></div></div>`;
      return;
    }
    try {
      if (!state.viewer.extraction) state.viewer.extraction = await api(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}/extraction`);
      const extraction = state.viewer.extraction;
      if (extraction.pages) {
        $('#sourceStage').innerHTML = `<div class="extraction-pages">${extraction.pages.map((text, index) => `<div class="extraction-page" data-extraction-page="${index + 1}"><h3>Page ${index + 1}</h3><pre>${highlightedText(text || 'No text extracted.', state.viewer.query)}</pre></div>`).join('')}</div>`;
      } else if (extraction.email) {
        $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page" data-extraction-page="1"><h3>Structured email fields</h3><pre>${highlightedText(JSON.stringify(extraction.email, null, 2), state.viewer.query)}</pre></div></div>`;
      } else {
        $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page"><h3>Machine-visible image record</h3><pre>${esc(extraction.image_note || 'Original pixels and metadata preserved.')}</pre></div></div>`;
      }
    } catch (error) {
      $('#sourceStage').innerHTML = `<p>${esc(error.message)}</p>`;
    }
  }

  async function searchExtractedSource(event) {
    event.preventDefault();
    const query = $('#sourceSearch').value.trim();
    state.viewer.query = query;
    state.viewer.searchMatches = [];
    $('#sourceSearchResults').innerHTML = '';
    if (!query) {
      $('#sourceSearchStatus').textContent = 'Enter text to search this source.';
      return;
    }
    const artifact = state.viewer.artifact;
    let pages = [];
    try {
      if (artifact.artifact_id === 'message') {
        pages = [(state.claim || state.flagshipClaim)?.message || ''];
      } else if (artifact.artifact_id === 'intake') {
        pages = [JSON.stringify(intakePayload(), null, 2)];
      } else {
        if (!state.viewer.extraction) state.viewer.extraction = await api(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}/extraction`);
        if (state.viewer.extraction.pages) pages = state.viewer.extraction.pages;
        else if (state.viewer.extraction.email) pages = [JSON.stringify(state.viewer.extraction.email, null, 2)];
      }
      pages.forEach((text, index) => {
        const haystack = String(text || '');
        const position = haystack.toLowerCase().indexOf(query.toLowerCase());
        if (position < 0) return;
        const start = Math.max(0, position - 65);
        const end = Math.min(haystack.length, position + query.length + 85);
        state.viewer.searchMatches.push({ page: index + 1, excerpt: haystack.slice(start, end).replace(/\s+/g, ' ').trim() });
      });
      $('#sourceSearchStatus').textContent = `${state.viewer.searchMatches.length} page${state.viewer.searchMatches.length === 1 ? '' : 's'} matched “${query}”.`;
      $('#sourceSearchResults').innerHTML = state.viewer.searchMatches.map(match => `<button type="button" data-search-page="${match.page}"><strong>Page ${match.page}</strong><span>${highlightedText(match.excerpt, query)}</span></button>`).join('');
      setSourceTab('extraction');
    } catch (error) {
      $('#sourceSearchStatus').textContent = `Search unavailable: ${error.message}`;
    }
  }

  function renderSourceEvidence(artifactId) {
    const facts = (currentRun()?.result?.facts || currentRun()?.understanding?.facts || []).filter(fact => (fact.source_refs || []).some(ref => ref.artifact_id === artifactId));
    const context = state.viewer.context;
    const openedFrom = context?.factId ? `<section class="opened-grounding" data-fact-id="${esc(context.factId)}" data-node-id="${esc(context.nodeId || '')}"><small>Opened from fact ${esc(context.factId)}</small>${sourceLocatorMarkup(context, 'opened-locator')}<p>confidence ${formatConfidence(context.confidence)} · ${esc(context.state || 'state not returned')}</p></section>` : '';
    $('#sourceEvidence').innerHTML = `${openedFrom}<h3>Facts linked to this source</h3><p>Source → facts and their owning decisions.</p>${facts.length ? facts.map(fact => {
      const refs = (fact.source_refs || []).filter(ref => ref.artifact_id === artifactId);
      const node = owningNodeForFact(fact.fact_id);
      return `<article class="source-fact" data-fact-id="${esc(fact.fact_id)}" data-node-id="${esc(node?.node_id || '')}"><strong>${esc(fact.label)} — ${esc(fact.value)}</strong><p>${esc(fact.explanation)}</p><small>${esc(fact.fact_id)} · ${esc(fact.state || 'unclassified')} · confidence ${formatConfidence(fact.confidence)}</small>${refs.map(ref => sourceLocatorMarkup(ref, 'source-passage')).join('')}${node ? `<button type="button" class="route-to-decision" data-source-fact-node="${esc(node.node_id)}">Return to decision · ${esc(node.title)}</button>` : '<p class="grounding-warning">No owning process decision returned.</p>'}</article>`;
    }).join('') : '<article class="source-fact"><p>No current claim fact points to this source yet.</p></article>'}`;
  }

  function setSourceTab(tab, focus = false) {
    state.viewer.tab = tab;
    $$('[data-source-tab]').forEach(button => {
      const selected = button.dataset.sourceTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected) $('#sourceStage').setAttribute('aria-labelledby', button.id);
      if (selected && focus) button.focus();
    });
    renderSourceViewer();
  }

  function focusOwningDecision(nodeId) {
    closeSourceViewer({ restoreFocus: false });
    state.selectedNodeId = nodeId;
    const target = $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"],.process-branch-node[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'));
    if (!target) {
      toast('The owning decision will be selected when the process graph is visible.');
      return;
    }
    target.click();
    requestAnimationFrame(() => {
      const refreshed = $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"],.process-branch-node[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'));
      refreshed?.focus();
    });
  }

  function closeSourceViewer({ restoreFocus = true } = {}) {
    const returnFocus = state.viewer.returnFocus;
    if ($('#sourceViewer').open) $('#sourceViewer').close();
    if (restoreFocus) requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  }

  function openPrecedent(index) {
    const precedent = (state.run?.precedents || state.run?.result?.precedents || [])[index];
    if (!precedent) return;
    $('#precedentViewerKind').textContent = precedentProvenance(precedent);
    $('#precedentTitle').textContent = `${precedent.claim_id} · ${precedent.title}`;
    $('#precedentContent').innerHTML = `<p class="precedent-provenance">${esc(precedentProvenance(precedent))}</p><p class="precedent-summary">${esc(precedent.why_useful)}</p><div class="precedent-grid"><section><h3>Relevant branch</h3><p>${esc((precedent.final_process || []).join(' → '))}</p></section><section><h3>Evidence that mattered</h3><ul>${(precedent.evidence || []).map(item => `<li>${esc(typeof item === 'string' ? item : item.title || JSON.stringify(item))}</li>`).join('')}</ul></section><section><h3>Returned review state</h3><p>${esc(precedent.review_status || 'Not returned')}</p></section><section><h3>Outcome</h3><p>${esc(precedent.outcome || 'Outcome not returned')}</p></section></div>`;
    $('#precedentViewer').showModal();
  }

  async function openAuditDrawer() {
    let run = currentRun();
    if (!run?.run_id && state.runId) run = await api(`/api/runs/${encodeURIComponent(state.runId)}`);
    if (!run) return;
    if (run.run_id) {
      try {
        run = await api(`/api/runs/${encodeURIComponent(run.run_id)}`);
        if (state.journey === 'later') state.laterRun = run; else state.run = run;
      } catch (_) {}
    }
    $('#auditContent').innerHTML = (run.events || []).map(event => {
      const kind = eventKind(event);
      const isModelEvent = kind === 'nemotron_agent' || kind === 'legacy_model_event';
      const field = (label, value) => value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : '';
      const actorType = returnedValue(event, 'actor_type');
      const inputs = Array.isArray(event.input_artifacts) ? event.input_artifacts.join(', ') : returnedValue(event, 'input_artifact');
      const outputs = eventArtifacts(event).join(', ');
      return `<details class="audit-event" ${event.stage === state.activeStage ? 'open' : ''} data-actor-type="${esc(kind)}" data-call-id="${esc(returnedValue(event, 'call_id'))}" data-delegation-id="${esc(returnedValue(event, 'delegation_id'))}"><summary><span></span><div><strong>${esc(event.label)}</strong><span>${esc(event.headline || '')}</span></div><span>${esc(event.status || '')}</span></summary><div class="audit-event-body"><p>${esc(event.detail || '')}</p><dl class="audit-grid">${field('Actor contract', actorType || `Not returned — ${actorKindLabel(kind)}`)}${field('Returned actor', returnedActorName(event))}${field('Implementation', returnedValue(event, 'implementation'))}${isModelEvent ? field('Requested model', returnedValue(event, 'requested_model', 'model')) : ''}${isModelEvent ? field('Response model', returnedValue(event, 'response_model')) : ''}${field('Call ID', returnedValue(event, 'call_id'))}${field('Delegation ID', returnedValue(event, 'delegation_id'))}${field('Cache origin call', returnedValue(event, 'cache_origin_call_id', 'origin_call_id'))}${field('Prompt version', returnedValue(event, 'prompt_version'))}${field('Validator', returnedValue(event, 'gate_id', 'validator'))}${field('Input artifact', inputs)}${field('Input hash', returnedValue(event, 'input_artifact_hash', 'input_hash'))}${field('Output artifact', outputs)}${field('Output hash', returnedValue(event, 'output_artifact_hash', 'output_hash', 'artifact_hash'))}${field('Handoff from', returnedValue(event, 'handoff_from'))}${field('Handoff to', returnedValue(event, 'handoff_to'))}</dl></div></details>`;
    }).join('');
    $('#auditDrawer').showModal();
  }

  function bindGlobalInteractions() {
    $('#runCasePath').addEventListener('click', startFlagshipRun);
    $('#toggleSource').addEventListener('click', () => {
      const pane = $('.submission-pane');
      const expanded = $('#toggleSource').getAttribute('aria-expanded') === 'true';
      $('#toggleSource').setAttribute('aria-expanded', String(!expanded));
      pane.classList.toggle('collapsed', expanded);
    });
    $('#attachmentList').addEventListener('click', event => {
      const row = event.target.closest('[data-artifact-id]');
      if (row) openSource(row.dataset.artifactId, 1);
    });
    $('#journeyNext').addEventListener('click', () => {
      if (state.journey === 'ready') showReview();
      else if (state.journey === 'review-applied') showKnowledgeConsolidation();
      else if (state.journey === 'knowledge') {
        const memoryAvailable = state.review?.accepted === true && state.review?.knowledge?.reviewed_memory_available === true && Boolean(state.review?.memory_id);
        if (memoryAvailable) startLaterClaim(); else restartDemo();
      }
      else if (state.journey === 'later' && state.laterRunComplete) restartDemo();
    });
    $('#journeyBack').addEventListener('click', () => {
      if (state.journey === 'review') {
        state.journey = 'ready';
        renderReadyMoment();
      }
    });
    $('#openAudit').addEventListener('click', openAuditDrawer);
    $('#closeAudit').addEventListener('click', () => $('#auditDrawer').close());
    $('#closeSourceViewer').addEventListener('click', () => closeSourceViewer());
    $('#closePrecedent').addEventListener('click', () => $('#precedentViewer').close());
    $$('[data-source-tab]').forEach(button => button.addEventListener('click', () => setSourceTab(button.dataset.sourceTab)));
    $('.source-viewer-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$('[data-source-tab]');
      const current = tabs.indexOf(document.activeElement);
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      setSourceTab(tabs[target].dataset.sourceTab, true);
    });
    $('#sourceSearchForm').addEventListener('submit', searchExtractedSource);
    $('#sourceSearchResults').addEventListener('click', event => {
      const button = event.target.closest('[data-search-page]');
      if (!button) return;
      state.viewer.page = Number(button.dataset.searchPage);
      setSourceTab('extraction');
      requestAnimationFrame(() => $(`[data-extraction-page="${state.viewer.page}"]`)?.scrollIntoView({ block: 'start' }));
    });
    $('#sourcePrevious').addEventListener('click', () => moveImage(-1));
    $('#sourceNext').addEventListener('click', () => moveImage(1));
    $('#sourceEvidence').addEventListener('click', event => {
      const button = event.target.closest('[data-source-fact-node]');
      if (button) focusOwningDecision(button.dataset.sourceFactNode);
    });
    $('#zoomIn').addEventListener('click', () => { state.viewer.zoom = Math.min(2, state.viewer.zoom + .15); renderSourceViewer(); });
    $('#zoomOut').addEventListener('click', () => { state.viewer.zoom = Math.max(.55, state.viewer.zoom - .15); renderSourceViewer(); });
    [$('#sourceViewer'), $('#auditDrawer'), $('#precedentViewer')].forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      if (dialog === $('#sourceViewer')) closeSourceViewer();
      else dialog.close();
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if ($('#sourceViewer').open) closeSourceViewer();
        [$('#auditDrawer'), $('#precedentViewer')].forEach(dialog => { if (dialog.open) dialog.close(); });
      }
    });
    bindSourceLinks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
