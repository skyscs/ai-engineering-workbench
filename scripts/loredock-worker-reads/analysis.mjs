// Offline seam: the pinned TypeScript-private worker emits a normal prototype method.
// Keep the original constructor, shared ownership guard, scheduler and worker body.
export function createWorkerReads({ CodeAnalysis }) {
  if (typeof CodeAnalysis.prototype.run !== 'function') throw new Error('Unsupported inventory worker seam.');
  return class PreparedWorkerAnalysis extends CodeAnalysis {
    constructor(catalog, ...args) {
      if (typeof catalog?.store?.withPreparedReads !== 'function') throw new Error('Prepared inventory reads require the scoped store.');
      super(catalog, ...args);
    }
    run(id) {
      return this.catalog.store.withPreparedReads(() => super.run(id));
    }
  };
}
