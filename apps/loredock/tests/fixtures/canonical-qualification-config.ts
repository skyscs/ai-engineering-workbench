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
  const corpusFactory = () => {
    const corpus = config.corpusFactory(), files = corpus['a-locker-client']!;
    files['canonical/one.ts'] = 'export const marker = "tiny canonical process fixture";\n';
    files['canonical/two.ts'] = files['canonical/one.ts'];
    return corpus;
  };
  const corpus = corpusFactory(), values = Object.values(corpus).flatMap(files => Object.values(files));
  const measuredSize = { ...config.size, files: values.length,
    codeFiles: Object.values(corpus).flatMap(files => Object.keys(files)).filter(file => /\.(?:ts|js|vue|java)$/.test(file)).length,
    bytes: values.reduce((sum, text) => sum + Buffer.byteLength(text), 0) };
  const CodePaths = createCanonicalPaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains,
    assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });
  return { ...config, corpusFactory, expectedCorpusHash: sha256(JSON.stringify(corpus)), size: measuredSize, oracle: { ...config.oracle, sizes: [measuredSize] },
    services: { ...config.services, CodePaths: createPreparedReads({ ...config.services, CodePaths }).CodePaths } };
}
