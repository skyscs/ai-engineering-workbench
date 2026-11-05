import assert from 'node:assert/strict';
import { mkdtemp, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { materialize, inventory } from '../loredock-prepared-flow/io.mjs';
import { oracleCase } from '../loredock-prepared-flow/oracle-case.mjs';

test('oracle inputs reject missing quotes and changed source bytes before opening a catalog', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-oracle-inputs-'));
  t.diagnostic('Retained oracle-input test: ' + root);
  const corpus = { 'a-owned-source': { 'README.md': '# Owned original\nNo requested quote is present.\n' } };
  const sources = await materialize(path.join(root, 'sources'), corpus);
  const common = { corpus, sources, expected: { id: 'owned-control', question: 'Owned question.', requiredOriginals: ['missing'] },
    references: { missing: { source: 'a-owned-source', path: 'README.md', quote: 'Absent required quotation.' } } };
  for (const name of ['missing-quote', 'changed-source']) {
    if (name === 'changed-source') await writeFile(path.join(sources.paths[0], 'README.md'), 'Changed source bytes.');
    const before = await inventory(path.join(root, 'sources')), directory = path.join(root, name);
    const result = await oracleCase({ ...common, directory });
    assert(result.errors.length > 0); assert.deepEqual(result.assessmentErrors, []);
    assert.equal(result.preparations, 0); assert.equal(result.passed, false);
    await assert.rejects(stat(path.join(directory, 'data')), error => error.code === 'ENOENT');
    await assert.rejects(stat(path.join(directory, 'production')), error => error.code === 'ENOENT');
    assert.deepEqual(await inventory(path.join(root, 'sources')), before);
  }
});
