import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The functions the shared prefix-pasted C files define for a core (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 2): `src/emu/z80/wasm/z80-cpu-exports.c` and `z80-debug-loop.c`, read from their source the way
 * the build tests read a core's own C.
 *
 * Those files define every forwarder for every core and leave the choice to the core's export list
 * (the linker drops the rest), so a build test checks two things instead of one equality: every
 * function the core's own C defines is exported, and every export is defined - by the core or here.
 */
export function sharedZ80Functions(prefix: string): string[] {
  const dir = join(__dirname, "../src/emu/z80/wasm");
  const cpu = readFileSync(join(dir, "z80-cpu-exports.c"), "utf8");
  const registers = [...cpu.matchAll(/^Z80X_REGISTER\((\w+)\)/gm)].flatMap((m) => [
    `${prefix}GetCpu${m[1]}`,
    `${prefix}SetCpu${m[1]}`
  ]);
  const singles = [...cpu.matchAll(/^(?:uint32_t|void) Z80X\((\w+)\)\(/gm)].map((m) => `${prefix}${m[1]}`);
  const loop = readFileSync(join(dir, "z80-debug-loop.c"), "utf8");
  const loopFunctions = [...loop.matchAll(/^(?:uint32_t|void) Z80D\((\w+)\)\(/gm)].map((m) => `${prefix}${m[1]}`);
  return [...registers, ...singles, ...loopFunctions];
}
