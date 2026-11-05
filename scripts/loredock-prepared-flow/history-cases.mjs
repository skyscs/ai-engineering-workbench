// Real HTTP history cases with complete stopped checkpoints between independent lanes.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { launch, client, save, inventory, normalized, journal, until } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';
import { browser } from './browser.mjs';

export function witnessStorage(data) {
  const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
  try { return { ...database.prepare('SELECT count(*) rows, coalesce(sum(purged),0) purged, coalesce(sum(length(CAST(witness AS BLOB))),0) bytes FROM answer_witnesses').get() }; }
  finally { database.close(); }
}

export async function stoppedHistoryCheckpoint(data, destination) {
  // A read-only WAL connection may create SHM/WAL files. Inspect the working tree
  // before copying; never open the retained checkpoint with SQLite.
  const storage = witnessStorage(data);
  await cp(data, destination, { recursive: true, force: false, errorOnExist: true });
  const files = await inventory(destination);
  assert.deepEqual(files, await inventory(data));
  return { files, storage };
}

// R04 creation never runs a browser, production-history reopen, revocation or accounting.
export async function createHistory({ directory, sources, question }) {
  await mkdir(directory);
  const data = path.join(directory, 'data'), log = journal(path.join(directory, 'journal.jsonl'));
  const result = { errors: [], admissions: [], lists: [], checkpoints: [], runtimeSegments: [], qualification: false };
  let daemon, api;
  async function start(name) {
    daemon = await launch({ directory: path.join(directory, name), data, controlled: true });
    api = await client(path.join(directory, 'http-' + name));
    assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  }
  async function stop() {
    api?.close(); api = undefined;
    if (daemon) {
      const owned = daemon; daemon = undefined;
      try { result.runtimeSegments.push(await owned.command('stats')); }
      finally { const exit = await owned.stop(); assert.equal(exit.code, 0); }
    }
  }
  try {
    log.append({ event: 'creation-started', declaredAdmissions: 64, checkpointRows: [20, 64] });
    await start('controlled-initial');
    result.index = await indexSources(api, sources.paths);
    await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: directory, profile: null });
    for (let count = 1; count <= 64; count++) {
      const began = performance.now(), prepared = await prepare(api, question);
      assert(prepared.review.compact.item, 'Capacity requires a useful nonempty native witness.');
      const published = await generate(api, prepared.review);
      const saved = await api.request('/answers/' + published.answer.id);
      assert.deepEqual(saved.value, published.answer);
      result.admissions.push({ row: count, id: published.answer.id, input: published.input,
        rawSha256: saved.rawSha256, bytes: saved.bytes, elapsedMs: performance.now() - began });
      log.append({ event: 'admitted-and-published', ...result.admissions.at(-1) });
      let list;
      if ([1, 20, 64].includes(count)) {
        list = await api.request('/answers');
        assert.equal(list.value.attempts.length, Math.min(count, 20));
        result.lists.push({ storedRows: count, ...list });
      }
      if ([20, 64].includes(count)) {
        // This extra real Ready is the explicitly recorded transient-restart control.
        const ready = await prepare(api, question);
        assert(ready.review.compact.item);
        if (count === 64) {
          const before = await daemon.command('stats');
          const refused = await api.request('/prepared-answers', 'POST', { requestId: 'owned-history-over-capacity',
            preparationId: ready.review.id, reviewedHash: ready.review.reviewedHash }, { allowError: true });
          assert.equal(refused.status, 409); assert.equal(refused.value.error.code, 'ANSWER_WITNESS_LIMIT');
          assert.equal((await api.request('/question-preparations/' + ready.review.id)).value.status, 'ready');
          const replay = await api.request('/prepared-answers', 'POST', result.admissions[0].input);
          assert.equal(replay.rawSha256, result.admissions[0].rawSha256);
          assert.deepEqual(await daemon.command('stats'), before);
          result.refusal = { response: refused, readyStillUsable: true, replaySha256: replay.rawSha256, noAdditionalRuntimeCall: true };
        }
        await stop();
        const snapshot = path.join(directory, 'checkpoint-' + count);
        const { files, storage } = await stoppedHistoryCheckpoint(data, snapshot);
        assert.equal(storage.rows, count); assert.equal(storage.purged, 0); assert(storage.bytes > 0);
        const checkpoint = { data: snapshot, rows: count, files, storage, list, readyId: ready.review.id,
          admissions: result.admissions.slice(), question };
        await save(path.join(directory, 'checkpoint-' + count + '.json'), checkpoint);
        result.checkpoints.push(checkpoint);
        log.append({ event: 'stopped-checkpoint', rows: count, storage });
        if (count === 20) await start('controlled-continuation');
      }
    }
    assert.equal(result.runtimeSegments.reduce((sum, row) => sum + row.calls, 0), 64);
    assert(result.runtimeSegments.every(row => row.prepares === row.calls && row.closed === row.calls));
  } catch (error) { result.errors.push(normalized(error)); }
  finally {
    try { await stop(); } catch (error) { result.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), result);
    log.append({ event: 'creation-finished', failed: result.errors.length > 0 }); log.close();
  }
  assert.deepEqual(result.errors, [], 'History creation failed; complete partial output is retained.');
  return result;
}

async function copyCase({ checkpoint, directory, accounting = false }, execute) {
  await mkdir(directory);
  const result = { rows: checkpoint.rows, errors: [], qualification: false };
  const data = path.join(directory, 'data'); let daemon, api, copied = false;
  try {
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files, 'The stopped checkpoint changed.');
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    copied = true;
    assert.deepEqual(await inventory(data), checkpoint.files);
    await save(path.join(directory, 'input.json'), checkpoint);
    daemon = await launch({ directory: path.join(directory, 'daemon'), data, controlled: accounting, accounting });
    api = await client(path.join(directory, 'http'));
    result.observation = await execute({ api, daemon, data });
    if (accounting) {
      result.runtime = await daemon.command('stats');
      assert.deepEqual(result.runtime, { prepares: 0, calls: 0, closed: 0 });
    }
  } catch (error) { result.errors.push(normalized(error)); }
  finally {
    api?.close();
    try { if (daemon) { result.exit = await daemon.stop(); assert.equal(result.exit.code, 0); } }
    catch (error) { result.errors.push(normalized(error)); }
    try {
      if (copied) result.storage = witnessStorage(data);
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files, 'Observation changed the stopped source checkpoint.');
      if (accounting && daemon) {
        result.audit = JSON.parse(await readFile(path.join(daemon.directory, 'accounting-audit.json'), 'utf8'));
        assert.equal(result.audit.activeScope, null);
        for (const key of ['lateActivities', 'unscopedBudgets', 'unclosedBudgets']) assert.deepEqual(result.audit[key], []);
      }
    } catch (error) { result.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), result);
  }
  assert.deepEqual(result.errors, [], 'History observation failed; its complete copy is retained.');
  return result;
}

export function browserHistory({ checkpoint, directory }) {
  return copyCase({ checkpoint, directory }, async ({ api }) => {
    assert.equal((await api.request('/answers')).rawSha256, checkpoint.list.rawSha256);
    let page;
    const result = {};
    try {
      page = await browser({ directory: path.join(directory, 'browser') });
      await page.prepare(checkpoint.question);
      await until(() => page.evaluate("document.body.innerText.includes('Saved prepared context')"), 'Saved answer did not open alongside Ready.');
      result.window = await page.idleWindow('history-' + checkpoint.rows, 30000);
      await page.evaluate("document.querySelector('.answer-panel').scrollIntoView()");
      const desktop = await page.snapshot('desktop'); assert.equal(desktop.overflow, false);
      await page.protocol.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: true });
      const mobile = await page.snapshot('mobile'); assert.equal(mobile.overflow, false);
    } finally {
      if (page) {
        result.browser = await page.stop();
        assert.equal(result.browser.code, 0); assert.equal(result.browser.sampleError, null); assert.deepEqual(result.browser.errors, []);
      }
    }
    return result;
  });
}

export function reopenHistory({ checkpoint, directory }) {
  return copyCase({ checkpoint, directory }, async ({ api }) => {
    const list = await api.request('/answers'); assert.equal(list.rawSha256, checkpoint.list.rawSha256);
    const missing = await api.request('/question-preparations/' + checkpoint.readyId, 'GET', undefined, { allowError: true });
    assert.equal(missing.value.error.code, 'QUESTION_NOT_FOUND');
    const answers = [];
    for (const admitted of checkpoint.admissions) {
      const response = await api.request('/answers/' + admitted.id);
      assert.equal(response.rawSha256, admitted.rawSha256, 'Saved answer bytes changed on real-entry reopen.');
      answers.push({ id: admitted.id, rawSha256: response.rawSha256, bytes: response.bytes, elapsedMs: response.elapsedMs });
    }
    const replay = await api.request('/prepared-answers', 'POST', checkpoint.admissions[0].input);
    assert.equal(replay.rawSha256, checkpoint.admissions[0].rawSha256);
    return { list, answers, transientLost: true, replaySha256: replay.rawSha256 };
  });
}

export function revokeHistory({ checkpoint, directory, sourceName }) {
  assert.equal(checkpoint.rows, 64);
  return copyCase({ checkpoint, directory }, async ({ api, data }) => {
    const dependency = (await api.request('/project')).value.sources.find(source => source.name === sourceName);
    assert(dependency);
    const response = await api.request('/sources/' + dependency.id + '/revoke', 'POST', {});
    for (const admitted of checkpoint.admissions) {
      const fenced = (await api.request('/answers/' + admitted.id)).value;
      assert.equal(fenced.status, 'fenced');
      for (const key of ['context', 'nativeContext', 'answer']) assert.equal(fenced[key], null);
    }
    const storage = witnessStorage(data);
    assert.deepEqual(storage, { rows: 64, purged: 64, bytes: 0 });
    return { sourceId: dependency.id, response, fencedAnswers: 64, storage };
  });
}

export function accountHistory({ checkpoint, directory }) {
  return copyCase({ checkpoint, directory, accounting: true }, async ({ api, daemon }) => {
    await daemon.command('accounting-start', { scope: 'answer-list-' + checkpoint.rows });
    const list = await api.request('/answers'), accounting = await daemon.command('accounting-end');
    assert.equal(list.rawSha256, checkpoint.list.rawSha256);
    assert.equal(accounting.budgets.length, 20); assert.deepEqual(accounting.unclosedBudgets, []);
    for (const budget of accounting.budgets) assert.equal(Object.values(budget.charges).reduce((sum, row) => sum + row.accepted, 0), budget.final.totalWork);
    assert.equal(accounting.totalWork, accounting.budgets.reduce((sum, row) => sum + row.final.totalWork, 0));
    await save(path.join(directory, 'accounting.json'), accounting);
    return { list, budgets: accounting.budgets.length, totalWork: accounting.totalWork, rawByteParity: true,
      resourceQualification: false, diagnosticTimingQualified: false };
  });
}
