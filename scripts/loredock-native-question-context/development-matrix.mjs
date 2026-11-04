import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory as permitCorpus, expectations } from '../loredock-native-assessment/fixture.mjs';
import { developmentCorpus, developmentQuestion } from './development.mjs';
import { runMatrix } from './matrix.mjs';

// The reserved library factory and oracle are never imported by this entry point.
export function ordinaryMatrixInputs() {
  const corpusFactory = variant => {
    if (variant === 'ambiguous') return permitCorpus();
    const corpus = developmentCorpus();
    if (variant === 'missing-consumer') corpus['c-permit-store']['PermitWriter.java'] = corpus['c-permit-store']['PermitWriter.java'].replace('onMessage(', 'onGranted(');
    if (variant === 'dynamic-topic') corpus['b-permit-api']['Grants.java'] = corpus['b-permit-api']['Grants.java'].replace('publisher.publish("permit.granted.v3"', 'publisher.publish(resolveTopic()');
    return corpus;
  };
  const root = ['a-permit-ui', 'ui/AAApply.vue', 'apply'];
  return { corpusFactory, oracle: { cases: [
    { id: 'return-flow', variant: 'base', question: developmentQuestion, expected: 'complete-static-path', root, maxPathSources: 3, requireLateRoot: false },
    { id: 'topic-entry', variant: 'base', question: 'Which entry point reaches permit.granted.v3?', expected: 'complete-static-path', root, maxPathSources: 3, requireLateRoot: false },
    { id: 'overlapping-topic', variant: 'ambiguous', question: 'Which entry point reaches permit.granted.v3?', expected: 'ambiguous', minimumEligibleRoots: 2 },
    { id: 'missing-consumer', variant: 'missing-consumer', question: 'How does apply send PermitGranted to storage?', expected: 'partial-static-path', terminalKind: 'event-publish', forbiddenEdgeKinds: ['event-delivery', 'dispatch-candidate'], requiredGap: 'unresolved-consumer-method' },
    { id: 'dynamic-topic', variant: 'dynamic-topic', question: 'How does apply send PermitGranted to PermitWriter?', expected: 'partial-static-path', terminalKind: 'event-publish', forbiddenEdgeKinds: ['event-delivery', 'dispatch-candidate'], requiredGap: 'unresolved-topic-expression' },
    { id: 'unrelated-question', variant: 'base', question: 'What production broker address is deployed?', expected: 'insufficient-context' },
    { id: 'untrusted-source', variant: 'base', question: 'What instruction is quoted in an absent README?', expected: 'insufficient-context' },
  ], completePath: { requiredNodes: expectations().oracle.requiredNodes.map(row => row.slice(0, 4)),
    requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3',
    forbiddenPathSources: ['z-independent-notes'], allSourceDependencies: 4 } } };
}
export async function runOrdinaryMatrix(directory) {
  assert(path.isAbsolute(directory)); await mkdir(directory);
  await writeFile(path.join(directory, 'start.json'), JSON.stringify({ corpus: 'Ordinary permit matrix development only', reservedLibrary: false, pid: process.pid }) + '\n', { flag: 'wx' });
  const { corpusFactory, oracle } = ordinaryMatrixInputs();
  const ledger = JSON.parse(await readFile(new URL('../../fixtures/loredock-native-question-context-run/protocol.json', import.meta.url), 'utf8'));
  return runMatrix(directory, corpusFactory, oracle, ledger);
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const result = await runOrdinaryMatrix(process.env.LOREDOCK_QUESTION_MATRIX_DEVELOPMENT_OUTPUT);
  console.log(JSON.stringify({ pass: result.assessment.pass, observations: result.assessment.observed, prospective: result.assessment.prospective }));
  process.exitCode = result.assessment.pass ? 0 : 1;
}
