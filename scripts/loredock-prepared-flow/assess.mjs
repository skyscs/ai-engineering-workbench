// Source-grounded assessment; never import a candidate parser, resolver or answer validator.
import assert from 'node:assert/strict';
import { hash } from './io.mjs';

export function assessPreview(review, { corpus, sources, expected, references = {}, engineerNote }) {
  assert.equal(review.status, 'ready');
  const context = review.context, { inputHash, ...body } = context;
  assert.equal(hash(JSON.stringify(body)), inputHash);
  assert.equal(context.deploymentCoherence, 'unknown');
  assert(context.spans.length <= 30 && context.textBytes <= 65536);
  const names = Object.keys(corpus).sort();
  assert.deepEqual(context.sources.map(source => source.name).sort(), names);
  for (const source of context.sources) {
    assert.equal(source.status, 'ready'); assert.equal(source.revision, sources.revisions[source.name].revision);
    assert.equal(source.tree, sources.revisions[source.name].tree);
  }
  const byId = new Map(); let textBytes = 0;
  for (const span of context.spans) {
    assert(!byId.has(span.id)); byId.set(span.id, span);
    const original = corpus[span.sourceName]?.[span.path]; assert.equal(typeof original, 'string');
    assert.equal(span.revision, sources.revisions[span.sourceName].revision);
    assert.equal(span.sourceId, context.sources.find(source => source.name === span.sourceName).sourceId);
    assert.equal(span.contentHash, hash(original.replaceAll('\r\n', '\n')));
    const lines = original.replaceAll('\r\n', '\n').split('\n'); if (lines.at(-1) === '') lines.pop();
    assert(span.startLine >= 1 && span.endLine >= span.startLine && span.endLine <= lines.length);
    assert.equal(span.text, lines.slice(span.startLine - 1, span.endLine).join('\n'));
    assert.equal(span.spanHash, hash(span.text)); textBytes += Buffer.byteLength(span.text);
  }
  assert.equal(context.textBytes, textBytes);
  const required = [];
  for (const id of expected.requiredOriginals ?? []) {
    const reference = references[id]; assert(reference);
    const matches = context.spans.filter(span => span.sourceName === reference.source && span.path === reference.path && span.text.includes(reference.quote));
    assert(matches.length, 'Missing required original: ' + id);
    required.push({ id, evidenceIds: matches.map(span => span.id) });
  }
  const compact = review.compact, item = compact.item;
  if (['native-required', 'partial-native-required'].includes(expected.prepared)) assert(item, 'Required useful native path was omitted: ' + compact.reason);
  if (expected.prepared === 'ambiguous-omission-required') {
    assert.equal(item, null); assert.equal(compact.reason, 'QUESTION_AMBIGUOUS');
    assert(review.selection.eligibleRoots >= expected.native.minimumEligibleRoots);
  }
  if (expected.prepared === 'unavailable-omission-required') { assert.equal(item, null); assert(/UNAVAILABLE/.test(compact.reason)); }
  if (expected.prepared === 'source-context-required-native-absent') assert.equal(item, null);
  if (item) {
    assert.equal(item.provenance, 'static-analysis'); assert.equal(item.verification, 'unverified');
    assert.equal(item.deploymentCoherence, 'unknown'); assert.equal(item.currentApplicability, 'not-checked'); assert.equal(item.partial, true);
    assert.equal(item.lexicalInputHash, context.inputHash);
    for (const id of item.originals) assert(byId.has(id), 'Native identity is not an issued original.');
    const nativeNames = [...new Set(item.originals.map(id => byId.get(id).sourceName))].sort();
    if (expected.native?.sources) assert.deepEqual(nativeNames, [...expected.native.sources].sort());
    for (const source of expected.native?.forbiddenSources ?? []) assert(!nativeNames.includes(source));
    const kinds = item.edges.map(edge => edge[0]);
    for (const kind of expected.native?.requiredEdgeKinds ?? []) assert(kinds.includes(kind), 'Missing native edge: ' + kind);
    for (const kind of expected.native?.forbiddenEdgeKinds ?? []) assert(!kinds.includes(kind), 'Forbidden native edge: ' + kind);
    if (expected.native?.requiredGap) {
      const gap = expected.native.requiredGap, omitted = item.omissions?.[gap];
      assert(item.gaps.includes(gap) || item.flow.gaps.includes(gap) || Number.isSafeInteger(omitted) && omitted > 0,
        'Missing required gap or positive omission count: ' + gap);
    }
    const evidence = indexes => indexes.map(index => { assert(Number.isSafeInteger(index) && index >= 0 && index < item.originals.length); return byId.get(item.originals[index]); });
    for (const node of item.nodes) {
      const originals = evidence(node[5]); assert(originals.length);
      assert(originals.some(span => span.startLine <= node[2] && span.endLine >= node[3]), 'Node range lacks an issued original.');
    }
    for (const edge of item.edges) {
      assert(item.nodes[edge[1]] && item.nodes[edge[2]]); assert(evidence(edge[7]).length);
      if (edge[9]) for (const side of ['publisher', 'subscriber']) {
        const witness = edge[9][side];
        assert(evidence(witness.evidenceIds).some(span => span.text.includes(witness.expression)));
      }
    }
    if (expected.native?.topic) assert(item.edges.some(edge => edge[9]?.value === expected.native.topic));
    for (const duplicate of item.duplicateClues) {
      const legacy = context.interfaces.comparisons.find(row => row.id === duplicate.legacyId); assert(legacy);
      const native = item.edges[duplicate.nativeEdge]; assert(native);
      assert(legacy.evidenceIds.every(id => native[7].some(index => item.originals[index] === id)));
    }
  } else assert.equal(typeof compact.reason, 'string');
  if (expected.prepared === 'source-context-and-review-required') {
    assert(engineerNote);
    assert(context.review.notes.some(note => note.statement === engineerNote.text && note.provenance === 'human' && note.verification === 'unverified'));
  }
  return { requiredOriginals: required, issuedOriginals: byId.size, sourceCount: names.length, native: Boolean(item), omission: compact.reason,
    resourceQualified: false, semanticQualified: false };
}
