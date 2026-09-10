import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classifyFailure } from './runtime-outcome.mjs';
import { preflight, runDiagnostic, verifiedVersion, verifyProfile } from './runtime-preflight.mjs';

// Opt-in local CLI checks; no model invocation and no access to user credentials.
const root = await mkdtemp(path.join(tmpdir(), 'aew-runtime-negative-'));
const configRoot = path.join(root, 'config');
await mkdir(configRoot, { mode: 0o700 });
// CODEX_HOME here is the CLI's documented child-process setting, not a change to
// the parent shell. An allowlist excludes inherited tokens and keyring settings.
const env = { PATH: process.env.PATH, CODEX_HOME: configRoot };
const options = { cwd: root, env };
await writeFile(path.join(configRoot, 'config.toml'), 'cli_auth_credentials_store="file"\n');
await writeFile(path.join(configRoot, 'canary.config.toml'),
  '[mcp_servers.canary]\ncommand="aew-nonexistent-canary"\nenabled=false\n');
const version = await runDiagnostic(['--version'], options);
assert.equal(version.stdout.trim(), verifiedVersion);

const auth = await runDiagnostic(['login', 'status'], options);
const authKind = classifyFailure({ events: [], ...auth });
assert.notEqual(auth.exitCode, 0);
assert.equal(authKind, 'authentication_required');
const selected = await verifyProfile({ version: verifiedVersion, codexHome: configRoot, profile: 'canary' });
const base = await runDiagnostic(['mcp', 'list', '--json'], options);
const named = await runDiagnostic(['--profile', 'canary', 'mcp', 'list', '--json'], options);
assert.equal(base.exitCode, 0);
assert.equal(named.exitCode, 0);
assert.deepEqual(JSON.parse(base.stdout), []);
assert.equal(JSON.parse(named.stdout).length, 1);
assert.equal(JSON.parse(named.stdout)[0].name, 'canary');
assert.equal(JSON.parse(named.stdout)[0].enabled, false);
await preflight({ ...options, profile: 'canary' });
await assert.rejects(preflight({ ...options, profile: 'absent' }), { code: 'missing_profile' });

// Invalid profile syntax must fail CLI configuration diagnostics before exec.
await writeFile(path.join(configRoot, 'invalid.config.toml'), '[features\n');
await assert.rejects(preflight({ ...options, profile: 'invalid' }), { code: 'configuration_failed' });
const clean = await preflight(options);
// The configured MCP command would create a marker if started; list must not run it.
await writeFile(path.join(configRoot, 'mcp.config.toml'),
  '[mcp_servers.fixture]\ncommand="touch"\nargs=["MCP_MUST_NOT_START"]\nenabled=true\n');
await assert.rejects(preflight({ ...options, profile: 'mcp' }), { code: 'unsupported_mcp_configuration' });
await assert.rejects(access(path.join(root, 'MCP_MUST_NOT_START')), { code: 'ENOENT' });

const result = { version: verifiedVersion, modelRequests: 0,
  missingAuth: { command: 'login status', exitCode: auth.exitCode, failureKind: authKind },
  profileLayer: { ...selected, baseCanaryPresent: false, namedDisabledCanaryPresent: true },
  missingProfile: 'rejected_before_exec', invalidProfile: 'rejected_before_exec',
  enabledMcp: 'rejected_without_starting_server', cleanConfiguration: clean, scenarioPassed: true };
await writeFile(path.join(root, 'negative-probes.result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ root, ...result }, null, 2));
