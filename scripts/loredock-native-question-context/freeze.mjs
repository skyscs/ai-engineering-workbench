import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { identity, repository, sealPath, sha256, jsonFile } from './identity.mjs';

// Authoring only. No source factory or candidate is imported/executed. The exclusive
// output refuses replacing a final seal, including after a failed observed attempt.
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: repository, encoding: 'utf8' }).trim(), '');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
const paths = execFileSync('git', ['ls-files'], { cwd: repository, encoding: 'utf8' }).trim().split('\n');
const prefixes = ['scripts/loredock-native-question-context/', 'fixtures/loredock-native-question-context-run/control/',
  'apps/loredock/tests/fixtures/native-before-analysis-writes/'];
const explicit = [
  'scripts/tests/loredock-question-selection.test.mjs', 'docs/loredock/NATIVE_QUESTION_CONTEXT_RUN.md',
  'fixtures/loredock-native-question-context-run/protocol.json', 'fixtures/loredock-native-question-context/freeze.json',
  'scripts/loredock-native-qualification/runtime.mjs', 'scripts/loredock-native-qualification/state.mjs', 'scripts/loredock-native-qualification/services.mjs',
  'scripts/loredock-capture-memory/fixture.mjs', 'scripts/loredock-receipt-fixture.mjs',
  'scripts/loredock-native-assessment/fixture.mjs', 'scripts/loredock-native-assessment/codec.mjs', 'scripts/loredock-native-assessment/projection.mjs', 'scripts/loredock-native-assessment/schema.mjs',
  'scripts/loredock-qualification-assessment/content.mjs', 'scripts/loredock-qualification-assessment/codec.mjs',
  'scripts/loredock-capture-scale/budget.mjs', 'scripts/loredock-literal-topics/topic.mjs',
  'docs/fixtures/loredock-native-worker-ownership/raw/report.json.gz', 'apps/loredock/tests/fixtures/integration-reference/compile.mjs',
];
for (const file of explicit) assert(paths.includes(file));
const selected = paths.filter(file => explicit.includes(file) || prefixes.some(prefix => file.startsWith(prefix))).sort(), files = {};
for (const file of selected) files[file] = sha256(await readFile(path.join(repository, file)));
const runtime = await identity(), control = await jsonFile('fixtures/loredock-native-question-context-run/control/manifest.json');
assert.deepEqual(runtime.core, control.runtime);
const frozen = { schemaVersion: 'native-question-context-executable-freeze/1', status: 'prospective-unexecuted', head,
  operations: 44, modelAttempts: 0, files, runtime, protocol: 'One owned worker, 300000 ms watchdog, exclusive output and no reserved retry.' };
await writeFile(path.join(repository, sealPath), JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ head, files: selected.length, core: Object.keys(runtime.core.modules).length, composed: Object.keys(runtime.composed.modules).length }));
