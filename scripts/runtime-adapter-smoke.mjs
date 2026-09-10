import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFixture, snapshot } from './runtime-fixture.mjs';
import { CodexCliRuntime } from '../packages/ai/dist/index.js';
import { GitClient } from '../packages/git/dist/index.js';
import { openStorage } from '../packages/storage/dist/index.js';
import { RepositoryService } from '../apps/daemon/dist/repository-service.js';
import { WorktreeService } from '../apps/daemon/dist/worktree-service.js';
import { RuntimeService, previewSchema, validatePreview } from '../apps/daemon/dist/runtime-service.js';

// Explicitly opt in: the real scenario can consume the selected account's allowance.
if (!process.env.AEW_CODEX_HOME) throw new Error('Set AEW_CODEX_HOME explicitly to the intended configuration directory. No inherited default is used.');
const preflightOnly = process.argv.includes('--preflight');
if (!preflightOnly && process.env.AEW_REAL_RUNTIME !== '1') throw new Error('Set AEW_REAL_RUNTIME=1 to run the selected real CLI connection.');
const fixture = await createFixture(), baseline = await snapshot(fixture);
const storage = openStorage({ dataRoot: path.join(fixture.root, 'data') }), git = new GitClient();
const repos = new RepositoryService(storage, git), worktrees = new WorktreeService(storage, git);
const runtime = new CodexCliRuntime({ timeoutMs: 180000 }), service = new RuntimeService(storage, runtime, git);
async function terminal(id) {
  const deadline = Date.now() + 190000;
  while (Date.now() < deadline) {
    const run = storage.tasks.getRun(workspaceId, task.id, id);
    if (!['queued', 'running'].includes(run.status)) return run;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Fixture deadline exceeded.');
}
let workspaceId, task;
try {
  workspaceId = storage.settings.createWorkspace({ name: 'Runtime acceptance', connection: { name: 'Explicit CLI connection', configHome: process.env.AEW_CODEX_HOME, executablePath: process.env.AEW_CODEX_EXECUTABLE || null } }).workspace.id;
  const profile = storage.settings.createModelProfile(workspaceId, { name: 'Selected Terra', modelIdentifier: 'gpt-5.6-terra', reasoningEffort: 'medium' });
  const repositoryIds = [];
  for (const [name, source] of [['Client', fixture.client], ['Service', fixture.service]]) repositoryIds.push((await repos.register(workspaceId, { name, source })).id);
  task = storage.tasks.create(workspaceId, { title: 'Timeout regression', description: 'Investigate why the timeout fell from 5000ms to 5ms after the service configuration update. Inspect both repositories and their history, and use the selected incident log. Do not implement a fix.', repositoryIds });
  const bytes = await readFile(fixture.artifact);
  const artifact = await storage.tasks.artifacts.import(workspaceId, task.id, { name: 'request.log', mimeType: 'text/plain', size: bytes.length }, new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }));
  storage.tasks.artifacts.selectContext(workspaceId, task.id, [{ artifactId: artifact.id, start: 0, end: bytes.length }]);
  assert.equal((await terminal(worktrees.start(workspaceId, task.id).id)).status, 'succeeded');
  console.log(JSON.stringify({ fixture: fixture.root, workspaceId, taskId: task.id, phase: preflightOnly ? 'preflight' : 'real-run' }));
  if (preflightOnly) {
    const connection = storage.settings.getWorkspace(workspaceId).connection;
    const roots = storage.tasks.worktrees.list(workspaceId, task.id).map(row => row.worktreePath);
    const iterator = runtime.run({ workspaceId, taskId: task.id, stageRunId: 'diagnostic', connection, profile, workingDirectory: roots[0], readRoots: roots,
      contextManifest: {}, instructions: '', outputSchemaVersion: 'runtime-preview-v1', outputSchema: previewSchema, validateResult: validatePreview, accessMode: 'read', signal: new AbortController().signal })[Symbol.asyncIterator]();
    const event = await iterator.next(); assert.equal(event.value.type, 'runtime'); console.log(JSON.stringify(event.value)); await iterator.return();
  } else {
    const started = service.start(workspaceId, task.id, { modelProfileId: profile.id });
    const run = await terminal(started.id), output = storage.tasks.journal.detail(workspaceId, task.id, run.id);
    const unchanged = JSON.stringify(baseline) === JSON.stringify(await snapshot(fixture));
    const result = { runStatus: run.status, error: run.error, metadata: output.metadata, model: run.inputSnapshot.profile.modelIdentifier,
      reasoningEffort: run.inputSnapshot.profile.reasoningEffort, unchanged, result: output.result, events: storage.tasks.journal.events(workspaceId, task.id, run.id).map(event => event.type) };
    await writeFile(path.join(fixture.root, 'adapter-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2)); assert.equal(run.status, 'succeeded'); assert.ok(unchanged); assert.ok(validatePreview(output.result));
  }
} finally { await service.close(); await worktrees.close(); await repos.close(); storage.close(); }
