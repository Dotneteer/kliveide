import { defineCorpus } from "./corpus-run";

/**
 * The Klive BASIC test corpus on the 48K at the intermediate optimisation levels 1 and 2 - the slow
 * tier's half of the corpus (`build/e2e-tests.ts`); `corpus.test.ts` and `corpus-o3.test.ts` run
 * levels 0 and 3.
 */
defineCorpus([1, 2]);
