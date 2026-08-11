(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const API = (params.get('api') || window.CASEPATH_API || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const STAGES = {
    read: {
      label: 'Read evidence',
      agent: 'Attachment Parsing Tool',
      job: 'Reading the customer message and every original attachment.',
    },
    understand: {
      label: 'Understand claim',
      agent: 'Canonical Claim Preparation Tool',
      job: 'Separating supported facts, allegations, conflicts, and unknowns.',
    },
    research: {
      label: 'Research law',
      agent: 'Swiss Legal Source Tool',
      job: 'Finding the Swiss-law questions that shape this process.',
    },
    process: {
      label: 'Build process',
      agent: 'Process Projection Tool',
      job: 'Working out every decision from intake to resolution.',
    },
    evidence: {
      label: 'Map evidence',
      agent: 'Evidence Checklist Tool',
      job: 'Attaching facts and evidence needs to each process decision.',
    },
    experience: {
      label: 'Find experience',
      agent: 'Historical Retrieval Tool',
      job: 'Finding provenance-labelled reference precedents at the difficult branch.',
    },
    verify: {
      label: 'Verify plan',
      agent: 'Whole-Playbook Verification Gate',
      job: 'Checking graph integrity, grounding, and document traceability.',
    },
  };

  const NODE_TITLES = {
    intake: 'Claim intake',
    scope: 'Tenant-law scope',
    dispute: 'Existence of a dispute',
    urgency: 'Urgency and safety',
    notification: 'Landlord notification',
    defect: 'Defect and recurrence',
    causation: 'Causation assessment',
    responsibility: 'Responsibility',
    remedy: 'Remedy selection',
    escalation: 'Escalation',
    resolution: 'Resolution and closure',
    evidence_gap: 'Causation evidence loop',
    ventilation_dispute: 'Test the ventilation allegation',
  };

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const unique = values => [...new Set(values.filter(Boolean))];
  const statusName = status => ({
    provided_sufficient: 'Available',
    provided_insufficient: 'Needs stronger evidence',
    missing: 'Missing',
    conditional: 'Conditional',
    not_applicable: 'Not needed on this path',
  })[status] || String(status || '').replaceAll('_', ' ');

  let scheduled = false;
  let lastProcessMarkup = '';
  let lastProcessRunId = '';
  let pendingReview = null;
  const runCache = new Map();

  async function fetchJson(path) {
    const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${response.status} ${path}`);
    return response.json();
  }

  function discoveredRunIds() {
    const ids = [];
    for (const entry of performance.getEntriesByType('resource')) {
      try {
        const url = new URL(entry.name);
        const match = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
        if (match && !ids.includes(match[1])) ids.push(match[1]);
      } catch (_) {}
    }
    return ids;
  }

  async function currentRun({ fresh = false } = {}) {
    const ids = discoveredRunIds();
    const displayedRunId = document.body.dataset.casepathActiveRunId;
    const runId = displayedRunId || ids.at(-1);
    if (!runId) return null;
    const cached = runCache.get(runId);
    if (!fresh && cached && Date.now() - cached.fetchedAt < 350) return cached.value;
    try {
      const value = await fetchJson(`/api/runs/${encodeURIComponent(runId)}`);
      runCache.set(runId, { value, fetchedAt: Date.now() });
      return value;
    } catch (_) {
      return cached?.value || null;
    }
  }

  function enhanceProgress() {
    const nav = document.querySelector('#agentProgress');
    if (!nav) return;
    const steps = [...nav.querySelectorAll('.agent-step')];
    if (!steps.length) return;

    const completedIds = steps.filter(step => step.classList.contains('complete')).map(step => step.dataset.progressStage);
    const activeStep = steps.find(step => step.classList.contains('active'));
    const activeId = activeStep?.dataset.progressStage || null;
    const remaining = steps.map(step => step.dataset.progressStage).filter(id => !completedIds.includes(id) && id !== activeId);
    const complete = completedIds.length === steps.length;
    const opening = !activeId && completedIds.length === 0;
    const focus = complete
      ? { label: 'Playbook ready', agent: 'CasePath team', job: 'The complete process is ready for a simulated demo review.' }
      : opening
        ? { label: 'Opening the claim', agent: 'CasePath orchestrator', job: 'Creating one shared context for every specialist.' }
        : STAGES[activeId] || { label: 'Working', agent: 'CasePath specialist', job: '' };
    const next = remaining.length ? STAGES[remaining[0]] : null;
    const state = complete ? 'complete' : activeId ? 'active' : 'opening';
    const count = complete ? '✓' : `${completedIds.length + (activeId ? 1 : 0)}/${steps.length}`;

    nav.innerHTML = `
      <div class="v17-progress-focus" data-state="${state}" data-active-stage="${esc(activeId || '')}">
        <span class="v17-progress-count" aria-hidden="true">${esc(count)}</span>
        <div class="v17-progress-copy">
          <small>${esc(focus.agent)}</small>
          <strong>${esc(focus.label)}</strong>
          <p>${esc(focus.job)}</p>
        </div>
        <div class="v17-progress-next">
          <span>${next ? 'Next specialist' : complete ? 'Next step' : 'Shared context'}</span>
          <strong>${esc(next?.label || (complete ? 'Demo review' : 'All agents use the same claim'))}</strong>
        </div>
      </div>`;
  }

  function modeForCanvas(canvas) {
    const text = canvas.textContent || '';
    if (/Handling playbook ready|reconstructed how this claim should be handled/i.test(text)) return 'ready';
    if (/Review the decision that controls|Simulated demo review/i.test(text)) return 'review';
    if (/Previous cases are helping|organizational memory/i.test(text)) return 'experience';
    if (/Evidence now follows|attaching evidence|What this decision requires/i.test(text)) return 'evidence';
    if (/acceptance checks|passed its acceptance|verifying/i.test(text)) return 'verify';
    if (/complete handling process is taking shape|building the handling process/i.test(text)) return 'process';
    return '';
  }

  function preserveProcessDuringHandoff(canvas) {
    if (canvas.querySelector('.process-layout') || !lastProcessMarkup) return;
    const activeRunId = document.body.dataset.casepathActiveRunId || '';
    if (!activeRunId || activeRunId !== lastProcessRunId) return;
    const text = canvas.textContent || '';
    let label = '';
    let detail = '';
    if (/attaching evidence needs|attaching evidence/i.test(text)) {
      label = 'Evidence Checklist Tool';
      detail = 'Attaching each fact and evidence requirement to the decision it can resolve.';
    } else if (/asking organizational memory|organizational experience/i.test(text)) {
      label = 'Historical Retrieval Tool';
      detail = 'Searching provenance-labelled reference precedents at the unresolved causation branch.';
    } else if (/verif|checking the complete playbook/i.test(text)) {
      label = 'Whole-Playbook Verification Gate';
      detail = 'Checking the graph and every process-to-evidence relationship before review.';
    }
    if (!label || canvas.querySelector('.v17-continuity')) return;
    canvas.insertAdjacentHTML('beforeend', `
      <section class="v17-continuity" aria-label="The process remains visible while the next specialist contributes">
        <div class="v17-continuity-note"><span></span><div><small>${esc(label)}</small><strong>${esc(detail)}</strong></div></div>
        ${lastProcessMarkup}
      </section>`);
  }

  async function enhanceLaw(canvas) {
    const lawFlow = canvas.querySelector('.law-flow');
    if (!lawFlow || canvas.querySelector('.v17-law-map')) return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(lawFlow)) return;
    const legal = run.legal_research || run.result?.legal_research;
    if (!legal) return;

    const nodeLinks = legal.node_links || {};
    const sources = [...(legal.sources || []), ...(legal.handling_principles || [])];
    const linked = sources.map(source => {
      const targets = Object.entries(nodeLinks)
        .filter(([, sourceIds]) => (sourceIds || []).includes(source.source_id))
        .map(([nodeId]) => nodeId);
      return { source, targets };
    }).filter(item => item.targets.length).slice(0, 4);
    if (!linked.length) return;

    const map = document.createElement('section');
    map.className = 'v17-law-map';
    map.innerHTML = `
      <header class="v17-law-map-head">
        <div><span class="quiet-label">Law shapes the process</span><strong>Each retained source creates or constrains a handling decision.</strong><p>CasePath keeps the connection visible instead of separating legal research from the process it changes.</p></div>
      </header>
      ${linked.map(({ source, targets }) => `
        <article class="v17-law-link">
          <div class="v17-law-source">
            <small>${esc(source.url ? 'Official source' : 'Model interpretation · unapproved handling proposal')}</small>
            <strong>${esc(source.title)}</strong>
            <p>${esc(source.role || '')}</p>
            <p><b>Review state:</b> ${esc(source.validation_status || legal.review_status || (source.url ? 'Official source; handling interpretation remains reviewable' : 'Unapproved'))}</p>
            ${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">Open official source</a>` : ''}
          </div>
          <span class="v17-law-arrow" aria-hidden="true"></span>
          <div class="v17-law-target">
            <small>Shapes this process decision</small>
            <strong>${esc(targets.map(id => NODE_TITLES[id] || id.replaceAll('_', ' ')).join(' · '))}</strong>
          </div>
        </article>`).join('')}`;

    const details = document.createElement('details');
    details.className = 'v17-law-details';
    details.innerHTML = `<summary>Inspect all ${Number((legal.questions || []).length)} handling questions</summary>`;
    lawFlow.parentNode.insertBefore(map, lawFlow);
    lawFlow.parentNode.insertBefore(details, lawFlow);
    details.append(lawFlow);
  }

  function addBuildState(canvas, layout, mode, nodeCount) {
    if (canvas.querySelector('.v17-build-state') || ['ready', 'review'].includes(mode)) return;
    const copy = {
      process: ['Deterministic process candidate', 'Reconstructing the handling process', 'Each node comes from the shared facts, law, and current uncertainty.'],
      evidence: ['Deterministic evidence candidate', 'Attaching evidence to the process', 'The checklist is being generated from the decisions—not retrieved from a generic template.'],
      experience: ['Reference retrieval', 'Contributing reference experience', 'Each returned precedent states whether it is generated reference material, qualified memory, or unverified demo memory.'],
      verify: ['Deterministic verification', 'Checking the complete playbook', 'Every graph edge and evidence relationship must remain traceable before review.'],
    }[mode];
    if (!copy) return;
    const state = document.createElement('div');
    state.className = 'v17-build-state';
    state.innerHTML = `
      <div><small>${esc(copy[0])}</small><strong data-v17-build-label>${esc(copy[1])}</strong><p>${esc(copy[2])}</p></div>
      <span class="v17-build-meter" aria-hidden="true"><span></span></span>`;
    layout.parentNode.insertBefore(state, layout);

    if (mode === 'process' && !reduceMotion) {
      const label = state.querySelector('[data-v17-build-label]');
      for (let index = 0; index < nodeCount; index += 1) {
        setTimeout(() => {
          if (document.contains(label)) label.textContent = `Reconstructing decision ${index + 1} of ${nodeCount}`;
        }, 70 * index);
      }
      setTimeout(() => {
        if (document.contains(label)) label.textContent = 'The complete handling spine is visible';
      }, 70 * nodeCount + 100);
    }
  }

  async function enhanceInspector(canvas, mode) {
    if (!['evidence', 'experience', 'verify', 'ready', 'review'].includes(mode)) return;
    const inspector = canvas.querySelector('.decision-inspector');
    if (!inspector || inspector.querySelector('.v17-evidence-chain')) return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(inspector)) return;

    const result = run.result || {};
    const process = result.process || run.process;
    const checklist = result.checklist || run.checklist;
    const understanding = result.facts ? result : run.understanding;
    if (!process || !checklist) return;

    const nodeId = inspector.dataset.inspectorNode || process.current_node;
    const node = (process.nodes || []).find(item => item.node_id === nodeId);
    const items = (checklist.items || []).filter(item => item.node_id === nodeId);
    if (!node || !items.length) return;

    const factIds = unique([...items.map(item => item.fact_id), ...(node.fact_ids || [])]);
    const facts = (understanding.facts || []).filter(fact => factIds.includes(fact.fact_id));
    const factCopy = facts.length
      ? facts.slice(0, 2).map(fact => `${fact.label}: ${fact.value}`).join(' · ')
      : unique(items.map(item => item.fact_label || item.fact_id)).slice(0, 2).join(' · ') || 'The fact this decision must establish';
    const evidenceCopy = unique(items.map(item => item.title)).slice(0, 3).join(' · ');
    const stateCopy = unique(items.map(item => statusName(item.status))).join(' · ');
    const missing = items.filter(item => ['missing', 'provided_insufficient'].includes(item.status)).length;
    const conditional = items.filter(item => item.status === 'conditional').length;
    const provided = items.filter(item => item.status === 'provided_sufficient').length;

    const chain = document.createElement('section');
    chain.className = 'v17-evidence-chain';
    chain.dataset.v17Node = nodeId;
    chain.innerHTML = `
      <header><small>Generated from this decision</small><strong>The checklist exists because this process question needs an answer.</strong></header>
      <div class="v17-chain-step"><span class="v17-chain-index">1</span><div class="v17-chain-copy"><small>Process decision</small><strong>${esc(node.question || node.title)}</strong></div></div>
      <div class="v17-chain-step"><span class="v17-chain-index">2</span><div class="v17-chain-copy"><small>Fact required</small><strong>${esc(factCopy)}</strong></div></div>
      <div class="v17-chain-step"><span class="v17-chain-index">3</span><div class="v17-chain-copy"><small>Evidence capable of answering it</small><strong>${esc(evidenceCopy)}</strong></div></div>
      <div class="v17-chain-step"><span class="v17-chain-index">4</span><div class="v17-chain-copy"><small>Current submission</small><strong>${esc(stateCopy)}</strong><p>${provided} available · ${missing} still needed · ${conditional} conditional</p></div></div>`;
    const firstSection = inspector.querySelector('.inspector-section, .precedent-inline');
    if (firstSection) inspector.insertBefore(chain, firstSection);
    else inspector.append(chain);
  }

  async function enhanceExperience(canvas) {
    const precedents = canvas.querySelector('.precedent-inline');
    if (!precedents || precedents.querySelector('.v17-experience-note')) return;
    const run = await currentRun();
    const count = (run?.precedents || run?.result?.precedents || []).length;
    if (!count || !document.contains(precedents)) return;
    precedents.insertAdjacentHTML('afterbegin', `
      <div class="v17-experience-note"><span aria-hidden="true"></span><div><small>Reference retrieval</small><strong>${count} reference precedents were returned here. Each card states its generated, qualified-review, or unverified-demo provenance.</strong></div></div>`);
  }

  function groupItems(items) {
    return [
      { kind: 'available', title: 'Already available', items: items.filter(item => item.status === 'provided_sufficient') },
      { kind: 'needed', title: 'Still needed', items: items.filter(item => ['missing', 'provided_insufficient'].includes(item.status)) },
      { kind: 'conditional', title: 'Conditional', items: items.filter(item => item.status === 'conditional') },
      { kind: 'not-needed', title: 'Not needed on this path', items: items.filter(item => item.status === 'not_applicable') },
    ];
  }

  function checklistContribution(item) {
    const contribution = item?.agent_contribution;
    if (!contribution || typeof contribution !== 'object') return '';
    const fallback = contribution.deterministic_fallback_applied === true;
    const attribution = typeof contribution.attribution === 'string' ? contribution.attribution : '';
    const accepted = contribution.deterministic_fallback_applied === false && attribution === 'Evidence and Checklist Agent';
    if (!accepted && !fallback) return '';
    const authority = accepted ? 'nemotron-accepted' : 'deterministic-fallback';
    const label = accepted ? 'Nemotron accepted · 1 item' : 'Deterministic fallback · 1 item';
    return `<span class="model-contribution-attribution ${authority}" data-contribution-authority="${authority}" data-accepted-count="${accepted ? 1 : 0}" data-fallback-count="${fallback ? 1 : 0}"><i aria-hidden="true"></i><span><strong>${label}</strong>${accepted ? `<small>${esc(attribution)}</small>` : ''}</span></span>`;
  }

  function checklistItem(item, nodeMap) {
    const node = nodeMap.get(item.node_id);
    const relation = node ? `Required for: ${node.title}` : item.node_id ? `Linked to: ${item.node_id.replaceAll('_', ' ')}` : '';
    return `<div class="v17-checklist-item" data-item-id="${esc(item.item_id || '')}" data-node-id="${esc(item.node_id || '')}" data-fact-id="${esc(item.fact_id || '')}"><i aria-hidden="true"></i><div><strong>${esc(item.title)} — ${esc(statusName(item.status))}</strong><p>${esc(relation)}${item.why ? ` · ${esc(item.why)}` : ''}</p><small>${esc(item.item_id || '')} · decision ${esc(item.node_id || '')} · fact ${esc(item.fact_id || '')}</small>${checklistContribution(item)}</div></div>`;
  }

  async function enhanceReady(canvas) {
    if (!canvas.querySelector('.artifact-summary') || canvas.querySelector('.v17-derived-checklist')) return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(canvas)) return;
    const result = run.result || {};
    const process = result.process || run.process;
    const checklist = result.checklist || run.checklist;
    const verification = result.verification || run.verification || {};
    if (!process || !checklist) return;

    const synthesis = canvas.querySelector('.process-synthesis');
    const right = synthesis?.querySelector(':scope > section:last-child');
    if (!right) return;
    const nodeMap = new Map((process.nodes || []).map(node => [node.node_id, node]));
    const groups = groupItems(checklist.items || []);
    const checks = verification.checks || verification.accepted_checks || [];

    right.className = 'v17-derived-checklist';
    right.innerHTML = `
      <span class="quiet-label">Checklist generated from the graph</span>
      <h3>Evidence needed across this process</h3>
      <p>Every item points back to the decision and fact that created it. Nothing is requested merely because it appears in a generic mould template.</p>
      <div class="v17-checklist-groups">
        ${groups.map(group => {
          const visible = group.items.slice(0, 3);
          const rest = group.items.slice(3);
          return `<section class="v17-checklist-group" data-kind="${group.kind}"><header><h4>${esc(group.title)}</h4><span>${group.items.length}</span></header>${visible.length ? visible.map(item => checklistItem(item, nodeMap)).join('') : '<div class="v17-checklist-item"><i aria-hidden="true"></i><div><strong>No items in this state</strong></div></div>'}${rest.length ? `<details class="v17-checklist-more"><summary>Show ${rest.length} more</summary>${rest.map(item => checklistItem(item, nodeMap)).join('')}</details>` : ''}</section>`;
        }).join('')}
      </div>
      ${checks.length ? `<details class="v17-acceptance"><summary>Inspect ${checks.length} acceptance checks</summary><div class="verification-list">${checks.map(check => `<div class="verification-row"><span>✓</span><div>${esc(typeof check === 'string' ? check : check.label || check.name || JSON.stringify(check))}</div></div>`).join('')}</div></details>` : ''}`;
  }

  function enhanceProcess(canvas, layout, mode) {
    if (layout.closest('.v17-continuity')) return;
    const nodes = [...layout.querySelectorAll('.process-node')];
    if (!layout.classList.contains('v17-process-live')) {
      layout.classList.add('v17-process-live');
      layout.dataset.v17Mode = mode;
      layout.setAttribute('aria-label', 'Handling process constructed from the current claim');
      nodes.forEach((node, index) => {
        node.classList.add('v17-node-reveal');
        node.style.setProperty('--v17-delay', `${(mode === 'process' ? 65 : 18) * index}ms`);
      });
    }
    addBuildState(canvas, layout, mode, nodes.length);
    lastProcessMarkup = layout.outerHTML;
    lastProcessRunId = document.body.dataset.casepathActiveRunId || '';
  }

  function captureReview(event) {
    const form = event.target.closest?.('#reviewForm');
    if (!form) return;
    const rows = [...form.querySelectorAll('#reviewImpact .review-impact-row')].map(row => ({
      label: row.querySelector('small')?.textContent?.trim() || '',
      value: row.querySelector('strong')?.textContent?.trim() || '',
    })).filter(item => item.label && item.value);
    pendingReview = {
      mode: form.querySelector('input[name="building_envelope_mode"]:checked')?.value || '',
      rows,
    };
  }

  function enhanceReviewApplied(canvas) {
    const knowledge = canvas.querySelector('.knowledge-agent');
    if (!knowledge || knowledge.querySelector('.v17-review-applied') || !pendingReview) return;
    const anchor = knowledge.querySelector('.knowledge-thinking');
    if (!anchor) return;
    const panel = document.createElement('section');
    panel.className = 'v17-review-applied';
    panel.innerHTML = `
      <header><small>Simulated demo correction applied</small><strong>The returned reasoning changed, but no qualified approval or shared-rule release occurred.</strong></header>
      <div class="v17-review-delta">${pendingReview.rows.map(item => `<article><small>${esc(item.label)}</small><strong>${esc(item.value)}</strong></article>`).join('')}</div>`;
    knowledge.insertBefore(panel, anchor);
  }

  async function enhanceKnowledge(canvas) {
    const flow = canvas.querySelector('.knowledge-flow');
    if (!flow || flow.dataset.v17Gates === 'true') return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(flow)) return;
    const candidate = run.candidate || run.result?.knowledge_update || {};
    const released = candidate.status === 'released'
      && candidate.shared_knowledge_changed === true
      && candidate.target_tests?.status === 'passed'
      && candidate.protected_regression?.status === 'passed'
      && candidate.approval?.status === 'approved'
      && candidate.new_version;
    if (!released) return;
    flow.dataset.v17Gates = 'true';
    flow.innerHTML = `
      <div class="knowledge-step"><span>✓</span><div><strong>Pattern supported</strong><p>${esc(String(candidate.support_count))} of ${esc(String(candidate.required_support))} reviewed claims.</p></div></div>
      <div class="knowledge-step"><span>✓</span><div><strong>Target cases tested</strong><p>${esc(String(candidate.target_tests.passed))}/${esc(String(candidate.target_tests.passed + candidate.target_tests.failed))} passed.</p></div></div>
      <div class="knowledge-step"><span>✓</span><div><strong>Protected cases checked</strong><p>${esc(String(candidate.protected_regression.passed))}/${esc(String(candidate.protected_regression.passed + candidate.protected_regression.failed))} passed.</p></div></div>
      <div class="knowledge-step"><span>✓</span><div><strong>Playbook released</strong><p>${esc(candidate.new_version)} is active.</p></div></div>`;
  }

  async function enhanceReuse(canvas) {
    const resultBlock = canvas.querySelector('#laterResult .before-after');
    if (!resultBlock || canvas.querySelector('.v17-reuse-thread')) return;
    if (canvas.querySelector('.v20-later-heading')?.dataset.memoryUsed !== 'true') return;
    const run = await currentRun({ fresh: true });
    if (!run || !document.contains(resultBlock)) return;
    const result = run.result || {};
    if (result.reviewed_memory_used !== true) return;
    const precedent = result.precedents?.find(item => ['expert_reviewed_memory', 'unverified_demo_memory'].includes(item.review_status) && item.memory_id);
    if (!precedent) return;
    const playbook = result.playbook?.version;
    const thread = document.createElement('section');
    thread.className = 'v17-reuse-thread';
    thread.setAttribute('aria-label', 'How returned review memory was used on the unseen claim');
    thread.innerHTML = `
      <article><small>${esc(precedent.review_status === 'unverified_demo_memory' ? 'Unverified demo review memory returned' : 'Qualified review memory returned')}</small><strong>${esc(precedent.claim_id)} · ${esc(precedent.memory_id)}</strong></article>
      <article><small>Shared playbook</small><strong>${esc(playbook || 'Version not returned')}</strong></article>
      <article><small>Shared rule applied</small><strong>${esc(String(result.shared_rule_applied === true))}</strong></article>
      <article><small>Knowledge mode</small><strong>${esc(result.knowledge?.mode || 'Not returned')}</strong></article>`;
    resultBlock.parentNode.insertBefore(thread, resultBlock);
  }

  async function enhanceStage() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;

    preserveProcessDuringHandoff(canvas);
    await enhanceLaw(canvas);

    const mode = modeForCanvas(canvas);
    const layout = canvas.querySelector('.process-layout:not(.v17-continuity .process-layout)');
    if (layout) {
      enhanceProcess(canvas, layout, mode);
      await enhanceInspector(canvas, mode);
    }

    await enhanceExperience(canvas);
    await enhanceReady(canvas);
    enhanceReviewApplied(canvas);
    await enhanceKnowledge(canvas);
    await enhanceReuse(canvas);
  }

  function queueEnhancement() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      enhanceProgress();
      await enhanceStage();
    });
  }

  function boot() {
    document.addEventListener('submit', captureReview, true);
    const observer = new MutationObserver(queueEnhancement);
    const progress = document.querySelector('#agentProgress');
    const canvas = document.querySelector('#stageCanvas');
    if (progress) observer.observe(progress, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (canvas) observer.observe(canvas, { childList: true, subtree: true });
    if ('PerformanceObserver' in window) {
      try {
        const performanceObserver = new PerformanceObserver(queueEnhancement);
        performanceObserver.observe({ type: 'resource', buffered: true });
      } catch (_) {}
    }
    window.addEventListener('casepath:render', queueEnhancement);
    queueEnhancement();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
