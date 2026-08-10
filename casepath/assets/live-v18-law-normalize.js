(() => {
  'use strict';

  function keepOne(nodes, preferred = null) {
    const retained = preferred || nodes[0] || null;
    for (const node of nodes) {
      if (node !== retained) node.remove();
    }
    return retained;
  }

  function normalize() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;

    const maps = [...canvas.querySelectorAll('.v17-law-map')];
    const retainedMap = keepOne(maps);
    if (retainedMap) {
      retainedMap.dataset.v18Backed = 'true';
      retainedMap.setAttribute('aria-label', 'Swiss-law sources connected to the process decisions they shape');
    }

    const details = [...canvas.querySelectorAll('.v17-law-details')];
    const retainedDetails = keepOne(details, details.find(item => item.querySelector('.law-flow')) || details.at(-1) || null);
    if (retainedDetails) {
      retainedDetails.removeAttribute('open');
      retainedDetails.dataset.v18Normalized = 'true';
    }

    const readyArtifacts = [...canvas.querySelectorAll('.v18-ready-artifacts')];
    const retainedReady = keepOne(readyArtifacts);
    if (retainedReady) retainedReady.dataset.v18Normalized = 'true';

    const memoryBoundaries = [...canvas.querySelectorAll('.v18-memory-boundary')];
    const retainedMemory = keepOne(memoryBoundaries);
    if (retainedMemory) retainedMemory.dataset.v18Normalized = 'true';

    const reuseProofs = [...canvas.querySelectorAll('.v18-reuse-proof')];
    const retainedReuse = keepOne(reuseProofs, reuseProofs.find(item => item.querySelector('.v17-reuse-thread')) || reuseProofs.at(-1) || null);
    if (retainedReuse) retainedReuse.dataset.v18Normalized = 'true';
  }

  function boot() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;
    new MutationObserver(() => requestAnimationFrame(normalize)).observe(canvas, { childList: true, subtree: true });
    window.setInterval(normalize, 120);
    normalize();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
