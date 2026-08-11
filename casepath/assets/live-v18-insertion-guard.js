(() => {
  'use strict';

  const uniqueClasses = [
    'v17-law-map',
    'v17-law-details',
    'v17-build-state',
    'v17-evidence-chain',
    'v17-experience-note',
    'v17-reuse-thread',
    'v18-ready-artifacts',
    'v18-review-propagation',
    'v18-review-applied',
    'v18-memory-boundary',
    'v18-reuse-proof',
  ];
  const originalInsertBefore = Node.prototype.insertBefore;
  const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;

  Node.prototype.insertBefore = function guardedInsertBefore(newNode, referenceNode) {
    if (newNode instanceof Element) {
      const uniqueClass = uniqueClasses.find(className => newNode.classList.contains(className));
      if (uniqueClass) {
        const existing = [...this.children].find(child => child instanceof Element && child.classList.contains(uniqueClass));
        if (existing) return existing;
      }
    }
    return originalInsertBefore.call(this, newNode, referenceNode);
  };

  Element.prototype.insertAdjacentHTML = function guardedInsertAdjacentHTML(position, markup) {
    if (typeof markup === 'string' && markup.includes('data-event-source="presented-backend-event"')) return;
    return originalInsertAdjacentHTML.call(this, position, markup);
  };

  const nativeFetch = window.fetch.bind(window);
  const pendingRunReads = new Map();
  const runReadWindowMs = 350;

  window.fetch = async function stableFetch(input, init = {}) {
    const request = typeof input === 'string' || input instanceof URL ? null : input;
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    let url;
    try {
      url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
    } catch (_) {
      return nativeFetch(input, init);
    }

    const isRunRead = method === 'GET' && /^\/api\/runs\/[^/]+$/.test(url.pathname);
    if (!isRunRead) return nativeFetch(input, init);

    const now = performance.now();
    const existing = pendingRunReads.get(url.href);
    if (existing && now - existing.startedAt < runReadWindowMs) {
      const response = await existing.promise;
      return response.clone();
    }

    const promise = nativeFetch(input, init);
    pendingRunReads.set(url.href, { promise, startedAt: now });
    try {
      const response = await promise;
      return response.clone();
    } finally {
      window.setTimeout(() => {
        const current = pendingRunReads.get(url.href);
        if (current?.promise === promise) pendingRunReads.delete(url.href);
      }, runReadWindowMs);
    }
  };

  const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (innerHTML?.get && innerHTML?.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: innerHTML.configurable,
      enumerable: innerHTML.enumerable,
      get: innerHTML.get,
      set(value) {
        if (this.classList?.contains('v19-team-rail') && innerHTML.get.call(this) === String(value)) return;
        innerHTML.set.call(this, value);
      },
    });
  }

  window.CASEPATH_INSERTION_GUARD = '19.0.1';
  window.CASEPATH_RUNTIME_STABILITY = '19.0.0';
})();
