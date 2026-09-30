import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execute } from '../packages/ai/dist/process.js';

// This is a qualification experiment, never a production adapter or an account check.
// The only provider is a loopback server returning fixed synthetic responses.
const disabled = ['apps', 'plugins', 'hooks', 'browser_use', 'computer_use', 'image_generation',
  'multi_agent', 'multi_agent_v2', 'shell_tool', 'view_image', 'skill_search', 'shell_snapshot',
  'workspace_dependencies', 'unbounded_connection_retries', 'enable_request_compression', 'goals', 'sleep_tool'];
export const instructionCanaries = {
  ancestor: 'LOREDOCK_ANCESTOR_INSTRUCTIONS_CANARY',
  project: 'LOREDOCK_PROJECT_INSTRUCTIONS_CANARY',
  home: 'LOREDOCK_HOME_INSTRUCTIONS_CANARY',
};
const outputSchema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };

export function inspectRequest(request) {
  const tools = [];
  function visit(items, prefix = '') {
    for (const item of items ?? []) {
      if (item.type === 'namespace') visit(item.tools, `${prefix}${item.name}.`);
      else if (typeof item.name === 'string') tools.push(prefix + item.name);
      else tools.push(item.type ?? 'unknown');
    }
  }
  visit(request.tools);
  for (const item of request.input ?? []) if (item.type === 'additional_tools') visit(item.tools);
  const serialized = JSON.stringify(request);
  return { tools: [...new Set(tools)].sort(),
    instructionCanaries: Object.fromEntries(Object.entries(instructionCanaries).map(([key, value]) => [key, serialized.includes(value)])),
    schemaForwarded: JSON.stringify(request.text?.format?.schema) === JSON.stringify(outputSchema),
    strictSchema: request.text?.format?.strict === true,
    model: request.model ?? null };
}

export async function probeRuntime({ executable, sandboxHelper }) {
  if (!path.isAbsolute(executable ?? '') || !path.isAbsolute(sandboxHelper ?? '')) throw new Error('Explicit absolute executable and sandbox helper paths are required.');
  executable = await realpath(executable);
  sandboxHelper = await realpath(sandboxHelper);
  const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
  const identity = { executable, executableHash: await digest(executable), sandboxHelper, sandboxHelperHash: await digest(sandboxHelper) };
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-runtime-'));
  const input = path.join(root, 'input'), home = path.join(root, 'home'), configHome = path.join(root, 'config');
  let server;
  try {
    for (const directory of [input, home, configHome]) await mkdir(directory, { mode: 0o700 });
    const env = { HOME: home, CODEX_HOME: configHome, LANG: 'C.UTF-8',
      PATH: `${path.dirname(process.execPath)}:${path.dirname(executable)}:/usr/bin:/bin` };
    const normalize = value => value.replaceAll(root, '<probe>');
    async function run(args, { signal = new AbortController().signal, timeoutMs = 15000, stdin, stdout: observe } = {}) {
      let stdout = '', stderr = '', bytes = 0;
      const collect = (channel, chunk) => {
        bytes += chunk.length;
        if (bytes > 256 * 1024) throw new Error('Diagnostic output exceeded 256 KiB.');
        if (channel === 'stdout') { stdout += chunk.toString(); observe?.(stdout); } else stderr += chunk.toString();
      };
      try {
        const result = await execute(executable, args, { cwd: input, env, signal, timeoutMs, stdin,
          stdout: chunk => collect('stdout', chunk), stderr: chunk => collect('stderr', chunk) });
        return { ...result, stdout: normalize(stdout), stderr: normalize(stderr) };
      } catch (error) {
        return { exitCode: null, failure: error.failure?.code ?? 'PROBE_ERROR',
          stdout: normalize(stdout), stderr: normalize(stderr), message: normalize(error.message) };
      }
    }
    const version = await run(['--version']);
    const help = await run(['sandbox', '--help']);
    const execHelp = await run(['exec', '--help']);
    if (version.exitCode !== 0 || !/^codex-cli \d+\.\d+\.\d+\n?$/.test(version.stdout)) throw new Error('CLI version diagnostic failed.');
    const config = `cli_auth_credentials_store="file"\ndefault_permissions="loredock-probe"\n` +
      `[permissions.loredock-probe.filesystem]\n":minimal"="read"\n${JSON.stringify(input)}="read"\n${JSON.stringify(sandboxHelper)}="read"\n` +
      '[permissions.loredock-probe.network]\nenabled=false\n';
    await writeFile(path.join(configHome, 'config.toml'), config);
    const allowed = path.join(input, 'allowed.txt'), outside = path.join(root, 'outside.txt');
    await writeFile(allowed, 'LOREDOCK_ALLOWED_CANARY');
    await writeFile(outside, 'LOREDOCK_OUTSIDE_CANARY');
    await symlink(outside, path.join(input, 'outside-link'));
    const sandbox = command => run(['sandbox', '-P', 'loredock-probe', '-C', input, ...command]);
    const checks = {};
    const record = (name, result, expected) => { checks[name] = { passed: expected(result), ...result }; };
    record('insideRead', await sandbox(['/bin/cat', allowed]), r => r.exitCode === 0 && r.stdout === 'LOREDOCK_ALLOWED_CANARY');
    for (const [name, target] of [['outsideRead', outside], ['symlinkRead', path.join(input, 'outside-link')]]) {
      // A failing cat alone could mean that the sandbox itself never started.
      record(name, await sandbox(['/bin/sh', '-c', 'printf PROBE_STARTED; cat "$1"', 'probe', target]),
        r => r.exitCode !== 0 && r.exitCode !== null && r.stdout === 'PROBE_STARTED');
    }
    record('sourceWrite', await sandbox(['/bin/sh', '-c', 'printf PROBE_STARTED; printf changed > "$1"', 'probe', allowed]),
      r => r.exitCode !== 0 && r.exitCode !== null && r.stdout === 'PROBE_STARTED');
    record('childRead', await sandbox(['/bin/sh', '-c', 'printf PROBE_STARTED; /bin/sh -c \'cat "$1"\' probe "$1"', 'probe', outside]),
      r => r.exitCode !== 0 && r.exitCode !== null && r.stdout === 'PROBE_STARTED');
    const controller = new AbortController();
    record('cancellation', await run(['sandbox', '-P', 'loredock-probe', '-C', input, '/bin/sh', '-c', 'printf PROBE_READY; exec /bin/sleep 30'],
      { signal: controller.signal, stdout: text => { if (text.includes('PROBE_READY')) controller.abort(); } }),
      r => r.failure === 'CANCELLED' && r.stdout === 'PROBE_READY');
    const requests = [];
    let mode = 'success', connections = 0;
    server = createServer(async (request, response) => {
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 256 * 1024) { response.writeHead(413).end(); return; } chunks.push(chunk); }
      if (request.method !== 'POST' || request.url !== '/v1/responses' || requests.length >= 4) { response.writeHead(404).end(); return; }
      try { requests.push({ mode, inspection: inspectRequest(JSON.parse(Buffer.concat(chunks).toString())) }); }
      catch { response.writeHead(400).end(); return; }
      if (mode === 'error') { response.writeHead(400, { 'content-type': 'application/json' }).end('{"error":{"message":"Synthetic provider rejection","type":"invalid_request_error"}}'); return; }
      const item = { id: 'msg_probe', type: 'message', role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: '{"ok":true}', annotations: [] }] };
      const result = { id: 'resp_probe', object: 'response', status: 'completed', model: 'gpt-5.6-terra', output: [item],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } };
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const event of [
        { type: 'response.created', response: { ...result, status: 'in_progress', output: [] } },
        { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } },
        { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: '{"ok":true}' },
        { type: 'response.output_item.done', output_index: 0, item }, { type: 'response.completed', response: result },
      ]) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      response.end();
    });
    server.on('connection', () => connections++);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    // Positive control distinguishes a denied socket from a missing Python runtime/server.
    const connect = ['python3', '-c', 'import socket; print("PROBE_STARTED",flush=True); s=socket.create_connection(("127.0.0.1",int(__import__("sys").argv[1])),1); s.close(); print("CONNECTED")', String(port)];
    record('networkControl', await run(['sandbox', '-P', 'loredock-probe', '-c', 'permissions.loredock-probe.network.enabled=true', '-C', input, ...connect]),
      r => r.exitCode === 0 && r.stdout === 'PROBE_STARTED\nCONNECTED\n');
    const before = connections;
    record('networkDenied', await sandbox(connect), r => r.exitCode !== 0 && r.exitCode !== null && r.stdout === 'PROBE_STARTED\n' && connections === before);
    for (const [location, key] of [[root, 'ancestor'], [input, 'project'], [configHome, 'home']]) await writeFile(path.join(location, 'AGENTS.md'), instructionCanaries[key]);
    await writeFile(path.join(root, 'schema.json'), JSON.stringify(outputSchema));
    const provider = `model="gpt-5.6-terra"\nmodel_provider="probe"\nproject_doc_max_bytes=0\nproject_root_markers=[]\nweb_search="disabled"\nnotify=[]\n` +
      `[model_providers.probe]\nname="Synthetic loopback probe"\nbase_url="http://127.0.0.1:${port}/v1"\nwire_api="responses"\nrequires_openai_auth=false\nrequest_max_retries=0\nstream_max_retries=0\n` +
      `[features]\n${disabled.map(feature => `${feature}=false`).join('\n')}\n`;
    // Keep top-level keys outside the preceding tables.
    await writeFile(path.join(configHome, 'config.toml'), config.slice(0, config.indexOf('[permissions')) + provider + config.slice(config.indexOf('[permissions')));
    const featureState = await run(['features', 'list']);
    const flagsApplied = disabled.every(feature => new RegExp(`^${feature}\\s+.*\\sfalse$`, 'm').test(featureState.stdout));
    const args = ['--no-daemon', '-a', 'never', 'exec', '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '--json',
      '--output-schema', path.join(root, 'schema.json'), '-C', input, '-'];
    const structured = await run(args, { stdin: 'Synthetic protocol test: return {"ok":true}.' });
    mode = 'error';
    const rejected = await run(args, { stdin: 'Synthetic provider-error test.' });
    const unchanged = await readFile(allowed, 'utf8') === 'LOREDOCK_ALLOWED_CANARY' && await readFile(outside, 'utf8') === 'LOREDOCK_OUTSIDE_CANARY';
    const installationUnchanged = identity.executableHash === await digest(executable) && identity.sandboxHelperHash === await digest(sandboxHelper);
    return { schemaVersion: 'loredock-runtime-probe/1', date: new Date().toISOString(), nodeVersion: process.version, platform: process.platform,
      identity, cliVersion: version.stdout.trim(), modelRequests: 0, modelUsage: null,
      syntheticRequests: requests.length, syntheticUsageIsNotModelUsage: true,
      help: { sandboxProfile: help.stdout.includes('--permission-profile'), sandboxPlatformSubcommand: help.stdout.includes('sandbox linux'),
        ignoreUserConfig: execHelp.stdout.includes('--ignore-user-config'), structuredOutput: execHelp.stdout.includes('--output-schema') },
      checks, sourceBytesUnchanged: unchanged, installationUnchanged, disabledFeatures: disabled, flagsApplied,
      requests, structured, rejected,
      gate: 'not-qualified',
      unresolved: ['Exec tool-call enforcement is not proven by sandbox-helper results.',
        'Advertised tools require explicit qualification, including delegation and apply_patch.',
        'Home instructions and project configuration discovery need a production policy.',
        'No selected-account real-model run or frozen-question evaluation has been performed.'] };
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [flag, executable, helperFlag, sandboxHelper] = process.argv.slice(2);
  if (flag !== '--executable' || helperFlag !== '--sandbox-helper' || process.argv.length !== 6) throw new Error('Usage: loredock-runtime-probe.mjs --executable /path/to/codex --sandbox-helper /path/to/native/codex');
  console.log(JSON.stringify(await probeRuntime({ executable, sandboxHelper }), null, 2));
}
