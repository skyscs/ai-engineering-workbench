// Ordinary real ten-minute expiry; no clock changes, TTL refresh, model or reserved input.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, save, inventory, normalized } from './io.mjs';
import { expiryCase } from './expiry-case.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-expiry-development/2', errors: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
try {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  report.case = await expiryCase({ directory: path.join(output, 'expiry'), sources,
    question: 'How does apply reach PermitWriter.onMessage through permit.granted.v3?' });
  if (report.case.errors.length) process.exitCode = 1;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true }));
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
