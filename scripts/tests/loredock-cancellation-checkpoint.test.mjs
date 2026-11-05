import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inventory } from '../loredock-prepared-flow/io.mjs';
import { cancelHeldProvider, reopenInterrupted } from '../loredock-prepared-flow/cancellation-cases.mjs';

test('a changed stopped checkpoint cannot launch a cancellation worker or become a reopen input', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-cancellation-checkpoint-'));
  t.diagnostic('Retained cancellation-checkpoint test: ' + root);
  const data = path.join(root, 'checkpoint'); await mkdir(data);
  const file = path.join(data, 'retained.txt'); await writeFile(file, 'Original stopped input.');
  const checkpoint = { data, files: await inventory(data) };
  await writeFile(file, 'Changed stopped input.');
  const directory = path.join(root, 'case');
  const result = await cancelHeldProvider({ directory, checkpoint, question: 'Owned integrity control.' });
  assert(result.errors.some(error => error.message.includes('stopped input checkpoint changed')));
  assert.deepEqual(result.exits, []);
  await assert.rejects(stat(path.join(directory, 'controlled')), error => error.code === 'ENOENT');
  const events = (await readFile(path.join(directory, 'journal.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert(!events.some(row => row.event === 'launch-started'));
  assert.equal(await readFile(file, 'utf8'), 'Changed stopped input.');
  await assert.rejects(reopenInterrupted({ directory: path.join(root, 'reopen'), checkpoint: { ...checkpoint, kind: 'unverified' } }));
  await assert.rejects(stat(path.join(root, 'reopen')), error => error.code === 'ENOENT');
});
