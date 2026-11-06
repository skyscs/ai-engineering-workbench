import { parentPort, workerData } from 'node:worker_threads';
import { fileParserIdentity } from './file-parser-identity.js';
import { decodeParseRequest, encodeParserReply, fileParserProtocol, requireParser, validateParserFacts,
  FileParserError, type ParserReply } from './file-parser-protocol.js';

requireParser(parentPort && workerData && typeof workerData === 'object'
  && Object.keys(workerData).length === 1 && typeof workerData.generation === 'string'
  && /^[a-f0-9-]{36}$/.test(workerData.generation));
const port = parentPort!, generation = workerData.generation as string;
const identity = await fileParserIdentity();
const [{ typescriptFacts }, { javaFacts }] = await Promise.all([import('./code-typescript.js'), import('./code-java.js')]);
const binding = { version: fileParserProtocol, generation, identity } as const;
const send = (value: ParserReply) => { const frame = encodeParserReply(value); port.postMessage(frame, [frame]); };
let previousId = 0;
port.on('message', (frame: unknown) => {
  const request = decodeParseRequest(frame);
  requireParser(request.generation === generation && request.identity === identity && request.id > previousId);
  previousId = request.id;
  const result = { ...binding, id: request.id, digest: request.digest };
  try {
    const facts = request.path.endsWith('.java') ? javaFacts(request.content) : typescriptFacts(request.content, request.path);
    validateParserFacts(facts, request.content); send({ ...result, type: 'facts', facts });
  } catch (error) {
    send({ ...result, type: 'error', code: error instanceof FileParserError && error.code === 'PARSER_FRAME_LIMIT'
      ? 'PARSER_RESULT_LIMIT' : 'PARSER_EXTRACTION_FAILED' });
  }
});
send({ ...binding, type: 'ready' });
