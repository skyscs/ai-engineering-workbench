import type { Catalog } from './catalog.js';
import type { CorrectionSummary } from './correction-types.js';
import { Corrections } from './corrections.js';
import { CatalogError } from './types.js';

export const answerReviewLimits = { notes: 10, noteBytes: 16 * 1024 } as const;
export interface AnswerReviewNote {
  id: string; version: number; action: 'dispute' | 'clarify'; statement: string; environment: string | null;
  provenance: 'human'; verification: 'unverified';
  relationship: { kind: string; status: string; from: string; to: string; environment: string | null };
  matchingEvidenceIds: string[];
  reappliedFrom?: CorrectionSummary['reappliedFrom'];
}
export interface AnswerReviewContext {
  schemaVersion: 'answer-review-v1'; revision: number; notes: AnswerReviewNote[];
  sourceIds: string[]; matching: number; omitted: number; unmatched: number;
  noteBytes: number; limits: typeof answerReviewLimits; gaps: string[];
}

/** Match saved evidence identities, never infer that a human assertion is a source fact. */
export function answerReviewContext(catalog: Catalog, buildId: string, evidenceIds: string[]): AnswerReviewContext {
  const corrections = new Corrections(catalog), overlay = corrections.list(buildId);
  const issued = new Set(evidenceIds), notes: AnswerReviewNote[] = [], sources = new Set<string>();
  let matching = 0, unmatched = 0;
  for (const summary of overlay.corrections) {
    if (summary.action === 'withdraw') continue;
    const { original } = corrections.inspect(summary.id);
    const matchingEvidenceIds = original.evidenceIds.filter(id => issued.has(id));
    if (!matchingEvidenceIds.length) { unmatched++; continue; }
    matching++;
    const note: AnswerReviewNote = { id: summary.id, version: summary.version, action: summary.action,
      statement: summary.statement!, environment: summary.environment, provenance: 'human', verification: 'unverified',
      relationship: { kind: original.kind, status: original.status, from: original.from.label,
        to: original.to.label, environment: original.environment }, matchingEvidenceIds,
      ...(summary.reappliedFrom ? { reappliedFrom: summary.reappliedFrom } : {}) };
    if (notes.length >= answerReviewLimits.notes || Buffer.byteLength(JSON.stringify([...notes, note])) > answerReviewLimits.noteBytes) continue;
    notes.push(note);
    for (const row of catalog.store.all<{ sourceId: string }>('SELECT sourceId FROM correction_sources WHERE correctionId=? ORDER BY sourceId', note.id)) sources.add(row.sourceId);
  }
  const omitted = matching - notes.length;
  const gaps = ['Engineer notes are unverified assertions selected by overlap with retrieved source passages; this is not a complete semantic review.'];
  if (unmatched) gaps.push(`${unmatched} active corrections have no overlap with the retrieved passages and were not supplied.`);
  if (omitted) gaps.push(`${omitted} matching corrections were omitted by the note count or UTF-8 byte budget.`);
  if (!overlay.editable) gaps.push('Review for this index is unavailable after a source authorization change.');
  return { schemaVersion: 'answer-review-v1', revision: overlay.revision, notes, sourceIds: [...sources].sort(),
    matching, omitted, unmatched, noteBytes: Buffer.byteLength(JSON.stringify(notes)), limits: answerReviewLimits, gaps };
}

export function assertAnswerReviewCurrent(catalog: Catalog, review: AnswerReviewContext | undefined) {
  if (review && review.revision !== catalog.store.project().correctionRevision) {
    throw new CatalogError('INPUT_CHANGED', 'Engineer review changed. Find context again before generating an answer.', 409);
  }
}
