import { Worker } from 'node:worker_threads';
import { fileParserIdentity } from './file-parser-identity.js';
import { FileParserOwner } from './file-parser-owner.js';

/** Unwired adapter: production call sites still use their existing synchronous parsers. */
export class OwnedFileParser extends FileParserOwner {
  constructor() {
    super({ identify: fileParserIdentity, spawn: generation => {
      const source = new URL(import.meta.url).pathname.endsWith('.ts');
      return new Worker(new URL(source ? '../runtime/file-parser-source.mjs' : './file-parser-worker.js', import.meta.url), {
        workerData: { generation }, execArgv: [],
        env: {}, stdout: true, stderr: true,
      });
    } });
  }
}
