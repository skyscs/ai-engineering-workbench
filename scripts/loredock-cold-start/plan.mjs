// Ordinary attribution only. These components are not substitute production entries.
export const components = ['empty', 'typescript-esm', 'typescript-require', 'code-adapter', 'http-app'];
export const catalogRoots = ['run/production/case/data'];
export const plan = {
  family: 'ordinary-cold-start-attribution-01',
  order: ['production', ...components],
  production: 'One actual first production launch, ordinary permit sources, index, analysis and useful public preparation.',
  components: 'One fresh Node process per component, in fixed order; no repeated trials or candidate warmup.',
  runtime: 'Pinned Node, unchanged passive preload, no compile cache, profiler, GC or heap flags.',
  comparison: 'ESM import and createRequire load the same installed TypeScript file in different processes.',
  limits: 'Raw 100 ms timer-gap limit includes startup. Component timings are attribution, not resource qualification.',
  cacheScope: 'Fresh process/module state; operating-system filesystem caches are not reset or claimed cold.',
  repeatPolicy: 'Retain first observations and errors; unknown errors stop later components. No retries.',
  catalogRoots, resourceQualification: false, modelCalls: 0, reservedFamilyReads: 0,
};
