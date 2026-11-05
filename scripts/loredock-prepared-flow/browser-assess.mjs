// Independent checks of retained browser bytes, observations and process evidence; no new browser work.
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { hash } from './io.mjs';
import { assessHttpRecords } from './http-assess.mjs';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
const apiPrefix = 'http://127.0.0.1:4244/api/';
const finite = value => assert(Number.isFinite(value) && value >= 0);

export async function assessBrowserApi({ events, readBody, lane }) {
  const requests = new Map(), active = new Set(), bodies = new Map(), windows = new Map();
  let maxPending = 0, currentWindow;
  for (const event of events) {
    if (event.event === 'idle-window-start') {
      assert(/^[a-z0-9-]+$/.test(event.name));
      assert(!currentWindow && !windows.has(event.name)); finite(event.now); finite(event.milliseconds);
      currentWindow = { name: event.name, began: event.now, declaredMs: event.milliseconds, requests: 0 };
      windows.set(event.name, currentWindow);
    }
    if (event.event === 'idle-window-end') {
      assert(currentWindow && currentWindow.name === event.name); finite(event.now);
      currentWindow.elapsedMs = event.now - currentWindow.began; assert(currentWindow.elapsedMs > 0); currentWindow = undefined;
    }
    if (event.event === 'api-body') {
      assert(!bodies.has(event.requestId)); bodies.set(event.requestId, event); continue;
    }
    if (event.event !== 'protocol') continue;
    const { method, params } = event.value, id = params.requestId;
    if (method === 'Network.requestWillBeSent') {
      assert(!active.has(id), 'Redirect/reused network identity is not complete independent evidence.');
      active.add(id); maxPending = Math.max(maxPending, active.size);
      if (params.request.url.startsWith(apiPrefix)) {
        assert(!requests.has(id)); finite(params.timestamp);
        requests.set(id, { id, url: params.request.url, method: params.request.method, began: params.timestamp });
        if (currentWindow) currentWindow.requests++;
      }
    }
    const request = requests.get(id);
    if (method === 'Network.responseReceived' && request) {
      assert(!request.response); request.response = params.response;
    }
    if (['Network.loadingFinished', 'Network.loadingFailed'].includes(method)) {
      active.delete(id);
      if (request) {
        assert(!request.terminal); finite(params.timestamp); assert(params.timestamp >= request.began);
        request.terminal = { method, timestamp: params.timestamp, errorText: params.errorText };
      }
    }
  }
  const converted = [], retained = new Map(), incomplete = [];
  if (currentWindow) incomplete.push('Unclosed idle window.');
  if (active.size) incomplete.push('Network requests remain pending.');
  let index = 0;
  for (const request of requests.values()) {
    const id = String(++index).padStart(5, '0'), route = new URL(request.url).pathname.slice(4);
    converted.push({ event: 'request', id, route, method: request.method });
    const body = bodies.get(request.id);
    if (!request.terminal || request.terminal.method === 'Network.loadingFailed' || !request.response || !body) {
      converted.push({ event: 'failure', id, error: { message: request.terminal?.errorText ?? 'Missing terminal response or retained browser API bytes.' } });
      continue;
    }
    assert.equal(body.url, request.url); assert.equal(body.file, 'raw-response-' + hash(request.id) + '.json');
    assert(Number.isSafeInteger(body.bytes) && body.bytes >= 0);
    const raw = await readBody(body.file); assert(Buffer.isBuffer(raw));
    assert.equal(raw.length, body.retainedBytes); assert.equal(hash(raw), body.retainedSha256);
    assert.equal(body.redacted, route === '/session');
    if (body.redacted) {
      assert.equal(body.rawSha256, null); assert.equal(JSON.parse(raw.toString('utf8')).token, '[removed-session-token]');
    } else { assert.equal(raw.length, body.bytes); assert.equal(hash(raw), body.rawSha256); }
    retained.set(id, raw);
    converted.push({ event: 'response', id, status: request.response.status, bytes: body.bytes,
      elapsedMs: (request.terminal.timestamp - request.began) * 1000 });
  }
  for (const id of bodies.keys()) assert(requests.has(id), 'Body evidence has no observed API request.');
  const http = await assessHttpRecords({ events: converted, lane, readBody: async id => retained.get(id) });
  return { http, incomplete, maxPending, pendingAtEnd: active.size, requests: requests.size, bodies: bodies.size,
    windows: [...windows.values()], resourceQualification: false };
}

export async function assessRecordedBrowser({ directory, processDirectory, lane }) {
  for (const target of [directory, processDirectory]) assert(path.isAbsolute(target) && await realpath(target) === target);
  const json = async file => JSON.parse(await readFile(file, 'utf8'));
  const lines = async file => {
    const raw = await readFile(file, 'utf8'); assert(raw.endsWith('\n'), 'Truncated browser journal.');
    return raw.trimEnd().split('\n').map(JSON.parse);
  };
  const daemon = await json(path.join(processDirectory, 'process.json')), daemonExit = await json(path.join(processDirectory, 'exit.json'));
  for (const flag of ['controlled', 'accounting', 'fault']) assert.equal(typeof daemon[flag], 'boolean');
  assert(!(daemon.accounting && daemon.fault)); assert.equal(lane, daemon.fault ? 'fault' : daemon.accounting ? 'accounting' : 'resource');
  const process = await json(path.join(directory, 'process.json')), exit = await json(path.join(directory, 'exit.json'));
  const observation = await json(path.join(directory, 'observation.json'));
  const events = await lines(path.join(directory, 'events.jsonl')), samples = await lines(path.join(directory, 'process-tree.jsonl'));
  const api = await assessBrowserApi({ events, lane, readBody: async file => {
    const target = path.join(directory, file); assert.equal(await realpath(target), target); return readFile(target);
  } });
  const result = { lane, status: 'incomplete', checks: [], incomplete: [...api.incomplete], api,
    timingQualified: lane === 'resource', resourceQualification: false, modelEligibility: false };
  const check = (metric, value, limit) => { finite(value); result.checks.push({ metric, value, limit, passed: value <= limit }); };
  if (daemonExit.code !== 0 || daemonExit.signal !== null || daemonExit.spawnError !== null) result.incomplete.push('Daemon lifetime is incomplete.');
  if (exit.code !== 0 || exit.signal !== null || exit.sampleError || exit.errors.length || exit.lifetime?.reason !== 'completed'
      || exit.lifetime?.driverExit?.exit !== 0 || exit.lifetime.errors.length || exit.lifetime.survivors.length) result.incomplete.push('Browser lifetime is incomplete.');
  assert.equal(samples.length, exit.memorySamples); assert(samples.length >= 2);
  let maxRss = 0, incompleteSamples = 0, maxSampleGapMs = 0;
  for (const [index, sample] of samples.entries()) {
    finite(sample.began); finite(sample.at); assert(sample.at >= sample.began);
    if (index) { assert(sample.began >= samples[index - 1].at); maxSampleGapMs = Math.max(maxSampleGapMs, sample.began - samples[index - 1].began); }
    assert(sample.rows.some(row => row.pid === process.pid));
    if (!sample.complete) incompleteSamples++;
    let rss = 0;
    for (const row of sample.rows) {
      if (!row.complete || row.issues.length) assert(!sample.complete);
      if (row.rssBytes !== undefined) { finite(row.rssBytes); rss += row.rssBytes; }
      if (row.complete) for (const key of ['startedTicks', 'userTicks', 'systemTicks']) assert.match(row[key], /^\d+$/);
    }
    assert.equal(rss, sample.rssBytes); maxRss = Math.max(maxRss, rss);
  }
  assert.equal(maxRss, exit.maxRssBytes); assert.equal(incompleteSamples, exit.incompleteMemorySamples);
  if (incompleteSamples) result.incomplete.push('Incomplete process-tree samples: ' + incompleteSamples);
  // The frozen qualification document requires browser sampling at most every 100 ms.
  check('browserSampleGapMs', maxSampleGapMs, 100);
  check('browserProcessTreeRssBytes', maxRss, thresholds.browserProcessTreeRssBytes);
  check('browserConcurrentRequests', api.maxPending, thresholds.browserConcurrentRequests);
  for (const key of ['longTasks', 'updates', 'actions']) assert(Array.isArray(observation[key]));
  if (!observation.actions.length || !observation.updates.length || observation.pendingPaints !== 0) result.incomplete.push('Missing or pending action/update paint observations.');
  for (const row of observation.longTasks) { finite(row.startTime); finite(row.duration); }
  check('browserMainThreadTaskMs', Math.max(0, ...observation.longTasks.map(row => row.duration)), thresholds.browserMainThreadTaskMs);
  for (const kind of ['actions', 'updates']) {
    for (const row of observation[kind]) {
      finite(row.started); finite(row.painted); finite(row.duration); assert(row.painted >= row.started);
      if (!row.visible) result.incomplete.push('Paint observation was not visible.');
    }
    check('browserActionPaintMs:' + kind, Math.max(0, ...observation[kind].map(row => row.duration)), thresholds.browserActionPaintMs);
  }
  if (!api.windows.length) result.incomplete.push('No idle polling window.');
  for (const window of api.windows) {
    const recorded = await json(path.join(directory, window.name + '-window.json'));
    assert.equal(recorded.apiRequests, window.requests); assert.equal(recorded.name, window.name);
    finite(recorded.elapsedMs); assert(recorded.elapsedMs >= window.declaredMs);
    if (window.declaredMs !== 30000 || !window.elapsedMs) result.incomplete.push('The required 30-second idle window is incomplete.');
    check('browserIdleRequestsPerSecondMean:' + window.name, recorded.apiRequests / (recorded.elapsedMs / 1000), thresholds.browserIdleRequestsPerSecondMean);
  }
  result.observed = { samples: samples.length, incompleteSamples, maxSampleGapMs, actions: observation.actions.length,
    updates: observation.updates.length, longTasks: observation.longTasks.length,
    cpuEvidence: 'Raw per-PID process ticks and wait4 usage are retained; they are not summed into an invented exclusive process-tree CPU total.' };
  result.status = result.incomplete.length || api.http.status === 'incomplete' ? 'incomplete' : lane !== 'resource' ? 'observed'
    : api.http.status === 'failed' || result.checks.some(row => !row.passed) ? 'failed' : 'passed';
  return result;
}
