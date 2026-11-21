import { describe, expect, it } from "vitest";

import { createSamSession } from "../harness/samcoupe";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { buildSamBootDisk } from "@common/samcoupe/samBootDisk";
import { placeSamCode, type SamPlacement } from "@common/samcoupe/codePlacement";
import { SAM_FILE_CODE, buildMgtImage } from "@common/samcoupe/mgtImage";
import { SAM_KLIVE_BOOT_IMAGE } from "@common/samcoupe/samKliveBootImage";

/*
 * Klive's boot loader on the real ROM and the emulated VL1772 (plan §9.3, D7): F9 at the copyright screen
 * boots it, it loads the program file through the controller - across sectors and pages - and starts it
 * with Run's paging.
 */

function place(segments: { startAddress: number; emittedCode: number[] }[], entry?: number): SamPlacement {
  const placement = placeSamCode(segments, entry);
  if ("code" in placement) throw new Error(placement.code);
  return placement;
}

describe("Klive's SAM boot loader", () => {
  it("loads a 20K program at 8000h through the drive and starts it with HMPR = 1", async () => {
    const code = [0x3e, 0x06, 0xd3, 0xfe, 0x18, 0xfe];
    const data = new Array(20_000).fill(0).map((_, i) => (i < code.length ? code[i] : (i * 7) & 0xff));
    const s = await createSamSession();
    s.insertDisk(0, buildSamBootDisk(place([{ startAddress: 0x8000, emittedCode: data }])));
    s.bootToCopyright();
    s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9);
    s.runUntil(() => s.wasm.samGetBorder() === 0x06, { maxFrames: 1500 }, "the program's border");
    expect(s.wasm.samGetHmpr()).toBe(1);
    expect(s.wasm.samGetCpuPc()).toBe(0x8004);
    expect(s.wasm.samGetLmpr() & 0x60).toBe(0x00);
    // --- Every byte where it belongs: page 1 from 0000h, on into page 2
    for (let i = 0; i < data.length; i++) {
      const linear = i;
      expect(s.page(1 + (linear >> 14), linear & 0x3fff), `byte ${i}`).toBe(data[i]);
    }
    expect(s.wasm.samGetCpuIff1()).toBe(1);
  });

  it("starts code assembled for C000h (page 2) and at an entry point that is not the first byte", async () => {
    const s = await createSamSession();
    const code = [0x00, 0x00, 0x3e, 0x03, 0xd3, 0xfe, 0x18, 0xfe];
    s.insertDisk(0, buildSamBootDisk(place([{ startAddress: 0xc100, emittedCode: code }], 0xc102)));
    s.bootToCopyright();
    s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9);
    s.runUntil(() => s.wasm.samGetBorder() === 0x03, { maxFrames: 1500 }, "the program's border");
    expect(s.wasm.samGetCpuPc()).toBe(0xc106);
  });

  it("a disk with the loader but no program reports a loading error in SAM BASIC", async () => {
    const s = await createSamSession();
    s.insertDisk(0, buildMgtImage([{ name: "kliveboot", type: SAM_FILE_CODE, data: SAM_KLIVE_BOOT_IMAGE, startPage: 1, startOffset: 0x8000 }]));
    s.bootToCopyright();
    s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9).runFrames(400);
    // --- Back in the ROM with interrupts on, not stuck in the loader's page
    expect(s.wasm.samGetCpuPc()).toBeLessThan(0x8000);
    expect(s.wasm.samGetCpuIff1()).toBe(1);
  });
});
