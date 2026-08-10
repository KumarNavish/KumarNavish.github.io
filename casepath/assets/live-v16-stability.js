(() => {
  'use strict';

  if (!document.querySelector('link[href$="live-v16-viewer-fix.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'assets/live-v16-viewer-fix.css';
    document.head.append(stylesheet);
  }

  const viewer = document.querySelector('#sourceViewer');
  const stage = document.querySelector('#sourceStage');

  if (viewer && stage) {
    function keepActiveRepresentationVisible() {
      if (!viewer.open) return;
      stage.hidden = false;
      stage.removeAttribute('aria-hidden');
      stage.style.display = 'flex';
      stage.style.visibility = 'visible';
      stage.style.opacity = '1';
      for (const child of stage.children) {
        child.hidden = false;
        child.removeAttribute('aria-hidden');
        child.style.visibility = 'visible';
        child.style.opacity = '1';
        if (child.classList.contains('extraction-pages')) child.style.display = 'block';
      }
    }

    new MutationObserver(keepActiveRepresentationVisible).observe(stage, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'aria-hidden'],
    });

    document.addEventListener('click', event => {
      if (!event.target.closest?.('[data-source-tab]')) return;
      requestAnimationFrame(keepActiveRepresentationVisible);
      setTimeout(keepActiveRepresentationVisible, 100);
      setTimeout(keepActiveRepresentationVisible, 600);
    });

    viewer.addEventListener('close', () => {
      stage.style.removeProperty('display');
      stage.style.removeProperty('visibility');
      stage.style.removeProperty('opacity');
    });
  }

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
  const query = new URLSearchParams(location.search);
  const apiBase = (query.get('api') || window.CASEPATH_API || 'https://casepath-agentic-api.onrender.com').replace(/\/$/, '');

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

  function auditEvent(event) {
    const inputs = (event.input_artifacts || []).join(', ') || event.input_hash || '';
    const output = event.output_artifact || event.output_hash || '';
    const specialist = event.agent || event.label || event.stage || 'Run event';
    const eventLabel = [event.label, event.headline].filter(Boolean).join(' · ');
    return `<details class="audit-event">
      <summary><span></span><div><strong>${escapeHtml(specialist)}</strong><span>${escapeHtml(eventLabel)}</span></div><span>${escapeHtml(event.status || '')}</span></summary>
      <div class="audit-event-body">
        ${event.detail ? `<p>${escapeHtml(event.detail)}</p>` : ''}
        <dl class="audit-grid">
          <dt>Specialist</dt><dd>${escapeHtml(specialist)}</dd>
          <dt>Implementation</dt><dd>${escapeHtml(event.implementation || '')}</dd>
          <dt>Model</dt><dd>${escapeHtml(event.model || 'None — deterministic or human')}</dd>
          <dt>Prompt</dt><dd>${escapeHtml(event.prompt_version || 'None')}</dd>
          <dt>Validator</dt><dd>${escapeHtml(event.validator || '')}</dd>
          <dt>Input</dt><dd>${escapeHtml(inputs)}</dd>
          <dt>Output</dt><dd>${escapeHtml(output)}</dd>
        </dl>
      </div>
    </details>`;
  }

  async function openUnifiedAudit(event) {
    const trigger = event.target.closest?.('#openAudit');
    if (!trigger || trigger.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const drawer = document.querySelector('#auditDrawer');
    const content = document.querySelector('#auditContent');
    if (!drawer || !content) return;

    trigger.disabled = true;
    const originalLabel = trigger.textContent;
    trigger.textContent = 'Loading audit…';

    try {
      const ids = discoveredRunIds();
      const runs = await Promise.all(ids.map(async runId => {
        const response = await fetch(`${apiBase}/api/runs/${encodeURIComponent(runId)}`);
        if (!response.ok) throw new Error(`Run ${runId} could not be read.`);
        return response.json();
      }));
      runs.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
      content.innerHTML = runs.map((run, index) => {
        const label = index === 0 ? 'Flagship claim and expert learning' : 'Unseen claim using the released playbook';
        return `<section class="audit-run-section" style="padding-top:${index ? 26 : 0}px">
          <header style="padding:18px 0 10px;border-bottom:1px solid #e5e8ec">
            <span class="quiet-label">${escapeHtml(label)}</span>
            <strong style="display:block;margin-top:4px;font-size:13px">${escapeHtml(run.claim_id || run.run_id || '')}</strong>
          </header>
          ${(run.events || []).map(auditEvent).join('')}
        </section>`;
      }).join('') || '<p style="padding:18px 0;color:#626a75">No completed run is available yet.</p>';
      if (!drawer.open) drawer.showModal();
    } catch (error) {
      content.innerHTML = `<p style="padding:18px 0;color:#626a75">${escapeHtml(error.message)}</p>`;
      if (!drawer.open) drawer.showModal();
    } finally {
      trigger.disabled = false;
      trigger.textContent = originalLabel;
    }
  }

  document.addEventListener('click', openUnifiedAudit, true);
})();
