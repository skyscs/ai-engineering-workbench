// Ordinary first-preflight observations through actual HTTP mutations. No models.
// A missed or ambiguous boundary is retained as incomplete, never retried into a pass.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources, prepare } from './flow.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-preflight-observation/1', cases: [], errors: [], modelCalls: 0,
  reservedFamilyReads: 0, resourceQualification: false };
let daemon, api;
async function stop() {
  api?.close(); api = undefined;
  if (daemon) { const owned = daemon; daemon = undefined; const exit = await owned.stop(); assert.equal(exit.code, 0); }
}
async function start(directory, data, controlled) {
  daemon = await launch({ directory: path.join(directory, 'daemon'), data, controlled, fault: controlled });
  api = await client(path.join(directory, 'http'));
}
const base = path.join(output, 'base-data');
try {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  await start(output, base, false); await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  await stop();
  const baseTree = await inventory(base);
  for (const kind of ['review', 'policy', 'build']) {
    const entry = { kind, errors: [], observedFirstPreflight: false }; report.cases.push(entry);
    const directory = path.join(output, kind), data = path.join(directory, 'data');
    await mkdir(directory); await cp(base, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), baseTree);
    try {
      await start(directory, data, true);
      const prepared = await prepare(api, 'How does apply reach PermitWriter.onMessage through permit.granted.v3?');
      const project = (await api.request('/project')).value;
      let route, method, payload;
      if (kind === 'review') {
        const projection = (await api.request('/code-flows')).value, review = (await api.request('/corrections')).value;
        const link = projection.edges[0]; assert(link);
        route = '/corrections'; method = 'POST';
        payload = { requestId: randomUUID(), buildId: project.publishedBuildId, targetKind: 'code-link', targetId: link.id,
          projectionHash: projection.inputHash, expectedRevision: review.revision, expectedPreviousId: null, action: 'clarify',
          statement: 'Owned unverified preflight observation; deployment remains unknown.', environment: 'owned-development' };
      } else if (kind === 'policy') {
        route = '/policy'; method = 'PUT'; payload = { excludedPaths: ['owned-excluded-path'] };
      } else {
        route = '/builds'; method = 'POST';
        payload = { requestId: randomUUID(), sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion };
      }
      // This hold only prevents dispatch if the first boundary has already been missed.
      // A zero prepare count proves the hold itself was never reached.
      await daemon.command('hold', { gate: 'prepare' });
      const admitted = (await api.request('/prepared-answers', 'POST', { requestId: randomUUID(),
        preparationId: prepared.review.id, reviewedHash: prepared.review.reviewedHash })).value;
      entry.admitted = admitted;
      entry.mutation = (await api.request(route, method, payload)).value;
      entry.afterMutation = (await api.request('/answers/' + admitted.id)).value;
      entry.runtimeAtMutation = await daemon.command('stats');
      if (kind === 'build') {
        entry.buildAtAnswerObservation = (await api.request('/builds/' + entry.mutation.id)).value;
        entry.publishedBuild = await until(async () => {
          const value = (await api.request('/builds/' + entry.mutation.id)).value;
          if (['preparing', 'running'].includes(value.status)) return false;
          assert.equal(value.status, 'completed'); assert(value.published); return value;
        }, 'Replacement source build did not publish.', 15000, 100);
      }
      await daemon.command('release', { gate: 'prepare' });
      entry.terminal = await until(async () => {
        const value = (await api.request('/answers/' + admitted.id)).value;
        return ['preparing', 'running'].includes(value.status) ? false : value;
      }, 'The answer did not reach a terminal state.');
      entry.runtime = await daemon.command('stats');
      assert.equal(entry.terminal.answer, null); assert.notEqual(entry.terminal.status, 'succeeded');
      assert.equal(entry.runtime.calls, 0);
      entry.observedFirstPreflight = kind !== 'build' && entry.runtime.prepares === 0;
      entry.limitation = kind === 'build'
        ? 'Starting a build writes before publication. This observation cannot attribute the first fence to a changed published build.'
        : entry.runtime.prepares ? 'The first runtime preflight had already started; this only observes a later fence.' : null;
      if (!entry.observedFirstPreflight) process.exitCode = 1;
    } catch (error) { entry.errors.push(normalized(error)); process.exitCode = 1; }
    finally {
      try { await stop(); } catch (error) { entry.errors.push(normalized(error)); process.exitCode = 1; }
      await save(path.join(directory, 'stopped-tree.json'), await inventory(data));
    }
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
