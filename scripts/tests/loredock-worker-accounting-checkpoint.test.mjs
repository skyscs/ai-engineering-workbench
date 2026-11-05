import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inventory } from '../loredock-prepared-flow/io.mjs';
import { accountWorker } from '../loredock-prepared-flow/worker-accounting-case.mjs';

test('worker accounting refuses fault/history inputs, later references and changed checkpoints before launch', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-worker-accounting-checkpoint-'));
  t.diagnostic('Retained worker-accounting checkpoint test: ' + root);
  const data = path.join(root, 'checkpoint'); await mkdir(data);
  await writeFile(path.join(data, 'input.txt'), 'Owned original checkpoint.');
  const checkpoint = { data, files: await inventory(data), kind: 'cold-catalog', lane: 'resource', storage: { rows: 0 } };
  for (const [name, override, ordinaryReference] of [
    ['fault', { lane: 'fault' }, {}], ['unclassified', { kind: undefined }, {}],
    ['history', { storage: { rows: 1 } }, {}], ['later-reference', {}, { repetition: 2 }],
  ]) {
    const directory = path.join(root, name);
    const result = await accountWorker({ directory, checkpoint: { ...checkpoint, ...override }, question: 'Owned control.', ordinaryReference });
    assert(result.errors.length > 0); assert.equal(result.outputParity, undefined);
    await assert.rejects(stat(path.join(directory, 'diagnostic')), error => error.code === 'ENOENT');
    await assert.rejects(stat(path.join(directory, 'data')), error => error.code === 'ENOENT');
  }
  await writeFile(path.join(data, 'input.txt'), 'Changed checkpoint.');
  const directory = path.join(root, 'changed');
  const result = await accountWorker({ directory, checkpoint, ordinaryReference: { repetition: 1 }, question: 'Owned control.' });
  assert(result.errors.length > 0); assert.equal(result.outputParity, undefined);
  await assert.rejects(stat(path.join(directory, 'diagnostic')), error => error.code === 'ENOENT');
  await assert.rejects(stat(path.join(directory, 'data')), error => error.code === 'ENOENT');
  assert.equal(await readFile(path.join(data, 'input.txt'), 'utf8'), 'Changed checkpoint.');
});
