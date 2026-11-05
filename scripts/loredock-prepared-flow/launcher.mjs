// Controlled bootstrap: same services/app/ordering as the accepted index.js; only TextRuntime is replaced.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { Answers } from '../../apps/loredock/dist/answers.js';
import { QuestionPreparations } from '../../apps/loredock/dist/question-preparation.js';
import { CodeAnalysis } from '../../apps/loredock/dist/code-analysis.js';
import { CodeAnalysisFollow } from '../../apps/loredock/dist/code-analysis-follow.js';
import { CodePathsV2 } from '../../apps/loredock/dist/code-paths-v2.js';
import { NativeCaptures } from '../../apps/loredock/dist/native-capture.js';
import { createApp } from '../../apps/loredock/dist/app.js';

const { serve } = createRequire(new URL('../../apps/loredock/package.json', import.meta.url))('@hono/node-server');
const directory = process.env.AEW_FLOW_OUTPUT;
if (!path.isAbsolute(directory ?? '') || !path.isAbsolute(process.env.LOREDOCK_DATA_DIR ?? '')
  || process.env.LOREDOCK_ANSWERS !== '1' || process.env.LOREDOCK_PREPARED_ANSWERS !== '1') throw new Error('Explicit owned prepared-flow settings are required.');
const stats = { prepares: 0, calls: 0, closed: 0 };
const gates = new Map();
const wait = name => gates.get(name)?.promise;
const runtime = {
  async prepare(connection) {
    stats.prepares++; await wait('prepare');
    return { identity: { ...connection, version: 'owned-controlled-runtime', policyVersion: 'owned-model-free', configurationFingerprint: 'owned' },
      async run(request) {
        const call = ++stats.calls;
        await writeFile(path.join(directory, `request-${call}.json`), JSON.stringify({ prompt: request.prompt, schema: request.schema, model: request.model, effort: request.effort }), { flag: 'wx' });
        await wait('provider');
        const evidenceId = request.schema.properties.claims.items.properties.evidenceIds.items.enum[0];
        const output = { text: JSON.stringify({ claims: [{ kind: 'fact', text: 'The supplied original is a source passage.', evidenceIds: [evidenceId] }],
          unknowns: ['What behavior is deployed?'] }), usage: { inputTokens: 80, outputTokens: 20, cachedInputTokens: 0 }, usageUnknownReason: null };
        await writeFile(path.join(directory, `output-${call}.json`), JSON.stringify(output), { flag: 'wx' }); return output;
      }, async close() { stats.closed++; } };
  }
};
const store = new CatalogStore(process.env.LOREDOCK_DATA_DIR), catalog = new Catalog(store);
const codeAnalysis = new CodeAnalysis(catalog), codeFollow = new CodeAnalysisFollow(codeAnalysis);
const codePaths = new CodePathsV2(codeAnalysis), nativeCaptures = new NativeCaptures(codeAnalysis, { paths: codePaths });
codeFollow.start();
const preparations = new QuestionPreparations(codeAnalysis), answers = new Answers(catalog, runtime, preparations);
const app = createApp(catalog, { publicDir: fileURLToPath(new URL('../../apps/loredock/public/', import.meta.url)), development: false,
  codeAnalysis, codeFollow, codePaths, nativeCaptures, preparations, answers });
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4244 });
server.on('listening', () => console.log('LoreDock listening on http://127.0.0.1:4244'));
let closing = false;
async function shutdown() {
  if (closing) return; closing = true; server.close();
  for (const gate of gates.values()) gate.resolve(); gates.clear();
  codeFollow.stop(); await answers.stop(); await preparations.stop();
  await nativeCaptures.stop(); await codePaths.stop(); await codeAnalysis.stop(); await catalog.stop(); store.close();
  await writeFile(path.join(directory, 'runtime-stats.json'), JSON.stringify(stats), { flag: 'wx' });
  if (process.connected) process.disconnect();
}
server.on('error', error => { console.error(`LoreDock could not listen (${error.code ?? 'UNKNOWN'}). Check port 4244.`); void shutdown().finally(() => { process.exitCode = 1; }); });
process.once('SIGINT', () => { void shutdown(); }); process.once('SIGTERM', () => { void shutdown(); });
process.on('message', message => {
  try {
    let result;
    if (message.name === 'stats') result = { ...stats };
    else {
      if (process.env.AEW_FLOW_FAULTS !== '1') throw new Error('Fault controls are disabled in the resource bootstrap.');
      const name = message.parameters.gate;
      if (!['prepare', 'provider'].includes(name)) throw new Error('Unknown controlled runtime gate.');
      if (message.name === 'hold') {
        if (gates.has(name)) throw new Error('Runtime gate is already held.');
        let resolve; const promise = new Promise(done => { resolve = done; }); gates.set(name, { promise, resolve }); result = { held: name };
      } else if (message.name === 'release') { gates.get(name)?.resolve(); gates.delete(name); result = { released: name }; }
      else throw new Error('Unknown controlled runtime command.');
    }
    process.send?.({ id: message.id, result });
  } catch (error) { process.send?.({ id: message.id, error: { name: error.name, message: error.message } }); }
});
