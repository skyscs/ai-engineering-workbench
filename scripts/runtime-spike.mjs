import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { snapshot } from './runtime-fixture.mjs';
import { classifyFailure, parseInvestigation } from './runtime-outcome.mjs';

const [mode = 'investigate', root] = process.argv.slice(2);
if (!['investigate', 'cancel', 'timeout', 'missing-profile', 'unsupported-option'].includes(mode)) throw new Error('Unknown spike mode.');
if (!root || !path.basename(root).startsWith('aew-runtime-')) throw new Error('Expected a generated fixture root.');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const baseline = await snapshot(manifest);
const schema = fileURLToPath(new URL('./runtime-result.schema.json', import.meta.url));
const args = ['-a', 'never', 'exec', '--json', '--ephemeral', '--sandbox', 'read-only',
  '-m', 'gpt-5.6-terra', '-c', 'model_reasoning_effort="medium"',
  '-c', 'web_search="disabled"', '-C', manifest.client];
for (const feature of ['apps', 'plugins', 'hooks', 'browser_use', 'computer_use', 'image_generation', 'multi_agent']) {
  args.push('--disable', feature);
}
if (mode === 'missing-profile') args.push('--profile', 'aew-intentionally-missing-runtime-fixture');
if (mode === 'unsupported-option') args.push('--aew-intentionally-unsupported-flag');
if (mode === 'investigate') args.push('--output-schema', schema);
args.push('-');

const prompt = mode === 'cancel'
  ? 'This is a process cancellation test. Run exactly the local shell command sleep 60, then reply DONE. Do not call other tools or read other files.'
  : `Investigate this synthetic defect using only local read-only shell tools. Do not implement a fix, write files, use external tools, delegate work, or read files outside the following fixture roots.
Client repository: ${manifest.client}
Service repository: ${manifest.service}
Incident artifact: ${manifest.artifact}
Read both source files, inspect Git history in both repositories, and read the artifact. Explain the timeout regression and cite both repositories with commit IDs and the artifact. Respond in English. Return the required JSON only as the final response.`;

const child = spawn('codex', args, { cwd: manifest.client, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
const events = [];
let buffered = '', stderr = '', outputBytes = 0, final = null, stopped = null;
let killTimer;
function stop(reason) {
  if (stopped) return;
  stopped = reason;
  try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  killTimer = setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }, 1500);
}
const timeout = setTimeout(() => stop('timeout'), mode === 'timeout' ? 1000 : 120000);
child.stdout.on('data', (chunk) => {
  outputBytes += chunk.length;
  if (outputBytes > 2 * 1024 * 1024) { stop('output-limit'); return; }
  buffered += chunk.toString();
  let newline;
  while ((newline = buffered.indexOf('\n')) !== -1) {
    const line = buffered.slice(0, newline);
    buffered = buffered.slice(newline + 1);
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { stop('invalid-jsonl'); continue; }
    events.push(event);
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') final = event.item.text;
    if (mode === 'cancel' && event.type === 'item.started' && event.item?.type === 'command_execution') stop('cancelled');
  }
});
child.stderr.on('data', (chunk) => { if (stderr.length < 65536) stderr += chunk.toString(); });
child.stdin.on('error', () => {});
child.stdin.end(prompt);
const outcome = await new Promise((resolve) => {
  child.on('error', (error) => resolve({ exitCode: null, spawnError: error.code }));
  child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
});
clearTimeout(timeout);
if (killTimer) clearTimeout(killTimer);
let ownedGroupAlive = false;
if (child.pid) {
  try { process.kill(-child.pid, 0); ownedGroupAlive = true; } catch (error) { if (error.code !== 'ESRCH') throw error; }
  if (ownedGroupAlive) {
    process.kill(-child.pid, 'SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 100));
    try { process.kill(-child.pid, 0); } catch (error) { if (error.code === 'ESRCH') ownedGroupAlive = false; else throw error; }
  }
}
const unchanged = JSON.stringify(baseline) === JSON.stringify(await snapshot(manifest));
const failureKind = classifyFailure({ events, stderr, ...outcome, stopped });
const structuredResult = parseInvestigation(final, events, outcome.exitCode, stopped);
const scenarioPassed = mode === 'investigate'
  ? outcome.exitCode === 0 && stopped === null && structuredResult !== null
    && events.some((event) => event.type === 'turn.completed') && !events.some((event) => event.type === 'turn.failed')
  : mode === 'cancel' ? stopped === 'cancelled'
    : mode === 'timeout' ? stopped === 'timeout'
      : mode === 'missing-profile' ? outcome.exitCode !== 0 && failureKind === 'missing_profile'
        : outcome.exitCode !== 0 && failureKind === 'unsupported_option';
const result = { mode, requestedModel: 'gpt-5.6-terra', requestedEffort: 'medium', ...outcome,
  stopped, unchanged, ownedGroupAlive, outputBytes, stderrBytes: stderr.length, failureKind,
  scenarioPassed: scenarioPassed && unchanged && !ownedGroupAlive,
  eventTypes: [...new Set(events.map((event) => event.type))],
  final: mode === 'investigate' && scenarioPassed ? structuredResult : null };
// Raw diagnostics stay in the temporary fixture directory, never in tracked files.
await writeFile(path.join(root, `${mode}.events.jsonl`), events.map((event) => JSON.stringify(event)).join('\n'), { mode: 0o600 });
await writeFile(path.join(root, `${mode}.stderr.log`), stderr, { mode: 0o600 });
await writeFile(path.join(root, `${mode}.result.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.scenarioPassed ? 0 : 1;
