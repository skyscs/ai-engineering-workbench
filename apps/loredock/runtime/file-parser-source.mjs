// A native ESM entry lets the source loader register before importing TypeScript.
import { register } from 'tsx/esm/api';
register({ tsconfig: false });
await import('../src/file-parser-worker.ts');
