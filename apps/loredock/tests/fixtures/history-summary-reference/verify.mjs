import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { emitSource } from '../integration-reference/compile.mjs';
import { beforeAsyncLegacy } from '../async-legacy-reference/verify.mjs';

const sourcePath = 'apps/loredock/src/answers.ts';
const hash = value => createHash('sha256').update(value).digest('hex');
export async function beforeHistorySummary(file, raw) {
  if (file !== sourcePath && file !== 'apps/loredock/dist/answers.js') return raw;
  raw = await beforeAsyncLegacy(file, raw);
  const source = await readFile(new URL('./answers.ts.txt', import.meta.url), 'utf8');
  assert.equal(hash(source), '817842dbc10f4dcc830760e4dfd9dc344e73595cc5b8d6a4d32eed6a06570cca');
  const expected = source.replace("import { randomUUID } from 'node:crypto';",
    "import { randomUUID } from 'node:crypto';\nimport { answerSummaries } from './answer-history.js';")
    .replace('export interface AnswerAttempt {', "export interface AnswerAttempt {\n  inputValidation?: 'metadata-only';")
    .replace("this.catalog.store.all<{ id: string }>('SELECT id FROM answer_attempts ORDER BY rowid DESC LIMIT 20').map(row => this.get(row.id, false))",
      'answerSummaries(this.catalog)');
  assert.equal((await beforeAsyncLegacy(sourcePath, await readFile(new URL('../../../src/answers.ts', import.meta.url)))).toString(), expected,
    'Only the declared summary import, result marker and list call may change. Full reads and dispatch remain exact.');
  if (file === sourcePath) { assert.equal(raw.toString(), expected); return Buffer.from(source); }
  const emitted = await readFile(new URL('./answers.js.txt', import.meta.url));
  assert.equal(hash(emitted), 'feeb251083b5f99026e1f77eb2f2d2b90916e821f459fe88bf7a964cdcb3c56a');
  assert.equal(emitSource(source, sourcePath), emitted.toString());
  assert.equal(raw.toString(), emitSource(expected, sourcePath));
  return emitted;
}
