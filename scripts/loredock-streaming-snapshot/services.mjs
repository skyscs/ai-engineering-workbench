import { services as baseline } from '../loredock-capture-memory/services.mjs';
import { CatalogError } from '../../apps/loredock/dist/types.js';
import { codeAnalysisLimits } from '../../apps/loredock/dist/code-analysis-types.js';
import { createStreamingAnalysis } from './analysis.mjs';

export const services = { ...baseline,
  CodeAnalysis: createStreamingAnalysis({ CodeAnalysis: baseline.CodeAnalysis, CatalogError, codeAnalysisLimits }) };
