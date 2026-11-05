import type { Catalog } from './catalog.js';
import type { AnswerAttempt } from './answers.js';
import { answerSchemaVersion, retrievalVersion, type AnswerContext } from './answer-context.js';
import { answerWitnessLimits, answerWitnessVersion, preparedAnswerInputKind } from './answer-witness-schema.js';
import { preparedAnswerRequestHash } from './answer-witness-store.js';
import { questionPreparationVersion } from './question-preparation-types.js';
import { supportedQuestionPrompt } from './question-native-format.js';
import { OperationBudget } from './operation-budget.js';
import { CaptureWork } from './native-capture-work.js';
import { bytes, hash, hex, uuid, same } from './native-receipt-json.js';
import { CatalogError } from './types.js';

interface SummaryRow {
  id: string; inputKind: string; question: string; buildId: string; status: AnswerAttempt['status'];
  policyVersion: number; registryVersion: number; inputHash: string; payloadHash: string; contextBytes: number;
  runtime: string | null; model: string; effort: 'medium'; usage: string | null; usageUnknownReason: string | null;
  reason: string | null; promptVersion: string; schemaVersion: string; createdAt: string; dispatchedAt: string | null;
}
interface WitnessMetadata {
  preparationId: string; schemaVersion: string; compositionVersion: string; promptVersion: string;
  contextHash: string; reviewedHash: string; witnessBytes: number; purged: number; present: number;
}
function invalid(): never { throw new CatalogError('ANSWER_WITNESS_INVALID', 'Saved prepared summary metadata is invalid or unsupported.', 409); }

function summary(catalog: Catalog, id: string, work: CaptureWork): AnswerAttempt {
  const store = catalog.store, project = store.project();
  // Do not select result, connection or witness payloads for a history page.
  const row = store.one<SummaryRow>(`SELECT id,inputKind,question,buildId,status,policyVersion,registryVersion,
    inputHash,payloadHash,coalesce(octet_length(context),0) contextBytes,runtime,model,effort,usage,
    usageUnknownReason,reason,promptVersion,schemaVersion,createdAt,dispatchedAt FROM answer_attempts WHERE id=?`, id)!;
  work.charge(bytes(JSON.stringify(row)));
  if (row.inputKind !== 'legacy' && row.inputKind !== preparedAnswerInputKind)
    throw new CatalogError('ANSWER_INPUT_UNSUPPORTED', 'This answer uses an unsupported input kind.', 409);
  const native = row.inputKind === preparedAnswerInputKind;
  const sources = store.all<{ sourceId: string; status: string | null }>(`SELECT d.sourceId,s.status FROM answer_sources d
    LEFT JOIN sources s ON s.id=d.sourceId WHERE d.answerId=? ORDER BY d.sourceId LIMIT 21`, id);
  work.charge(bytes(JSON.stringify(sources)));
  if (sources.length > 20) invalid();
  const authorized = row.policyVersion === project.policyVersion && sources.every(source => source.status === 'active');
  let context: AnswerContext | null = null;
  if (authorized) {
    // octet_length uses SQLite's stored byte length; charge before selecting the text.
    work.charge(row.contextBytes);
    const raw = store.one<{ context: string | null }>('SELECT context FROM answer_attempts WHERE id=?', id)!.context;
    if (native) {
      const saved = store.one<WitnessMetadata>(`SELECT preparationId,schemaVersion,compositionVersion,promptVersion,
        contextHash,reviewedHash,witnessBytes,purged,witness IS NOT NULL present FROM answer_witnesses WHERE answerId=?`, id);
      if (!saved) throw new CatalogError('ANSWER_WITNESS_MISSING', 'This prepared answer is missing its required witness.', 409);
      work.charge(bytes(JSON.stringify(saved)));
      if (saved.purged || !saved.present || raw === null)
        throw new CatalogError('ANSWER_INPUT_FENCED', 'Saved input was purged.', 409);
      if (saved.schemaVersion !== answerWitnessVersion || saved.compositionVersion !== questionPreparationVersion
        || !supportedQuestionPrompt(saved.promptVersion) || row.promptVersion !== saved.promptVersion
        || row.schemaVersion !== answerSchemaVersion || !uuid(saved.preparationId) || !hex(saved.reviewedHash)
        || !Number.isSafeInteger(saved.witnessBytes) || saved.witnessBytes < 1 || saved.witnessBytes > answerWitnessLimits.bytes
        || saved.contextHash !== hash(raw) || row.payloadHash !== preparedAnswerRequestHash(saved.preparationId, saved.reviewedHash)) invalid();
      try {
        context = JSON.parse(raw) as AnswerContext;
        const { inputHash, ...content } = context;
        if (context.retrievalVersion !== retrievalVersion || inputHash !== row.inputHash || hash(JSON.stringify(content)) !== inputHash
          || context.question !== row.question || context.buildId !== row.buildId || context.policyVersion !== row.policyVersion
          || context.registryVersion !== row.registryVersion || (context.review && (context.review.schemaVersion !== 'answer-review-v1'
            || !Number.isSafeInteger(context.review.revision) || context.review.revision < 0
            || !Array.isArray(context.review.sourceIds) || context.review.sourceIds.some(source => !uuid(source))))) invalid();
      } catch { invalid(); }
      const current = work.dependencies(row.buildId);
      const expected = [...new Set([...current.dependencies.map(source => source.sourceId), ...(context.review?.sourceIds ?? [])])].sort();
      if (current.build.policyVersion !== context.policyVersion || current.build.sourceSetVersion !== context.sourceSetVersion
        || !same(expected, sources.map(source => source.sourceId))) invalid();
    } else context = raw ? JSON.parse(raw) as AnswerContext : null;
  }
  work.check();
  return { ...native ? { inputKind: preparedAnswerInputKind, nativeContext: null, inputValidation: 'metadata-only' as const } : {},
    id: row.id, question: row.question, buildId: row.buildId, status: authorized ? row.status : 'fenced',
    stale: row.registryVersion !== project.sourceSetVersion || row.buildId !== project.publishedBuildId,
    reviewState: !authorized ? 'unavailable' : !context?.review ? 'not-recorded'
      : context.review.revision === project.correctionRevision ? 'current' : 'changed',
    context: null, answer: null, runtime: row.runtime ? JSON.parse(row.runtime) as AnswerAttempt['runtime'] : null,
    model: row.model, effort: row.effort, usage: row.usage ? JSON.parse(row.usage) as AnswerAttempt['usage'] : null,
    promptVersion: row.promptVersion, schemaVersion: row.schemaVersion, usageUnknownReason: row.usageUnknownReason,
    reason: authorized ? row.reason : 'Source authorization changed. Create a new index and answer.',
    createdAt: row.createdAt, dispatchedAt: row.dispatchedAt };
}

/** One request owns all twenty rows; full content validation remains on Answers.get. */
export function answerSummaries(catalog: Catalog): AnswerAttempt[] {
  const budget = new OperationBudget();
  try {
    const work = new CaptureWork(catalog, budget, new AbortController().signal, {});
    const ids = catalog.store.all<{ id: string }>('SELECT id FROM answer_attempts ORDER BY rowid DESC LIMIT 20');
    work.charge(bytes(JSON.stringify(ids)));
    const attempts = ids.map(row => summary(catalog, row.id, work));
    work.check(); return attempts;
  } finally { budget.close(); }
}
