import type { CodePaths as ProductionPaths } from '../../../src/code-paths.js';
// @ts-expect-error Exact emitted reference; the manifest verifies its source and runtime closure.
import { CodePaths as PreservedPaths } from './code-paths.mjs';

export const CodePaths = PreservedPaths as typeof ProductionPaths;
