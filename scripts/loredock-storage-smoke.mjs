import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CodeAnalysis} from '../apps/loredock/dist/code-analysis.js';
import {createScaleFixture, scaleGit} from './loredock-scale-fixture.mjs';
import {auditStorage} from './loredock-storage.mjs';

const output = process.argv[2];
assert.ok(output && path.isAbsolute(output), 'An absolute report directory is required.');
await mkdir(output, {recursive: true});
const fixture = await createScaleFixture(), directory = path.join(fixture.root, 'storage-data');
const store = new CatalogStore(directory), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog);
let closed = false;
try {
  for (const source of fixture.manifest.sources) await catalog.addSource(path.join(fixture.root, 'sources', source.id));
  const samples = [];
  for (const stage of ['initial', 'unchangedRefresh']) {
    const project = store.project(), build = catalog.start(stage, project.sourceSetVersion, project.policyVersion);
    await catalog.idle(); assert.equal(store.build(build.id).coverage.indexed, 79); assert.ok(store.build(build.id).published);
    const run = analysis.start(stage, build.id); await analysis.idle(); assert.equal(analysis.get(run.id).counts.parsed, 21);
    const originals = catalog.search('orders.placed.v2').hits;
    const before = originals.map(hit => catalog.evidence(hit.id));
    const report = auditStorage(directory);
    assert.deepEqual(originals.map(hit => catalog.evidence(hit.id)), before);
    samples.push({stage, report});
  }
  const [initial, refreshed] = samples.map(sample => sample.report);
  assert.equal(refreshed.payloads.originals.bytes, initial.payloads.originals.bytes * 2);
  assert.equal(refreshed.payloads.spans.bytes, initial.payloads.spans.bytes * 2);
  assert.equal(refreshed.duplicateCandidates.originals.bytes, initial.payloads.originals.bytes + initial.duplicateCandidates.originals.bytes);
  assert.equal(refreshed.dependencies.usedAsRefreshBaseline, 1);
  assert.equal(refreshed.dependencies.withCodeInventories, 2);
  for (const source of fixture.manifest.sources) {
    assert.equal(scaleGit(fixture.root, source.id, ['rev-parse', 'HEAD']), source.revision);
    assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain']), '');
  }
  catalog.revoke(store.sources()[0].id); samples.push({stage: 'oneSourceRevoked', report: auditStorage(directory)});
  assert.equal(samples[2].report.payloads.codeFacts.bytes, 0);
  assert.ok(samples[2].report.payloads.originals.bytes < refreshed.payloads.originals.bytes);
  assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
  await analysis.stop(); await catalog.stop(); store.close(); closed = true;
  const names = ['loredock.db', '.owner.db'], before = await Promise.all(names.map(name => readFile(path.join(directory, name))));
  const cli = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./loredock-storage.mjs', import.meta.url)), '--data-dir', directory], {encoding: 'utf8'}));
  assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(directory, name)))), before);
  const serialized = JSON.parse(JSON.stringify(samples[2].report));
  assert.deepEqual(cli.payloads, serialized.payloads); assert.deepEqual(cli.dependencies, serialized.dependencies);
  samples.push({stage: 'closedCli', report: cli});
  const result = {schemaVersion: 'loredock-storage-smoke/1', checkedAt: new Date().toISOString(), sources: 20,
    eligibleFilesPerIndex: 79, modelRequests: 0, sourceCheckoutsUnchanged: true, originalReadsUnchanged: true,
    closedDatabaseBytesUnchanged: true,
    auditScriptSha256: createHash('sha256').update(await readFile(new URL('./loredock-storage.mjs', import.meta.url))).digest('hex'), samples};
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({passed: true, output, initialSqliteBytes: initial.sqlite.allocatedBytes,
    refreshedSqliteBytes: refreshed.sqlite.allocatedBytes, allocations: refreshed.sqlite.allocations, payloads: refreshed.payloads}));
} finally {
  if (!closed) {await analysis.stop(); await catalog.stop(); store.close();}
  await rm(fixture.root, {recursive: true, force: true});
}
