import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtimeLimits = Object.freeze({ preparations: 4, requestBytes: 131072, responseBytes: 32768, totalBytes: 1048576 });

/** Deterministic test dependency. It has no subprocess, provider or network implementation. */
export class ControlledRuntime {
  #directory; #lease; #gate; #bytes = 0;
  #prepares = 0; #calls = 0; #closed = 0; #aborted = 0;
  constructor(directory) { this.#directory = directory; }
  snapshot() {
    return { prepares: this.#prepares, calls: this.#calls, closed: this.#closed, aborted: this.#aborted,
      active: Boolean(this.#lease), held: this.#gate?.stage ?? null, waiting: this.#gate?.resolve ? this.#gate.stage : null,
      retainedBytes: this.#bytes, modelCalls: 0 };
  }
  hold(stage) {
    if (!['prepare', 'run'].includes(stage) || this.#lease || this.#gate) throw new Error('A hold requires an idle controlled runtime.');
    this.#gate = { stage };
  }
  release() {
    const gate = this.#gate;
    if (!gate) throw new Error('No controlled hold is active.');
    this.#gate = undefined; gate.resolve?.();
  }
  async #wait(stage, signal) {
    signal.throwIfAborted();
    const gate = this.#gate;
    if (gate?.stage !== stage) return;
    try {
      await new Promise((resolve, reject) => {
        const abort = () => { this.#aborted++; reject(new Error('The controlled request was aborted.')); };
        gate.resolve = resolve; gate.reject = reject;
        gate.remove = () => signal.removeEventListener('abort', abort);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    } finally { gate.remove?.(); if (this.#gate === gate) this.#gate = undefined; }
    signal.throwIfAborted();
  }
  async #retain(name, value, limit) {
    const raw = JSON.stringify(value);
    const bytes = Buffer.byteLength(raw);
    if (bytes > limit || this.#bytes + bytes > runtimeLimits.totalBytes) throw new Error('Controlled runtime evidence exceeds its bound.');
    // Consume capacity before I/O; a failed write cannot authorize reuse of that slot.
    this.#bytes += bytes;
    await writeFile(path.join(this.#directory, name), raw, { flag: 'wx', mode: 0o600 });
  }
  async prepare(connection, signal) {
    if (this.#lease) throw new Error('The controlled runtime already owns a request.');
    if (this.#prepares >= runtimeLimits.preparations) throw new Error('Controlled runtime preparation limit reached.');
    const lease = { ordinal: ++this.#prepares, ran: false, closed: false };
    this.#lease = lease;
    if (this.#gate) this.#gate.lease = lease;
    try {
      await this.#wait('prepare', signal);
      signal.throwIfAborted();
      return {
        identity: { ...connection, version: 'controlled-server/1', policyVersion: 'synthetic-no-provider', configurationFingerprint: 'controlled-server/1' },
        run: request => {
          if (lease.closed || this.#lease !== lease || lease.ran) return Promise.reject(new Error('The controlled request cannot run again.'));
          lease.ran = true; this.#calls++;
          lease.done = (async () => {
            request.signal.throwIfAborted();
            const ids = request.schema?.properties?.claims?.items?.properties?.evidenceIds?.items?.enum;
            if (typeof request.prompt !== 'string' || !Array.isArray(ids) || !ids.length || ids.length > 30
              || ids.some(id => typeof id !== 'string' || !id.length || id.length > 256)) throw new Error('Controlled output requires bounded issued original citations.');
            await this.#retain(`request-${lease.ordinal}.json`, { prompt: request.prompt, schema: request.schema,
              model: request.model, effort: request.effort }, runtimeLimits.requestBytes);
            if (lease.closed) throw new Error('The controlled lease closed.');
            await this.#wait('run', request.signal);
            request.signal.throwIfAborted();
            const output = { text: JSON.stringify({ claims: [{ kind: 'fact', text: 'The supplied original is a source passage.', evidenceIds: [ids[0]] }],
              unknowns: ['What deployment behavior remains unverified by this synthetic test?'] }),
              usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 }, usageUnknownReason: null };
            await this.#retain(`output-${lease.ordinal}.json`, output, runtimeLimits.responseBytes);
            request.signal.throwIfAborted();
            if (lease.closed) throw new Error('The controlled lease closed.');
            return output;
          })();
          void lease.done.catch(() => undefined);
          return lease.done;
        },
        close: () => lease.closing ??= (async () => {
          lease.closed = true;
          if (this.#gate?.lease === lease) { const gate = this.#gate; this.#gate = undefined; gate.reject?.(new Error('The controlled lease closed.')); }
          await lease.done?.catch(() => undefined);
          this.#closed++;
          if (this.#lease === lease) this.#lease = undefined;
        })(),
      };
    } catch (error) { if (this.#gate?.lease === lease) this.#gate = undefined; if (this.#lease === lease) this.#lease = undefined; throw error; }
  }
}
