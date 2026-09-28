import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Opt-in Linux browser acceptance. Requires a build, Chrome and a free port 4242.
// CDP reference: https://chromedevtools.github.io/devtools-protocol/
const fixture = await mkdtemp(path.join(tmpdir(), 'aew-investigation-smoke-'));
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
  const deadline = Date.now() + 20000;
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
  const config = path.join(fixture, 'config'), source = path.join(fixture, 'source');
  await mkdir(config); await mkdir(source); await writeFile(path.join(config, 'config.toml'), '');
  const mode = path.join(fixture, 'mode'), capture = path.join(fixture, 'calls');
  await writeFile(mode, 'success');
  const executable = path.join(fixture, 'fixture-codex');
  const implementation = fileURLToPath(new URL('../packages/ai/tests/fixture-cli.cjs', import.meta.url));
  await writeFile(executable, `#!${process.execPath}\nconst fs = require('node:fs');\nif (process.argv.includes('exec')) fs.appendFileSync(${JSON.stringify(capture)}, 'run\\n');\nprocess.env.FIXTURE_MODE = fs.readFileSync(${JSON.stringify(mode)}, 'utf8');\nrequire(${JSON.stringify(implementation)});\n`, { mode: 0o700 });
  const git = args => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: source, stdio: 'pipe', env: { ...process.env, HOME: fixture, GIT_CONFIG_NOSYSTEM: '1' } });
  git(['init', '-b', 'main']); await writeFile(path.join(source, 'file'), 'Committed fixture source.'); git(['add', '.']); git(['commit', '-m', 'Synthetic source']);
  await writeFile(path.join(source, 'file'), 'Uncommitted fixture source.');
  const env = { ...process.env, AEW_DATA_DIR: path.join(fixture, 'data'), AEW_OPEN_BROWSER: '0', CODEX_HOME: config, FIXTURE_PID: path.join(fixture, 'child') };
  let daemon = start(process.execPath, ['dist/index.js'], daemonDir, env); await daemonReady(daemon);
  const browser = start('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${path.join(fixture, 'browser')}`, 'about:blank'], fixture);
  await waitFor(() => /DevTools listening on (ws:\/\/\S+)/.test(browser.output), 'Chrome did not start.');
  const endpoint = new URL(browser.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  page = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed.');
    return result.result.value;
  };
  const wait = expression => waitFor(() => evaluate(expression), `Browser condition failed: ${expression}`);
  const fill = (selector, value) => evaluate(`(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event('input', {bubbles:true})); field.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const button = text => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  const saved = "document.querySelector('.submit-row [role=status]')?.textContent === 'Saved locally'";
  const read = route => evaluate(`fetch(${JSON.stringify('/api' + route)}).then(r=>r.json())`);
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4242' }); await wait(saved);
  await fill('#repository', source); await fill('#description', 'Why did the fixture behavior change?'); await wait(saved);
  await button('Choose setup'); await wait("document.querySelector('dialog').open");
  await click(`input[value="directory:${config}"]`);
  await evaluate("document.querySelector('dialog details').open = true");
  await fill('[name=executablePath]', executable); await fill('[name=projectName]', 'Primary flow fixture'); await button('Use this setup');
  await wait("!document.querySelector('dialog').open && document.querySelector('.setup-strip').textContent.includes('Primary flow fixture')");
  const log = path.join(fixture, 'trace.log'); await writeFile(log, 'Selected café log.\n');
  const doc = await page.send('DOM.getDocument');
  const { nodeId } = await page.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await page.send('DOM.setFileInputFiles', { nodeId, files: [log] });
  await wait("document.querySelector('.attachment')?.textContent.includes('Included · full text')");
  await button('Exclude'); await wait("document.querySelector('.attachment')?.textContent.includes('Excluded from analysis')");
  await evaluate('window.__reloadMarker = true'); await page.send('Page.reload'); await wait('!window.__reloadMarker'); await wait("document.querySelector('.attachment')?.textContent.includes('Excluded from analysis')");
  assert.equal(await evaluate("document.querySelector('#description').value"), 'Why did the fixture behavior change?');
  await button('Include'); await wait("document.querySelector('.attachment')?.textContent.includes('Included · full text')");
  const desktop = await page.send('Page.captureScreenshot', { captureBeyondViewport: true }); await writeFile(path.join(fixture, 'composer.png'), Buffer.from(desktop.data, 'base64'));
  await writeFile(mode, 'config-fail'); await button('Investigate →');
  await wait("document.querySelector('main')?.textContent.includes('This attempt needs attention') && Boolean(document.querySelector('#description'))");
  assert.equal((await read('/drafts')).drafts[0].taskId, null);
  await writeFile(mode, 'success'); await button('Investigate →');
  await wait("document.querySelector('.report-card')?.textContent.includes('Synthetic source and log support this explanation.')");
  let drafts = await read('/drafts'), draft = drafts.drafts.find(d => d.taskId);
  assert.equal(draft.launch.state, 'succeeded');
  const taskBase = `/workspaces/${draft.input.workspaceId}/tasks/${draft.taskId}`;
  const detail = await read(taskBase); assert.equal(detail.context.entries.length, 1); assert.deepEqual(detail.context.entries[0].range, { start: 0, end: Buffer.byteLength('Selected café log.\n') });
  await button('e1'); await wait("document.querySelector('[aria-label=\"Evidence source\"]')?.textContent.includes('Committed fixture source.')");
  assert.equal(await readFile(path.join(source, 'file'), 'utf8'), 'Uncommitted fixture source.');
  await fill('[name=challengeText]', 'Reconsider the timing.'); await button('Revise report');
  await wait("document.querySelector('.report-card')?.textContent.includes('Version 2')");
  const downloads = path.join(fixture, 'downloads'); await mkdir(downloads); await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await button('Export Markdown'); await waitFor(async () => (await readdir(downloads)).some(name => name.endsWith('.md')), 'Report download failed.');
  await writeFile(mode, 'sleep'); await button('Run investigation again');
  await waitFor(async () => (await readFile(capture, 'utf8')).trim().split('\n').length === 3, 'Third fixture invocation did not start.');
  await button('Cancel investigation'); await wait("document.querySelector('main')?.textContent.includes('Investigation cancelled. Your inputs')");
  assert.equal((await read(`${taskBase}/investigations`)).reports.length, 2);
  await writeFile(mode, 'success'); await stop(daemon); daemon = start(process.execPath, ['dist/index.js'], daemonDir, env); await daemonReady(daemon);
  await evaluate('window.__reloadMarker = true'); await page.send('Page.reload'); await wait('!window.__reloadMarker'); await wait("document.querySelector('.report-card')?.textContent.includes('Version 2')");
  assert.equal((await readFile(capture, 'utf8')).trim().split('\n').length, 3);
  await button('Copy to a new investigation'); await wait("document.querySelector('#description')?.value === 'Why did the fixture behavior change?' && document.querySelector('.attachment')?.textContent.includes('trace.log')");
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  const mobile = await page.send('Page.captureScreenshot', { captureBeyondViewport: true }); await writeFile(path.join(fixture, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  const result = { durableDraftAndFiles: 'passed', explicitSetup: 'passed', setupFailureRetry: 'passed', automaticPreparationAndContext: 'passed', evidence: 'passed', revisionAndExport: 'passed', cancellationPreservesReports: 'passed', restartWithoutInvocation: 'passed', copyToNewDraft: 'passed', mobileLayout: 'passed', fixtureInvocations: 3, realModelInvocations: 0 };
  await writeFile(path.join(fixture, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ fixture, ...result }, null, 2));
} finally { page?.close(); for (const child of children.reverse()) await stop(child); }
