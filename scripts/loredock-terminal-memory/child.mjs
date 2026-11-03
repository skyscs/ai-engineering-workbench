import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runTerminalMemoryWorker } from './run.mjs';

try {
  const [sizeRoot, configuration, sizeText, ...extra] = process.argv.slice(2);
  assert.ok(extra.length === 0 && configuration && path.isAbsolute(configuration));
  assert.ok(/^(0|[1-9]\d{0,3})$/.test(sizeText));
  const module = await import(pathToFileURL(configuration).href);
  const config = await module.configuration(Number(sizeText));
  const { report, exitCode } = await runTerminalMemoryWorker({ ...config, sizeRoot });
  console.log(JSON.stringify({ operations: report.operations.length, terminal: report.terminal.length, errors: report.errors }));
  process.exitCode = exitCode;
} catch (error) {
  console.error(JSON.stringify({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }));
  process.exitCode = 1;
}
