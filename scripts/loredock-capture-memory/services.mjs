import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { SourceGit } from '../../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../../apps/loredock/dist/code-analysis.js';
import { codePathLimits, PathWork } from '../../apps/loredock/dist/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../../apps/loredock/dist/code-paths-metadata.js';
import { declarationMap } from '../../apps/loredock/dist/system-map.js';
import { compareHeaders } from '../../apps/loredock/dist/http-headers.js';
import { sha256 } from '../../apps/loredock/dist/extract.js';
import { CatalogError } from '../../apps/loredock/dist/types.js';
import { createCapturePaths } from './paths.mjs';
export const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis,
  CodePaths: createCapturePaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError }) };
