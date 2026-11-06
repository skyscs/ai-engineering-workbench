import { randomUUID } from 'node:crypto';
import type { Worker } from 'node:worker_threads';
import type { CodeFacts } from './code-facts.js';
import { decodeParserReply, encodeParserFrame, fileParserDigest, fileParserLimits, fileParserProtocol,
  FileParserError, requireParser, validateParserFacts, validateParserInput, type ParseRequest } from './file-parser-protocol.js';

export interface ParserOperation { deadline: number; signal?: AbortSignal }
interface Pending { resolve: (value?: CodeFacts) => void; reject: (error: FileParserError) => void;
  check: () => void; release: () => void; request?: ParseRequest }
type State = 'new' | 'starting' | 'ready' | 'busy' | 'stopping' | 'closed';
/** Internal dependency seam for lifecycle tests. Production supplies a fixed installed factory. */
export interface ParserDependencies {
  identify: (signal: AbortSignal) => Promise<string>;
  spawn: (generation: string) => Worker;
  cleanupMs?: number;
}

export class FileParserOwner {
  readonly generation = randomUUID();
  private state: State = 'new';
  private identity: string | undefined;
  private worker: Worker | undefined;
  private initializing: Promise<void> | undefined;
  private readonly initialization = new AbortController();
  private pending: Pending | undefined;
  private joining: Promise<void> | undefined;
  private stopped: Promise<void> | undefined;
  private exit: Promise<void> | undefined;
  private exited = false;
  private exitCode: number | null = null;
  private threadId: number | null = null;
  private sequence = 0;
  private terminalCode: string | null = null;
  private cleanupIncomplete = false;
  private workerError: { name: string; code: string | null } | null = null;
  private outputBytes = 0;
  private readonly cleanupMs: number;

  constructor(private readonly dependencies: ParserDependencies) {
    this.cleanupMs = dependencies.cleanupMs ?? fileParserLimits.cleanupMs;
    requireParser(Number.isSafeInteger(this.cleanupMs) && this.cleanupMs > 0 && this.cleanupMs <= fileParserLimits.cleanupMs, 'PARSER_OPTIONS');
  }
  private operation(options: ParserOperation) {
    requireParser(options && Number.isFinite(options.deadline) && options.deadline > performance.now()
      && options.deadline - performance.now() <= fileParserLimits.wallMs, 'PARSER_DEADLINE');
    requireParser(options.signal === undefined || options.signal instanceof AbortSignal, 'PARSER_OPTIONS');
    requireParser(!options.signal?.aborted, 'PARSER_CANCELLED');
  }
  private waiting<T extends void | CodeFacts>(options: ParserOperation, request?: ParseRequest): Promise<T> {
    const { deadline, signal } = options;
    return new Promise<T>((resolve, reject) => {
      const abort = () => this.fail(new FileParserError('PARSER_CANCELLED'));
      const timer = setTimeout(() => this.fail(new FileParserError('PARSER_DEADLINE')), Math.max(0, deadline - performance.now()));
      signal?.addEventListener('abort', abort, { once: true });
      this.pending = { resolve: value => resolve(value as T), reject,
        check: () => { requireParser(!signal?.aborted, 'PARSER_CANCELLED'); requireParser(performance.now() < deadline, 'PARSER_DEADLINE'); },
        release: () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); }, ...(request ? { request } : {}) };
    });
  }
  async start(options: ParserOperation): Promise<void> {
    requireParser(this.state === 'new', 'PARSER_STATE'); this.operation(options);
    this.state = 'starting'; const ready = this.waiting<void>(options);
    this.initializing = this.initialize();
    void this.initializing.catch(error => this.fail(error instanceof FileParserError ? error : new FileParserError('PARSER_START_FAILED')));
    return ready;
  }
  private async initialize() {
    const identity = await this.dependencies.identify(this.initialization.signal);
    requireParser(/^[a-f0-9]{64}$/.test(identity), 'PARSER_IDENTITY');
    if (this.state !== 'starting') return;
    this.pending!.check();
    this.identity = identity;
    const worker = this.dependencies.spawn(this.generation); this.worker = worker; this.threadId = worker.threadId;
    this.exit = new Promise(resolve => worker.once('exit', code => {
      this.exited = true; this.exitCode = code; resolve();
      if (this.state !== 'stopping') this.fail(new FileParserError('PARSER_EXIT'));
    }));
    worker.on('message', this.message);
    worker.on('messageerror', this.messageError);
    worker.on('error', this.error);
    worker.stdout?.on('data', this.output); worker.stderr?.on('data', this.output);
  }
  private output = (value: Buffer) => {
    this.outputBytes = Math.min(4097, this.outputBytes + value.byteLength);
    if (this.outputBytes > 4096) this.fail(new FileParserError('PARSER_OUTPUT_LIMIT'));
  };
  private messageError = () => this.fail(new FileParserError('PARSER_MESSAGE_ERROR'));
  private error = (error: Error & { code?: unknown }) => {
    const safe = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(value) ? value : null;
    this.workerError = { name: safe(error.name) ?? 'Error', code: safe(error.code) };
    this.fail(new FileParserError('PARSER_WORKER_ERROR'));
  };
  private message = (frame: unknown) => {
    if (this.state === 'stopping' || this.state === 'closed') return;
    try {
      const pending = this.pending; requireParser(pending); pending.check();
      const reply = decodeParserReply(frame, pending.check);
      requireParser(reply.generation === this.generation && reply.identity === this.identity);
      if (reply.type === 'ready') {
        requireParser(this.state === 'starting' && !pending.request);
        pending.check();
        pending.release(); this.pending = undefined; this.state = 'ready'; pending.resolve(); return;
      }
      const request = pending.request;
      requireParser(this.state === 'busy' && request && reply.id === request.id && reply.digest === request.digest);
      if (reply.type === 'error') throw new FileParserError(reply.code);
      validateParserFacts(reply.facts, request.content);
      pending.check();
      pending.release(); this.pending = undefined; this.state = 'ready'; pending.resolve(reply.facts);
    } catch (error) { this.fail(error instanceof FileParserError ? error : new FileParserError('PARSER_PROTOCOL')); }
  };
  async parse(path: string, content: string, options: ParserOperation): Promise<CodeFacts> {
    // Reject before validating/encoding text or retaining a second caller's document.
    requireParser(this.state !== 'busy' && this.state !== 'starting', 'PARSER_BUSY');
    requireParser(this.state === 'ready' && this.worker && this.identity, 'PARSER_STATE');
    this.operation(options); validateParserInput(path, content);
    requireParser(this.sequence < Number.MAX_SAFE_INTEGER, 'PARSER_SEQUENCE');
    const request: ParseRequest = { version: fileParserProtocol, generation: this.generation, identity: this.identity,
      type: 'parse', id: ++this.sequence, path, content, digest: fileParserDigest(path, content) };
    const frame = encodeParserFrame(request, fileParserLimits.requestBytes);
    // Encoding time consumes the same absolute deadline.
    this.operation(options); this.state = 'busy'; const result = this.waiting<CodeFacts>(options, request);
    try { this.worker.postMessage(frame, [frame]); }
    catch { this.fail(new FileParserError('PARSER_SEND_FAILED')); }
    return result;
  }
  private fail(error: FileParserError) { void this.close(error).catch(() => undefined); }
  private close(error: FileParserError): Promise<void> {
    if (this.stopped) return this.stopped;
    this.state = 'stopping'; this.terminalCode = error.code; this.initialization.abort();
    const pending = this.pending; this.pending = undefined; pending?.release();
    this.joining = (async () => {
      await this.initializing?.catch(() => undefined);
      if (this.worker && !this.exited) {
        // An unsuccessful termination request does not prove that the thread exited.
        void this.worker.terminate().catch(() => { this.cleanupIncomplete = true; });
        await this.exit;
      }
      if (this.worker) {
        this.worker.off('message', this.message); this.worker.off('messageerror', this.messageError); this.worker.off('error', this.error);
        this.worker.stdout?.off('data', this.output); this.worker.stderr?.off('data', this.output);
      }
      this.worker = undefined; this.identity = undefined; this.state = 'closed';
    })();
    this.stopped = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.cleanupIncomplete = true; reject(new FileParserError('PARSER_CLEANUP_TIMEOUT')); }, this.cleanupMs);
      void this.joining!.then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); this.cleanupIncomplete = true; reject(new FileParserError('PARSER_CLEANUP_FAILED')); });
    });
    // Settlement normally follows exit. On cleanup timeout, ownership remains visible.
    void this.stopped.then(() => pending?.reject(error), failure => pending?.reject(failure as FileParserError));
    void this.stopped.catch(() => undefined); return this.stopped;
  }
  stop() { return this.close(new FileParserError('PARSER_STOPPED')); }
  snapshot() { return { generation: this.generation, state: this.state, threadId: this.threadId,
    owned: Boolean(this.worker && !this.exited), exitCode: this.exitCode, requests: this.sequence,
    terminalCode: this.terminalCode, cleanupIncomplete: this.cleanupIncomplete,
    workerError: this.workerError ? { ...this.workerError } : null, outputBytes: this.outputBytes }; }
}
