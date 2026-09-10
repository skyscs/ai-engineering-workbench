import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { execute } from './process.js';
import { configurationState, preflight, restrictionArgs } from './preflight.js';
import { diagnosticLimit, resultLimit, redact, RuntimeError, type AIEvent, type AIRuntime, type AIRunRequest } from './types.js';

export class CodexCliRuntime implements AIRuntime {
  private busy = false;
  constructor(private readonly options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}) {
    if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 24 * 60 * 60 * 1000)) throw new Error('Runtime timeout must be between 1 ms and 24 hours.');
  }
  async *run(request: AIRunRequest): AsyncIterable<AIEvent> {
    if (this.busy) throw new RuntimeError('RUNTIME_BUSY', 'Another AI process is active.');
    this.busy = true;
    const controller = new AbortController(), cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; cancel(); }, this.options.timeoutMs ?? 20 * 60 * 1000);
    const input = { ...request, signal: controller.signal }, env = { ...(this.options.env ?? process.env) };
    let directory: string | undefined, pending: Promise<void> | undefined;
    try {
      if (request.signal.aborted) throw new RuntimeError('CANCELLED', 'The run was cancelled.');
      const metadata = await preflight(input, env);
      yield { type: 'runtime', data: metadata }; // Consumer persists verified metadata before exec.
      if (await configurationState(input, env) !== metadata.configurationFingerprint) throw new RuntimeError('CONFIGURATION_CHANGED', 'CLI configuration changed before execution.');
      directory = await mkdtemp(path.join(tmpdir(), 'aew-codex-'));
      const schema = path.join(directory, 'result.schema.json');
      await writeFile(schema, JSON.stringify(request.outputSchema), { mode: 0o600 });
      const args = ['-a', 'never', ...(request.connection.configProfile === null ? [] : ['--profile', request.connection.configProfile]),
        'exec', '--json', '--sandbox', 'read-only', '--color', 'never', ...restrictionArgs,
        ...(request.profile?.modelIdentifier ? ['-m', request.profile.modelIdentifier] : []),
        ...(request.profile?.reasoningEffort ? ['-c', `model_reasoning_effort=${JSON.stringify(request.profile.reasoningEffort)}`] : []),
        '-C', request.workingDirectory, '--output-schema', schema, '-'];
      const queue: AIEvent[] = [];
      let wake: (() => void) | undefined, done = false, failure: unknown = null;
      let budget = 0, truncated = false, stderr = '', buffered = '', final: string | null = null;
      let completed = false, failed = false, errorText = '', stderrBytes = 0;
      const decoder = new StringDecoder('utf8'), stderrDecoder = new StringDecoder('utf8');
      const emit = (event: AIEvent) => {
        const bytes = Buffer.byteLength(JSON.stringify(event));
        if (budget + bytes > diagnosticLimit) {
          if (!truncated) { truncated = true; queue.push({ type: 'truncated', data: { message: 'Runtime diagnostics reached the 10 MiB limit. Further diagnostics were omitted.' } }); }
        } else { budget += bytes; queue.push(event); }
        wake?.();
      };
      const line = (text: string) => {
        if (!text.trim()) return;
        let event: Record<string, unknown>;
        try { event = JSON.parse(text) as Record<string, unknown>; if (!event || typeof event !== 'object' || typeof event.type !== 'string') throw new Error(); }
        catch { throw new RuntimeError('INVALID_JSONL', 'Codex emitted malformed or interrupted JSONL.'); }
        if (event.type === 'turn.completed') completed = true;
        if (event.type === 'turn.failed') failed = true;
        if (event.type === 'error' || event.type === 'turn.failed') {
          const error = event.error as { message?: unknown } | undefined;
          const message = typeof event.message === 'string' ? event.message : typeof error?.message === 'string' ? error.message : 'Codex reported a turn error.';
          errorText = (errorText + '\n' + redact(message)).slice(-32768);
          emit({ type: 'diagnostic', data: { message: redact(message).slice(0, 8192) } }); return;
        }
        const item = event.item as Record<string, unknown> | undefined;
        if (event.type === 'item.completed' && item?.type === 'agent_message') {
          if (typeof item.text !== 'string') throw new RuntimeError('INVALID_RESULT', 'Codex returned a non-text final message.');
          if (Buffer.byteLength(item.text) > resultLimit) throw new RuntimeError('RESULT_LIMIT', 'The structured result exceeds 2 MiB.');
          final = item.text;
          // Intermediate agent prose is not a completed result and is not published.
          emit({ type: 'progress', data: { message: 'Agent message received; awaiting completed and validated output.' } }); return;
        }
        // Whitelist metadata, not raw tool input/output or arbitrary extension fields.
        const kind = typeof item?.type === 'string' ? item.type.slice(0, 128) : '';
        emit({ type: 'progress', data: { message: redact(`${String(event.type).slice(0, 128)}${kind ? `: ${kind}` : ''}`) } });
      };
      pending = (async () => {
        try {
          const outcome = await execute(request.connection.executablePath ?? 'codex', args, {
            cwd: request.workingDirectory, env, signal: controller.signal, timeoutMs: this.options.timeoutMs ?? 20 * 60 * 1000,
            stdin: request.instructions,
            stdout(chunk) {
              buffered += decoder.write(chunk);
              let newline: number;
              while ((newline = buffered.indexOf('\n')) >= 0) {
                const value = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
                if (Buffer.byteLength(value) > resultLimit + 65536) throw new RuntimeError('OUTPUT_LIMIT', 'A CLI event exceeds the supported framing limit.');
                line(value);
              }
              if (Buffer.byteLength(buffered) > resultLimit + 65536) throw new RuntimeError('OUTPUT_LIMIT', 'A CLI event exceeds the supported framing limit.');
            },
            stderr(chunk) {
              stderrBytes += chunk.length;
              const value = stderrDecoder.write(chunk);
              stderr = (stderr + value).slice(-32768);
            }
          });
          buffered += decoder.end(); stderr += stderrDecoder.end();
          if (buffered.trim()) line(buffered);
          const safeStderr = redact(stderr).slice(-32768);
          if (stderrBytes > 32768) emit({ type: 'diagnostic', data: { message: 'CLI stderr exceeded 32 KiB; only the diagnostic tail was retained.' } });
          if (safeStderr) emit({ type: 'diagnostic', data: { message: safeStderr } });
          if (controller.signal.aborted) throw new RuntimeError('CANCELLED', 'The run was cancelled.');
          if (outcome.spawnError || outcome.exitCode !== 0 || !completed || failed) {
            const text = errorText + safeStderr;
            const code = outcome.spawnError ? 'CLI_UNAVAILABLE' : /usage limit/i.test(text) ? 'USAGE_LIMIT' : /not logged in|unauthorized|authentication|invalid api key|\b401\b/i.test(text) ? 'AUTHENTICATION_REQUIRED' : /unexpected argument|unknown option/i.test(text) ? 'UNSUPPORTED_OPTION' : 'PROCESS_FAILED';
            throw new RuntimeError(code, 'Codex did not complete successfully. Review the recorded diagnostics before retrying.', { exitCode: outcome.exitCode, signal: outcome.signal, stderr: safeStderr });
          }
          let value: unknown;
          try { value = JSON.parse(final ?? ''); } catch { throw new RuntimeError('INVALID_RESULT', 'Codex did not return complete structured JSON.'); }
          if (!request.validateResult(value)) throw new RuntimeError('INVALID_RESULT', 'Codex output failed schema validation.');
          queue.push({ type: 'result', data: value });
        } catch (error) { failure = error; }
        finally { done = true; wake?.(); }
      })();
      while (!done || queue.length) {
        if (!queue.length) await new Promise<void>((resolve) => { wake = resolve; });
        wake = undefined;
        while (queue.length) yield queue.shift()!;
      }
      if (failure) throw failure;
    } catch (error) {
      if (timedOut) throw new RuntimeError('TIMEOUT', 'The runtime exceeded its wall timeout.');
      if (error instanceof RuntimeError) throw error;
      throw new RuntimeError('RUNTIME_FAILED', 'The runtime could not complete. Check configuration and local storage.');
    } finally {
      cancel(); await pending; clearTimeout(timer); request.signal.removeEventListener('abort', cancel);
      if (directory) await rm(directory, { recursive: true, force: true });
      this.busy = false;
    }
  }
}
