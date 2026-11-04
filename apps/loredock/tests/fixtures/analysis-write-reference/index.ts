import type { CodeAnalysis as CurrentAnalysis } from '../../../src/code-analysis.js';
import type { CatalogStore as CurrentStore } from '../../../src/store.js';
// @ts-expect-error Preserved test-only module; exact origin/imports are verified independently.
import { CodeAnalysis as ReferenceAnalysis } from './code-analysis.mjs';
// @ts-expect-error Public pre-candidate behavior, not a shared private owner.
import { CatalogStore as ReferenceStore } from './store.mjs';

export const CodeAnalysis = ReferenceAnalysis as typeof CurrentAnalysis;
export const CatalogStore = ReferenceStore as typeof CurrentStore;
