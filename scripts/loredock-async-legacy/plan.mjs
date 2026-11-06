export const plan = Object.freeze({
  version: 'ordinary-async-legacy/1',
  applicationBase: '278830b437727181385d61b958bb66191d9a9175',
  order: ['supported', 'reviewed', 'refresh', 'reapplied', 'contradictory-topic', 'source-only', 'saved-v1', 'saved-v2'],
  questions: ['How does dispatch send the site header?', 'How does portal submit an order to order-worker?', 'Which deployment is active?'],
  compare: 'Exact JSON serialization, order, identities, hashes, omissions, coverage, original text and prompt bytes.',
  volatile: 'New correction IDs and timestamps are recorded once; read and idempotent replay compare exact saved values.',
  saved: 'Copy stopped ordinary Task 131 and Task 133 catalogs before opening. Never open or mutate retained originals.',
  repeatPolicy: 'Keep the first baseline and every failure. Later comparisons use fresh copies; never overwrite the baseline.',
  realModelCalls: 0, controlledModelCalls: 0, reservedFamilyReads: 0, resourceQualification: false,
});
