import { configuration as base } from './prepared-qualification-config.js';
// @ts-expect-error Independent tiny process setup; no resource corpus imported.
import { createWorkerReads } from '../../../../scripts/loredock-worker-reads/analysis.mjs';

export async function configuration(size: number) {
  const config = await base(size);
  return { ...config, services: { ...config.services, CodeAnalysis: createWorkerReads(config.services) } };
}
