import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from '../loredock-native-qualification/services.mjs';
import { CatalogStore } from '../../apps/loredock/tests/fixtures/analysis-write-reference/store.compiled.mjs';
import { CodeAnalysis } from '../../apps/loredock/tests/fixtures/analysis-write-reference/code-analysis.compiled.mjs';
import { compareAnalysisWrites } from './compare.mjs';
import { hash } from '../loredock-capture-memory/fixture.mjs';
import { runtimeIdentity } from '../loredock-native-qualification/runtime.mjs';
import { normalized } from '../loredock-native-qualification/io.mjs';
import { runNativeQualification } from '../loredock-native-qualification/coordinator.mjs';
import { configuration } from '../loredock-native-qualification/development.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_ANALYSIS_WRITE_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); await mkdir(output);
const report = { schemaVersion: 'compiled-analysis-write-candidate/1', node: process.version, resourceQualification: false, modelRequests: 0,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), errors: [] };
try {
  assert.equal(process.execArgv.length, 0); assert.ok(!process.env.NODE_OPTIONS);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the candidate before the compiled regression.');
  report.runtime = await runtimeIdentity();
  const directory = new URL('../../apps/loredock/tests/fixtures/analysis-write-reference/', import.meta.url);
  const bytes = await readFile(new URL('manifest.json', directory)), manifest = JSON.parse(bytes);
  report.controlManifest = hash(bytes);
  for (const record of Object.values(manifest.sources)) assert.equal(hash(await readFile(new URL(record.compiledModule, directory))), record.compiledModuleSha256);
  const behavior = await compareAnalysisWrites(path.join(output, 'behavior'), { ...services, CatalogStore, CodeAnalysis }, services);
  report.behavior = { failed: behavior.failed, scenarios: behavior.scenarios.map(row => ({ name: row.name, passed: row.passed ?? false })),
    repeatedWrites: behavior.scenarios[0]?.repeatedWrites ?? null };
  assert.equal(behavior.failed, false, JSON.stringify(behavior.errors));
  const native = await runNativeQualification({ output: path.join(output, 'native'), config: configuration(0), caseId: 0,
    configuration: fileURLToPath(new URL('../loredock-native-qualification/development.mjs', import.meta.url)) });
  report.native = native.summary; assert.equal(native.summary.functionalFailed, false, JSON.stringify(native.errors));
  report.completed = true;
} catch (error) { report.errors.push(normalized(error)); }
report.failed = !report.completed || report.errors.length > 0;
await writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report)); process.exitCode = report.failed ? 1 : 0;
