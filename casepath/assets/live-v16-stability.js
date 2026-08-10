(() => {
  'use strict';

  const viewer = document.querySelector('#sourceViewer');
  const stage = document.querySelector('#sourceStage');
  if (!viewer || !stage) return;

  function keepActiveRepresentationVisible() {
    if (!viewer.open) return;
    stage.hidden = false;
    stage.removeAttribute('aria-hidden');
    stage.style.removeProperty('display');
    stage.style.removeProperty('visibility');
    stage.style.removeProperty('opacity');
    for (const child of stage.children) {
      child.hidden = false;
      child.removeAttribute('aria-hidden');
      child.style.removeProperty('display');
      child.style.removeProperty('visibility');
      child.style.removeProperty('opacity');
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
})();
