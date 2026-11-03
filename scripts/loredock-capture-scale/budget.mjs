// Internal request capability only. No HTTP/configuration budget option exists.
export const captureAccounting = Object.freeze({ version: 'shared-capture-work/1', work: 1000000, wallMs: 5000 });
export class BudgetError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fail = (code, message) => { throw new BudgetError(code, message); };
export class CaptureBudget {
  #path = 0; #receipt = 0; #closed = false; #ended; #pathUsed = false; #observe; #signal;
  #began; #limits;
  constructor({ limits = {}, signal, observe, wallCeiling = captureAccounting.wallMs } = {}) {
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) fail('INVALID_CAPTURE_LIMIT', 'Use internal numeric capture limits.');
    this.#limits = Object.freeze({ work: captureAccounting.work, wallMs: captureAccounting.wallMs, ...limits });
    for (const [key, value] of Object.entries(this.#limits)) if (!['work', 'wallMs'].includes(key) || !Number.isSafeInteger(value) || value < 0 || value > captureAccounting[key])
      fail('INVALID_CAPTURE_LIMIT', 'Capture limits may only reduce the fixed bounds.');
    if (!Number.isSafeInteger(wallCeiling) || wallCeiling < 0 || wallCeiling > captureAccounting.wallMs)
      fail('INVALID_CAPTURE_LIMIT', 'The local deadline may only reduce the shared deadline.');
    this.#limits = Object.freeze({ ...this.#limits, wallMs: Math.min(wallCeiling, this.#limits.wallMs) });
    if ((signal !== undefined && !(signal instanceof AbortSignal)) || (observe !== undefined && typeof observe !== 'function'))
      fail('INVALID_CAPTURE_BUDGET', 'Capture hooks and cancellation must be internal capabilities.');
    this.#signal = signal; this.#observe = observe; this.#began = performance.now(); this.check();
  }
  get began() { return this.#began; }
  get deadline() { return this.#began + this.#limits.wallMs; }
  get limits() { return this.#limits; }
  check() {
    if (this.#closed) fail('CLOSED_CAPTURE_BUDGET', 'A completed operation budget cannot be reused.');
    if (this.#signal?.aborted) fail('CANCELLED', 'Capture work was cancelled.');
    if (performance.now() >= this.deadline) fail('CAPTURE_TIME_LIMIT', 'The shared capture deadline was reached.');
  }
  claimPath() {
    this.check(); if (this.#pathUsed) fail('CAPTURE_BUDGET_OWNERSHIP', 'This operation already owns a path read.');
    this.#pathUsed = true;
  }
  charge(phase, units = 1) {
    this.check();
    if (!['path', 'receipt'].includes(phase) || !Number.isSafeInteger(units) || units < 0)
      fail('INVALID_CAPTURE_CHARGE', 'Charge a nonnegative integer to an explicit phase.');
    if (units > this.#limits.work - this.#path - this.#receipt) fail('CAPTURE_WORK_LIMIT', 'The shared capture work bound was reached.');
    if (phase === 'path') this.#path += units; else this.#receipt += units;
    const returned = this.#observe?.({ phase, units });
    if (returned?.then) fail('INVALID_CAPTURE_OBSERVER', 'The internal charge observer must be synchronous.');
    this.check();
  }
  stats() { return { accountingVersion: captureAccounting.version, pathWork: this.#path, receiptWork: this.#receipt,
    totalWork: this.#path + this.#receipt, wallMs: (this.#ended ?? performance.now()) - this.#began }; }
  close() { if (!this.#closed) { this.#ended = performance.now(); this.#closed = true; } }
}
