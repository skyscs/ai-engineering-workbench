import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Opt-in Linux browser acceptance. Requires a build, Chrome and a free port 4242.
// CDP reference: https://chromedevtools.github.io/devtools-protocol/
const fixture = await mkdtemp(path.join(tmpdir(), 'aew-workspace-smoke-'));
const withSync = process.env.AEW_SMOKE_SYNC === '1';
const withRelease = process.env.AEW_SMOKE_RELEASE === '1';
const withInterventions = process.env.AEW_SMOKE_INTERVENTIONS === '1' || withRelease;
const withRuntime = process.env.AEW_SMOKE_RUNTIME === '1' || withInterventions;
const withWorktrees = process.env.AEW_SMOKE_WORKTREES === '1' || withRuntime;
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
  const runtimeMode = path.join(fixture, 'runtime-mode'), runtimeExecutable = path.join(fixture, 'fixture-codex');
  if (withRuntime) {
    const config = path.join(fixture, 'cli-config'); await mkdir(config);
    await writeFile(path.join(config, 'config.toml'), ''); await writeFile(path.join(config, 'corp_fixture.config.toml'), '');
    await writeFile(runtimeMode, 'success');
    const implementation = fileURLToPath(new URL('../packages/ai/tests/fixture-cli.cjs', import.meta.url));
    await writeFile(runtimeExecutable, `#!${process.execPath}\nprocess.env.FIXTURE_MODE = require('node:fs').readFileSync(${JSON.stringify(runtimeMode)}, 'utf8');\nrequire(${JSON.stringify(implementation)});\n`, { mode: 0o700 });
    env.CODEX_HOME = config; env.FIXTURE_PID = path.join(fixture, 'runtime-child-pid');
  }
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
  if (withRuntime) await fill('[name=executablePath]', runtimeExecutable);
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
  if (withRuntime) {
    const section = 'section[aria-label="AI runtime"]';
    const taskRoute = `/api/workspaces/${before.workspace.id}/tasks/${taskSnapshot.task.id}`;
    const snapshot = () => evaluate(`(async () => await (await fetch('${taskRoute}')).json())()`);
    assert.equal(await evaluate(`document.querySelector('${section} > button').disabled`), true);
    await fill('form[aria-label="Edit connection"] [name=configHome]', path.join(fixture, 'cli-config'));
    await click('form[aria-label="Edit connection"] button[type=submit]'); await wait(saved);
    await wait(`!document.querySelector('${section} > button').disabled`);
    assert.ok(await evaluate(`document.querySelector('${section}').textContent.includes(${JSON.stringify(path.join(fixture, 'cli-config'))})`));
    before = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}')).json())()`);
    assert.equal(before.connection.configHome, path.join(fixture, 'cli-config'));
    assert.equal(await evaluate(`document.querySelector('form[aria-label="Edit connection"] [name=configHome]').disabled`), true);
    await fill(`${section} select`, before.modelProfiles[0].id);
    await click(`${section} > button`);
    await wait(`document.querySelector('${section}').textContent.includes('Fixture café investigation')`);
    const succeeded = (await snapshot()).latestRun;
    assert.equal(succeeded.modelProfileId, before.modelProfiles[0].id);
    assert.equal(succeeded.inputSnapshot.connection.configHome, before.connection.configHome);
    const reportsRoute = `${taskRoute}/investigations`;
    const reports = () => evaluate(`(async () => (await (await fetch('${reportsRoute}')).json()).reports)()`);
    assert.equal((await snapshot()).task.status, 'ROOT_CAUSE_READY');
    await wait(`document.querySelector('section[aria-label="Investigation reports"] select') !== null`);
    assert.equal((await reports()).length, 1);
    assert.ok(await evaluate(`document.querySelector('section[aria-label="Investigation reports"]').textContent.includes('Preserve incomplete fence')`));
    assert.equal(await evaluate(`document.querySelector('section[aria-label="Investigation reports"] img') !== null`), false);
    assert.equal(await evaluate(`document.querySelector('section[aria-label="Investigation reports"] a[href^="javascript:"]') !== null`), false);
    await click('section[aria-label="Investigation reports"] .evidence-references button');
    await wait(`document.querySelector('section[aria-label="Evidence source"]')?.textContent.includes('1: committed')`);
    await writeFile(runtimeMode, 'invalid-evidence'); await click(`${section} > button`);
    await wait(`document.querySelector('${section}').textContent.includes('INVALID_EVIDENCE')`);
    assert.equal((await reports()).length, 1);
    await writeFile(runtimeMode, 'failure'); await click(`${section} > button`);
    await wait(`document.querySelector('${section}').textContent.includes('AUTHENTICATION_REQUIRED')`);
    assert.doesNotMatch(await evaluate(`document.querySelector('${section}').textContent`), /sk-secretfixture|user:password/);
    const old = await evaluate(`(async () => await (await fetch('${taskRoute}/runtime-runs/${succeeded.id}')).json())()`);
    assert.equal(old.run.status, 'succeeded'); assert.ok(old.result);
    await writeFile(runtimeMode, 'sleep'); await click(`${section} > button`);
    await wait(`Array.from(document.querySelectorAll('${section} button')).some(b => b.textContent === 'Cancel run' && !b.disabled)`);
    await evaluate(`Array.from(document.querySelectorAll('${section} button')).find(b => b.textContent === 'Cancel run').click()`);
    await wait(`document.querySelector('${section}').textContent.includes('cancelled')`);
    await writeFile(runtimeMode, 'success'); await click(`${section} > button`);
    await wait(`document.querySelector('${section}').textContent.includes('Fixture café investigation')`);
    await waitFor(async () => (await snapshot()).latestRun.status === 'succeeded' && (await reports()).length === 2, 'Investigation retry did not publish version 2.');
    taskSnapshot = await snapshot(); assert.equal(taskSnapshot.latestRun.status, 'succeeded');
    assert.equal(taskSnapshot.task.status, 'ROOT_CAUSE_READY');
    const history = await reports(); assert.equal(history[1].status, 'superseded');
    await wait(`document.querySelectorAll('section[aria-label="Investigation reports"] select option').length === 2`);
    await fill('section[aria-label="Investigation reports"] select', history[1].id);
    await click('section[aria-label="Investigation reports"] .evidence-references button');
    await wait(`document.querySelector('section[aria-label="Evidence source"]')?.textContent.includes('1: committed')`);
    if (withInterventions) {
      const original = history[0];
      await fill('section[aria-label="Investigation reports"] select', original.id);
      const guardRun = (await snapshot()).latestRun.id;
      const constraintText = 'Preserve both repositories and inspect history before concluding.';
      await fill('[name=constraintText]', constraintText);
      await click('form[aria-label="Add constraint"] button[type=submit]');
      await wait(`document.querySelector('section[aria-label="Human interventions"] li')?.textContent.includes(${JSON.stringify(constraintText)})`);
      await waitFor(async () => (await reports())[0].freshness === 'stale', 'Constraint did not invalidate reports.');
      assert.equal((await snapshot()).latestRun.id, guardRun);
      const challengeText = 'The explanation is incomplete. Reconsider the historical contract.';
      await fill('[name=challengeText]', challengeText);
      await writeFile(runtimeMode, 'failure'); await click('form[aria-label="Challenge report"] button[type=submit]');
      await waitFor(async () => { const r=(await snapshot()).latestRun; return r.id !== guardRun && r.status === 'failed'; }, 'Challenge failure was not recorded.');
      assert.equal((await reports()).length, 2);
      await evaluate(`document.querySelector('section[aria-label="Human interventions"] details').open = true`);
      await wait(`document.querySelector('section[aria-label="Human interventions"] details button') !== null`);
      await click('section[aria-label="Human interventions"] details button');
      await wait(`document.querySelector('section[aria-label="Intervention attempt"]')?.textContent.includes('AUTHENTICATION_REQUIRED')`);
      await wait(`!document.querySelector('form[aria-label="Challenge report"] fieldset').disabled`);
      const failedChallengeId = (await snapshot()).latestRun.id;
      await fill('[name=challengeText]', challengeText);
      await writeFile(runtimeMode, 'sleep'); await click('form[aria-label="Challenge report"] button[type=submit]');
      await waitFor(async () => { const r = (await snapshot()).latestRun; return r.id !== failedChallengeId && r.status === 'running'; }, 'Challenge retry did not start.');
      await wait(`Array.from(document.querySelectorAll('${section} button')).some(b => b.textContent === 'Cancel run' && !b.disabled)`);
      assert.equal(await evaluate(`document.querySelector('form[aria-label="Add constraint"] fieldset').disabled`), true);
      await evaluate(`Array.from(document.querySelectorAll('${section} button')).find(b => b.textContent === 'Cancel run').click()`);
      await waitFor(async () => (await snapshot()).latestRun.status === 'cancelled', 'Challenge cancellation did not finish.');
      await wait(`!document.querySelector('form[aria-label="Challenge report"] fieldset').disabled`);
      await fill('[name=challengeText]', challengeText);
      await writeFile(runtimeMode, 'success'); await click('form[aria-label="Challenge report"] button[type=submit]');
      await waitFor(async () => (await reports()).length === 3 && (await snapshot()).latestRun.status === 'succeeded', 'Challenge did not publish version 3.');
      const revised = (await reports())[0], attempt = (await snapshot()).latestRun;
      assert.equal(revised.previousVersionId, original.id); assert.ok(revised.triggeredByInterventionId);
      assert.equal(attempt.inputSnapshot.revision.intervention.text, challengeText);
      assert.deepEqual(attempt.inputSnapshot.revision.previousReport.result, original.result);
      assert.deepEqual(attempt.inputSnapshot.constraints, [constraintText]);
      assert.ok(revised.result.investigation.summary.includes('Applied constraints: ' + constraintText));
      assert.ok(revised.result.investigation.summary.includes('Reconsidered after challenge: ' + challengeText));
      await wait(`document.querySelector('section[aria-label="Investigation reports"]').textContent.includes('Triggered by this challenge')`);
      const earlier = (await reports()).find(r => r.id === original.id); assert.equal(earlier.status, 'superseded'); assert.deepEqual(earlier.result, original.result);
      await evaluate(`Array.from(document.querySelectorAll('section[aria-label="Human interventions"] button')).find(b => b.textContent === 'Deactivate constraint').click()`);
      await wait(`document.querySelector('section[aria-label="Human interventions"]').textContent.includes('No active constraints.')`);
      assert.equal((await snapshot()).latestRun.id, attempt.id);
      await wait(`!document.querySelector('${section} > button').disabled`); await click(`${section} > button`);
      await waitFor(async () => (await reports()).length === 4 && (await snapshot()).latestRun.status === 'succeeded', 'Run after deactivation did not complete.');
      taskSnapshot = await snapshot(); assert.deepEqual(taskSnapshot.latestRun.inputSnapshot.constraints, []);
      await wait(`document.querySelectorAll('section[aria-label="Investigation reports"] select option').length === 4`);
      await fill('section[aria-label="Investigation reports"] select', revised.id);
      await wait(`document.querySelector('section[aria-label="Investigation reports"]').textContent.includes('Triggered by this challenge')`);
    }
  }
  if (withRelease) {
    const downloads = path.join(fixture, 'downloads'); await mkdir(downloads);
    await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    const exportSelected = async (version) => {
      await evaluate(`Array.from(document.querySelectorAll('section[aria-label="Investigation reports"] button')).find(b => b.textContent === 'Export Markdown').click()`);
      let file;
      await waitFor(async () => { file = (await readdir(downloads)).find(f => f.endsWith(`-v${version}.md`)); return !!file; }, 'Markdown download did not complete.');
      const markdown = await readFile(path.join(downloads, file), 'utf8');
      assert.ok(markdown.includes(`version ${version}`)); assert.ok(markdown.includes('## Evidence locators'));
      assert.ok(markdown.includes('Available; locator rechecked')); assert.ok(!markdown.includes(fixture));
      assert.ok(!markdown.includes('<img')); assert.ok(markdown.includes('\\[unsafe\\]\\(javascript:'));
      return markdown;
    };
    assert.ok((await exportSelected(3)).includes('## Triggering challenge'));
    const select = 'section[aria-label="Investigation reports"] select';
    const oldest = await evaluate(`document.querySelector('${select}').lastElementChild.value`);
    await fill(select, oldest);
    assert.ok((await exportSelected(1)).includes('superseded'));
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
  if (withRuntime) await wait("document.querySelector('section[aria-label=\"AI runtime\"]').textContent.includes('Fixture café investigation')");
  if (withInterventions) {
    await wait(`document.querySelector('section[aria-label="Human interventions"]').textContent.includes('No active constraints.')`);
    const history = await evaluate(`(async () => await (await fetch('/api/workspaces/${before.workspace.id}/tasks/${taskSnapshot.task.id}/interventions')).json())()`);
    assert.equal(history.interventions.length, 5); assert.equal(history.constraints[0].active, false);
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
  if (withRuntime) Object.assign(result, { investigationReport: 'passed', validatedEvidenceNavigation: 'passed', immutableVersionHistory: 'passed', invalidEvidencePreservesReport: 'passed', unsafeMarkdownInert: 'passed', selectedModelProfile: 'passed', runtimeFailureDiagnostics: 'passed', runtimeCancellation: 'passed', runtimeRetry: 'passed', priorRunPreserved: 'passed', runtimeRestartPersistence: 'passed', persistedEventReplay: 'passed', fixtureRuntimeInvocations: 5, explicitConfigurationDirectory: 'passed', unboundRuntimeBlocked: 'passed', oneTimeDirectoryBinding: 'passed', savedDirectoryDisplayedAndLocked: 'passed' });
  if (withInterventions) Object.assign(result, { constraintWithoutRun: 'passed', challengeFailurePreservesReport: 'passed', challengeCancellation: 'passed', challengeRevisionLink: 'passed', exactPreviousReportSnapshot: 'passed', constraintCarryForward: 'passed', constraintDeactivation: 'passed', interventionHistoryRestart: 'passed', immutableEarlierReport: 'passed', fixtureRuntimeInvocations: 9 });
  if (withRelease) Object.assign(result, { markdownDownload: 'passed', chosenVersionExport: 'passed', exportProvenanceAndLocators: 'passed', exportPathsOmitted: 'passed' });
  await writeFile(path.join(fixture, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ fixture, ...result }, null, 2));
} finally {
  page?.close();
  for (const child of children.reverse()) await stop(child);
}
