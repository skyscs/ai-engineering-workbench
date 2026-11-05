// Ordinary subset rehearsal in matrix order. No reserved corpus, model or final gate.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, save, inventory, normalized, journal } from './io.mjs';
import { createHistory, browserHistory, reopenHistory, revokeHistory, accountHistory } from './history-cases.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const result = { errors: [], cases: [], qualification: false, reservedFamilyReads: 0, modelCalls: 0 };
async function run(name, operation) {
  log.append({ event: 'started', name });
  try { const value = await operation(); result.cases.push({ name, value }); log.append({ event: 'finished', name }); return value; }
  catch (error) { log.append({ event: 'failed', name, error: normalized(error) }); throw error; }
}
try {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  const capacity = await run('capacity', () => createHistory({ directory: path.join(output, 'capacity'), sources,
    question: 'How does apply reach PermitWriter.onMessage through permit.granted.v3?' }));
  for (const checkpoint of capacity.checkpoints) await run('browser-' + checkpoint.rows,
    () => browserHistory({ checkpoint, directory: path.join(output, 'browser-' + checkpoint.rows) }));
  for (const checkpoint of capacity.checkpoints) await run('restart-' + checkpoint.rows,
    () => reopenHistory({ checkpoint, directory: path.join(output, 'restart-' + checkpoint.rows) }));
  await run('revocation-64', () => revokeHistory({ checkpoint: capacity.checkpoints[1],
    directory: path.join(output, 'revocation-64'), sourceName: 'z-independent-notes' }));
  for (const checkpoint of capacity.checkpoints) await run('accounting-' + checkpoint.rows,
    () => accountHistory({ checkpoint, directory: path.join(output, 'accounting-' + checkpoint.rows) }));
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true })); }
  catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), result); log.close();
}
console.log(JSON.stringify({ errors: result.errors, completedCases: result.cases.map(row => row.name), qualification: false }, null, 2));
