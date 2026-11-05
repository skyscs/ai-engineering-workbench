import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { journal, until, save, normalized, repository, hash } from './io.mjs';
import { registerOwnedProcess } from './ownership.mjs';
import { sampleProcessTree } from './process-tree.mjs';
import { sanitized, browserBody } from './browser-evidence.mjs';
export { sanitized } from './browser-evidence.mjs';

async function connect(url, onEvent) {
  const socket = new WebSocket(url); let next = 0;
  const pending = new Map();
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data), waiting = pending.get(value.id);
    if (!waiting) { if (value.method) onEvent(value); return; }
    pending.delete(value.id); clearTimeout(waiting.timer);
    if (value.error) waiting.reject(new Error(value.error.message)); else waiting.resolve(value.result);
  });
  socket.addEventListener('close', () => { for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser protocol socket closed.')); } pending.clear(); });
  return { close: () => socket.close(), send: (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next, timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser protocol timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  }) };
}
// Real built UI, with passive browser observations. Fault interception belongs to a separate lane.
export async function browser({ directory, executable = '/usr/bin/google-chrome' }) {
  await mkdir(directory);
  const events = journal(path.join(directory, 'events.jsonl')), memory = journal(path.join(directory, 'process-tree.jsonl'));
  const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(directory, 'collector-' + name + '.log'), 'wx', 0o600));
  const args = ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0',
    `--user-data-dir=${path.join(directory, 'profile')}`, 'about:blank'];
  const env = { PATH: process.env.PATH, LC_ALL: 'C', ...process.env.HOME ? { HOME: process.env.HOME } : {},
    XDG_CONFIG_HOME: path.join(directory, 'xdg-config'), XDG_CACHE_HOME: path.join(directory, 'xdg-cache') };
  const lifetimeDirectory = path.join(directory, 'lifetime');
  const collectorArgs = ['-I', '-S', '-B', path.join(repository, 'scripts/loredock-prepared-flow/browser-lifetime.py'),
    '--executable', executable, '--output', lifetimeDirectory, '--parent-pid', String(process.pid), '--', ...args];
  const child = spawn('python3', collectorArgs, { env, detached: true, stdio: ['ignore', ...descriptors] }); descriptors.forEach(closeSync);
  let ended = false, protocol, memoryTimer, inSample, sampleError, maxRssBytes = 0, maxPending = 0, stopped, closing = false;
  let rootStartedTicks, memorySamples = 0, incompleteMemorySamples = 0;
  const requests = new Map(), responseTasks = new Set(), errors = [], listeners = new Set();
  const exit = new Promise(resolve => {
    child.once('error', error => { errors.push(normalized(error)); });
    child.once('close', (code, signal) => { ended = true; resolve({ code, signal }); });
  });
  async function sample() {
    if (inSample) return;
    inSample = sampleProcessTree(child.pid, rootStartedTicks).then(row => {
      rootStartedTicks ??= row.rows.find(value => value.pid === child.pid)?.startedTicks;
      memorySamples++; if (!row.complete) incompleteMemorySamples++;
      maxRssBytes = Math.max(maxRssBytes, row.rssBytes); memory.append(row);
    }).catch(error => { sampleError = normalized(error); });
    try { await inSample; } finally { inSample = null; }
  }
  const stop = () => stopped ??= (async () => {
    closing = true;
    try { await until(() => requests.size === 0 && responseTasks.size === 0, 'Browser response journal did not drain.', 5000); }
    catch (error) { errors.push(normalized(error)); }
    if (protocol && !ended) try {
      const observation = await protocol.send('Runtime.evaluate', { expression: 'window.preparedFlowObservation', returnByValue: true });
      assert(!observation.exceptionDetails && observation.result.value);
      await save(path.join(directory, 'observation.json'), observation.result.value);
    } catch (error) { errors.push(normalized(error)); }
    if (protocol && !ended) try { await protocol.send('Browser.close'); } catch (error) { events.append({ event: 'browser-close', error: normalized(error) }); }
    protocol?.close();
    // Let a normal browser exit reach its collector before requesting forced cleanup.
    if (!ended) {
      let timer;
      try { await Promise.race([exit, new Promise(resolve => { timer = setTimeout(resolve, 1000); })]); }
      finally { clearTimeout(timer); }
    }
    if (!ended) try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') errors.push(normalized(error)); }
    const timer = setTimeout(() => { if (!ended) try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') errors.push(normalized(error)); } }, 16000);
    let outcome;
    try { outcome = await exit; } finally { clearTimeout(timer); }
    clearInterval(memoryTimer); if (inSample) await inSample;
    let lifetime;
    try {
      lifetime = JSON.parse(await readFile(path.join(lifetimeDirectory, 'result.json'), 'utf8'));
      assert.deepEqual(lifetime.errors, []); assert.deepEqual(lifetime.survivors, []);
      assert.equal(lifetime.reason, 'completed'); assert.equal(lifetime.driverExit.exit, 0);
    } catch (error) { errors.push(normalized(error)); }
    const result = { ...outcome, maxRssBytes, maxPending, memorySamples, incompleteMemorySamples, sampleError: sampleError ?? null, errors,
      lifetime: lifetime ?? null, memoryScope: 'Browser lifetime collector and its kernel-owned descendants; collector overhead is included.' };
    await save(path.join(directory, 'exit.json'), result);
    events.close(); memory.close(); return result;
  })();
  try {
    await registerOwnedProcess(child, directory, 'browser');
    await save(path.join(directory, 'process.json'), { executable, args, env, pid: child.pid,
      collector: { executable: 'python3', args: collectorArgs }, removedJournalFields: ['cookie', 'set-cookie', 'x-loredock-csrf', 'token'] });
    await sample(); memoryTimer = setInterval(() => { void sample(); }, 100); memoryTimer.unref();
    const endpoint = await until(async () => {
      if (ended) throw new Error('Browser exited before debugging endpoint.');
      try { return (await readFile(path.join(lifetimeDirectory, 'stderr.log'), 'utf8')).match(/DevTools listening on (ws:\/\/\S+)/)?.[1]; }
      catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
    }, 'Browser debugging endpoint unavailable.');
    const host = new URL(endpoint).host, targets = await (await fetch(`http://${host}/json/list`)).json();
    protocol = await connect(targets.find(row => row.type === 'page').webSocketDebuggerUrl, message => {
      events.append({ event: 'protocol', value: sanitized(message) });
      if (message.method === 'Runtime.exceptionThrown') errors.push(sanitized(message.params));
      if (message.method === 'Network.requestWillBeSent' && !closing) { requests.set(message.params.requestId, message.params.request.url); maxPending = Math.max(maxPending, requests.size); }
      if (['Network.loadingFinished', 'Network.loadingFailed'].includes(message.method)) {
        const id = message.params.requestId, url = requests.get(id); requests.delete(id);
        if (url?.startsWith('http://127.0.0.1:4244/api/') && message.method === 'Network.loadingFinished') {
          const task = protocol.send('Network.getResponseBody', { requestId: id }).then(async body => {
            const evidence = browserBody(body, url), file = 'raw-response-' + hash(id) + '.json';
            await writeFile(path.join(directory, file), evidence.retained, { flag: 'wx' });
            await save(path.join(directory, 'response-' + id.replaceAll('.', '-') + '.json'), evidence.value);
            events.append({ event: 'api-body', requestId: id, file, ...evidence.metadata });
          }).catch(error => { errors.push(normalized(error)); }).finally(() => responseTasks.delete(task));
          responseTasks.add(task);
        }
      }
      for (const listener of listeners) listener(message);
    });
    await protocol.send('Page.enable'); await protocol.send('Network.enable'); await protocol.send('Runtime.enable');
    await protocol.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.preparedFlowObservation={longTasks:[],paints:[],updates:[],actions:[],pendingPaints:0};
      (()=>{const observation=window.preparedFlowObservation; let pendingUpdate=false;
        function painted(kind,started) { observation.pendingPaints++; requestAnimationFrame(()=>requestAnimationFrame(()=>{
          observation[kind].push({started,painted:performance.now(),duration:performance.now()-started,visible:document.visibilityState==='visible'});
          observation.pendingPaints--; if(kind==='updates')pendingUpdate=false;
        })); }
        new MutationObserver(()=>{if(!pendingUpdate){pendingUpdate=true;painted('updates',performance.now());}})
          .observe(document,{subtree:true,childList:true,characterData:true,attributes:true});
        document.addEventListener('click',()=>painted('actions',performance.now()),true);
        new PerformanceObserver(list=>{for(const item of list.getEntries())observation.longTasks.push({startTime:item.startTime,duration:item.duration});})
          .observe({type:'longtask',buffered:true});
      })();` });
    const evaluate = async expression => {
      const value = await protocol.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert(!value.exceptionDetails, value.exceptionDetails?.exception?.description); return value.result.value;
    };
    await protocol.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
    await protocol.send('Page.navigate', { url: 'http://127.0.0.1:4244' });
    await until(() => evaluate("document.body.innerText.includes('Experimental prepared context')"), 'Prepared question UI did not load.');
    return { pid: child.pid, evaluate, protocol, stop, errors,
      listen(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      async idleWindow(name, milliseconds) {
        assert(/^[a-z0-9-]+$/.test(name) && Number.isSafeInteger(milliseconds) && milliseconds > 0 && milliseconds <= 600000);
        const routes = {}, pending = new Map(), responses = [];
        let apiRequests = 0, concurrent = requests.size;
        const startObservation = await evaluate('window.preparedFlowObservation');
        const listener = message => {
          const value = message.params;
          if (message.method === 'Network.requestWillBeSent') {
            concurrent = Math.max(concurrent, requests.size);
            if (value.request.url.startsWith('http://127.0.0.1:4244/api/')) {
              const route = new URL(value.request.url).pathname; apiRequests++; routes[route] = (routes[route] ?? 0) + 1;
              pending.set(value.requestId, { route, started: value.timestamp });
            }
          }
          if (['Network.loadingFinished', 'Network.loadingFailed'].includes(message.method) && pending.has(value.requestId)) {
            const row = pending.get(value.requestId); pending.delete(value.requestId);
            responses.push({ ...row, durationMs: (value.timestamp - row.started) * 1000, failed: message.method === 'Network.loadingFailed' });
          }
        };
        const began = performance.now(); listeners.add(listener); events.append({ event: 'idle-window-start', name, now: began, milliseconds });
        try { await new Promise(resolve => setTimeout(resolve, milliseconds)); }
        finally { listeners.delete(listener); }
        const elapsedMs = performance.now() - began;
        events.append({ event: 'idle-window-end', name, now: performance.now() });
        const endObservation = await evaluate('window.preparedFlowObservation');
        const result = { name, elapsedMs, apiRequests, requestsPerSecond: apiRequests / (elapsedMs / 1000), routes, maxConcurrentRequests: concurrent,
          pendingAtEnd: [...pending.values()], responses, longTasks: endObservation.longTasks.slice(startObservation.longTasks.length),
          paints: endObservation.paints, sampledProcessTreeRssBytes: maxRssBytes, resourceQualified: false };
        await save(path.join(directory, name + '-window.json'), result); return result;
      },
      async prepare(question) {
        await evaluate(`(()=>{const element=document.getElementById('project-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(element,${JSON.stringify(question)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`);
        await until(() => evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Find context'&&!b.disabled)"), 'Find context did not enable.');
        await evaluate("(()=>{const started=performance.now();[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Find context').click();requestAnimationFrame(()=>requestAnimationFrame(()=>window.preparedFlowObservation.paints.push(performance.now()-started)));})()");
        await until(() => evaluate("document.querySelector('.question-context')!==null&&[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Generate answer'&&!b.disabled)"), 'Browser context did not become ready.', 6000);
      },
      async snapshot(name) {
        const value = await evaluate('({observation:window.preparedFlowObservation,text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth})');
        await save(path.join(directory, name + '.json'), value);
        const capture = await protocol.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(path.join(directory, name + '.png'), Buffer.from(capture.data, 'base64'), { flag: 'wx' }); return value;
      } };
  } catch (error) { try { await stop(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Browser startup and cleanup failed.'); } throw error; }
}
