// Ten ordinary model-free prerequisites; never import or observe a reserved family.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { materialize, launch, client, save, inventory, normalized, journal } from './io.mjs';
import { indexSources, prepare } from './flow.mjs';
import { assessPreview } from './assess.mjs';
import { ordinaryCorpus, ordinaryCases, ordinaryReferences, ordinaryNote } from './ordinary-oracles.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
try {
  for (const expected of ordinaryCases) {
    const directory = path.join(output, expected.id), data = path.join(directory, 'data');
    await mkdir(directory);
    const result = { id: expected.id, errors: [], preparations: 0 };
    report.cases.push(result); log.append({ event: 'started', id: expected.id });
    let daemon, api, store, catalog;
    try {
      const corpus = ordinaryCorpus(expected.variant), sources = await materialize(path.join(directory, 'sources'), corpus);
      await save(path.join(directory, 'sources.json'), sources);
      await save(path.join(directory, 'oracle.json'), { expected, references: ordinaryReferences, engineerNote: ordinaryNote });
      // Validate every required development quote before candidate indexing/retrieval.
      for (const name of expected.requiredOriginals) {
        const reference = ordinaryReferences[name]; assert(corpus[reference.source][reference.path].includes(reference.quote));
      }
      if (expected.setup === 'catalog-only') {
        store = new CatalogStore(data); catalog = new Catalog(store);
        for (const source of sources.paths) await catalog.addSource(source);
        const project = store.project(), build = catalog.start(randomUUID(), project.sourceSetVersion, project.policyVersion);
        await catalog.idle(); result.build = store.build(build.id);
        assert.equal(result.build.status, 'completed'); assert(result.build.published);
        assert.equal(store.one('SELECT count(*) n FROM code_analyses').n, 0);
        await catalog.stop(); catalog = undefined; store.close(); store = undefined;
        await save(path.join(directory, 'stopped-before-production.json'), await inventory(data));
      }
      daemon = await launch({ directory: path.join(directory, 'production'), data });
      api = await client(path.join(directory, 'http'));
      if (expected.setup !== 'catalog-only') result.index = await indexSources(api, sources.paths);
      else {
        await new Promise(resolve => setTimeout(resolve, 1100));
        assert.deepEqual((await api.request('/code-analysis')).value, { inventories: [], pendingBuildId: null, automaticError: null });
      }
      if (expected.setup === 'engineer-note') {
        const projection = (await api.request('/code-flows')).value, overlay = (await api.request('/corrections')).value;
        const edges = projection.edges.filter(edge => {
          const from = projection.nodes.find(node => node.id === edge.from), to = projection.nodes.find(node => node.id === edge.to);
          return edge.kind === 'http-target' && from.sourceName === 'a-permit-ui' && from.path === 'ui/request.ts'
            && to.sourceName === 'b-permit-api' && to.path === 'routes.json';
        });
        assert.equal(edges.length, 1); assert(edges[0].headerCheck);
        const originals = [];
        for (const id of edges[0].evidenceIds) originals.push((await api.request('/evidence/' + id)).value);
        for (const key of ['request', 'header']) {
          const reference = ordinaryReferences[key];
          assert(originals.some(row => row.sourceName === reference.source && row.path === reference.path && row.text.includes(reference.quote)));
        }
        result.note = (await api.request('/corrections', 'POST', { requestId: randomUUID(), buildId: projection.buildId,
          targetKind: 'code-link', targetId: edges[0].id, projectionHash: projection.inputHash, expectedRevision: overlay.revision,
          expectedPreviousId: null, action: ordinaryNote.action, statement: ordinaryNote.text, environment: ordinaryNote.environment })).value;
        result.noteTarget = { edge: edges[0], originals };
        assert.equal(result.note.provenance, 'human'); assert.equal(result.note.verification, 'unverified');
      }
      result.preparations++;
      const prepared = await prepare(api, expected.question);
      // Keep the actual review even if an independent prerequisite assertion fails.
      result.review = prepared.review;
      result.assessment = assessPreview(prepared.review, { corpus, sources, expected, references: ordinaryReferences, engineerNote: ordinaryNote });
      if (expected.setup === 'catalog-only') {
        assert.equal(prepared.review.context.buildId, result.build.id);
        assert.deepEqual((await api.request('/code-analysis')).value, { inventories: [], pendingBuildId: null, automaticError: null });
      }
      assert.equal((await api.request('/answers')).value.attempts.length, 0);
    } catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
    finally {
      try { if (catalog) await catalog.stop(); store?.close(); } catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
      api?.close();
      try { if (daemon) { result.exit = await daemon.stop(); assert.equal(result.exit.code, 0); } }
      catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
      await save(path.join(directory, 'result.json'), result);
      log.append({ event: 'finished', id: expected.id, failed: result.errors.length > 0 });
    }
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report); log.close();
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => ({ id: row.id, errors: row.errors, preparations: row.preparations, assessment: row.assessment })) }, null, 2));
