import type { CodeFacts } from './code-facts.js';
import { OwnedFileParser } from './file-parser.js';
import { fileParserIdentity } from './file-parser-identity.js';
import { FileParserError } from './file-parser-protocol.js';
import type { FileParserOwner, ParserOperation } from './file-parser-owner.js';
import { CatalogError } from './types.js';

export interface ParserLease {
  readonly signal: AbortSignal;
  check(): void;
  parse(path: string, content: string): Promise<CodeFacts>;
  abort(): void;
  release(afterCleanup?: () => void): Promise<void>;
}

/** One catalog, one admitted operation, one worker generation and no admission queue. */
export class FileParserService {
  private owner: FileParserOwner | undefined;
  private active: ParserLease | undefined;
  private activeDone: Promise<void> | undefined;
  private readonly lifetime = new AbortController();
  private identityWork: Promise<string> | undefined;
  private stopping: Promise<void> | undefined;
  private failed: unknown;
  // Internal test dependency; the application always uses the installed factory.
  constructor(private readonly factory: () => FileParserOwner = () => new OwnedFileParser()) {}
  identity() {
    if (this.lifetime.signal.aborted) throw new CatalogError('SERVICE_STOPPED', 'The parser service is stopping.', 409);
    return this.identityWork ??= fileParserIdentity(this.lifetime.signal);
  }
  acquire(kind: 'foreground' | 'native' | 'startup' | 'identity', options: ParserOperation): ParserLease {
    if (this.lifetime.signal.aborted) throw new CatalogError('SERVICE_STOPPED', 'The parser service is stopping.', 409);
    if (this.active) throw new CatalogError('BUSY', 'Code analysis or a context operation is active. Wait, or pause code analysis before trying again.', 409);
    if (this.failed || this.owner && !['new', 'ready'].includes(this.owner.snapshot().state))
      throw new CatalogError('PARSER_UNAVAILABLE', 'The parser failed. Restart LoreDock before analyzing code again.', 409);
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, this.lifetime.signal, ...(options.signal ? [options.signal] : [])]);
    let finish!: () => void, released: Promise<void> | undefined, chargeFailure: unknown, parsing = false;
    this.activeDone = new Promise<void>(resolve => { finish = resolve; });
    const check = () => {
      if (this.active !== lease || signal.aborted) throw new CatalogError('CANCELLED', 'The parser operation was cancelled.', 409);
      if (this.failed || this.owner && ['stopping', 'closed'].includes(this.owner.snapshot().state))
        throw new CatalogError('PARSER_UNAVAILABLE', 'The owned parser is unavailable. Restart LoreDock.', 409);
    };
    const operation: ParserOperation = { deadline: options.deadline, signal, ...(options.charge ? { charge: (bytes: number) => {
      try { options.charge!(bytes); } catch (error) { chargeFailure = error; throw error; }
    } } : {}) };
    const ready = async () => {
      check();
      const identity = await this.identity(); check();
      this.owner ??= this.factory();
      if (this.owner.snapshot().state === 'new') await this.owner.start(operation);
      check();
      if (this.owner.snapshot().identity !== identity) throw new FileParserError('PARSER_IDENTITY');
      return this.owner;
    };
    const execute = async <T>(action: () => Promise<T>): Promise<T> => {
      try { return await action(); }
      catch (error) {
        if (!signal.aborted && chargeFailure === undefined) this.failed = error;
        // A failed request must settle after the old thread's actual exit.
        if (this.owner) await this.owner.stop();
        throw chargeFailure ?? error;
      }
    };
    const lease: ParserLease = {
      signal, check,
      parse: async (path, content) => {
        check();
        if (parsing) throw new CatalogError('BUSY', 'This operation already has a file in flight.', 409);
        parsing = true;
        try { return await execute(async () => {
          const owner = await ready(); check();
          const facts = await owner.parse(path, content, operation); check(); return facts;
        }); } finally { parsing = false; }
      },
      abort: () => controller.abort(),
      release: afterCleanup => released ??= (async () => {
        try {
          if (signal.aborted || chargeFailure !== undefined) {
            if (this.owner) await this.owner.stop();
            this.owner = undefined;
          }
        } catch (error) { this.failed = error; throw error; }
        finally {
          // A native run records final elapsed time before another read epoch can begin.
          try { afterCleanup?.(); }
          finally { if (this.active === lease) { this.active = undefined; this.activeDone = undefined; } finish(); }
        }
      })(),
    };
    this.active = lease;
    // Warm-up owns exactly the same admission and initialization as a parse.
    if (kind === 'startup') this.warming = execute(async () => { await ready(); });
    return lease;
  }
  private warming: Promise<void> | undefined;
  async initialize<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const lease = this.acquire('identity', { deadline: performance.now() + 10000 });
    try { const value = await action(lease.signal); lease.check(); return value; }
    finally { await lease.release(); }
  }
  async warm(options: ParserOperation) {
    const lease = this.acquire('startup', options);
    try { await this.warming; } finally { this.warming = undefined; await lease.release(); }
  }
  stop() {
    if (this.stopping) return this.stopping;
    this.lifetime.abort();
    return this.stopping = (async () => {
      // Cancelling readiness also joins a fingerprint stream before releasing the catalog.
      const done = this.activeDone;
      await this.identityWork?.catch(() => undefined);
      if (this.owner) await this.owner.stop();
      await done;
    })();
  }
  snapshot() { return { active: Boolean(this.active), stopped: this.lifetime.signal.aborted, failed: Boolean(this.failed), owner: this.owner?.snapshot() ?? null }; }
}
