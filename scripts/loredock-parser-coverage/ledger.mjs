// Diagnostic request ledger. It deliberately does not compute aggregate heap peaks.
export class HeapLedger {
  constructor({ now = () => performance.now(), emit = () => {}, requestLimit = 4000 } = {}) {
    this.now = now; this.emit = emit; this.limit = requestLimit;
    this.workers = new Map(); this.requests = []; this.closedAt = null;
  }
  add(id, createdAt, returnedAt, getHeap) {
    if (this.closedAt !== null || this.workers.has(id)) throw new Error('Invalid observer worker registration.');
    this.workers.set(id, { id, createdAt, returnedAt, getHeap, pending: null, exitedAt: null, skipped: 0 });
  }
  exit(id) {
    const worker = this.workers.get(id);
    if (!worker || worker.exitedAt !== null) throw new Error('Invalid observer worker exit.');
    worker.exitedAt = this.now();
  }
  request(id) {
    if (this.closedAt !== null) return;
    const worker = this.workers.get(id);
    if (!worker) throw new Error('Unknown observer worker.');
    if (worker.exitedAt !== null) return;
    if (worker.pending) { worker.skipped++; return; }
    if (this.requests.length >= this.limit) throw new Error('Observer heap request bound exceeded.');
    const row = { id: this.requests.length + 1, worker: id, requestedAt: this.now(), completedAt: null,
      status: 'pending', measurementAt: null, heap: null, error: null };
    this.requests.push(row); worker.pending = row;
    this.emit({ type: 'heap-request', ...row });
    let pending;
    try { pending = worker.getHeap(); } catch (error) { pending = Promise.reject(error); }
    const finish = (status, heap, error) => {
      // Closing records unresolved requests without waiting forever or accepting late credit.
      if (this.closedAt !== null) return;
      row.completedAt = this.now(); row.status = status; row.heap = heap; row.error = error;
      worker.pending = null;
      this.emit({ type: 'heap-completion', ...row, afterExit: worker.exitedAt !== null });
    };
    void Promise.resolve(pending).then(value => {
      if (!value || !Number.isSafeInteger(value.used_heap_size) || value.used_heap_size < 0) {
        finish('invalid', null, { name: 'InvalidHeapSample', code: null }); return;
      }
      finish('fulfilled', { ...value }, null);
    }, error => finish('rejected', null, { name: error?.name ?? 'Error', code: error?.code ?? null }));
  }
  tick() { for (const id of this.workers.keys()) this.request(id); }
  close() {
    this.closedAt ??= this.now();
    return this.report();
  }
  report() {
    return {
      closedAt: this.closedAt, completeStartup: false, completeIsolateSet: false,
      simultaneousHeapPeakBytes: null, resourceQualification: false,
      workers: [...this.workers.values()].map(({ getHeap, pending, ...worker }) => {
        const requests = this.requests.filter(row => row.worker === worker.id);
        const good = requests.filter(row => row.status === 'fulfilled');
        return { ...worker, pendingAtClose: this.closedAt === null ? null : pending?.id ?? null,
          firstSuccessfulWindow: good.length ? [good[0].requestedAt, good[0].completedAt] : null,
          lastSuccessfulWindow: good.length ? [good.at(-1).requestedAt, good.at(-1).completedAt] : null,
          sampledHeapMaximumBytes: good.length ? Math.max(...good.map(row => row.heap.used_heap_size)) : null };
      }),
      requests: this.requests.map(row => ({ ...row, heap: row.heap ? { ...row.heap } : null })),
    };
  }
}
