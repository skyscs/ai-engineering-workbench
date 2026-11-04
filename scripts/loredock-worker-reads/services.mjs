import { services as prepared } from '../loredock-prepared-reads/services.mjs';
import { createWorkerReads } from './analysis.mjs';

export const services = { ...prepared, CodeAnalysis: createWorkerReads(prepared) };
