(() => {
  'use strict';

  const stages = [
    { id: 'read', selector: '.event-list', agent: 'Attachment Parsing Agent', output: 'source package', next: 'Claim Understanding Agent' },
    { id: 'understand', selector: '.fact-stream', agent: 'Claim Understanding Agent', output: 'claim state', next: 'Legal Research Agent' },
    { id: 'research', selector: '.law-flow,.v17-law-map', agent: 'Legal Research Agent', output: 'legal context', next: 'Process Discovery Agent' },
    { id: 'process', pattern: /complete handling process is taking shape|building the handling process/i, agent: 'Process Discovery Agent', output: 'handling process', next: 'Document Requirements Agent' },
    { id: 'evidence', pattern: /Evidence now follows directly from the process|attaching evidence/i, agent: 'Document Requirements Agent', output: 'evidence model', next: 'Historical Claims Agent' },
    { id: 'experience', selector: '.precedent-inline', agent: 'Historical Claims Agent', output: 'reviewed experience', next: 'Verification Agent' },
    { id: 'verify', selector: '.verification-list', agent: 'Verification Agent', output: 'verified playbook', next: 'Expert review' },
  ];

  function activeStage(canvas) {
    const text = canvas.textContent || '';
    return stages.find(stage => stage.selector ? canvas.querySelector(stage.selector) : stage.pattern?.test(text)) || null;
  }

  function render() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas || canvas.querySelector('.v18-handoff')) return;
    const stage = activeStage(canvas);
    const shell = canvas.querySelector('.stage-shell');
    if (!stage || !shell) return;
    shell.insertAdjacentHTML('beforeend', `
      <div class="v18-handoff" data-event-stage="${stage.id}" data-event-status="completed" data-event-source="presented-backend-event" data-output-artifact="${stage.output.replaceAll(' ', '_')}">
        <span aria-hidden="true"></span>
        <div><small>Live handoff</small><strong>${stage.agent} added ${stage.output} to the shared claim context for ${stage.next}.</strong></div>
      </div>`);
  }

  function boot() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;
    new MutationObserver(() => requestAnimationFrame(render)).observe(canvas, { childList: true, subtree: true });
    window.setInterval(render, 160);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
