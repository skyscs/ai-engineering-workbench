import { RuntimeError, type AIRuntime, type AIRunRequest, type AIEvent } from './types.js';
/** Deterministic dependency injection for tests; never selectable through public settings. */
export class FakeRuntime implements AIRuntime {
  readonly requests: AIRunRequest[] = [];
  constructor(private readonly events: AIEvent[], private readonly error: RuntimeError | null = null,
    private readonly wait: ((signal: AbortSignal) => Promise<void>) | null = null) {}
  async *run(request: AIRunRequest): AsyncIterable<AIEvent> {
    this.requests.push(request);
    if (this.wait) await this.wait(request.signal);
    for (const event of this.events) {
      if (request.signal.aborted) throw new RuntimeError('CANCELLED', 'The run was cancelled.');
      if (event.type === 'result' && !request.validateResult(event.data)) throw new RuntimeError('INVALID_RESULT', 'Fake output failed schema validation.');
      yield event;
    }
    if (request.signal.aborted) throw new RuntimeError('CANCELLED', 'The run was cancelled.');
    if (this.error) throw this.error;
  }
}
