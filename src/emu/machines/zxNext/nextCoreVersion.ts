/*
 * The core version this emulator reports through NextReg $01/$0E.
 *
 * Neutral: both cores report it (the C core hard-codes the same value in `zxnext-nextreg.c`, and
 * `test/zxnext-hw/nextreg/identity.test.ts` reads it back from each). A NEX header can *ask* for a
 * minimum core version, and the viewer says so when the file asks for more than this provides
 * (`nexValidation.ts`).
 */
export const CORE_VERSION_MAJOR = 3;
export const CORE_VERSION_MINOR = 2;
export const CORE_VERSION_SUB_MINOR = 0;

/** The same three, as the tuple `validateNexHeader` compares against. */
export const EMULATED_CORE_VERSION: [number, number, number] = [
  CORE_VERSION_MAJOR,
  CORE_VERSION_MINOR,
  CORE_VERSION_SUB_MINOR
];
