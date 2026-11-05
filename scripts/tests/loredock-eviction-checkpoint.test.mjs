import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inventory } from '../loredock-prepared-flow/io.mjs';
import { inventoryEviction } from '../loredock-prepared-flow/inventory-eviction-case.mjs';

test('resource eviction rejects inherited faults, unclassified history and changed input before launch', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-eviction-checkpoint-'));
  t.diagnostic('Retained eviction-checkpoint test: ' + root);
  const data = path.join(root, 'checkpoint'); await mkdir(data);
  await writeFile(path.join(data, 'input.txt'), 'Owned original checkpoint.');
  const checkpoint = { data, files: await inventory(data), kind: 'cold-catalog', lane: 'resource', storage: { rows: 0 } };
  for (const [name, override] of [['fault', { lane: 'fault' }], ['unclassified', { kind: undefined }],
    ['history', { storage: { rows: 1 } }]]) {
    const directory = path.join(root, name);
    await assert.rejects(inventoryEviction({ directory, checkpoint: { ...checkpoint, ...override }, question: 'Owned control.' }));
    await assert.rejects(stat(directory), error => error.code === 'ENOENT');
  }
  await writeFile(path.join(data, 'input.txt'), 'Changed checkpoint.');
  const directory = path.join(root, 'changed');
  const result = await inventoryEviction({ directory, checkpoint, question: 'Owned control.' });
  assert(result.errors.length > 0); assert.deepEqual(result.segments, []); assert.equal(result.resourceSubsetPassed, false);
  assert(!(await readFile(path.join(directory, 'journal.jsonl'), 'utf8')).includes('launch-started'));
  await assert.rejects(stat(path.join(directory, 'controlled')), error => error.code === 'ENOENT');
  assert.equal(await readFile(path.join(data, 'input.txt'), 'utf8'), 'Changed checkpoint.');
});
