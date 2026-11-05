import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
export const plan = Object.freeze({ version: 'ordinary-history-summary/1', storedRows: [20, 64], returnedRows: 20,
  order: ['capacity', 'restart-20', 'restart-64', 'revocation-64', 'accounting-20', 'accounting-64'],
  listWallMs: 500, aggregateWork: 1000000, pageBudgets: 1, controlledCalls: 64, modelCalls: 0,
  repeatPolicy: 'Preserve the first observation and failures. No retries or reserved-family replay.',
  qualification: false, reservedFamilyReads: 0 });
export const catalogRoots = ['run/capacity/data', 'run/capacity/checkpoint-20', 'run/capacity/checkpoint-64',
  'run/restart-20/data', 'run/restart-64/data', 'run/revocation-64/data', 'run/accounting-20/data', 'run/accounting-64/data'];
export function ordinaryInput() {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  return { corpus, question: 'How does apply reach PermitWriter.onMessage through permit.granted.v3?' };
}
