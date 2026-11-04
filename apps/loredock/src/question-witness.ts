import type { Catalog } from './catalog.js';
import type { AnswerContext } from './answer-context.js';
import { answerLimits, retrievalVersion } from './answer-context.js';
import { answerPromptBytes } from './answer-prompt.js';
import { assertAnswerReviewCurrent } from './answer-review.js';
import { assertAnswerInterfaces } from './answer-interfaces.js';
import { OperationBudget } from './operation-budget.js';
import { LexicalReadAccount } from './lexical-read-account.js';
import { CaptureWork } from './native-capture-work.js';
import { decodeNativeReceipt } from './native-receipt.js';
import { bytes, hash, same, requireReceipt } from './native-receipt-json.js';
import { compactQuestionPath, inputSpan, preparedQuestionPrompt } from './question-context.js';
import { questionPreparationLimits, questionPreparationVersion, questionPromptVersion, questionWitnessVersion,
  type QuestionSnapshot, type QuestionWitness } from './question-preparation-types.js';

export function questionSourceIds(context: AnswerContext, witness: Pick<QuestionWitness, 'dependencies'>) {
  return [...new Set([...witness.dependencies.map(row => row.sourceId), ...(context.review?.sourceIds ?? [])])].sort();
}
export function assertQuestionCurrent(catalog: Catalog, context: AnswerContext, sourceIds: string[]) {
  const project = catalog.store.project(), build = catalog.readBuildHeader(context.buildId);
  requireReceipt(project.publishedBuildId === context.buildId && build.published
    && project.policyVersion === context.policyVersion && project.sourceSetVersion === context.registryVersion
    && build.sourceSetVersion === context.sourceSetVersion && context.sourceSetVersion === context.registryVersion && !context.stale, 'QUESTION_STALE');
  requireReceipt(sourceIds.length <= 20 && sourceIds.every(id => catalog.store.source(id).status === 'active'), 'QUESTION_SCOPE_FENCED');
  assertAnswerReviewCurrent(catalog, context.review);
}
export function authorizeQuestionScope(work: CaptureWork, context: AnswerContext, witness: Pick<QuestionWitness, 'dependencies'>) {
  const current = work.dependencies(context.buildId);
  requireReceipt(current.build.policyVersion === context.policyVersion && current.build.sourceSetVersion === context.sourceSetVersion
    && same(current.dependencies, witness.dependencies), 'QUESTION_SCOPE_FENCED');
}
export const retainedQuestionBytes = (contextJson: string, witnessJson: string, reviewedHash: string) =>
  bytes(JSON.stringify({ contextJson, witnessJson, reviewedHash })) + questionPreparationLimits.metadataBytes;

export function questionSnapshot(context: AnswerContext, witness: QuestionWitness, budget: OperationBudget): QuestionSnapshot {
  const contextJson = JSON.stringify(context), witnessJson = JSON.stringify(witness);
  budget.charge('receipt', bytes(contextJson) + bytes(witnessJson));
  requireReceipt(bytes(witnessJson) <= questionPreparationLimits.witnessBytes, 'QUESTION_WITNESS_LIMIT');
  const reviewedHash = hash(JSON.stringify([questionPreparationVersion, contextJson, witnessJson]));
  // Reserve scalar slot/tombstone metadata in addition to all retained content.
  const retainedBytes = retainedQuestionBytes(contextJson, witnessJson, reviewedHash);
  requireReceipt(retainedBytes <= questionPreparationLimits.retainedBytes, 'QUESTION_PREVIEW_LIMIT');
  return Object.freeze({ contextJson, witnessJson, retainedBytes, reviewedHash });
}
export function readQuestionSnapshot(snapshot: QuestionSnapshot) {
  const retainedBytes = retainedQuestionBytes(snapshot.contextJson, snapshot.witnessJson, snapshot.reviewedHash);
  requireReceipt(bytes(snapshot.witnessJson) <= questionPreparationLimits.witnessBytes && retainedBytes === snapshot.retainedBytes
    && retainedBytes <= questionPreparationLimits.retainedBytes, 'QUESTION_PREVIEW_LIMIT');
  requireReceipt(hash(JSON.stringify([questionPreparationVersion, snapshot.contextJson, snapshot.witnessJson])) === snapshot.reviewedHash, 'QUESTION_SNAPSHOT_HASH');
  const context = JSON.parse(snapshot.contextJson) as AnswerContext, witness = JSON.parse(snapshot.witnessJson) as QuestionWitness;
  requireReceipt(witness.schemaVersion === questionWitnessVersion && witness.compositionVersion === questionPreparationVersion
    && witness.promptVersion === questionPromptVersion && witness.lexicalInputHash === context.inputHash, 'QUESTION_WITNESS_VERSION');
  const { inputHash, ...content } = context;
  requireReceipt(context.retrievalVersion === retrievalVersion && hash(JSON.stringify(content)) === inputHash, 'QUESTION_CONTEXT_HASH');
  requireReceipt(context.spans.length <= answerLimits.spans && context.textBytes === context.spans.reduce((sum, row) => sum + bytes(row.text), 0)
    && context.textBytes <= answerLimits.textBytes && bytes(witness.prompt) <= answerPromptBytes && hash(witness.prompt) === witness.promptHash, 'QUESTION_WITNESS_CONTENT');
  requireReceipt(same(witness.sourceIds, questionSourceIds(context, witness)), 'QUESTION_SCOPE_FENCED');
  return { context, witness };
}

/** Trusted server-held bytes only. No current native analysis, path or inventory lookup. */
export async function validateQuestionWitness(catalog: Catalog, snapshot: QuestionSnapshot, signal = new AbortController().signal) {
  const budget = new OperationBudget({ signal });
  try {
    const work = new CaptureWork(catalog, budget, signal, {}), { context, witness } = readQuestionSnapshot(snapshot);
    budget.charge('receipt', bytes(snapshot.contextJson) + bytes(snapshot.witnessJson));
    requireReceipt(witness.catalogId === catalog.store.receipts.catalogId, 'RECEIPT_CATALOG_MISMATCH');
    assertQuestionCurrent(catalog, context, witness.sourceIds);
    authorizeQuestionScope(work, context, witness);
    if (witness.receipt !== null) {
      const encoded = decodeNativeReceipt(Buffer.from(witness.receipt), witness.catalogId, budget);
      work.authorized(encoded.projection, encoded.receipt.dependencies);
      requireReceipt(encoded.projection.identity.buildId === context.buildId && same(encoded.receipt.dependencies, witness.dependencies), 'QUESTION_RECEIPT_BINDING');
      for (const original of encoded.receipt.originals) { await work.step('originals'); requireReceipt(same(work.original(original.id), original)); }
      requireReceipt(same(compactQuestionPath(context, encoded, budget), witness.compact), 'QUESTION_COMPACT_MISMATCH');
    } else requireReceipt(witness.compact.item === null && typeof witness.compact.reason === 'string', 'QUESTION_MISSING_RECEIPT');
    for (const span of context.spans) {
      await work.step('originals'); const original = work.original(span.id);
      requireReceipt(original.buildId === context.buildId && same(inputSpan(original), span), 'QUESTION_ORIGINAL_MISMATCH');
    }
    // Legacy interfaces keep their own validator and actual lexical accounting.
    const lexical = new LexicalReadAccount(budget);
    catalog.store.withLexicalReads(lexical, () => assertAnswerInterfaces(catalog, context));
    const prompt = preparedQuestionPrompt(context, witness.compact.item); budget.charge('receipt', bytes(prompt));
    requireReceipt(prompt === witness.prompt, 'QUESTION_PROMPT_MISMATCH');
    await work.step('handoff'); assertQuestionCurrent(catalog, context, witness.sourceIds);
    authorizeQuestionScope(work, context, witness);
    work.check(); return { status: 'revalidated' as const, reviewedHash: snapshot.reviewedHash, budget: budget.stats(), lexical: lexical.stats() };
  } finally { budget.close(); }
}
