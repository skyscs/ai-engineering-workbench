import { literalTopic } from './literal-topic.js';
import { CatalogError } from './types.js';
import type { FlowNode } from './code-flow-types.js';
import type { PathWork } from './code-paths-work.js';

type SelectionNode = Readonly<Pick<FlowNode, 'id' | 'kind' | 'label'>> & {
  readonly properties: Readonly<Record<string, string>>; readonly evidenceIds: readonly string[];
};
export interface QuestionResolution {
  readonly nodes: readonly SelectionNode[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly roots: readonly { readonly id: string }[];
}
export interface QuestionSelectionContext { readonly question: string; readonly spans: readonly { readonly id: string }[] }
export interface SelectionObservation {
  version: typeof selectionVersion; anchors: number; traversals: number; complete: boolean;
  roots?: number; eligibleRoots?: number;
}
export type QuestionPathSelector = (resolution: QuestionResolution, work: Pick<PathWork, 'step'>) => Promise<{ rootId: string }>;


export const selectionVersion = 'exact-anchor-reachability/1';
export class SelectionUnavailable extends CatalogError {
  constructor(code: string, message: string, readonly observation: SelectionObservation) { super(code, message, 409); }
}
// Dots, slashes and hyphens belong to qualified identifiers, routes and topics.
// Punctuation at the end of a sentence is accepted only when followed by a delimiter.
const identifierCharacter = (value: string | undefined) => value !== undefined && /[\p{L}\p{N}_$./-]/u.test(value);
function wholeLiteral(question: string, value: string) {
  if (!value) return false;
  let offset = -1;
  while ((offset = question.indexOf(value, offset + 1)) !== -1) {
    const end = offset + value.length, suffix = question[end];
    const sentenceEnd = suffix === '.' && !identifierCharacter(question[end + 1]);
    if (!identifierCharacter(question[offset - 1]) && (!identifierCharacter(suffix) || sentenceEnd)) return true;
  }
  return false;
}
function anchored(node: SelectionNode, question: string) {
  if (node.kind === 'symbol' && /^[\p{L}_$][\p{L}\p{N}_$.]*$/u.test(node.label)) return wholeLiteral(question, node.label);
  if (node.kind === 'http-request' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S+$/.test(node.label)) return wholeLiteral(question, node.label);
  if (node.kind === 'event-publish' || node.kind === 'event-subscribe') {
    const topic = literalTopic(node.properties.topicExpression); return topic !== null && topic !== undefined && wholeLiteral(question, topic);
  }
  return false;
}

// Trusted complete resolution only. No oracle, fixture names, history enumeration or model.
export async function chooseQuestionRoot(resolution: QuestionResolution, context: QuestionSelectionContext, work: Pick<PathWork, 'step'>) {
  const issued = new Set(context.spans.map(row => row.id)), anchors: string[] = [], reverse = new Map<string, string[]>();
  for (const node of resolution.nodes) {
    await work.step('admit');
    if (node.evidenceIds.length && node.evidenceIds.every(id => issued.has(id)) && anchored(node, context.question)) anchors.push(node.id);
  }
  for (const edge of resolution.edges) {
    await work.step('admit'); const incoming = reverse.get(edge.to) ?? []; incoming.push(edge.from); reverse.set(edge.to, incoming);
  }
  const visited = new Set(anchors), pending = anchors.slice(); let cursor = 0;
  while (cursor < pending.length) {
    if (cursor >= 1000) throw new SelectionUnavailable('QUESTION_SELECTION_LIMIT', 'Question selection exceeds its traversal limit.',
      { version: selectionVersion, anchors: anchors.length, traversals: cursor, complete: false });
    const node = pending[cursor++]!; await work.step('admit');
    for (const from of reverse.get(node) ?? []) {
      await work.step('admit'); if (!visited.has(from)) { visited.add(from); pending.push(from); }
    }
  }
  const eligible = [];
  for (const root of resolution.roots) { await work.step('admit'); if (visited.has(root.id)) eligible.push(root.id); }
  const observation: SelectionObservation = { version: selectionVersion, anchors: anchors.length, roots: resolution.roots.length,
    eligibleRoots: eligible.length, traversals: cursor, complete: true };
  if (!eligible.length) throw new SelectionUnavailable('QUESTION_INSUFFICIENT_CONTEXT', 'No supported source anchor selects a path.', observation);
  if (eligible.length !== 1) throw new SelectionUnavailable('QUESTION_AMBIGUOUS', 'More than one source entry point reaches the supplied anchors.', observation);
  return { rootId: eligible[0]!, observation };
}
