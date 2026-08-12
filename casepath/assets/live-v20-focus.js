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
      if (label && ready && !/Opening|Could not/i.test(label.textContent || '') && label.textContent !== 'Analyse claim') label.textContent = 'Analyse claim';
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
