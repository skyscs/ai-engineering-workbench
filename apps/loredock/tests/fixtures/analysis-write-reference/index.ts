import type { CodeAnalysis as CurrentAnalysis } from '../../../src/code-analysis.js';
import type { CatalogStore as CurrentStore } from '../../../src/store.js';
// @ts-expect-error Preserved test-only module; exact origin/imports are verified independently.
import { loadHistoricalIntegrationAnalysis } from '../owned-parser-reference/verify.mjs';
const { CodeAnalysis: ReferenceAnalysis } = await loadHistoricalIntegrationAnalysis('analysis-write-reference');
// @ts-expect-error Public pre-candidate behavior, not a shared private owner.
import { CatalogStore as ReferenceStore } from './store.mjs';

export const CodeAnalysis = ReferenceAnalysis as typeof CurrentAnalysis;
export const CatalogStore = ReferenceStore as typeof CurrentStore;
