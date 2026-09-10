import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
export const verifiedVersion = 'codex-cli 0.153.4';
export const disabledFeatures = ['apps', 'plugins', 'hooks', 'browser_use',
  'computer_use', 'image_generation', 'multi_agent'];
export const restrictionArgs = ['-c', 'web_search="disabled"', '-c', 'notify=[]',
  ...disabledFeatures.flatMap((feature) => ['--disable', feature])];

function failure(code, diagnostic) {
  return Object.assign(new Error(code), { code, diagnostic });
}

/** Check the verified CLI's profile file without reading configuration or secrets. */
export async function verifyProfile({ version, codexHome, profile = null }) {
  if (version !== verifiedVersion) throw failure('unsupported_version');
  if (profile === null) return { selection: 'default', profile: null };
  if (typeof profile !== 'string' || !/^[A-Za-z0-9_-]+$/.test(profile)) throw failure('invalid_profile');
  const file = path.join(codexHome, `${profile}.config.toml`);
  let handle;
  try {
    // Reject directories, symlinks and special files instead of following another location.
    if (!(await lstat(file)).isFile()) throw failure('unsupported_profile_file');
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!(await handle.stat()).isFile()) throw failure('unsupported_profile_file');
  } catch (error) {
    if (error.code === 'ENOENT') throw failure('missing_profile');
    if (error.code === 'EACCES' || error.code === 'EPERM') throw failure('unreadable_profile');
    throw error;
  } finally {
    await handle?.close();
  }
  return { selection: 'named', profile };
}

export async function runDiagnostic(args, { cwd, env = process.env } = {}) {
  try {
    const result = await exec('codex', args, { cwd, env, timeout: 10000, maxBuffer: 1024 * 1024 });
    return { exitCode: 0, ...result };
  } catch (error) {
    return { exitCode: Number.isInteger(error.code) ? error.code : null,
      stdout: error.stdout ?? '', stderr: error.stderr ?? '',
      spawnError: typeof error.code === 'string' ? error.code : null };
  }
}

/** Local diagnostics only: no AI request, MCP connection or credential parsing. */
export async function preflight({ cwd, env = process.env, profile = null } = {}) {
  const options = { cwd, env };
  const versionResult = await runDiagnostic(['--version'], options);
  if (versionResult.exitCode !== 0) throw failure('cli_unavailable', versionResult);
  const version = versionResult.stdout.trim();
  const selection = await verifyProfile({ version,
    codexHome: env.CODEX_HOME || path.join(homedir(), '.codex'), profile });
  const profileArgs = profile === null ? [] : ['--profile', profile];
  const args = [...profileArgs, ...restrictionArgs];
  // This CLI rejects --profile on `features list`. Check flag availability and
  // base effective states here; profile-aware parsing happens through `mcp list`.
  // The same explicit restrictions override profile values on exec.
  const features = await runDiagnostic([...restrictionArgs, 'features', 'list'], options);
  if (features.exitCode !== 0) throw failure('configuration_failed', features);
  for (const feature of disabledFeatures) {
    if (!new RegExp(`^${feature}\\s+.*\\sfalse$`, 'm').test(features.stdout)) {
      throw failure('unsupported_tool_configuration');
    }
  }
  // Do not persist this output: server entries may contain environment/header secrets.
  const servers = await runDiagnostic([...args, 'mcp', 'list', '--json'], options);
  if (servers.exitCode !== 0) throw failure('configuration_failed', servers);
  let entries;
  try { entries = JSON.parse(servers.stdout); } catch { throw failure('invalid_mcp_diagnostics'); }
  if (!Array.isArray(entries)) throw failure('invalid_mcp_diagnostics');
  if (entries.some((entry) => !entry || entry.enabled !== false)) throw failure('unsupported_mcp_configuration');
  return { version, ...selection, disabledFeatures, enabledMcpServers: 0,
    webSearch: 'disabled', externalNotification: 'disabled' };
}
