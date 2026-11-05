import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { fileParserProtocol } from './file-parser-protocol.js';

/** Installed implementation identity; never read a repository file or execute the compiler. */
export async function fileParserIdentity(signal?: AbortSignal): Promise<string> {
  const source = new URL(import.meta.url).pathname.endsWith('.ts'), extension = source ? '.ts' : '.js';
  const modules = ['file-parser', 'file-parser-owner', 'file-parser-protocol', 'file-parser-identity', 'file-parser-worker',
    'code-typescript', 'code-java', 'code-facts', 'http-headers'];
  const hashes: [string, string][] = [];
  const inputs: [string, URL | string][] = modules.map(name => [name, new URL(`./${name}${extension}`, import.meta.url)]);
  if (source) inputs.push(['source-bootstrap', new URL('../runtime/file-parser-source.mjs', import.meta.url)],
    ['tsx-api-entry', createRequire(import.meta.url).resolve('tsx/esm/api')]);
  inputs.push(['typescript', createRequire(import.meta.url).resolve('typescript')]);
  for (const [name, path] of inputs) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path, signal ? { signal } : {})) hash.update(chunk);
    hashes.push([name, hash.digest('hex')]);
  }
  return createHash('sha256').update(JSON.stringify({ protocol: fileParserProtocol, node: process.versions.node, hashes })).digest('hex');
}
