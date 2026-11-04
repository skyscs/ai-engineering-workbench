// This entry point deliberately imports installed compiled application modules only.
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { SourceGit } from '../../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../../apps/loredock/dist/code-analysis.js';
import { CodePathsV2 } from '../../apps/loredock/dist/code-paths-v2.js';
import { NativeCaptures } from '../../apps/loredock/dist/native-capture.js';
import { OperationBudget } from '../../apps/loredock/dist/operation-budget.js';
export const services = Object.freeze({ Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2, NativeCaptures, OperationBudget });
