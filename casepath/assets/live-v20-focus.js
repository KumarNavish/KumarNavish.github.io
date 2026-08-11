(() => {
  'use strict';

  const RELEASE = '20.0.0';
  const NODE_IDS = {
    'Claim intake': 'intake',
    'Tenant-law scope': 'scope',
    'Existence of a dispute': 'dispute',
    'Urgency and safety': 'urgency',
    'Landlord notification': 'notification',
    'Defect and recurrence': 'defect',
    'Causation assessment': 'causation',
    'Responsibility': 'responsibility',
    'Remedy selection': 'remedy',
    'Escalation': 'escalation',
    'Resolution and closure': 'resolution',
    'Causation evidence loop': 'evidence_gap',
    'Test the ventilation allegation': 'ventilation_dispute',
  };
  const MOMENT_COPY = {
    process: {
      eyebrow: 'Process Discovery Agent complete',
      title: 'Handling process',
      detail: 'The main handling path is visible. Select a decision to inspect what it knows and what it still needs.',
    },
    evidence: {
      eyebrow: 'Document Requirements Agent complete',
      title: 'Evidence within the process',
      detail: 'Evidence now appears at the decision it can resolve—not as a separate report.',
    },
    experience: {
      eyebrow: 'Historical Claims Agent complete',
      title: 'Previous experience at the difficult decision',
      detail: 'Reviewed cases contribute where the current process is uncertain.',
    },
    verify: {
      eyebrow: 'Verification Agent complete',
      title: 'Verified handling process',
      detail: 'Unsupported links were rejected. The remaining process and evidence relationships are ready for review.',
    },
    ready: {
      eyebrow: 'Ready for expert review',
      title: 'Handling playbook',
      detail: 'Review the process itself. Supporting evidence, law, and experience are attached to its decisions.',
    },
    review: {
      eyebrow: 'Expert review',
      title: 'Correct the decision that changes the downstream process',
      detail: 'The selected evidence order updates the process, evidence requirements, and next action together.',
    },
  };

  let queued = false;
  let lastMoment = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'\"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
  }[character]));

  function visible(element) {
    return Boolean(element && !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  function currentMoment() {
    const start = $('#startState');
    const canvas = $('#stageCanvas');
    if (visible(start)) return 'start';
    if (!canvas) return 'opening';
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

  function markRelease() {
    document.documentElement.dataset.casepathRelease = RELEASE;
    document.body.dataset.casepathRelease = RELEASE;
    window.CASEPATH_EXPERIENCE_RELEASE = RELEASE;
    const meta = $('meta[name="casepath-release"]');
    if (meta) meta.content = RELEASE;
  }

  function updateClaimReadiness() {
    const ready = $$('.attachment-row').length > 0 && Boolean($('#customerEmail .email-body'));
    document.body.dataset.claimReady = String(ready);
    const button = $('#runCasePath');
    if (button && visible($('#startState'))) {
      button.disabled = !ready;
      const label = button.querySelector('span');
      if (label && ready && !/Opening|Could not/i.test(label.textContent || '')) label.textContent = 'Analyse claim';
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
    if (label) label.textContent = 'Flagship claim';
    if (title) title.textContent = 'What should CasePath do with this claim?';
    if (buttonLabel) buttonLabel.textContent = 'Analyse claim';
    start.dataset.v20Ready = 'true';
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
      if (precedent) precedent.textContent = 'Previous experience that may help';
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
    header.dataset.moment = moment;
    header.innerHTML = `
      <div><small>${esc(copy.eyebrow)}</small><h2>${esc(copy.title)}</h2><p>${esc(copy.detail)}</p></div>
      <div class="v20-artifact-actions"></div>`;
    const actions = header.querySelector('.v20-artifact-actions');
    if (moment === 'ready' && canvas.querySelector('.v17-derived-checklist')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v20-quiet-action';
      button.dataset.v20OpenDocuments = 'true';
      button.textContent = 'View document needs';
      actions.append(button);
    }
  }

  function checklistNodeId(item) {
    const relation = item.querySelector('p')?.textContent || '';
    const match = relation.match(/Required for:\s*([^·]+)/i);
    if (!match) return '';
    return NODE_IDS[match[1].trim()] || '';
  }

  function ensureDocumentSheet(canvas) {
    const checklist = canvas?.querySelector('.v17-derived-checklist');
    const workPane = $('.work-pane');
    if (!checklist || !workPane || workPane.querySelector('.v20-document-sheet')) return;

    const sheet = document.createElement('section');
    sheet.className = 'v20-document-sheet';
    sheet.hidden = true;
    sheet.setAttribute('aria-label', 'Complete document needs derived from the handling process');
    const clone = checklist.cloneNode(true);
    clone.removeAttribute('class');
    clone.className = 'v20-document-checklist';
    for (const item of $$('.v17-checklist-item', clone)) {
      const nodeId = checklistNodeId(item);
      if (nodeId) item.dataset.v20NodeId = nodeId;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `${item.querySelector('strong')?.textContent || 'Document need'}; open its process decision`);
    }
    sheet.innerHTML = `
      <header>
        <div><span class="quiet-label">Derived from the process</span><h2>Document needs</h2><p>Every item returns to the decision that requires it.</p></div>
        <button class="icon-button" type="button" data-v20-close-documents aria-label="Return to handling process"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      </header>
      <div class="v20-document-body"></div>`;
    sheet.querySelector('.v20-document-body').append(clone);
    workPane.append(sheet);
  }

  function openDocuments() {
    const sheet = $('.v20-document-sheet');
    if (!sheet) return;
    sheet.hidden = false;
    sheet.querySelector('[data-v20-close-documents]')?.focus();
  }

  function closeDocuments({ nodeId = '' } = {}) {
    const sheet = $('.v20-document-sheet');
    if (!sheet) return;
    sheet.hidden = true;
    if (nodeId) {
      const target = $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'));
      target?.click();
      requestAnimationFrame(() => target?.focus());
    } else {
      $('[data-v20-open-documents]')?.focus();
    }
  }

  function focusReview(canvas) {
    const form = canvas?.querySelector('#reviewForm');
    if (!form) return;
    const submit = form.querySelector('button[type="submit"] span');
    if (submit && /Approve correction/i.test(submit.textContent || '')) submit.textContent = 'Apply correction';
    const label = form.querySelector(':scope > .quiet-label');
    if (label) label.textContent = 'Expert decision';
    if (!form.querySelector('.v20-review-note')) {
      const note = document.createElement('p');
      note.className = 'v20-review-note';
      note.textContent = 'Choose the evidence order. CasePath updates the downstream process and document needs immediately.';
      form.querySelector('h3')?.after(note);
    }
  }

  function learningText(canvas) {
    const correctionRows = $$('.v17-review-applied .v17-review-delta article', canvas)
      .map(row => row.querySelector('strong')?.textContent?.trim())
      .filter(Boolean);
    const rule = canvas.querySelector('.knowledge-release h3')?.textContent?.trim()
      || 'Use competent evidence before expanding the causation investigation.';
    const version = canvas.querySelector('.version-shift')?.textContent?.replace(/\s+/g, ' ').trim()
      || 'The reviewed playbook is versioned and recoverable.';
    const support = canvas.querySelector('.v19-support-meter strong')?.textContent?.trim()
      || canvas.querySelector('.knowledge-step:nth-child(2) p')?.textContent?.trim()
      || 'Repeated reviewed evidence supported the shared change.';
    return {
      correction: correctionRows.slice(0, 2).join(' ') || 'The expert kept causation unresolved and made broader testing conditional on the first neutral assessment.',
      rule,
      version,
      support,
    };
  }

  function focusKnowledge(canvas) {
    const result = canvas?.querySelector('#knowledgeResult');
    if (!result || !result.querySelector('.knowledge-flow')) return;
    let summary = canvas.querySelector('.v20-learning-summary');
    const copy = learningText(canvas);
    if (!summary) {
      summary = document.createElement('section');
      summary.className = 'v20-learning-summary';
      result.prepend(summary);
    }
    summary.innerHTML = `
      <span>What CasePath learned</span>
      <h2>Reviewed knowledge is ready for the next claim.</h2>
      <article class="v20-learning-row"><span>✓</span><div><small>Reviewed case saved</small><strong>This claim can now help future precedent retrieval.</strong><p>The original evidence, reviewed process path, and expert decision remain traceable together.</p></div></article>
      <article class="v20-learning-row"><span>✓</span><div><small>Expert correction captured</small><strong>${esc(copy.correction)}</strong></div></article>
      <article class="v20-learning-row"><span>✓</span><div><small>Shared playbook change</small><strong>${esc(copy.rule)}</strong><p>${esc(copy.support)} ${esc(copy.version)}</p></div></article>`;
    document.body.dataset.casepathLearningReady = 'true';
  }

  function focusLater(canvas) {
    const result = canvas?.querySelector('#laterResult');
    if (!result?.querySelector('.before-after') || result.querySelector('.v20-later-heading')) return;
    const heading = document.createElement('header');
    heading.className = 'v20-later-heading';
    heading.innerHTML = `<small>Reviewed knowledge used</small><h2>The next claim starts with a better evidence path.</h2><p>CasePath retrieved the reviewed flagship claim, made the ventilation allegation explicit, and avoided an unnecessary immediate request.</p>`;
    result.prepend(heading);
  }

  function setMoment(moment) {
    if (lastMoment === moment) return;
    lastMoment = moment;
    document.body.dataset.casepathMoment = moment;
    if (moment !== 'knowledge') delete document.body.dataset.casepathLearningReady;
  }

  function enhance() {
    markRelease();
    normalizeStart();
    updateClaimReadiness();
    const canvas = $('#stageCanvas');
    const moment = currentMoment();
    setMoment(moment);
    if (!canvas) return;
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
    if (event.key === 'Escape' && !$('.v20-document-sheet')?.hidden) closeDocuments();
  }

  function boot() {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    const observer = new MutationObserver(queueEnhance);
    for (const target of [document.body, $('#stageCanvas'), $('#agentProgress'), $('#submissionContent')]) {
      if (target) observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-active-stage'] });
    }
    window.setInterval(queueEnhance, 900);
    queueEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
