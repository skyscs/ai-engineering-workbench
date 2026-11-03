import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runProfileWorker } from './worker.mjs';
import { normalizedError } from './sample.mjs';

try {
  const [root, role, configuration, ...extra] = process.argv.slice(2);
  assert.ok(extra.length === 0 && configuration && path.isAbsolute(configuration));
  const { config } = await import(pathToFileURL(configuration).href);
  const { report, exitCode } = await runProfileWorker({ root, role, config });
  console.log(JSON.stringify({ role, errors: report.errors.length, profileValid: report.profileValid }));
  if (exitCode) console.error(JSON.stringify(report.errors));
  process.exitCode = exitCode;
} catch (error) { console.error(JSON.stringify(normalizedError(error))); process.exitCode = 1; }
