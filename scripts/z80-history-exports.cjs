/*
 * The execution-history recorder's exports and statics, the same in every core that records history
 * (`src/emu/z80/wasm/z80-history.c`, `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.2). A core's build
 * script adds both lists, as it adds `rzx-core-exports.cjs`'s; `WasmHistoryReader.ts` reads these
 * exports by the same names on every core (D11).
 */

/** The exports: everything else is in the header the first one locates */
const Z80_HISTORY_EXPORTS = ["z80HistoryGetHeaderOffset", "z80HistorySetEnabled", "z80HistoryClear"];

/**
 * The statics a Klive state file (and the Next's checkpoint) leaves out (D7): history belongs to the
 * timeline it was recorded in, so a restore keeps the live ring, and the controller clears it
 */
const Z80_HISTORY_VOLATILE_SYMBOLS = ["z80HistoryHeader", "z80HistoryRing"];

module.exports = { Z80_HISTORY_EXPORTS, Z80_HISTORY_VOLATILE_SYMBOLS };
