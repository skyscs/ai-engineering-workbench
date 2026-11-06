import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { ownedPlan } from './plan.mjs';

const [output, transport, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
for (const value of [output, transport]) assert(path.isAbsolute(value ?? ''));
assert.equal(process.versions.node, ownedPlan.node); assert.deepEqual(process.execArgv, []); assert(!process.env.NODE_OPTIONS);
mkdirSync(output);
const hash = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const began = performance.now(), cpu = process.cpuUsage(), threads = [], cases = [];
for (const name of ['events', 'samples']) writeFileSync(path.join(output, name + '.jsonl'), '', { flag: 'wx' });
const append = (name, row) => appendFileSync(path.join(output, name + '.jsonl'), JSON.stringify(row) + '\n');
const event = (type, row = {}) => append('events', { now: performance.now(), type, ...row });
const require = createRequire(import.meta.url), workers = require('node:worker_threads'), OriginalWorker = workers.Worker;
workers.Worker = class ObservedWorker extends OriginalWorker {
  constructor(entry, options) {
    super(entry, options);
    const item = { threadId: this.threadId, created: performance.now(), exited: false, requests: 0, replies: 0 };
    threads.push(item);
    event('worker-created', { ...item, entry: String(entry), environmentKeys: Object.keys(options.env), execArgv: options.execArgv });
    this.once('online', () => event('worker-online', { threadId: item.threadId }));
    this.on('message', frame => { item.replies++; event('reply', { threadId: item.threadId, bytes: frame.byteLength ?? null }); });
    this.once('exit', code => { item.exited = true; event('worker-exit', { threadId: item.threadId, code }); });
    const post = this.postMessage;
    this.postMessage = (frame, transfer) => { item.requests++; event('request', { threadId: item.threadId, bytes: frame.byteLength ?? null }); return post.call(this, frame, transfer); };
  }
};
syncBuiltinESMExports();
let previous = began;
const sample = () => { const now = performance.now(); append('samples', { now, gapMs: now - previous,
  memory: process.memoryUsage(), processHighWaterRssBytes: process.resourceUsage().maxRSS * 1024 }); previous = now; };
const timer = setInterval(sample, 10); sample(); save('plan.json', ownedPlan);
let failure = null, activeCatalog, activeStore;
try {
  event('import-start');
  const [{ Catalog }, { CatalogStore }, { codeFlows }, { factRanges }, { Corrections }, { Reconciliation }, observation] = await Promise.all([
    import('../../apps/loredock/dist/catalog.js'), import('../../apps/loredock/dist/store.js'),
    import('../../apps/loredock/dist/code-flows.js'), import('../../apps/loredock/dist/code-analysis-facts.js'),
    import('../../apps/loredock/dist/corrections.js'), import('../../apps/loredock/dist/reconciliation.js'),
    import('../loredock-async-legacy/observe.mjs'),
  ]);
  event('import-end'); assert.equal(threads.length, 0);
  const noCompiler = () => assert(!Object.keys(require.cache).some(file => /[\\/]typescript[\\/]lib[\\/]/.test(file)), 'The parent imported the compiler.');
  noCompiler();
  async function run(name, database, action) {
    const directory = path.join(output, name); await mkdir(directory); await mkdir(path.join(directory, 'data'));
    await writeFile(path.join(directory, 'data/loredock.db'), database, { flag: 'wx' });
    const row = { name, inputSha256: hash(database), began: performance.now() }; cases.push(row); event('case-start', { name });
    const store = activeStore = new CatalogStore(path.join(directory, 'data')), catalog = activeCatalog = new Catalog(store);
    const beforeThreads = threads.length; assert.equal(catalog.parser.snapshot().owner, null);
    try { row.comparison = await action(catalog, directory); noCompiler(); }
    finally {
      row.beforeStop = catalog.parser.snapshot(); await catalog.stop(); row.afterStop = catalog.parser.snapshot(); store.close();
      activeCatalog = undefined; activeStore = undefined;
      assert.equal(row.afterStop.active, false); assert(!row.afterStop.owner?.owned);
      row.threads = threads.slice(beforeThreads).map(item => ({ ...item })); assert(row.threads.length <= 1);
      assert(row.threads.every(item => item.exited)); row.ended = performance.now();
      save(name + '/result.json', row); event('case-end', { name });
    }
  }
  const baseline = new URL('../../docs/fixtures/loredock-async-legacy/baseline/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', baseline), 'utf8'));
  async function original(name) {
    const entry = manifest.files.find(row => row.path === name); assert(entry);
    const bytes = await readFile(new URL(name, baseline)); assert.equal(hash(bytes), entry.gzipSha256);
    const raw = gunzipSync(bytes); assert.equal(raw.length, entry.bytes); assert.equal(hash(raw), entry.sha256); return raw;
  }
  assert.deepEqual(manifest.plan.order, ownedPlan.legacyCases);
  for (const name of ownedPlan.legacyCases) {
    const expected = JSON.parse((await original(name + '/expected.json.gz')).toString());
    await run(name, await original(name + '/loredock.db.gz'), async (catalog, directory) => {
      if (name.startsWith('saved-')) {
        const actual = await observation.savedObservation(catalog); assert.equal(actual.length, expected.length);
        for (let i = 0; i < actual.length; i++) {
          const { lexical: before, ...old } = expected[i], { lexical: after, ...current } = actual[i];
          assert.equal(JSON.stringify(current), JSON.stringify(old));
          assert.equal(after.originalBytes, before.originalBytes); assert.equal(after.originalReads, before.originalReads);
          assert.equal(after.rejectedUnits, 0); assert(after.sqlRows > before.sqlRows);
          assert.equal(after.acceptedUnits - before.acceptedUnits, after.sqlRows - before.sqlRows);
        }
        await writeFile(path.join(directory, 'actual.json'), JSON.stringify(actual), { flag: 'wx' });
        return { exact: true, savedReadsAndReplays: actual.length, modelCalls: 0 };
      }
      const { correctionRequests = [], reapplications = [], ...old } = expected;
      const actual = await observation.projectionObservation(catalog); assert.equal(JSON.stringify(actual), JSON.stringify(old));
      for (const { input, output } of correctionRequests) assert.equal(JSON.stringify(await new Corrections(catalog).save(input)), JSON.stringify(output));
      for (const { input, output } of reapplications) assert.equal(JSON.stringify(await new Reconciliation(catalog).reapply(input)), JSON.stringify(output));
      await writeFile(path.join(directory, 'actual.json'), JSON.stringify(actual), { flag: 'wx' });
      return { exact: true, projectionSha256: hash(JSON.stringify(actual)), correctionReplays: correctionRequests.length, reapplications: reapplications.length };
    });
  }
  const transportRecord = JSON.parse(await readFile(path.join(transport, 'run/result.json'), 'utf8'));
  assert.deepEqual(transportRecord.cases.map(row => row.id), ownedPlan.transportCases);
  for (const row of transportRecord.cases) {
    const source = path.join(transport, 'run', row.id), content = await readFile(path.join(source, 'source', row.input.path), 'utf8');
    const facts = await readFile(path.join(source, 'direct-facts.json'), 'utf8'), graph = await readFile(path.join(source, 'direct-graph.json'), 'utf8');
    assert.equal(hash(content), row.input.sha256); assert.equal(hash(facts), row.direct.factsHash); assert.equal(hash(graph), row.direct.graphHash);
    await run('transport-' + row.id, await readFile(path.join(source, 'data/loredock.db')), async (catalog, directory) => {
      const lease = catalog.parser.acquire('foreground', { deadline: performance.now() + ownedPlan.operationMs });
      let actual;
      try { actual = await lease.parse(row.input.path, content); } finally { await lease.release(); }
      assert.equal(JSON.stringify(actual), facts); assert.deepEqual(factRanges(content, actual), factRanges(content, JSON.parse(facts)));
      const generation = catalog.parser.snapshot().owner.generation, projected = JSON.stringify(await codeFlows(catalog));
      assert.equal(projected, graph); assert.equal(catalog.parser.snapshot().owner.generation, generation);
      await writeFile(path.join(directory, 'facts.json'), JSON.stringify(actual), { flag: 'wx' });
      await writeFile(path.join(directory, 'graph.json'), projected, { flag: 'wx' });
      await copyFile(path.join(source, 'source', row.input.path), path.join(directory, 'source.txt'));
      return { exact: true, factsSha256: hash(facts), graphSha256: hash(graph), sameGeneration: true };
    });
  }
  assert.equal(cases.length, 11); assert.equal(cases.reduce((sum, row) => sum + (row.comparison.savedReadsAndReplays ?? 0), 0), 21);
} catch (error) { failure = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; event('failure', failure); }
finally {
  if (activeCatalog) { try { await activeCatalog.stop(); activeStore.close(); } catch (error) { failure ??= { name: error.name, message: error.message }; } }
  clearInterval(timer); sample(); workers.Worker = OriginalWorker; syncBuiltinESMExports();
  const survivors = threads.filter(row => !row.exited).map(row => row.threadId);
  save('result.json', { candidate: process.env.OWNED_PARSER_CANDIDATE ?? null, node: process.versions.node, began, ended: performance.now(),
    processCpu: process.cpuUsage(cpu), resourceUsage: process.resourceUsage(), cases, failure, threads, survivors,
    resourceQualification: false, coverage: 'Worker lifetime and process RSS/CPU diagnostics only. Heap, complete startup, near-limit and browser bounds remain unqualified.',
    modelCalls: 0, corporateSources: 0, reservedFamilyReads: 0 });
  if (failure || survivors.length) process.exitCode = 1;
}
