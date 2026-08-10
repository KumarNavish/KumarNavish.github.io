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
  if (!viewer || !stage) return;

  function keepActiveRepresentationVisible({ reopen = false } = {}) {
    if (!viewer.open && reopen) {
      try { viewer.showModal(); } catch (_) {}
    }
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

  new MutationObserver(() => keepActiveRepresentationVisible()).observe(stage, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'aria-hidden'],
  });

  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-source-tab]')) return;
    requestAnimationFrame(() => keepActiveRepresentationVisible({ reopen: true }));
    setTimeout(() => keepActiveRepresentationVisible({ reopen: true }), 100);
    setTimeout(() => keepActiveRepresentationVisible({ reopen: true }), 600);
  });
})();
