import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const hash = raw => createHash('sha256').update(raw).digest('hex');
export async function retainedTransportCases() {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
  const archive = await readFile(new URL('../../../../../docs/fixtures/loredock-parser-transport/first.tar.gz', import.meta.url));
  assert.equal(hash(archive), manifest.sourceArchiveSha256);
  assert.deepEqual(manifest.cases.map(row => row.id), ['ordinary', 'dense-operations', 'long-owner']);
  const files = new Map();
  for (const file of manifest.files) {
    assert(/^(ordinary|dense-operations|long-owner)\.(source\.txt|facts\.json\.gz)$/.test(file.path));
    const stored = await readFile(new URL('./' + file.path, import.meta.url)); assert.equal(hash(stored), file.storedSha256);
    const raw = file.path.endsWith('.gz') ? gunzipSync(stored) : stored;
    assert.equal(raw.length, file.bytes); assert.equal(hash(raw), file.sha256); files.set(file.path, raw.toString());
  }
  return manifest.cases.map(row => {
    const content = files.get(row.id + '.source.txt'), serialized = files.get(row.id + '.facts.json.gz');
    assert.equal(hash(content), row.input.sha256); assert.equal(hash(serialized), row.direct.factsHash);
    return { ...row, content, serialized };
  });
}
