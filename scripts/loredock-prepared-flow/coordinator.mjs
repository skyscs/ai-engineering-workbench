// Ordinary orchestration development only. A final sealed qualification entry is separate.
import assert from 'node:assert/strict';
import { constants, openSync, closeSync, fsyncSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, realpath, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { hash, journal, normalized, save } from './io.mjs';

const rawProtocol = await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url));
const protocol = JSON.parse(rawProtocol);
export const resourceCaseOrder = Object.freeze(protocol.resourceCases.map(row => row.id));

function syncDirectory(directory) {
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}
async function artifact(directory, relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative) && path.normalize(relative) === relative && !relative.split('/').includes('..'));
  assert.notEqual(relative, 'coordinator-outcome.json', 'Case evidence must not use the coordinator output name.');
  const file = path.join(directory, relative);
  assert.equal(await realpath(file), file, 'Case evidence must not follow symlinks.');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true }); assert(before.isFile());
    const checksum = createHash('sha256'); let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) { bytes += chunk.length; checksum.update(chunk); }
    const after = await handle.stat({ bigint: true });
    assert.equal(before.size, after.size); assert.equal(before.mtimeNs, after.mtimeNs); assert.equal(BigInt(bytes), after.size);
    return { path: relative, bytes, sha256: checksum.digest('hex') };
  } finally { await handle.close(); }
}

export async function coordinateOrdinary({ directory, claimPath, family, cases }) {
  // Reject missing handlers or an altered order before consuming anything.
  assert(typeof family === 'string' && /^ordinary-[a-z0-9-]+$/.test(family), 'This entry cannot execute a reserved family.');
  assert(Array.isArray(cases)); assert.deepEqual(cases.map(row => row.id), resourceCaseOrder);
  for (const [index, row] of cases.entries()) {
    assert.equal(typeof row.run, 'function'); assert.equal(typeof row.independentAfterFailure, 'boolean');
    assert(Array.isArray(row.requires) && new Set(row.requires).size === row.requires.length);
    assert(row.requires.every(id => resourceCaseOrder.slice(0, index).includes(id)), 'Dependencies must precede their consumer.');
  }
  const plan = cases.map(row => ({ ...row, requires: [...row.requires] }));
  for (const value of [directory, claimPath]) assert(path.isAbsolute(value ?? '') && path.resolve(value) === value);
  assert.notEqual(directory, claimPath);
  assert(!claimPath.startsWith(directory + path.sep), 'The shared consumption marker must be outside the per-attempt output.');
  await mkdir(directory);
  assert.equal(await realpath(directory), directory);
  assert.equal(await realpath(path.dirname(claimPath)), path.dirname(claimPath));
  const identity = { schemaVersion: 'prepared-flow-ordinary-sequence/1', family, directory,
    protocolSha256: hash(rawProtocol), order: resourceCaseOrder, qualification: false,
    activityAccounting: 'not-observed-by-coordinator', modelCalls: null, reservedFamilyReads: null };
  // An empty/partial marker is consumed too: O_EXCL refuses all later attempts.
  const marker = openSync(claimPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(marker, Buffer.from(JSON.stringify(identity) + '\n')); fsyncSync(marker); } finally { closeSync(marker); }
  syncDirectory(path.dirname(claimPath));
  const log = journal(path.join(directory, 'sequence.jsonl'));
  const report = { ...identity, cases: [], errors: [], allCasesPassed: false, modelEligibility: false };
  let stopped = null, failed = false;
  try {
    log.append({ event: 'started', ...identity }); syncDirectory(directory);
    for (const entry of plan) {
      const dependencies = entry.requires.filter(id => report.cases.find(row => row.id === id)?.status !== 'passed');
      let record;
      if (stopped || dependencies.length || failed && !entry.independentAfterFailure) {
        record = { id: entry.id, status: 'not-run', reason: stopped ?? (dependencies.length ? 'dependency-failed' : 'not-independent-after-failure'), dependencies };
      } else {
        const output = path.join(directory, entry.id); await mkdir(output);
        log.append({ event: 'case-started', id: entry.id }); syncDirectory(directory);
        try {
          const result = await entry.run({ directory: output });
          assert(result && ['passed', 'failed', 'incomplete', 'not-run'].includes(result.status));
          if (result.status === 'not-run') assert(typeof result.details?.reason === 'string' && result.details.reason.length > 0,
            'A handler that cannot run must retain its prerequisite reason.');
          assert.equal(typeof result.safeToContinue, 'boolean');
          assert(result.status !== 'passed' || result.safeToContinue, 'A passed case cannot declare an unsafe continuation.');
          assert(Array.isArray(result.artifacts) && result.artifacts.length > 0 && result.artifacts.length <= 64);
          assert.equal(new Set(result.artifacts).size, result.artifacts.length);
          const metadata = result.details ?? null;
          assert(Buffer.byteLength(JSON.stringify(metadata)) <= 65536, 'Keep case details bounded and raw artifacts separate.');
          const artifacts = [];
          for (const relative of result.artifacts) artifacts.push(await artifact(output, relative));
          record = { id: entry.id, status: result.status, safeToContinue: result.safeToContinue, details: metadata, artifacts };
          if (!result.safeToContinue) stopped = 'case-requires-stop';
        } catch (error) {
          record = { id: entry.id, status: 'incomplete', error: normalized(error) };
          // An unclassified exception or unreadable evidence is not presumed safe.
          stopped = 'case-exception-or-invalid-evidence';
        }
        await save(path.join(output, 'coordinator-outcome.json'), record);
      }
      report.cases.push(record); failed ||= record.status !== 'passed';
      log.append({ event: 'case-finished', ...record });
    }
    report.allCasesPassed = report.cases.length === resourceCaseOrder.length && report.cases.every(row => row.status === 'passed');
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try {
      await save(path.join(directory, 'result.json'), report);
      log.append({ event: 'finished', allCasesPassed: report.allCasesPassed, modelEligibility: false, errors: report.errors });
      syncDirectory(directory);
    } finally { log.close(); }
  }
  return report;
}
