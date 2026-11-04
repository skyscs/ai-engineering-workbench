import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { answerReviewContext } from '../../apps/loredock/dist/answer-review.js';
import { answerInterfaces } from '../../apps/loredock/dist/answer-interfaces.js';
import { answerPrompt, answerPromptBytes } from '../../apps/loredock/dist/answer-prompt.js';
import { Corrections } from '../../apps/loredock/dist/corrections.js';
import { codeFlows } from '../../apps/loredock/dist/code-flows.js';
import { inputSpan } from './compact.mjs';
import { hash } from '../../apps/loredock/dist/native-receipt-json.js';

export const rehash = context => { const { inputHash: _, ...content } = context; return { ...content, inputHash: hash(JSON.stringify(content)) }; };
export function paddingCorpus(corpus, mode) {
  const result = structuredClone(corpus), names = Object.keys(result), ui = names[0], api = names[1], notes = names.at(-1);
  if (mode === 'derived-size') {
    result[ui]['budget/request.ts'] = Array.from({ length: 5 }, (_, i) =>
      `export function budgetReference${i}(value: string) { return fetch("/budget/reference/${i}", { method: "POST", headers: { "X-Budget-${i}": value } }); }`).join('\n') + '\n';
    result[api]['budget-routes.json'] = JSON.stringify({ environment: 'boundary-only', routes: Array.from({ length: 5 }, (_, i) =>
      ({ method: 'POST', path: `/budget/reference/${i}`, handler: `Boundary.accept${i}` })) });
  } else {
    // Quotes grow JSON size without misrepresenting original text bytes. Each file is
    // an actual authorized passage; no truncation or synthetic non-source span is used.
    for (let i = 0; i < 24; i++) result[notes][`budget/pad-${String(i).padStart(2, '0')}.md`] =
      `# Boundary passage ${i}\n` + '"'.repeat(1980) + '\n';
  }
  return result;
}
export function saveBoundaryNotes(catalog, buildId) {
  const projection = codeFlows(catalog, buildId), corrections = new Corrections(catalog), saved = [];
  for (const edge of projection.edges.slice(0, 8)) saved.push(corrections.save({ requestId: randomUUID(), buildId, targetKind: 'code-link', targetId: edge.id,
    projectionHash: projection.inputHash, expectedRevision: catalog.store.project().correctionRevision, expectedPreviousId: null,
    action: 'clarify', statement: 'Owned boundary note: ' + '"'.repeat(1900), environment: 'boundary-only' }));
  assert(saved.length > 0); return saved;
}
export function controlledPadding(catalog, baseline, mode) {
  const candidateIds = catalog.store.all(`SELECT s.id FROM spans s JOIN files f ON s.fileId=f.id
    WHERE f.buildId=? AND (f.path LIKE 'budget/%' OR f.path='budget-routes.json') ORDER BY f.path,s.startLine`, baseline.buildId).map(row => row.id);
  const originals = candidateIds.map(id => inputSpan(catalog.evidence(id)));
  const selected = baseline.spans.filter(row => !candidateIds.includes(row.id));
  const compose = spans => rehash({ ...baseline, spans, textBytes: spans.reduce((sum, row) => sum + Buffer.byteLength(row.text), 0),
    review: answerReviewContext(catalog, baseline.buildId, spans.map(row => row.id)), interfaces: answerInterfaces(catalog, baseline.buildId, spans.map(row => row.id)) });
  let context = compose(selected); const decisions = [];
  assert(Buffer.byteLength(answerPrompt(context)) <= answerPromptBytes);
  for (const span of originals) {
    const proposed = compose([...context.spans, span]), promptBytes = Buffer.byteLength(answerPrompt(proposed));
    const fits = proposed.spans.length <= 30 && proposed.textBytes <= 64 * 1024 && promptBytes <= answerPromptBytes;
    decisions.push({ id: span.id, fits, promptBytes, textBytes: proposed.textBytes, spans: proposed.spans.length });
    if (fits) context = proposed;
  }
  assert(context.review.notes.length > 0);
  return { context, mode, algorithm: 'Sorted actual padding originals; retain each whole span iff 30 originals, 64 KiB text and 96 KiB actual v9 prompt still fit. Recompute actual legacy comparisons and saved-note overlap for each prefix; never trim notes or comparisons to make it fit.',
    decisions, promptBytes: Buffer.byteLength(answerPrompt(context)), derivedBytes: context.interfaces.comparisonBytes };
}
