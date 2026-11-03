import { register } from 'tsx/esm/api';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const malformed = process.argv.at(-1) === 'malformed-result';
if (malformed) process.argv.pop();
const unregister = register();
try { await import('../../../../scripts/loredock-streaming-qualification/child.mjs'); }
finally { await unregister(); }
if (malformed) await writeFile(path.join(process.argv[2], process.argv[3], 'result.json'), 'null\n');
