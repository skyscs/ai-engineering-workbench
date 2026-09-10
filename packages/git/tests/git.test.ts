import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { cloneSource, GitClient, GitError } from '../src/index.js';

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-git-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1' };
  const repo = path.join(root, 'source space 日本語'); mkdirSync(repo);
  const command = (args: string[], cwd = repo) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  command(['init', '-b', 'trunk']);
  const commit = () => { writeFileSync(path.join(repo, 'tracked.txt'), 'committed\n'); command(['add', '.']); command(['commit', '-m', 'Fixture commit']); };
  return { root, repo, env, command, commit, git: new GitClient({ env }) };
}

test('inspection canonicalizes paths and preserves dirty checkout, index, HEAD and configuration', async (t) => {
  const { root, repo, command, commit, git } = fixture(t); commit();
  writeFileSync(path.join(repo, 'tracked.txt'), 'staged\n'); command(['add', '.']);
  writeFileSync(path.join(repo, 'tracked.txt'), 'unstaged\n'); writeFileSync(path.join(repo, 'untracked'), 'leave me');
  command(['remote', 'add', 'origin', 'https://user:synthetic-token@example.invalid/repo?token=secret']);
  const files = ['.git/index', '.git/HEAD', '.git/config', 'tracked.txt', 'untracked'];
  const before = files.map((file) => readFileSync(path.join(repo, file)));
  const alias = path.join(root, 'alias'); symlinkSync(repo, alias, 'dir');
  const info = await git.inspect(alias, null);
  assert.equal(info.localPath, repo); assert.equal(info.baseRef, 'refs/heads/trunk');
  assert.equal(info.resolvedCommitSha, command(['rev-parse', 'HEAD']));
  assert.equal(info.remoteUrl, 'https://[redacted]@example.invalid/repo');
  assert.equal(info.shallow, false);
  files.forEach((file, i) => assert.deepEqual(readFileSync(path.join(repo, file)), before[i]));
});

test('linked checkouts share a canonical lock identity and concurrent mutations are rejected', async (t) => {
  const { root, repo, command, commit, git } = fixture(t); commit();
  const linked = path.join(root, 'linked'); command(['worktree', 'add', '--detach', linked]);
  const a = await git.inspect(repo, null), b = await git.inspect(linked, 'HEAD');
  assert.equal(a.commonGitDir, b.commonGitDir); assert.notEqual(a.localPath, b.localPath);
  let release!: () => void;
  const operation = git.exclusive(a.commonGitDir, () => new Promise<void>((resolve) => { release = resolve; }));
  await assert.rejects(git.exclusive(b.commonGitDir, async () => {}), { code: 'CONFLICT' });
  release(); await operation; await git.exclusive(a.commonGitDir, async () => {});
});

test('empty and remote-less repositories are valid, but detached or invalid base refs are explicit', async (t) => {
  const { repo, command, commit, git } = fixture(t);
  const empty = await git.inspect(repo, null);
  assert.equal(empty.baseRef, null); assert.equal(empty.resolvedCommitSha, null); assert.equal(empty.remoteUrl, null);
  await assert.rejects(git.inspect(repo, 'missing'), { code: 'INVALID_INPUT' });
  commit(); command(['checkout', '--detach']);
  await assert.rejects(git.inspect(repo, null), { code: 'INVALID_INPUT' });
  assert.ok((await git.inspect(repo, 'HEAD')).resolvedCommitSha);
  for (const ref of ['--unsafe', 'missing', 'bad ref']) await assert.rejects(git.inspect(repo, ref), { code: 'INVALID_INPUT' });
});

test('clone uses local transport without checkout or shared objects and reports shallow history', async (t) => {
  const { root, repo, command, commit, git } = fixture(t); commit();
  const destination = path.join(root, 'clone space');
  await git.clone(await cloneSource(repo), destination, root);
  const info = await git.inspect(destination, null);
  assert.equal(info.baseRef, 'refs/remotes/origin/trunk');
  assert.throws(() => readFileSync(path.join(destination, 'tracked.txt')), { code: 'ENOENT' });
  assert.throws(() => readFileSync(path.join(destination, '.git/objects/info/alternates')), { code: 'ENOENT' });
  const shallow = path.join(root, 'shallow'); command(['clone', '--depth=1', pathToFileURL(repo).href, shallow]);
  assert.equal((await git.inspect(shallow, null)).shallow, true);
});

test('invalid sources, missing Git and failed commands produce safe actionable errors', async (t) => {
  const { root, repo, git } = fixture(t);
  for (const source of ['--upload-pack=bad', 'ext::echo unsafe', 'http://example.invalid/repo', 'https://user:secret@example.invalid/repo', 'https://example.invalid/repo?token=secret', 'file://remote/tmp/repo']) {
    await assert.rejects(cloneSource(source), { code: 'INVALID_INPUT' });
  }
  assert.equal(await cloneSource('git@example.invalid:team/repo.git'), 'git@example.invalid:team/repo.git');
  await assert.rejects(git.inspect(root, null), (error: unknown) => error instanceof GitError && error.failure.exitCode === 128 && !!error.failure.stderr);
  await assert.rejects(new GitClient({ executable: path.join(root, 'missing-git') }).inspect(repo, null), (error: unknown) => error instanceof GitError && error.failure.code === 'GIT_UNAVAILABLE');
  const fake = path.join(root, 'fake-git');
  writeFileSync(fake, `#!${process.execPath}\nprocess.stderr.write('https://user:synthetic-secret@example.invalid/repo?token=secret'); process.exit(23);`, { mode: 0o700 });
  await assert.rejects(new GitClient({ executable: fake }).run([], root), (error: unknown) => {
    assert.ok(error instanceof GitError); assert.equal(error.failure.exitCode, 23);
    assert.ok(!error.failure.stderr.includes('secret')); return true;
  });
});

test('timeouts terminate an owned process group including a child that ignores SIGTERM', async (t) => {
  const { root } = fixture(t);
  const fake = path.join(root, 'slow-git'), pidFile = path.join(root, 'child.pid');
  writeFileSync(fake, `#!${process.execPath}\nimport {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs';\nconst child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"]); writeFileSync(${JSON.stringify(pidFile)}, String(child.pid)); setInterval(()=>{},1000);`, { mode: 0o700 });
  await assert.rejects(new GitClient({ executable: fake, timeoutMs: 300 }).run([], root), (error: unknown) => error instanceof GitError && error.failure.code === 'GIT_TIMEOUT');
  const pid = Number(readFileSync(pidFile, 'utf8'));
  // Signal delivery is asynchronous; init may retain the terminated child as a zombie.
  const deadline = Date.now() + 1000;
  while (true) {
    try { if (readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ')[2] === 'Z') break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error; }
    assert.ok(Date.now() < deadline, 'Owned child must terminate within the deadline.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
});

test('Git transport restrictions survive URL rewriting and inherited repository selectors are ignored', async (t) => {
  const { root, repo, env, commit } = fixture(t); commit();
  writeFileSync(path.join(root, '.gitconfig'), '[url "ext::unsupported "]\n\tinsteadOf = https://example.invalid/\n');
  const git = new GitClient({ env: { ...env, GIT_DIR: '/missing/injected', GIT_WORK_TREE: '/missing/injected', GIT_TRACE: '1' } });
  assert.equal((await git.inspect(repo, null)).localPath, repo);
  await assert.rejects(git.clone('https://example.invalid/repo', path.join(root, 'blocked'), root), (error: unknown) => {
    assert.ok(error instanceof GitError); assert.equal(error.failure.exitCode, 128);
    assert.match(error.failure.stderr, /transport 'ext' not allowed/); return true;
  });
  const ssh = path.join(root, 'fixture-ssh'), argumentsFile = path.join(root, 'ssh-arguments.json');
  writeFileSync(ssh, `#!${process.execPath}\nimport {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(argumentsFile)}, JSON.stringify(process.argv)); process.exit(1);`, { mode: 0o700 });
  writeFileSync(path.join(root, '.gitconfig'), `[core]\n\tsshCommand = ${ssh}\n`);
  await assert.rejects(git.clone('git@example.invalid:team/repo.git', path.join(root, 'ssh-failure'), root), GitError);
  const args = JSON.parse(readFileSync(argumentsFile, 'utf8')) as string[];
  assert.ok(args.includes('-oBatchMode=yes')); assert.ok(args.includes('-oStrictHostKeyChecking=yes'));
  assert.ok(args.some((value) => value.includes('git-upload-pack')));
});

test('fetch advances and prunes remote branches while preserving dirty checkout, local refs, tags and task pins', async (t) => {
  const { root, repo, command, commit, git } = fixture(t); commit();
  command(['branch', 'obsolete']);
  const remote = path.join(root, 'remote.git'), checkout = path.join(root, 'checkout');
  command(['clone', '--bare', repo, remote]); command(['clone', remote, checkout]);
  const old = command(['rev-parse', 'HEAD'], checkout);
  command(['update-ref', 'refs/aew/tasks/fixture', old], checkout);
  command(['tag', 'local-only'], checkout);
  command(['config', 'fetch.pruneTags', 'true'], checkout);
  command(['config', 'remote.origin.pruneTags', 'true'], checkout);
  command(['config', 'remote.origin.tagOpt', '--tags'], checkout);
  writeFileSync(path.join(checkout, 'tracked.txt'), 'staged'); command(['add', '.'], checkout);
  writeFileSync(path.join(checkout, 'tracked.txt'), 'dirty'); writeFileSync(path.join(checkout, 'untracked'), 'keep');
  writeFileSync(path.join(checkout, '.git/FETCH_HEAD'), 'previous fetch marker');
  const files = ['.git/HEAD', '.git/index', '.git/config', '.git/FETCH_HEAD', 'tracked.txt', 'untracked'];
  const before = files.map((file) => readFileSync(path.join(checkout, file)));
  writeFileSync(path.join(repo, 'next'), 'upstream'); command(['add', '.']); command(['commit', '-m', 'Upstream change']);
  command(['push', remote, 'trunk', ':obsolete']); command(['tag', 'new-upstream-tag']); command(['push', remote, '--tags']);
  const expected = await git.identity(checkout);
  await git.exclusive(expected.commonGitDir, async () => git.fetchAll(expected, await git.prepareFetch(expected)));
  assert.equal(command(['rev-parse', 'refs/remotes/origin/trunk'], checkout), command(['rev-parse', 'HEAD']));
  assert.equal(command(['rev-parse', 'refs/heads/trunk'], checkout), old);
  assert.equal(command(['rev-parse', 'refs/aew/tasks/fixture'], checkout), old);
  assert.equal(command(['rev-parse', 'refs/tags/local-only'], checkout), old);
  assert.throws(() => command(['show-ref', '--verify', 'refs/remotes/origin/obsolete'], checkout));
  assert.throws(() => command(['show-ref', '--verify', 'refs/tags/new-upstream-tag'], checkout));
  files.forEach((file, i) => assert.deepEqual(readFileSync(path.join(checkout, file)), before[i]));
  assert.equal((await git.inspect(checkout, 'refs/remotes/origin/obsolete', true)).resolvedCommitSha, null);
});

test('preflight rejects branch/tag/pin mappings, mirrored or skipped remotes and symbolic ref escapes', async (t) => {
  const { root, repo, command, commit, git } = fixture(t); commit();
  command(['remote', 'add', 'origin', path.join(root, 'offline.git')]);
  const expected = await git.identity(repo), initial = command(['rev-parse', 'HEAD']);
  for (const destination of ['refs/heads/*', 'refs/tags/*', 'refs/aew/tasks/*', 'refs/remotes/other/*']) {
    command(['config', 'remote.origin.fetch', `+refs/heads/*:${destination}`]);
    await assert.rejects(git.prepareFetch(expected), { code: 'INVALID_INPUT' });
    assert.equal(command(['rev-parse', 'HEAD']), initial);
  }
  command(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*']);
  for (const field of ['mirror', 'skipFetchAll', 'skipDefaultUpdate']) {
    command(['config', `remote.origin.${field}`, 'true']);
    await assert.rejects(git.prepareFetch(expected), { code: 'INVALID_INPUT' });
    command(['config', '--unset', `remote.origin.${field}`]);
  }
  command(['symbolic-ref', 'refs/remotes/origin/trunk', 'refs/heads/trunk']);
  await assert.rejects(git.prepareFetch(expected), { code: 'INVALID_INPUT' });
  command(['symbolic-ref', '--delete', 'refs/remotes/origin/trunk']);
  command(['update-ref', 'refs/remotes/origin/trunk', initial]);
  command(['symbolic-ref', 'refs/heads/alias', 'refs/remotes/origin/trunk']);
  await assert.rejects(git.prepareFetch(expected), { code: 'INVALID_INPUT' });
  command(['symbolic-ref', '--delete', 'refs/heads/alias']);
  command(['symbolic-ref', 'HEAD', 'refs/remotes/origin/trunk']);
  await assert.rejects(git.prepareFetch(expected), { code: 'INVALID_INPUT' });
  command(['symbolic-ref', 'HEAD', 'refs/heads/trunk']);
  assert.deepEqual(await git.prepareFetch(expected), ['origin']);
});

test('preflight refuses redirected canonical paths and empty repositories refresh without a remote', async (t) => {
  const { root, repo, command, commit, git } = fixture(t);
  const expected = await git.identity(repo);
  assert.deepEqual(await git.prepareFetch(expected), []);
  commit(); assert.ok((await git.inspect(repo, null, true)).resolvedCommitSha);
  const moved = path.join(root, 'moved'); renameSync(repo, moved); symlinkSync(moved, repo, 'dir');
  await assert.rejects(git.prepareFetch(expected), { code: 'CONFLICT' });
  assert.equal(command(['rev-parse', 'HEAD'], moved), (await git.inspect(moved, null)).resolvedCommitSha);
});

test('a multi-remote failure reports failure even when an earlier remote already updated', async (t) => {
  const { root, repo, command, commit, git } = fixture(t); commit();
  const remote = path.join(root, 'healthy.git'); command(['clone', '--bare', repo, remote]);
  command(['remote', 'add', 'a-healthy', remote]); command(['remote', 'add', 'z-missing', path.join(root, 'missing.git')]);
  const expected = await git.identity(repo);
  await assert.rejects(git.fetchAll(expected, await git.prepareFetch(expected)), (error: unknown) => {
    assert.ok(error instanceof GitError); assert.equal(error.failure.code, 'GIT_FAILED'); assert.ok(error.failure.stderr); return true;
  });
  assert.equal(command(['rev-parse', 'refs/remotes/a-healthy/trunk']), command(['rev-parse', 'HEAD']));
});
