import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * NextReg $02 - resets, reset type, software NMIs, I/O trap flag (catalogue RST-001 - RST-006).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`, `_input/next-fpga/nextreg.txt` "0x02"):
 * - ~6316-6317: a $02 write with bit 0 is a soft reset, with bit 1 a hard reset ("hard reset has
 *   precedence"). The soft reset asserts `reset`: PC restarts at 0, RAM is untouched.
 * - ~1691: every soft reset shifts `nr_02_reset_type` to '0' & rt(2) & (rt(1) or rt(0)); the read
 *   mux (~5837) returns rt(1:0). A core load starts at "100"; the firmware's own soft reset makes it
 *   "010" ("last reset was a hard reset"); every later soft reset gives "001" ("soft reset").
 *   Klive starts after the firmware, so a hard reset reads bit 1 and a soft reset bit 0.
 * - ~2046-2066, ~3812-3840: bit 3 / bit 2 generate a Multiface / DivMMC NMI when NextReg $06 bit 3 /
 *   bit 4 (the M1 / DRIVE button enables) allow it. The $02 flag is set whenever the NMI state
 *   machine accepts a cause and cleared only by writing that bit as 0.
 * - ~3815, ~3846-3865: with $D8 bit 0, a $2FFD/$3FFD read or $3FFD write raises a Multiface NMI;
 *   $DA records the cause (01 = $2FFD read, 10 = $3FFD read, 11 = $3FFD write), $02 bit 4 reads it,
 *   $D9 holds the written value, and a $02 write with bit 4 = 0 clears the cause.
 */

/** Loads `body` at $8000 followed by a loop at `Loop`; returns the session with PC at $8000. */
async function program(body: string): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(`
        .org $8000
${body}
Loop:   jr Loop
  `);
  return s;
}

describe("NextReg 0x02 resets", () => {
  it("RST-001: writing bit 0 soft-resets: PC 0, RAM kept, reset-branch registers reset", async () => {
    const s = await program(
      `
        nextreg $14,$5a          ; reset to $E3 by any reset
        nextreg $7f,$42          ; no reset branch: kept
        ld a,$99
        ld ($c000),a             ; bank 0 (MMU6 = 0 before and after the reset)
        nextreg $02,$01`
    );
    s.step(5);
    expect(s.registers().pc).toBe(0x0000);
    expect(s.readNextReg(0x14)).toBe(0xe3);
    expect(s.readNextReg(0x7f)).toBe(0x42);
    expect(s.peek(0xc000)).toBe(0x99);
    expect(s.readNextReg(0x02) & 0x03, "last reset: soft").toBe(0x01);
  });

  it("RST-002: writing bit 1 hard-resets; bit 1 wins over bit 0", async () => {
    for (const value of [0x02, 0x03]) {
      const s = await program(`        nextreg $14,$5a\n        nextreg $02,$${value.toString(16).padStart(2, "0")}`);
      s.step(2);
      expect(s.registers().pc, `$02 <- $${value.toString(16)}`).toBe(0x0000);
      expect(s.readNextReg(0x14)).toBe(0xe3);
      expect(s.readNextReg(0x02) & 0x03, "last reset: hard").toBe(0x02);
    }
  });

  it("RST-003: $02 bits 1-0 read the last reset type", async () => {
    const s = await createSession();
    const type = () => s.readNextReg(0x02) & 0x03;
    expect(type(), "after power-on and the firmware").toBe(0x02);
    s.reset();
    expect(type(), "after a soft reset").toBe(0x01);
    s.reset();
    expect(type(), "after another soft reset").toBe(0x01);
    s.hardReset();
    expect(type(), "after a hard reset").toBe(0x02);
  });

  it("RST-004: bit 2 raises a DivMMC NMI when $06 bit 4 allows it; writing 0 clears the flag", async () => {
    const s = await program(`        nextreg $06,$10\n        nextreg $02,$04`);
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.readNextReg(0x02) & 0x04).toBe(0x04);
    expect(s.peekWord(s.registers().sp), "return address on the stack").toBeGreaterThanOrEqual(0x8000);
    s.setNextReg(0x02, 0x00);
    expect(s.readNextReg(0x02) & 0x04).toBe(0x00);
  });

  it("RST-004: with $06 bit 4 clear the flag is set but no NMI happens", async () => {
    const s = await program(`        nextreg $06,$00\n        nextreg $02,$04`);
    s.step(2).runFrames(1);
    expect(s.readNextReg(0x02) & 0x04).toBe(0x04);
    expect(s.registers().pc).toBeGreaterThanOrEqual(0x8000);
  });

  it("RST-005: bit 3 raises a Multiface NMI when $06 bit 3 allows it; writing 0 clears the flag", async () => {
    const s = await program(`        nextreg $06,$08\n        nextreg $02,$08`);
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.readNextReg(0x02) & 0x08).toBe(0x08);
    s.setNextReg(0x02, 0x00);
    expect(s.readNextReg(0x02) & 0x08).toBe(0x00);
  });

  /*
   * multiface.vhd: the fetch at $0066 pages the Multiface in (`mf_enable`) - its ROM at $0000-$1FFF,
   * its RAM at $2000-$3FFF, above the Next ROM - and RETN pages it out (`cpu_retn_seen`).
   */
  it("RST-005: the Multiface NMI pages the Multiface ROM in at $0066; RETN pages it out", async () => {
    const mfRom = readFileSync("src/public/roms/enNextMf.rom");
    const s = await program(`        nextreg $06,$08\n        nextreg $02,$08`);
    const rom = Array.from(s.peekBytes(0x0000, 16));
    s.runTo(0x0066, { maxFrames: 2 }).step(1);
    expect(Array.from(s.peekBytes(0x0000, 16)), "Multiface ROM at $0000").toEqual(Array.from(mfRom.subarray(0, 16)));
    s.poke(0x2000, 0x5a);
    expect(s.peek(0x2000), "Multiface RAM at $2000").toBe(0x5a);
    // --- Leave the handler: RETN (ED 45) with the NMI return address on the stack
    s.setRegisters({ pc: 0x8000 }).poke(0x8000, [0xed, 0x45]).step(1);
    expect(Array.from(s.peekBytes(0x0000, 16)), "Next ROM back after RETN").toEqual(rom);
  });

  const TRAPS: Array<[what: string, code: string, cause: number]> = [
    ["$2FFD read", "        ld bc,$2ffd\n        in a,(c)", 0x01],
    ["$3FFD read", "        ld bc,$3ffd\n        in a,(c)", 0x02],
    ["$3FFD write", "        ld bc,$3ffd\n        ld a,$a7\n        out (c),a", 0x03]
  ];
  for (const [what, code, cause] of TRAPS) {
    it(`RST-006: with $D8 bit 0, a ${what} traps: Multiface NMI, $DA cause, $02 bit 4`, async () => {
      const s = await program(`        nextreg $06,$08\n        nextreg $d8,$01\n${code}`);
      s.runTo(0x0066, { maxFrames: 2 });
      expect(s.readNextReg(0xda)).toBe(cause);
      expect(s.readNextReg(0x02) & 0x10).toBe(0x10);
      if (cause === 0x03) expect(s.readNextReg(0xd9), "$D9: the value written").toBe(0xa7);
      s.setNextReg(0x02, 0x00);
      expect(s.readNextReg(0xda)).toBe(0x00);
      expect(s.readNextReg(0x02) & 0x10).toBe(0x00);
    });
  }

  it("RST-006: without $D8 bit 0 the port access does not trap", async () => {
    const s = await program(`        nextreg $06,$08\n        nextreg $d8,$00\n        ld bc,$2ffd\n        in a,(c)`);
    s.step(4).runFrames(1);
    expect(s.readNextReg(0xda)).toBe(0x00);
    expect(s.registers().pc).toBeGreaterThanOrEqual(0x8000);
  });
});
