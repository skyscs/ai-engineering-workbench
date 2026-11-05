import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { components, plan } from './plan.mjs';
import { controls, inputFor, references, question } from '../loredock-partial-inventory/inputs.mjs';
import { observe } from '../loredock-partial-inventory/observe.mjs';
import { materialize, repository, save, normalized, journal } from '../loredock-prepared-flow/io.mjs';
import { assessDaemonSamples } from '../loredock-prepared-flow/cold-warm-cases.mjs';

async function component(id, directory) {
  await mkdir(directory);
  const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(directory, name + '.log'), 'wx', 0o600));
  const args = ['--import', path.join(repository, 'scripts/loredock-prepared-flow/monitor.mjs'),
    path.join(repository, 'scripts/loredock-cold-start/component.mjs'), id];
  const env = { PATH: process.env.PATH, LC_ALL: 'C', AEW_FLOW_OUTPUT: directory };
  const child = spawn(process.execPath, args, { cwd: repository, env, detached: true, stdio: ['ignore', ...descriptors] });
  for (const descriptor of descriptors) closeSync(descriptor);
  let spawnError = null, timedOut = false;
  const finished = new Promise(resolve => {
    child.once('error', error => { spawnError = normalized(error); });
    child.once('close', (code, signal) => resolve({ code, signal, spawnError, timedOut }));
  });
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }, 10000);
  let exit;
  try {
    await save(path.join(directory, 'process.json'), { executable: process.execPath, args, env, pid: child.pid ?? null });
    exit = await finished;
  } finally { clearTimeout(timer); }
  await save(path.join(directory, 'exit.json'), exit);
  assert.deepEqual(exit, { code: 0, signal: null, spawnError: null, timedOut: false });
  const raw = await readFile(path.join(directory, 'memory-timer.jsonl'), 'utf8'); assert(raw.endsWith('\n'));
  const samples = raw.trimEnd().split('\n').map(JSON.parse), metrics = assessDaemonSamples(samples);
  const timing = JSON.parse(await readFile(path.join(directory, 'import.json'), 'utf8')); assert.equal(timing.id, id);
  return { id, timing, metrics, firstIntervalMs: samples[1].gapMs,
    maximumGapIsFirstInterval: samples[1].gapMs === metrics.measured.rawIntervalGapMs, resourceQualification: false };
}

const output = process.argv[2];
assert.equal(process.argv.length, 3); assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output); const log = journal(path.join(output, 'sequence.jsonl'));
const result = { production: null, components: [], errors: [], resourceQualification: false, modelCalls: 0, reservedFamilyReads: 0 };
try {
  await save(path.join(output, 'plan.json'), plan); log.append({ event: 'started', order: plan.order });
  const directory = path.join(output, 'production'); await mkdir(directory);
  const { corpus, expected } = inputFor('completed'), sources = await materialize(path.join(directory, 'sources'), corpus);
  await save(path.join(directory, 'sources.json'), sources);
  result.production = await observe({ directory: path.join(directory, 'case'), control: controls[0], corpus, sources, expected, references, question });
  log.append({ event: 'production-finished', functionalPassed: result.production.functionalPassed });
  assert.deepEqual(result.production.errors, []); assert.equal(result.production.functionalPassed, true);
  for (const id of components) {
    log.append({ event: 'component-started', id });
    result.components.push(await component(id, path.join(output, id)));
    log.append({ event: 'component-finished', id });
  }
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'result.json'), result);
  log.append({ event: 'finished', errors: result.errors, resourceQualification: false }); log.close();
}
console.log(JSON.stringify({ errors: result.errors, productionFunctionalPassed: result.production?.functionalPassed,
  productionMetrics: result.production?.metrics, components: result.components }, null, 2));
