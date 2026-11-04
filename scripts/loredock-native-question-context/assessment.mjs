import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeReceipt } from '../loredock-native-assessment/codec.mjs';
import { validateSupport } from '../loredock-qualification-assessment/content.mjs';
const hash = text => createHash('sha256').update(text).digest('hex');
const bytes = value => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
const check = action => { try { action(); return { state: 'pass' }; } catch (error) { return { state: 'fail', message: error.message }; } };
const originalKeys = ['id', 'sourceId', 'sourceName', 'revision', 'path', 'startLine', 'endLine', 'contentHash', 'spanHash', 'text'];
const pick = row => Object.fromEntries(originalKeys.map(key => [key, row[key]]));

// Independent semantic comparisons against saved raw originals/graph; never invokes the
// candidate selector, compactor, preparation owner or oracle-dependent fixture builder.
export function assertCompact(result) {
  const { context, compact, projection } = result, item = compact.item; assert(item);
  const { receipt } = decodeReceipt(Buffer.from(result.receipt), result.catalogId), graph = projection.graph;
  assert.equal(receipt.projectionJson, JSON.stringify(projection)); assert.equal(receipt.catalogId, result.catalogId);
  assert.equal(item.receiptHash, receipt.receiptHash); assert.equal(item.projectionId, projection.projectionId);
  assert.equal(item.lexicalInputHash, context.inputHash); assert.equal(hash(JSON.stringify(item)), compact.itemHash);
  assert.equal(hash(result.prompt), compact.promptHash); assert.equal(bytes(result.prompt), compact.promptBytes); assert(compact.promptBytes <= 96 * 1024);
  assert.equal(bytes([...(context.interfaces?.comparisons ?? []), item]), compact.derivedBytes); assert(compact.derivedBytes <= 8192);
  assert((context.interfaces?.comparisons.length ?? 0) + 1 <= 6);
  const originals = new Map(receipt.originals.map(row => [row.id, row])), issued = new Map(context.spans.map(row => [row.id, row]));
  const refs = indexes => indexes.map(index => { assert(Number.isInteger(index) && index >= 0 && index < item.originals.length); return item.originals[index]; });
  for (const id of item.originals) { assert(issued.has(id)); assert.equal(originals.get(id).buildId, context.buildId); assert.deepEqual(pick(originals.get(id)), issued.get(id)); }
  assert.equal(item.nodes.length, graph.nodes.length); assert.equal(item.edges.length, graph.edges.length); assert.equal(graph.flows.length, 1);
  graph.nodes.forEach((node, i) => { const row = item.nodes[i]; assert.equal(row.length, 6);
    assert.deepEqual(row.slice(0, 5), [node.kind, node.label, node.startLine, node.endLine, node.properties]); assert.deepEqual(refs(row[5]), node.evidenceIds);
    const original = originals.get(node.evidenceIds[0]); for (const key of ['sourceId', 'sourceName', 'path', 'revision']) assert.equal(node[key], original[key]); });
  graph.edges.forEach((edge, i) => { const row = item.edges[i]; assert.equal(row.length, 10);
    assert.deepEqual([row[0], graph.nodes[row[1]]?.id, graph.nodes[row[2]]?.id, ...row.slice(3, 7)],
      [edge.kind, edge.from, edge.to, edge.status, edge.reason, edge.environment, edge.gaps]);
    assert.deepEqual(refs(row[7]), edge.evidenceIds); assert.deepEqual(row[8], edge.headerCheck ?? null);
    if (edge.topicCheck) { const witness = structuredClone(row[9]); for (const end of ['publisher', 'subscriber']) witness[end].evidenceIds = refs(witness[end].evidenceIds);
      assert.deepEqual(witness, edge.topicCheck); } else assert.equal(row[9], null); });
  const flow = graph.flows[0]; assert.equal(item.flowId, flow.id);
  for (const key of ['title', 'status', 'environment', 'gaps']) assert.deepEqual(item.flow[key], flow[key]);
  assert.deepEqual(item.flow.nodeIndexes.map(i => graph.nodes[i]?.id), flow.nodeIds);
  assert.deepEqual(item.flow.edgeIndexes.map(i => graph.edges[i]?.id), flow.edgeIds); assert.deepEqual(refs(item.flow.evidenceIndexes), flow.evidenceIds);
  for (const key of ['partial', 'deploymentCoherence', 'gaps', 'omissions', 'declarationOmissions', 'coverage', 'limits']) assert.deepEqual(item[key], graph[key]);
  const all = new Set([...graph.nodes, ...graph.edges, ...graph.flows].flatMap(row => row.evidenceIds));
  for (const edge of graph.edges) if (edge.topicCheck) for (const end of ['publisher', 'subscriber']) for (const id of edge.topicCheck[end].evidenceIds) all.add(id);
  assert.deepEqual(item.originals, [...all].sort()); assert.deepEqual(result.dependencies, receipt.dependencies);
}
function metrics(operation) {
  const m = operation.metrics; assert(m); assert(Number.isFinite(m.outerWallMs) && m.outerWallMs >= 0);
  assert(Number.isFinite(m.maxIntervalMs) && m.maxIntervalMs >= 0); assert(m.samples.length >= 2);
  for (const sample of m.samples) for (const key of ['elapsedMs', 'rss', 'heapUsed']) assert(Number.isFinite(sample[key]) && sample[key] >= 0);
  if (m.budget) { assert(m.budget.totalWork <= 1000000); assert.equal(m.budget.totalWork, m.budget.pathWork + m.budget.receiptWork);
    assert.equal(m.budget.totalWork, Object.values(m.phases).reduce((sum, value) => sum + value, 0));
    assert.equal(m.lexical.sqlRows + m.lexical.originalBytes - m.lexical.rejectedUnits, m.phases.lexical ?? 0);
    if (!operation.error) assert(m.budget.wallMs < 5000); }
  for (const key of ['gitCalls', 'writeCalls', 'changedRows', 'sqlMutations'])
    assert.equal(operation.after[key] - operation.before[key], operation.injected[key] ?? 0, 'Unexpected operation mutation: ' + key);
  assert.equal(operation.legacyAfter, operation.legacyBefore); assert.equal(operation.networkAttempts, 0);
  assert(operation.nativeReads <= 1); assert.equal(operation.nativeReads, m.nativeReads);
  assert.deepEqual(operation.sourceHashesAfter, operation.sourceHashesBefore);
}
const tuple = node => [node.sourceName, node.path, node.kind, node.label];
function requiredGraph(graph, expected) {
  assert(graph); for (const expectedNode of expected.requiredNodes)
    assert(graph.nodes.some(node => JSON.stringify(tuple(node)) === JSON.stringify(expectedNode)), 'Missing typed node: ' + expectedNode.join('/'));
  for (const kind of expected.requiredEdgeKinds) assert(graph.edges.some(row => row.kind === kind), 'Missing edge: ' + kind);
  assert(graph.edges.some(row => row.topicCheck?.value === expected.topic));
}
export function assessQuestion(raw, question, expected) {
  const operation = raw.operation;
  const integrity = check(() => { assert(!operation.error, JSON.stringify(operation.error)); metrics(operation);
    const result = operation.result; assert.deepEqual(result.context, raw.baseline); assert.deepEqual(result.baseline, raw.baseline);
    const { inputHash, ...content } = result.context; assert.equal(hash(JSON.stringify(content)), inputHash);
    if (result.compact.item) { assertCompact(result);
      validateSupport(decodeReceipt(Buffer.from(result.receipt), result.catalogId), raw.sourceInput.corpus, raw.sourceInput.metadata); }
    for (const span of result.context.spans) {
      const source = raw.sourceInput.corpus[span.sourceName]?.[span.path]; assert.equal(typeof source, 'string');
      assert.equal(span.contentHash, hash(source)); assert.equal(span.revision, raw.sourceInput.metadata.revisions[span.sourceName]);
      assert.equal(span.text, source.replaceAll('\r\n', '\n').split('\n').slice(span.startLine - 1, span.endLine).join('\n'));
      assert.equal(span.spanHash, hash(span.text));
      assert.equal(span.sourceId, raw.sourceInput.metadata.sources.find(row => row.name === span.sourceName)?.sourceId);
    }
    assert.equal(result.dependencies.length, expected.allSourceDependencies);
    assert.equal(result.context.deploymentCoherence, 'unknown'); });
  const relevance = check(() => {
    const result = operation.result; assert(result); const graph = result.projection?.graph;
    if (question.expected === 'complete-static-path') {
      assertCompact(result); requiredGraph(graph, expected);
      assert(new Set(graph.nodes.map(node => node.sourceId)).size <= question.maxPathSources);
      assert(graph.nodes.every(node => !expected.forbiddenPathSources.includes(node.sourceName)));
      const root = graph.nodes.find(row => row.id === result.projection.selection.rootId);
      assert.deepEqual([root.sourceName, root.path, root.label], question.root);
      if (question.requireLateRoot !== false) assert(!raw.default.roots.items.some(row => row.id === root.id), 'Selected root must be outside the first four default cards.');
    } else if (question.expected === 'partial-static-path') {
      assertCompact(result); const flow = graph.flows[0], last = graph.nodes.find(row => row.id === flow.nodeIds.at(-1));
      assert.equal(last.kind, question.terminalKind); assert(graph.edges.every(row => !question.forbiddenEdgeKinds.includes(row.kind)));
      assert(result.projection.coverage.omissions[question.requiredGap] > 0 || graph.omissions[question.requiredGap] > 0
        || JSON.stringify(graph.gaps).includes(question.requiredGap), 'Missing required incomplete-wiring reason.');
    } else { assert.equal(result.compact.item, null);
      assert.equal(result.compact.reason, question.expected === 'ambiguous' ? 'QUESTION_AMBIGUOUS' : 'QUESTION_INSUFFICIENT_CONTEXT');
      if (question.expected === 'ambiguous') assert(result.selection.eligibleRoots >= question.minimumEligibleRoots); }
  });
  return { integrity, relevance, defaultControl: check(() => requiredGraph(raw.default?.graph, expected)),
    pass: integrity.state === 'pass' && relevance.state === 'pass' };
}
export function assessBoundary(raw, id) {
  return check(() => {
    assert(!raw.setupError, JSON.stringify(raw.setupError)); const op = raw.operation; metrics(op);
    const result = op.result;
    if (id.startsWith('policy.') || id.startsWith('revoke.')) { assert(raw.reached); assert(!result);
      assert(['RECEIPT_FENCED', 'ANALYSIS_FENCED', 'METADATA_CHANGED', 'POLICY_CHANGED', 'RECEIPT_SCOPE_FENCED'].includes(op.error?.code)); }
    else if (id.startsWith('cancel.')) { assert(raw.reached); assert(!result); assert.equal(op.error?.code, 'CANCELLED'); }
    else if (id.startsWith('budget.')) { assert.equal(result?.compact.item, null); assert.equal(result?.compact.reason, id.slice(7));
      assert.deepEqual(result.context, raw.controlled.context); assert(raw.controlled.context.review.notes.length > 0);
      assert(raw.controlled.promptBytes <= 98304); assert(raw.controlled.derivedBytes <= 8192);
      if (id.endsWith('derived-size')) assert(result.compact.derivedBytes > 8192 || result.context.interfaces.comparisons.length === 6);
      else assert(result.compact.promptBytes > 98304); }
    else if (id === 'support.missing-original') { assert.equal(result?.compact.item, null); assert.equal(result?.compact.reason, 'incomplete-original-support'); }
    else if (id.startsWith('identity.')) { assert(!result?.compact.item); assert(op.error?.code === 'QUESTION_ORIGINAL_MISMATCH'
      || op.error?.code === 'QUESTION_STALE' || result?.compact.reason === 'incomplete-original-support'); assert(raw.foreignOriginal); }
    else if (id.startsWith('inventory.')) { assert(!op.error); assert.equal(result.compact.reason, 'INVENTORY_UNAVAILABLE');
      assert.equal(result.compact.item, null); assert.equal(op.after.factReads, op.before.factReads);
      if (id.endsWith('incompatible')) assert(raw.priorFingerprint && raw.priorFingerprint !== raw.currentFingerprint); }
    else if (id.startsWith('freshness.')) { assert(!result); assert.equal(op.error?.code, 'QUESTION_STALE'); }
    else if (id === 'lifecycle.busy') { assert.equal(raw.busyError?.code, 'QUESTION_BUSY'); assert.equal(op.error?.code, 'CANCELLED'); assert(raw.released); }
    else if (id === 'lifecycle.shutdown') { assert.equal(op.error?.code, 'CANCELLED'); assert.equal(raw.afterStopError?.code, 'SERVICE_STOPPED'); assert(raw.released); }
    else if (id === 'lifecycle.work-zero') assert.equal(op.error?.code, 'CAPTURE_WORK_LIMIT');
    else if (id === 'lifecycle.time-zero') assert.equal(op.error?.code, 'CAPTURE_TIME_LIMIT');
    else if (id.startsWith('witness.')) { assertCompact(result); assert.equal(raw.revalidated?.status, 'revalidated'); assert(raw.contextUnchanged);
      for (const key of ['factReads', 'snapshots', 'pathReads', 'gitCalls', 'writeCalls', 'changedRows']) assert.equal(raw.witnessAfter[key], raw.witnessBefore[key]);
      assert.equal(raw.legacyAfter, raw.legacyBefore); assert(raw.evicted); }
    else assert.fail('Unassessed required observation: ' + id);
  });
}
export function assessMatrix(ledger, records, oracle) {
  const cases = ledger.cases.map(item => {
    const raw = records.find(row => row.id === item.id);
    if (!raw || raw.setupError) return { id: item.id, state: 'blocked', error: raw?.setupError ?? 'No completed raw observation.' };
    if (item.group === 'question') { const result = assessQuestion(raw, oracle.cases.find(row => 'question.' + row.id === item.id), oracle.completePath);
      return { id: item.id, state: result.pass ? 'pass' : 'fail', ...result }; }
    const result = assessBoundary(raw, item.id); return { id: item.id, ...result };
  });
  return { prospective: ledger.cases.length, observed: records.length, pass: cases.every(row => row.state === 'pass'),
    functionalAndSupportOnly: true, resourceQualification: false, modelAttempts: 0, cases };
}
