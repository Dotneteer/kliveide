import { describe, expect, it } from "vitest";

import { createSamSession } from "../harness/samcoupe";
import { SAM_COPYRIGHT_KEY_WAIT } from "@emu/machines/samcoupe/SamWasmHost";

/*
 * The ROM's boot, observed on the core (plan Phase 1): the memory test, the copyright screen's key wait,
 * the page allocation table the ROM builds from its own size probe, the paging and the screen it leaves.
 */

describe("SAM Coupé boot", () => {
  it("ROM 3.0 reaches the copyright screen's key wait on the 512K model", async () => {
    const s = await createSamSession();
    s.bootToCopyright();
    expect(s.wasm.samGetCpuPc()).toBe(SAM_COPYRIGHT_KEY_WAIT);
    expect(s.isAtCopyright()).toBe(true);
    // --- Under 4 seconds of machine time (the memory test)
    expect(s.frames).toBeLessThan(200);
  });

  it("the ROM finds 32 pages and puts the screen in the top two (ALLOCT, PRAMTP)", async () => {
    const s = await createSamSession();
    s.bootToCopyright();
    const alloct = s.alloct();
    expect(alloct[32]).toBe(0xff);
    expect(alloct.slice(0, 32).every((b) => b !== 0xff)).toBe(true);
    expect(alloct[30]).toBe(0xc0);
    expect(alloct[31]).toBe(0xc0);
    expect(s.page(0, 0x1cb4)).toBe(31);
    // --- Mode 4 on pages 30-31
    const asic = s.asic();
    expect(asic.mode).toBe(4);
    expect(asic.screenPage).toBe(30);
  });

  it("ROM 3.1 boots the same way", async () => {
    const s = await createSamSession({ rom: "31" });
    s.bootToCopyright();
    expect(s.isAtCopyright()).toBe(true);
    expect(s.machine.doReadMemory(15)).toBe(31);
  });

  it("the 256K model reports 16 pages and the missing ones as absent", async () => {
    const s = await createSamSession({ model: "sam256" });
    s.bootToCopyright();
    const alloct = s.alloct();
    expect(alloct.slice(16, 32).every((b) => b === 0xff)).toBe(true);
    expect(alloct.slice(0, 16).every((b) => b !== 0xff)).toBe(true);
    expect(s.page(0, 0x1cb4)).toBe(15);
    expect(s.asic().screenPage).toBe(14);
  });

  it("a key at the copyright screen enters SAM BASIC's editor", async () => {
    const s = await createSamSession();
    s.bootToBasic();
    expect(s.isAtCopyright()).toBe(false);
    // --- BASIC runs with ROM0 in section A and page 0 (the system variables) in B
    expect(s.wasm.samGetLmpr() & 0x3f).toBe(0x1f);
  });

  it("frames are 119 808 T long and start at the frame interrupt", async () => {
    const s = await createSamSession();
    s.runFrames(3);
    const t0 = s.wasm.samGetTacts();
    s.runFrames(10);
    const elapsed = (s.wasm.samGetTacts() - t0) >>> 0;
    expect(Math.abs(elapsed - 10 * 119_808)).toBeLessThan(40);
    expect(s.wasm.samGetTactsInFrame()).toBe(119_808);
  });
});
