import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession, type WritableRegisters } from "../../harness/zxnext";

/*
 * The Z80N extended instructions on the whole machine (catalogue CPU-001 - CPU-017).
 *
 * Hardware: `_input/next-fpga/src/cpu/t80n_mcode.vhd` (the ED table, ~1640-2560) and
 * `_input/next-fpga/src/cpu/t80n.vhd` (the Z80N commands, ~695-1140). Flags are compared as
 * S Z H P/V N C (mask $D7); the undocumented bits 5/3 are not asserted.
 */

const FLAGS = 0xd7;
const S = 0x80, Z = 0x40, H = 0x10, PV = 0x04, C = 0x01;

/** Runs `code` from $8000 with the given registers until `Done`. */
async function run(code: string, regs: WritableRegisters = {}): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(`
        .org $8000
${code}
Done:   jr Done
  `);
  s.setRegisters(regs);
  return s.runTo("Done");
}

const hex16 = (v: number) => `$${v.toString(16).padStart(4, "0")}`;

describe("Z80N instructions", () => {
  // --- CPU-001: ED 23, t80n.vhd ~700: A(3:0) & A(7:4); no flag change
  it("CPU-001: SWAPNIB swaps the nibbles of A and leaves the flags", async () => {
    for (const [a, expected] of [[0x1f, 0xf1], [0xa5, 0x5a], [0x00, 0x00]]) {
      const r = (await run("        swapnib", { a, f: 0xd7 })).registers();
      expect([r.a, r.f], `A=$${a.toString(16)}`).toEqual([expected, 0xd7]);
    }
  });

  // --- CPU-002: ED 24, ~704: bit order reversed. (ED 26 MIRROR DE is commented out in the VHDL.)
  it("CPU-002: MIRROR A reverses the bits of A and leaves the flags", async () => {
    for (const [a, expected] of [[0x01, 0x80], [0xc3, 0xc3], [0x1e, 0x78]]) {
      const r = (await run("        mirror a", { a, f: 0x00 })).registers();
      expect([r.a, r.f], `A=$${a.toString(16)}`).toEqual([expected, 0x00]);
    }
  });

  // --- CPU-003: ED 27 nn, mcode ~1776: ALU AND (IR bits 5-3 = 100) with Save_ALU but no register write
  it("CPU-003: TEST n sets the flags of AND n and keeps A", async () => {
    const cases: Array<[a: number, n: number, flags: number]> = [
      [0xf0, 0x0f, Z | H | PV], // --- 0: zero, parity even
      [0xf0, 0x90, S | H | PV], // --- $90: negative, two bits set
      [0xf0, 0x31, H] // --- $30... $F0 & $31 = $30: two bits -> even
    ];
    cases[2][2] = H | PV;
    for (const [a, n, flags] of cases) {
      const r = (await run(`        test $${n.toString(16)}`, { a, f: C })).registers();
      expect([r.a, r.f & FLAGS], `$${a.toString(16)} & $${n.toString(16)}`).toEqual([a, flags]);
    }
  });

  // --- CPU-004: ED 28-2C, t80n.vhd ~985-1033: DE shifted/rotated by B(4 downto 0); no flag change
  const SHIFTS: Array<[op: string, de: number, b: number, expected: number]> = [
    ["bsla de,b", 0x1234, 4, 0x2340],
    ["bsla de,b", 0x1234, 0x24, 0x2340], // --- only B bits 4-0 count
    ["bsla de,b", 0x1234, 20, 0x0000], // --- 20 >= 16: everything shifted out
    ["bsra de,b", 0x8421, 4, 0xf842], // --- arithmetic
    ["bsra de,b", 0x8421, 20, 0xffff],
    ["bsrl de,b", 0x8421, 4, 0x0842], // --- logical: zeros in
    ["bsrl de,b", 0x8421, 20, 0x0000],
    ["bsrf de,b", 0x1234, 4, 0xf123], // --- ones in
    ["bsrf de,b", 0x1234, 20, 0xffff],
    ["brlc de,b", 0x1234, 4, 0x2341], // --- rotate left
    ["brlc de,b", 0x1234, 20, 0x2341], // --- rotate by 20 = by 4
    ["brlc de,b", 0x8001, 1, 0x0003]
  ];
  for (const [op, de, b, expected] of SHIFTS) {
    it(`CPU-004: ${op.toUpperCase()} with DE=${hex16(de)}, B=${b} -> ${hex16(expected)}`, async () => {
      const r = (await run(`        ${op}`, { de, bc: b << 8, f: 0x55 })).registers();
      expect([hex16(r.de), r.f]).toEqual([hex16(expected), 0x55]);
    });
  }

  // --- CPU-005: ED 30, ~727: DE = D * E; no flag change
  it("CPU-005: MUL D,E multiplies D by E into DE", async () => {
    for (const [de, expected] of [[0xffff, 0xfe01], [0x1234, 0x03a8], [0x00ff, 0x0000], [0x0101, 0x0001]]) {
      const r = (await run("        mul d,e", { de, f: 0xd7 })).registers();
      expect([hex16(r.de), r.f], hex16(de)).toEqual([hex16(expected), 0xd7]);
    }
  });

  /*
   * CPU-006: ED 31-33, t80n.vhd ~762-785: rr + A (zero-extended). The only flag written is
   * `F(Flag_C) <= reg_temp_t(16)`; the sum is assigned to bits 15-0 of a variable zeroed at T-state 3,
   * so bit 16 is 0: carry is cleared, every other flag stays.
   */
  const ADD_A: Array<[pair: "hl" | "de" | "bc", value: number, a: number, expected: number]> = [
    ["hl", 0x12ff, 0x01, 0x1300],
    ["hl", 0x1000, 0x80, 0x1080], // --- A is unsigned
    ["hl", 0xffff, 0x01, 0x0000], // --- wraps
    ["de", 0x00f0, 0x20, 0x0110],
    ["bc", 0xfff0, 0x20, 0x0010]
  ];
  for (const [pair, value, a, expected] of ADD_A) {
    it(`CPU-006: ADD ${pair.toUpperCase()},A: ${hex16(value)} + $${a.toString(16)} -> ${hex16(expected)}, carry cleared`, async () => {
      const r = (await run(`        add ${pair},a`, { [pair]: value, a, f: 0xd7 })).registers();
      expect([hex16(r[pair]), r.f & FLAGS]).toEqual([hex16(expected), 0xd7 & ~C]);
    });
  }

  // --- CPU-007: ED 34-36 nn nn, ~1074-1115: rr + nn; no flag change
  it("CPU-007: ADD HL/DE/BC,nn add a 16-bit value, wrapping at $FFFF", async () => {
    const r = (await run("        add hl,$0020\n        add de,$1000\n        add bc,$ffff", {
      hl: 0xfff0, de: 0x1234, bc: 0x0001, f: 0xd7
    })).registers();
    expect([hex16(r.hl), hex16(r.de), hex16(r.bc), r.f]).toEqual(["$0010", "$2234", "$0000", 0xd7]);
  });

  // --- CPU-008: ED 8A hi lo, mcode ~1920: the high byte (first operand) is pushed first
  it("CPU-008: PUSH nn pushes a 16-bit immediate", async () => {
    const s = await run("        push $1234");
    const r = s.registers();
    expect(hex16(r.sp)).toBe("$bfee");
    expect([s.peek(0xbfee), s.peek(0xbfef)]).toEqual([0x34, 0x12]);
  });

  // --- CPU-009: ED 90, mcode ~2518: OUT (C),(HL); HL+1; no B decrement, no flag write
  it("CPU-009: OUTINB outputs (HL) to port BC and increments HL; B and the flags stay", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        outinb
Done:   jr Done
    `);
    s.poke(0xc000, 0x5a).out(0x243b, 0x7f);
    s.setRegisters({ bc: 0x253b, hl: 0xc000, f: 0xd7 }).runTo("Done");
    const r = s.registers();
    expect([hex16(r.bc), hex16(r.hl), r.f]).toEqual(["$253b", "$c001", 0xd7]);
    expect(s.readNextReg(0x7f)).toBe(0x5a);
  });

  // --- CPU-010: NEXTREG from a page mapped by the MMU behaves as from anywhere else
  it("CPU-010: NEXTREG n,v and NEXTREG n,A run from an MMU-paged bank", async () => {
    const s = await createSession();
    await s.loadCode(` .org $8000\n jr $`);
    s.setNextReg(0x56, 0x20); // --- page $20 at $C000
    s.poke(0xc000, [0xed, 0x91, 0x7f, 0x42, 0xed, 0x92, 0x4a, 0x18, 0xfe]); // nextreg $7f,$42 / nextreg $4a,a / jr $
    s.out(0x243b, 0x15);
    s.setRegisters({ pc: 0xc000, a: 0x1c }).step(2);
    expect([s.readNextReg(0x7f), s.readNextReg(0x4a)]).toEqual([0x42, 0x1c]);
    expect(s.registers().pc).toBe(0xc007);
  });

  // --- CPU-011: PIXELDN (~898), PIXELAD (~937), SETAE (~921)
  const PIXELDN: Array<[hl: number, expected: number]> = [
    [0x4000, 0x4100], // --- next pixel row
    [0x4700, 0x4020], // --- last row of a character: next character row
    [0x47e0, 0x4800], // --- last row of a third: next third
    [0x57e5, 0x5805] // --- past the display file
  ];
  for (const [hl, expected] of PIXELDN) {
    it(`CPU-011: PIXELDN ${hex16(hl)} -> ${hex16(expected)}`, async () => {
      const r = (await run("        pixeldn", { hl, f: 0xd7 })).registers();
      expect([hex16(r.hl), r.f]).toEqual([hex16(expected), 0xd7]);
    });
  }
  const PIXELAD: Array<[de: number, expected: number]> = [
    [0x0000, 0x4000],
    [0xbfff, 0x57ff], // --- y 191, x 255
    [0x4523, 0x4d04] // --- y $45, x $23
  ];
  for (const [de, expected] of PIXELAD) {
    it(`CPU-011: PIXELAD with D=y, E=x = ${hex16(de)} -> ${hex16(expected)}`, async () => {
      const r = (await run("        pixelad", { de, f: 0xd7 })).registers();
      expect([hex16(r.hl), r.f]).toEqual([hex16(expected), 0xd7]);
    });
  }
  it("CPU-011: SETAE sets A to the pixel mask of E & 7", async () => {
    for (const [e, expected] of [[0, 0x80], [7, 0x01], [0xfb, 0x10]]) {
      const r = (await run("        setae", { de: e, f: 0xd7 })).registers();
      expect([r.a, r.f], `E=$${e.toString(16)}`).toEqual([expected, 0xd7]);
    }
  });

  /*
   * CPU-012: ED 98, t80n.vhd ~977: reads port BC and sets PC(13:6) to the byte, PC(5:0) to 0; PC(15:14)
   * are those of the next instruction's address. Port $243B reads back the selected register number.
   */
  it("CPU-012: JP (C) jumps inside the 16K block to (IN C) * 64", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        ld bc,$243b
        jp (c)
    `);
    s.out(0x243b, 0x10).step(2);
    expect(hex16(s.registers().pc)).toBe("$8400");
  });

  /*
   * CPU-013: A4 LDIX / B4 LDIRX / AC LDDX / BC LDDRX (mcode ~2098, ~2230): copy (HL) to (DE) unless the
   * byte equals A; LDIX HL+1, LDDX HL-1, DE+1 in both; BC-1; the R forms repeat while BC != 0.
   */
  const SRC = [0x11, 0xaa, 0x22, 0xaa, 0x33];
  async function copy(op: string, hl: number, bc: number) {
    const s = await createSession();
    await s.loadCode(` .org $8000\n ${op}\nDone: jr Done`);
    s.poke(0xc000, SRC).poke(0xd000, [0xee, 0xee, 0xee, 0xee, 0xee]);
    s.setRegisters({ a: 0xaa, hl, de: 0xd000, bc, f: 0 }).runTo("Done");
    return { s, r: s.registers(), dst: Array.from(s.peekBytes(0xd000, 5)) };
  }
  it("CPU-013: LDIX copies one byte unless it equals A", async () => {
    const { r, dst } = await copy("ldix", 0xc000, 5);
    expect([hex16(r.hl), hex16(r.de), hex16(r.bc)]).toEqual(["$c001", "$d001", "$0004"]);
    expect(dst[0]).toBe(0x11);
    const skipped = await copy("ldix", 0xc001, 5);
    expect(skipped.dst[0], "$AA equals A: not written").toBe(0xee);
    expect(hex16(skipped.r.de), "DE still advances").toBe("$d001");
  });
  it("CPU-013: LDIRX copies the block, skipping bytes equal to A", async () => {
    const { r, dst } = await copy("ldirx", 0xc000, 5);
    expect(dst).toEqual([0x11, 0xee, 0x22, 0xee, 0x33]);
    expect([hex16(r.hl), hex16(r.de), hex16(r.bc), r.f & PV]).toEqual(["$c005", "$d005", "$0000", 0]);
  });
  it("CPU-013: LDDX / LDDRX walk HL down and DE up", async () => {
    const one = await copy("lddx", 0xc004, 5);
    expect([hex16(one.r.hl), hex16(one.r.de), one.dst[0]]).toEqual(["$c003", "$d001", 0x33]);
    const all = await copy("lddrx", 0xc004, 5);
    expect(all.dst).toEqual([0x33, 0xee, 0x22, 0xee, 0x11]);
    expect([hex16(all.r.hl), hex16(all.r.de), hex16(all.r.bc)]).toEqual(["$bfff", "$d005", "$0000"]);
  });

  /*
   * CPU-014: ED B7 LDPIRX (mcode ~1953, t80n.vhd ~1117): reads (HL(15:3) & E(2:0)) - an 8-byte pattern
   * indexed by DE - writes it to (DE) unless it equals A, DE+1, BC-1, repeats while BC != 0; HL stays.
   */
  it("CPU-014: LDPIRX repeats an 8-byte pattern indexed by E, skipping A", async () => {
    const s = await createSession();
    await s.loadCode(` .org $8000\n ldpirx\nDone: jr Done`);
    s.poke(0xc000, [1, 2, 3, 4, 0xaa, 6, 7, 8]).poke(0xd000, new Array(10).fill(0xee));
    s.setRegisters({ a: 0xaa, hl: 0xc000, de: 0xd003, bc: 6 }).runTo("Done");
    expect(Array.from(s.peekBytes(0xd003, 6))).toEqual([4, 0xee, 6, 7, 8, 1]);
    const r = s.registers();
    expect([hex16(r.hl), hex16(r.de), hex16(r.bc)]).toEqual(["$c000", "$d009", "$0000"]);
  });

  /*
   * CPU-015: ED A5 LDWS (mcode ~2140): (HL) -> (DE), INC L, INC D. The flags come from the INC D ALU
   * operation (the last Save_ALU), which - unlike INC r (mcode ~757) - does not set PreserveC, so
   * carry is the carry out of D + 1.
   */
  it("CPU-015: LDWS copies (HL) to (DE), increments L and D; flags from INC D", async () => {
    const a = await run("        ldws", { hl: 0xc0ff, de: 0xd010, f: C });
    const r = a.registers();
    expect([hex16(r.hl), hex16(r.de), a.peek(0xd010)]).toEqual(["$c000", "$d110", a.peek(0xc0ff)]);
    expect(r.f & FLAGS, "D $D0 -> $D1: S; carry cleared").toBe(S);
    const b = await run("        ldws", { hl: 0xc000, de: 0xff10, f: 0 });
    expect(b.registers().f & FLAGS, "D $FF -> $00: Z, H, C").toBe(Z | H | C);
  });

  // --- CPU-016: unassigned ED opcodes fall into `when others => null` (mcode): 8 T-state NOPs
  const NOPS = [0x00, 0x20, 0x21, 0x22, 0x25, 0x26, 0x37, 0x3f, 0x80, 0x8b, 0x9f, 0xff];
  for (const op of NOPS) {
    it(`CPU-016: ED ${op.toString(16).padStart(2, "0").toUpperCase()} changes nothing but PC`, async () => {
      const s = await createSession();
      await s.loadCode(` .org $8000\n .defb $ed, $${op.toString(16)}\nDone: jr Done`);
      const regs = { a: 0x5a, f: 0xd7, bc: 0x1234, de: 0x5678, hl: 0x9abc, ix: 0x1111, iy: 0x2222, sp: 0xbff0 };
      s.setRegisters(regs).step(1);
      const r = s.registers();
      expect({ pc: r.pc, a: r.a, f: r.f, bc: r.bc, de: r.de, hl: r.hl, ix: r.ix, iy: r.iy, sp: r.sp }).toEqual({
        pc: 0x8002, ...regs
      });
    });
  }

  /*
   * CPU-017: the repeating Z80N copies re-execute from PC - 2 like LDIR, so a maskable interrupt is
   * taken between two iterations and the copy resumes after RETI. A 12K LDIRX spans more than a frame;
   * the IM 2 handler records BC the first time it runs.
   */
  it("CPU-017: an interrupt is taken between LDIRX iterations and the copy completes", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        ld hl,$c000
        ld (hl),$5a
        ld de,$c001
        ld bc,$2fff
        ldir                     ; source: $5A everywhere
        ld a,$a0                 ; IM 2: the bus holds $FF, so the vector is read from $A0FF
        ld i,a
        im 2
        ld hl,$a000              ; vector table: $A1A1 everywhere
        ld (hl),$a1
        ld de,$a001
        ld bc,$0100
        ldir
        ld a,$c3                 ; handler at $A1A1: jp Handler
        ld ($a1a1),a
        ld hl,Handler
        ld ($a1a2),hl
        ld hl,$c000
        ld de,$4000              ; into bank 5/2 RAM ($4000-$6FFF)
        ld bc,$3000
        xor a                    ; A = 0: nothing is skipped
        ei
        ldirx
        di
Done:   jr Done
Handler:
        push af
        ld a,(Seen)
        or a
        jr nz,Out
        inc a
        ld (Seen),a
        ld (SeenBc),bc
Out:    pop af
        ei
        reti
Seen:   .defb 0
SeenBc: .defw 0
    `);
    s.runTo("Done", { maxFrames: 20 });
    const seenBc = s.peekWord(s.symbol("SeenBc"));
    expect(s.peek(s.symbol("Seen")), "the handler ran").toBe(1);
    expect(seenBc, "during the copy").toBeGreaterThan(0);
    expect(seenBc).toBeLessThan(0x3000);
    expect(Array.from(s.peekBytes(0x4000, 0x3000)).every((b) => b === 0x5a), "the copy completed").toBe(true);
  });
});
