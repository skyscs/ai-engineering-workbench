import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { readSnapshot } from '../loredock-terminal-ownership/read.mjs';
import { summarizeSnapshot } from '../loredock-terminal-ownership/graph.mjs';

try {
  const [output, root, reference, selection, reduced, ...extra] = process.argv.slice(2);
  assert.ok(extra.length === 0 && path.isAbsolute(output) && path.isAbsolute(root));
  const limits = JSON.parse(reduced), bytes = await readSnapshot(root, JSON.parse(reference), limits);
  const summary = summarizeSnapshot(bytes, JSON.parse(selection), limits);
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary) + '\n', { flag: 'wx' });
} catch (error) {
  console.error(JSON.stringify({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }));
  process.exitCode = 1;
}
