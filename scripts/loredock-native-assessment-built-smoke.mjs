import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { CodePathsV2 } from '../apps/loredock/dist/code-paths-v2.js';
import { NativeCaptures } from '../apps/loredock/dist/native-capture.js';
import { produce } from './loredock-native-assessment/produce.mjs';
import { assessSeries } from './loredock-native-assessment/assess.mjs';

// Caller-owned fresh output; refuse to overwrite prior functional evidence.
assert.equal(process.argv.length, 3, 'Provide one fresh absolute artifact directory.');
const root = process.argv[2]; assert.ok(path.isAbsolute(root) && root === path.resolve(root)); await mkdir(root);
const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2, NativeCaptures }, reports = [];
try {
  let positiveOracle;
  for (const incomplete of [false, true]) {
    const input = await produce(path.join(root, incomplete ? 'incomplete' : 'complete'), services, incomplete);
    await writeFile(path.join(input.root, 'input.json'), JSON.stringify(input, null, 2));
    const assessed = await assessSeries(input); await writeFile(path.join(input.root, 'assessment.json'), JSON.stringify(assessed.report, null, 2));
    assert.equal(assessed.report.failed, false, JSON.stringify(assessed.report));
    if (!incomplete) positiveOracle = input.oracle;
    else {
      const rejected = await assessSeries({ ...input, oracle: positiveOracle });
      await writeFile(path.join(input.root, 'complete-oracle-rejection.json'), JSON.stringify(rejected.report, null, 2));
      assert.equal(rejected.report.failed, true);
      assert.equal(rejected.report.operations.find(row => row.name === 'first').dimensions.usefulness.state, 'fail');
    }
    reports.push({ case: incomplete ? 'incomplete-consumer' : 'complete-flow', operations: input.rows.length,
      independentAssessment: 'pass', ...input.lifecycle, firstReceiptBytes: input.rows[0].receipt.bytes });
  }
  const result = { schemaVersion: 'native-assessment-built-smoke/1', node: process.version, modelRequests: 0, cases: reports,
    incompleteRejectedByCompleteOracle: true, resourceQualification: false, crossProcessQualification: false, httpOrBrowserConsumerImplemented: false };
  await writeFile(path.join(root, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ ...result, retainedDirectory: root }));
} catch (error) { await writeFile(path.join(root, 'error.json'), JSON.stringify({ name: error.name, message: error.message, stack: error.stack })); throw error; }
