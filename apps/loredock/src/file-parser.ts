import { Worker } from 'node:worker_threads';
import { fileParserIdentity } from './file-parser-identity.js';
import { FileParserOwner } from './file-parser-owner.js';

/** Unwired adapter: production call sites still use their existing synchronous parsers. */
export class OwnedFileParser extends FileParserOwner {
  constructor() {
    super({ identify: fileParserIdentity, spawn: generation => {
      const source = import.meta.url.endsWith('.ts');
      return new Worker(new URL(source ? './file-parser-worker.ts' : './file-parser-worker.js', import.meta.url), {
        workerData: { generation }, execArgv: source ? ['--import', import.meta.resolve('tsx')] : [],
        env: {}, stdout: true, stderr: true,
      });
    } });
  }
}
