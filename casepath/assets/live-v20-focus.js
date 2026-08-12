(() => {
  'use strict';

  const MOMENT_COPY = {
    process: {
      eyebrow: 'Deterministic process candidate ready',
      title: 'Handling process',
      detail: 'The main handling path is visible. Select a decision to inspect what it knows and what it still needs.',
    },
    evidence: {
      eyebrow: 'Deterministic evidence candidate ready',
      title: 'Evidence within the process',
      detail: 'Evidence now appears at the decision it can resolve—not as a separate report.',
    },
    experience: {
      eyebrow: 'Reference retrieval complete',
      title: 'Previous experience at the difficult decision',
      detail: 'Returned precedents contribute where the current process is uncertain and remain labelled by provenance.',
    },
    verify: {
      eyebrow: 'Deterministic verification complete',
      title: 'Verified handling process',
      detail: 'Unsupported links were rejected. The remaining process and evidence relationships are ready for review.',
    },
    ready: {
      eyebrow: 'Ready for simulated review',
      title: 'Handling playbook',
      detail: 'Review the process itself. Supporting evidence, law, and experience are attached to its decisions.',
    },
    review: {
      eyebrow: 'Simulated demo review',
      title: 'Correct the decision that changes the downstream process',
      detail: 'The selected evidence order updates the process, evidence requirements, and next action together.',
    },
  };

  const FLAGSHIP_STAGES = [
    { id: 'understand', label: 'Claim Understanding Agent' },
    { id: 'research', label: 'Legal Research Agent' },
    { id: 'process', label: 'Process Discovery Agent' },
    { id: 'evidence', label: 'Evidence / Document Agent' },
    { id: 'experience', label: 'Historical Claims Agent' },
    { id: 'verify', label: 'Verification Agent' },
    { id: 'knowledge', label: 'Knowledge Agent' },
  ];

  const FLAGSHIP_FOCUS = {
    opening: { stage: 'understand', title: 'Opening one shared claim context', context: 'Customer message + 6 original attachments', authority: 'Application source parser', output: 'Shared claim package' },
    read: { stage: 'understand', title: 'Reading the message and every original attachment', context: 'Customer message + source package', authority: 'Application source parser', output: 'Grounded source package' },
    understand: { stage: 'understand', title: 'Separating facts, allegations, conflicts and unknowns', context: '18 bounded claim facts + exact source references', authority: 'Nemotron agent · deterministic fact contract', output: 'Canonical claim state' },
    research: { stage: 'research', title: 'Connecting official Swiss-law passages to handling questions', context: 'Versioned official source registry · qualified legal review pending', authority: 'Deterministic source registry', output: 'Legal questions and exact sources' },
    process: { stage: 'process', title: 'Building the complete claim-handling process', context: 'Claim state + legal questions + bounded orchestrator focus', authority: 'Nemotron contribution · deterministic process gate', output: 'Handling process graph' },
    evidence: { stage: 'evidence', title: 'Attaching every evidence need to the decision it can resolve', context: 'Original artifacts + process decisions + source integrity', authority: 'Nemotron agents · deterministic evidence gate', output: 'Process-linked evidence model' },
    experience: { stage: 'experience', title: 'Ranking the most relevant provenance-labelled reference cases', context: 'Legal question + difficult process branch + unresolved fact', authority: 'Deterministic reference ranking', output: 'Ranked reference cases' },
    verify: { stage: 'verify', title: 'Checking grounding, consistency and unsupported conclusions', context: 'Agent contributions + graph + evidence relationships', authority: 'Nemotron audit · deterministic acceptance', output: 'Verified handling playbook' },
    ready: { stage: 'verify', title: 'A source-grounded handling playbook is ready', context: '6 returned model roles + 3 deterministic safety gates', authority: 'Deterministically verified demo result', output: 'Review-ready playbook' },
    review: { stage: 'verify', title: 'Review the decision that changes the downstream process', context: 'Simulated demo review · not qualified expert approval', authority: 'Human-in-the-loop demonstration', output: 'Proposed process correction' },
    'review-applied': { stage: 'knowledge', title: 'Applying the correction across process and evidence', context: 'Reviewed graph + reviewed evidence relationships', authority: 'Deterministic review transform', output: 'Corrected handling process' },
    knowledge: { stage: 'knowledge', title: 'Turning the correction into safely governed knowledge', context: 'Unverified case memory · shared playbook remains unchanged', authority: 'Deterministic knowledge governance', output: 'Quarantined reusable knowledge' },
    'later-work': { stage: 'knowledge', title: 'Testing the learned guidance on a held-out claim', context: 'Frozen memory receipt + later demo claim', authority: 'Deterministic comparison · no second model run', output: 'Before-and-after comparison' },
    'later-result': { stage: 'knowledge', title: 'Showing exactly how the future claim improved', context: 'Receipt-bound guidance · shared playbook unchanged', authority: 'Deterministic comparison · no second model run', output: 'Verified learning effect' },
    failure: { stage: 'understand', title: 'The run stopped safely', context: 'No unsupported result was applied', authority: 'Fail-closed safety boundary', output: 'No artifact produced' },
  };

  let queued = false;
  let lastMoment = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  function visible(element) {
    return Boolean(element && !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  function currentMoment() {
    const start = $('#startState');
    const canvas = $('#stageCanvas');
    if (visible(start)) return 'start';
    if (!canvas) return 'opening';
    if (canvas.dataset.casepathMoment) return canvas.dataset.casepathMoment;
    if (canvas.querySelector('#reviewForm')) return 'review';
    if (canvas.querySelector('.knowledge-agent')) return 'knowledge';
    if (canvas.querySelector('.later-run')) {
      return canvas.querySelector('#laterResult .before-after') ? 'later-result' : 'later-work';
    }
    if (canvas.querySelector('.artifact-summary,.v17-derived-checklist') || /Handling playbook ready|reconstructed how this claim should be handled/i.test(canvas.textContent || '')) return 'ready';

    const progress = $('.v18-progress-focus,.v17-progress-focus');
    const active = progress?.dataset.activeStage;
    if (active) return active;
    const text = canvas.textContent || '';
    if (/passed its acceptance checks|checking the complete playbook/i.test(text)) return 'verify';
    if (/Previous cases are helping|organizational memory/i.test(text)) return 'experience';
    if (/Evidence now follows|attaching evidence/i.test(text)) return 'evidence';
    if (/complete handling process is taking shape|building the handling process/i.test(text)) return 'process';
    if (/Swiss law has become handling questions/i.test(text)) return 'research';
    if (/separated what is known/i.test(text)) return 'understand';
    if (/original submission is in the shared claim context|Reading the message/i.test(text)) return 'read';
    return 'opening';
  }

  function updateClaimReadiness() {
    const ready = $$('.attachment-row').length > 0 && Boolean($('#customerEmail .email-body'));
    if (document.body.dataset.claimReady !== String(ready)) document.body.dataset.claimReady = String(ready);
    const button = $('#runCasePath');
    if (button && visible($('#startState'))) {
      if (button.disabled === ready) button.disabled = !ready;
      const label = button.querySelector('span');
      if (label && ready && !/Opening|Could not/i.test(label.textContent || '') && label.textContent !== 'Watch CasePath handle this claim') label.textContent = 'Watch CasePath handle this claim';
    }
    const header = $('#headerClaimId');
    if (header && !ready && /Loading claim/i.test(header.textContent || '')) header.textContent = 'Opening claim…';
  }

  function normalizeStart() {
    const start = $('#startState');
    if (!start || start.dataset.v20Ready === 'true') return;
    const label = start.querySelector('.start-copy .quiet-label');
    const title = start.querySelector('.start-copy h2');
    const buttonLabel = start.querySelector('#runCasePath span');
    if (label) label.textContent = 'CasePath flagship';
    if (title) title.textContent = 'One messy claim. One coordinated handling plan.';
    if (buttonLabel) buttonLabel.textContent = 'Watch CasePath handle this claim';
    start.dataset.v20Ready = 'true';
  }

  function ensureFlagshipFocus(canvas, moment) {
    const live = $('#liveWorkspace');
    const focus = FLAGSHIP_FOCUS[moment] || FLAGSHIP_FOCUS.opening;
    if (!live || !canvas || !focus) return;
    let surface = $('#v21AgentFocus');
    if (!surface) {
      surface = document.createElement('section');
      surface.id = 'v21AgentFocus';
      surface.className = 'v21-agent-focus';
      surface.setAttribute('aria-live', 'polite');
      live.insertBefore(surface, canvas);
    }
    const signature = `${moment}:${focus.stage}`;
    if (surface.dataset.signature === signature) return;
    const activeIndex = FLAGSHIP_STAGES.findIndex(stage => stage.id === focus.stage);
    const role = FLAGSHIP_STAGES[activeIndex] || FLAGSHIP_STAGES[0];
    surface.dataset.signature = signature;
    surface.dataset.casepathSpecialist = role.id;
    surface.dataset.workAuthority = focus.authority;
    surface.innerHTML = `
      <div class="v21-focus-copy">
        <small>Workflow specialist · ${esc(role.label)}</small>
        <h2>${esc(focus.title)}</h2>
        <p>${esc(focus.context)}</p>
        <div class="v21-focus-proof"><span>${esc(focus.authority)}</span><strong>Produced · ${esc(focus.output)}</strong></div>
      </div>
      <ol class="v21-stage-rail" aria-label="Seven coordinated specialist stages">
        ${FLAGSHIP_STAGES.map((stage, index) => `<li data-stage="${esc(stage.id)}" data-state="${index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'next'}"><i>${index < activeIndex ? '✓' : index + 1}</i><span>${esc(stage.label.replace(' Agent', ''))}</span></li>`).join('')}
      </ol>`;
  }

  function directInspectorCopy(canvas) {
    for (const inspector of $$('.decision-inspector', canvas)) {
      const headings = [...inspector.querySelectorAll('.inspector-section h4')];
      for (const heading of headings) {
        const text = heading.textContent?.trim();
        if (text === 'What this decision knows') heading.textContent = 'What we know';
        if (text === 'What this decision requires') heading.textContent = 'Evidence that could resolve this';
        if (text === 'Why this step exists') heading.textContent = 'Relevant law';
      }
      const precedent = inspector.querySelector('.precedent-inline h4');
      if (precedent && precedent.textContent !== 'Previous experience that may help') precedent.textContent = 'Previous experience that may help';
    }
  }

  function ensureArtifactHeader(canvas, moment) {
    const copy = MOMENT_COPY[moment];
    const shell = canvas?.querySelector('.stage-shell');
    if (!copy || !shell) return;
    let header = shell.querySelector(':scope > .v20-artifact-header');
    if (!header) {
      header = document.createElement('header');
      header.className = 'v20-artifact-header';
      shell.prepend(header);
    }
    if (header.dataset.moment !== moment) {
      header.dataset.moment = moment;
      header.innerHTML = `
        <div><small>${esc(copy.eyebrow)}</small><h2>${esc(copy.title)}</h2><p>${esc(copy.detail)}</p></div>
        <div class="v20-artifact-actions"></div>`;
    }
    const actions = header.querySelector('.v20-artifact-actions');
    if (moment === 'ready' && canvas.querySelector('.v17-derived-checklist') && !actions?.querySelector('[data-v20-open-documents]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v20-quiet-action';
      button.dataset.v20OpenDocuments = 'true';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'v20DocumentSheet');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'View document needs';
      actions?.append(button);
    }
  }

  function ensureDocumentSheet(canvas) {
    const checklist = canvas?.querySelector('.v17-derived-checklist');
    const workPane = $('.work-pane');
    if (!checklist || !workPane || workPane.querySelector('.v20-document-sheet')) return;

    const sheet = document.createElement('dialog');
    sheet.id = 'v20DocumentSheet';
    sheet.className = 'v20-document-sheet';
    sheet.setAttribute('aria-labelledby', 'v20DocumentTitle');
    const clone = checklist.cloneNode(true);
    clone.removeAttribute('class');
    clone.className = 'v20-document-checklist';
    for (const item of $$('.v17-checklist-item', clone)) {
      const nodeId = item.dataset.nodeId || '';
      item.dataset.v20NodeId = nodeId;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `${item.querySelector('strong')?.textContent || 'Document need'}; open its process decision`);
    }
    sheet.innerHTML = `
      <header>
        <div><span class="quiet-label">Derived from the process</span><h2 id="v20DocumentTitle">Document needs</h2><p>Every item keeps its item, decision, and fact identifiers and returns to the decision that requires it.</p></div>
        <button class="icon-button" type="button" data-v20-close-documents aria-label="Return to handling process"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      </header>
      <div class="v20-document-body"></div>`;
    sheet.querySelector('.v20-document-body').append(clone);
    workPane.append(sheet);
  }

  function openDocuments() {
    const sheet = $('.v20-document-sheet');
    if (!sheet) return;
    openDocuments.returnFocus = $('[data-v20-open-documents]');
    $('[data-v20-open-documents]')?.setAttribute('aria-expanded', 'true');
    if (!sheet.open) sheet.showModal();
    sheet.querySelector('[data-v20-close-documents]')?.focus();
  }

  function closeDocuments({ nodeId = '' } = {}) {
    const sheet = $('.v20-document-sheet');
    if (!sheet) return;
    if (sheet.open) sheet.close();
    $('[data-v20-open-documents]')?.setAttribute('aria-expanded', 'false');
    if (nodeId) {
      const target = $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"],.process-branch-node[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'));
      target?.click();
      requestAnimationFrame(() => $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"],.process-branch-node[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'))?.focus());
    } else {
      openDocuments.returnFocus?.focus();
    }
  }

  function focusReview(canvas) {
    const form = canvas?.querySelector('#reviewForm');
    if (!form) return;
    const submit = form.querySelector('button[type="submit"] span');
    if (submit && /Apply demo correction/i.test(submit.textContent || '')) submit.textContent = 'Apply demo correction';
    const label = form.querySelector(':scope > .quiet-label');
    if (label && label.textContent !== 'Simulated reviewer choice') label.textContent = 'Simulated reviewer choice';
    if (!form.querySelector('.v20-review-note')) {
      const note = document.createElement('p');
      note.className = 'v20-review-note';
      note.textContent = 'Simulated demo review only; this is not qualified expert approval. Choose the evidence order and CasePath updates the downstream process and document needs immediately.';
      form.querySelector('h3')?.after(note);
    }
  }

  function focusKnowledge(canvas) {
    if (canvas?.querySelector('.v20-learning-summary') && document.body.dataset.casepathLearningReady !== 'true') {
      document.body.dataset.casepathLearningReady = 'true';
    }
  }

  function focusLater(canvas) {
    const result = canvas?.querySelector('#laterResult');
    if (!result?.querySelector('.before-after')) return;
    result.dataset.v20LaterReady = 'true';
  }

  function setMoment(moment) {
    if (lastMoment === moment) return;
    lastMoment = moment;
    document.body.dataset.casepathMoment = moment;
    if (moment !== 'knowledge') delete document.body.dataset.casepathLearningReady;
  }

  function enhance() {
    normalizeStart();
    updateClaimReadiness();
    const canvas = $('#stageCanvas');
    const moment = currentMoment();
    setMoment(moment);
    if (!canvas) return;
    ensureFlagshipFocus(canvas, moment);
    directInspectorCopy(canvas);
    ensureArtifactHeader(canvas, moment);
    ensureDocumentSheet(canvas);
    focusReview(canvas);
    focusKnowledge(canvas);
    focusLater(canvas);
  }

  function queueEnhance() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  }

  function onClick(event) {
    const open = event.target.closest?.('[data-v20-open-documents]');
    if (open) {
      event.preventDefault();
      openDocuments();
      return;
    }
    const close = event.target.closest?.('[data-v20-close-documents]');
    if (close) {
      event.preventDefault();
      closeDocuments();
      return;
    }
    const item = event.target.closest?.('.v20-document-body .v17-checklist-item');
    if (item) {
      event.preventDefault();
      closeDocuments({ nodeId: item.dataset.v20NodeId || '' });
    }
  }

  function onKeydown(event) {
    const item = event.target.closest?.('.v20-document-body .v17-checklist-item');
    if (item && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      closeDocuments({ nodeId: item.dataset.v20NodeId || '' });
    }
    if (event.key === 'Escape' && $('.v20-document-sheet')?.open) closeDocuments();
  }

  function boot() {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    const observer = new MutationObserver(queueEnhance);
    for (const target of [document.body, $('#stageCanvas'), $('#agentProgress'), $('#submissionContent')]) {
      if (target) observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-active-stage'] });
    }
    window.addEventListener('casepath:render', queueEnhance);
    queueEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
