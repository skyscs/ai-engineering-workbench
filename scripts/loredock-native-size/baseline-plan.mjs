import { ordinaryCorpus, ordinaryCases, ordinaryReferences } from '../loredock-prepared-flow/ordinary-oracles.mjs';

export const plan = Object.freeze({ family: 'ordinary-native-factoring-01', version: 1,
  order: ['production-v1-review', 'copied-catalog-diagnostic-v1-snapshot'],
  expectedPublicOmission: 'derived-size', completeNativeItemRequiredInDiagnostic: true,
  catalogRoots: ['run/production-data', 'run/diagnostic-data'],
  applicationChangesAllowed: false, realModelCalls: 0, controlledRuntimeCalls: 0,
  repeatPolicy: 'One first observation per lane; retain failures without retries.',
  resourceQualification: false, reservedFamilyReads: 0 });
export function baselineInput() {
  const expected = ordinaryCases.find(row => row.id === 'D01-complete-path');
  return { corpus: ordinaryCorpus('representative'), expected, references: ordinaryReferences };
}
