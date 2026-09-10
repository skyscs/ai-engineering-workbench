import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { execute } from './process.js';
import { RuntimeError, redact, type AIRunRequest, type RuntimeMetadata } from './types.js';

export const supportedVersions = ['codex-cli 0.153.4', 'codex-cli 0.154.0'];
export const disabledFeatures = ['apps', 'plugins', 'hooks', 'browser_use', 'computer_use', 'image_generation', 'multi_agent'];
export const restrictionArgs = ['-c', 'web_search="disabled"', '-c', 'notify=[]',
  ...disabledFeatures.flatMap((feature) => ['--disable', feature])];
async function stat(file: string) {
  try { return await lstat(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
/** Fingerprint metadata only: never parse or copy auth/config contents. */
export async function configurationState(request: AIRunRequest, env: NodeJS.ProcessEnv) {
  const home = await realpath(env.CODEX_HOME || path.join(homedir(), '.codex'));
  const profile = request.connection.configProfile;
  if (profile !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(profile)) throw new RuntimeError('INVALID_PROFILE', 'Invalid CLI profile selector.');
  const records: unknown[] = [];
  for (const name of ['config.toml', ...(profile === null ? [] : [`${profile}.config.toml`])]) {
    const file = path.join(home, name), info = await stat(file);
    if (!info) {
      if (name !== 'config.toml') throw new RuntimeError('MISSING_PROFILE', 'The selected CLI profile file is missing. No default fallback was attempted.');
      records.push([name, null]); continue;
    }
    if (!info.isFile() || info.nlink !== 1) throw new RuntimeError('INVALID_CONFIGURATION', 'CLI configuration must use regular files without links.');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    await handle.close();
    records.push([name, info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs]);
  }
  for (const root of request.readRoots) {
    if (!path.isAbsolute(root) || await realpath(root) !== root || !(await lstat(root)).isDirectory()) throw new RuntimeError('INVALID_READ_ROOT', 'Read roots must be canonical directories.');
    // Project configuration can override connection routing. This iteration rejects it.
    for (let dir = root; ; dir = path.dirname(dir)) {
      const config = path.join(dir, '.codex');
      if (config !== home && await stat(config)) throw new RuntimeError('PROJECT_CONFIGURATION', 'Project or ancestor .codex configuration is unsupported for investigation.');
      if (path.dirname(dir) === dir) break;
    }
  }
  if (!request.readRoots.includes(request.workingDirectory)) throw new RuntimeError('INVALID_READ_ROOT', 'The working directory must be a declared read root.');
  return createHash('sha256').update(JSON.stringify([home, records])).digest('hex');
}
export async function preflight(request: AIRunRequest, env: NodeJS.ProcessEnv): Promise<RuntimeMetadata> {
  if (process.platform !== 'linux' || request.accessMode !== 'read') throw new RuntimeError('UNSUPPORTED_POLICY', 'Only Linux read-only execution is verified.');
  const executable = request.connection.executablePath ?? 'codex';
  if (!executable || executable.startsWith('-') || executable.includes('\0')) throw new RuntimeError('CLI_UNAVAILABLE', 'Invalid Codex executable.');
  const diagnostic = async (args: string[]) => {
    let stdout = '', bytes = 0;
    // MCP diagnostics may contain secrets: discard stderr and never publish stdout.
    const outcome = await execute(executable, args, { cwd: request.workingDirectory, env, signal: request.signal, timeoutMs: 10000,
      stdout(chunk) { bytes += chunk.length; if (bytes > 1024 ** 2) throw new RuntimeError('CONFIGURATION_FAILED', 'CLI diagnostics exceeded the supported limit.'); stdout += chunk.toString(); },
      stderr(chunk) { bytes += chunk.length; if (bytes > 1024 ** 2) throw new RuntimeError('CONFIGURATION_FAILED', 'CLI diagnostics exceeded the supported limit.'); } });
    if (outcome.spawnError || outcome.exitCode !== 0) throw new RuntimeError(outcome.spawnError ? 'CLI_UNAVAILABLE' : 'CONFIGURATION_FAILED', 'Codex diagnostics failed. Check the executable and selected configuration.', outcome);
    return stdout;
  };
  const version = (await diagnostic(['--version'])).trim();
  if (!supportedVersions.includes(version)) throw new RuntimeError('UNSUPPORTED_VERSION', `Unsupported Codex CLI version: ${redact(version).slice(0, 128)}. No compatible execution was attempted.`);
  const fingerprint = await configurationState(request, env);
  const features = await diagnostic([...restrictionArgs, 'features', 'list']);
  for (const feature of disabledFeatures) if (!new RegExp(`^${feature}\\s+.*\\sfalse$`, 'm').test(features)) throw new RuntimeError('UNSUPPORTED_TOOLS', 'Codex did not confirm disabled external tools.');
  const profileArgs = request.connection.configProfile === null ? [] : ['--profile', request.connection.configProfile];
  const output = await diagnostic([...profileArgs, ...restrictionArgs, 'mcp', 'list', '--json']);
  let entries: unknown;
  try { entries = JSON.parse(output); } catch { throw new RuntimeError('CONFIGURATION_FAILED', 'Invalid MCP diagnostics.'); }
  if (!Array.isArray(entries) || entries.some((entry: unknown) => !entry || typeof entry !== 'object' || !('enabled' in entry) || entry.enabled !== false)) throw new RuntimeError('UNSUPPORTED_MCP', 'Enabled MCP servers are unsupported for read-only investigation.');
  if (await configurationState(request, env) !== fingerprint) throw new RuntimeError('CONFIGURATION_CHANGED', 'CLI configuration changed during preflight. Start a new run after reviewing it.');
  return { version, profile: request.connection.configProfile, configurationFingerprint: fingerprint, accessMode: 'read', enabledMcpServers: 0 };
}
