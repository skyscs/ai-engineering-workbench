import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { completenessContract } from '../fixtures/loredock-completeness/cases.mjs';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';
import { digest } from './loredock-fixture.mjs';

const repositoryFile = relative => new URL(`../${relative}`, import.meta.url);
export async function verifyCompletenessBaseline() {
  const baseline = JSON.parse(await readFile(repositoryFile('fixtures/loredock-completeness/baseline.json'), 'utf8'));
  assert.equal(digest(JSON.stringify(completenessContract)), baseline.contractHash, 'Benchmark changes require a separate baseline review.');
  assert.equal(completenessContract.cases.length, baseline.caseCount);
  assert.equal(completenessContract.intents.length, baseline.intentCount);
  for (const [relative, hash] of Object.entries(baseline.historicalFiles)) {
    assert.equal(digest(await readFile(repositoryFile(relative))), hash, `Historical record changed: ${relative}`);
  }
  return baseline;
}

export function measureRequirement(requirement, originals, manifest) {
  assert.ok(['all', 'any'].includes(requirement.mode)); assert.ok(requirement.evidence.length);
  const evidence = requirement.evidence.map(id => {
    const ref = manifest.evidence.find(ref => ref.id === id); assert.ok(ref, `Unknown evidence: ${id}`);
    const index = originals.findIndex(span => span.sourceName === ref.sourceId && span.revision === ref.revision
      && span.path === ref.path && span.contentHash === ref.contentHash && span.blobId === ref.blobId
      && span.startLine <= ref.startLine && span.endLine >= ref.endLine);
    return { id, rank: index < 0 ? null : index + 1 };
  });
  return { id: requirement.id, kind: requirement.kind, mode: requirement.mode, evidence,
    available: requirement.mode === 'any' ? evidence.some(ref => ref.rank !== null) : evidence.every(ref => ref.rank !== null) };
}

const historicalCases = [
  { id: 's04', refs: ['inventory-worker/config/local.json', 'inventory-worker/README.md', 'contract-library/contracts/StockReserved.json'] },
  { id: 's07', refs: ['shipping-worker/config/local.json', 'shipping-worker/src/Shipments.java', 'shipping-worker/README.md'] },
  { id: 's14', refs: ['legacy-admin/src/stock.js', 'inventory-api/config/routes.json', 'legacy-admin/README.md', 'legacy-admin/src/plugin.js'] },
  { id: 's19', refs: ['supplier-sync/src/SupplierSync.java', 'supplier-sync/README.md'] },
  { id: 'r04', refs: ['worker-readme', 'consume'] },
];

async function diagnoseHistorical(manifest) {
  const rows = [];
  for (const version of ['v7', 'v8']) {
    const resultFile = `docs/fixtures/loredock-scale-answer-quality/answer-result-${version}.json`;
    const report = JSON.parse(await readFile(repositoryFile(resultFile), 'utf8'));
    for (const diagnostic of historicalCases) {
      const result = report.results.find(result => result.questionId === diagnostic.id); assert.ok(result);
      const support = measureRequirement({ id: diagnostic.id, kind: 'diagnostic', mode: 'all', evidence: diagnostic.refs }, result.originals, manifest);
      const citations = new Set(result.attempt.answer.claims.flatMap(claim => claim.evidenceIds));
      rows.push({ run: version, questionId: diagnostic.id, sourceResult: resultFile,
        requiredEvidenceMissingInOriginalReport: result.missingEvidence,
        supportingPassages: support.evidence.map(ref => ({ ...ref,
          cited: ref.rank !== null && citations.has(result.originals[ref.rank - 1].id) })),
        interpretation: 'Position and citation use only; presence is not answer completeness and a citation is not proof of support.' });
    }
  }
  return rows;
}

function traceMissingCandidates(catalog, context, requirements, manifest) {
  if (context.retrievalVersion !== 'fts-question-v6' || requirements.every(item => item.available)) return null;
  // Reproduce only the bounded v6 FTS ordering after the issued context is fixed.
  // The diagnostic oracle cannot affect either query or product admission.
  const lookup = terms => terms.length ? catalog.store.all(`SELECT s.id,src.name AS sourceName,f.path FROM question_search
    JOIN spans s ON s.id=question_search.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE question_search MATCH ? AND f.buildId=? AND f.status='indexed' AND src.status='active'
    ORDER BY rank,bs.rowid,f.path,s.startLine LIMIT ?`, terms.map(term => `"${term}"`).join(' OR '), context.buildId, context.limits.candidates + 1) : [];
  const lexical = lookup(context.terms), expanded = lookup(context.expansionTerms);
  const rank = (candidates, id) => {
    const ref = manifest.evidence.find(ref => ref.id === id); assert.ok(ref);
    const index = candidates.findIndex(item => item.sourceName === ref.sourceId && item.path === ref.path
      && measureRequirement({ id: 'trace', kind: 'diagnostic', mode: 'all', evidence: [id] }, [catalog.evidence(item.id)], manifest).available);
    return index < 0 ? null : index + 1;
  };
  const missing = [...new Set(requirements.filter(item => !item.available).flatMap(item => item.evidence.filter(ref => ref.rank === null).map(ref => ref.id)))];
  return { version: 'offline-v6-fts-order/1', lexicalCandidates: lexical.length, expandedCandidates: expanded.length,
    missing: missing.map(id => ({ id, lexicalRank: rank(lexical, id), expandedRank: rank(expanded, id) })),
    scope: 'Bounded FTS candidate positions before final admission; no source text or oracle enters product retrieval.' };
}

// The oracle is confined to this offline evaluator. Product services receive a
// question string and the saved index, with no intent, requirement or expected text.
export async function evaluateCompleteness(services) {
  const { Catalog, CatalogStore, retrieveAnswerContext, answerPrompt, answerLimits, answerPromptVersion, retrievalVersion } = services;
  const baseline = await verifyCompletenessBaseline();
  async function measure(includeHistory) {
    const fixture = await createScaleFixture(); let store, catalog;
    try {
      assert.deepEqual(scaleBaseline(fixture), baseline.sourceBaseline);
      store = new CatalogStore(path.join(fixture.root, 'data')); catalog = new Catalog(store);
      const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
      const preview = await catalog.previewSources(paths);
      await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'completeness' });
      const state = catalog.state(); catalog.start('completeness', state.sourceSetVersion, state.policyVersion); await catalog.idle();
      const results = [];
      for (const item of completenessContract.cases) {
        const context = retrieveAnswerContext(catalog, item.question), prompt = answerPrompt(context);
        const originals = context.spans.map(span => catalog.evidence(span.id));
        assert.ok(context.spans.length <= answerLimits.spans && context.textBytes <= answerLimits.textBytes);
        assert.ok(Buffer.byteLength(prompt) <= 96 * 1024);
        const intent = completenessContract.intents.find(intent => intent.id === item.intentId); assert.ok(intent);
        const requirements = intent.requirements.map(requirement => measureRequirement(requirement, originals, fixture.manifest));
        results.push({ ...item, scope: intent.scope, requirements,
          completeRequiredEvidence: requirements.every(requirement => requirement.available),
          missingRequirements: requirements.filter(requirement => !requirement.available).map(requirement => requirement.id),
          spans: context.spans.length, textBytes: context.textBytes, promptBytes: Buffer.byteLength(prompt),
          retrievalMode: context.retrievalMode, terms: context.terms, expansionTerms: context.expansionTerms, gaps: context.gaps,
          selected: originals.map((span, index) => ({ rank: index + 1, sourceName: span.sourceName, path: span.path,
            revision: span.revision, startLine: span.startLine, endLine: span.endLine,
            contentHash: span.contentHash, spanHash: span.spanHash, blobId: span.blobId })),
          missingCandidateTrace: traceMissingCandidates(catalog, context, requirements, fixture.manifest),
          selectedLocatorHash: digest(JSON.stringify(originals.map(span => [span.sourceName, span.revision, span.path,
            span.startLine, span.endLine, span.contentHash, span.spanHash, span.blobId]))) });
      }
      for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
      return { results, historical: includeHistory ? await diagnoseHistorical(fixture.manifest) : undefined };
    } finally { await catalog?.stop(); store?.close(); await rm(fixture.root, { recursive: true, force: true }); }
  }
  const first = await measure(true), second = await measure(false);
  const summarize = results => Object.fromEntries(['development', 'reserved'].map(split => {
    const selected = results.filter(result => result.split === split);
    return [split, { cases: selected.length, completeRequiredEvidence: selected.filter(result => result.completeRequiredEvidence).length,
      missingEvidenceCases: selected.filter(result => !result.completeRequiredEvidence).map(result => result.id) }];
  }));
  return { schemaVersion: 'loredock-completeness-retrieval/1', checkedAt: new Date().toISOString(),
    contractHash: baseline.contractHash, sourceBaseline: baseline.sourceBaseline, retrievalVersion, answerPromptVersion,
    modelRequests: 0, modelUsage: null, semanticReview: 'not performed; prospective cases have no model answers',
    historicalGate: 'Task 027 remains failed; historical scores and artifacts are unchanged',
    limits: { ...answerLimits, promptBytes: 96 * 1024 }, summary: summarize(first.results), results: first.results,
    regeneration: { summary: summarize(second.results), changedSelections: first.results.filter((result, index) =>
      result.selectedLocatorHash !== second.results[index].selectedLocatorHash).map(result => result.id),
      changedRequirements: first.results.filter((result, index) => JSON.stringify(result.requirements)
        !== JSON.stringify(second.results[index].requirements)).map(result => result.id) },
    historical: first.historical, sourceCheckoutsUnchanged: true,
    reservation: completenessContract.reservation };
}

export function renderCompletenessRubric() {
  const lines = ['# Prospective answer-completeness rubric', '',
    'Generated from [the frozen contract](cases.mjs). This is a reviewer worksheet, not a model prompt.', '',
    completenessContract.scoring.historicalGate, '', completenessContract.reservation, '',
    'A case passes only when every required proposition and qualification is supported and no forbidden or materially unsupported assertion appears.',
    'Scope may be conveyed by a qualified claim or an appropriate unanswered question. Optional context is not a required omission.',
    'All volunteered claims still require evidence. Evidence availability is a mechanical prerequisite, not a semantic judgment.', '',
    'Evidence names below are logical references into the frozen twenty-source fixture, not local working-tree paths.',
    'The listed references define the mechanical retrieval check. A semantic reviewer must also consider equivalent issued source evidence and record that judgment; a missing listed file alone is not an answer failure.', '',
  ];
  for (const intent of completenessContract.intents) {
    const pair = completenessContract.cases.filter(item => item.intentId === intent.id);
    lines.push(`## ${intent.id}`, '', `Scope: ${intent.scope}. Origin: ${intent.sourceQuestion}.`, '', intent.rationale, '');
    for (const item of pair) lines.push(`**${item.id} (${item.split})**: ${item.question}`, '');
    lines.push('Required propositions:', '');
    for (const requirement of intent.requirements) lines.push(
      `- [ ] ${requirement.id} (${requirement.kind}): ${requirement.proposition}`, '',
      `  Evidence (${requirement.mode === 'any' ? 'at least one alternative' : 'all listed references'}): ${requirement.evidence.map(id => `\`${id}\``).join(', ')}.`, '');
    lines.push('Optional context:', '', ...intent.optionalContext.map(text => `- ${text}`), '',
      'Forbidden assertions:', '', ...intent.forbiddenAssertions.map(text => `- ${text}`), '',
      '- [ ] Review every additional claim and preserve source disagreements.',
      '- [ ] Record semantic judgments separately from evidence availability.',
      '- [ ] Obtain independent human review before claiming acceptance.', '');
  }
  return lines.join('\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--rubric',
    'Usage: node scripts/loredock-completeness.mjs [--rubric]');
  if (process.argv[2] === '--rubric') { await verifyCompletenessBaseline(); console.log(renderCompletenessRubric()); }
  else {
    const modules = await Promise.all(['catalog', 'store', 'answer-context', 'answers'].map(name => import(`../apps/loredock/dist/${name}.js`)));
    console.log(JSON.stringify(await evaluateCompleteness(Object.assign({}, ...modules)), null, 2));
  }
}
