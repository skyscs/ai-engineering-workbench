import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runDiagnostic } from './run.mjs';

// This internal launcher executes a trusted, owned configuration module, never source text.
try {
  const [sizeRoot, arm, configuration, ...extra] = process.argv.slice(2);
  assert.ok(extra.length === 0 && configuration && path.isAbsolute(configuration), 'Supply an absolute trusted configuration module.');
  const { config } = await import(pathToFileURL(configuration).href);
  const { report, exitCode } = await runDiagnostic({ ...config, sizeRoot, arm });
  console.log(JSON.stringify({ arm, operations: report.operations.length, errors: report.errors.length }));
  if (exitCode) console.error(JSON.stringify({ errors: report.errors,
    operations: report.operations.filter(row => row.error || row.observerError || row.blocked) }));
  process.exitCode = exitCode;
} catch (error) {
  console.error(JSON.stringify({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }));
  process.exitCode = 1;
}
