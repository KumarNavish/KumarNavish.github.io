(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const API = (params.get('api') || window.CASEPATH_API || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const PACE = reduceMotion ? 20 : 520;

  const STAGES = [
    { id: 'read', label: 'Read evidence', short: 'Read', job: 'Reading the message and every original attachment.' },
    { id: 'understand', label: 'Understand claim', short: 'Understand', job: 'Separating supported facts, allegations, conflicts, and unknowns.' },
    { id: 'research', label: 'Research law', short: 'Law', job: 'Finding the Swiss-law questions that shape the handling process.' },
    { id: 'process', label: 'Build process', short: 'Process', job: 'Working out every decision needed from intake to resolution.' },
    { id: 'evidence', label: 'Map evidence', short: 'Evidence', job: 'Connecting each process decision to the facts and evidence it needs.' },
    { id: 'experience', label: 'Find experience', short: 'Experience', job: 'Looking for reviewed claims that help with the difficult branches.' },
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
    laterRun: null,
    review: null,
    proof: null,
    selectedNodeId: 'causation',
    activeStage: null,
    stageMode: null,
    eventQueue: [],
    queuedEventIds: new Set(),
    presenting: false,
    polling: false,
    runComplete: false,
    journey: 'start',
    viewer: { artifact: null, extraction: null, page: 1, zoom: 1, tab: 'original' },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
      state.journey = 'live';
      state.eventQueue = [];
      state.queuedEventIds.clear();
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
    if (event.stage === 'orchestrator') {
      setOrchestrator(event.headline || event.label);
      renderOpeningContext(event);
      return;
    }
    if (event.stage === 'complete') {
      setOrchestrator('Assembling the reviewed playbook', false);
      return;
    }
    const stage = STAGES.find(item => item.id === event.stage);
    if (!stage) return;
    state.activeStage = stage.id;
    state.stageMode = stage.id;
    setOrchestrator(`${event.agent}: ${event.status === 'started' ? stage.job : event.headline}`);
    renderProgress(stage.id);
    if (event.status === 'started') renderStageStarted(stage, event);
    else renderStageCompleted(stage, event);
  }

  function stageHeader(stage, title, intro) {
    return `<div class="stage-kicker"><span class="agent-avatar">${esc(stage.short.slice(0, 2).toUpperCase())}</span><span><strong>${esc(stage.label)}</strong> · ${esc(stage.job)}</span></div><h2 class="stage-title">${esc(title)}</h2><p class="stage-intro">${esc(intro)}</p>`;
  }

  function renderOpeningContext(event) {
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader({ label: 'Orchestrator', short: 'CP', job: 'One shared claim context' }, 'CasePath has opened the claim.', event.detail || '')}<div class="live-question"><small>What happens now</small><strong>Each specialist adds one grounded artifact to the same claim context.</strong></div></div>`;
  }

  function renderStageStarted(stage, event) {
    let title = event.headline || stage.job;
    let intro = event.detail || stage.job;
    if (stage.id === 'process') title = 'CasePath is building the handling process.';
    if (stage.id === 'evidence') title = 'CasePath is attaching evidence needs to the process.';
    if (stage.id === 'experience') title = 'CasePath is asking organizational memory for help.';
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader(stage, title, intro)}<div class="live-question"><small>Question being answered</small><strong>${esc(event.question || stage.job)}</strong></div></div>`;
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
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader(stage, 'The original submission is in the shared claim context.', event.detail || '')}<div class="event-list"><div class="event-row"><span class="event-mark">✓</span><div><strong>Customer message</strong><p>${parsed.message_chars || 0} characters preserved as submitted.</p></div></div>${rows}</div></div>`;
    $$('.attachment-row').forEach(row => row.classList.add('is-active'));
    setTimeout(() => $$('.attachment-row').forEach(row => row.classList.remove('is-active')), PACE * 2.2);
  }

  function renderUnderstandStage(stage, event) {
    const understanding = state.run?.understanding || state.run?.result || {};
    const facts = understanding.facts || [];
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader(stage, 'CasePath has separated what is known from what is still open.', event.detail || '')}<div class="fact-stream">${facts.map(fact => {
      const ref = fact.source_refs?.[0];
      return `<div class="fact-row ${esc(fact.state)}"><span class="fact-state"></span><div><strong>${esc(fact.label)} — ${esc(fact.value)}</strong><p>${esc(fact.explanation)}</p></div>${ref ? `<button class="source-link" type="button" data-source-ref="${esc(ref.artifact_id)}" data-source-page="${esc(ref.page || 1)}">Source</button>` : ''}</div>`;
    }).join('')}</div></div>`;
    bindSourceLinks($('#stageCanvas'));
  }

  function renderLawStage(stage, event) {
    const legal = state.run?.legal_research || state.run?.result?.legal_research || {};
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader(stage, 'Swiss law has become handling questions.', 'CasePath keeps a legal source only when it creates or constrains a decision in the process.')}<div class="law-flow">${(legal.questions || []).map((question, index) => `<div class="law-query"><span class="law-number">${index + 1}</span><div><strong>${esc(question)}</strong><p>${esc((legal.handling_principles || [])[index]?.role || (legal.sources || [])[index]?.role || 'This question will shape the process graph.')}</p></div><span class="law-source-count">${index < (legal.sources || []).length ? 'Official source linked' : 'Handling principle'}</span></div>`).join('')}</div></div>`;
  }

  function processData() {
    return state.run?.process || state.run?.result?.process || null;
  }

  function checklistData() {
    return state.run?.checklist || state.run?.result?.checklist || null;
  }

  function understandingData() {
    return state.run?.understanding || state.run?.result || null;
  }

  function legalData() {
    return state.run?.legal_research || state.run?.result?.legal_research || null;
  }

  function nodeById(nodeId) {
    return processData()?.nodes?.find(node => node.node_id === nodeId) || null;
  }

  function nodeState(nodeId) {
    const process = processData();
    const overlay = process?.current_overlay || state.run?.result?.current_overlay || {};
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
    const intro = options.precedents ? 'CasePath searched for reviewed claims with the same branch, unresolved fact, and evidence need.' : options.evidence ? 'Each process node now carries the facts and evidence it needs. The checklist is only an aggregate of these links.' : 'The main handling spine is visible first. The current claim is overlaid inside it, and alternative branches stay folded until they matter.';
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader(stage, title, intro)}${renderProcessWorkspace(options)}</div>`;
    bindProcessInteractions();
  }

  function renderProcessWorkspace({ evidence = false, precedents = false } = {}) {
    const process = processData();
    if (!process) return '<p>Process artifact is not ready.</p>';
    const spine = (process.main_spine || []).map(nodeById).filter(Boolean);
    if (!state.selectedNodeId || !nodeById(state.selectedNodeId)) state.selectedNodeId = process.current_node || 'causation';
    return `<div class="process-layout"><div class="process-map"><div class="process-spine">${spine.map((node, index) => {
      const status = nodeState(node.node_id);
      const count = evidenceForNode(node.node_id).length;
      return `<div class="process-node ${status}" style="animation-delay:${index * 55}ms"><span class="process-marker">${status === 'complete' ? '✓' : status === 'current' ? '?' : index + 1}</span><button class="process-node-button" type="button" data-node-id="${esc(node.node_id)}"><span><small>${status === 'current' ? 'Current decision' : status === 'complete' ? 'Established' : status === 'blocked' ? 'Waits for earlier answer' : 'Later stage'}</small><strong>${esc(node.title)}</strong><span class="node-answer">${esc(node.answer || node.question)}</span></span>${evidence && count ? `<span class="node-evidence-count">${count} evidence link${count === 1 ? '' : 's'}</span>` : ''}</button>${node.node_id === (process.current_node || 'causation') ? renderBranches(node) : ''}</div>`;
    }).join('')}</div></div>${renderInspector(state.selectedNodeId, { evidence, precedents })}</div>`;
  }

  function renderBranches(node) {
    if (!node.branches?.length) return '';
    return `<div class="branch-fork"><button type="button" data-toggle-branches aria-expanded="false"><span>${node.branches.length} possible causation outcomes</span><strong>Reveal branches</strong></button><div class="branch-options" hidden>${node.branches.map(branch => `<article class="branch-option ${branch.state === 'selected' ? 'selected' : ''}"><strong>${esc(branch.label)}</strong><p>${esc(branch.condition)}</p></article>`).join('')}</div></div>`;
  }

  function renderInspector(nodeId, { evidence = false, precedents = false } = {}) {
    const node = nodeById(nodeId) || nodeById(processData()?.current_node);
    if (!node) return '<aside class="decision-inspector"></aside>';
    const facts = factsForNode(node);
    const items = evidenceForNode(node.node_id);
    const laws = legalForNode(node);
    const previous = state.run?.precedents || state.run?.result?.precedents || [];
    return `<aside class="decision-inspector" data-inspector-node="${esc(node.node_id)}"><div class="inspector-label"><span>${esc(node.kind === 'outcome' ? 'Outcome' : node.kind === 'action' ? 'Action' : 'Process decision')}</span><span>${esc(nodeState(node.node_id) === 'current' ? 'Current claim' : '')}</span></div><h3>${esc(node.question)}</h3><p>${esc(node.why || node.answer || '')}</p>
      ${facts.length ? `<section class="inspector-section"><h4>What this decision knows</h4>${facts.map(fact => `<div class="inspector-row ${fact.state === 'unknown' || fact.state === 'conflicting' ? 'conditional' : ''}"><i></i><span><strong>${esc(fact.label)}:</strong> ${esc(fact.value)}${fact.source_refs?.[0] ? ` · <button class="source-link" type="button" data-source-ref="${esc(fact.source_refs[0].artifact_id)}" data-source-page="${esc(fact.source_refs[0].page || 1)}">source</button>` : ''}</span></div>`).join('')}</section>` : ''}
      ${evidence ? `<section class="inspector-section"><h4>What this decision requires</h4>${items.length ? items.map(item => `<div class="inspector-row ${item.status === 'missing' ? 'missing' : item.status === 'conditional' || item.status === 'provided_insufficient' ? 'conditional' : ''}"><i></i><span><strong>${esc(item.title)} — ${esc(statusLabel(item.status))}</strong><br>${esc(item.why)}${item.applies_when && item.status === 'conditional' ? `<br><em>Only if: ${esc(item.applies_when)}</em>` : ''}${item.artifact_ids?.[0] ? ` · <button class="source-link" type="button" data-source-ref="${esc(item.artifact_ids[0])}">open</button>` : ''}</span></div>`).join('') : '<div class="inspector-row"><i></i><span>No separate evidence requirement is linked to this decision.</span></div>'}</section>` : ''}
      ${laws.length ? `<section class="inspector-section"><h4>Why this step exists</h4>${laws.map(source => `<button class="law-marker" type="button" data-law-id="${esc(source.source_id)}">§ ${esc(source.title)}</button><div class="law-detail" data-law-detail="${esc(source.source_id)}" hidden><p>${esc(source.role)}</p>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">Open official source</a>` : ''}</div>`).join('')}</section>` : ''}
      ${precedents && previous.length ? `<section class="precedent-inline"><header><h4>Previous cases that help</h4><span>${previous.length} reviewed</span></header>${previous.map((item, index) => `<button class="precedent-mini" type="button" data-precedent-index="${index}"><strong>${esc(item.claim_id)} · ${esc(item.title)}</strong><p>${esc(item.why_useful)}</p></button>`).join('')}</section>` : ''}
    </aside>`;
  }

  function bindProcessInteractions() {
    $$('[data-node-id]').forEach(button => button.addEventListener('click', () => {
      state.selectedNodeId = button.dataset.nodeId;
      const options = { evidence: state.stageMode !== 'process', precedents: state.stageMode === 'experience' };
      const layout = $('.process-layout');
      if (layout) layout.outerHTML = renderProcessWorkspace(options);
      bindProcessInteractions();
    }));
    $$('[data-toggle-branches]').forEach(button => button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      button.querySelector('strong').textContent = expanded ? 'Reveal branches' : 'Hide branches';
      button.nextElementSibling.hidden = expanded;
    }));
    $$('[data-law-id]').forEach(button => button.addEventListener('click', () => {
      const detail = $(`[data-law-detail="${CSS.escape(button.dataset.lawId)}"]`);
      if (detail) detail.hidden = !detail.hidden;
    }));
    $$('[data-precedent-index]').forEach(button => button.addEventListener('click', () => openPrecedent(Number(button.dataset.precedentIndex))));
    bindSourceLinks();
  }

  function renderVerifyStage(stage, event) {
    const verification = state.run?.verification || state.run?.result?.verification || {};
    const checks = verification.checks || verification.accepted_checks || [];
    const rejected = verification.rejected_proposals || [];
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader(stage, 'The playbook passed its acceptance checks.', 'The verifier checks the complete graph and every process-to-evidence link before the result reaches an expert.')}<div class="process-synthesis"><section class="synthesis-primary"><h3>The process remains the map of the claim.</h3><p>CasePath preserved the supported path, kept unresolved causation open, and blocked responsibility and remedy until competent evidence arrives.</p>${renderProcessWorkspace({ evidence: true, precedents: true })}</section><section><span class="quiet-label">Verification</span><div class="verification-list">${checks.map(check => `<div class="verification-row"><span>✓</span><div>${esc(typeof check === 'string' ? check : check.label || check.name || JSON.stringify(check))}</div></div>`).join('')}${rejected.map(item => `<div class="verification-row rejected"><span>×</span><div>${esc(item.reason || item.title || item)}</div></div>`).join('')}</div></section></div></div>`;
    bindProcessInteractions();
  }

  function finishFlagshipRun() {
    if (state.journey !== 'live' || !state.runComplete || state.presenting) return;
    state.polling = false;
    state.journey = 'ready';
    state.flagshipRun = state.run;
    setOrchestrator('The handling playbook is ready for expert review', true);
    renderProgress();
    renderReadyMoment();
  }

  function renderReadyMoment() {
    const result = state.run.result;
    const verification = result.verification || {};
    const accepted = verification.checks || verification.accepted_checks || [];
    $('#stageCanvas').innerHTML = `<div class="stage-shell"><div class="process-synthesis"><section class="synthesis-primary"><span class="quiet-label">Handling playbook ready</span><h3>CasePath has reconstructed how this claim should be handled.</h3><p>The full process stays visible. The current claim sits at causation, and the evidence needed for that decision is attached directly to the graph.</p>${renderProcessWorkspace({ evidence: true, precedents: true })}</section><section><span class="quiet-label">What was constructed</span><div class="artifact-summary"><div class="artifact-row"><span class="artifact-icon">P</span><div><strong>Handling process</strong><p>From claim intake through responsibility, remedy, escalation, and closure.</p></div><span>Ready</span></div><div class="artifact-row"><span class="artifact-icon">E</span><div><strong>Evidence across the process</strong><p>Every requirement retains the decision, fact, reason, and current status.</p></div><span>Ready</span></div><div class="artifact-row"><span class="artifact-icon">H</span><div><strong>Previous cases that help</strong><p>Three reviewed claims contribute handling lessons at the difficult branch.</p></div><span>Ready</span></div></div><span class="quiet-label" style="margin-top:22px">Acceptance checks</span><div class="verification-list">${accepted.slice(0, 5).map(check => `<div class="verification-row"><span>✓</span><div>${esc(typeof check === 'string' ? check : check.label || check.name || JSON.stringify(check))}</div></div>`).join('')}</div></section></div></div>`;
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
    setOrchestrator('Expert review: correcting the reasoning where it matters', true);
    state.selectedNodeId = 'causation';
    $('#stageCanvas').innerHTML = `<div class="stage-shell"><div class="stage-kicker"><span class="agent-avatar">EX</span><span><strong>Expert review</strong> · edit the reasoning itself</span></div><h2 class="stage-title">Review the decision that controls the rest of the process.</h2><p class="stage-intro">The expert does not review every field. One evidence-order decision changes the process branch, document requirements, and future organizational knowledge.</p><div class="review-layout"><div class="review-graph">${renderProcessWorkspace({ evidence: true, precedents: false })}</div><form class="review-panel" id="reviewForm"><span class="quiet-label">Proposed correction</span><h3>How should broader building testing be sequenced?</h3><p>CasePath proposes one neutral inspection first. Broader building-envelope testing should remain conditional unless the first assessment cannot establish the cause.</p><label class="review-choice"><input type="radio" name="building_envelope_mode" value="conditional" checked><strong>Neutral assessment first</strong><p>Keep building-envelope testing conditional. Add an explicit step to test the ventilation allegation only when competent evidence makes it relevant.</p></label><label class="review-choice"><input type="radio" name="building_envelope_mode" value="required_now"><strong>Request broader testing now</strong><p>Keep the existing immediate building-envelope request.</p></label><div class="review-impact" id="reviewImpact"></div><textarea class="review-note" name="justification" placeholder="Optional expert reason">Keep causation unresolved. Use one neutral inspection first, then test the ventilation allegation or building envelope only when the first assessment supports that branch.</textarea><button class="primary-button review-submit" type="submit"><span>Approve correction</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form></div></div>`;
    bindProcessInteractions();
    renderReviewImpact('conditional');
    $$('input[name="building_envelope_mode"]').forEach(input => input.addEventListener('change', () => renderReviewImpact(input.value)));
    $('#reviewForm').addEventListener('submit', submitReview);
  }

  function renderReviewImpact(mode) {
    const recommended = mode === 'conditional';
    $('#reviewImpact').innerHTML = `<div class="review-impact-row"><small>Process</small><strong>${recommended ? 'Add “Test the ventilation allegation” after the neutral assessment.' : 'No new process decision.'}</strong></div><div class="review-impact-row"><small>Evidence</small><strong>${recommended ? 'Building-envelope testing becomes conditional; use evidence moves to the new branch.' : 'Broad building-envelope testing remains immediately missing.'}</strong></div><div class="review-impact-row"><small>Next action</small><strong>${recommended ? 'Arrange one competent neutral assessment first.' : 'Request neutral and broader testing together.'}</strong></div>`;
  }

  async function submitReview(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('span').textContent = 'Saving reviewed playbook…';
    try {
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
      showKnowledgeConsolidation();
    } catch (error) {
      button.disabled = false;
      button.querySelector('span').textContent = 'Approve correction';
      toast(`Could not save review: ${error.message}`);
    }
  }

  async function showKnowledgeConsolidation() {
    state.journey = 'knowledge';
    hideJourneyActions();
    setOrchestrator('Knowledge Agent is deciding what can safely be reused', false);
    const events = (state.run.events || []).filter(event => ['review', 'consolidate'].includes(event.stage));
    $('#stageCanvas').innerHTML = `<div class="stage-shell knowledge-agent"><div class="stage-kicker"><span class="agent-avatar">KA</span><span><strong>Knowledge Agent</strong> · governed organizational learning</span></div><h2 class="stage-title">CasePath is reviewing what the organization can learn.</h2><p class="stage-intro">The reviewed case becomes useful immediately. A shared playbook changes only after supporting cases, target tests, protected regression, and approval.</p><div class="knowledge-thinking"><div class="orchestrator-mark"><span></span><i></i></div><div><strong id="knowledgeThinkingTitle">Saving the expert-reviewed case</strong><p id="knowledgeThinkingDetail">The correction is becoming structured organizational memory.</p></div></div><div id="knowledgeResult"></div></div>`;
    for (const event of events) {
      $('#knowledgeThinkingTitle').textContent = event.headline || event.label;
      $('#knowledgeThinkingDetail').textContent = event.detail || '';
      await wait(PACE * 1.5);
    }
    renderKnowledgeResult();
  }

  function renderKnowledgeResult() {
    const candidate = state.review?.candidate || state.run?.candidate || state.review?.result?.knowledge_update || {};
    $('#knowledgeResult').innerHTML = `<div class="knowledge-flow"><div class="knowledge-step"><span>✓</span><div><strong>Reviewed case saved</strong><p>Available immediately to future precedent retrieval.</p></div></div><div class="knowledge-step"><span>✓</span><div><strong>Pattern supported</strong><p>${candidate.support_count || 3} reviewed claims agree on the evidence order.</p></div></div><div class="knowledge-step"><span>✓</span><div><strong>Target cases tested</strong><p>${candidate.target_tests?.passed || 6}/${(candidate.target_tests?.passed || 6) + (candidate.target_tests?.failed || 0)} passed.</p></div></div><div class="knowledge-step"><span>✓</span><div><strong>Protected cases checked</strong><p>${candidate.protected_regression?.passed || 12}/${(candidate.protected_regression?.passed || 12) + (candidate.protected_regression?.failed || 0)} unchanged.</p></div></div><div class="knowledge-step"><span>✓</span><div><strong>Playbook released</strong><p>${esc(candidate.new_version || 'mould-playbook-v4')} is active; rollback remains available.</p></div></div></div><div class="knowledge-release"><div><span class="quiet-label">What CasePath learned</span><h3>Test the allegation after competent evidence—not before.</h3><p>${esc(candidate.proposed_change || 'Use one neutral assessment first; make broader testing conditional; preserve the ventilation allegation as disputed.')}</p></div><div class="version-shift"><span>${esc(candidate.previous_version || 'v3')}</span><i></i><span>${esc(candidate.new_version || 'v4')}</span></div></div><div class="knowledge-delta"><article><small>Process</small><strong>${candidate.delta?.process_nodes_added || 2} decision nodes added to make evidence ordering explicit.</strong></article><article><small>Branch condition</small><strong>${candidate.delta?.branch_conditions_added || 1} recurring-moisture and disputed-ventilation condition added.</strong></article><article><small>Evidence</small><strong>${candidate.delta?.evidence_relationships_added_or_changed || 3} process-to-evidence relationships added or corrected.</strong></article><article><small>Safety</small><strong>Previous playbook preserved as ${esc(candidate.rollback_target || 'mould-playbook-v3')}.</strong></article></div>`;
    setOrchestrator('Playbook v4 is approved and ready for the next claim', true);
    showJourneyActions({ back: false, next: 'See CasePath use what it learned' });
  }

  async function startLaterClaim() {
    state.journey = 'later';
    hideJourneyActions();
    setOrchestrator('Opening an unseen related claim under the new playbook', false);
    try {
      state.laterClaim = await api(`/api/claims/${encodeURIComponent(state.demo.later_claim_id)}`);
      state.claim = state.laterClaim;
      renderClaim(state.claim);
      const created = await api('/api/runs', { method: 'POST', body: JSON.stringify({ claim_id: state.demo.later_claim_id }) });
      state.laterRun = { run_id: created.run_id, events: [], status: 'queued' };
      state.laterRunComplete = false;
      state.eventQueue = [];
      state.queuedEventIds.clear();
      $('#stageCanvas').innerHTML = `<div class="stage-shell later-run"><div class="later-source-banner"><div><span class="quiet-label">Unseen claim</span><h3>${esc(state.laterClaim.subject)}</h3><p>The customer reports recurrence beside a recently replaced window. The new playbook should influence both process and evidence ordering.</p></div><span class="new-knowledge">Playbook v4 available</span></div><div class="later-agent-stream" id="laterAgentStream"></div><div id="laterResult"></div></div>`;
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
      state.proof = await api('/api/learning-proof');
      renderLaterResult();
      setOrchestrator('The unseen claim used the new organizational playbook', true);
      renderProgress();
      showJourneyActions({ back: false, next: 'Restart the demo' });
    } catch (error) {
      renderFailure(error.message);
    }
  }

  function renderLaterResult() {
    const result = state.laterRun.result || {};
    const proof = state.proof || {};
    const before = proof.before || proof.knowledge_before || {};
    const after = proof.after || proof.knowledge_after || {};
    const newNode = result.process?.nodes?.find(node => node.node_id === 'ventilation_dispute');
    const envelope = result.checklist?.items?.find(item => item.item_id === 'building_envelope');
    $('#laterResult').innerHTML = `<div class="final-proof"><span class="quiet-label">New organizational knowledge used</span><strong>${newNode ? esc(newNode.title) : 'The reviewed evidence-order rule shaped this claim.'}</strong><p>The reviewed flagship claim is now the first precedent, and the later claim follows the released v4 playbook.</p></div><div class="before-after"><section><h4>Before reviewed knowledge</h4><h3>${esc(before.version || before.playbook_version || 'Mould playbook v3')}</h3><ul><li>Ventilation allegation remained implicit.</li><li>Broad building-envelope testing requested immediately.</li><li>One unnecessary immediate evidence request.</li></ul></section><section><h4>After reviewed knowledge</h4><h3>${esc(after.version || result.playbook?.version || 'Mould playbook v4')}</h3><ul><li class="improved">Reviewed flagship claim retrieved as the first precedent.</li><li class="improved">${newNode ? esc(newNode.title) : 'Ventilation allegation becomes an explicit process decision.'}</li><li class="improved">Building-envelope assessment: ${esc(envelope?.status === 'conditional' ? 'conditional after the first neutral assessment' : statusLabel(envelope?.status))}.</li><li class="improved">Unnecessary immediate requests: ${result.generated_benchmark_metrics?.unnecessary_immediate_requests ?? 0}.</li></ul></section></div>`;
  }

  function restartDemo() {
    location.href = location.pathname + '?release=live-workspace-v16';
  }

  function renderFailure(message) {
    setOrchestrator('CasePath stopped safely', true);
    $('#stageCanvas').innerHTML = `<div class="stage-shell">${stageHeader({ label: 'Safe failure', short: '!', job: 'No canonical state was changed' }, 'The claim was not changed.', message)}<button class="primary-button" type="button" onclick="location.reload()">Retry</button></div>`;
  }

  function bindSourceLinks(root = document) {
    $$('[data-source-ref]', root).forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = 'true';
      button.addEventListener('click', event => {
        event.stopPropagation();
        openSource(button.dataset.sourceRef, Number(button.dataset.sourcePage || 1));
      });
    });
  }

  function findArtifact(artifactId) {
    return (state.claim?.artifacts || []).find(item => item.artifact_id === artifactId)
      || (state.flagshipClaim?.artifacts || []).find(item => item.artifact_id === artifactId)
      || (state.laterClaim?.artifacts || []).find(item => item.artifact_id === artifactId)
      || null;
  }

  async function openSource(artifactId, page = 1) {
    if (artifactId === 'message') return openMessageSource(page);
    const artifact = findArtifact(artifactId);
    if (!artifact) {
      toast('That source is not in the current claim package.');
      return;
    }
    state.viewer = { artifact, extraction: null, page: Math.max(1, page), zoom: 1, tab: 'original' };
    $('#sourceViewerKind').textContent = 'Original attachment';
    $('#sourceViewerTitle').textContent = artifact.title;
    $('#sourceViewerMeta').textContent = `${artifact.filename} · ${mimeLabel(artifact)} · received ${formatDate(artifact.received_at)}`;
    $('#openOriginal').href = artifactUrl(artifact.artifact_id);
    setSourceTab('original');
    renderSourceViewer();
    renderSourceEvidence(artifact.artifact_id);
    $('#sourceViewer').showModal();
  }

  function openMessageSource() {
    const claim = state.claim || state.flagshipClaim;
    state.viewer = { artifact: { artifact_id: 'message', title: 'Customer message', filename: 'customer-message', media_type: 'message/rfc822', page_count: 1 }, extraction: null, page: 1, zoom: 1, tab: 'original' };
    $('#sourceViewerKind').textContent = 'Original customer message';
    $('#sourceViewerTitle').textContent = claim.subject;
    $('#sourceViewerMeta').textContent = `${claim.customer?.name || 'Customer'} · received ${formatDate(claim.received_at)}`;
    $('#openOriginal').removeAttribute('href');
    setSourceTab('original');
    renderSourceViewer();
    renderSourceEvidence('message');
    $('#sourceViewer').showModal();
  }

  async function renderSourceViewer() {
    const { artifact, page, zoom, tab } = state.viewer;
    $('#zoomValue').textContent = `${Math.round(zoom * 100)}%`;
    if (tab === 'extraction') return renderExtraction();
    $('#pageThumbnails').hidden = artifact.media_type !== 'application/pdf';
    if (artifact.media_type === 'application/pdf') {
      $('#pageThumbnails').innerHTML = Array.from({ length: artifact.page_count || 1 }, (_, index) => `<button class="page-thumb" type="button" data-page="${index + 1}" aria-current="${index + 1 === page ? 'page' : 'false'}"><img src="${pageUrl(artifact.artifact_id, index + 1)}" alt="Page ${index + 1}"><span>${index + 1}</span></button>`).join('');
      $('#sourceStage').innerHTML = `<img id="documentPage" src="${pageUrl(artifact.artifact_id, page)}" alt="${esc(artifact.title)}, page ${page}" style="transform:scale(${zoom})">`;
      $$('.page-thumb').forEach(button => button.addEventListener('click', () => {
        state.viewer.page = Number(button.dataset.page);
        renderSourceViewer();
      }));
    } else if (artifact.media_type?.startsWith('image/')) {
      $('#sourceStage').innerHTML = `<img id="sourceImage" src="${artifactUrl(artifact.artifact_id)}" alt="${esc(artifact.title)}" style="transform:scale(${zoom})">`;
    } else if (artifact.artifact_id === 'message') {
      const claim = state.claim || state.flagshipClaim;
      $('#sourceStage').innerHTML = `<article class="email-document" style="transform:scale(${zoom})"><dl><dt>From</dt><dd>${esc(claim.customer?.name || 'Customer')}</dd><dt>To</dt><dd>Legal protection claims</dd><dt>Received</dt><dd>${esc(formatDate(claim.received_at))}</dd><dt>Subject</dt><dd>${esc(claim.subject)}</dd></dl><pre>${esc(claim.message)}</pre></article>`;
    } else {
      try {
        const extraction = await api(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}/extraction`);
        state.viewer.extraction = extraction;
        const email = extraction.email || {};
        $('#sourceStage').innerHTML = `<article class="email-document" style="transform:scale(${zoom})"><dl><dt>From</dt><dd>${esc(email.from || '')}</dd><dt>To</dt><dd>${esc(email.to || '')}</dd><dt>Date</dt><dd>${esc(email.date || '')}</dd><dt>Subject</dt><dd>${esc(email.subject || artifact.title)}</dd></dl><pre>${esc(email.body || '')}</pre></article>`;
      } catch (error) {
        $('#sourceStage').innerHTML = `<p>${esc(error.message)}</p>`;
      }
    }
  }

  async function renderExtraction() {
    const artifact = state.viewer.artifact;
    $('#pageThumbnails').hidden = true;
    if (artifact.artifact_id === 'message') {
      const claim = state.claim || state.flagshipClaim;
      $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page"><h3>Machine-visible customer message</h3><pre>${esc(claim.message)}</pre></div></div>`;
      return;
    }
    try {
      if (!state.viewer.extraction) state.viewer.extraction = await api(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}/extraction`);
      const extraction = state.viewer.extraction;
      if (extraction.pages) {
        $('#sourceStage').innerHTML = `<div class="extraction-pages">${extraction.pages.map((text, index) => `<div class="extraction-page"><h3>Page ${index + 1}</h3><pre>${esc(text || 'No text extracted.')}</pre></div>`).join('')}</div>`;
      } else if (extraction.email) {
        $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page"><h3>Structured email fields</h3><pre>${esc(JSON.stringify(extraction.email, null, 2))}</pre></div></div>`;
      } else {
        $('#sourceStage').innerHTML = `<div class="extraction-pages"><div class="extraction-page"><h3>Machine-visible image record</h3><pre>${esc(extraction.image_note || 'Original pixels and metadata preserved.')}</pre></div></div>`;
      }
    } catch (error) {
      $('#sourceStage').innerHTML = `<p>${esc(error.message)}</p>`;
    }
  }

  function renderSourceEvidence(artifactId) {
    const facts = (currentRun()?.result?.facts || currentRun()?.understanding?.facts || []).filter(fact => (fact.source_refs || []).some(ref => ref.artifact_id === artifactId));
    $('#sourceEvidence').innerHTML = `<h3>Facts linked to this source</h3><p>Evidence → facts derived from it.</p>${facts.length ? facts.map(fact => `<article class="source-fact"><strong>${esc(fact.label)} — ${esc(fact.value)}</strong><p>${esc(fact.explanation)}</p></article>`).join('') : '<article class="source-fact"><p>No current claim fact points to this source yet.</p></article>'}`;
  }

  function setSourceTab(tab) {
    state.viewer.tab = tab;
    $$('[data-source-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.sourceTab === tab)));
    renderSourceViewer();
  }

  function openPrecedent(index) {
    const precedent = (state.run?.precedents || state.run?.result?.precedents || [])[index];
    if (!precedent) return;
    $('#precedentTitle').textContent = `${precedent.claim_id} · ${precedent.title}`;
    $('#precedentContent').innerHTML = `<p class="precedent-summary">${esc(precedent.why_useful)}</p><div class="precedent-grid"><section><h3>Relevant branch</h3><p>${esc((precedent.final_process || []).join(' → '))}</p></section><section><h3>Evidence that mattered</h3><ul>${(precedent.evidence || []).map(item => `<li>${esc(typeof item === 'string' ? item : item.title || JSON.stringify(item))}</li>`).join('')}</ul></section><section><h3>Expert lesson</h3><p>${esc(precedent.expert_correction || precedent.expert_explanation || '')}</p></section><section><h3>Outcome</h3><p>${esc(precedent.outcome || 'Reviewed case memory')}</p></section></div>`;
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
    $('#auditContent').innerHTML = (run.events || []).map(event => `<details class="audit-event" ${event.stage === state.activeStage ? 'open' : ''}><summary><span></span><div><strong>${esc(event.label)}</strong><span>${esc(event.headline || '')}</span></div><span>${esc(event.status || '')}</span></summary><div class="audit-event-body"><p>${esc(event.detail || '')}</p><dl class="audit-grid"><dt>Specialist</dt><dd>${esc(event.agent || '')}</dd><dt>Implementation</dt><dd>${esc(event.implementation || '')}</dd><dt>Model</dt><dd>${esc(event.model || 'None — deterministic or human')}</dd><dt>Prompt</dt><dd>${esc(event.prompt_version || 'None')}</dd><dt>Validator</dt><dd>${esc(event.validator || '')}</dd><dt>Input</dt><dd>${esc((event.input_artifacts || []).join(', ') || event.input_hash || '')}</dd><dt>Output</dt><dd>${esc(event.output_artifact || event.output_hash || '')}</dd></dl></div></details>`).join('');
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
      else if (state.journey === 'knowledge') startLaterClaim();
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
    $('#closeSourceViewer').addEventListener('click', () => $('#sourceViewer').close());
    $('#closePrecedent').addEventListener('click', () => $('#precedentViewer').close());
    $$('[data-source-tab]').forEach(button => button.addEventListener('click', () => setSourceTab(button.dataset.sourceTab)));
    $('#zoomIn').addEventListener('click', () => { state.viewer.zoom = Math.min(2, state.viewer.zoom + .15); renderSourceViewer(); });
    $('#zoomOut').addEventListener('click', () => { state.viewer.zoom = Math.max(.55, state.viewer.zoom - .15); renderSourceViewer(); });
    [$('#sourceViewer'), $('#auditDrawer'), $('#precedentViewer')].forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        [$('#sourceViewer'), $('#auditDrawer'), $('#precedentViewer')].forEach(dialog => { if (dialog.open) dialog.close(); });
      }
    });
    bindSourceLinks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
