import { RuntimeError, type PreparedTextRuntime, type TextConnection, type TextOutput, type TextRuntime } from '@aew/ai';
import type { Catalog } from './catalog.js';
import { CatalogError } from './types.js';
import { AnswerWitnessStore } from './answer-witness-store.js';
import { preparedAnswerInputKind } from './answer-witness-schema.js';
import { validateQuestionWitness, type QuestionValidationOptions } from './question-witness.js';
import { OperationBudget } from './operation-budget.js';
import { LexicalReadAccount } from './lexical-read-account.js';
import { citedAnswerSchema, validateCitedAnswer } from './answer-context.js';

interface ExecutionRow { status: string; inputKind: string; connection: string; model: string; effort: 'medium' }
const pending = (status: string | undefined) => status === 'preparing' || status === 'running';

/** Owned by Answers before invocation. No retry, current native inventory or public entry. */
export async function runPreparedAnswer(catalog: Catalog, runtime: TextRuntime, id: string, parentSignal: AbortSignal) {
  const store = catalog.store, witnesses = new AnswerWitnessStore(catalog);
  const row = () => store.one<ExecutionRow>('SELECT status,inputKind,connection,model,effort FROM answer_attempts WHERE id=?', id);
  const controller = new AbortController(), abort = () => controller.abort();
  parentSignal.addEventListener('abort', abort, { once: true }); if (parentSignal.aborted) abort();
  const timer = setTimeout(abort, 120000);
  let prepared: PreparedTextRuntime | undefined;
  const started: { prepare?: Promise<PreparedTextRuntime>; output?: Promise<TextOutput> } = {};
  const phase = async (expected: string, finalize: NonNullable<QuestionValidationOptions['finalize']>) => {
    if (row()?.status !== expected || controller.signal.aborted) return;
    const budget = new OperationBudget({ signal: controller.signal });
    try {
      const snapshot = witnesses.read(id, budget);
      await validateQuestionWitness(catalog, snapshot, controller.signal, { budget, finalize: boundary => {
        if (row()?.status !== expected || controller.signal.aborted) return;
        boundary.check(); return finalize(boundary);
      } });
    } finally { budget.close(); }
  };
  try {
    const input = row();
    if (!input || !pending(input.status) || controller.signal.aborted) return;
    if (input.inputKind !== preparedAnswerInputKind) throw new CatalogError('ANSWER_INPUT_UNSUPPORTED', 'This worker requires prepared input.', 409);
    await phase('preparing', () => {
      started.prepare = runtime.prepare(JSON.parse(input.connection) as TextConnection, controller.signal);
      // Observe immediate rejection while validation completes its synchronous handoff.
      void started.prepare.catch(() => undefined);
    });
    if (!started.prepare) return;
    prepared = await started.prepare; const owned = prepared;
    await phase('preparing', ({ context, witness }) => {
      store.run("UPDATE answer_attempts SET status='running',runtime=?,dispatchedAt=?,usageUnknownReason='Provider usage is not yet known.' WHERE id=? AND status='preparing'",
        JSON.stringify(owned.identity), new Date().toISOString(), id);
      started.output = owned.run({ prompt: witness.prompt, schema: citedAnswerSchema(context), model: input.model,
        effort: input.effort, signal: controller.signal });
      void started.output.catch(() => undefined);
    });
    if (!started.output) return;
    const output = await started.output;
    // A late cancellation/invalid result still retains the provider's actual usage.
    // This write must precede the publication validator's read-only authority epoch.
    store.run('UPDATE answer_attempts SET usage=?,usageUnknownReason=? WHERE id=?',
      output.usage ? JSON.stringify(output.usage) : null, output.usageUnknownReason, id);
    await phase('running', ({ context, budget, check }) => {
      store.transaction(() => {
        if (row()?.status !== 'running' || controller.signal.aborted) return;
        const lexical = new LexicalReadAccount(budget);
        const answer = store.withLexicalReads(lexical, () => validateCitedAnswer(catalog, context, output.text));
        check();
        store.run("UPDATE answer_attempts SET status='succeeded',result=?,completedAt=?,reason=NULL WHERE id=? AND status='running'",
          JSON.stringify(answer), new Date().toISOString(), id);
      });
    });
  } catch (error) {
    if (pending(row()?.status)) {
      const reason = error instanceof RuntimeError ? `${error.failure.code}: ${error.message}${error.failure.stderr ? `\n${error.failure.stderr}` : ''}`
        : error instanceof Error ? error.message : 'Prepared answer execution failed.';
      store.run("UPDATE answer_attempts SET status='failed',reason=?,completedAt=? WHERE id=?", controller.signal.aborted && !parentSignal.aborted
        ? 'The answer exceeded its 120-second wall limit.' : reason.slice(0, 4096), new Date().toISOString(), id);
    }
  } finally {
    clearTimeout(timer); parentSignal.removeEventListener('abort', abort);
    if (pending(row()?.status) && controller.signal.aborted) store.run("UPDATE answer_attempts SET status='failed',reason='The answer exceeded its 120-second wall limit.',completedAt=? WHERE id=?", new Date().toISOString(), id);
    store.run("UPDATE answer_attempts SET usageUnknownReason=CASE WHEN dispatchedAt IS NULL THEN 'No model dispatch was recorded.' ELSE 'Provider completion and usage are unknown for this attempt.' END WHERE id=? AND status IN ('failed','cancelled','interrupted','fenced') AND usage IS NULL", id);
    try { await prepared?.close(); }
    catch { store.run("UPDATE answer_attempts SET reason=coalesce(reason || ' ', '') || 'Runtime temporary-directory cleanup failed.' WHERE id=?", id); }
  }
}
