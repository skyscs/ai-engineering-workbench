// Ordinary version compatibility and useful-path observation on independent catalog copies.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { plan } from './factored-plan.mjs';
import { launch, client, save, inventory, normalized, journal, until } from '../loredock-prepared-flow/io.mjs';
import { prepare, generate } from '../loredock-prepared-flow/flow.mjs';
import { reopenHistory, stoppedHistoryCheckpoint, witnessStorage } from '../loredock-prepared-flow/history-cases.mjs';
import { browser } from '../loredock-prepared-flow/browser.mjs';
import { expandNativeQuestion } from '../../apps/loredock/dist/question-native-format.js';
import { preparedQuestionPrompt } from '../../apps/loredock/dist/question-context.js';
import { loadNativeV1Control } from '../../apps/loredock/tests/fixtures/native-format-v1-reference/verify.mjs';

const [output, baseline, historical] = process.argv.slice(2);
assert.equal(process.argv.length, 5);
for (const value of [output, baseline, historical]) assert(path.isAbsolute(value ?? '') && path.resolve(value) === value);
await mkdir(output); await save(path.join(output, 'plan.json'), { ...plan, baseline, historical });
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const baselineInventory = await inventory(baseline), historicalInventory = await inventory(historical);
const sourceInput = await read(path.join(baseline, 'run/inputs.json'));
const legacyRaw = await readFile(path.join(baseline, 'run/complete-v1-item.json'), 'utf8');
const legacySnapshot = await read(path.join(baseline, 'run/complete-v1-snapshot.json'));
const legacyContext = JSON.parse(legacySnapshot.contextJson);
const oldCheckpoint = await read(path.join(historical, 'run/capacity/checkpoint-20.json'));
const log = journal(path.join(output, 'sequence.jsonl'));
const result = { errors: [], cases: [], realModelCalls: 0, controlledRuntimeCalls: 0,
  reservedFamilyReads: 0, resourceQualification: false };
let daemon, api, page;
async function start(name, data, controlled = false) {
  daemon = await launch({ directory: path.join(output, name), data, controlled });
  api = await client(path.join(output, 'http-' + name));
}
async function stop() {
  api?.close(); api = undefined;
  if (daemon) { const owned = daemon; daemon = undefined; assert.equal((await owned.stop()).code, 0); }
}
async function copy(source, destination) {
  const before = await inventory(source); await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(await inventory(destination), before); return before;
}
function complete(review) {
  assert.equal(review.promptVersion, 'loredock-prepared-answer-v2');
  assert.equal(review.compact.reason, null); assert.equal(review.compact.item.schemaVersion, 'native-question-item/2');
  assert.deepEqual(review.context, legacyContext);
  assert.equal(JSON.stringify(expandNativeQuestion(review.compact.item, review.context)), legacyRaw);
  assert.equal(review.compact.derivedBytes, plan.expectedCombinedBytes); assert(review.compact.derivedBytes <= plan.derivedBytes);
  const support = review.context.spans.filter(span => review.compact.item.originals.includes(span.id));
  for (const key of sourceInput.expected.requiredOriginals) {
    const ref = sourceInput.references[key];
    assert(support.some(span => span.sourceName === ref.source && span.path === ref.path && span.text.includes(ref.quote)), key);
  }
  return { itemBytes: Buffer.byteLength(JSON.stringify(review.compact.item)), combinedBytes: review.compact.derivedBytes,
    expandedByteParity: true, requiredOriginals: sourceInput.expected.requiredOriginals.length };
}
async function step(name, execute) {
  log.append({ event: 'started', name }); const value = await execute();
  result.cases.push({ name, value }); log.append({ event: 'finished', name }); return value;
}
try {
  const data = path.join(output, 'production-data');
  await copy(path.join(baseline, 'run/production-data'), data);
  await step(plan.order[0], async () => {
    await start('production-v2', data);
    const prepared = await prepare(api, sourceInput.expected.question), semantic = complete(prepared.review);
    const repeated = await api.request('/question-preparations/' + prepared.review.id + '/review');
    assert.deepEqual(repeated.value, prepared.review); assert.equal((await api.request('/answers')).value.attempts.length, 0);
    await stop(); return { prepared, semantic, repeatedReviewParity: true };
  });
  const saved = await step(plan.order[1], async () => {
    await start('controlled-v2', data, true);
    assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
    await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
    const prepared = await prepare(api, sourceInput.expected.question); complete(prepared.review);
    const published = await generate(api, prepared.review), detail = await api.request('/answers/' + published.answer.id);
    assert.deepEqual(detail.value, published.answer);
    assert.deepEqual(detail.value.nativeContext, prepared.review.compact);
    assert(detail.value.answer.claims.every(claim => claim.evidenceIds.every(id => detail.value.context.spans.some(span => span.id === id))));
    const runtime = await daemon.command('stats'); assert.deepEqual(runtime, { prepares: 1, calls: 1, closed: 1 });
    result.controlledRuntimeCalls = runtime.calls;
    const request = await read(path.join(daemon.directory, 'request-1.json'));
    assert.equal(request.prompt, preparedQuestionPrompt(prepared.review.context, prepared.review.compact.item));
    await stop();
    const checkpoint = path.join(output, 'checkpoint-v2'), stopped = await stoppedHistoryCheckpoint(data, checkpoint);
    assert.deepEqual(stopped.storage.rows, 1);
    return { prepared, published, detail, runtime, checkpoint, stopped, promptBytes: Buffer.byteLength(request.prompt) };
  });
  await step(plan.order[2], async () => {
    const reopened = path.join(output, 'restart-data'); await copy(saved.checkpoint, reopened);
    await start('production-restart', reopened);
    const detail = await api.request('/answers/' + saved.published.answer.id);
    assert.equal(detail.rawSha256, saved.detail.rawSha256);
    const list = await api.request('/answers'); assert.equal(list.value.attempts[0].promptVersion, 'loredock-prepared-answer-v2');
    const replay = await api.request('/prepared-answers', 'POST', saved.published.input);
    assert.equal(replay.rawSha256, saved.detail.rawSha256);
    page = await browser({ directory: path.join(output, 'browser') });
    await page.prepare(sourceInput.expected.question);
    await until(() => page.evaluate("document.querySelectorAll('.native-question-context').length===2"), 'Ready and saved native displays did not open.');
    await page.evaluate("document.querySelectorAll('details').forEach(element=>{element.open=true});document.querySelector('.answer-panel').scrollIntoView()");
    const rendered = await page.evaluate("[...document.querySelectorAll('.native-question-context')].map(element=>element.innerText)");
    const gap = JSON.parse(legacyRaw).edges.find(edge => edge[8]?.status === 'gap')[8].detail;
    for (const text of rendered) {
      assert(text.includes(gap)); assert(text.includes('Deployment coherence is unknown'));
      assert(text.includes('repeated clues, not independent corroboration'));
    }
    const desktop = await page.snapshot('desktop'); assert.equal(desktop.overflow, false);
    await page.protocol.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: true });
    const mobile = await page.snapshot('mobile'); assert.equal(mobile.overflow, false);
    const browserResult = await page.stop(); page = undefined;
    assert.equal(browserResult.code, 0); assert.equal(browserResult.sampleError, null); assert.deepEqual(browserResult.errors, []);
    const sourceId = saved.prepared.review.context.spans[0].sourceId;
    await api.request('/sources/' + sourceId + '/revoke', 'POST', {});
    const fenced = (await api.request('/answers/' + saved.published.answer.id)).value;
    assert.equal(fenced.status, 'fenced');
    for (const key of ['context', 'nativeContext', 'answer']) assert.equal(fenced[key], null);
    await stop(); const storage = witnessStorage(reopened); assert.deepEqual(storage, { rows: 1, purged: 1, bytes: 0 });
    return { detailSha256: detail.rawSha256, replaySha256: replay.rawSha256, list,
      rendered, browserResult, storage, noRealRuntimeDispatch: true, resourceQualification: false };
  });
  await step(plan.order[3], () => reopenHistory({ checkpoint: oldCheckpoint, directory: path.join(output, 'v1-reopen') }));
  await step(plan.order[4], async () => {
    const { services } = await import('../loredock-native-qualification/services.mjs');
    const { AnswerWitnessStore } = await import('../../apps/loredock/dist/answer-witness-store.js');
    const { validateQuestionWitness } = await import('../../apps/loredock/dist/question-witness.js');
    const controlDirectory = path.join(output, 'v1-control'); await mkdir(controlDirectory);
    const control = await loadNativeV1Control(controlDirectory), observations = [];
    for (const [version, source, ids] of [[1, oldCheckpoint.data, oldCheckpoint.admissions.map(row => row.id)], [2, saved.checkpoint, [saved.published.answer.id]]]) {
      const target = path.join(output, 'diagnostic-v' + version); await copy(source, target);
      const store = new services.CatalogStore(target), catalog = new services.Catalog(store);
      try {
        const witnesses = new AnswerWitnessStore(catalog);
        for (const id of ids) {
          const snapshot = witnesses.read(id), context = JSON.parse(snapshot.contextJson), witness = JSON.parse(snapshot.witnessJson);
          assert.equal(witness.promptVersion, 'loredock-prepared-answer-v' + version);
          assert.equal(witness.prompt, preparedQuestionPrompt(context, witness.compact.item));
          if (version === 1) assert.equal(witness.prompt, control.preparedQuestionPrompt(context, witness.compact.item));
          else complete({ context, ...witness });
          const validated = await validateQuestionWitness(catalog, snapshot);
          assert.equal(validated.status, 'revalidated');
          await save(path.join(output, 'snapshot-' + id + '.json'), snapshot);
          observations.push({ id, version, promptBytes: Buffer.byteLength(witness.prompt), validated, diagnosticTimingQualified: false });
        }
      } finally { await catalog.stop(); store.close(); }
    }
    return { observations, exactV1Prompts: oldCheckpoint.admissions.length, modelCalls: 0 };
  });
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { if (page) await page.stop(); await stop(); }
  catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  try {
    assert.deepEqual(await inventory(baseline), baselineInventory); assert.deepEqual(await inventory(historical), historicalInventory);
    result.retainedInputsUnchanged = true;
  } catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), result); log.close();
}
console.log(JSON.stringify({ errors: result.errors, cases: result.cases.map(row => row.name), controlledRuntimeCalls: result.controlledRuntimeCalls,
  retainedInputsUnchanged: result.retainedInputsUnchanged, resourceQualification: false }, null, 2));
