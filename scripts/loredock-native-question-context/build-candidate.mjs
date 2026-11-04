import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runtimeImports, relocateSource } from '../../apps/loredock/tests/fixtures/integration-reference/compile.mjs';

// Authoring helper only: exact accepted control, two explicit deltas and import relocation.
// It never imports a corpus, starts an application, executes the candidate or edits production.
const root = fileURLToPath(new URL('../../', import.meta.url)), control = path.join(root, 'fixtures/loredock-native-question-context-run/control');
const hash = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(await readFile(path.join(control, 'manifest.json'), 'utf8'));
for (const [file, expected] of Object.entries(manifest.files)) {
  const bytes = await readFile(path.join(control, file)); assert.equal(bytes.length, expected.bytes); assert.equal(hash(bytes), expected.sha256);
}
const original = await readFile(path.join(control, 'code-paths-v2.js.txt'), 'utf8');
assert.equal(await readFile(path.join(root, 'apps/loredock/dist/code-paths-v2.js'), 'utf8'), original);
const edits = [
  { before: "        const graph = kind === 'paths' ? await admitPaths(resolution, this.limits, work, input.rootId) : null;",
    after: "        const selectedRoot = this.options.selectQuestionRoot ? await this.options.selectQuestionRoot(resolution, work) : input.rootId;\n        const graph = kind === 'paths' ? await admitPaths(resolution, this.limits, work, selectedRoot) : null;" },
  { before: 'identity, coverage, graph, selection: { rootId: input.rootId ?? null, offset }',
    after: 'identity, coverage, graph, selection: { rootId: selectedRoot ?? null, offset }' },
];
let candidate = original;
for (const { before, after } of edits) { assert.equal(candidate.split(before).length, 2); candidate = candidate.replace(before, after); }
const relocations = Object.fromEntries(runtimeImports(candidate).filter(row => row.name.startsWith('.'))
  .map(row => [row.name, '../../apps/loredock/dist/' + row.name.slice(2)]));
candidate = relocateSource(candidate, relocations);
const output = path.join(root, 'scripts/loredock-native-question-context/candidate-paths.mjs');
await writeFile(output, candidate, { flag: 'wx' });
await writeFile(path.join(root, 'scripts/loredock-native-question-context/candidate-manifest.json'), JSON.stringify({
  schemaVersion: 'native-question-path-candidate/1', controlSha256: hash(original), candidateSha256: hash(candidate), edits, relocations,
  purpose: 'Offline selection-only composition. It does not replace or qualify the production producer.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, controlSha256: hash(original), candidateSha256: hash(candidate), edits: edits.length }));
