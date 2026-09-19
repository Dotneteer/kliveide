import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * Selecting and writing NextRegs (catalogue NR-001 - NR-005).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~4572-4580: a `$243B` write stores the register number in `nr_register`; a reset sets it to `$24`
 *   ("protection against legacy programs accidentally hitting ports 0x243B, 0x253B").
 * - ~4583, ~2774: reading `$243B` returns `nr_register`.
 * - ~4719-4725: a `$253B` write requests a NextReg write to `nr_register`; the Z80N `NEXTREG`
 *   instructions request a write to the register in their own operand (`Z80N_data_s(15:8)`) and never
 *   touch `nr_register`.
 * `$7F` (user register) is a full 8-bit read/write register, used here as the neutral target.
 */
describe("NextReg select and write", () => {
  it("NR-001: $243B selects, $253B writes and reads back the selected register", async () => {
    const s = await createSession();
    for (const value of [0x00, 0x01, 0x55, 0x80, 0xaa, 0xff]) {
      s.out(0x243b, 0x7f).out(0x253b, value);
      expect(s.in(0x253b), `$${value.toString(16)}`).toBe(value);
    }
  });

  it("NR-002: the selection survives writes to unrelated ports", async () => {
    const s = await createSession();
    s.out(0x243b, 0x7f).out(0x253b, 0x5a);
    s.out(0x00fe, 0x02).out(0x123b, 0x00).out(0xfffd, 0x07).out(0xbffd, 0x3f).out(0x7ffd, 0x00);
    expect(s.in(0x243b)).toBe(0x7f);
    expect(s.in(0x253b)).toBe(0x5a);
  });

  it("NR-003: reading $243B returns the selected register number", async () => {
    const s = await createSession();
    for (const reg of [0x00, 0x15, 0x7f, 0x80, 0xff]) {
      s.out(0x243b, reg);
      expect(s.in(0x243b), `$${reg.toString(16)}`).toBe(reg);
    }
  });

  it.each(["soft", "hard"] as const)("NR-003: a %s reset selects register 0x24", async (kind) => {
    const s = await createSession();
    s.out(0x243b, 0x7f);
    kind === "soft" ? s.reset() : s.hardReset();
    expect(s.in(0x243b)).toBe(0x24);
  });

  it("NR-004: NEXTREG n,v writes like the port path and leaves the $243B selection alone", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        nextreg $14,$5a          ; global transparency
        nextreg $4a,$1c          ; fallback colour
        nextreg $15,$05          ; sprites on, over border
Done:   jr Done
    `);
    s.out(0x243b, 0x7f).out(0x253b, 0x42); // --- selection made before the NEXTREGs run
    s.runTo("Done");
    expect(s.in(0x243b)).toBe(0x7f);
    expect(s.in(0x253b)).toBe(0x42);
    expect([0x14, 0x4a, 0x15].map((r) => s.readNextReg(r))).toEqual([0x5a, 0x1c, 0x05]);
  });

  it("NR-005: NEXTREG n,A writes A to register n", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        ld a,$00
        nextreg $7f,a
        ld a,$81
        nextreg $4a,a
        ld a,$ff
        nextreg $14,a
Done:   jr Done
    `);
    s.out(0x243b, 0x42); // --- NEXTREG n,A must not select anything either
    s.runTo("Done");
    expect(s.in(0x243b)).toBe(0x42);
    expect([0x7f, 0x4a, 0x14].map((r) => s.readNextReg(r))).toEqual([0x00, 0x81, 0xff]);
  });
});
