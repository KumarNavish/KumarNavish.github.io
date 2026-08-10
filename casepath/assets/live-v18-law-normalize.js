(() => {
  'use strict';

  function normalize() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;
    const maps = [...canvas.querySelectorAll('.v17-law-map')];
    const details = [...canvas.querySelectorAll('.v17-law-details')];
    if (!maps.length && !details.length) return;

    const retainedMap = maps[0] || null;
    for (const map of maps) {
      if (map !== retainedMap) map.remove();
    }
    if (retainedMap) {
      retainedMap.dataset.v18Backed = 'true';
      retainedMap.setAttribute('aria-label', 'Swiss-law sources connected to the process decisions they shape');
    }

    const retainedDetails = details.find(item => item.querySelector('.law-flow')) || details.at(-1) || null;
    for (const item of details) {
      if (item !== retainedDetails) item.remove();
    }
    if (retainedDetails) {
      retainedDetails.removeAttribute('open');
      retainedDetails.dataset.v18Normalized = 'true';
    }
  }

  function boot() {
    const canvas = document.querySelector('#stageCanvas');
    if (!canvas) return;
    new MutationObserver(() => requestAnimationFrame(normalize)).observe(canvas, { childList: true, subtree: true });
    window.setInterval(normalize, 140);
    normalize();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
