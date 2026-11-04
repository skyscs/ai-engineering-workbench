import { PathWork } from './code-paths-work.js';
/** Actual path charges consume the same capability later used by capture. */
export class SharedPathWork extends PathWork {
    budget;
    constructor(analysis, snapshot, limits, options, budget) {
        super(analysis, snapshot, limits, options, budget.began);
        this.budget = budget;
    }
    charge(count = 1) { this.budget.charge('path', count); super.charge(count); }
    check() { this.budget.check(); super.check(); }
}
