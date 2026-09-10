import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Opt-in Linux browser acceptance. Requires a build, Chrome and a free port 4242.
// CDP reference: https://chromedevtools.github.io/devtools-protocol/
const fixture = await mkdtemp(path.join(tmpdir(), 'aew-workspace-smoke-'));
const withSync = process.env.AEW_SMOKE_SYNC === '1';
const withWorktrees = process.env.AEW_SMOKE_WORKTREES === '1';
const withTasks = process.env.AEW_SMOKE_TASKS === '1' || withWorktrees;
const withRepositories = process.env.AEW_SMOKE_REPOSITORIES === '1' || withSync || withTasks;
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
    const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
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
  let before = await evaluate("(async () => { const list = await (await fetch('/api/workspaces')).json(); return await (await fetch('/api/workspaces/' + list.workspaces[0].id)).json(); })()");
  assert.equal(before.connection.name, 'Renamed connection');
  assert.equal(before.connection.verificationStatus, 'not_verified');
  assert.equal(before.connection.configProfile, 'corp_fixture');
  assert.equal(before.modelProfiles[0].reasoningEffort, 'high');
  let repositorySnapshot;
  if (withRepositories) {
    const source = path.join(fixture, 'source space 日本語');
    await mkdir(source);
    const git = (args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
      { cwd: source, env: { ...process.env, HOME: fixture, XDG_CONFIG_HOME: fixture, GIT_CONFIG_NOSYSTEM: '1' }, stdio: 'pipe' });
    git(['init', '-b', 'trunk']); await writeFile(path.join(source, 'file'), 'committed'); git(['add', '.']); git(['commit', '-m', 'Fixture commit']);
    await writeFile(path.join(source, 'file'), 'staged'); git(['add', '.']); await writeFile(path.join(source, 'file'), 'dirty');
    const indexBefore = await readFile(path.join(source, '.git/index'));
    const headBefore = await readFile(path.join(source, '.git/HEAD'));
    const remote = path.join(fixture, 'upstream.git');
    if (withSync) { git(['clone', '--bare', source, remote]); git(['--git-dir', remote, 'update-ref', 'refs/heads/obsolete', 'HEAD']); }
    await fill('[name=repositoryName]', 'Existing fixture'); await fill('[name=repositorySource]', source);
    await click('form[aria-label="Add repository"] button[type=submit]');
    await wait("document.querySelector('.repository-list').textContent.includes('Existing fixture') && " + usable);
    await fill('[name=repositoryMode]', 'clone');
    await fill('[name=repositoryName]', 'Managed fixture'); await fill('[name=repositorySource]', withSync ? remote : source);
    await click('form[aria-label="Add repository"] button[type=submit]');
    await wait("document.querySelectorAll('.repository-list li').length === 2 && !document.querySelector('.repository-list').textContent.includes('cloning') && " + usable);
    await fill('[name=repositoryName]', 'Failed fixture'); await fill('[name=repositorySource]', source); await fill('[name=repositoryBaseRef]', 'missing');
    // The same successful clone source is deliberately deduplicated; use a distinct local fixture.
    const failureSource = path.join(fixture, 'not-git'); await mkdir(failureSource);
    await fill('[name=repositorySource]', failureSource);
    await click('form[aria-label="Add repository"] button[type=submit]');
    await wait("document.querySelector('.repository-list').textContent.includes('GIT_FAILED') && " + usable);
    repositorySnapshot = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/repositories')).json())()`);
    assert.equal(repositorySnapshot.repositories.filter((item) => item.status === 'ready').length, 2);
    assert.equal(repositorySnapshot.repositories.filter((item) => item.status === 'failed').length, 1);
    assert.deepEqual(await readFile(path.join(source, '.git/index')), indexBefore);
    assert.deepEqual(await readFile(path.join(source, '.git/HEAD')), headBefore);
    assert.equal(await readFile(path.join(source, 'file'), 'utf8'), 'dirty');
    await evaluate("document.querySelectorAll('.repository-list details').forEach(item => item.open = true)");
    if (withSync) {
      await click('.repository-list li:nth-child(1) .sync-controls button');
      await wait("document.querySelector('.repository-list li:nth-child(1)').textContent.includes('No remote — local metadata refreshed')");
      const nextSha = git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Upstream fixture change']).toString().trim();
      git(['push', remote, `${nextSha}:refs/heads/trunk`]);
      git(['--git-dir', remote, 'update-ref', '-d', 'refs/heads/obsolete']);
      await click('.repository-list li:nth-child(2) .sync-controls button');
      await wait("document.querySelector('.repository-list li:nth-child(2) .sync-controls').textContent.includes('succeeded')");
      repositorySnapshot = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/repositories')).json())()`);
      const managed = repositorySnapshot.repositories.find((item) => item.name === 'Managed fixture');
      assert.equal(managed.resolvedCommitSha, nextSha); assert.ok(managed.lastFetchedAt);
      assert.throws(() => git(['--git-dir', path.join(managed.localPath, '.git'), 'show-ref', '--verify', 'refs/remotes/origin/obsolete']));
      git(['--git-dir', path.join(managed.localPath, '.git'), 'remote', 'set-url', 'origin', path.join(fixture, 'missing-remote.git')]);
      await click('.repository-list li:nth-child(2) .sync-controls button');
      await wait("document.querySelector('.repository-list li:nth-child(2) .sync-controls').textContent.includes('GIT_FAILED')");
      repositorySnapshot = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/repositories')).json())()`);
      const failedSync = repositorySnapshot.repositories.find((item) => item.id === managed.id);
      assert.equal(failedSync.lastFetchedAt, managed.lastFetchedAt); assert.equal(failedSync.syncStatus, 'failed');
      assert.deepEqual(await readFile(path.join(source, '.git/index')), indexBefore);
      assert.deepEqual(await readFile(path.join(source, '.git/HEAD')), headBefore);
      assert.equal(await readFile(path.join(source, 'file'), 'utf8'), 'dirty');
    }
  }
  let taskSnapshot;
  if (withTasks) {
    await click('section[aria-label="Tasks"] .section-heading button');
    await wait("Boolean(document.querySelector('form[aria-label=\"Create task\"]')) && " + usable);
    await fill('[name=title]', 'Two-repository regression'); await fill('[name=description]', 'Investigate the fixture regression.\nPreserve both checkouts.');
    await evaluate("document.querySelectorAll('[name=repositoryIds]').forEach(input => input.click())");
    await click('form[aria-label="Create task"] button[type=submit]');
    await wait("Boolean(document.querySelector('form[aria-label=\"Import artifacts\"]')) && " + usable);
    const log = path.join(fixture, 'trace.log'), pdf = path.join(fixture, 'report.pdf');
    await writeFile(log, 'fixture log line\n'); await writeFile(pdf, 'synthetic PDF bytes');
    await page.send('DOM.enable');
    const doc = await page.send('DOM.getDocument');
    const node = await page.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[name=files]' });
    await page.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [log, pdf] });
    await click('form[aria-label="Import artifacts"] button[type=submit]');
    await wait("document.querySelectorAll('.artifact-entry').length === 2 && " + usable);
    await click('.artifact-entry input[type=checkbox]');
    await click('form[aria-label="Select text context"] button[type=submit]');
    await wait("document.querySelector('section[aria-label=Tasks]').textContent.includes('Text context selection saved.') && " + usable);
    await unlink(log); await unlink(pdf);
    taskSnapshot = await evaluate(`(async () => { const list = await (await fetch('/api/workspaces/${before.workspace.id}/tasks')).json(); return await (await fetch('/api/workspaces/${before.workspace.id}/tasks/' + list.tasks[0].id)).json(); })()`);
    assert.equal(taskSnapshot.task.repositoryIds.length, 2); assert.equal(taskSnapshot.artifacts.length, 2);
    assert.equal(taskSnapshot.context.entries.filter(entry => entry.range).length, 1);
    const text = taskSnapshot.artifacts.find(artifact => artifact.kind === 'text');
    assert.equal(await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/tasks/${taskSnapshot.task.id}/artifacts/${text.id}/download')).text())()`), 'fixture log line\n');
    before = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}')).json())()`);
    assert.equal(before.workspace.boundaryLocked, true);
    assert.equal(await evaluate("document.querySelector('.workspace-content .danger').disabled"), true);
  }
  if (withWorktrees) {
    const taskRoute = `/api/workspaces/${before.workspace.id}/tasks/${taskSnapshot.task.id}`;
    const snapshot = () => evaluate(`(async () => await (await fetch('${taskRoute}')).json())()`);
    const firstRef = '.worktree-list li:first-child input[name=baseRef]';
    const originalRef = taskSnapshot.worktrees[0].baseRef;
    const refSaved = (value) => waitFor(async () => (await snapshot()).worktrees[0].baseRef === value &&
      await evaluate("!document.querySelector('section[aria-label=\"Task worktrees\"] > button').disabled"), 'Base ref was not saved.');
    await fill(firstRef, 'missing-fixture-ref');
    await click('.worktree-list li:first-child button[type=submit]');
    await refSaved('missing-fixture-ref');
    await click('section[aria-label="Task worktrees"] > button');
    await wait("document.querySelector('section[aria-label=\"Task worktrees\"]').textContent.includes('Latest operation: failed')");
    await fill(firstRef, originalRef); await click('.worktree-list li:first-child button[type=submit]');
    await refSaved(originalRef);
    await click('section[aria-label="Task worktrees"] > button');
    await wait("document.querySelector('section[aria-label=\"Task worktrees\"]').textContent.includes('Latest operation: succeeded')");
    taskSnapshot = await snapshot(); assert.equal(taskSnapshot.task.status, 'CONTEXT_READY');
    assert.equal(taskSnapshot.worktrees.filter(row => row.status === 'ready').length, 2);
    const row = taskSnapshot.worktrees[0], marker = path.join(row.worktreePath, 'browser-untracked');
    await writeFile(marker, 'preserve browser fixture');
    await evaluate('window.confirm = () => true'); await click('.worktree-list li:first-child button.danger');
    await wait("document.querySelector('section[aria-label=\"Task worktrees\"]').textContent.includes('Latest operation: failed')");
    assert.equal(await readFile(marker, 'utf8'), 'preserve browser fixture'); await unlink(marker);
    await click('.worktree-list li:first-child button.danger');
    await wait("document.querySelector('.worktree-list li:first-child').textContent.includes('Worktree: removed')");
    const pin = execFileSync('git', ['rev-parse', row.managedPinRef], { cwd: row.sourcePath, encoding: 'utf8', stdio: 'pipe' }).trim();
    assert.equal(pin, row.resolvedCommitSha);
    await wait("!document.querySelector('section[aria-label=\"Task worktrees\"] > button').disabled");
    await click('section[aria-label="Task worktrees"] > button');
    await wait("document.querySelectorAll('.worktree-list li').length === 2 && Array.from(document.querySelectorAll('.worktree-list li')).every(li => li.textContent.includes('Worktree: ready')) && !document.querySelector('section[aria-label=\"Task worktrees\"] > button').disabled");
    taskSnapshot = await snapshot();
    assert.equal(taskSnapshot.worktrees[0].resolvedCommitSha, row.resolvedCommitSha);
  }
  const screenshot = await page.send('Page.captureScreenshot', { captureBeyondViewport: true });
  await writeFile(path.join(fixture, 'workspace-desktop.png'), Buffer.from(screenshot.data, 'base64'));
  await stop(first);
  const restarted = start(process.execPath, ['--import', 'tsx', 'src/dev.ts'], daemonDir, env);
  await daemonReady(restarted);
  await click('.sidebar .section-heading button');
  await wait(usable);
  const after = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}')).json())()`);
  assert.deepEqual(after, before);
  if (withTasks) {
    const afterTask = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/tasks/${taskSnapshot.task.id}')).json())()`);
    assert.deepEqual(afterTask, taskSnapshot);
    await click('section[aria-label="Tasks"] .workspace-list button');
    await wait("Boolean(document.querySelector('form[aria-label=\"Select text context\"]')) && " + usable);
  }
  if (withRepositories) {
    await wait("document.querySelectorAll('.repository-list li').length === 3");
    const afterRepositories = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/repositories')).json())()`);
    assert.deepEqual(afterRepositories, repositorySnapshot);
  }
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  const mobile = await page.send('Page.captureScreenshot', { captureBeyondViewport: true });
  await writeFile(path.join(fixture, 'workspace-mobile.png'), Buffer.from(mobile.data, 'base64'));
  // Cancel confirmation first, then accept deletion of this isolated fixture.
  if (!withTasks) {
  await evaluate('window.confirm = () => false');
  await click('.workspace-content .danger');
  assert.equal(await evaluate("document.querySelectorAll('.workspace-list li').length"), 1);
  await evaluate('window.confirm = () => true');
  await click('.workspace-content .danger');
  if (withRepositories) {
    await wait("document.querySelector('.feedback').textContent.includes('contains repository records')");
    assert.equal(await evaluate("document.querySelectorAll('.workspace-list li').length"), 1);
  } else await wait("document.querySelectorAll('.workspace-list li').length === 0 && " + saved);
  }
  const result = { workspaceCreate: 'passed', connectionUpdate: 'passed', modelProfileCreateAndUpdate: 'passed',
    rename: 'passed', restartPersistence: 'passed', narrowViewport: 'passed', deletionConfirmation: withTasks ? 'disabled by boundary lock' : 'passed',
    verifiedConnectionClaim: false, aiInvocations: 0 };
  if (withRepositories) Object.assign(result, { repositoryRegistration: 'passed', managedClone: 'passed', failedCloneDiagnostics: 'passed',
    repositoryRestartPersistence: 'passed', dirtyCheckoutPreserved: 'passed', workspaceDeletionBlocked: 'passed' });
  if (withSync) Object.assign(result, { noRemoteRefresh: 'passed', fetchAndPrune: 'passed', syncFailureDiagnostics: 'passed', lastSuccessPreserved: 'passed', syncRestartPersistence: 'passed' });
  if (withTasks) Object.assign(result, { twoRepositoryTask: 'passed', browserFileUpload: 'passed', sourceRemovalDownload: 'passed', explicitTextContext: 'passed', unsupportedFileExclusion: 'passed', taskRestartPersistence: 'passed', boundaryLock: 'passed' });
  if (withWorktrees) Object.assign(result, { twoRepositoryPreparation: 'passed', baseRefFailureAndRetry: 'passed', dirtyCleanupRejected: 'passed', cleanCleanup: 'passed', retainedPin: 'passed', recreatePinnedRevision: 'passed', worktreeRestartPersistence: 'passed' });
  await writeFile(path.join(fixture, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ fixture, ...result }, null, 2));
} finally {
  page?.close();
  for (const child of children.reverse()) await stop(child);
}
