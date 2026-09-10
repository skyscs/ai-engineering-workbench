import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Opt-in Linux browser acceptance. Requires a build, Chrome and a free port 4242.
// CDP reference: https://chromedevtools.github.io/devtools-protocol/
const fixture = await mkdtemp(path.join(tmpdir(), 'aew-workspace-smoke-'));
const daemonDir = fileURLToPath(new URL('../apps/daemon/', import.meta.url));
const children = [];
function start(command, args, cwd, env = process.env) {
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const record = { child, output: '', ended: false };
  record.exit = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => { record.ended = true; resolve(code); });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { record.output = (record.output + String(chunk)).slice(-16384); });
  children.push(record);
  return record;
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 30));
async function waitFor(check, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await check()) return; await pause(); }
  throw new Error(message);
}
async function daemonReady(record) {
  await waitFor(() => {
    if (record.ended) throw new Error(record.output);
    return record.output.includes('daemon listening on');
  }, 'Daemon did not start.');
}
async function stop(record) {
  if (record.ended) return;
  process.kill(-record.child.pid, 'SIGTERM');
  const timer = setTimeout(() => {
    try { process.kill(-record.child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }, 3000);
  try { await record.exit; } finally { clearTimeout(timer); }
}
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
    }
  });
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP deadline: ${method}`)); }, 10000);
        pending.set(requestId, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    }
  };
}
let page;
try {
  const env = { ...process.env, AEW_DATA_DIR: path.join(fixture, 'data'), AEW_OPEN_BROWSER: '0' };
  const first = start(process.execPath, ['dist/index.js'], daemonDir, env);
  await daemonReady(first);
  const browser = start('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--remote-debugging-port=0', `--user-data-dir=${path.join(fixture, 'browser')}`, 'about:blank'], fixture);
  await waitFor(() => /DevTools listening on (ws:\/\/\S+)/.test(browser.output), 'Chrome did not start.');
  const endpoint = new URL(browser.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  page = await connect(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1100, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed.');
    return result.result.value;
  };
  const wait = (expression) => waitFor(() => evaluate(expression), `Browser condition failed: ${expression}`);
  const fill = (selector, value) => evaluate(`(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    if (!field) throw new Error('Missing fixture field');
    const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event('input', {bubbles:true})); field.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const usable = "!document.querySelector('form fieldset')?.disabled && document.querySelector('.status')?.textContent.includes('Local daemon connected.')";
  const saved = "document.querySelector('.feedback').textContent.includes('Changes saved locally.') && !document.querySelector('[role=alert]')";
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4242' });
  await wait(usable);
  await fill('[name=workspaceName]', 'Browser workspace');
  await fill('[name=connectionName]', 'Corporate fixture');
  await fill('[name=configMode]', 'named');
  await fill('[name=configProfile]', 'corp_fixture');
  await click('form[aria-label="Create workspace"] button[type=submit]');
  await wait("Boolean(document.querySelector('form[aria-label=\"Edit connection\"]')) && " + saved);
  await fill('[name=profileName]', 'Review profile');
  await fill('[name=modelIdentifier]', 'company/router:fixture');
  await fill('[name=reasoningEffort]', 'medium');
  await click('form[aria-label="Create model profile"] button[type=submit]');
  await wait("document.querySelector('.profile-list').textContent.includes('Review profile') && " + saved);
  await fill('[name=connectionName]', 'Renamed connection');
  await click('form[aria-label="Edit connection"] button[type=submit]');
  await wait(saved);
  await click('.profile-list button');
  await fill('[name=reasoningEffort]', 'high');
  await click('form[aria-label="Edit model profile"] button[type=submit]');
  await wait("document.querySelector('.profile-list').textContent.includes('high') && " + saved);
  await fill('form[aria-label="Rename workspace"] [name=name]', 'Renamed workspace');
  await click('form[aria-label="Rename workspace"] button[type=submit]');
  await wait("document.querySelector('.workspace-list').textContent.includes('Renamed workspace') && " + saved);
  const before = await evaluate("(async () => { const list = await (await fetch('/api/workspaces')).json(); return await (await fetch('/api/workspaces/' + list.workspaces[0].id)).json(); })()");
  assert.equal(before.connection.name, 'Renamed connection');
  assert.equal(before.connection.verificationStatus, 'not_verified');
  assert.equal(before.connection.configProfile, 'corp_fixture');
  assert.equal(before.modelProfiles[0].reasoningEffort, 'high');
  const screenshot = await page.send('Page.captureScreenshot', { captureBeyondViewport: true });
  await writeFile(path.join(fixture, 'workspace-desktop.png'), Buffer.from(screenshot.data, 'base64'));
  await stop(first);
  const restarted = start(process.execPath, ['--import', 'tsx', 'src/dev.ts'], daemonDir, env);
  await daemonReady(restarted);
  await click('.sidebar .section-heading button');
  await wait(usable);
  const after = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}')).json())()`);
  assert.deepEqual(after, before);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  const mobile = await page.send('Page.captureScreenshot', { captureBeyondViewport: true });
  await writeFile(path.join(fixture, 'workspace-mobile.png'), Buffer.from(mobile.data, 'base64'));
  // Cancel confirmation first, then accept deletion of this isolated fixture.
  await evaluate('window.confirm = () => false');
  await click('.workspace-content .danger');
  assert.equal(await evaluate("document.querySelectorAll('.workspace-list li').length"), 1);
  await evaluate('window.confirm = () => true');
  await click('.workspace-content .danger');
  await wait("document.querySelectorAll('.workspace-list li').length === 0 && " + saved);
  const result = { workspaceCreate: 'passed', connectionUpdate: 'passed', modelProfileCreateAndUpdate: 'passed',
    rename: 'passed', restartPersistence: 'passed', narrowViewport: 'passed', deletionConfirmation: 'passed',
    verifiedConnectionClaim: false, aiInvocations: 0 };
  await writeFile(path.join(fixture, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ fixture, ...result }, null, 2));
} finally {
  page?.close();
  for (const child of children.reverse()) await stop(child);
}
