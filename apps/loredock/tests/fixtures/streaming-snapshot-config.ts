import { config as base } from './memory-runner-config.js';
import { codeAnalysisLimits } from '../../src/code-analysis-types.js';
import { CatalogError } from '../../src/types.js';
// @ts-expect-error Offline candidate factory; independent tiny regression inputs only.
import { createStreamingAnalysis } from '../../../../scripts/loredock-streaming-snapshot/analysis.mjs';

export const config = { ...base, services: { ...base.services,
  CodeAnalysis: createStreamingAnalysis({ CodeAnalysis: base.services.CodeAnalysis, CatalogError, codeAnalysisLimits }) } };
