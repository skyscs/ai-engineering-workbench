import { configuration as base } from './worker-qualification-config.js';
import { codePathLimits, PathWork } from '../../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../../src/code-paths-metadata.js';
import { declarationMap } from '../../src/system-map.js';
import { compareHeaders } from '../../src/http-headers.js';
import { sha256 } from '../../src/extract.js';
import { CatalogError } from '../../src/types.js';
// @ts-expect-error Independent tiny configuration; no frozen resource corpus.
import { createCanonicalPaths } from '../../../../scripts/loredock-canonical-facts/paths.mjs';
// @ts-expect-error Unchanged request scope over the existing prepared store.
import { createPreparedReads } from '../../../../scripts/loredock-prepared-reads/reuse.mjs';

export async function configuration(size: number) {
  const config = await base(size);
  const CodePaths = createCanonicalPaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains,
    assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });
  return { ...config, services: { ...config.services, CodePaths: createPreparedReads({ ...config.services, CodePaths }).CodePaths } };
}
