import type { AnswerContext } from './answer-context.js';
import type { HeaderCheck } from './http-headers.js';
import { legacyQuestionCompactVersion, questionCompactVersion, legacyQuestionPromptVersion, questionPromptVersion,
  type QuestionPromptVersion, type QuestionCompactVersion, type NativeQuestionItem, type NativeQuestionItemV1,
  type NativeQuestionItemV2, type CompactEdge, type LegacyHeaderReference } from './question-preparation-types.js';

type Charge = (units: number) => void;
const noCharge: Charge = () => undefined;
function requireFormat(value: unknown): asserts value {
  if (!value) throw Object.assign(new Error('Native question references or version are invalid.'), { code: 'QUESTION_NATIVE_FORMAT' });
}
export const supportedQuestionPrompt = (value: unknown): value is QuestionPromptVersion =>
  value === legacyQuestionPromptVersion || value === questionPromptVersion;
export function compactVersionForPrompt(value: unknown): QuestionCompactVersion {
  requireFormat(supportedQuestionPrompt(value));
  return value === legacyQuestionPromptVersion ? legacyQuestionCompactVersion : questionCompactVersion;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const position = (value: number, length: number) => Number.isSafeInteger(value) && value >= 0 && value < length;
const reference = (value: HeaderCheck | LegacyHeaderReference | null): value is LegacyHeaderReference =>
  value !== null && typeof value === 'object' && Object.hasOwn(value, 'legacyHeader');

function scope(item: NativeQuestionItem, context: AnswerContext, charge: Charge) {
  const comparisons = context.interfaces?.comparisons ?? [], spans = new Map(context.spans.map(span => [span.id, span]));
  charge(context.spans.length + item.originals.length + comparisons.length);
  requireFormat(new Set(item.originals).size === item.originals.length && item.originals.every(id => spans.has(id)));
  requireFormat(new Set(comparisons.map(row => row.id)).size === comparisons.length);
  const ids = (indexes: number[]) => indexes.map(index => {
    charge(1); requireFormat(position(index, item.originals.length)); return item.originals[index]!;
  });
  const endpoint = (index: number) => {
    charge(1); requireFormat(position(index, item.nodes.length));
    const node = item.nodes[index]!, originals = ids(node[5]).map(id => spans.get(id)!);
    const first = originals[0]; requireFormat(first);
    for (const span of originals) {
      charge(1); requireFormat(span.sourceId === first.sourceId && span.sourceName === first.sourceName
        && span.path === first.path && span.revision === first.revision);
    }
    return { sourceId: first.sourceId, sourceName: first.sourceName, path: first.path, label: node[1] };
  };
  const check = (legacy: number, edgeIndex: number) => {
    charge(1); requireFormat(position(legacy, comparisons.length) && position(edgeIndex, item.edges.length));
    const comparison = comparisons[legacy]!, edge = item.edges[edgeIndex]!;
    requireFormat(edge[0] === 'http-target' && comparison.kind === 'http-target' && edge[3] === comparison.status
      && same(endpoint(edge[1]), comparison.from) && same(endpoint(edge[2]), comparison.to)
      && same(ids(edge[7]).sort(), [...comparison.evidenceIds].sort()));
    return comparison;
  };
  return { comparisons, check };
}

/** Pure wire conversion. Server callers charge its bounded reference operations. */
export function factorNativeQuestion(item: NativeQuestionItemV1, context: AnswerContext, charge: Charge): NativeQuestionItemV2 {
  requireFormat(item.schemaVersion === legacyQuestionCompactVersion && item.lexicalInputHash === context.inputHash);
  const { comparisons, check } = scope(item, context, charge), pairs = new Set<string>();
  const duplicateClues: NativeQuestionItemV2['duplicateClues'] = item.duplicateClues.map(clue => {
    charge(comparisons.length);
    const index = comparisons.findIndex(row => row.id === clue.legacyId), comparison = check(index, clue.nativeEdge);
    requireFormat(same(item.edges[clue.nativeEdge]![8], comparison.headerCheck));
    const key = index + ':' + clue.nativeEdge; requireFormat(!pairs.has(key)); pairs.add(key);
    return [index, clue.nativeEdge];
  });
  const edges: NativeQuestionItemV2['edges'] = item.edges.map((edge, edgeIndex) => {
    charge(1 + duplicateClues.length);
    const matches = duplicateClues.filter(pair => pair[1] === edgeIndex);
    const copy: CompactEdge<HeaderCheck | LegacyHeaderReference> = [...edge];
    if (matches.length === 1) copy[8] = { legacyHeader: matches[0]![0] };
    return copy;
  });
  const { lexicalInputHash: _, ...content } = item;
  return { ...content, schemaVersion: questionCompactVersion, edges, duplicateClues };
}

/** Resolve display/semantic references only against their matching enclosing input. */
export function expandNativeQuestion(item: NativeQuestionItem, context: AnswerContext, charge: Charge = noCharge): NativeQuestionItemV1 {
  if (item.schemaVersion === legacyQuestionCompactVersion) return item;
  requireFormat(item.schemaVersion === questionCompactVersion && !Object.hasOwn(item, 'lexicalInputHash'));
  const { comparisons, check } = scope(item, context, charge), pairs = new Set<string>();
  const duplicateClues = item.duplicateClues.map(pair => {
    charge(1); requireFormat(Array.isArray(pair) && pair.length === 2);
    const comparison = check(pair[0], pair[1]), key = pair[0] + ':' + pair[1];
    requireFormat(!pairs.has(key)); pairs.add(key);
    return { legacyId: comparison.id, nativeEdge: pair[1] };
  });
  const edges: CompactEdge[] = item.edges.map((edge, edgeIndex) => {
    charge(1 + item.duplicateClues.length);
    const header = edge[8], matches = item.duplicateClues.filter(pair => pair[1] === edgeIndex);
    let resolved: HeaderCheck | null;
    if (reference(header)) {
      requireFormat(Object.keys(header).length === 1 && matches.length === 1 && matches[0]![0] === header.legacyHeader);
      resolved = check(header.legacyHeader, edgeIndex).headerCheck;
    } else resolved = header;
    for (const pair of matches) { charge(1); requireFormat(same(resolved, comparisons[pair[0]]!.headerCheck)); }
    const copy: CompactEdge = [...edge.slice(0, 8), resolved, edge[9]] as CompactEdge;
    return copy;
  });
  // Keep the old lexical-binding field position for exact semantic serialization.
  const { schemaVersion: _, receiptHash, projectionId, selectionVersion, flowId, originals,
    provenance, verification, currentApplicability, ...rest } = item;
  return { schemaVersion: legacyQuestionCompactVersion, provenance, verification, currentApplicability,
    receiptHash, projectionId, lexicalInputHash: context.inputHash, selectionVersion, flowId, originals,
    ...rest, edges, duplicateClues };
}
