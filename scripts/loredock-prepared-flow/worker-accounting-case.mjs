// Replay the first recorded warm flow once, forwarding actual budgets only in this diagnostic lane.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { launch, client, save, inventory, normalized, until, hash } from './io.mjs';
import { prepare, generate } from './flow.mjs';
import { assessPreview } from './assess.mjs';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
const json = async file => JSON.parse(await readFile(file, 'utf8'));
// No content/runtime/path normalization. Only these recorded identities and times may differ.
const preview = ({ id, requestId, ...rest }) => rest;
const answer = ({ id, createdAt, dispatchedAt, ...rest }) => rest;
const list = ({ attempts, publishedAnswerId, ...rest }) => ({ ...rest, attempts: attempts.map(answer) });

export async function accountWorker({ directory, checkpoint, question, assessment, ordinaryReference }) {
  await mkdir(directory);
  const data = path.join(directory, 'data'), report = { errors: [], diagnosticTimingQualified: false, resourceQualification: false };
  let daemon, api;
  try {
    assert.equal(checkpoint.kind, 'cold-catalog'); assert.equal(checkpoint.lane, 'resource');
    assert.equal(checkpoint.storage.rows, 0);
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    const reference = ordinaryReference;
    assert.equal(reference.repetition, 1, 'Accounting must compare the first fixed warm repetition.');
    assert.deepEqual(reference.runtime, { prepares: 1, calls: 1, closed: 1 });
    assert.equal(reference.published.answer.status, 'succeeded');
    assert.equal(reference.published.answer.question, question);
    for (const key of ['contextSha256', 'witnessSha256', 'reviewedHash']) assert.match(reference.stored[key], /^[a-f0-9]{64}$/);
    assert(reference.stored.witnessBytes > 0);
    assert.equal(reference.stored.contextSha256, hash(JSON.stringify(reference.prepared.review.context)));
    assert.equal(reference.stored.reviewedHash, reference.prepared.review.reviewedHash);
    assert.deepEqual(reference.saved.value, reference.published.answer);
    assert.equal(reference.list.value.attempts.length, 1);
    assert.equal(reference.list.value.publishedAnswerId, reference.published.answer.id);
    const identity = reference.saved.value.runtime;
    assert.equal(identity.version, 'owned-controlled-runtime'); assert.equal(identity.policyVersion, 'owned-model-free');
    assert.equal(identity.configurationFingerprint, 'owned'); assert.equal(identity.executable, process.execPath);
    const connection = { executable: identity.executable, configHome: identity.configHome, profile: identity.profile };
    await save(path.join(directory, 'inputs.json'), { checkpoint, question, ordinaryReference });
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files);
    daemon = await launch({ directory: path.join(directory, 'diagnostic'), data, controlled: true, accounting: true });
    api = await client(path.join(directory, 'http'));
    // The controlled runtime records this exact owned connection but never executes or reads it.
    await api.request('/answers/configuration', 'PUT', connection);
    assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
    await daemon.command('accounting-start', { scope: 'complete-find-through-history' });
    const began = performance.now(), prepared = await prepare(api, question);
    const published = await generate(api, prepared.review);
    const saved = await api.request('/answers/' + published.answer.id), history = await api.request('/answers');
    report.diagnosticElapsedMs = performance.now() - began;
    await until(async () => (await daemon.command('stats')).closed === 1, 'Diagnostic worker did not drain.');
    const accounting = await daemon.command('accounting-end');
    await save(path.join(directory, 'accounting.json'), accounting);
    report.accounting = accounting;
    assert(accounting.budgets.length > 0); assert.deepEqual(accounting.unclosedBudgets, []);
    for (const budget of accounting.budgets) {
      assert.equal(budget.closes, 1); assert.deepEqual(budget.errors, {});
      assert.equal(Object.values(budget.charges).reduce((sum, row) => sum + row.accepted, 0), budget.final.totalWork);
    }
    assert.equal(accounting.totalWork, accounting.budgets.reduce((sum, budget) => sum + budget.final.totalWork, 0));
    report.workChecks = accounting.budgets.map(budget => ({ metric: 'perActualOperationWork', budget: budget.id,
      value: budget.final.totalWork, limit: thresholds.perActualOperationWork, passed: budget.final.totalWork <= thresholds.perActualOperationWork }));
    report.workChecks.push({ metric: 'controlledFindThroughHistoryWork', value: accounting.totalWork,
      limit: thresholds.controlledFindThroughHistoryWork, passed: accounting.totalWork <= thresholds.controlledFindThroughHistoryWork });
    report.runtime = await daemon.command('stats');
    assert.deepEqual(report.runtime, { prepares: 1, calls: 1, closed: 1 });
    assert.deepEqual(saved.value, published.answer); assert.equal(history.value.attempts.length, 1);
    assert.equal(history.value.publishedAnswerId, published.answer.id);
    report.assessment = assessPreview(prepared.review, assessment);
    const request = await json(path.join(daemon.directory, 'request-1.json'));
    const issued = prepared.review.context.spans.map(span => span.id);
    assert.deepEqual(request.schema.properties.claims.items.properties.evidenceIds.items.enum, issued);
    for (const claim of saved.value.answer.claims) for (const id of claim.evidenceIds) assert(issued.includes(id));
    report.observation = { prepared, published, saved, list: history, request };
    assert.deepEqual(preview(prepared.review), preview(reference.prepared.review));
    assert.deepEqual(answer(published.answer), answer(reference.published.answer));
    assert.deepEqual(list(history.value), list(reference.list.value));
    assert.deepEqual(request, reference.request);
    report.outputParity = true;
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    api?.close();
    try {
      if (daemon) {
        report.exit = await daemon.stop(); assert.equal(report.exit.code, 0);
        report.audit = await json(path.join(daemon.directory, 'accounting-audit.json'));
        assert.equal(report.audit.activeScope, null); assert.deepEqual(report.audit.lateActivities, []);
        assert.deepEqual(report.audit.unscopedBudgets, []); assert.deepEqual(report.audit.unclosedBudgets, []);
        assert.equal(report.audit.observedBudgets, report.accounting?.budgets.length);
      }
      if (report.observation) {
        // Inspect the stopped working copy only. Opening the input can mutate its WAL/SHM files.
        const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
        try {
          const stored = database.prepare('SELECT a.context,w.witness,w.reviewedHash FROM answer_attempts a JOIN answer_witnesses w ON w.answerId=a.id WHERE a.id=?').get(report.observation.published.answer.id);
          report.stored = { contextSha256: hash(stored.context), witnessSha256: hash(stored.witness),
            witnessBytes: Buffer.byteLength(stored.witness), reviewedHash: stored.reviewedHash };
          assert.equal(stored.context, JSON.stringify(report.observation.prepared.review.context));
          assert.equal(JSON.parse(stored.witness).prompt, report.observation.request.prompt);
          assert.deepEqual(report.stored, ordinaryReference.stored);
          report.storedByteParity = true;
        } finally { database.close(); }
      }
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    } catch (error) { report.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), report);
  }
  return report;
}
