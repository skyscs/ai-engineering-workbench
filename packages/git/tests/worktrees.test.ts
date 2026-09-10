import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { GitClient, WorktreeGit, type WorktreePlan } from '../src/index.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-worktree-git-')), source = path.join(root, 'source space 日本語'), managed = path.join(root, 'worktrees');
  mkdirSync(source); mkdirSync(managed);
  const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (args: string[], cwd = source) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, env, stdio: 'pipe', encoding: 'utf8' }).trim();
  git(['init', '-b', 'trunk']); writeFileSync(path.join(source, 'file'), 'committed\n'); writeFileSync(path.join(source, '.gitignore'), 'ignored\n');
  git(['add', '.']); git(['commit', '-m', 'Fixture commit']);
  const client = new GitClient({ env }), lifecycle = new WorktreeGit(client, managed);
  t.after(() => { client.stop(); rmSync(root, { recursive: true, force: true }); });
  const sha = git(['rev-parse', 'HEAD']);
  function plan(): WorktreePlan {
    const taskId = randomUUID(), repositoryId = randomUUID();
    return { sourcePath: source, commonGitDir: path.join(source, '.git'), worktreePath: path.join(managed, taskId, repositoryId),
      resolvedCommitSha: sha, managedPinRef: `refs/aew/tasks/${taskId}/${repositoryId}` };
  }
  async function prepare(p: WorktreePlan) { await lifecycle.pin(p, true); await lifecycle.create(p); await lifecycle.durable(p); }
  return { root, source, managed, env, git, client, lifecycle, plan, prepare, sha };
}

test('detached task worktrees coexist, preserve dirty source checkout and retain pins after cleanup and GC', async (t) => {
  const f = await fixture(t), a = f.plan(), b = f.plan();
  writeFileSync(path.join(f.source, 'file'), 'staged'); f.git(['add', 'file']); writeFileSync(path.join(f.source, 'file'), 'dirty');
  const files = ['.git/index', '.git/HEAD', '.git/config', 'file'], before = files.map((file) => readFileSync(path.join(f.source, file)));
  await f.prepare(a); await f.prepare(b);
  assert.equal(readFileSync(path.join(a.worktreePath, 'file'), 'utf8'), 'committed\n');
  assert.equal(f.git(['rev-parse', 'HEAD'], a.worktreePath), f.sha);
  assert.throws(() => f.git(['symbolic-ref', '--quiet', 'HEAD'], b.worktreePath));
  files.forEach((file, index) => assert.deepEqual(readFileSync(path.join(f.source, file)), before[index]));
  await f.lifecycle.remove(a); await f.lifecycle.remove(b);
  assert.ok(!existsSync(a.worktreePath)); assert.equal(f.git(['rev-parse', a.managedPinRef]), f.sha);
  const newRoot = f.git(['commit-tree', 'HEAD^{tree}', '-m', 'Replacement root']);
  f.git(['update-ref', 'refs/heads/trunk', newRoot]); f.git(['reflog', 'expire', '--expire=now', '--all']); f.git(['gc', '--prune=now']);
  assert.equal(f.git(['cat-file', '-t', f.sha]), 'commit');
  await f.prepare(a); assert.equal(f.git(['rev-parse', 'HEAD'], a.worktreePath), f.sha);
  assert.ok(existsSync(path.join(f.source, '.git')));
});

test('cleanup refuses tracked, untracked, ignored, hidden-index and attached-branch changes', async (t) => {
  const f = await fixture(t), plan = f.plan(); await f.prepare(plan);
  for (const filename of ['file', 'untracked', 'ignored']) {
    writeFileSync(path.join(plan.worktreePath, filename), 'preserve this');
    await assert.rejects(f.lifecycle.remove(plan), /modified, untracked or ignored/);
    assert.equal(readFileSync(path.join(plan.worktreePath, filename), 'utf8'), 'preserve this');
    if (filename === 'file') writeFileSync(path.join(plan.worktreePath, filename), 'committed\n'); else unlinkSync(path.join(plan.worktreePath, filename));
  }
  f.git(['update-index', '--assume-unchanged', 'file'], plan.worktreePath);
  await assert.rejects(f.lifecycle.remove(plan), /hidden or sparse/);
  f.git(['update-index', '--no-assume-unchanged', 'file'], plan.worktreePath);
  f.git(['switch', '-c', 'external-branch'], plan.worktreePath);
  await assert.rejects(f.lifecycle.remove(plan), /registration/);
  f.git(['checkout', '--detach'], plan.worktreePath); await f.lifecycle.remove(plan);
});

test('cleanup refuses source checkout, unknown destinations, symlinked parents and modified Git markers', async (t) => {
  const f = await fixture(t), plan = f.plan(); await f.prepare(plan);
  await assert.rejects(f.lifecycle.remove({ ...plan, worktreePath: f.source }), /outside/);
  const parent = path.dirname(plan.worktreePath); renameSync(parent, `${parent}.original`); symlinkSync(`${parent}.original`, parent);
  await assert.rejects(f.lifecycle.remove(plan), /redirected/);
  unlinkSync(parent); renameSync(`${parent}.original`, parent);
  const marker = path.join(plan.worktreePath, '.git'); renameSync(marker, `${marker}.original`); symlinkSync(`${marker}.original`, marker);
  await assert.rejects(f.lifecycle.remove(plan), /regular Git marker/);
  unlinkSync(marker); renameSync(`${marker}.original`, marker);
  const unknown = f.plan(); mkdirSync(unknown.worktreePath, { recursive: true }); writeFileSync(path.join(unknown.worktreePath, 'keep'), 'unknown');
  await assert.rejects(f.lifecycle.create(unknown), /already exists/);
  assert.equal(readFileSync(path.join(unknown.worktreePath, 'keep'), 'utf8'), 'unknown');
});

test('pins never overwrite existing refs or dereference a symbolic ref and checkout filters are rejected', async (t) => {
  const f = await fixture(t), plan = f.plan();
  f.git(['symbolic-ref', plan.managedPinRef, 'refs/heads/trunk']);
  await assert.rejects(f.lifecycle.pin(plan, true), /symbolic ref/);
  assert.equal(f.git(['rev-parse', 'refs/heads/trunk']), f.sha);
  f.git(['symbolic-ref', '--delete', plan.managedPinRef]);
  const other = f.git(['commit-tree', 'HEAD^{tree}', '-m', 'Other commit']); f.git(['update-ref', plan.managedPinRef, other]);
  await assert.rejects(f.lifecycle.pin(plan, true), /has changed/);
  assert.equal(f.git(['rev-parse', plan.managedPinRef]), other);
  f.git(['config', 'filter.fixture.smudge', 'unavailable-fixture-command']);
  const filtered = f.plan(); await f.lifecycle.pin(filtered, true);
  await assert.rejects(f.lifecycle.create(filtered), /checkout filters/);
  assert.equal(existsSync(filtered.worktreePath), false);
});

test('verification refuses initializing or missing registrations and permits tracked symlinks without following targets', async (t) => {
  const f = await fixture(t);
  symlinkSync('/nonexistent-fixture-target', path.join(f.source, 'link')); f.git(['add', 'link']); f.git(['commit', '-m', 'Tracked link']);
  const plan = { ...f.plan(), resolvedCommitSha: f.git(['rev-parse', 'HEAD']) }; await f.prepare(plan);
  f.git(['worktree', 'lock', '--reason', 'initializing', plan.worktreePath]);
  await assert.rejects(f.lifecycle.verify(plan), /lock state/);
  f.git(['worktree', 'unlock', plan.worktreePath]); await f.lifecycle.verify(plan);
  renameSync(plan.worktreePath, `${plan.worktreePath}.moved`);
  await assert.rejects(f.lifecycle.verify(plan), /missing/);
  assert.equal(await f.lifecycle.absent(plan), false);
});

test('explicit system-config isolation excludes host filters while ordinary configuration still rejects them', async (t) => {
  const f = await fixture(t), config = path.join(f.root, 'system.gitconfig'), wrapper = path.join(f.root, 'system-git');
  writeFileSync(config, '[filter "host-fixture"]\nsmudge = unavailable-fixture-command\n');
  // Emulate a host system config without writing outside the fixture directory.
  writeFileSync(wrapper, `#!${process.execPath}\nconst { spawnSync } = require('node:child_process');\nconst result = spawnSync('git', process.argv.slice(2), {env: {...process.env, GIT_CONFIG_SYSTEM: ${JSON.stringify(config)}}, stdio: 'inherit'});\nprocess.exit(result.status ?? 1);\n`, { mode: 0o700 });
  const isolated = new GitClient({ executable: wrapper, env: f.env });
  const lifecycle = new WorktreeGit(isolated, f.managed), plan = f.plan();
  await lifecycle.pin(plan, true); await lifecycle.create(plan); await lifecycle.verify(plan);
  isolated.stop();
  const ordinaryEnv = { ...f.env, GIT_CONFIG_NOSYSTEM: '0' };
  const ordinary = new GitClient({ executable: wrapper, env: ordinaryEnv });
  try { await assert.rejects(new WorktreeGit(ordinary, f.managed).create(f.plan()), /checkout filters/); }
  finally { ordinary.stop(); }
});
