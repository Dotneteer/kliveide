import { describe, expect, it } from "vitest";

import { createSession, type AudioSample, type NextTestSession } from "../../harness/zxnext";
import { ay, ayRead, frequency, relativeError, side, swing, toneHz } from "./_audio-helpers";

/*
 * The PSG bus and resets: per-chip register latches, the power-on / soft-reset state of the
 * TurboSound, the audio NextRegs across a soft reset, and a PSG driven by Z80 OUT instructions. Ports
 * the hardware-visible parts of test/audio/PsgCompatibility.step14, TurboSoundTesting.step15,
 * TurboSoundDevice.step2, PortHandlers.step10, AudioControlDevice.step9 and FinalIntegration.step20.
 *
 * Hardware (`_input/next-fpga/src`):
 * - audio/turbosound.vhd ~121-127: on reset `ay_select <= "11"` (chip 0) and every pan is "11".
 *   ~141-150: a register-number write (bits 7-5 = 000) goes only to the selected chip
 *   (`psgN_addr`); ~321: $FFFD reads the selected chip.
 * - audio/ym2149.vhd ~166-176: each chip latches its own register number (`addr`), reset to 0;
 *   ~184-186: reset clears every register and sets R7 to $FF.
 * - zxnext.vhd ~6325: `audio_ay_reset` = `reset` or $06 bits 1-0 = 11, so a soft reset resets the PSGs.
 * - zxnext.vhd ~1107-1116: power-on values $06 bits 1-0 = 00, $08 bit 5 = 0, bit 3 = 0, bit 1 = 0,
 *   $09 bits 7-5 = 000. ~5138-5164: they are only written by NextReg writes - the NextReg process's
 *   reset branch (~4930-5100) does not list them, so a soft reset keeps them. Readback ~5846-5855.
 */

const RATE = 48_000;
const NR08_TS = 0x12; // --- internal speaker + TurboSound; ABC; DACs off

const PARK = " .org $8000\n di\nPark: jr Park";

async function psg(nr08 = NR08_TS): Promise<NextTestSession> {
  const s = await createSession({ audioSampleRate: RATE });
  await s.loadCode(PARK);
  s.setNextReg(0x06, 0x00).setNextReg(0x08, nr08);
  return s;
}

const record = (s: NextTestSession, frames = 2): AudioSample[] => s.startAudio().runFrames(frames).audio().slice(2);

describe("PSG bus and resets", () => {
  it("PSG-BUS-1: each chip keeps its own selected register number", async () => {
    // --- ym2149.vhd ~172-173 latches `addr` only on its own busctrl_addr (turbosound.vhd ~143-149)
    const s = await psg();
    ay(s.out(0xfffd, 0xff), 2, 0x11); // --- chip 0: R2 selected
    ay(s.out(0xfffd, 0xfe), 5, 0x0a); // --- chip 1: R5 selected
    expect(s.out(0xfffd, 0xff).in(0xfffd), "chip 0 still on R2").toBe(0x11);
    expect(s.out(0xfffd, 0xfe).in(0xfffd), "chip 1 still on R5").toBe(0x0a);
    s.out(0xfffd, 0xff).out(0xbffd, 0x22); // --- a data write without a register write: chip 0's R2
    expect(ayRead(s, 2), "chip 0 R2").toBe(0x22);
    expect(ayRead(s.out(0xfffd, 0xfe), 2), "chip 1 R2 untouched").toBe(0x00);
  });

  it("PSG-BUS-2: after a hard reset chip 0 and its register 0 are selected", async () => {
    // --- turbosound.vhd ~123 (ay_select "11"), ym2149.vhd ~170-171 (addr 0)
    const s = await psg();
    s.out(0xbffd, 0x42); // --- no $FFFD write at all
    expect(s.in(0xfffd), "reads R0 of the selected chip").toBe(0x42);
    expect(ayRead(s.out(0xfffd, 0xff), 0), "chip 0 R0").toBe(0x42);
    expect(ayRead(s.out(0xfffd, 0xfe), 0), "chip 1 R0").toBe(0x00);
    expect(ayRead(s.out(0xfffd, 0xfd), 0), "chip 2 R0").toBe(0x00);
  });

  it("PSG-BUS-4: turning TurboSound off and on again keeps every chip's registers", async () => {
    // --- zxnext.vhd ~6325: only reset or $06 = 11 resets the PSGs, not $08 bit 1 (turbosound.vhd ~197)
    const s = await psg();
    [0xff, 0xfe, 0xfd].forEach((sel, chip) => ay(s.out(0xfffd, sel), 0, 0x11 * (chip + 1)));
    s.setNextReg(0x08, 0x10).runFrames(1).setNextReg(0x08, NR08_TS);
    expect([0xff, 0xfe, 0xfd].map((sel) => ayRead(s.out(0xfffd, sel), 0))).toEqual([0x11, 0x22, 0x33]);
  });

  it("PSG-BUS-3: after a hard reset $06 bits 1-0 = 00 (YM), $08 bit 5 = 0 (ABC), $09 bits 7-5 = 000; all read back", async () => {
    // --- zxnext.vhd ~1107-1116 (signal initial values), readback ~5846-5855. $08 bits 3 and 1 (DACs,
    // --- TurboSound) power up 0 in the VHDL, but both cores model the state *after the firmware*, which
    // --- sets $08 = $1A (NextRegDevice.ts hardReset, zxnext-nextreg.c) - README rule 6: not asserted.
    const s = await createSession({ audioSampleRate: RATE });
    await s.loadCode(PARK);
    expect([s.readNextReg(0x06) & 0x03, s.readNextReg(0x08) & 0x20, s.readNextReg(0x09) & 0xe0]).toEqual([0, 0, 0]);
    s.setNextReg(0x06, 0x01).setNextReg(0x08, 0x2a).setNextReg(0x09, 0xe0);
    expect([s.readNextReg(0x06) & 0x03, s.readNextReg(0x08) & 0x2a, s.readNextReg(0x09) & 0xe0], "set").toEqual([0x01, 0x2a, 0xe0]);
    s.setNextReg(0x06, 0x02).setNextReg(0x08, 0x00).setNextReg(0x09, 0x40);
    expect([s.readNextReg(0x06) & 0x03, s.readNextReg(0x08) & 0x2a, s.readNextReg(0x09) & 0xe0], "cleared").toEqual([0x02, 0x00, 0x40]);
  });

  it("PSG-RESET-1: a soft reset keeps the PSG mode, stereo mode, DAC enable, TurboSound and mono bits", async () => {
    // --- zxnext.vhd ~5138-5164 write them; the `reset = '1'` branch before ~5100 does not touch them
    const s = await psg();
    s.setNextReg(0x06, 0x01).setNextReg(0x08, 0x2a | 0x10).setNextReg(0x09, 0xe0);
    s.reset();
    await s.loadCode(PARK);
    expect([s.readNextReg(0x06) & 0x03, s.readNextReg(0x08) & 0x2a, s.readNextReg(0x09) & 0xe0]).toEqual([0x01, 0x2a, 0xe0]);
  });

  it("PSG-RESET-2: a soft reset resets the PSGs: chip 0 and R0 selected, pans 11, registers cleared, R7 = $FF", async () => {
    // --- zxnext.vhd ~6325 (audio_ay_reset = reset ...); turbosound.vhd ~121-127; ym2149.vhd ~170-186
    const s = await psg();
    for (const sel of [0xff, 0xfe, 0xfd]) {
      s.out(0xfffd, sel);
      for (let r = 0; r < 14; r++) ay(s, r, 0x05);
    }
    s.out(0xfffd, 0x9f); // --- chip 0 muted (pan 00)
    s.out(0xfffd, 0xfd).out(0xfffd, 0x09); // --- chip 2 selected, on R9
    s.reset();
    await s.loadCode(PARK);
    s.setNextReg(0x06, 0x00).setNextReg(0x08, NR08_TS); // --- explicit, so this test does not depend on PSG-RESET-1

    for (const [chip, sel] of [[0, 0xff], [1, 0xfe], [2, 0xfd]] as const) {
      s.out(0xfffd, sel);
      const regs = Array.from({ length: 14 }, (_, r) => ayRead(s, r));
      expect(regs, `chip ${chip} registers`).toEqual(Array.from({ length: 14 }, (_, r) => (r === 7 ? 0xff : 0x00)));
    }

    // --- A second reset, then no select at all: the writes land in chip 0, R0 first, and chip 0's pan is 11
    s.out(0xfffd, 0x9f).out(0xfffd, 0xfd).out(0xfffd, 0x04);
    s.reset();
    await s.loadCode(PARK);
    s.setNextReg(0x06, 0x00).setNextReg(0x08, NR08_TS);
    s.out(0xbffd, 0xfe); // --- R0: channel A period $0FE
    expect(ayRead(s.out(0xfffd, 0xff), 0), "the data write reached chip 0 R0").toBe(0xfe);
    ay(s, 2, 0xfe).out(0xfffd, 9).out(0xbffd, 0x0f).out(0xfffd, 7).out(0xbffd, 0x3d); // --- B: tone $0FE, level 15
    const samples = record(s);
    expect([swing(side(samples, "left")) > 0, swing(side(samples, "right")) > 0], "chip 0 pan back to 11").toEqual([true, true]);
  });

  it("PSG-CPU-1: a Z80 program writing $FFFD/$BFFD with OUT (C),A plays the tone the registers define", async () => {
    // --- zxnext.vhd ~2603-2604 decode; ym2149.vhd tone: f = 1.75 MHz / (16 * period)
    const s = await createSession({ audioSampleRate: RATE });
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $06,$00
        nextreg $08,$10
        ld hl,Init
        ld e,4
Next:   ld bc,$fffd
        ld a,(hl)
        out (c),a              ; register
        inc hl
        ld b,$bf
        ld a,(hl)
        out (c),a              ; value
        inc hl
        dec e
        jr nz,Next
        nextreg $7f,$a5
Park:   jr Park
Init:   .defb 0,$7f, 1,$01, 8,$0f, 7,$3e
`);
    s.runUntilReady();
    const left = side(s.startAudio().runFrames(4).audio(), "left");
    expect(relativeError(frequency(left, RATE), toneHz(0x17f))).toBeLessThan(0.01);
  });
});
