// Ordinary development of the explicitly declared S07 setup: actual Catalog without
// a follow service, then the actual production entry. Never use a reserved source here.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized } from './io.mjs';
import { prepare } from './flow.mjs';
import { assessPreview } from './assess.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-source-only-development/1', errors: [], modelCalls: 0,
  reservedFamilyReads: 0, resourceQualification: false, setup: 'Actual Catalog without a follow service, then the actual entry.' };
let store, catalog, daemon, api;
try {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  const data = path.join(output, 'data');
  store = new CatalogStore(data); catalog = new Catalog(store);
  for (const source of sources.paths) await catalog.addSource(source);
  const project = store.project(), started = catalog.start(randomUUID(), project.sourceSetVersion, project.policyVersion);
  await catalog.idle();
  report.build = store.build(started.id);
  assert.equal(report.build.status, 'completed'); assert(report.build.published);
  assert.equal(store.one('SELECT count(*) n FROM code_analyses').n, 0);
  report.setupProject = catalog.state();
  await catalog.stop(); catalog = undefined; store.close(); store = undefined;
  await save(path.join(output, 'stopped-before-reopen.json'), await inventory(data));
  daemon = await launch({ directory: path.join(output, 'production-reopen'), data });
  api = await client(path.join(output, 'http'));
  const before = (await api.request('/code-analysis')).value;
  assert.deepEqual(before.inventories, []); assert.equal(before.pendingBuildId, null);
  // Observe more than two real follow intervals without publishing a new source build.
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.deepEqual((await api.request('/code-analysis')).value, before);
  const prepared = await prepare(api, 'How does apply use requestPermit and what is known without code analysis?');
  report.assessment = assessPreview(prepared.review, { corpus, sources,
    expected: { prepared: 'unavailable-omission-required', requiredOriginals: ['action'] },
    references: { action: { source: 'a-permit-ui', path: 'ui/AAApply.vue', quote: 'const apply = () =>' } } });
  assert.equal(prepared.review.compact.reason, 'INVENTORY_UNAVAILABLE');
  assert.equal(prepared.review.context.buildId, report.build.id);
  assert.equal((await api.request('/project')).value.publishedBuildId, report.build.id);
  assert.deepEqual((await api.request('/code-analysis')).value, before);
  assert.equal((await api.request('/answers')).value.attempts.length, 0);
  report.review = prepared.review;
  report.analysis = before;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { if (catalog) await catalog.stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { store?.close(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  api?.close();
  try { if (daemon) { report.daemon = await daemon.stop(); assert.equal(report.daemon.code, 0); } }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
