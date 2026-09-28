import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Opt-in browser acceptance for the static prototype. No daemon or account access.
const directory = fileURLToPath(new URL('../prototypes/investigation/', import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), 'aew-prototype-smoke-'));
const files = { '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'] };
const server = createServer(async (request, response) => {
  const entry = files[request.url];
  if (!entry || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': entry[1] }); response.end(await readFile(path.join(directory, entry[0])));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
  '--remote-debugging-port=0', `--user-data-dir=${path.join(output, 'browser')}`, 'about:blank'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browserOutput = '', browserError;
for (const stream of [browser.stdout, browser.stderr]) stream.on('data', chunk => { browserOutput = (browserOutput + chunk).slice(-20000); });
browser.on('error', error => { browserError = error; });
const browserExit = new Promise(resolve => browser.once('close', resolve));
async function wait(check, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (browserError) throw browserError; if (await check()) return; await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error(message);
}
let socket;
try {
  await wait(() => /DevTools listening on (ws:\/\/\S+)/.test(browserOutput), 'Chrome startup failed');
  const endpoint = new URL(browserOutput.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 0;
  const pending = new Map(), exceptions = [], requests = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.push({ url: message.params.request.url, type: message.params.type });
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed');
    return result.result.value;
  };
  const until = expression => wait(() => evaluate(expression), `Condition failed: ${expression}`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.value = ${JSON.stringify(value)}; element.dispatchEvent(new Event('input', {bubbles:true})); element.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(path.join(output, `${name}.png`), Buffer.from(result.data, 'base64')); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin });
  await until("!!document.querySelector('#composer')");
  await screenshot('empty');
  assert.ok(await evaluate("document.querySelector('#composer [type=submit]').getBoundingClientRect().bottom <= innerHeight"), 'Primary action is below the initial desktop viewport');
  await click('[data-action=sample]');
  const description = await evaluate("document.querySelector('#description').value");
  assert.ok(description.includes('1999'));
  await click('[data-action=setup]');
  assert.equal(await evaluate("document.querySelectorAll('[name=setup]:checked').length"), 0);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await until("!document.querySelector('dialog').open");
  // Keyboard-style focus before opening proves native dialog restoration.
  await evaluate("document.querySelector('[data-action=setup]').focus()");
  await click('[data-action=setup]'); await click('[name=setup][value=personal]'); await click('#setup-form [type=submit]');
  assert.ok(await evaluate("document.querySelector('.setup-strip').textContent.includes('Personal setup')"));
  await screenshot('composer');
  await fill('#scenario', 'setup-error'); await click('#composer [type=submit]');
  await until("document.querySelector('[role=alert]')?.textContent.includes('setup is unavailable')");
  assert.equal(await evaluate("document.querySelector('#description').value"), description);
  assert.ok(await evaluate("document.querySelector('#attachments').textContent.includes('Included')"));
  await screenshot('setup-error');
  await click('[role=alert] [data-action=setup]'); await click('#setup-form [type=submit]');
  await click('#composer [type=submit]'); await until("!!document.querySelector('[data-action=cancel]')");
  await click('[data-action=cancel]');
  await new Promise(resolve => setTimeout(resolve, 1600));
  assert.ok(await evaluate("!!document.querySelector('#composer') && !document.querySelector('[aria-label=\"Investigation report\"]')"));
  // Metadata-only file input handling, HTML escaping, unsupported type and size budget.
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['x'], '<img src=x>.txt', {type:'text/plain'})); transfer.items.add(new File(['x'], 'screen.png', {type:'image/png'})); transfer.items.add(new File([new Uint8Array(1048577)], 'large.log', {type:'text/plain'})); const input=document.querySelector('#files'); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  assert.equal(await evaluate("document.querySelectorAll('#attachments img').length"), 0);
  assert.ok(await evaluate("document.querySelector('#attachments').textContent.includes('this format is not analyzed')"));
  assert.ok(await evaluate("document.querySelector('#attachments').textContent.includes('exceeds the 1 MB')"));
  await click('#composer [type=submit]');
  await until("!!document.querySelector('[aria-label=\"Investigation report\"]')");
  await screenshot('report');
  await evaluate("document.querySelector('[data-kind=code]').focus()");
  await click('[data-kind=code]');
  assert.ok(await evaluate("document.querySelector('dialog pre').textContent.includes('Math.round')"));
  await click('[data-action=close]');
  assert.equal(await evaluate("document.activeElement.dataset.kind"), 'code');
  await fill('#feedback', 'Explain where rounding belongs and preserve the earlier report.');
  await fill('#scenario', 'run-error'); await click('#revision [type=submit]');
  await until("document.querySelector('[role=alert]')?.textContent.includes('analysis stopped')");
  assert.equal(await evaluate("document.querySelector('#version').options.length"), 1);
  await click('[data-action=retry]');
  await until("document.querySelector('#version')?.options.length === 2");
  assert.ok(await evaluate("document.querySelector('[aria-label=\"Investigation report\"]').textContent.includes('Explain where rounding belongs')"));
  await fill('#version', '0'); assert.equal(await evaluate("!!document.querySelector('#revision')"), false);
  await fill('#version', '1');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(output, 'downloads') });
  await click('[data-action=export]');
  await wait(async () => { try { return (await readFile(path.join(output, 'downloads/sample-investigation-v2.md'), 'utf8')).includes('Not AI-generated'); } catch { return false; } }, 'Sample export missing');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot('mobile-report');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile report overflows');
  await click('[data-action=new]');
  assert.ok(await evaluate("document.querySelector('.setup-strip').textContent.includes('Personal setup')"));
  await screenshot('mobile-composer');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile composer overflows');
  assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
  assert.equal(requests.filter(request => ['Fetch', 'XHR'].includes(request.type)).length, 0);
  assert.ok(requests.every(request => request.url.startsWith(origin + '/') || request.url.startsWith('data:')), 'Unexpected external page request');
  assert.deepEqual(exceptions, []);
  const result = { setupRequiresChoice: true, setupFailurePreservesInputs: true, cancellationStopsProgress: true,
    attachmentsLabeledAndEscaped: true, failedRevisionPreservesReport: true, revisionAndHistory: true,
    evidenceDialogRestoresFocus: true, markdownExport: true, mobileWithoutOverflow: true, browserStorageWrites: 0, apiRequests: 0, modelRequests: 0, screenshots: output };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  socket?.close();
  try { process.kill(-browser.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  await browserExit;
  await new Promise(resolve => server.close(resolve));
}
