import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName } from "../../harness/zxnext";

/*
 * Memory contention and NextReg $08 bit 6 (catalogue MEM-023).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~4461: contention is enabled only with $08 bit 6 = 0, a non-Pentagon timing and 3.5 MHz.
 * - ~4469-4473: whether an access is contended depends on the 8K *page* being accessed, not on the
 *   address: only pages $00-$0F (16K banks 0-7); 48K timing: bank 5; 128K: odd banks; +3: banks 4-7.
 *
 * A loop in bank 2 reads a byte through slot 3 twice per iteration; slot 3 maps the page under test.
 * The loop count per frame is compared with the same loop reading page $10 (bank 8), which is never
 * contended. Contention only stretches accesses during the 192 display lines, so a contended loop
 * loses a few percent, an uncontended one none.
 *
 * The pass is 65 T-states on purpose. The ULA's wait pattern repeats every 8 T-states and the only
 * contended accesses are the `ld a,($6000)` reads. A pass of a multiple of 8 T-states (the original
 * 48 T loop) is phase-locked: after one wait every later read lands in a free slot and the loop loses
 * nothing - on real hardware too. The `nop` breaks the lock, and the second read doubles the signal, so
 * a contended loop loses ~3-3.5% (the uncontended ones lose none) against the 2% the test asks for.
 *
 * B26 (no memory contention in either core) is fixed: the contended cases pass in both cores.
 */

const TIMING = { "48K": 0x90, "128K": 0xa0, "+3": 0xb0, Pentagon: 0xc0 } as const;
type Timing = keyof typeof TIMING;

async function loopCount(core: CoreName, timing: Timing, page: number, opts: { speed?: number; noContention?: boolean } = {}) {
  const s = await createSession(core);
  await s.loadCode(`
        .org $8000
Start:
        nextreg $03,${TIMING[timing]}
        nextreg $08,${opts.noContention ? 0x40 : 0x00}
        nextreg $07,${opts.speed ?? 0}
        nextreg $53,${page}
        ld a,$b0
        ld i,a
        im 2
        ld hl,$b000
        ld (hl),$b2
        ld de,$b001
        ld bc,$0100
        ldir
        ld a,$c3
        ld ($b2b2),a
        ld hl,Handler
        ld ($b2b3),hl
        ei
        halt                     ; wakes right after a frame interrupt
        ld a,(Ticks)
        ld b,a
        ld hl,0
Count:  inc hl
        nop                      ; 65 T per pass, not a multiple of 8 (see the header)
        ld a,($6000)             ; the accesses under test
        ld a,($6000)
        ld a,(Ticks)
        cp b
        jr z,Count
        di
        ld (Result),hl
        nextreg $7f,$a5
Stop:   jr Stop

Handler:
        push af
        ld a,(Ticks)
        inc a
        ld (Ticks),a
        pop af
        ei
        reti
Ticks:  .defb 0
Result: .defw 0
  `, { entry: "Start" });
  s.runUntilReady({ maxFrames: 10 });
  return s.peekWord(s.symbol("Result"));
}

const UNCONTENDED_PAGE = 0x10;

/** [timing, 16K bank, contended per ~4469-4473] */
const MATRIX: Array<[Timing, number, boolean]> = [
  ["48K", 5, true],
  ["48K", 7, false],
  ["48K", 4, false],
  ["128K", 7, true],
  ["128K", 5, true],
  ["128K", 4, false],
  ["+3", 4, true],
  ["+3", 7, true],
  ["+3", 2, false],
  ["Pentagon", 5, false]
];

describe.each(ALL_CORES)("memory contention - %s core", (core) => {
  for (const [timing, bank, contended] of MATRIX) {
    const title = `MEM-023: ${timing} timing, bank ${bank} is ${contended ? "" : "not "}contended at 3.5 MHz`;
    const test = async () => {
      const base = await loopCount(core, timing, UNCONTENDED_PAGE);
      const count = await loopCount(core, timing, bank * 2);
      if (contended) expect(count, `${count} vs ${base} uncontended`).toBeLessThan(base * 0.98);
      else expect(Math.abs(count - base), `${count} vs ${base}`).toBeLessThanOrEqual(2);
    };
    it(title, test);
  }

  it("MEM-023: $08 bit 6 turns contention off", async () => {
    const base = await loopCount(core, "48K", UNCONTENDED_PAGE, { noContention: true });
    const count = await loopCount(core, "48K", 10, { noContention: true });
    expect(Math.abs(count - base), `${count} vs ${base}`).toBeLessThanOrEqual(2);
  });

  it("MEM-023: there is no contention at 7 MHz", async () => {
    const base = await loopCount(core, "48K", UNCONTENDED_PAGE, { speed: 1 });
    const count = await loopCount(core, "48K", 10, { speed: 1 });
    expect(Math.abs(count - base), `${count} vs ${base}`).toBeLessThanOrEqual(2);
  });
});
