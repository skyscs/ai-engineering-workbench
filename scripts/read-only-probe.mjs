import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2];
if (!root || !path.basename(root).startsWith('aew-runtime-')) throw new Error('Expected a generated fixture root.');
const results = [];
for (const [directory, source] of [['client', 'request.mjs'], ['service', 'config.mjs'], ['artifacts', 'request.log']]) {
  await readFile(path.join(root, directory, source));
  try {
    await writeFile(path.join(root, directory, 'write-probe.txt'), 'This write must be denied.\n', { flag: 'wx' });
    results.push({ directory, readable: true, writeDenied: false });
  } catch (error) {
    results.push({ directory, readable: true, writeDenied: ['EROFS', 'EACCES', 'EPERM'].includes(error.code), code: error.code });
  }
}
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.every((result) => result.writeDenied) ? 0 : 1;
