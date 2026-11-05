import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { services } from './loredock-native-qualification/services.mjs';
import { corpusFactory } from './loredock-native-assessment/fixture.mjs';
import { receiptFixture } from './loredock-receipt-fixture.mjs';
import { QuestionPreparations } from '../apps/loredock/dist/question-preparation.js';
import { Answers } from '../apps/loredock/dist/answers.js';
import { createApp } from '../apps/loredock/dist/app.js';

export const preparedQuestion = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
export function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
/** Ordinary owned sources and an explicit test-only runtime. No model process. */
export async function preparedQuestionFixture({ native = true, checkpoint } = {}) {
  const parent = await mkdtemp(path.join(tmpdir(), 'prepared-question-api-')), corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const fixture = await receiptFixture(parent, corpus, services);
  const runtime = { prepares: 0, calls: 0, closed: 0, requests: [], entered: deferred(), hold: deferred(),
    async prepare(connection) {
      this.prepares++;
      return { identity: { ...connection, version: 'owned-browser-runtime', policyVersion: 'owned-policy', configurationFingerprint: 'owned' },
        run: async request => {
          this.calls++; this.requests.push(request); this.entered.resolve(); if (this.block) await this.hold.promise;
          return { text: JSON.stringify({ claims: [{ kind: 'fact', text: 'The indexed original describes the permit flow. <script>window.answerInjected=true</script>',
            evidenceIds: [this.citation ?? request.schema.properties.claims.items.properties.evidenceIds.items.enum[0]] }], unknowns: ['What behavior is deployed?'] }),
          usage: { inputTokens: 80, outputTokens: 20, cachedInputTokens: 0 }, usageUnknownReason: null };
        }, close: async () => { this.closed++; } };
    } };
  let preparations = new QuestionPreparations(fixture.analysis, { checkpoint }), answers = new Answers(fixture.catalog, runtime, preparations);
  const stopConsumers = async () => { runtime.hold.resolve(); await answers.stop(); await preparations.stop(); };
  try {
    if (native) await fixture.analyze();
    await answers.configure({ executable: process.execPath, configHome: parent, profile: null });
    return { parent, fixture, runtime, get preparations() { return preparations; }, get answers() { return answers; },
      app: (enabled = true, extra = {}) => createApp(fixture.catalog, { answers, ...enabled ? { preparations } : {}, ...extra }),
      restart: async () => { await stopConsumers(); await fixture.restart();
        preparations = new QuestionPreparations(fixture.analysis, { checkpoint }); answers = new Answers(fixture.catalog, runtime, preparations); },
      close: async () => { await stopConsumers(); await fixture.close(); await rm(parent, { recursive: true, force: true }); } };
  } catch (error) { await stopConsumers(); await fixture.close(); await rm(parent, { recursive: true, force: true }); throw error; }
}

export async function questionClient(app) {
  const origin = 'http://127.0.0.1:4244', session = await app.request(origin + '/api/session', {
    method: 'POST', headers: { host: '127.0.0.1:4244', origin, 'x-loredock-client': 'web' } });
  const { token } = await session.json(), cookie = session.headers.get('set-cookie').split(';')[0];
  const request = (url, method = 'GET', body, headers = {}) => app.request(origin + '/api' + url, { method,
    headers: { host: '127.0.0.1:4244', origin, cookie, 'content-type': 'application/json', 'x-loredock-csrf': token, ...headers },
    ...body === undefined ? {} : { body: JSON.stringify(body) } });
  return { request, token, cookie };
}
