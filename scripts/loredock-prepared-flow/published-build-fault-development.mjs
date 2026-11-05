// Isolated catalog fault at durable admission. Both build identities and all their
// originals come from actual HTTP indexing before the fault is armed. No model call.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources, prepare } from './flow.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-published-build-fault/1', errors: [], modelCalls: 0, reservedFamilyReads: 0,
  resourceQualification: false, fault: 'Select an actual completed alternative build after durable witness insertion.' };
let daemon, api;
async function stop() {
  api?.close(); api = undefined;
  if (daemon) { const owned = daemon; daemon = undefined; const exit = await owned.stop(); assert.equal(exit.code, 0); }
}
async function start(name, data, controlled) {
  daemon = await launch({ directory: path.join(output, name), data, controlled });
  api = await client(path.join(output, 'http-' + name));
}
function database(data, fn) {
  const db = new DatabaseSync(path.join(data, 'loredock.db'));
  try { return fn(db); } finally { db.close(); }
}
try {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  const base = path.join(output, 'base-data');
  await start('production', base, false);
  const first = await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  const project = (await api.request('/project')).value;
  const next = (await api.request('/builds', 'POST', { requestId: randomUUID(), sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
  const second = await until(async () => {
    const value = (await api.request('/builds/' + next.id)).value;
    if (['preparing', 'running'].includes(value.status)) return false;
    assert.equal(value.status, 'completed'); assert(value.published); return value;
  }, 'The actual alternative build did not publish.', 15000, 100);
  await until(async () => (await api.request('/code-analysis')).value.inventories.some(row => row.buildId === second.id
    && row.status === 'completed' && row.published && row.currentParser), 'Alternative native analysis did not publish.', 15000, 100);
  assert.notEqual(first.build.id, second.id);
  report.actualBuilds = { first: first.build, second };
  report.actualPublishedProject = (await api.request('/project')).value;
  await stop();
  const data = path.join(output, 'fault-data'); await cp(base, data, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(await inventory(data), await inventory(base));
  // Select the earlier, still complete published build on this isolated stopped copy.
  // No synthetic build, source, parser identity, witness or admission row is inserted.
  database(data, db => {
    for (const id of [first.build.id, second.id]) {
      const row = db.prepare('SELECT status,published,policyVersion,sourceSetVersion FROM builds WHERE id=?').get(id);
      assert.equal(row.status, 'completed'); assert.equal(row.published, 1);
      assert.equal(row.policyVersion, project.policyVersion); assert.equal(row.sourceSetVersion, project.sourceSetVersion);
    }
    db.prepare('UPDATE project SET publishedBuildId=? WHERE id=1').run(first.build.id);
  });
  await save(path.join(output, 'fault-setup.json'), { retainedCompleteBuilds: [first.build.id, second.id], selectedBuild: first.build.id,
    setupStatement: 'UPDATE project SET publishedBuildId=? WHERE id=1', parameters: [first.build.id] });
  await start('controlled', data, true);
  const prepared = await prepare(api, 'How does apply reach PermitWriter.onMessage through permit.granted.v3?');
  assert.equal(prepared.review.context.buildId, first.build.id); assert(prepared.review.compact.item);
  // SQLite owns this deterministic point in the real synchronous admission transaction.
  assert(/^[a-f0-9-]{36}$/.test(second.id));
  const sql = `CREATE TRIGGER owned_publish_at_admission AFTER INSERT ON answer_witnesses BEGIN
UPDATE project SET publishedBuildId='${second.id}' WHERE id=1;
END;`;
  await writeFile(path.join(output, 'fault.sql'), sql + '\n', { flag: 'wx' });
  database(data, db => db.exec(sql));
  const input = { requestId: randomUUID(), preparationId: prepared.review.id, reviewedHash: prepared.review.reviewedHash };
  report.admitted = (await api.request('/prepared-answers', 'POST', input)).value;
  report.terminal = await until(async () => {
    const value = (await api.request('/answers/' + report.admitted.id)).value;
    return ['preparing', 'running'].includes(value.status) ? false : value;
  }, 'The changed published build did not fence the answer.');
  assert.equal(report.terminal.status, 'failed'); assert.equal(report.terminal.answer, null);
  assert.equal(report.terminal.dispatchedAt, null); assert.equal(report.terminal.usage, null);
  report.runtime = await daemon.command('stats'); assert.deepEqual(report.runtime, { prepares: 0, calls: 0, closed: 0 });
  const current = (await api.request('/project')).value;
  assert.equal(current.publishedBuildId, second.id);
  for (const key of ['sourceSetVersion', 'policyVersion', 'correctionRevision']) assert.equal(current[key], project[key]);
  report.publishedProjectAfterFault = current;
  assert.equal((await api.request('/prepared-answers', 'POST', input)).value.id, report.admitted.id);
  assert.deepEqual(await daemon.command('stats'), report.runtime);
  await stop();
  report.stored = database(data, db => {
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    const row = db.prepare('SELECT a.buildId,a.status,a.dispatchedAt,w.reviewedHash FROM answer_attempts a JOIN answer_witnesses w ON w.answerId=a.id').get();
    assert.equal(row.buildId, first.build.id); assert.equal(row.reviewedHash, prepared.review.reviewedHash);
    return { ...row };
  });
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
