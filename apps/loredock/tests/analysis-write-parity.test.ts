import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Catalog } from '../src/catalog.js';
import { SourceGit } from '../src/git.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CatalogStore as ReferenceStore, CodeAnalysis as ReferenceAnalysis } from './fixtures/analysis-write-reference/index.js';
// @ts-expect-error Shared independent source/compiled comparison, never a reserved resource family.
import { compareAnalysisWrites } from '../../../scripts/loredock-analysis-write-candidate/compare.mjs';

test('scoped analysis writes preserve independent fresh-write behavior and exact executions across lifecycle/failure cases', async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'analysis-write-comparison-')); let passed = false;
  t.after(async () => { if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained analysis write comparison: ${folder}`); });
  const report = await compareAnalysisWrites(path.join(folder, 'run'), { Catalog, SourceGit, CatalogStore: ReferenceStore, CodeAnalysis: ReferenceAnalysis },
    { Catalog, SourceGit, CatalogStore, CodeAnalysis }) as { failed: boolean; scenarios: { passed: boolean }[]; errors: unknown[] };
  assert.equal(report.failed, false, JSON.stringify(report.errors)); assert.equal(report.scenarios.length, 7);
  assert.ok(report.scenarios.every(row => row.passed)); passed = true;
});
