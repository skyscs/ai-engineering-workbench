// One source-grounded prerequisite with caller-supplied inputs; no family or expected-result repair.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { launch, client, save, inventory, normalized, hash } from './io.mjs';
import { indexSources, prepare } from './flow.mjs';
import { assessPreview } from './assess.mjs';
import { oracleSetup } from './matrix-adapter.mjs';

export async function oracleCase({ directory, corpus, sources, expected, references, engineerNote, noteTarget }) {
  await mkdir(directory);
  const data = path.join(directory, 'data');
  const result = { id: expected.id, errors: [], assessmentErrors: [], preparations: 0, resourceQualification: false };
  let daemon, api, store, catalog;
  try {
    const setup = oracleSetup(expected);
    await save(path.join(directory, 'inputs.json'), { sources, expected, setup, references, engineerNote, noteTarget });
    // Check supplied materialized bytes and every required quote before candidate indexing/retrieval.
    const names = Object.keys(corpus);
    assert.equal(sources.paths.length, names.length);
    assert.equal(sources.originals.length, Object.values(corpus).reduce((sum, files) => sum + Object.keys(files).length, 0));
    for (const [index, name] of names.entries()) {
      assert.equal(path.basename(sources.paths[index]), name);
      for (const [file, text] of Object.entries(corpus[name])) {
        assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
        const rows = sources.originals.filter(row => row.source === name && row.path === file); assert.equal(rows.length, 1);
        const raw = await readFile(path.join(sources.paths[index], file));
        assert.equal(raw.toString('utf8'), text); assert.equal(raw.length, rows[0].bytes); assert.equal(hash(raw), rows[0].sha256);
      }
    }
    const required = [...expected.requiredOriginals, ...(setup === 'engineer-note' ? noteTarget.requiredOriginals : [])];
    for (const name of required) {
      const reference = references[name];
      assert(reference && corpus[reference.source]?.[reference.path]?.includes(reference.quote), 'Missing required source quote: ' + name);
    }
    if (setup === 'engineer-note') {
      assert(engineerNote && typeof engineerNote.text === 'string' && engineerNote.text.length > 0);
      assert.equal(noteTarget.kind, 'http-target');
      for (const side of ['from', 'to']) assert(corpus[noteTarget[side].source]?.[noteTarget[side].path]);
    }
    if (setup === 'catalog-only') {
      // Actual Catalog without CodeAnalysisFollow, stopped before the real daemon reopens it.
      store = new CatalogStore(data); catalog = new Catalog(store);
      for (const source of sources.paths) await catalog.addSource(source);
      const project = store.project(), build = catalog.start(randomUUID(), project.sourceSetVersion, project.policyVersion);
      await catalog.idle(); result.build = store.build(build.id);
      assert.equal(result.build.status, 'completed'); assert(result.build.published);
      assert.equal(store.one('SELECT count(*) n FROM code_analyses').n, 0);
      await catalog.stop(); catalog = undefined; store.close(); store = undefined;
      const snapshot = path.join(directory, 'catalog-only-checkpoint');
      await cp(data, snapshot, { recursive: true, force: false, errorOnExist: true });
      result.catalogOnlyCheckpoint = { data: snapshot, files: await inventory(snapshot) };
      assert.deepEqual(result.catalogOnlyCheckpoint.files, await inventory(data));
      await save(path.join(directory, 'catalog-only-checkpoint.json'), result.catalogOnlyCheckpoint);
    }
    daemon = await launch({ directory: path.join(directory, 'production'), data });
    api = await client(path.join(directory, 'http'));
    if (setup !== 'catalog-only') result.index = await indexSources(api, sources.paths);
    else {
      await new Promise(resolve => setTimeout(resolve, 1100));
      assert.deepEqual((await api.request('/code-analysis')).value, { inventories: [], pendingBuildId: null, automaticError: null });
    }
    if (setup === 'engineer-note') {
      const projection = (await api.request('/code-flows')).value, overlay = (await api.request('/corrections')).value;
      const edges = projection.edges.filter(edge => {
        const from = projection.nodes.find(node => node.id === edge.from), to = projection.nodes.find(node => node.id === edge.to);
        return edge.kind === noteTarget.kind && from?.sourceName === noteTarget.from.source && from?.path === noteTarget.from.path
          && to?.sourceName === noteTarget.to.source && to?.path === noteTarget.to.path;
      });
      assert.equal(edges.length, 1); assert(edges[0].headerCheck);
      const originals = [];
      for (const id of edges[0].evidenceIds) originals.push((await api.request('/evidence/' + id)).value);
      for (const key of noteTarget.requiredOriginals) {
        const reference = references[key];
        assert(originals.some(row => row.sourceName === reference.source && row.path === reference.path && row.text.includes(reference.quote)));
      }
      result.note = (await api.request('/corrections', 'POST', { requestId: randomUUID(), buildId: projection.buildId,
        targetKind: 'code-link', targetId: edges[0].id, projectionHash: projection.inputHash, expectedRevision: overlay.revision,
        expectedPreviousId: null, action: engineerNote.action, statement: engineerNote.text, environment: engineerNote.environment })).value;
      result.noteTarget = { edge: edges[0], originals };
      assert.equal(result.note.provenance, 'human'); assert.equal(result.note.verification, 'unverified');
    }
    result.preparations++;
    const prepared = await prepare(api, expected.question);
    result.review = prepared.review;
    if (setup === 'catalog-only') {
      assert.equal(prepared.review.context.buildId, result.build.id);
      assert.deepEqual((await api.request('/code-analysis')).value, { inventories: [], pendingBuildId: null, automaticError: null });
    }
    assert.equal((await api.request('/answers')).value.attempts.length, 0);
    // A failed required positive remains failed; a separate case may still inspect independent inputs.
    try { result.assessment = assessPreview(prepared.review, { corpus, sources, expected, references, engineerNote }); }
    catch (error) { result.assessmentErrors.push(normalized(error)); }
  } catch (error) { result.errors.push(normalized(error)); }
  finally {
    try { if (catalog) await catalog.stop(); } catch (error) { result.errors.push(normalized(error)); }
    try { store?.close(); } catch (error) { result.errors.push(normalized(error)); }
    api?.close();
    try { if (daemon) { result.exit = await daemon.stop(); assert.equal(result.exit.code, 0); } }
    catch (error) { result.errors.push(normalized(error)); }
    try {
      if (result.catalogOnlyCheckpoint) assert.deepEqual(await inventory(result.catalogOnlyCheckpoint.data), result.catalogOnlyCheckpoint.files);
    } catch (error) { result.errors.push(normalized(error)); }
    result.passed = result.errors.length === 0 && result.assessmentErrors.length === 0 && result.preparations === 1;
    await save(path.join(directory, 'result.json'), result);
  }
  return result;
}
