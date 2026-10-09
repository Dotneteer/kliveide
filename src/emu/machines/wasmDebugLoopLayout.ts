/*
 * The layout the in-core debug loop shares with its hosts (`src/emu/z80/wasm/z80-debug-loop.c`,
 * `.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 4c). A module of its own so the loaders can size their
 * views without importing the debug loop.
 */

/** The stop-table bit of an address whose conditions the core decides itself (`Z80_DEBUG_FLAG_CONDITION`) */
export const CORE_STOP_CONDITION = 0x4000;

/** The condition plan's capacity: addresses (`Z80_DEBUG_COND_ENTRIES`) and slot numbers (`Z80_DEBUG_COND_SLOTS`) */
export const WASM_CORE_CONDITION_PLAN_ENTRIES = 128;
export const WASM_CORE_CONDITION_PLAN_SLOTS = 256;

/** Where the slot numbers start in the plan, in words: the count, then three words per entry */
export const WASM_CORE_CONDITION_PLAN_SLOT_BASE = 1 + 3 * WASM_CORE_CONDITION_PLAN_ENTRIES;

/** The plan's size in 32-bit words */
export const WASM_CORE_CONDITION_PLAN_WORDS = WASM_CORE_CONDITION_PLAN_SLOT_BASE + WASM_CORE_CONDITION_PLAN_SLOTS;
