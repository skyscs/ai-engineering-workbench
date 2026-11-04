import assert from 'node:assert/strict';
import { configuration as base } from './terminal-memory-config.js';
import { codePathLimits, PathWork } from '../../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../../src/code-paths-metadata.js';
import { declarationMap } from '../../src/system-map.js';
import { compareHeaders } from '../../src/http-headers.js';
import { sha256 } from '../../src/extract.js';
import { CatalogError } from '../../src/types.js';
// @ts-expect-error Independent tiny configuration; never imports a frozen resource family.
import { createCompactPaths } from '../../../../scripts/loredock-compact-payloads/paths.mjs';

export async function configuration(size: number) {
  assert.ok([0, 1].includes(size)); const config = await base(size);
  return { ...config, oracle: { ...config.oracle, arms: ['same-process', 'reopened-process'],
    diagnostic: { preparerWatchdogMs: 60000, readerWatchdogMs: 60000, overallWatchdogMs: 180000 } },
    services: { ...config.services, CodePaths: createCompactPaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains,
      assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError }) } };
}
