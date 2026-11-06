export const losslessPlan = Object.freeze({
  schemaVersion: 'ordinary-lossless-parser/1',
  applicationBase: '6cb2ce53939932e4aaf705a4afb95cb1f570172d',
  failedObservationHead: 'd84971fec360540db4266d38a65e9b9840ae1881',
  source: 'docs/fixtures/loredock-parser-transport/first.tar.gz',
  sourceArchiveSha256: '77c99c02c04923ec66cbcd50d5964792c79626a010ed4412f7d466f5489089a0',
  cases: ['ordinary', 'dense-operations', 'long-owner'],
  expected: 'Exact JSON serialization of original facts, original ranges and complete direct graph; no changed omissions or support.',
  entry: 'scripts/loredock-lossless-parser/compare.mjs', node: '22.23.2',
  inputBytes: 32768, responseBytes: 524288, operationMs: 5000, ownerMs: 60000, cleanupMs: 10000,
  observer: 'Whole-child exit, elapsed time and process CPU/high-water RSS diagnostics; no startup, aggregate heap or resource qualification.',
  repeatPolicy: 'Retain the first candidate and failures in a new exclusive directory. Read fresh copies; never open original catalogs for writing or rerun Task 138.',
  modelCalls: 0, corporateSources: 0, reservedFamilyReads: 0, productionActivation: false,
});
