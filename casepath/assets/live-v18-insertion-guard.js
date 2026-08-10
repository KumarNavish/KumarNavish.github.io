(() => {
  'use strict';

  const uniqueClasses = [
    'v17-law-map',
    'v17-law-details',
    'v18-ready-artifacts',
    'v18-memory-boundary',
    'v18-reuse-proof',
  ];
  const originalInsertBefore = Node.prototype.insertBefore;

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

  window.CASEPATH_INSERTION_GUARD = '18.0.0';
})();
