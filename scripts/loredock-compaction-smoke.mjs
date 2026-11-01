import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CodeAnalysis} from '../apps/loredock/dist/code-analysis.js';
import {prepareDemo} from './loredock-demo.mjs';
import {auditStorage} from './loredock-storage.mjs';

const output = process.argv[2]; assert.ok(output && path.isAbsolute(output), 'An absolute report directory is required.');
await mkdir(output, {recursive: true});
let root, store, catalog, analysis;
try {
  const demo = await prepareDemo({CatalogStore, Catalog, CodeAnalysis}, {onProgress: event => {if (event.root) root = event.root;}});
  store = new CatalogStore(demo.dataDirectory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog);
  const project = store.project(), build = catalog.start('refresh', project.sourceSetVersion, project.policyVersion);
  await catalog.idle(); const run = analysis.start('refresh', build.id); await analysis.idle(); assert.equal(analysis.get(run.id).counts.parsed, 21);
  catalog.revoke(store.sources()[0].id);
  const hit = catalog.search('orders').hits.find(hit => hit.sourceName === 'order-api'); assert.ok(hit);
  const original = catalog.evidence(hit.id), generations = store.all('SELECT * FROM builds ORDER BY rowid'), before = auditStorage(demo.dataDirectory);
  assert.ok(before.sqlite.freePages > 0); assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
  await analysis.stop(); await catalog.stop(); store.close(); store = undefined;
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const command = ['--silent', 'loredock:compact', '--data-dir', demo.dataDirectory];
  const report = JSON.parse(execFileSync('pnpm', command, {cwd: repo, encoding: 'utf8'}));
  assert.equal(report.status, 'compacted'); assert.ok(report.reclaimedSqliteBytes > 0); assert.equal(report.after.sqlite.freePages, 0);
  assert.deepEqual(report.before.payloads, report.after.payloads); assert.deepEqual(report.before.dependencies, report.after.dependencies);
  store = new CatalogStore(demo.dataDirectory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog);
  assert.deepEqual(catalog.evidence(hit.id), original); assert.deepEqual(store.all('SELECT * FROM builds ORDER BY rowid'), generations);
  const result = {schemaVersion: 'loredock-compaction-smoke/1', checkedAt: new Date().toISOString(), sourceCount: 20,
    modelRequests: 0, originalPreserved: true, generationsPreserved: true, usedPackageCommand: true,
    compactionScriptSha256: createHash('sha256').update(await readFile(new URL('./loredock-compact.mjs', import.meta.url))).digest('hex'), report};
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({passed: true, output, before: report.before.sqlite.allocatedBytes,
    after: report.after.sqlite.allocatedBytes, reclaimed: report.reclaimedSqliteBytes}));
} finally {
  if (store) {await analysis?.stop(); await catalog?.stop(); store.close();}
  if (root) await rm(root, {recursive: true, force: true});
}
