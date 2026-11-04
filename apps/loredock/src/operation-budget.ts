export const operationAccounting = Object.freeze({ version: 'shared-capture-work/1', work: 1000000, wallMs: 5000 });
export class OperationBudgetError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
type Phase = 'path' | 'receipt';
interface Limits { work: number; wallMs: number }
interface BudgetOptions {
  limits?: Partial<Limits>; signal?: AbortSignal; wallCeiling?: number;
  observe?: (charge: { phase: Phase; units: number }) => unknown;
}
const fail = (code: string, message: string): never => { throw new OperationBudgetError(code, message); };

/** Internal operation capability. It is never constructed from HTTP or user configuration. */
export class OperationBudget {
  #path = 0; #receipt = 0; #closed = false; #ended: number | undefined; #pathUsed = false;
  readonly #observe: BudgetOptions['observe']; readonly #signal: AbortSignal | undefined;
  readonly #began: number; readonly #limits: Readonly<Limits>;
  constructor({ limits = {}, signal, observe, wallCeiling = operationAccounting.wallMs }: BudgetOptions = {}) {
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) fail('INVALID_CAPTURE_LIMIT', 'Use internal numeric capture limits.');
    const effective = { work: operationAccounting.work, wallMs: operationAccounting.wallMs, ...limits };
    for (const [key, value] of Object.entries(effective)) {
      if (!['work', 'wallMs'].includes(key) || !Number.isSafeInteger(value) || value < 0 || value > operationAccounting[key as keyof Limits])
        fail('INVALID_CAPTURE_LIMIT', 'Capture limits may only reduce the fixed bounds.');
    }
    if (!Number.isSafeInteger(wallCeiling) || wallCeiling < 0 || wallCeiling > operationAccounting.wallMs)
      fail('INVALID_CAPTURE_LIMIT', 'The local deadline may only reduce the shared deadline.');
    this.#limits = Object.freeze({ ...effective, wallMs: Math.min(wallCeiling, effective.wallMs) });
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
  charge(phase: Phase, units = 1) {
    this.check();
    if (!['path', 'receipt'].includes(phase) || !Number.isSafeInteger(units) || units < 0)
      fail('INVALID_CAPTURE_CHARGE', 'Charge a nonnegative integer to an explicit phase.');
    if (units > this.#limits.work - this.#path - this.#receipt) fail('CAPTURE_WORK_LIMIT', 'The shared capture work bound was reached.');
    if (phase === 'path') this.#path += units; else this.#receipt += units;
    const returned = this.#observe?.({ phase, units });
    if (returned !== null && (typeof returned === 'object' || typeof returned === 'function') && 'then' in returned && returned.then)
      fail('INVALID_CAPTURE_OBSERVER', 'The internal charge observer must be synchronous.');
    this.check();
  }
  stats() { return { accountingVersion: operationAccounting.version, pathWork: this.#path, receiptWork: this.#receipt,
    totalWork: this.#path + this.#receipt, wallMs: (this.#ended ?? performance.now()) - this.#began }; }
  close() { if (!this.#closed) { this.#ended = performance.now(); this.#closed = true; } }
}
