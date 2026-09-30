import { createHash } from 'node:crypto';
import { lstat, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { execute } from './process.js';
import { RuntimeError, redact } from './types.js';
import { textCliVersion, textDisabledFeatures, textPolicyVersion, textRestrictionArgs } from './text-policy.js';

export interface TextConnection { executable: string; configHome: string; profile: string | null }
export interface TextRuntimeIdentity extends TextConnection { version: string; policyVersion: string; configurationFingerprint: string }
export interface TextUsage { inputTokens: number; outputTokens: number; cachedInputTokens: number | null }
export interface TextOutput { text: string; usage: TextUsage | null; usageUnknownReason: string | null }
export interface TextRequest { prompt: string; schema: Record<string, unknown>; model: string; effort: 'medium'; signal: AbortSignal }
export interface PreparedTextRuntime {
  identity: TextRuntimeIdentity;
  run(request: TextRequest): Promise<TextOutput>;
  close(): Promise<void>;
}
export interface TextRuntime { prepare(connection: TextConnection, signal: AbortSignal): Promise<PreparedTextRuntime> }
const cap = 256 * 1024;
async function info(file: string) {
  try { return await lstat(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export async function assertNoProjectConfiguration(directory: string): Promise<void> {
  for (let ancestor = directory; ; ancestor = path.dirname(ancestor)) {
    if (await info(path.join(ancestor, '.codex'))) throw new RuntimeError('PROJECT_CONFIGURATION', 'The runtime directory has project or ancestor .codex configuration.');
    if (path.dirname(ancestor) === ancestor) return;
  }
}

export async function textConfigurationFingerprint(connection: TextConnection): Promise<string> {
  if (!path.isAbsolute(connection.executable) || !path.isAbsolute(connection.configHome)
    || (connection.profile !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(connection.profile))) throw new RuntimeError('CONFIGURATION_REQUIRED', 'Select an absolute executable and configuration directory.');
  const records: unknown[] = [];
  for (const file of [connection.executable, connection.configHome]) {
    if (await realpath(file) !== file) throw new RuntimeError('CONFIGURATION_CHANGED', 'The saved connection path is redirected. Select its canonical path explicitly.');
    const stat = await lstat(file);
    if (file === connection.configHome ? !stat.isDirectory() : !stat.isFile()) throw new RuntimeError('CONFIGURATION_REQUIRED', 'The saved connection paths are unavailable.');
  }
  for (const name of ['AGENTS.md', 'AGENTS.override.md']) if (await info(path.join(connection.configHome, name))) {
    throw new RuntimeError('GLOBAL_INSTRUCTIONS', 'This configuration directory contains global agent instructions. Text-only execution requires a configuration without global AGENTS files.');
  }
  for (const file of [connection.executable, path.join(connection.configHome, 'config.toml'),
    ...connection.profile === null ? [] : [path.join(connection.configHome, `${connection.profile}.config.toml`)]]) {
    const stat = await info(file);
    if (!stat) {
      if (path.basename(file) !== 'config.toml') throw new RuntimeError('CONFIGURATION_REQUIRED', 'A selected configuration file is missing.');
      records.push([file, null]); continue;
    }
    if (!stat.isFile() || stat.nlink !== 1) throw new RuntimeError('CONFIGURATION_REQUIRED', 'Configuration and launcher files must be regular files without links.');
    records.push([file, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs]);
  }
  // Never open authentication stores or copy credentials. Only configuration metadata
  // is fingerprinted; a directory is a user-selected connection, not account proof.
  return createHash('sha256').update(JSON.stringify([connection, records])).digest('hex');
}

export function parseTextOutput(stdout: string): TextOutput {
  let final: string | undefined, complete = false, failed = false, usage: TextUsage | null = null;
  for (const line of stdout.split('\n').filter(line => line.trim())) {
    let value: Record<string, unknown>;
    try { value = JSON.parse(line) as Record<string, unknown>; if (!value || typeof value.type !== 'string') throw new Error(); }
    catch { throw new RuntimeError('INVALID_JSONL', 'Codex returned malformed events.'); }
    const item = value.item as Record<string, unknown> | undefined;
    // This pinned CLI reports successful skill-catalog suppression as an error item.
    // Accept only that exact diagnostic; provider/protocol errors remain fatal.
    const suppressedSkills = item?.type === 'error' && typeof item.message === 'string'
      && /^Exceeded skills context budget\. All skill descriptions were removed and \d+ additional skills were not included in the model-visible skills list\.$/.test(item.message);
    if (value.type === 'error' || value.type === 'turn.failed' || (item?.type === 'error' && !suppressedSkills)) failed = true;
    if (value.type === 'item.completed' && item?.type === 'agent_message') {
      if (complete || typeof item.text !== 'string') throw new RuntimeError('INVALID_RESULT', 'Codex returned an invalid final message.');
      final = item.text;
    }
    if (value.type === 'turn.completed') {
      if (complete) throw new RuntimeError('INVALID_RESULT', 'More than one completed turn was returned.');
      complete = true;
      const valueUsage = value.usage as Record<string, unknown> | undefined;
      const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
      if (valueUsage && count(valueUsage.input_tokens) && count(valueUsage.output_tokens)) usage = {
        inputTokens: valueUsage.input_tokens, outputTokens: valueUsage.output_tokens,
        cachedInputTokens: count(valueUsage.cached_input_tokens) ? valueUsage.cached_input_tokens : null,
      };
    }
  }
  if (failed || !complete || final === undefined) throw new RuntimeError('INCOMPLETE_RESULT', 'Codex did not complete a valid answer turn.');
  return { text: final, usage, usageUnknownReason: usage ? null : 'The CLI did not report valid token usage.' };
}

/** A single text-only invocation; no Workbench task, worktree or storage dependency. */
export class CodexTextRuntime implements TextRuntime {
  constructor(private readonly inherited: NodeJS.ProcessEnv = process.env) {}
  async prepare(connection: TextConnection, signal: AbortSignal): Promise<PreparedTextRuntime> {
    if (process.platform !== 'linux') throw new RuntimeError('UNSUPPORTED_PLATFORM', 'Text-only Codex is qualified on Linux only.');
    for (const name of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_ORG_ID', 'OPENAI_ORGANIZATION', 'OPENAI_PROJECT_ID']) {
      if (this.inherited[name]) throw new RuntimeError('AMBIENT_AUTH_OVERRIDE', 'Remove inherited provider overrides before selecting a saved connection.');
    }
    const fingerprint = await textConfigurationFingerprint(connection);
    const directory = await mkdtemp(path.join(tmpdir(), 'loredock-text-'));
    const env = { PATH: this.inherited.PATH, HOME: homedir(), LANG: 'C.UTF-8', CODEX_HOME: connection.configHome };
    const profile = connection.profile === null ? [] : ['--profile', connection.profile];
    let closed = false, used = false;
    const close = async () => { if (!closed) { closed = true; await rm(directory, { recursive: true, force: true }); } };
    async function command(args: string[], signal: AbortSignal, timeoutMs: number, stdin?: string) {
      const out = new StringDecoder('utf8'), err = new StringDecoder('utf8');
      let stdout = '', stderr = '', bytes = 0;
      const collect = (chunk: Buffer, stdoutChannel: boolean) => {
        bytes += chunk.length;
        if (bytes > cap) throw new RuntimeError('OUTPUT_LIMIT', 'Codex output exceeded 256 KiB.');
        if (stdoutChannel) stdout += out.write(chunk); else stderr += err.write(chunk);
      };
      const result = await execute(connection.executable, args, { cwd: directory, env, signal, timeoutMs,
        ...stdin === undefined ? {} : { stdin }, stdout: chunk => collect(chunk, true), stderr: chunk => collect(chunk, false) });
      stdout += out.end(); stderr += err.end();
      return { ...result, stdout, stderr: redact(stderr).slice(-4096) };
    }
    try {
      // Owned, empty cwd plus disabled project document discovery prevents source
      // repositories from becoming executable configuration or agent instructions.
      await assertNoProjectConfiguration(directory);
      const version = await command(['--version'], signal, 10000);
      if (version.exitCode !== 0 || version.stdout.trim() !== textCliVersion) throw new RuntimeError('UNQUALIFIED_CLI', `This text policy requires ${textCliVersion}.`, { exitCode: version.exitCode, stderr: version.stderr });
      const features = await command([...profile, ...textRestrictionArgs, 'features', 'list'], signal, 10000);
      if (features.exitCode !== 0 || !textDisabledFeatures.every(feature => new RegExp(`^${feature}\\s+.*\\sfalse$`, 'm').test(features.stdout))) throw new RuntimeError('UNSUPPORTED_RESTRICTIONS', 'Codex did not confirm the required disabled features.');
      const mcp = await command([...profile, ...textRestrictionArgs, 'mcp', 'list', '--json'], signal, 10000);
      let servers: unknown;
      try { servers = JSON.parse(mcp.stdout) as unknown; } catch { throw new RuntimeError('MCP_CONFIGURATION', 'Unable to verify disabled MCP servers.'); }
      if (mcp.exitCode !== 0 || !Array.isArray(servers) || servers.some(server => !server || typeof server !== 'object' || (server as { enabled?: unknown }).enabled !== false)) throw new RuntimeError('MCP_CONFIGURATION', 'Disable MCP servers in the selected configuration before text-only execution.');
      if (await textConfigurationFingerprint(connection) !== fingerprint) throw new RuntimeError('CONFIGURATION_CHANGED', 'Configuration changed during preflight.');
      const identity: TextRuntimeIdentity = { ...connection, version: textCliVersion, policyVersion: textPolicyVersion, configurationFingerprint: fingerprint };
      return { identity, close, run: async (request: TextRequest) => {
        if (closed || used) throw new RuntimeError('ALREADY_DISPATCHED', 'A prepared runtime can be dispatched only once.');
        used = true;
        if (request.model !== 'gpt-5.6-terra' || request.effort !== 'medium') throw new RuntimeError('UNQUALIFIED_MODEL', 'This pilot qualifies gpt-5.6-terra with medium reasoning only.');
        if (Buffer.byteLength(request.prompt, 'utf8') > 96 * 1024) throw new RuntimeError('INPUT_LIMIT', 'The complete prompt exceeds 96 KiB.');
        if (await textConfigurationFingerprint(connection) !== fingerprint) throw new RuntimeError('CONFIGURATION_CHANGED', 'Configuration changed before dispatch.');
        const schema = path.join(directory, 'answer.schema.json');
        await writeFile(schema, JSON.stringify(request.schema), { mode: 0o600 });
        const result = await command(['--no-daemon', ...profile, ...textRestrictionArgs, '-a', 'never', 'exec',
          '--sandbox', 'read-only', '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '--json', '--color', 'never',
          '--model', request.model, '-c', `model_reasoning_effort=${JSON.stringify(request.effort)}`,
          '-C', directory, '--output-schema', schema, '-'], request.signal, 120000, request.prompt);
        if (result.exitCode !== 0 || result.spawnError) throw new RuntimeError('CLI_FAILED', 'Codex text execution failed.', { exitCode: result.exitCode, signal: result.signal, stderr: result.stderr });
        return parseTextOutput(result.stdout);
      } };
    } catch (error) { await close(); throw error; }
  }
}
