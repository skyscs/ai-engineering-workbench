import { literalTopic } from '../../apps/loredock/dist/literal-topic.js';

export const selectionVersion = 'exact-anchor-reachability/1';
export class SelectionUnavailable extends Error {
  constructor(code, message, observation) { super(message); this.code = code; this.observation = observation; }
}
const identifierCharacter = value => value !== undefined && /[\p{L}\p{N}_$]/u.test(value);
function wholeLiteral(question, value) {
  if (!value) return false;
  let offset = -1;
  while ((offset = question.indexOf(value, offset + 1)) !== -1) {
    if (!identifierCharacter(question[offset - 1]) && !identifierCharacter(question[offset + value.length])) return true;
  }
  return false;
}
function anchored(node, question) {
  if (node.kind === 'symbol' && /^[\p{L}_$][\p{L}\p{N}_$.]*$/u.test(node.label)) return wholeLiteral(question, node.label);
  if (node.kind === 'http-request' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S+$/.test(node.label)) return wholeLiteral(question, node.label);
  if (node.kind === 'event-publish' || node.kind === 'event-subscribe') {
    const topic = literalTopic(node.properties.topicExpression); return topic !== null && topic !== undefined && wholeLiteral(question, topic);
  }
  return false;
}

// Trusted complete resolution only. No oracle, fixture names, history enumeration or model.
export async function chooseQuestionRoot(resolution, context, work) {
  const issued = new Set(context.spans.map(row => row.id)), anchors = [], reverse = new Map();
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
    const node = pending[cursor++]; await work.step('admit');
    for (const from of reverse.get(node) ?? []) {
      await work.step('admit'); if (!visited.has(from)) { visited.add(from); pending.push(from); }
    }
  }
  const eligible = [];
  for (const root of resolution.roots) { await work.step('admit'); if (visited.has(root.id)) eligible.push(root.id); }
  const observation = { version: selectionVersion, anchors: anchors.length, roots: resolution.roots.length,
    eligibleRoots: eligible.length, traversals: cursor, complete: true };
  if (!eligible.length) throw new SelectionUnavailable('QUESTION_INSUFFICIENT_CONTEXT', 'No supported source anchor selects a path.', observation);
  if (eligible.length !== 1) throw new SelectionUnavailable('QUESTION_AMBIGUOUS', 'More than one source entry point reaches the supplied anchors.', observation);
  return { rootId: eligible[0], observation };
}
