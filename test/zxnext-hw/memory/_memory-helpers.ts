import { readFileSync } from "node:fs";

import { createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Shared helpers for the memory-management tests (catalogue §4.5).
 *
 * Programs run from bank 2 ($8000-$BFFF, MMU4/5 = pages 4/5), which none of the tests remaps, and
 * store what they observe from $A000 up. The ROM images are what the firmware loads into the ROM area
 * of SRAM (zxnext.vhd ~2878: 0x000000-0x00FFFF, ROM n at n x 16K).
 */

export const RESULTS = 0xa000;

const rom = (name: string) => readFileSync(new URL(`../../../src/public/roms/${name}`, import.meta.url));

/** The four 16K ROMs of `enNextZX.rom`: ROM n is what `$0000-$3FFF` shows with ROM select n. */
export const NEXT_ROM = rom("enNextZX.rom");

/** `length` bytes of ROM `n` from `offset`. */
export function romBytes(n: number, offset: number, length: number): number[] {
  return Array.from(NEXT_ROM.subarray(n * 0x4000 + offset, n * 0x4000 + offset + length));
}

/** Loads `code` at $8000 (after DI), runs it to its end and returns the session. */
export async function runCode(core: CoreName, code: string, maxFrames = 20): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(`
        .org $8000
${code}
        nextreg $7f,$a5
        jr $
  `);
  return s.runUntilReady({ maxFrames });
}

/** The observed bytes a program stored from `RESULTS`. */
export function results(s: NextTestSession, count: number): number[] {
  return Array.from(s.peekBytes(RESULTS, count));
}

export const hex = (values: number[]) => values.map((v) => v.toString(16).padStart(2, "0")).join(" ");
