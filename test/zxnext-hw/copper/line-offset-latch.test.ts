import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * COP-016: NextReg $64 (copper line offset) takes effect when `cvc` reloads, not when it is written.
 *
 * Hardware (`_input/next-fpga/src/video/zxula_timing.vhd` ~455-472): `cvc` - the line counter the
 * copper, the line interrupt and NextRegs `$1E`/`$1F` all read - is a counter. At `hc_ula` 0 of the
 * first active line (`ula_max_hc and ula_min_vactive`) it is loaded with `$64`; on every other line it
 * counts on (wrapping at `c_max_vc`). So a `$64` write before that point in a frame shows from that
 * frame's first active line, and a write after it changes nothing until the next frame's.
 *
 * Found by PAR-001 (parity/nextreg-parity): the WASM core applied a written `$64` to `$1F` at once.
 * Both cores applied it to the copper and the line interrupt at once.
 */

/** Instructions of the parked `jr $` loop (12 tacts each) that take the beam well past the reload. */
const PAST_RELOAD = 2000;
const OFFSET = 0x20;

async function parked(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(2);
}

/** `$1E`/`$1F` as one 9-bit line. */
const line = (s: NextTestSession) => ((s.readNextReg(0x1e) & 0x01) << 8) | s.readNextReg(0x1f);

describe.each(ALL_CORES)("copper line offset latch - %s core", (core) => {
  it("COP-016: a $64 write after the reload leaves this frame's lines alone and shows from the next frame", async () => {
    const reference = await parked(core);
    reference.step(PAST_RELOAD);
    const here = line(reference);
    reference.runFrames(1).step(PAST_RELOAD);
    const nextFrame = line(reference);

    const s = await parked(core);
    s.step(PAST_RELOAD);
    s.setNextReg(0x64, OFFSET);
    expect(line(s), "straight after the write").toBe(here);
    s.runFrames(1).step(PAST_RELOAD);
    expect(line(s), "the next frame, same beam position").toBe(nextFrame + OFFSET);
  });

  it("COP-016: a $64 write before the reload shows from this frame's first active line", async () => {
    const reference = await parked(core);
    const atFrameStart = line(reference);
    reference.step(PAST_RELOAD);
    const here = line(reference);

    const s = await parked(core);
    s.setNextReg(0x64, OFFSET);
    // --- Before the reload the counter still carries the old offset
    expect(line(s), "before the reload").toBe(atFrameStart);
    s.step(PAST_RELOAD);
    expect(line(s), "after the reload").toBe(here + OFFSET);
  });

  it("COP-016: a copper WAIT on a line after a mid-frame $64 write still matches the old count", async () => {
    // --- The copper sets the border at copper line 100 (+ $20 once the new offset loads). $64 is
    // --- written after the reload, so this frame still sees line 100 where it was: a WAIT for line
    // --- 100 fires on the same raster line as without the write.
    const run = async (write: boolean) => {
      const s = await parked(core);
      // --- WAIT line 100 ; MOVE $40,16 ; MOVE $41,$E0 (paper 0 - the border - red) ; HALT
      const list = [0x80 | (100 >> 8), 100 & 0xff, 0x40, 0x10, 0x41, 0xe0, 0xff, 0xff];
      s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x10).setNextReg(0x41, 0x00); // --- border 0 black
      s.out(0xfe, 0x00);
      s.setNextReg(0x61, 0x00).setNextReg(0x62, 0x00);
      for (const b of list) s.setNextReg(0x60, b);
      s.setNextReg(0x61, 0x00).setNextReg(0x62, 0xc0); // --- restart from 0 every frame
      s.runFrames(2); // --- the list runs from a frame start
      s.setNextReg(0x40, 0x10).setNextReg(0x41, 0x00); // --- black again before the measured frame
      s.step(PAST_RELOAD);
      if (write) s.setNextReg(0x64, OFFSET);
      s.runFrames(1);
      // --- The first buffer row whose left border is red
      for (let y = 0; y < 288; y++) if (s.pixel(4, y) !== s.pixel(4, 0)) return y;
      return -1;
    };
    const without = await run(false);
    expect(without, "the WAIT fired").toBeGreaterThan(0);
    expect(await run(true)).toBe(without);
  });
});
