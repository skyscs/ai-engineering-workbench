import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preflight, restrictionArgs } from '../packages/ai/dist/preflight.js';

// Synthetic configuration and local diagnostics only: no model or real account access.
const root = await mkdtemp(path.join(tmpdir(), 'aew-config-boundary-'));
const home = path.join(root, '.codex-plus'), ancestor = path.join(root, '.codex');
const source = path.join(root, 'source'), cwd = path.join(root, '.local', 'share', 'worktrees', 'task', 'repo');
const env = { PATH: process.env.PATH, HOME: root, CODEX_HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
const executable = process.env.AEW_CODEX_EXECUTABLE || 'codex', exec = promisify(execFile);
const diagnostic = async args => (await exec(executable, args, { cwd, env, timeout: 10000 })).stdout;
const canary = name => `[mcp_servers.${name}]\ncommand="aew-never-execute-canary"\nenabled=false\n`;
const names = output => JSON.parse(output).map(entry => entry.name).sort();
try {
  await mkdir(home); await mkdir(ancestor); await mkdir(source);
  await mkdir(path.dirname(cwd), { recursive: true });
  const git = args => exec('git', args, { cwd: source, env, timeout: 10000 });
  await git(['init', '-q']);
  await git(['-c', 'user.name=Boundary Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'Create boundary fixture']);
  await git(['worktree', 'add', '--detach', cwd, 'HEAD']);
  await writeFile(path.join(root, '.custom-root'), '');
  const settings = `cli_auth_credentials_store="file"\nproject_root_markers=[".custom-root"]\n[projects.${JSON.stringify(root)}]\ntrust_level="trusted"\n[projects.${JSON.stringify(cwd)}]\ntrust_level="trusted"\n`;
  await writeFile(path.join(home, 'config.toml'), settings + canary('selected_base'));
  await writeFile(path.join(home, 'personal.config.toml'), settings + canary('selected_profile'));
  await writeFile(path.join(ancestor, 'config.toml'), canary('ancestor'));
  const request = { connection: { executablePath: executable, configHome: home, configProfile: null }, workingDirectory: cwd, readRoots: [cwd], accessMode: 'read', signal: new AbortController().signal };
  const version = (await diagnostic(['--version'])).trim();
  for (const profile of [null, 'personal']) {
    const profileArgs = profile === null ? [] : ['--profile', profile];
    const baseline = names(await diagnostic([...profileArgs, 'mcp', 'list', '--json']));
    assert.ok(baseline.includes('ancestor'), 'The control must actually load ancestor configuration.');
    assert.deepEqual(names(await diagnostic([...profileArgs, ...restrictionArgs, 'mcp', 'list', '--json'])), baseline.filter(name => name !== 'ancestor'));
    await preflight({ ...request, connection: { ...request.connection, configProfile: profile } }, env);
  }
  await writeFile(path.join(ancestor, 'config.toml'), '[invalid ancestor TOML');
  // A malformed ancestor is stronger evidence than a valid layer with no visible effect.
  await assert.rejects(diagnostic(['mcp', 'list', '--json']));
  for (const profile of [null, 'personal']) {
    await preflight({ ...request, connection: { ...request.connection, configProfile: profile } }, env);
  }
  await mkdir(path.join(cwd, '.codex'));
  await writeFile(path.join(cwd, '.codex', 'config.toml'), canary('project'));
  assert.ok(names(await diagnostic([...restrictionArgs, 'mcp', 'list', '--json'])).includes('project'), 'The cwd layer still needs the application guard.');
  await assert.rejects(preflight(request, env), error => error.failure?.code === 'PROJECT_CONFIGURATION');
  console.log(JSON.stringify({ version, modelRequests: 0, detachedWorktree: true, ancestorLoadedInControl: true,
    ancestorExcludedWithOverride: true, selectedBaseAndProfileRetained: true, customMarkersOverridden: true,
    malformedAncestorIgnored: true, projectLayerStillLoadedByCli: true, projectLayerRejectedByAdapter: true }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
