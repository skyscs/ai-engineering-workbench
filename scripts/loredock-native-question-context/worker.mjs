import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyFreeze, jsonFile, vector, sha256 } from './identity.mjs';
try {
  const [directory, ...extra] = process.argv.slice(2); assert.equal(extra.length, 0); assert(path.isAbsolute(directory)); assert.deepEqual(process.execArgv, []);
  const checked = await verifyFreeze(), start = JSON.parse(await readFile(path.join(directory, 'start.json'), 'utf8'));
  assert.equal(start.pid, process.ppid); assert.equal(start.sealHash, checked.sealHash);
  // The exclusive parent start and both byte preflights precede the sole reserved import.
  await writeFile(path.join(directory, 'factory-import.json'), JSON.stringify({ pid: process.pid, date: new Date().toISOString(), sealHash: checked.sealHash }) + '\n', { flag: 'wx' });
  const { corpusFactory } = await import('../../fixtures/loredock-native-question-context/corpus.mjs');
  for (const [variant, expected] of Object.entries(checked.normative.variants)) {
    const files = vector(corpusFactory(variant)); assert.deepEqual(files, expected.filesVector); assert.equal(sha256(JSON.stringify(files)), expected.vectorHash);
  }
  const oracle = await jsonFile('fixtures/loredock-native-question-context/questions.json');
  const ledger = await jsonFile('fixtures/loredock-native-question-context-run/protocol.json');
  const { runMatrix } = await import('./matrix.mjs');
  const result = await runMatrix(directory, corpusFactory, oracle, ledger);
  console.log(JSON.stringify({ observations: result.assessment.observed, pass: result.assessment.pass, errors: result.errors }));
  process.exitCode = result.assessment.pass ? 0 : 1;
} catch (error) { console.error(JSON.stringify({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack })); process.exitCode = 1; }
