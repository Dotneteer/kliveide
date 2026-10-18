import { defineCorpus } from "./corpus-run";

/**
 * The Klive BASIC test corpus on the 48K, unoptimised (level 0). The rules and the `'@expect` lines
 * are in `corpus-run.ts`. Level 3 runs beside it in `corpus-o3.test.ts`; levels 1 and 2 run in the
 * slow tier (`corpus-levels.test.ts`, `build/e2e-tests.ts`). One level per file keeps each within
 * the fast tier's budget and lets them run in parallel.
 */
defineCorpus([0]);
