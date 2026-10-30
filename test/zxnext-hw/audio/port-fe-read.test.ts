import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * What a program reads back from port $FE bit 6 with no tape playing: the EAR output bit and, with the
 * issue 2 keyboard, the MIC bit (the audio series' beeper article, plan
 * `.plans/NEXT_AUDIO_ARTICLES_PLAN.md` §4).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~3456: port_fe_dat_0 = '1' & ((i_AUDIO_EAR xor pi_fe_ear) or (port_fe_ear or
 *   (port_fe_mic and nr_08_keyboard_issue2))) & '1' & i_KBD_COL - bits 7 and 5 read 1, bit 6 is a plain
 *   OR of the bits, sampled at the read. Nothing remembers an earlier EAR level: unlike the 48K's ULA,
 *   whose EAR pin is an analogue line that takes time to fall, bit 6 drops with the write that clears
 *   bit 4.
 * - zxnext.vhd ~3585-3596: port_fe_reg (bits 4-0) is cleared by reset; EAR = bit 4, MIC = bit 3.
 * - nextreg.txt: NextReg $08 bit 0 "Implement issue 2 keyboard (hard reset = 0)".
 */

/** Writes each value to port $FE and reads it back straight after; results from $C000 */
async function readBack(s: NextTestSession, writes: number[], nr08 = 0x50): Promise<number[]> {
  const body = writes
    .map(
      (v, i) => `        ld a,$${v.toString(16)}
        out ($fe),a
        ld bc,$fffe
        in a,(c)              ; no key row selected
        ld ($${(0xc000 + i).toString(16)}),a`
    )
    .join("\n");
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${nr08.toString(16)}
${body}
        nextreg $7f,$a5
        jr $
`,
    { entry: "Start" }
  );
  s.runUntilReady();
  return [...s.peekBytes(0xc000, writes.length)];
}

describe("Port $FE read-back", () => {
  it("FE-READ-001: bit 6 follows the EAR bit at once, in both directions", async () => {
    const s = await createSession();
    const [on, off, onAgain, offAgain] = await readBack(s, [0x10, 0x00, 0x17, 0x07]);
    expect(on & 0x40).toBe(0x40);
    // --- The 48K's ULA would still read 1 here, for up to about 800 µs; the Next reads 0
    expect(off & 0x40).toBe(0);
    expect(onAgain & 0x40).toBe(0x40);
    expect(offAgain & 0x40).toBe(0);
  });

  it("FE-READ-002: the MIC bit reads in bit 6 only with the issue 2 keyboard (NextReg $08 bit 0)", async () => {
    const issue3 = await readBack(await createSession(), [0x08, 0x00], 0x50);
    expect(issue3.map((b) => b & 0x40)).toEqual([0, 0]);
    const issue2 = await readBack(await createSession(), [0x08, 0x00, 0x18], 0x51);
    expect(issue2.map((b) => b & 0x40)).toEqual([0x40, 0, 0x40]);
  });

  it("FE-READ-003: bits 7 and 5 read 1, and with no key pressed the whole byte is $BF or $FF", async () => {
    const [low, high] = await readBack(await createSession(), [0x00, 0x10]);
    expect(low).toBe(0xbf);
    expect(high).toBe(0xff);
  });
});
