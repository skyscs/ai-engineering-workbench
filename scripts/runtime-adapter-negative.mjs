import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preflight } from '../packages/ai/dist/preflight.js';

// Local diagnostics only. No model request or normal authentication file access.
const root = await mkdtemp(path.join(tmpdir(), 'aew-adapter-negative-')), home = path.join(root, 'config'), cwd = path.join(root, 'repo');
await mkdir(home); await mkdir(cwd);
await writeFile(path.join(home, 'config.toml'), 'cli_auth_credentials_store="file"\n');
const env = { PATH: process.env.PATH, CODEX_HOME: home };
const request = { connection: { executablePath: process.env.AEW_CODEX_EXECUTABLE || null, configProfile: null, configHome: home }, workingDirectory: cwd, readRoots: [cwd], accessMode: 'read', signal: new AbortController().signal };
const executable = request.connection.executablePath ?? 'codex', exec = promisify(execFile);
const diagnostic = async args => {
  try { return { ...(await exec(executable, args, { cwd, env, timeout: 10000 })), exitCode: 0 }; }
  catch (error) { return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', exitCode: error.code }; }
};
const metadata = await preflight(request, env);
const auth = await diagnostic(['login', 'status']); assert.equal(auth.exitCode, 1); assert.match(auth.stdout + auth.stderr, /not logged in/i);
await writeFile(path.join(home, 'canary.config.toml'), '[mcp_servers.canary]\ncommand="aew-nonexistent-canary"\nenabled=false\n');
const base = await diagnostic(['mcp', 'list', '--json']), named = await diagnostic(['--profile', 'canary', 'mcp', 'list', '--json']);
assert.deepEqual(JSON.parse(base.stdout), []); assert.equal(JSON.parse(named.stdout)[0].name, 'canary');
await preflight({ ...request, connection: { ...request.connection, configProfile: 'canary' } }, env);
for (const [profile, contents, code] of [['absent', null, 'MISSING_PROFILE'], ['invalid', '[features\n', 'CONFIGURATION_FAILED'],
  ['mcp', '[mcp_servers.fixture]\ncommand="touch"\nargs=["MCP_MUST_NOT_START"]\nenabled=true\n', 'UNSUPPORTED_MCP']]) {
  if (contents !== null) await writeFile(path.join(home, `${profile}.config.toml`), contents);
  await assert.rejects(preflight({ ...request, connection: { ...request.connection, configProfile: profile } }, env), error => error.failure?.code === code);
}
await assert.rejects(access(path.join(cwd, 'MCP_MUST_NOT_START')), { code: 'ENOENT' });
const unsupported = await diagnostic(['exec', '--aew-intentionally-unsupported-flag']); assert.equal(unsupported.exitCode, 2);
const result = { version: metadata.version, modelRequests: 0, missingLogin: true, namedProfileLoading: true, missingProfileRejected: true,
  malformedProfileRejected: true, enabledMcpRejectedWithoutExecution: true, unsupportedFlagRejected: true };
await writeFile(path.join(root, 'negative-result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ root, ...result }, null, 2));
