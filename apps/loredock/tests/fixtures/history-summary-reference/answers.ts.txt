import { randomUUID } from 'node:crypto';
import { QuestionPreparations, reserveQuestionAnswer, reserveQuestionConfiguration } from './question-preparation.js';
import { AnswerWitnessStore, preparedAnswerRequestHash } from './answer-witness-store.js';
import { preparedAnswerInputKind } from './answer-witness-schema.js';
import type { NativeQuestionCompact, QuestionWitness } from './question-preparation-types.js';
import { runPreparedAnswer } from './prepared-answer.js';
import { uuid, hex } from './native-receipt-json.js';
import { realpath } from 'node:fs/promises';
import { CodexTextRuntime, RuntimeError, textCliVersion, type TextConnection, type TextRuntime, type TextRuntimeIdentity, type TextUsage } from '@aew/ai';
import { Catalog } from './catalog.js';
import { answerSchemaVersion, citedAnswerSchema, retrieveAnswerContext, validateCitedAnswer, type AnswerContext, type CitedAnswer } from './answer-context.js';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';
import { assertAnswerReviewCurrent } from './answer-review.js';
import { answerPrompt, answerPromptVersion } from './answer-prompt.js';
export { answerPrompt, answerPromptVersion } from './answer-prompt.js';
export type AnswerStatus = 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'fenced';
interface AttemptRow {
  inputKind?: string;
  id: string; requestId: string; payloadHash: string; question: string; buildId: string; policyVersion: number; registryVersion: number;
  status: AnswerStatus; context: string | null; inputHash: string; connection: string; runtime: string | null;
  model: string; effort: 'medium'; promptVersion: string; schemaVersion: string; result: string | null; usage: string | null;
  usageUnknownReason: string | null; reason: string | null; createdAt: string; dispatchedAt: string | null; completedAt: string | null;
}
export interface AnswerAttempt {
  inputKind?: typeof preparedAnswerInputKind; nativeContext?: NativeQuestionCompact | null;
  id: string; question: string; buildId: string; status: AnswerStatus; stale: boolean;
  reviewState: 'current' | 'changed' | 'not-recorded' | 'unavailable';
  context: AnswerContext | null; answer: CitedAnswer | null; runtime: TextRuntimeIdentity | null;
  model: string; effort: 'medium'; usage: TextUsage | null; usageUnknownReason: string | null; reason: string | null;
  promptVersion: string; schemaVersion: string;
  createdAt: string; dispatchedAt: string | null;
}
const pending = (status: string) => status === 'preparing' || status === 'running';

export class Answers {
  private worker: { id: string; controller: AbortController; done: Promise<void> } | undefined;
  private readonly unsubscribe: () => void;
  private stopping = false;
  constructor(readonly catalog: Catalog, private readonly runtime: TextRuntime = new CodexTextRuntime(), private readonly preparations?: QuestionPreparations) {
    if (preparations && !preparations.ownsStore(catalog.store)) throw new CatalogError('INVALID_PREPARATION_OWNER', 'Use this catalog’s preparation owner.', 409);
    this.unsubscribe = catalog.onBoundaryChange(() => this.invalidate());
  }
  configuration(): TextConnection | null {
    const row = this.catalog.store.one<{ connection: string }>('SELECT connection FROM answer_settings WHERE id=1');
    return row ? JSON.parse(row.connection) as TextConnection : null;
  }
  async configure(input: TextConnection) {
    if (this.worker) throw new CatalogError('BUSY', 'Finish or cancel the active answer before changing configuration.', 409);
    if (typeof input?.executable !== 'string' || typeof input?.configHome !== 'string'
      || !input.executable.startsWith('/') || !input.configHome.startsWith('/')
      || (input.profile !== null && (typeof input.profile !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.profile)))) throw new CatalogError('INVALID_CONFIGURATION', 'Choose absolute executable and configuration paths.');
    if (this.stopping) throw new CatalogError('SERVICE_STOPPED', 'Answer service is stopping.', 409);
    const lease = reserveQuestionConfiguration(this.catalog.store);
    try {
      let connection: TextConnection;
      try { connection = { executable: await realpath(input.executable), configHome: await realpath(input.configHome), profile: input.profile }; }
      catch { throw new CatalogError('INVALID_CONFIGURATION', 'The executable or configuration path does not exist.'); }
      lease.check();
      if (this.stopping) throw new CatalogError('SERVICE_STOPPED', 'Answer service is stopping.', 409);
      if (this.worker) throw new CatalogError('BUSY', 'An answer started while configuration was being checked.', 409);
      this.catalog.store.run('INSERT INTO answer_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET connection=excluded.connection', JSON.stringify(connection));
      return connection;
    } finally { lease.release(); }
  }

  private row(id: string): AttemptRow {
    const row = this.catalog.store.one<AttemptRow>('SELECT * FROM answer_attempts WHERE id=?', id);
    if (!row) throw new CatalogError('NOT_FOUND', 'Answer attempt not found.', 404);
    if (row.inputKind !== undefined && row.inputKind !== 'legacy' && row.inputKind !== preparedAnswerInputKind) throw new CatalogError('ANSWER_INPUT_UNSUPPORTED', 'This answer uses an unsupported input kind.', 409);
    return row;
  }
  private authorized(row: AttemptRow) {
    return row.policyVersion === this.catalog.store.project().policyVersion
      && !this.catalog.store.one("SELECT 1 FROM answer_sources a JOIN sources s ON s.id=a.sourceId WHERE a.answerId=? AND s.status!='active'", row.id);
  }
  get(id: string, includeContent = true): AnswerAttempt {
    const row = this.row(id), authorized = this.authorized(row), native = row.inputKind === preparedAnswerInputKind;
    const snapshot = native && authorized ? new AnswerWitnessStore(this.catalog).read(id) : null;
    const witness = snapshot ? JSON.parse(snapshot.witnessJson) as QuestionWitness : null;
    const context = authorized && row.context ? JSON.parse(snapshot?.contextJson ?? row.context) as AnswerContext : null;
    return { ...native ? { inputKind: preparedAnswerInputKind, nativeContext: includeContent && witness ? witness.compact : null } : {},
      id: row.id, question: row.question, buildId: row.buildId, status: authorized ? row.status : 'fenced',
      stale: row.registryVersion !== this.catalog.store.project().sourceSetVersion || row.buildId !== this.catalog.store.project().publishedBuildId,
      reviewState: !authorized ? 'unavailable' : !context?.review ? 'not-recorded'
        : context.review.revision === this.catalog.store.project().correctionRevision ? 'current' : 'changed',
      context: includeContent ? context : null,
      answer: includeContent && authorized && row.result ? JSON.parse(row.result) as CitedAnswer : null,
      runtime: row.runtime ? JSON.parse(row.runtime) as TextRuntimeIdentity : null,
      model: row.model, effort: row.effort, usage: row.usage ? JSON.parse(row.usage) as TextUsage : null,
      promptVersion: row.promptVersion, schemaVersion: row.schemaVersion,
      usageUnknownReason: row.usageUnknownReason, reason: authorized ? row.reason : 'Source authorization changed. Create a new index and answer.',
      createdAt: row.createdAt, dispatchedAt: row.dispatchedAt };
  }
  state() {
    const attempts = this.catalog.store.all<{ id: string }>('SELECT id FROM answer_attempts ORDER BY rowid DESC LIMIT 20').map(row => this.get(row.id, false));
    const published = this.catalog.store.one<{ id: string }>(`SELECT a.id FROM answer_attempts a WHERE a.status='succeeded'
      AND a.policyVersion=? AND NOT EXISTS(SELECT 1 FROM answer_sources deps JOIN sources s ON s.id=deps.sourceId WHERE deps.answerId=a.id AND s.status!='active')
      ORDER BY a.rowid DESC LIMIT 1`, this.catalog.store.project().policyVersion);
    return { connection: this.configuration(), attempts, publishedAnswerId: published?.id ?? null,
      cliVersion: textCliVersion, model: 'gpt-5.6-terra', effort: 'medium', wallMs: 120000, outputBytes: 256 * 1024 };
  }
  preview(question: string, buildId?: string) { return retrieveAnswerContext(this.catalog, question, buildId); }
  start(requestId: string, question: string, buildId: string, inputHash: string): AnswerAttempt {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(requestId) || typeof question !== 'string' || typeof buildId !== 'string' || typeof inputHash !== 'string') throw new CatalogError('INVALID_REQUEST', 'A request ID and reviewed question context are required.');
    const connection = this.configuration();
    if (!connection) throw new CatalogError('CONFIGURATION_REQUIRED', 'Choose your Codex configuration before asking a question.');
    const payloadHash = sha256(JSON.stringify({ question, buildId, inputHash, connection }));
    const previous = this.catalog.store.one<AttemptRow>('SELECT * FROM answer_attempts WHERE requestId=?', requestId);
    if (previous) { if (previous.payloadHash !== payloadHash) throw new CatalogError('CONFLICT', 'This request ID has different inputs.', 409); return this.get(previous.id); }
    if (this.stopping || this.worker) throw new CatalogError('BUSY', 'Another answer is active. Wait or cancel it first.', 409);
    const release = reserveQuestionAnswer(this.catalog.store);
    try {
      const context = this.preview(question, buildId);
      if (context.inputHash !== inputHash) throw new CatalogError('INPUT_CHANGED', 'Review the current context before asking.', 409);
      const id = randomUUID();
      this.catalog.store.transaction(() => {
        this.catalog.store.run(`INSERT INTO answer_attempts
          (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,createdAt,usageUnknownReason)
          VALUES (?,?,?,?,?,?,?,'preparing',?,?,?,'gpt-5.6-terra','medium',?,?,?,'Not dispatched yet.')`,
        id, requestId, payloadHash, context.question, buildId, context.policyVersion, context.registryVersion, JSON.stringify(context), inputHash, JSON.stringify(connection), answerPromptVersion, answerSchemaVersion, new Date().toISOString());
        for (const sourceId of new Set([...context.sources.map(source => source.sourceId), ...(context.review?.sourceIds ?? [])])) {
          this.catalog.store.run('INSERT INTO answer_sources VALUES (?,?)', id, sourceId);
        }
      });
      this.launch(id, release); return this.get(id);
    } catch (error) { if (!this.worker) release(); throw error; }
  }
  startPrepared(requestId: string, preparationId: string, reviewedHash: string): AnswerAttempt {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(requestId) || !uuid(preparationId) || !hex(reviewedHash))
      throw new CatalogError('INVALID_REQUEST', 'A request ID and owned reviewed preparation are required.');
    const payloadHash = preparedAnswerRequestHash(preparationId, reviewedHash);
    const previous = this.catalog.store.one<AttemptRow>('SELECT * FROM answer_attempts WHERE requestId=?', requestId);
    if (previous) {
      if (previous.inputKind !== preparedAnswerInputKind || previous.payloadHash !== payloadHash) throw new CatalogError('CONFLICT', 'This request ID has different inputs.', 409);
      return this.get(previous.id);
    }
    if (this.stopping || this.worker) throw new CatalogError('BUSY', 'Another answer is active. Wait or cancel it first.', 409);
    const connection = this.configuration();
    if (!connection) throw new CatalogError('CONFIGURATION_REQUIRED', 'Choose your Codex configuration before asking a question.');
    if (!this.preparations) throw new CatalogError('ANSWER_PREPARATION_UNAVAILABLE', 'Question preparation is unavailable.', 409);
    const id = randomUUID(), storage = new AnswerWitnessStore(this.catalog);
    const promoted = this.preparations.promote(preparationId, reviewedHash, snapshot => storage.create({ id, requestId,
      preparationId, connection, model: 'gpt-5.6-terra', effort: 'medium' }, snapshot));
    this.launch(id, promoted.release); return this.get(id);
  }
  private launch(id: string, release: () => void) {
    const controller = new AbortController();
    // The local worker and shared reservation exist before any synchronous runtime fake.
    const done = Promise.resolve().then(() => this.run(id, controller.signal)).finally(() => {
      if (this.worker?.id === id) this.worker = undefined; release();
    });
    this.worker = { id, controller, done };
    // idle()/stop() retain the rejection; do not leave background rejection unobserved.
    void done.catch(() => undefined);
  }

  cancel(id: string) {
    const row = this.row(id);
    if (pending(row.status)) this.catalog.store.run("UPDATE answer_attempts SET status='cancelled',reason='Cancelled by the user.',completedAt=? WHERE id=?", new Date().toISOString(), id);
    if (this.worker?.id === id) this.worker.controller.abort();
    return this.get(id);
  }
  private invalidate() {
    if (!this.worker) return;
    const row = this.row(this.worker.id), project = this.catalog.store.project();
    if (!this.authorized(row) || row.registryVersion !== project.sourceSetVersion) {
      this.catalog.store.run("UPDATE answer_attempts SET status='fenced',reason='Source authorization or registry changed.',completedAt=? WHERE id=? AND status IN ('preparing','running')", new Date().toISOString(), row.id);
      this.worker.controller.abort();
    }
  }
  private async run(id: string, parentSignal: AbortSignal) {
    if (this.row(id).inputKind === preparedAnswerInputKind) return runPreparedAnswer(this.catalog, this.runtime, id, parentSignal);
    const controller = new AbortController(), abort = () => controller.abort();
    parentSignal.addEventListener('abort', abort, { once: true }); if (parentSignal.aborted) abort();
    const timer = setTimeout(abort, 120000);
    let prepared: Awaited<ReturnType<TextRuntime['prepare']>> | undefined;
    try {
      const row = this.row(id);
      if (!pending(row.status) || controller.signal.aborted) return;
      const context = JSON.parse(row.context!) as AnswerContext;
      assertAnswerReviewCurrent(this.catalog, context.review);
      prepared = await this.runtime.prepare(JSON.parse(row.connection) as TextConnection, controller.signal);
      if (!pending(this.row(id).status) || controller.signal.aborted) return;
      if (!this.authorized(row) || row.registryVersion !== this.catalog.store.project().sourceSetVersion) throw new CatalogError('INPUT_CHANGED', 'Inputs changed before dispatch.', 409);
      assertAnswerReviewCurrent(this.catalog, context.review);
      this.catalog.store.run("UPDATE answer_attempts SET status='running',runtime=?,dispatchedAt=?,usageUnknownReason='Provider usage is not yet known.' WHERE id=?", JSON.stringify(prepared.identity), new Date().toISOString(), id);
      const output = await prepared.run({ prompt: answerPrompt(context), schema: citedAnswerSchema(context), model: row.model, effort: row.effort, signal: controller.signal });
      // A usage receipt survives failed validation or late cancelled completion.
      this.catalog.store.run('UPDATE answer_attempts SET usage=?,usageUnknownReason=? WHERE id=?', output.usage ? JSON.stringify(output.usage) : null, output.usageUnknownReason, id);
      this.catalog.store.transaction(() => {
        // Cancellation or revocation wins over late completion, even if a runtime ignores abort.
        if (this.row(id).status !== 'running' || controller.signal.aborted) return;
        const answer = validateCitedAnswer(this.catalog, context, output.text);
        this.catalog.store.run("UPDATE answer_attempts SET status='succeeded',result=?,usage=?,usageUnknownReason=?,completedAt=?,reason=NULL WHERE id=? AND status='running'",
          JSON.stringify(answer), output.usage ? JSON.stringify(output.usage) : null, output.usageUnknownReason, new Date().toISOString(), id);
      });
    } catch (error) {
      if (pending(this.row(id).status)) {
        const reason = error instanceof RuntimeError ? `${error.failure.code}: ${error.message}${error.failure.stderr ? `\n${error.failure.stderr}` : ''}` : error instanceof Error ? error.message : 'Answer execution failed.';
        this.catalog.store.run("UPDATE answer_attempts SET status='failed',reason=?,completedAt=? WHERE id=?", controller.signal.aborted && !parentSignal.aborted ? 'The answer exceeded its 120-second wall limit.' : reason.slice(0, 4096), new Date().toISOString(), id);
      }
    } finally {
      clearTimeout(timer); parentSignal.removeEventListener('abort', abort);
      if (pending(this.row(id).status) && controller.signal.aborted) this.catalog.store.run("UPDATE answer_attempts SET status='failed',reason='The answer exceeded its 120-second wall limit.',completedAt=? WHERE id=?", new Date().toISOString(), id);
      this.catalog.store.run("UPDATE answer_attempts SET usageUnknownReason=CASE WHEN dispatchedAt IS NULL THEN 'No model dispatch was recorded.' ELSE 'Provider completion and usage are unknown for this attempt.' END WHERE id=? AND status IN ('failed','cancelled','interrupted','fenced') AND usage IS NULL", id);
      try { await prepared?.close(); }
      catch { this.catalog.store.run("UPDATE answer_attempts SET reason=coalesce(reason || ' ', '') || 'Runtime temporary-directory cleanup failed.' WHERE id=?", id); }
    }
  }
  async idle() { await this.worker?.done; }
  async stop() {
    this.stopping = true; this.unsubscribe();
    if (this.worker) {
      this.catalog.store.run("UPDATE answer_attempts SET status='interrupted',reason='The daemon stopped. Retry explicitly; provider completion may be unknown.' WHERE id=? AND status IN ('preparing','running')", this.worker.id);
      this.worker.controller.abort();
    }
    await this.idle();
  }
}
