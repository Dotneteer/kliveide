import { describe, expect, it } from "vitest";

import { createBareSam } from "./bare";

/*
 * The MGT mouse (plan §9.2; SOUND_INPUT_IO.md §4): nine nibble reads at FFFEh - strobe, dummy, buttons,
 * Y (3 nibbles), X (3 nibbles) - the deltas latched at the buttons read, the sequence going on at the
 * dummy after the last, and a reset to the strobe after 38 us without a read.
 */

describe("SAM mouse", () => {
  it("reads the nine nibbles, the deltas as 12-bit two's complement", async () => {
    const s = await createBareSam();
    s.machine.moveMouse(5, -2);
    s.machine.setMouseButtons(1);
    const nibbles = Array.from({ length: 9 }, () => s.in(0xfffe) & 0x0f);
    expect(nibbles).toEqual([0x0f, 0x0f, 0x0e, 0x0f, 0x0f, 0x0e, 0x00, 0x00, 0x05]);
    // --- On at the dummy, then the buttons again with no new movement
    expect(s.in(0xfffe) & 0x0f).toBe(0x0f);
    expect(s.in(0xfffe) & 0x0f).toBe(0x0e);
    expect(s.in(0xfffe) & 0x0f).toBe(0x00);
  });

  it("starts again at the strobe after 38 us without a read", async () => {
    const s = await createBareSam();
    for (let i = 0; i < 0x400; i++) s.poke(i, 0x00);
    s.wasm.samSetFrameTact(1000);
    s.in(0xfffe);
    s.in(0xfffe);
    s.in(0xfffe);
    s.machine.moveMouse(1, 0);
    // --- 300 T of NOPs in the border
    s.wasm.samSetCpuPc(0);
    s.step(80);
    const strobe = s.in(0xfffe) & 0x0f;
    expect(strobe).toBe(0x0f);
    expect(s.wasm.samMouseGetIndex()).toBe(1);
  });

  it("bit 4 stays the keyboard's RIGHT key", async () => {
    const s = await createBareSam();
    s.machine.setKeyStatus(68, true);
    expect(s.in(0xfffe) & 0x10).toBe(0);
  });
});
