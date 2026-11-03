import { register } from 'tsx/esm/api';

// Test-only loader for source service injection. The real worker uses compiled services.
const unregister = register();
try { await import('../../../../scripts/loredock-terminal-memory/child.mjs'); }
finally { await unregister(); }
