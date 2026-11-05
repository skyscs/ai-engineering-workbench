// Fresh ordinary v1 observation. The diagnostic copy cannot qualify production resources.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { plan, baselineInput } from './baseline-plan.mjs';
import { materialize, launch, client, save, inventory, normalized, journal } from '../loredock-prepared-flow/io.mjs';
import { indexSources, prepare } from '../loredock-prepared-flow/flow.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output); await save(path.join(output, 'plan.json'), plan);
const log = journal(path.join(output, 'sequence.jsonl'));
const result = { errors: [], production: null, diagnostic: null, applicationChanged: false,
  realModelCalls: 0, controlledRuntimeCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
let daemon, api, store, catalog, analysis, owner;
const stringify = JSON.stringify;
try {
  const { corpus, expected, references } = baselineInput();
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'inputs.json'), { corpus, expected, references, sources });
  log.append({ event: 'production-started' });
  const data = path.join(output, 'production-data');
  daemon = await launch({ directory: path.join(output, 'production'), data });
  api = await client(path.join(output, 'http'));
  const indexed = await indexSources(api, sources.paths), prepared = await prepare(api, expected.question);
  result.production = { indexed, prepared };
  assert.equal(prepared.review.promptVersion, 'loredock-prepared-answer-v1');
  assert.equal(prepared.review.compact.item, null);
  assert.equal(prepared.review.compact.reason, plan.expectedPublicOmission);
  const repeated = await api.request('/question-preparations/' + prepared.review.id + '/review');
  assert.deepEqual(repeated.value, prepared.review);
  assert.equal((await api.request('/answers')).value.attempts.length, 0);
  api.close(); api = undefined;
  const exit = await daemon.stop(); daemon = undefined; assert.equal(exit.code, 0);
  result.production.exit = exit;
  const stopped = await inventory(data);
  await save(path.join(output, 'stopped-production.json'), stopped);
  const copy = path.join(output, 'diagnostic-data');
  await cp(data, copy, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(await inventory(copy), stopped);
  log.append({ event: 'diagnostic-started', productionStopped: true });
  const { services } = await import('../loredock-native-qualification/services.mjs');
  const { QuestionPreparations } = await import('../../apps/loredock/dist/question-preparation.js');
  store = new services.CatalogStore(copy); catalog = new services.Catalog(store);
  analysis = new services.CodeAnalysis(catalog); owner = new QuestionPreparations(analysis);
  const items = [];
  JSON.stringify = function (...args) {
    const serialized = stringify.apply(JSON, args), value = args[0];
    if (value?.schemaVersion === 'native-question-item/1') {
      assert.equal(typeof serialized, 'string');
      if (items.length) assert.equal(serialized, items[0]);
      items.push(serialized);
    }
    return serialized;
  };
  let snapshot;
  const started = owner.start(randomUUID(), expected.question); await owner.idle();
  const reviewed = owner.review(started.id);
  assert.equal(reviewed.reviewedHash, prepared.review.reviewedHash);
  assert.deepEqual(reviewed.context, prepared.review.context);
  assert.deepEqual(reviewed.compact, prepared.review.compact);
  const rollback = new Error('Keep diagnostic Ready after copying its immutable snapshot.');
  assert.throws(() => owner.promote(started.id, reviewed.reviewedHash, value => {
    snapshot = structuredClone(value); throw rollback;
  }), error => error === rollback);
  assert.equal(owner.get(started.id).status, 'ready');
  JSON.stringify = stringify;
  assert(items.length > 0); const item = JSON.parse(items[0]), witness = JSON.parse(snapshot.witnessJson);
  assert.equal(Buffer.byteLength(items[0]), prepared.review.compact.attemptedBytes);
  assert.equal(Buffer.byteLength(stringify([...reviewed.context.interfaces.comparisons, item])), prepared.review.compact.derivedBytes);
  assert.equal(item.lexicalInputHash, reviewed.context.inputHash);
  assert.deepEqual(item.duplicateClues, prepared.review.compact.duplicateClues);
  assert.equal(item.partial, true); assert.equal(item.verification, 'unverified'); assert.equal(item.deploymentCoherence, 'unknown');
  assert.equal(typeof witness.receipt, 'string'); assert(witness.receipt.length > 0);
  const supported = reviewed.context.spans.filter(span => item.originals.includes(span.id));
  for (const key of expected.requiredOriginals) {
    const reference = references[key];
    assert(supported.some(span => span.sourceName === reference.source && span.path === reference.path && span.text.includes(reference.quote)), key);
  }
  for (const kind of expected.native.requiredEdgeKinds) assert(item.edges.some(edge => edge[0] === kind), kind);
  assert(item.edges.some(edge => edge[8]?.status === 'gap'));
  assert.equal(store.one('SELECT count(*) n FROM answer_attempts').n, 0);
  assert.equal(store.one('SELECT count(*) n FROM answer_witnesses').n, 0);
  await writeFile(path.join(output, 'complete-v1-item.json'), items[0], { flag: 'wx' });
  await save(path.join(output, 'complete-v1-snapshot.json'), snapshot);
  await save(path.join(output, 'diagnostic-review.json'), reviewed);
  result.diagnostic = { observations: items.length, itemBytes: Buffer.byteLength(items[0]),
    combinedBytes: reviewed.compact.derivedBytes, requiredOriginals: expected.requiredOriginals.length,
    publicContextAndCompactParity: true, reviewedHashParity: true, rollbackKeepsReady: true,
    metrics: owner.metrics(), timingQualified: false, memoryQualified: false };
  assert.deepEqual(await inventory(data), stopped);
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  JSON.stringify = stringify; api?.close();
  try { if (daemon) { result.productionExit = await daemon.stop(); assert.equal(result.productionExit.code, 0); } }
  catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  for (const service of [owner, analysis, catalog]) {
    try { await service?.stop(); } catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  }
  try { store?.close(); } catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), result);
  log.append({ event: 'finished', errors: result.errors, resourceQualification: false }); log.close();
}
console.log(stringify({ errors: result.errors, diagnostic: result.diagnostic, resourceQualification: false }, null, 2));
