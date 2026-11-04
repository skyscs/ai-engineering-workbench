import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { services } from './services.mjs';
import { runNativeWorker } from './run.mjs';
import { normalized } from './io.mjs';
try {
  const [root, arm, configuration, caseId, ...extra] = process.argv.slice(2);
  assert.ok(extra.length === 0 && path.isAbsolute(configuration) && /^(0|[1-9]\d{0,3})$/.test(caseId));
  assert.deepEqual(process.execArgv, []); const module = await import(pathToFileURL(configuration).href);
  const { report, exitCode } = await runNativeWorker({ root, arm, config: module.configuration(Number(caseId)), services });
  console.log(JSON.stringify({ arm, operations: report.operations.length, errors: report.errors.length }));
  if (exitCode) console.error(JSON.stringify({ errors: report.errors, operations: report.operations.filter(row => row.error || row.blocked) }));
  process.exitCode = exitCode;
} catch (error) { console.error(JSON.stringify(normalized(error))); process.exitCode = 1; }
