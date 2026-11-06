// Build-time input verification runs as the same non-root user without starting Chrome.
import { verifyRuntimeInputs } from './inputs.mjs';
console.log(JSON.stringify(await verifyRuntimeInputs()));
