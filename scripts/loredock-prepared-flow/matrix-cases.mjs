// Fixed R01-R15 assembly over caller-supplied inputs. No fallback, retries or model runtime.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { materialize, inventory, save, normalized, hash } from './io.mjs';
import { resourceCaseOrder } from './coordinator.mjs';
import { matrixCoverageGaps, matrixFreshSetups, boundaries, mutations } from './matrix-layout.mjs';
import { matrixSourceInput, oracleSetup, oraclePreparationOutcome, runMatrixStep } from './matrix-adapter.mjs';
import { assessMatrixEvidence } from './matrix-evidence.mjs';
import { coldCatalog, warmCatalog } from './cold-warm-cases.mjs';
import { createHistory, browserHistory, reopenHistory, revokeHistory, accountHistory } from './history-cases.mjs';
import { expiryCase } from './expiry-case.mjs';
import { observePreparationCancellation, cancelHeldProvider, shutdownHeldProvider, reopenInterrupted } from './cancellation-cases.mjs';
import { lostAdmissionResponse, lateReviewAfterQuestionEdit } from './network-cases.mjs';
import { inventoryEviction } from './inventory-eviction-case.mjs';
import { alternativeBuildCheckpoint, validatorBoundary } from './validator-cases.mjs';
import { latePreparationAfterReview, lateHistoryAfterReview, lateHistoryAfterRevocation } from './browser-fence-cases.mjs';
import { originalFault, pendingPurgeRecovery } from './catalog-fault-cases.mjs';
import { oracleCase } from './oracle-case.mjs';
import { accountWorker } from './worker-accounting-case.mjs';
import { assessLifetimes } from './lifetime-assess.mjs';

export function matrixCases({ ownerOutput, catalogRoots, workingRows, inputFor, oracleInputFor, oracles, sourceName, noteTarget, references, engineerNote,
  reservedFamily = null }) {
  assert(reservedFamily === null || reservedFamily === 'kiln-prepared-flow-127');
  assert.equal(oracles.length, 10); assert.equal(oracleSetup(oracles[6]), 'catalog-only');
  const freshSetups = matrixFreshSetups(oracles.map(row => row.id));
  const inputs = new Map(), cold = new Map(), warm = new Map();
  let capacity, shutdown, browserHistoryCheckpoint;
  const operations = [
    async c => buildCold(c, 'representative'),
    async c => buildCold(c, 'near-limit'),
    async c => {
      for (const size of ['representative', 'near-limit']) {
        const base = cold.get(size), input = inputs.get(size);
        if (!await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', size)) continue;
        const value = await c.step(size, directory => warmCatalog({ directory, checkpoint: base.checkpoint, ...input }));
        if (!value.errors.length) warm.set(size, value);
      }
    },
    async c => {
      if (!c.require(inputs.get('representative'), 'representative materialized sources')) return;
      const input = inputs.get('representative');
      capacity = await c.step('capacity', directory => createHistory({ directory, sources: input.sources, question: input.question, returnResultOnFailure: true }));
      if (capacity.refusal) c.http['capacity/http-controlled-continuation'] = [{ id: capacity.refusal.response.id,
        route: '/prepared-answers', method: 'POST', status: 409, errorCode: 'ANSWER_WITNESS_LIMIT' }];
    },
    async c => {
      for (const rows of [20, 64]) {
        const checkpoint = capacity?.checkpoints.find(row => row.rows === rows);
        if (!await c.requireCheckpoint(checkpoint, undefined, 'resource', 'history-' + rows)) continue;
        await c.step('history-' + rows, directory => browserHistory({ directory, checkpoint }));
      }
    },
    async c => {
      if (!c.require(inputs.get('representative'), 'representative materialized sources')) return;
      const input = inputs.get('representative');
      const value = await c.step('expiry', directory => expiryCase({ directory, sources: input.sources, question: input.question }));
      if (value.timingBounds?.passed === false) c.failures.push({ reason: 'real-expiry-bound-failed', timing: value.timingBounds });
    },
    async c => {
      const base = cold.get('representative');
      if (!await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', 'representative cold')) return;
      const args = { checkpoint: base.checkpoint, question: inputs.get('representative').question };
      await c.step('preparation', directory => observePreparationCancellation({ directory, ...args }));
      const provider = await c.step('provider', directory => cancelHeldProvider({ directory, ...args }));
      if (provider.drainMsAfterReleaseRequest > 2000) c.failures.push({ reason: 'cancel-drain-bound-failed', value: provider.drainMsAfterReleaseRequest });
      shutdown = await c.step('shutdown', directory => shutdownHeldProvider({ directory, ...args }));
      if (shutdown.shutdownMs > 10000) c.failures.push({ reason: 'shutdown-bound-failed', value: shutdown.shutdownMs });
    },
    async c => {
      const base = cold.get('representative');
      if (!await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', 'representative cold')) return;
      const args = { checkpoint: base.checkpoint, question: inputs.get('representative').question };
      const lost = await c.step('lost', directory => lostAdmissionResponse({ directory, ...args }));
      browserHistoryCheckpoint = lost.checkpoint;
      await c.step('edit', directory => lateReviewAfterQuestionEdit({ directory, ...args, changedQuestion: 'What deployment evidence is unavailable?' }));
    },
    async c => {
      for (const rows of [20, 64]) {
        const checkpoint = capacity?.checkpoints.find(row => row.rows === rows);
        if (!await c.requireCheckpoint(checkpoint, undefined, 'resource', 'history-' + rows)) continue;
        const value = await c.step('history-' + rows, directory => reopenHistory({ directory, checkpoint }));
        const missing = value.observation.missingTransient;
        c.http['history-' + rows + '/http'] = [{ id: missing.id, method: 'GET', route: '/question-preparations/' + checkpoint.readyId,
          status: 409, errorCode: 'QUESTION_NOT_FOUND' }];
      }
      if (await c.requireCheckpoint(shutdown?.checkpoint, 'held-provider-shutdown', 'fault', 'held shutdown'))
        await c.step('interrupted', directory => reopenInterrupted({ directory, checkpoint: shutdown.checkpoint }));
    },
    async c => {
      const base = cold.get('representative');
      if (await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', 'representative cold'))
        await c.step('eviction', directory => inventoryEviction({ directory, checkpoint: base.checkpoint, ...inputs.get('representative') }));
    },
    async c => {
      const base = cold.get('representative'), question = inputs.get('representative')?.question;
      if (await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', 'representative cold')) {
        const alternative = await c.step('alternative', directory => alternativeBuildCheckpoint({ directory, checkpoint: base.checkpoint }));
        for (const boundary of boundaries) for (const kind of mutations) {
          const value = await c.step(boundary + '-' + kind, directory => validatorBoundary({ directory, question, boundary, kind,
            checkpoint: kind === 'published-build' ? alternative.checkpoint : base.checkpoint }));
          if (!value.observedBoundary) c.missing.push('Unobserved validator boundary: ' + boundary + '-' + kind);
        }
        await c.step('browser-preparation', directory => latePreparationAfterReview({ directory, question, checkpoint: base.checkpoint }));
      }
      if (await c.requireCheckpoint(browserHistoryCheckpoint, 'browser-replay-history', 'fault', 'R08 browser history'))
        await c.step('browser-history', directory => lateHistoryAfterReview({ directory, question, checkpoint: browserHistoryCheckpoint }));
    },
    async c => {
      const checkpoint = capacity?.checkpoints.find(row => row.rows === 64);
      if (await c.requireCheckpoint(checkpoint, undefined, 'resource', 'history-64')) {
        await c.step('revocation', directory => revokeHistory({ directory, checkpoint, sourceName }));
        await c.step('pending', directory => pendingPurgeRecovery({ directory, checkpoint, sourceName }));
      }
      if (await c.requireCheckpoint(browserHistoryCheckpoint, 'browser-replay-history', 'fault', 'R08 browser history'))
        await c.step('browser', directory => lateHistoryAfterRevocation({ directory, checkpoint: browserHistoryCheckpoint,
          question: inputs.get('representative').question, sourceName }));
    },
    async c => {
      const base = cold.get('representative');
      if (!await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', 'representative cold')) return;
      for (const kind of ['missing', 'corrupt']) await c.step(kind, directory => originalFault({ directory,
        checkpoint: base.checkpoint, question: inputs.get('representative').question, kind }));
    },
    async c => {
      for (const expected of oracles) {
        const directory = path.join(c.directory, expected.id); await mkdir(directory);
        const corpus = oracleInputFor(expected.variant), sources = await materialize(path.join(directory, 'sources'), corpus);
        await save(path.join(directory, 'sources.json'), sources);
        const value = await c.step(expected.id + '/case', output => oracleCase({ directory: output,
          corpus, sources, expected, references, engineerNote, noteTarget }));
        if (oraclePreparationOutcome(value).status === 'not-run') {
          c.missing.push('Oracle preparation not run after failed analysis: ' + expected.id); continue;
        }
        for (const error of value.assessmentErrors) {
          assert.equal(error.code, 'ERR_ASSERTION'); c.failures.push({ oracle: expected.id, reason: 'source-prerequisite-failed', error });
        }
      }
    },
    async c => {
      for (const size of ['representative', 'near-limit']) {
        const base = cold.get(size), reference = warm.get(size);
        if (!await c.requireCheckpoint(base?.checkpoint, 'cold-catalog', 'resource', size) || !c.require(reference, size + ' first warm reference')) continue;
        const diagnostic = await c.step(size + '-worker', directory => accountWorker({ directory, checkpoint: base.checkpoint,
          ...inputs.get(size), ordinaryReference: reference.repetitions[0] }));
        c.failures.push(...diagnostic.workChecks.filter(row => !row.passed));
        const lifetime = assessLifetimes({ cold: base, warm: reference, diagnostic });
        await save(path.join(c.directory, size + '-lifetime.json'), lifetime);
        c.failures.push(...lifetime.checks.filter(row => row.status === 'failed')); c.missing.push(...lifetime.incomplete);
      }
      let nearHistory;
      if (await c.requireCheckpoint(cold.get('near-limit')?.checkpoint, 'cold-catalog', 'resource', 'near-limit list setup')) {
        const input = inputs.get('near-limit');
        nearHistory = await c.step('near-history', directory => createHistory({ directory, sources: input.sources, question: input.question, returnResultOnFailure: true }));
        if (nearHistory.refusal) c.http['near-history/http-controlled-continuation'] = [{ id: nearHistory.refusal.response.id,
          route: '/prepared-answers', method: 'POST', status: 409, errorCode: 'ANSWER_WITNESS_LIMIT' }];
      }
      for (const [size, history] of [['representative', capacity], ['near-limit', nearHistory]]) for (const rows of [20, 64]) {
        const checkpoint = history?.checkpoints.find(row => row.rows === rows);
        if (!await c.requireCheckpoint(checkpoint, undefined, 'resource', size + ' list-' + rows)) continue;
        const value = await c.step(size + '-list-' + rows, directory => accountHistory({ directory, checkpoint }));
        if (value.observation.totalWork > 1000000) c.failures.push({ scope: size + '-list-' + rows, metric: 'answerListAggregateWork',
          value: value.observation.totalWork, limit: 1000000 });
      }
    },
  ];

  async function buildCold(c, size) {
    const input = inputFor(size), directory = path.join(c.directory, 'input'); await mkdir(directory);
    const sources = await materialize(path.join(directory, 'sources'), input.corpus); await save(path.join(directory, 'sources.json'), sources);
    assert.equal(sources.originals.length, input.expectedFiles);
    const common = matrixSourceInput(input, sources, references, engineerNote);
    inputs.set(size, common);
    const value = await c.step('cold', output => coldCatalog({ directory: output, ...common,
      expectedFiles: input.expectedFiles, expectedCodeFiles: input.expectedCodeFiles }));
    if (!value.errors.length) cold.set(size, value);
  }
  return resourceCaseOrder.map((id, index) => ({ id, requires: [], independentAfterFailure: true, run: async ({ directory }) => {
    const c = { directory, steps: [], handoffs: [], missing: [], failures: [], http: {}, errors: [], failedSetups: {}, safe: true,
      require(value, name) { if (!value) { c.missing.push('Missing functional prerequisite: ' + name); return false; } return true; },
      async requireCheckpoint(checkpoint, kind, lane, name) {
        if (!c.require(checkpoint, name)) return false;
        if (kind) assert.equal(checkpoint.kind, kind);
        // History checkpoints are produced only by this assembly's normal capacity helper.
        assert.equal(checkpoint.lane ?? 'resource', lane);
        assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
        c.handoffs.push({ name, data: checkpoint.data, kind: checkpoint.kind ?? 'capacity', lane, filesSha256: hash(JSON.stringify(checkpoint.files)) });
        return true;
      },
      async step(name, operation) {
        const output = path.join(directory, name), root = path.relative(ownerOutput, path.join(output, 'data'));
        const { value, unavailable } = await runMatrixStep({ directory: output, operation, freshKind: freshSetups[root] });
        c.steps.push({ name, result: path.relative(directory, path.join(output, 'result.json')) });
        if (unavailable) {
          c.failedSetups[root] = unavailable;
          c.failures.push({ step: name, reason: 'completed-analysis-prerequisite-failed', errors: value.errors });
        }
        return value;
      },
    };
    let evidence;
    try { await operations[index](c); } catch (error) { c.errors.push(normalized(error)); c.safe = false; }
    try {
      evidence = await assessMatrixEvidence({ directory, ownerOutput, catalogRoots, workingRows,
        expectedHttp: c.http, freshSetups, failedSetups: c.failedSetups });
      c.failures.push(...evidence.failures); c.missing.push(...evidence.incomplete);
      await save(path.join(directory, 'evidence-assessment.json'), evidence);
    } catch (error) { c.errors.push(normalized(error)); c.safe = false; }
    const coverage = matrixCoverageGaps[index];
    const status = !c.safe ? 'incomplete' : !c.steps.length ? 'not-run' : c.failures.length ? 'failed'
      : c.missing.length || coverage.length ? 'incomplete' : 'passed';
    const result = { id, status, safeToContinue: c.safe, steps: c.steps, handoffs: c.handoffs,
      failures: c.failures, incomplete: [...c.missing, ...coverage], errors: c.errors, failedSetups: c.failedSetups,
      controlledCalls: evidence?.controlledCalls ?? null, modelCalls: 0, reservedFamilyReads: reservedFamily ? null : 0,
      ...(reservedFamily ? { reservedFamily, familyConsumed: true, sourceReadAccounting: 'not-counted; see materialized sources and HTTP journals' } : {}),
      resourceQualification: false };
    await save(path.join(directory, 'case-assessment.json'), result);
    return { status, safeToContinue: c.safe, artifacts: ['case-assessment.json', ...(evidence ? ['evidence-assessment.json'] : [])],
      details: { steps: c.steps.length, failures: c.failures.length, incomplete: result.incomplete.length,
        reason: status === 'not-run' ? c.missing.join('; ') : null, resourceQualification: false } };
  } }));
}
