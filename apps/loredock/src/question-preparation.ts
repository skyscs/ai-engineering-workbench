import { randomUUID } from 'node:crypto';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import type { CodeAnalysis } from './code-analysis.js';
import type { CatalogStore } from './store.js';
import { CatalogError } from './types.js';
import { retrieveAnswerContext } from './answer-context.js';
import { OperationBudget } from './operation-budget.js';
import { LegacyReadOperation } from './legacy-read-operation.js';
import { CaptureWork, type CaptureStage } from './native-capture-work.js';
import { CodePathsV2 } from './code-paths-v2.js';
import type { PathStage } from './code-paths-work.js';
import { chooseQuestionRoot, SelectionUnavailable, type SelectionObservation } from './question-path-selection.js';
import { decodeProjection } from './native-receipt-projection.js';
import { encodeNativeReceipt } from './native-receipt.js';
import { bytes, hash, same, requireReceipt } from './native-receipt-json.js';
import { compactQuestionPath, inputSpan, preparedQuestionPrompt } from './question-context.js';
import { assertQuestionCurrent, authorizeQuestionScope, questionSnapshot, questionSourceIds, readQuestionSnapshot } from './question-witness.js';
import { questionPreparationLimits, questionPreparationVersion, questionPromptVersion, questionWitnessVersion,
  type NativeQuestionCompact, type QuestionSnapshot, type QuestionWitness, type QuestionPreparationState, type QuestionPreview } from './question-preparation-types.js';

type Stage = CaptureStage | PathStage | 'lexical';
interface PreparationOptions {
  checkpoint?: (info: { stage: Stage }) => void | Promise<void>;
  budget?: Pick<NonNullable<ConstructorParameters<typeof OperationBudget>[0]>, 'limits' | 'observe'>;
}
interface Entry { state: QuestionPreparationState; questionHash: string; snapshot?: QuestionSnapshot; expires?: number; timer?: NodeJS.Timeout }
interface Shared {
  entry?: Entry; terminal?: Entry; active?: { controller: AbortController; done: Promise<void> };
  answer?: symbol; configuration?: symbol; stopped: boolean;
}
const owners = new WeakMap<CatalogStore, Shared>();
function fail(code: string, message: string): never { throw new CatalogError(code, message, 409); }
const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error
  && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'QUESTION_FAILED';
const isThenable = (value: unknown) => value !== null && (typeof value === 'object' || typeof value === 'function') && 'then' in value;
function sharedOwner(store: CatalogStore) {
  let shared = owners.get(store); if (!shared) { shared = { stopped: false }; owners.set(store, shared); } return shared;
}
function checkIdle(store: CatalogStore, shared: Shared) {
  if (shared.stopped) fail('SERVICE_STOPPED', 'Question preparation is stopping.');
  if (shared.active || shared.answer || shared.configuration
    || store.one("SELECT 1 FROM answer_attempts WHERE status IN ('preparing','running') LIMIT 1"))
    fail('QUESTION_BUSY', 'Finish or cancel the current question operation first.');
}
/** Every answer instance shares these reservations, even without a preparation consumer. */
export function reserveQuestionAnswer(store: CatalogStore) {
  const shared = sharedOwner(store); checkIdle(store, shared); const token = Symbol('question-answer'); shared.answer = token;
  return { release: () => { if (shared.answer === token) delete shared.answer; },
    check: () => { if (shared.stopped || shared.answer !== token) fail('QUESTION_LEASE_EXPIRED', 'This answer reservation ended.'); } };
}
export function reserveQuestionConfiguration(store: CatalogStore) {
  const shared = sharedOwner(store); checkIdle(store, shared); const token = Symbol('question-configuration'); shared.configuration = token;
  return { release: () => { if (shared.configuration === token) delete shared.configuration; },
    check: () => { if (shared.stopped || shared.configuration !== token) fail('QUESTION_LEASE_EXPIRED', 'This configuration reservation ended.'); } };
}

/** Internal only: one transient slot per exact store; no queue, saved receipt or model. */
export class QuestionPreparations {
  private readonly shared: Shared;
  private readonly unsubscribe: () => void;
  private observation: { id: string; budget: ReturnType<OperationBudget['stats']> | null; lexical: ReturnType<LegacyReadOperation['stats']> | null; nativeReads: number } | null = null;
  constructor(private readonly analysis: CodeAnalysis, private readonly options: PreparationOptions = {}) {
    const store = analysis.catalog.store;
    this.shared = sharedOwner(store);
    this.unsubscribe = analysis.catalog.onBoundaryChange(() => this.discard('fenced', 'QUESTION_SCOPE_FENCED'));
  }
  private discard(status: 'cancelled' | 'expired' | 'fenced' | 'failed' | 'consumed', reason: string | null) {
    const shared = this.shared, entry = shared.entry;
    shared.active?.controller.abort();
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    delete entry.snapshot; delete entry.expires; delete entry.timer;
    entry.state = { ...entry.state, status, reason, reviewedHash: null };
    shared.terminal = entry; delete shared.entry;
  }
  private busy() { checkIdle(this.analysis.catalog.store, this.shared); }
  ownsStore(store: CatalogStore) { return this.analysis.catalog.store === store; }
  private find(id: string): Entry {
    const entry = this.shared.entry?.state.id === id ? this.shared.entry : this.shared.terminal?.state.id === id ? this.shared.terminal : undefined;
    if (!entry) fail('QUESTION_NOT_FOUND', 'This preparation is unavailable. Find context again.');
    return entry;
  }
  private ready(id: string, reviewedHash?: string) {
    const entry = this.find(id);
    if (entry.state.status !== 'ready' || !entry.snapshot) fail('QUESTION_NOT_READY', 'Find and review current context first.');
    if (performance.now() >= entry.expires!) { this.discard('expired', 'QUESTION_EXPIRED'); fail('QUESTION_EXPIRED', 'Find context again after the preview expires.'); }
    try {
      const value = readQuestionSnapshot(entry.snapshot);
      assertQuestionCurrent(this.analysis.catalog, value.context, value.witness.sourceIds);
      if (reviewedHash !== undefined && entry.snapshot.reviewedHash !== reviewedHash) fail('QUESTION_REVIEW_CHANGED', 'Use the exact reviewed context.');
      return { entry, snapshot: entry.snapshot, ...value };
    } catch (error) {
      if (!(error instanceof CatalogError && error.code === 'QUESTION_REVIEW_CHANGED')) this.discard('fenced', errorCode(error));
      throw error;
    }
  }
  get(id: string): QuestionPreparationState {
    const entry = this.find(id);
    if (entry.state.status === 'ready') { try { this.ready(id); } catch { /* The terminal state is the polling response. */ } }
    return { ...this.find(id).state };
  }
  review(id: string): QuestionPreview {
    const { entry, context, witness } = this.ready(id);
    return { ...entry.state, context, compact: witness.compact, selection: witness.selection, promptVersion: witness.promptVersion };
  }
  start(requestId: string, question: string): QuestionPreparationState {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(requestId)) fail('INVALID_REQUEST', 'Use a bounded preparation request ID.');
    if (typeof question !== 'string' || !question.trim() || bytes(question) > 2000) fail('INVALID_QUESTION', 'Enter a question of at most 2,000 UTF-8 bytes.');
    const questionHash = hash(question.trim()), previous = [this.shared.entry, this.shared.terminal].find(row => row?.state.requestId === requestId);
    if (previous) {
      if (previous.questionHash !== questionHash) fail('CONFLICT', 'This request ID has a different question.');
      return this.get(previous.state.id);
    }
    this.busy();
    const store = this.analysis.catalog.store;
    if (store.one("SELECT 1 FROM code_analyses WHERE status='running' LIMIT 1")) fail('QUESTION_ANALYSIS_BUSY', 'Wait for code analysis to finish or pause it before finding context.');
    const buildId = store.project().publishedBuildId;
    if (!buildId) fail('NOT_READY', 'Index sources before finding context.');
    if (this.shared.entry) this.discard('expired', 'QUESTION_REPLACED');
    const entry: Entry = { questionHash, state: { id: randomUUID(), requestId, status: 'preparing', reason: null, reviewedHash: null } };
    const controller = new AbortController(); let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    this.shared.entry = entry; this.shared.active = { controller, done };
    // Reservation precedes even a synchronous internal checkpoint or worker.
    void this.prepare(entry, question, buildId, controller.signal).catch(error => {
      if (this.shared.entry === entry) this.discard(controller.signal.aborted ? 'cancelled' : 'failed',
        errorCode(error));
    }).finally(() => { delete this.shared.active; finish(); });
    return { ...entry.state };
  }
  private async prepare(entry: Entry, question: string, buildId: string, signal: AbortSignal) {
    const catalog = this.analysis.catalog, store = catalog.store;
    let budget: OperationBudget | undefined, lexical: LegacyReadOperation | undefined, paths: CodePathsV2 | undefined, nativeReads = 0;
    try {
      budget = new OperationBudget({ ...this.options.budget, signal });
      const checkpoint = async (info: { stage: Stage }) => { await this.options.checkpoint?.(info); };
      const work = new CaptureWork(catalog, budget, signal, { checkpoint });
      await yieldTurn(); await checkpoint({ stage: 'lexical' }); work.check();
      lexical = new LegacyReadOperation(catalog, budget, signal);
      const account = lexical;
      const context = await store.withPreparedReads(() => retrieveAnswerContext(catalog, question, buildId, account));
      const { dependencies } = work.dependencies(buildId), sourceIds = questionSourceIds(context, { dependencies });
      assertQuestionCurrent(catalog, context, sourceIds);
      let selection: SelectionObservation | null = null, receipt: string | null = null;
      let compact: NativeQuestionCompact = { item: null, reason: null };
      paths = new CodePathsV2(this.analysis, { checkpoint, selectRoot: async (resolution, pathWork) => {
        const selected = await chooseQuestionRoot(resolution, context, pathWork); selection = selected.observation; return selected;
      } });
      try {
        nativeReads++;
        const projection = await paths.read({ buildId }, 'paths', signal, budget);
        if (projection.status === 'unavailable') compact = { item: null, reason: projection.reason.code };
        else {
          await work.step('projection');
          const projectionJson = JSON.stringify(projection), decoded = decodeProjection(projectionJson, work.context);
          work.authorized(decoded.value, dependencies);
          const originals = [];
          for (const id of [...decoded.evidence.keys()].sort()) { await work.step('originals'); originals.push(work.original(id)); }
          const encoded = encodeNativeReceipt({ schemaVersion: 'loredock-code-path-receipt/1', catalogId: store.receipts.catalogId,
            projectionJson, originals, dependencies }, store.receipts.catalogId, budget);
          receipt = encoded.serialized; compact = compactQuestionPath(context, encoded, budget);
        }
      } catch (error) {
        if (!(error instanceof SelectionUnavailable)) throw error;
        selection = error.observation; compact = { item: null, reason: error.code };
      }
      for (const span of context.spans) { await work.step('originals'); const original = work.original(span.id);
        requireReceipt(original.buildId === context.buildId && same(inputSpan(original), span), 'QUESTION_ORIGINAL_MISMATCH'); }
      const prompt = preparedQuestionPrompt(context, compact.item); budget.charge('receipt', bytes(prompt));
      const witness: QuestionWitness = { schemaVersion: questionWitnessVersion, compositionVersion: questionPreparationVersion,
        promptVersion: questionPromptVersion, catalogId: store.receipts.catalogId, lexicalInputHash: context.inputHash,
        receipt, compact, selection, dependencies, sourceIds, prompt, promptHash: hash(prompt) };
      const snapshot = questionSnapshot(context, witness, budget);
      await work.step('handoff');
      assertQuestionCurrent(catalog, context, sourceIds); authorizeQuestionScope(work, context, witness); work.check();
      requireReceipt(this.shared.entry === entry && !this.shared.stopped && !signal.aborted, 'CANCELLED');
      // No await between the final authority fence and publishing owned immutable bytes.
      entry.snapshot = snapshot; entry.expires = performance.now() + questionPreparationLimits.readyMs;
      entry.state = { ...entry.state, status: 'ready', reviewedHash: snapshot.reviewedHash };
      const expire = () => {
        if (this.shared.entry !== entry) return;
        const remaining = entry.expires! - performance.now();
        if (remaining <= 0) this.discard('expired', 'QUESTION_EXPIRED');
        else { entry.timer = setTimeout(expire, Math.ceil(remaining)); entry.timer.unref(); }
      };
      entry.timer = setTimeout(expire, questionPreparationLimits.readyMs); entry.timer.unref();
    } finally {
      budget?.close(); this.observation = { id: entry.state.id, budget: budget?.stats() ?? null, lexical: lexical?.stats() ?? null, nativeReads };
      if (paths) void paths.stop();
    }
  }
  cancel(id: string) {
    const entry = this.find(id);
    if (entry === this.shared.entry) this.discard('cancelled', 'CANCELLED');
    return this.get(id);
  }
  async idle() { await this.shared.active?.done; }
  metrics() { return this.observation ? structuredClone(this.observation) : null; }
  reserveConfiguration() { return reserveQuestionConfiguration(this.analysis.catalog.store); }
  /** A future answer adapter supplies its synchronous transaction; rollback retains Ready. */
  promote<T>(id: string, reviewedHash: string, commit: (snapshot: QuestionSnapshot) => T): { value: T; release: () => void } {
    this.busy(); const { snapshot } = this.ready(id, reviewedHash), token = Symbol('question-answer');
    this.shared.answer = token;
    const release = () => { if (this.shared.answer === token) delete this.shared.answer; };
    try {
      const value = commit(Object.freeze({ ...snapshot }));
      if (isThenable(value)) {
        if (value instanceof Promise) void value.catch(() => undefined);
        fail('ASYNC_QUESTION_PROMOTION', 'Question promotion must commit synchronously.');
      }
      this.discard('consumed', null); return { value, release };
    } catch (error) { release(); throw error; }
  }
  async stop() { this.shared.stopped = true; this.discard('cancelled', 'SERVICE_STOPPED'); await this.shared.active?.done; this.unsubscribe(); }
}
