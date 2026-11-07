// A separately pinned outside process reads retained evidence; it never starts a workload.
import { createHash } from 'node:crypto';
import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { assessRetainedCounterRun } from './assess.mjs';

const digest = raw => createHash('sha256').update(raw).digest('hex');
function bounded(path, maximum) {
  const named = lstatSync(path);
  if (!named.isFile() || named.isSymbolicLink() || named.size > maximum) throw new Error('Invalid bounded evidence file.');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_CLOEXEC);
  try {
    const first = fstatSync(fd);
    if (!first.isFile() || first.size > maximum || first.dev !== named.dev || first.ino !== named.ino) {
      throw new Error('Evidence entry changed.');
    }
    const raw = Buffer.alloc(first.size + 1);
    let offset = 0;
    while (offset < raw.length) {
      const count = readSync(fd, raw, offset, raw.length - offset, offset);
      if (!count) break;
      offset += count;
    }
    const last = fstatSync(fd), current = lstatSync(path);
    if (offset !== first.size || last.size !== first.size || last.mtimeMs !== first.mtimeMs
      || last.ctimeMs !== first.ctimeMs || current.dev !== first.dev || current.ino !== first.ino
      || current.size !== last.size || current.mtimeMs !== last.mtimeMs || current.ctimeMs !== last.ctimeMs
      || !current.isFile() || current.isSymbolicLink()) throw new Error('Evidence changed while reading.');
    const bytes = raw.subarray(0, offset);
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return { text, bytes: bytes.length, sha256: digest(bytes) };
  } finally { closeSync(fd); }
}

const [manifestPath, manifestSha256] = process.argv.slice(2);
if (process.argv.length !== 4 || !/^[a-f0-9]{64}$/.test(manifestSha256 ?? '')) {
  throw new Error('Usage: postprocess.mjs MANIFEST SHA256');
}
const manifestInput = bounded(resolve(manifestPath), 65536);
if (manifestInput.sha256 !== manifestSha256) throw new Error('Manifest digest mismatch.');
const manifest = JSON.parse(manifestInput.text);
if (manifest.schemaVersion !== 'loredock-staged-counter-prerequisite/1'
  || typeof manifest.output !== 'string' || resolve(manifest.output) !== manifest.output
  || realpathSync(manifest.output) !== manifest.output || !lstatSync(manifest.output).isDirectory()) {
  throw new Error('Invalid retained output directory.');
}
const claim = bounded(manifest.output + '.claim', 4096);
const claimed = JSON.parse(claim.text);
if (claimed.manifestSha256 !== manifestSha256 || claimed.unit !== manifest.unit) throw new Error('First claim mismatch.');
const startedAtNs = process.hrtime.bigint().toString(), records = {}, inventory = [], errors = [];
const names = readdirSync(manifest.output).sort();
let total = 0;
if (names.length > 256) throw new Error('Too many first records.');
for (const name of names) {
  try {
    if (!/^[a-z0-9_-]+\.json$/.test(name)) throw new Error('Unexpected evidence name.');
    const row = bounded(join(manifest.output, name), 1048576);
    total += row.bytes;
    if (total > 2097152) throw new Error('First evidence exceeds total bound.');
    records[name] = row.text;
    inventory.push({ path: name, bytes: row.bytes, sha256: row.sha256 });
  } catch (error) {
    errors.push({ path: name, error: String(error.message).slice(0, 256) });
  }
}
const assessment = assessRetainedCounterRun(records, { runId: manifest.runId, candidateSha256: manifestSha256 });
if (errors.length) {
  if (assessment.status !== 'FAIL') assessment.status = 'UNAVAILABLE';
  assessment.reasons.push({ code: 'OUTSIDE_INPUT_ACQUISITION_UNAVAILABLE', status: 'UNAVAILABLE' });
}
process.stdout.write(JSON.stringify({ schemaVersion: 'loredock-staged-counter-offline-run/1',
  manifestSha256, candidateHead: manifest.candidateHead, manifestInput, claim,
  startedAtNs, endedAtNs: process.hrtime.bigint().toString(), inventory, errors, assessment }) + '\n');
process.exitCode = assessment.status === 'PASS' ? 0 : 1;
