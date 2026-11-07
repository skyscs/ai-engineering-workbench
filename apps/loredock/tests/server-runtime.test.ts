import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { TextRuntime } from '@aew/ai';
import { LoreDockServer } from '../src/server.js';
import { CatalogStore } from '../src/store.js';

function health(port: number) {
  return new Promise<{ modelExecution: boolean; codeAnalysis: boolean }>((resolve, reject) => {
    const request = get({ hostname: '127.0.0.1', port, path: '/api/health', headers: { host: '127.0.0.1:4244' }, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; if (body.length > 4096) response.destroy(new Error('Health response exceeds its bound.')); });
      response.on('error', reject); response.on('end', () => { try { assert.equal(response.statusCode, 200); resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('Health request timed out.')));
  });
}

for (const mode of [{ name: 'disabled', answers: false, preparedAnswers: false },
  { name: 'ordinary answers', answers: true, preparedAnswers: false },
  { name: 'prepared answers', answers: true, preparedAnswers: true }]) {
  test(`the internal runtime dependency preserves ${mode.name} startup and actual shutdown`, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'loredock-runtime-owner-')); let prepares = 0;
    const textRuntime: TextRuntime = { async prepare() { prepares++; throw new Error('Startup must not prepare a model.'); } };
    const server = new LoreDockServer({ directory, port: 0, answers: mode.answers, preparedAnswers: mode.preparedAnswers, textRuntime });
    t.after(async () => { await server.stop(); await rm(directory, { recursive: true, force: true }); });
    const starting = server.start(); assert.equal(server.start(), starting);
    const port = await starting;
    assert.equal(server.catalog.parser.snapshot().owner?.state, 'ready');
    assert.deepEqual(await health(port), { service: 'loredock', version: '0.1.0', modelExecution: mode.answers, codeAnalysis: true });
    assert.equal(prepares, 0);
    const stopping = server.stop(); assert.equal(server.stop(), stopping); await stopping;
    assert.equal(server.catalog.parser.snapshot().owner?.owned, false);
    const reopened = new CatalogStore(directory); reopened.close(); assert.equal(prepares, 0);
  });
}

test('injected runtime does not bypass startup cancellation or parser readiness failure', async t => {
  for (const failure of [false, true]) {
    const directory = await mkdtemp(path.join(tmpdir(), 'loredock-runtime-start-')); let prepares = 0;
    const server = new LoreDockServer({ directory, port: 0, answers: true, preparedAnswers: true,
      textRuntime: { async prepare() { prepares++; throw new Error('Unexpected dispatch.'); } } });
    try {
      if (failure) t.mock.method(server.catalog.parser, 'warm', async () => { throw new Error('Synthetic parser readiness failure.'); });
      const starting = server.start(); void starting.catch(() => undefined);
      if (failure) await assert.rejects(starting, /Synthetic parser readiness failure/);
      else await server.stop();
      await assert.rejects(starting); await server.stop();
      assert.equal(prepares, 0); assert.equal(server.catalog.parser.snapshot().active, false);
      assert.equal(server.catalog.parser.snapshot().owner?.owned ?? false, false);
      const reopened = new CatalogStore(directory); reopened.close();
    } finally { await server.stop(); await rm(directory, { recursive: true, force: true }); }
  }
});
