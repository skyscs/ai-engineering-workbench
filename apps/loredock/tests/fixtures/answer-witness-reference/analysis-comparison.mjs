import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { runtimeImports, relocateSource } from '../integration-reference/compile.mjs';
import { verifyAnswerStorageDelta } from './verify.mjs';

/** Normal regression adapter only. The frozen experiment and all raw traces stay intact. */
export async function loadAnalysisComparison(folder) {
  await verifyAnswerStorageDelta('store', false);
  const original = new URL('../../../../../scripts/loredock-analysis-write-candidate/compare.mjs', import.meta.url);
  let source = await readFile(original, 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'), 'fb25522d7ed7002c5c88fdb1a74f92cb89fde9ffff0aab7eef9e27c85fd31ac3');
  const before = "assert.deepEqual(executions(pair.arms[1]), executions(pair.arms[0]), scenario + ' changes actual SQL executions');";
  const after = `const added = [], candidateExecutions = executions(pair.arms[1]).map(rows => rows.filter(row => {
        if (row.sha256 !== '270216d36e6b6f85bf184a0de568154a6ffb9b2a6cbdf7a1633c9a5627d66aa7') return true;
        added.push(row); return false;
      }));
      assert.deepEqual(added, scenario === 'revoke' ? [{
        sha256: '270216d36e6b6f85bf184a0de568154a6ffb9b2a6cbdf7a1633c9a5627d66aa7',
        get: 0, all: 0, iterate: 0, run: 1, exec: 0, executionErrors: 0, execErrors: 0
      }] : [], 'Only the declared schema-11 witness purge may add one SQL execution.');
      pair.additionalSchema11Purge = added;
      assert.deepEqual(candidateExecutions, executions(pair.arms[0]), scenario + ' changes other actual SQL executions');`;
  assert.equal(source.split(before).length, 2); source = source.replace(before, after);
  const imports = Object.fromEntries(runtimeImports(source).filter(row => row.name.startsWith('.'))
    .map(row => [row.name, new URL(row.name, original).href]));
  const target = pathToFileURL(folder + '/comparison-with-witness-purge.mjs');
  await writeFile(target, relocateSource(source, imports), { flag: 'wx' });
  return (await import(target.href)).compareAnalysisWrites;
}
