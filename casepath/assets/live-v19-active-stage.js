(() => {
  'use strict';

  const labels = {
    read: 'Read',
    understand: 'Understand',
    research: 'Law',
    process: 'Process',
    evidence: 'Evidence',
    experience: 'Experience',
    verify: 'Verify',
  };

  function synchronize() {
    const rail = document.querySelector('.v19-team-history');
    const activeId = document.querySelector('.v18-progress-focus')?.dataset.activeStage;
    const label = labels[activeId];
    if (!rail || !label) return;

    const matching = [...rail.querySelectorAll('li')].filter(item => item.textContent.trim().startsWith(`${label} ·`));
    const item = matching.at(-1) || document.createElement('li');
    for (const duplicate of matching) {
      if (duplicate !== item) duplicate.remove();
    }
    item.dataset.state = 'active';
    item.title = 'working now';
    item.textContent = `${label} · working now`;
    if (!item.isConnected) rail.append(item);
  }

  function boot() {
    const target = document.querySelector('#agentProgress');
    if (!target) return;
    new MutationObserver(() => requestAnimationFrame(synchronize)).observe(target, { childList: true, subtree: true, attributes: true });
    window.setInterval(synchronize, 120);
    synchronize();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
