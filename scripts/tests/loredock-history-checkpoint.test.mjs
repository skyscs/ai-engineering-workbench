import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { inventory } from '../loredock-prepared-flow/io.mjs';
import { stoppedHistoryCheckpoint, witnessStorage } from '../loredock-prepared-flow/history-cases.mjs';

test('stopped history checkpoints include read-only SQLite side effects before freezing bytes', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-history-checkpoint-'));
  t.diagnostic('Retained history-checkpoint test: ' + directory);
  const data = path.join(directory, 'data'), snapshot = path.join(directory, 'snapshot');
  await mkdir(data);
  const database = new DatabaseSync(path.join(data, 'loredock.db'));
  try {
    database.exec('PRAGMA journal_mode=WAL; CREATE TABLE answer_witnesses (purged INTEGER, witness TEXT); INSERT INTO answer_witnesses VALUES (0, \'owned\');');
  } finally { database.close(); }
  const before = await inventory(data);
  assert(!Object.hasOwn(before, 'loredock.db-shm'));
  const checkpoint = await stoppedHistoryCheckpoint(data, snapshot);
  assert.deepEqual(checkpoint.storage, { rows: 1, purged: 0, bytes: 5 });
  assert(Object.hasOwn(checkpoint.files, 'loredock.db-shm'), 'Control must expose read-only SQLite side effects.');
  assert.deepEqual(checkpoint.files, await inventory(snapshot));
  assert.deepEqual(checkpoint.files, await inventory(data));
  witnessStorage(data);
  assert.deepEqual(await inventory(snapshot), checkpoint.files, 'Further working-tree reads must not touch the stopped copy.');
});
