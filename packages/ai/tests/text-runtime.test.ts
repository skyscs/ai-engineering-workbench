import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { CodexTextRuntime, parseTextOutput, textConfigurationFingerprint, assertNoProjectConfiguration, type TextConnection } from '../src/text-runtime.js';
import { textCliVersion, textDisabledFeatures } from '../src/text-policy.js';

const output = (text = '{"ok":true}', usage: unknown = { input_tokens: 11, output_tokens: 7, cached_input_tokens: 3 }) =>
  JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }) + '\n' + JSON.stringify({ type: 'turn.completed', usage }) + '\n';
async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'text-runtime-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'codex'), configHome = path.join(directory, 'config');
  await mkdir(configHome);
  await writeFile(path.join(configHome, 'config.toml'), '');
  const script = `#!/usr/bin/env node
const args=process.argv.slice(2);
if(args.includes('--version')) console.log(${JSON.stringify(textCliVersion)});
else if(args.includes('features')) console.log(${JSON.stringify(textDisabledFeatures.map(feature => `${feature} stable false`).join('\n'))});
else if(args.includes('mcp')) console.log('[]');
else {
 const assert=require('node:assert/strict');
 assert.ok(args.includes('agents.enabled=false')); assert.ok(args.includes('read-only')); assert.ok(args.includes('--no-daemon'));
 assert.equal(process.env.CODEX_HOME,${JSON.stringify(configHome)});
 assert.equal(process.env.UNTRUSTED_TEST_VARIABLE,undefined);
 let text=''; process.stdin.on('data',chunk=>text+=chunk); process.stdin.on('end',()=>{assert.equal(text,'Synthetic prompt');process.stdout.write(${JSON.stringify(output())});});
}
`;
  await writeFile(executable, script); await chmod(executable, 0o700);
  const connection: TextConnection = { executable, configHome, profile: null };
  const runtime = new CodexTextRuntime({ PATH: process.env.PATH, UNTRUSTED_TEST_VARIABLE: 'must-not-propagate' });
  return { directory, connection, runtime };
}

test('text protocol requires a completed valid event stream and preserves unknown usage', () => {
  assert.deepEqual(parseTextOutput(output()), { text: '{"ok":true}', usage: { inputTokens: 11, outputTokens: 7, cachedInputTokens: 3 }, usageUnknownReason: null });
  assert.equal(parseTextOutput(output('{}', null)).usage, null);
  const suppression = JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'Exceeded skills context budget. All skill descriptions were removed and 5 additional skills were not included in the model-visible skills list.' } }) + '\n';
  assert.equal(parseTextOutput(suppression + output()).text, '{"ok":true}');
  assert.throws(() => parseTextOutput(suppression + output() + '{"type":"turn.failed"}\n'));
  assert.equal(parseTextOutput(output('{}', { input_tokens: -1, output_tokens: 1 })).usage, null);
  for (const text of ['null', 'garbage', '{}', '{"type":"turn.completed"}', output() + '{"type":"turn.failed"}\n',
    output() + '{"type":"turn.completed"}\n', output() + '{"type":"item.completed","item":{"type":"agent_message","text":"late"}}\n',
    output() + '{"type":"item.completed","item":{"type":"error","message":"failed"}}\n']) assert.throws(() => parseTextOutput(text));
});

test('prepared text execution binds configuration before exactly one dispatch without a Workbench task', async t => {
  const { runtime, connection } = await fixture(t);
  const controller = new AbortController(), prepared = await runtime.prepare(connection, controller.signal);
  t.after(() => prepared.close());
  assert.equal(prepared.identity.version, textCliVersion);
  assert.equal(prepared.identity.configurationFingerprint, await textConfigurationFingerprint(connection));
  const request = { prompt: 'Synthetic prompt', schema: {}, model: 'gpt-5.6-terra', effort: 'medium' as const, signal: controller.signal };
  assert.equal((await prepared.run(request)).usage?.outputTokens, 7);
  await assert.rejects(prepared.run(request), /only once/);
});

test('global instructions, redirected profiles, changed configuration and ambient credentials fail closed', async t => {
  const { runtime, connection, directory } = await fixture(t);
  await mkdir(path.join(directory, '.codex'));
  await assert.rejects(assertNoProjectConfiguration(connection.configHome), /ancestor .codex/);
  await rm(path.join(directory, '.codex'), { recursive: true });
  await assert.rejects(new CodexTextRuntime({ OPENAI_API_KEY: 'synthetic' }).prepare(connection, new AbortController().signal), /inherited provider overrides/);
  await writeFile(path.join(connection.configHome, 'AGENTS.md'), 'Synthetic instruction canary');
  await assert.rejects(runtime.prepare(connection, new AbortController().signal), /global agent instructions/);
  await rm(path.join(connection.configHome, 'AGENTS.md'));
  await symlink(connection.configHome, path.join(directory, 'redirected'));
  await assert.rejects(runtime.prepare({ ...connection, configHome: path.join(directory, 'redirected') }, new AbortController().signal), /redirected/);
  await assert.rejects(runtime.prepare({ ...connection, profile: 'missing' }, new AbortController().signal), /missing/);
  const prepared = await runtime.prepare(connection, new AbortController().signal); t.after(() => prepared.close());
  await writeFile(path.join(connection.configHome, 'config.toml'), 'model="changed"\n');
  await assert.rejects(prepared.run({ prompt: 'Synthetic prompt', schema: {}, model: 'gpt-5.6-terra', effort: 'medium', signal: new AbortController().signal }), /changed before dispatch/);
});
