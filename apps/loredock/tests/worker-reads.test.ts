// Historical synchronous inventory controls retain their original implementation and assertions.
// @ts-expect-error The pinned historical test loader is an internal JavaScript fixture.
import { loadHistoricalParserTest } from './fixtures/owned-parser-reference/verify.mjs';
await loadHistoricalParserTest('worker-reads.test.ts');
