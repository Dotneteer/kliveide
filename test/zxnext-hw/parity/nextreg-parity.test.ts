import { describe, expect, it } from "vitest";

import { onEachCore, type NextTestSession } from "../../harness/zxnext";
import { differences, hex, pick, seededRandom } from "./_parity-helpers";

/*
 * PAR-001: NextReg state parity after seeded random writes.
 *
 * Both cores take the same seeded sequence of NextReg writes through `$243B`/`$253B` and must then read
 * every one of the 256 registers back the same - straight after the writes, and again after the machine
 * has run a few frames with the CPU parked (so devices that evolve on their own - the copper, the
 * line counters, interrupt status, the CTC - are compared too). The expectation is the other core, not
 * the VHDL: a difference is a finding for one of them, to be resolved against the VHDL in the
 * register's own area test.
 *
 * Not written: registers whose write ends the experiment rather than setting state - `$02` (reset,
 * NMI), `$03` (machine type, config mode), `$04` (config mode ROM mapping), `$10` bit 7 (core boot),
 * `$54` (the MMU page that holds the parked code) - and read-only ones.
 */

const SKIP = new Set([0x00, 0x01, 0x02, 0x03, 0x04, 0x0e, 0x0f, 0x10, 0x11, 0x1e, 0x1f, 0x54, 0xb0, 0xb1, 0xb2, 0xda]);
const WRITABLE = Array.from({ length: 256 }, (_, r) => r).filter((r) => !SKIP.has(r));

/** Bits a write must not set, to keep the parked CPU and the session alive. */
const WRITE_MASK: Record<number, number> = {
  0x62: 0x3f // --- the copper stays stopped: a random program could write $02 or $54 (copper tests cover it)
};

const WRITES_PER_SEED = 1500;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

async function parked(s: NextTestSession) {
  await s.loadCode(" .org $8000\n di\n jr $");
  s.runFrames(1);
}

function readAll(s: NextTestSession): number[] {
  return Array.from({ length: 256 }, (_, r) => s.readNextReg(r));
}

describe("PAR-001: NextReg parity after random writes", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: ${WRITES_PER_SEED} writes, then every register reads the same on both cores`, async () => {
      const r = await onEachCore(async (s) => {
        await parked(s);
        const rnd = seededRandom(seed);
        for (let i = 0; i < WRITES_PER_SEED; i++) {
          const reg = WRITABLE[pick(rnd, WRITABLE.length)];
          const value = pick(rnd, 256) & (WRITE_MASK[reg] ?? 0xff);
          s.setNextReg(reg, value);
        }
        const afterWrites = readAll(s);
        s.runFrames(3);
        const afterFrames = readAll(s);
        return { afterWrites, afterFrames, pc: s.registers().pc, tacts: s.tacts };
      });
      expect(differences(r.ts.afterWrites, r.wasm.afterWrites, (i) => hex(i)), "after the writes (reg=ts/wasm)").toEqual([]);
      expect(differences(r.ts.afterFrames, r.wasm.afterFrames, (i) => hex(i)), "after 3 frames (reg=ts/wasm)").toEqual([]);
      expect(r.wasm.pc, "the CPU is still parked").toBe(r.ts.pc);
    });
  }
});
