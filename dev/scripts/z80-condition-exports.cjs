/*
 * The exports and statics of the shared breakpoint-condition evaluator (`src/emu/z80/wasm/z80-condition.c`,
 * `dev/plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`). Every core and the evaluator's own test module export the
 * same functions (`dev/ai/wasm-core-debug.md` D8).
 */

const Z80_CONDITION_EXPORTS = [
  "condArenaPtr",
  "condArenaCapacity",
  "condSlotTablePtr",
  "condSlotCapacity",
  "condMaxProgramWords",
  "condGetToken",
  "condSetToken",
  "condGetLastStatus",
  "condEvaluate",
  "condEvaluateValue",
  "condSetEnv",
  "condPeek"
];

/** The IDE's breakpoint conditions: debugging state, so a restore never brings back old breakpoints */
const Z80_CONDITION_VOLATILE_SYMBOLS = ["condArena", "condSlots", "condToken", "condLastStatus", "condEnv"];

module.exports = { Z80_CONDITION_EXPORTS, Z80_CONDITION_VOLATILE_SYMBOLS };
