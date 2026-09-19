import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * The app's display hotkeys (Machine menu F2 / F3 / F7; catalogue HK-001 - HK-005).
 *
 * They act through the NextRegs a program would use, so the hardware readback proves them:
 * - F2 toggles the scandoubler, `$05` bit 0 (`nr_05_scandouble_en`). Like a `$05` write, it takes
 *   effect at the next frame start (zxnext.vhd ~6644-6649), where `$05` reads the effective bit.
 * - F3 toggles 50/60 Hz, `$05` bit 2 (`nr_05_5060`), only while `$06` bit 5
 *   (`nr_06_hotkey_5060_en`) enables the hotkey; it changes the frame length from the next frame.
 * - F7 steps the scanline weight, `$09` bits 1-0 (`nr_09_scanlines`), 0 -> 1 -> 2 -> 3 -> 0, and
 *   leaves the other `$09` bits alone.
 *
 * Each returns the new setting to the app (which logs it and, for F7, stores the scanline effect).
 */

/** 48K timing (`$03` bit 7 + timing 001, low bits 000 leave the machine type alone). */
const TIMING_48K = 0x90;
const TACTS_PER_LINE_48K = 224;

async function idle(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(` .org $8000\n jr $`);
  s.runFrames(1);
  return s;
}

function frameTacts(s: NextTestSession, frames = 10): number {
  const before = s.tacts;
  s.runFrames(frames);
  return (s.tacts - before) / frames;
}

describe.each(ALL_CORES)("display hotkeys - %s core", (core: CoreName) => {
  it("HK-001: F2 toggles the scandoubler ($05 bit 0) from the next frame", async () => {
    const s = await idle(core);
    const before = s.readNextReg(0x05) & 0x01;

    await s.pressHotkey("F2");
    expect(s.lastHotkeyResult, "returned setting").toBe(before === 0);
    s.runFrames(1);
    expect(s.readNextReg(0x05) & 0x01).toBe(before ^ 0x01);

    await s.pressHotkey("F2");
    expect(s.lastHotkeyResult, "returned setting").toBe(before !== 0);
    s.runFrames(1);
    expect(s.readNextReg(0x05) & 0x01).toBe(before);
  });

  it("HK-002: F3 switches 50/60 Hz ($05 bit 2) and the frame length, from the next frame", async () => {
    const s = await idle(core);
    s.setNextReg(0x03, TIMING_48K).setNextReg(0x05, 0x00);
    s.setNextReg(0x06, s.readNextReg(0x06) | 0x20).runFrames(2);
    expect(Math.abs(frameTacts(s) - 312 * TACTS_PER_LINE_48K), "50 Hz frame").toBeLessThan(2);

    await s.pressHotkey("F3");
    expect(s.lastHotkeyResult, "returned setting").toBe(true);
    s.runFrames(2);
    expect(s.readNextReg(0x05) & 0x04).toBe(0x04);
    expect(Math.abs(frameTacts(s) - 264 * TACTS_PER_LINE_48K), "60 Hz frame").toBeLessThan(2);

    await s.pressHotkey("F3");
    expect(s.lastHotkeyResult, "returned setting").toBe(false);
    s.runFrames(2);
    expect(s.readNextReg(0x05) & 0x04).toBe(0x00);
  });

  it("HK-006: two F2 presses in one frame cancel out (the stored bit toggles, not the readback)", async () => {
    const s = await idle(core);
    const before = s.readNextReg(0x05) & 0x01;
    await s.pressHotkey("F2");
    await s.pressHotkey("F2");
    expect(s.lastHotkeyResult, "second press").toBe(before !== 0);
    s.runFrames(1);
    expect(s.readNextReg(0x05) & 0x01).toBe(before);
  });

  it("HK-003: F3 does nothing while $06 bit 5 disables the hotkey", async () => {
    const s = await idle(core);
    s.setNextReg(0x03, TIMING_48K).setNextReg(0x05, 0x00);
    s.setNextReg(0x06, s.readNextReg(0x06) & ~0x20).runFrames(1);

    await s.pressHotkey("F3");
    expect(s.lastHotkeyResult).toBeUndefined();
    s.runFrames(2);
    expect(s.readNextReg(0x05) & 0x04).toBe(0x00);
  });

  it("HK-004: F7 steps the scanline weight ($09 bits 1-0) through 0-3 and wraps", async () => {
    const s = await idle(core);
    s.setNextReg(0x09, 0x00).runFrames(1);
    for (const expected of [1, 2, 3, 0, 1]) {
      await s.pressHotkey("F7");
      expect(s.lastHotkeyResult, "returned weight").toBe(expected);
      s.runFrames(1);
      expect(s.readNextReg(0x09) & 0x03).toBe(expected);
    }
  });

  it("HK-005: F7 leaves the other $09 bits alone", async () => {
    const s = await idle(core);
    // --- AY mono bits 7-5 and the HDMI audio silence bit 2; bit 3 (clear mapram) is a strobe
    s.setNextReg(0x09, 0xe4).runFrames(1);
    await s.pressHotkey("F7");
    s.runFrames(1);
    expect(s.readNextReg(0x09)).toBe(0xe5);
  });
});
