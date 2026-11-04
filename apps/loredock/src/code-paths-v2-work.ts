import type { CodeAnalysis } from './code-analysis.js';
import type { PathSnapshot } from './code-paths-internal.js';
import type { CodePathLimits } from './code-paths-types.js';
import { PathWork, type PathWorkOptions } from './code-paths-work.js';
import type { OperationBudget } from './operation-budget.js';

/** Actual path charges consume the same capability later used by capture. */
export class SharedPathWork extends PathWork {
  constructor(analysis: CodeAnalysis, snapshot: PathSnapshot, limits: CodePathLimits,
    options: PathWorkOptions, private readonly budget: OperationBudget) {
    super(analysis, snapshot, limits, options, budget.began);
  }
  override charge(count = 1) { this.budget.charge('path', count); super.charge(count); }
  override check() { this.budget.check(); super.check(); }
}
