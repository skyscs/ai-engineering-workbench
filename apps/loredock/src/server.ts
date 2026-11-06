import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { Catalog } from './catalog.js';
import { CatalogStore } from './store.js';
import { Answers } from './answers.js';
import { QuestionPreparations } from './question-preparation.js';
import { CodeAnalysis } from './code-analysis.js';
import { CodeAnalysisFollow } from './code-analysis-follow.js';
import { CodePathsV2 } from './code-paths-v2.js';
import { NativeCaptures } from './native-capture.js';

interface ServerOptions { directory: string; publicDir?: string; development?: boolean; answers?: boolean; preparedAnswers?: boolean; port?: number }

/** Own startup before its first await, and listen only after the parser's ready handshake. */
export class LoreDockServer {
  readonly store: CatalogStore;
  readonly catalog: Catalog;
  private readonly controller = new AbortController();
  private starting: Promise<number> | undefined;
  private stopping: Promise<void> | undefined;
  private server: ReturnType<typeof serve> | undefined;
  private analysis: CodeAnalysis | undefined;
  private follow: CodeAnalysisFollow | undefined;
  private paths: CodePathsV2 | undefined;
  private captures: NativeCaptures | undefined;
  private preparations: QuestionPreparations | undefined;
  private answers: Answers | undefined;
  private readonly deadline = performance.now() + 10000;
  constructor(private readonly options: ServerOptions) {
    if (options.preparedAnswers && !options.answers) throw new Error('Prepared answers require cited answers.');
    this.store = new CatalogStore(options.directory);
    try { this.catalog = new Catalog(this.store); }
    catch (error) { this.store.close(); throw error; }
  }
  start() {
    if (this.controller.signal.aborted) return Promise.reject(new Error('LoreDock is stopping.'));
    return this.starting ??= this.open();
  }
  private async open() {
    this.analysis = await CodeAnalysis.create(this.catalog);
    this.controller.signal.throwIfAborted();
    await this.catalog.parser.warm({ deadline: this.deadline, signal: this.controller.signal });
    this.controller.signal.throwIfAborted();
    this.follow = new CodeAnalysisFollow(this.analysis); this.paths = new CodePathsV2(this.analysis);
    this.captures = new NativeCaptures(this.analysis, { paths: this.paths });
    if (this.options.answers) { this.preparations = new QuestionPreparations(this.analysis); this.answers = new Answers(this.catalog, undefined, this.preparations); }
    const app = createApp(this.catalog, { codeAnalysis: this.analysis, codeFollow: this.follow, codePaths: this.paths, nativeCaptures: this.captures,
      ...(this.options.publicDir ? { publicDir: this.options.publicDir } : {}), development: this.options.development ?? false,
      ...(this.answers ? { answers: this.answers } : {}), ...(this.options.preparedAnswers && this.preparations ? { preparations: this.preparations } : {}) });
    const server = this.server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: this.options.port ?? 4244 });
    await new Promise<void>((resolve, reject) => {
      const clear = () => { server.off('listening', ready); server.off('error', failed); this.controller.signal.removeEventListener('abort', aborted); };
      const ready = () => { clear(); resolve(); }, failed = (error: Error) => { clear(); reject(error); };
      const aborted = () => failed(new Error('LoreDock stopped before listening.'));
      server.once('listening', ready); server.once('error', failed); this.controller.signal.addEventListener('abort', aborted, { once: true });
      if (this.controller.signal.aborted) aborted();
    });
    this.controller.signal.throwIfAborted(); this.follow.start();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('LoreDock did not acquire a TCP port.');
    return address.port;
  }
  stop() {
    if (this.stopping) return this.stopping;
    this.controller.abort(); this.follow?.stop();
    return this.stopping = (async () => {
      const early = [this.answers?.stop(), this.preparations?.stop(), this.captures?.stop(), this.paths?.stop(), this.analysis?.stop()];
      for (const pending of early) void pending?.catch(() => undefined);
      // Begin parser cancellation before joining startup, including identity initialization.
      const parser = this.catalog.parser.stop(); void parser.catch(() => undefined);
      const closed = this.server ? new Promise<void>((resolve, reject) => this.server!.close(error => {
        if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(error); else resolve();
      })) : Promise.resolve();
      await this.starting?.catch(() => undefined);
      this.follow?.stop();
      const errors: unknown[] = [];
      for (const pending of early) try { await pending; } catch (error) { errors.push(error); }
      for (const stop of [() => this.answers?.stop(), () => this.preparations?.stop(), () => this.captures?.stop(),
        () => this.paths?.stop(), () => this.analysis?.stop(), () => this.catalog.stop(), () => parser, () => closed]) {
        try { await stop(); } catch (error) { errors.push(error); }
      }
      // A failed parser cleanup must retain the live owner's catalog rather than pretending it exited.
      if (errors.length) throw new AggregateError(errors, 'LoreDock shutdown did not complete.');
      this.store.close();
    })();
  }
}
