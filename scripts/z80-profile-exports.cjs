/*
 * The access profile's exports and statics, the same in every core that profiles
 * (`src/emu/z80/wasm/z80-profile.c`, `.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.1). A core's
 * build script adds both lists, as it adds `z80-history-exports.cjs`'s; `WasmProfileReader.ts` reads
 * these exports by the same names on every core.
 */

/** The exports: everything else is in the header the first one locates */
const Z80_PROFILE_EXPORTS = [
  "z80ProfileGetHeaderOffset",
  "z80ProfileGetFlagsOffset",
  "z80ProfileGetPageMapOffset",
  "z80ProfileGetPoolOffset",
  "z80ProfileSetEnabled",
  "z80ProfileReset",
  // --- `coverage load` (D16): a saved run merged into the live one
  "z80ProfileMergeByte",
  "z80ProfileMergeTotals"
];

/**
 * The statics a Klive state file and a keyframe leave out (traps T4, T7): the profile describes the
 * present's run, not machine state, so a restore keeps the live profile and a replay does not count
 */
const Z80_PROFILE_VOLATILE_SYMBOLS = ["z80ProfileHeader", "z80ProfileFlags", "z80ProfilePageMap", "z80ProfilePool"];

module.exports = { Z80_PROFILE_EXPORTS, Z80_PROFILE_VOLATILE_SYMBOLS };
