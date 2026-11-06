// @ts-expect-error Exact historical regression with independently verified pre-adoption dependencies.
import { loadHistoricalParserTest } from './fixtures/owned-parser-reference/verify.mjs';
await loadHistoricalParserTest('integration-reference.test.ts');
