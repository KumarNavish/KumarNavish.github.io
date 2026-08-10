(() => {
  'use strict';

  const RELEASE = '18.0.0';
  const params = new URLSearchParams(location.search);
  const API = (params.get('api') || window.CASEPATH_API || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
  const stageOrder = ['read', 'understand', 'research', 'process', 'evidence', 'experience', 'verify'];
  const stages = {
    read: { label: 'Read evidence', agent: 'Attachment Parsing Agent', job: 'Reading the customer message and every original attachment.' },
    understand: { label: 'Understand claim', agent: 'Claim Understanding Agent', job: 'Separating supported facts, allegations, conflicts, and unknowns.' },
    research: { label: 'Research law', agent: 'Legal Research Agent', job: 'Connecting Swiss-law sources to the decisions they shape.' },
    process: { label: 'Build process', agent: 'Process Discovery Agent', job: 'Working out every decision from intake to resolution.' },
    evidence: { label: 'Map evidence', agent: 'Document Requirements Agent', job: 'Attaching facts and evidence needs to each process decision.' },
    experience: { label: 'Find experience', agent: 'Historical Claims Agent', job: 'Finding reviewed claims that help at the difficult branch.' },
    verify: { label: 'Verify plan', agent: 'Verification Agent', job: 'Checking graph integrity, grounding, and document traceability.' },
  };
  const artifactLabels = {
    read: 'source package',
    understand: 'claim state',
    research: 'legal context',
    process: 'handling process',
    evidence: 'evidence model',
    experience: 'reviewed experience',
    verify: 'verified playbook',
  };

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
  const humanize = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
  const unique = values => [...new Set(values.filter(Boolean))];
  const runIds = [];
  const runCache = new Map();
  let scheduled = false;
  let highestPresentedStage = -1;

  document.documentElement.dataset.casepathExperience = RELEASE;
  window.CASEPATH_EXPERIENCE_RELEASE = RELEASE;
  window.CASEPATH_RUN_IDS = runIds;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);
    try {
      const requestUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
      const method = String(init.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const parsed = new URL(requestUrl, location.href);
      if (method === 'POST' && parsed.origin === new URL(API).origin && parsed.pathname === '/api/runs' && response.ok) {
        response.clone().json().then(value => {
          if (value?.run_id && !runIds.includes(value.run_id)) runIds.push(value.run_id);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  function discoveredRunIds() {
    const ids = [...runIds];
    for (const entry of performance.getEntriesByType('resource')) {
      try {
        const url = new URL(entry.name);
        const match = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
        if (match && !ids.includes(match[1])) ids.push(match[1]);
      } catch (_) {}
    }
    return ids;
  }

  async function fetchJson(path) {
    const response = await originalFetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${response.status} ${path}`);
    return response.json();
  }

  async function currentRun({ fresh = false, first = false } = {}) {
    const ids = discoveredRunIds();
    const runId = first ? ids[0] : ids.at(-1);
    if (!runId) return null;
    const cached = runCache.get(runId);
    if (!fresh && cached && Date.now() - cached.fetchedAt < 450) return cached.value;
    try {
      const value = await fetchJson(`/api/runs/${encodeURIComponent(runId)}`);
      runCache.set(runId, { value, fetchedAt: Date.now() });
      return value;
    } catch (_) {
      return cached?.value || null;
    }
  }

  function stageFromCanvas(canvas) {
    const text = canvas?.textContent || '';
    if (!canvas) return { kind: 'opening', stage: null };
    if (canvas.querySelector('#reviewForm')) return { kind: 'review', stage: null };
    if (canvas.querySelector('.knowledge-agent')) return { kind: 'knowledge', stage: null };
    if (canvas.querySelector('.later-run')) return { kind: 'later', stage: null };
    if (canvas.querySelector('.artifact-summary,.v17-derived-checklist') || /Handling playbook ready|reconstructed how this claim should be handled/i.test(text)) return { kind: 'ready', stage: null };
    if (/passed its acceptance checks|checking the complete playbook|Acceptance checks/i.test(text)) return { kind: 'stage', stage: 'verify' };
    if (/Previous cases are helping|asking organizational memory|organizational experience/i.test(text)) return { kind: 'stage', stage: 'experience' };
    if (/Evidence now follows|attaching evidence needs|attaching evidence to the process/i.test(text)) return { kind: 'stage', stage: 'evidence' };
    if (/complete handling process is taking shape|building the handling process|Reconstructing the handling process/i.test(text)) return { kind: 'stage', stage: 'process' };
    if (/Swiss law has become handling questions|Turning legal sources/i.test(text) || canvas.querySelector('.law-flow,.v17-law-map')) return { kind: 'stage', stage: 'research' };
    if (/separated what is known|Reconciling claims/i.test(text) || canvas.querySelector('.fact-stream')) return { kind: 'stage', stage: 'understand' };
    if (/original submission is in the shared claim context|Reading the message/i.test(text) || canvas.querySelector('.event-list')) return { kind: 'stage', stage: 'read' };
    return { kind: 'opening', stage: null };
  }

  function progressContext(stageIndex) {
    if (stageIndex < 0) return 'One shared claim context is opening.';
    return `Shared context: ${stageOrder.slice(0, stageIndex + 1).map(stage => artifactLabels[stage]).join(' → ')}`;
  }

  function renderProgress() {
    const nav = document.querySelector('#agentProgress');
    const canvas = document.querySelector('#stageCanvas');
    if (!nav || !canvas || document.querySelector('#liveWorkspace')?.hidden) return;
    const current = stageFromCanvas(canvas);
    let state = 'opening';
    let count = '0/7';
    let agent = 'CasePath orchestrator';
    let label = 'Opening the claim';
    let job = 'Creating one shared context for every specialist.';
    let nextLabel = 'Read evidence';
    let context = 'One shared claim context is opening.';
    let activeStage = '';

    if (current.kind === 'stage' && current.stage) {
      const index = stageOrder.indexOf(current.stage);
      highestPresentedStage = Math.max(highestPresentedStage, index);
      const stage = stages[current.stage];
      state = 'active';
      count = `${index + 1}/7`;
      agent = stage.agent;
      label = stage.label;
      job = stage.job;
      nextLabel = stages[stageOrder[index + 1]]?.label || 'Expert review';
      context = progressContext(index);
      activeStage = current.stage;
    } else if (current.kind === 'ready') {
      highestPresentedStage = stageOrder.length - 1;
      state = 'complete';
      count = '✓';
      agent = 'CasePath team';
      label = 'Ready for expert review';
      job = 'The process, evidence model, and reviewed experience are together in one playbook.';
      nextLabel = 'Review the playbook';
      context = progressContext(stageOrder.length - 1);
    } else if (current.kind === 'review') {
      state = 'human';
      count = 'EX';
      agent = 'Expert review';
      label = 'Correct the reasoning where it matters';
      job = 'The process, evidence order, and next action update together.';
      nextLabel = 'Knowledge Agent';
      context = 'Human correction is being applied to the generated playbook.';
    } else if (current.kind === 'knowledge') {
      state = 'knowledge';
      count = 'KA';
      agent = 'Knowledge Agent';
      label = 'Decide what can safely be reused';
      job = 'Reviewed memory is immediate; shared playbook changes pass support and regression gates.';
      nextLabel = 'Unseen claim';
      context = 'Expert correction → reviewed memory → tested playbook release.';
    } else if (current.kind === 'later') {
      state = 'reuse';
      count = '↻';
      const latest = [...canvas.querySelectorAll('.later-agent-row strong')].at(-1)?.textContent?.trim();
      agent = latest ? `${latest} specialist` : 'CasePath team';
      label = latest ? 'Re-running the unseen claim' : 'Opening an unseen claim';
      job = 'The same agent team is working under the newly released playbook.';
      nextLabel = canvas.querySelector('#laterResult .before-after') ? 'Improved result' : 'Next specialist';
      context = 'Reviewed memory and playbook v4 are available to this new claim.';
    }

    nav.innerHTML = `
      <div class="v18-progress-focus" data-state="${esc(state)}" data-active-stage="${esc(activeStage)}">
        <span class="v18-progress-count" aria-hidden="true">${esc(count)}</span>
        <div class="v18-progress-copy">
          <small>${esc(agent)}</small>
          <strong>${esc(label)}</strong>
          <p>${esc(job)}</p>
          <span class="v18-progress-context">${esc(context)}</span>
        </div>
        <div class="v18-progress-next"><span>Next</span><strong>${esc(nextLabel)}</strong></div>
      </div>`;
  }

  function stageCompletedInCanvas(canvas, stage) {
    return {
      read: Boolean(canvas.querySelector('.event-list')),
      understand: Boolean(canvas.querySelector('.fact-stream')),
      research: Boolean(canvas.querySelector('.law-flow,.v17-law-map')),
      process: Boolean(canvas.querySelector('.process-layout')),
      evidence: Boolean(canvas.querySelector('.process-layout') && /Evidence now follows/i.test(canvas.textContent || '')),
      experience: Boolean(canvas.querySelector('.precedent-inline')),
      verify: Boolean(canvas.querySelector('.verification-list') && /acceptance checks/i.test(canvas.textContent || '')),
    }[stage];
  }

  async function enhanceHandoff(canvas) {
    const current = stageFromCanvas(canvas);
    if (current.kind !== 'stage' || !current.stage || canvas.querySelector('.v18-handoff')) return;
    const run = await currentRun();
    if (!run || !document.contains(canvas)) return;
    const completed = stageCompletedInCanvas(canvas, current.stage);
    const events = (run.events || []).filter(event => event.stage === current.stage);
    const event = [...events].reverse().find(item => item.status === (completed ? 'completed' : 'started')) || events.at(-1);
    if (!event) return;
    const shell = canvas.querySelector('.stage-shell');
    if (!shell) return;
    const output = humanize(event.output_artifact || 'shared claim context');
    const message = completed
      ? `${event.agent || stages[current.stage].agent} added ${output.toLowerCase()} to the shared claim context${event.handoff_to ? ` for ${event.handoff_to}` : ''}.`
      : event.question || event.detail || stages[current.stage].job;
    shell.insertAdjacentHTML('beforeend', `
      <div class="v18-handoff" data-event-stage="${esc(current.stage)}" data-event-status="${esc(event.status || '')}" data-output-artifact="${esc(event.output_artifact || '')}">
        <span aria-hidden="true"></span>
        <div><small>${completed ? 'Live handoff' : 'Question in the shared context'}</small><strong>${esc(message)}</strong></div>
      </div>`);
  }

  async function replaceSyntheticBuildState(canvas) {
    const state = canvas.querySelector('.v17-build-state:not([data-v18-backed="true"])');
    if (!state) return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(state)) return;
    const current = stageFromCanvas(canvas);
    const result = run.result || {};
    const process = run.process || result.process || {};
    const checklist = run.checklist || result.checklist || {};
    const precedents = run.precedents || result.precedents || [];
    const verification = run.verification || result.verification || {};
    const copy = {
      process: {
        title: 'Handling process accepted from the backend',
        detail: `${(process.main_spine || []).length || 0} main decisions and ${(process.nodes || []).reduce((total, node) => total + (node.branches?.length || 0), 0)} causation outcomes passed the graph validator. The accepted artifact is being revealed below.`,
        artifact: 'process_graph',
      },
      evidence: {
        title: 'Evidence links accepted from the backend',
        detail: `${(checklist.items || []).length || 0} relationships point back to ${new Set((checklist.items || []).map(item => item.node_id)).size} process decisions. Every link retains a fact and reason.`,
        artifact: 'evidence_model',
      },
      experience: {
        title: 'Reviewed experience connected to the difficult branch',
        detail: `${precedents.length || 0} expert-reviewed claims were returned for the unresolved causation and evidence-order question.`,
        artifact: 'precedents',
      },
      verify: {
        title: 'The complete playbook passed its acceptance gate',
        detail: `${(verification.checks || verification.accepted_checks || []).length || 0} checks cover graph integrity, legal links, evidence traceability, and no-repeat document requests.`,
        artifact: 'verification_report',
      },
    }[current.stage];
    if (!copy) return;
    const label = state.querySelector('[data-v17-build-label], strong');
    if (label) {
      const truthful = document.createElement('strong');
      truthful.textContent = copy.title;
      label.replaceWith(truthful);
    }
    const description = state.querySelector('p');
    if (description) description.textContent = copy.detail;
    const small = state.querySelector('small');
    if (small) small.textContent = 'Backend artifact accepted';
    state.querySelector('.v17-build-meter')?.remove();
    state.dataset.v18Backed = 'true';
    state.dataset.outputArtifact = copy.artifact;
    state.dataset.runId = run.run_id || '';
  }

  function condenseChecklist(canvas) {
    const checklist = canvas.querySelector('.v17-derived-checklist:not([data-v18-condensed="true"])');
    if (!checklist) return;
    for (const group of checklist.querySelectorAll('.v17-checklist-group')) {
      const header = group.querySelector(':scope > header');
      const items = [...group.querySelectorAll('.v17-checklist-item')];
      if (!header || !items.length) continue;
      const first = items[0];
      const remaining = items.slice(1);
      const existingDetails = [...group.querySelectorAll(':scope > details')];
      for (const item of items) item.remove();
      for (const details of existingDetails) details.remove();
      group.append(first);
      if (remaining.length) {
        const details = document.createElement('details');
        details.className = 'v18-checklist-details';
        details.innerHTML = `<summary>Show ${remaining.length} more</summary>`;
        for (const item of remaining) details.append(item);
        group.append(details);
      }
    }
    checklist.dataset.v18Condensed = 'true';
  }

  async function enhanceReady(canvas) {
    if (!canvas.querySelector('.v17-derived-checklist')) return;
    condenseChecklist(canvas);
    if (canvas.querySelector('.v18-ready-artifacts')) return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(canvas)) return;
    const result = run.result || {};
    const process = result.process || run.process || {};
    const checklist = result.checklist || run.checklist || {};
    const precedents = result.precedents || run.precedents || [];
    const anchor = canvas.querySelector('.synthesis-primary > .process-layout');
    if (!anchor) return;
    const rail = document.createElement('section');
    rail.className = 'v18-ready-artifacts';
    rail.setAttribute('aria-label', 'The three artifacts ready for expert review');
    rail.innerHTML = `
      <article><small>Handling process</small><strong>From intake to closure</strong><p>${(process.main_spine || []).length || 0} main decisions; the current claim remains at causation.</p></article>
      <article><small>Evidence</small><strong>Linked to each decision</strong><p>${(checklist.items || []).length || 0} fact-and-reason relationships, grouped by current status.</p></article>
      <article><small>Previous cases</small><strong>At the difficult branch</strong><p>${precedents.length || 0} reviewed claims contribute institutional experience.</p></article>`;
    anchor.parentNode.insertBefore(rail, anchor);
  }

  function reviewRows(form) {
    return [...form.querySelectorAll('#reviewImpact .review-impact-row')].map(row => ({
      label: row.querySelector('small')?.textContent?.trim() || '',
      value: row.querySelector('strong')?.textContent?.trim() || '',
    })).filter(row => row.label && row.value);
  }

  function renderReviewPropagation(form) {
    if (!form) return;
    let panel = form.querySelector('.v18-review-propagation');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'v18-review-propagation';
      panel.setAttribute('aria-label', 'How the expert correction propagates');
      form.querySelector('#reviewImpact')?.before(panel);
    }
    const rows = reviewRows(form);
    panel.innerHTML = `<header><small>Correction propagation</small><strong>One expert choice changes the generated artifacts together.</strong></header><div>${rows.map((row, index) => `<article><span>${index + 1}</span><small>${esc(row.label)}</small><strong>${esc(row.value)}</strong></article>`).join('')}</div>`;
  }

  function markReviewGraph(canvas) {
    const graph = canvas.querySelector('.review-graph');
    if (!graph) return;
    const mark = (id, className) => graph.querySelector(`[data-node-id="${id}"]`)?.closest('.process-node')?.classList.add(className);
    mark('causation', 'v18-review-source');
    mark('responsibility', 'v18-review-downstream');
    mark('remedy', 'v18-review-downstream');
    if (!graph.querySelector('.v18-review-hint')) {
      graph.insertAdjacentHTML('afterbegin', '<p class="v18-review-hint">Select any process decision to inspect its facts, law, and evidence. The highlighted decision is where this correction begins.</p>');
    }
  }

  function enhanceReview(canvas) {
    const form = canvas.querySelector('#reviewForm');
    if (!form) return;
    markReviewGraph(canvas);
    renderReviewPropagation(form);
    if (form.dataset.v18Bound !== 'true') {
      form.dataset.v18Bound = 'true';
      form.addEventListener('change', event => {
        if (!event.target.matches('input[name="building_envelope_mode"]')) return;
        requestAnimationFrame(() => renderReviewPropagation(form));
      });
    }
  }

  async function enhanceKnowledge(canvas) {
    const flow = canvas.querySelector('#knowledgeResult .knowledge-flow');
    if (!flow || canvas.querySelector('.v18-memory-boundary')) return;
    const run = await currentRun({ fresh: true, first: true });
    if (!run || !document.contains(flow)) return;
    const candidate = run.candidate || run.result?.knowledge_update || {};
    const boundary = document.createElement('section');
    boundary.className = 'v18-memory-boundary';
    boundary.innerHTML = `
      <article><small>Available immediately</small><strong>Reviewed claim memory</strong><p>The expert-reviewed case can now help later precedent retrieval.</p></article>
      <span aria-hidden="true"></span>
      <article><small>Shared only after gates</small><strong>${esc(candidate.new_version || 'Approved playbook')}</strong><p>Support, target tests, protected regression, approval, and rollback are recorded before release.</p></article>`;
    flow.parentNode.insertBefore(boundary, flow);
  }

  async function enhanceReuse(canvas) {
    const thread = canvas.querySelector('.v17-reuse-thread');
    if (!thread || thread.closest('.v18-reuse-proof')) return;
    const wrapper = document.createElement('section');
    wrapper.className = 'v18-reuse-proof';
    wrapper.innerHTML = '<header><small>New organizational knowledge used</small><strong>This is the exact path from reviewed experience to a better unseen claim.</strong></header>';
    thread.parentNode.insertBefore(wrapper, thread);
    wrapper.append(thread);
  }

  function markLawAsBacked(canvas) {
    const map = canvas.querySelector('.v17-law-map:not([data-v18-backed="true"])');
    if (!map) return;
    map.dataset.v18Backed = 'true';
    map.setAttribute('aria-label', 'Swiss-law sources connected to the process decisions they shape');
  }

  function markRelease() {
    document.body.dataset.casepathRelease = RELEASE;
    const evidenceLink = document.querySelector('#browserEvidenceLink');
    if (evidenceLink) evidenceLink.textContent = 'Guided session evidence · v18';
    const auditHeader = document.querySelector('#auditDrawer .audit-shell > header');
    if (auditHeader && !auditHeader.querySelector('.v18-release-tag')) {
      const tag = document.createElement('span');
      tag.className = 'v18-release-tag';
      tag.textContent = `Experience ${RELEASE}`;
      evidenceLink?.before(tag);
    }
  }

  async function enhance() {
    renderProgress();
    markRelease();
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;
    markLawAsBacked(canvas);
    await replaceSyntheticBuildState(canvas);
    await enhanceHandoff(canvas);
    await enhanceReady(canvas);
    enhanceReview(canvas);
    await enhanceKnowledge(canvas);
    await enhanceReuse(canvas);
  }

  function queueEnhancement() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await enhance();
    });
  }

  function boot() {
    const observer = new MutationObserver(queueEnhancement);
    for (const target of [document.querySelector('#agentProgress'), document.querySelector('#stageCanvas'), document.querySelector('#auditDrawer')]) {
      if (target) observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
    }
    if ('PerformanceObserver' in window) {
      try {
        const performanceObserver = new PerformanceObserver(queueEnhancement);
        performanceObserver.observe({ type: 'resource', buffered: true });
      } catch (_) {}
    }
    window.setInterval(queueEnhancement, 450);
    queueEnhancement();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
