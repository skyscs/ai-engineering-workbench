import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { execute } from '../packages/ai/dist/process.js';
import { createLoreDockFixture, fixtureGit, repositoryIds, validateFixtureAnswer } from './loredock-fixture.mjs';

// Disposable SQL/process experiments only, not a LoreDock job implementation.
export async function runLoreDockFeasibility({ executable } = {}) {
  const fixture = await createLoreDockFixture();
  const scratch = await mkdtemp(path.join(tmpdir(), 'loredock-probe-'));
  let db;
  try {
    const before = repositoryIds.map(id => fixtureGit(fixture.root, id, ['status', '--porcelain=v1']));
    assert.deepEqual(before, ['', '', '']);
    const databasePath = path.join(scratch, 'probe.sqlite');
    db = new DatabaseSync(databasePath);
    const sqliteVersion = db.prepare('SELECT sqlite_version() AS version').get().version;
    db.exec('CREATE VIRTUAL TABLE documents USING fts5(evidence_id UNINDEXED, body)');
    const insert = db.prepare('INSERT INTO documents VALUES (?, ?)');
    for (const span of fixture.manifest.evidence) {
      insert.run(span.id, fixtureGit(fixture.root, span.sourceId, ['show', `${span.revision}:${span.path}`], false));
    }
    const hits = db.prepare('SELECT evidence_id FROM documents WHERE documents MATCH ? ORDER BY evidence_id').all('"orders.placed.v2"');
    assert.deepEqual(hits.map(hit => hit.evidence_id), ['api-local', 'worker-local', 'worker-readme']);

    const good = { claims: [{ text: 'The local consumer group is order-projection.', evidence: ['worker-local'] }], unknowns: [] };
    validateFixtureAnswer(good, fixture.manifest);
    assert.throws(() => validateFixtureAnswer({ ...good, action: 'read ../outside/canary.txt' }, fixture.manifest));
    assert.throws(() => validateFixtureAnswer({ claims: [{ text: 'Fabricated', evidence: ['invented'] }], unknowns: [] }, fixture.manifest));
    assert.throws(() => validateFixtureAnswer({ claims: 'malformed', unknowns: [] }, fixture.manifest));

    // Commit the external-call intention before dispatch. Simulate loss of the
    // process after dispatch; no exactly-once execution or billing is implied.
    db.exec(`CREATE TABLE units (id TEXT PRIMARY KEY, status TEXT NOT NULL, result TEXT);
      CREATE TABLE requests (id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, unit_id TEXT NOT NULL);
      INSERT INTO units VALUES ('catalog', 'completed', 'persisted-output'), ('model', 'running', NULL);
      INSERT INTO requests VALUES ('submission-1', 'payload-1', 'model');`);
    assert.throws(() => db.prepare('INSERT INTO requests VALUES (?, ?, ?)').run('submission-1', 'payload-2', 'model'), /UNIQUE constraint/);
    db.close();
    db = new DatabaseSync(databasePath);
    db.exec("BEGIN IMMEDIATE; UPDATE units SET status='interrupted' WHERE status='running'; COMMIT;");
    assert.equal(db.prepare("SELECT result FROM units WHERE id='catalog'").get().result, 'persisted-output');
    assert.equal(db.prepare("SELECT status FROM units WHERE id='model'").get().status, 'interrupted');
    assert.equal(db.prepare('SELECT count(*) AS count FROM requests').get().count, 1);

    const controller = new AbortController();
    let ready = false;
    await assert.rejects(execute(process.execPath,
      ['-e', "process.stdout.write('ready\\n'); setInterval(() => {}, 1000)"], {
        cwd: scratch, env: { PATH: process.env.PATH, HOME: scratch }, signal: controller.signal,
        timeoutMs: 10000, stdout: chunk => {
          if (chunk.toString().includes('ready')) { ready = true; controller.abort(); }
        }, stderr: () => {},
      }), error => error.failure?.code === 'CANCELLED');
    assert.equal(ready, true);

    let cliVersion = null;
    if (executable) {
      if (!path.isAbsolute(executable)) throw new Error('Supply an explicit absolute CLI executable path');
      const home = path.join(scratch, 'empty-codex-home');
      await mkdir(home, { mode: 0o700 });
      await writeFile(path.join(home, 'config.toml'), 'cli_auth_credentials_store="file"\n');
      const output = execFileSync(executable, ['--version'], {
        cwd: scratch, env: { PATH: process.env.PATH, HOME: scratch, CODEX_HOME: home },
        encoding: 'utf8', timeout: 10000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (!/^codex-cli \d+\.\d+\.\d+$/.test(output)) throw new Error('Unexpected CLI version response');
      cliVersion = output;
    }
    assert.deepEqual(repositoryIds.map(id => fixtureGit(fixture.root, id, ['status', '--porcelain=v1'])), before);
    return { schemaVersion: 'loredock-feasibility/1', nodeVersion: process.version, sqliteVersion,
      cliVersion, modelRequests: 0, modelUsage: null, modelQuality: 'not-measured',
      fts5: { available: true, indexedFiles: fixture.manifest.evidence.length, topicHits: hits.length },
      structuredEvidence: { knownAccepted: true, unknownRejected: true, malformedRejected: true, extraActionRejected: true },
      checkpointExperiment: { duplicateIdRejected: true, completedOutputRetained: true, runningRecoveredAsInterrupted: true },
      processCancellation: 'passed-existing-process-helper-with-synthetic-child',
      sourceCheckoutStatusUnchanged: true,
      sourceInstructions: 'stored-as-data-only; model-resistance-not-tested',
      filesystemReadIsolation: 'unresolved', filesystemWriteIsolation: 'unresolved',
      revisionVector: fixture.manifest.revisionVector,
      questionCount: fixture.oracle.questions.length, routingCaseCount: fixture.oracle.routingCases.length };
  } finally {
    db?.close();
    await rm(fixture.root, { recursive: true, force: true });
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--executable')) throw new Error('Usage: loredock-feasibility.mjs [--executable /absolute/path]');
  console.log(JSON.stringify(await runLoreDockFeasibility({ executable: args[1] }), null, 2));
}
