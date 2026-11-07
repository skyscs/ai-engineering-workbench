// Functional test launcher only. It is not a resource or isolation qualification entry.
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ControlledRuntime } from './runtime.mjs';

const output = process.argv[2], controller = new AbortController();
let server, runtime, startup, stopping, owned = false, failed = false, emittedBytes = 0;
let input = Buffer.alloc(0), commandCount = 0;
const decoder = new TextDecoder('utf-8', { fatal: true });
function emit(value) {
  const line = JSON.stringify(value) + '\n', bytes = Buffer.byteLength(line);
  if (bytes > 4096 || emittedBytes + bytes > 65536) throw new Error('Controlled launcher output exceeds its bound.');
  emittedBytes += bytes; process.stdout.write(line);
}
function fail(error) {
  if (!failed) {
    failed = true; process.exitCode = 1;
    process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 1024) : 'Controlled launcher failed.' }) + '\n');
  }
  void stop('failure');
}
function stop(reason) {
  if (stopping) return stopping;
  const began = performance.now();
  controller.abort(); process.stdin.pause(); clearTimeout(wall);
  return stopping = (async () => {
    let cleanupError;
    try { await server?.stop(); } catch (error) { cleanupError = error; }
    await startup?.catch(() => undefined);
    try { await server?.stop(); } catch (error) { cleanupError ??= error; }
    const shutdownMs = performance.now() - began;
    if (shutdownMs > 10000) cleanupError ??= new Error('Controlled shutdown exceeded ten seconds.');
    if (cleanupError) { failed = true; process.exitCode = 1; }
    const result = { stage: 'stopped', reason, failed, error: cleanupError instanceof Error ? cleanupError.message.slice(0, 1024) : null,
      parser: server?.catalog.parser.snapshot() ?? null, runtime: runtime?.snapshot() ?? null,
      shutdownMs, modelCalls: 0, resourceQualification: false };
    const serialized = JSON.stringify(result);
    if (Buffer.byteLength(serialized) > 4096) throw new Error('Controlled terminal record exceeds 4 KiB.');
    if (owned) await writeFile(path.join(output, 'terminal.json'), serialized, { flag: 'wx', mode: 0o600 });
    emit(result);
  })().catch(error => {
    failed = true; process.exitCode = 1;
    process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 1024) : 'Controlled shutdown failed.' }) + '\n');
  }).finally(() => { process.stdin.destroy(); });
}
const wall = setTimeout(() => fail(new Error('Controlled launcher exceeded its 30-second wall limit.')), 30000);
process.once('SIGTERM', () => { void stop('SIGTERM'); });
process.once('SIGINT', () => { void stop('SIGINT'); });
process.stdout.on('error', fail);
process.stderr.on('error', () => { failed = true; process.exitCode = 1; void stop('stderr-error'); });
process.stdin.on('error', fail);
process.stdin.on('end', () => { if (input.length) fail(new Error('Incomplete controlled command.')); else void stop('stdin-end'); });
function command(bytes) {
  if (stopping) return;
  if (++commandCount > 32 || !runtime || !server) throw new Error('Controlled command is unavailable.');
  const text = decoder.decode(bytes), value = JSON.parse(text);
  if (!value || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'command,id'
    || value.id !== commandCount || JSON.stringify(value) !== text
    || !['stats', 'hold-prepare', 'hold-run', 'release', 'stop'].includes(value.command)) throw new Error('Invalid controlled command.');
  if (value.command === 'hold-prepare') runtime.hold('prepare');
  if (value.command === 'hold-run') runtime.hold('run');
  if (value.command === 'release') runtime.release();
  emit({ stage: 'reply', id: value.id, runtime: runtime.snapshot(), parser: server.catalog.parser.snapshot() });
  if (value.command === 'stop') void stop('command');
}
process.stdin.on('data', chunk => {
  if (stopping) return;
  try {
    let offset = 0;
    while (offset < chunk.length) {
      const end = chunk.indexOf(10, offset), size = (end < 0 ? chunk.length : end) - offset;
      if (input.length + size > 1024) throw new Error('Controlled command exceeds 1 KiB.');
      input = Buffer.concat([input, chunk.subarray(offset, offset + size)]);
      if (end < 0) break;
      const row = input; input = Buffer.alloc(0); command(row);
      if (stopping) return;
      offset = end + 1;
    }
  } catch (error) { fail(error); }
});

startup = (async () => {
  if (process.argv.length !== 3 || !path.isAbsolute(output ?? '') || path.resolve(output) !== output
    || output === path.dirname(output) || await realpath(path.dirname(output)) !== path.dirname(output)) throw new Error('Choose one fresh canonical absolute output directory.');
  controller.signal.throwIfAborted();
  await mkdir(output, { mode: 0o700 }); owned = true;
  controller.signal.throwIfAborted();
  await mkdir(path.join(output, 'runtime'), { mode: 0o700 });
  const { LoreDockServer } = await import('../../apps/loredock/dist/server.js');
  controller.signal.throwIfAborted();
  runtime = new ControlledRuntime(path.join(output, 'runtime'));
  server = new LoreDockServer({ directory: path.join(output, 'data'), port: 0,
    publicDir: fileURLToPath(new URL('../../apps/loredock/public/', import.meta.url)),
    answers: true, preparedAnswers: true, textRuntime: runtime });
  emit({ stage: 'starting', modelCalls: 0, resourceQualification: false });
  const port = await server.start();
  controller.signal.throwIfAborted();
  emit({ stage: 'ready', port, parser: server.catalog.parser.snapshot(), runtime: runtime.snapshot(), resourceQualification: false });
})();
void startup.catch(error => { if (!controller.signal.aborted) fail(error); else void stop('startup-interrupted'); });
