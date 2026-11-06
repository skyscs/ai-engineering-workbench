import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const node = (id, label, kind = 'symbol', properties = {}) => ({ id, label, kind, properties, evidenceIds: [id] });
const work = () => ({ count: 0, async step() { this.count++; } });
async function select(nodes, edges, roots, question, ids = nodes.map(row => row.id)) {
  const { chooseQuestionRoot } = await import('../loredock-native-question-context/selection.mjs');
  const { chooseQuestionRoot: production } = await import('../../apps/loredock/dist/question-path-selection.js');
  const resolution = { nodes, edges, roots: roots.map(id => ({ id })) }, context = { question, spans: ids.map(id => ({ id })) };
  const before = JSON.stringify({ resolution, context }), oldWork = work(), newWork = work();
  const outcome = async (select, charge) => { try { return { value: await select(resolution, context, charge) }; }
    catch (error) { return { error, comparable: { code: error.code, message: error.message, observation: error.observation } }; } };
  const old = await outcome(chooseQuestionRoot, oldWork), current = await outcome(production, newWork);
  assert.deepEqual(current.value, old.value); assert.deepEqual(current.comparable, old.comparable);
  assert.equal(newWork.count, oldWork.count); assert.equal(JSON.stringify({ resolution, context }), before);
  if (current.error) throw current.error;
  return current.value;
}

test('complete selection reaches a root outside the display page and terminates on cycles', async () => {
  const nodes = Array.from({ length: 6 }, (_, i) => node(String(i), 'action' + i));
  nodes.push(node('op', 'POST /scope/item', 'http-request'));
  const result = await select(nodes, [{ from: '5', to: 'op' }, { from: 'op', to: '5' }], nodes.slice(0, 6).map(row => row.id), 'How does POST /scope/item work?');
  assert.equal(result.rootId, '5'); assert.equal(result.observation.roots, 6); assert.equal(result.observation.traversals, 2);
});
test('literal boundaries reject prefixes, qualified suffixes, source prose and unsupported anchors', async () => {
  for (const [label, kind, properties, valid, invalid] of [
    ['perform', 'symbol', {}, ['perform?', 'perform.'], ['performAgain', 'Againperform', 'other.perform', 'perform.other']],
    ['POST /scope/item', 'http-request', {}, ['POST /scope/item?'], ['POST', 'POST /scope/items', 'POST /scope/item/child']],
    ['Publish', 'event-publish', { topicExpression: '"scope.item.v2"' }, ['scope.item.v2?', 'scope.item.v2.'], ['scope.item', 'scope.item.v2.extra', 'other.scope.item.v2']],
  ]) {
    const nodes = [node('a', label, kind, properties)];
    for (const question of valid) assert.equal((await select(nodes, [], ['a'], question)).rootId, 'a');
    for (const question of invalid) await assert.rejects(select(nodes, [], ['a'], question), error => error.code === 'QUESTION_INSUFFICIENT_CONTEXT');
    await assert.rejects(select(nodes, [], ['a'], valid[0], []), error => error.code === 'QUESTION_INSUFFICIENT_CONTEXT');
  }
});
test('all matching identities stay ambiguous, even with equal labels', async () => {
  await assert.rejects(select([node('a', 'perform'), node('b', 'perform')], [], ['a', 'b'], 'perform'), error =>
    error.code === 'QUESTION_AMBIGUOUS' && error.observation.eligibleRoots === 2);
});
test('selection refuses an incomplete traversal instead of returning its first root', async () => {
  const nodes = Array.from({ length: 1001 }, (_, i) => node(String(i), i ? 'node' + i : 'target'));
  const edges = nodes.slice(1).map((row, i) => ({ from: row.id, to: String(i) }));
  await assert.rejects(select(nodes, edges, ['0', '1000'], 'target'), error => error.code === 'QUESTION_SELECTION_LIMIT' && !error.observation.complete);
});
test('candidate delta is exactly two retained edits and deterministic static import relocation', async () => {
  const { runtimeImports, relocateSource } = await import('../../apps/loredock/tests/fixtures/integration-reference/compile.mjs');
  const manifest = JSON.parse(await readFile(path.join(root, 'scripts/loredock-native-question-context/candidate-manifest.json'), 'utf8'));
  const control = await readFile(path.join(root, 'fixtures/loredock-native-question-context-run/control/code-paths-v2.js.txt'), 'utf8');
  const { verifyQuestionReadDelta } = await import('../../apps/loredock/tests/fixtures/question-read-reference/verify.mjs');
  assert.equal(await verifyQuestionReadDelta('code-paths-v2'), control);
  let expected = control; assert.equal(manifest.edits.length, 2);
  for (const { before, after } of manifest.edits) { assert.equal(expected.split(before).length, 2); expected = expected.replace(before, after); }
  assert.deepEqual(Object.keys(manifest.relocations).sort(), runtimeImports(expected).filter(row => row.name.startsWith('.')).map(row => row.name).sort());
  assert.equal(await readFile(path.join(root, 'scripts/loredock-native-question-context/candidate-paths.mjs'), 'utf8'), relocateSource(expected, manifest.relocations));
});
test('compiled ordinary permit preparation preserves retrieval, support, cancellation and ownership', { timeout: 60000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'question-development-')); let passed = false;
  t.after(async () => { if (passed) await rm(directory, { recursive: true, force: true }); else t.diagnostic('Retained ordinary question development: ' + directory); });
  const { runDevelopment } = await import('../loredock-native-question-context/development.mjs');
  const checks = await runDevelopment(path.join(directory, 'run')); assert.equal(checks.length, 7); passed = true;
});

test('ordinary 44-case matrix retains identities, unchanged witnesses and refuses corrupted assessments', { timeout: 180000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'question-matrix-')); let passed = false;
  t.after(async () => { if (passed) await rm(directory, { recursive: true, force: true }); else t.diagnostic('Retained ordinary matrix: ' + directory); });
  const { runOrdinaryMatrix, ordinaryMatrixInputs } = await import('../loredock-native-question-context/development-matrix.mjs');
  const { assessMatrix } = await import('../loredock-native-question-context/assessment.mjs');
  const result = await runOrdinaryMatrix(path.join(directory, 'run'));
  assert.equal(result.assessment.prospective, 44); assert.equal(result.assessment.observed, 44);
  assert.equal(result.assessment.pass, true, JSON.stringify(result.assessment.cases.filter(row => row.state !== 'pass')));
  const raw = JSON.parse(await readFile(path.join(directory, 'run/matrix-raw.json'), 'utf8'));
  const ledger = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-native-question-context-run/protocol.json'), 'utf8'));
  const { oracle } = ordinaryMatrixInputs();
  for (const mutation of ['missing-case', 'work', 'write', 'support', 'reason', 'witness', 'dependency', 'external', 'source-text', 'source-write']) {
    const records = structuredClone(raw.records), op = records[0].operation;
    if (mutation === 'missing-case') records.pop();
    if (mutation === 'work') op.metrics.budget.totalWork--;
    if (mutation === 'write') op.after.changedRows++;
    if (mutation === 'support') op.result.compact.item.originals.pop();
    if (mutation === 'reason') op.result.compact.item.edges[0][4] = 'Invented qualification.';
    if (mutation === 'witness') records.find(row => row.id === 'witness.inventory-replaced').witnessAfter.factReads++;
    if (mutation === 'dependency') op.result.dependencies.pop();
    if (mutation === 'external') op.networkAttempts++;
    if (mutation === 'source-text') records[0].sourceInput.corpus['a-permit-ui']['ui/request.ts'] += '// Altered source.\n';
    if (mutation === 'source-write') delete op.sourceHashesAfter[Object.keys(op.sourceHashesAfter)[0]];
    const assessment = assessMatrix(ledger, records, oracle); assert.equal(assessment.pass, false, mutation); assert.equal(assessment.prospective, 44);
  }
  passed = true;
});
