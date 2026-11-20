import { describe, expect, it } from "vitest";

import { createSamSession } from "../harness/samcoupe";
import { createBareSam } from "./bare";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { SAM_FILE_CODE, buildMgtImage, mgtSectorOffset, readMgtDirectory } from "@common/samcoupe/mgtImage";
import { samDiskFromImage } from "@emu/machines/samcoupe/SamDiskImage";

/*
 * The disk drives (plan §10; STORAGE_FIRMWARE_SOFTWARE.md §4): two WD1772s at E0h/F0h, A2 the side, the
 * ROM's F9 boot of a boot file (track 4 sector 1, "BOOT" at byte 256, entered at 8009h).
 */

/** A boot file: `code` at 8009h, "BOOT" at byte 256 of the sector (file data byte 247) */
function bootFile(code: number[]): Uint8Array {
  const data = new Uint8Array(512);
  data.set(code, 0);
  data.set([0x42, 0x4f, 0x4f, 0x54], 247);
  return data;
}

describe("SAM disks", () => {
  it("the ROM boots a disk with F9: it loads track 4 sector 1 and enters it at 8009h", async () => {
    const s = await createSamSession();
    // --- LD A,5 ; OUT (FEh),A ; DI ; JR $
    const image = buildMgtImage([{ name: "boot", type: SAM_FILE_CODE, data: bootFile([0x3e, 0x05, 0xd3, 0xfe, 0xf3, 0x18, 0xfe]), startPage: 1, startOffset: 0x8000 }]);
    s.insertDisk(0, image);
    s.bootToCopyright();
    s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9);
    s.runUntil(() => s.wasm.samGetBorder() === 0x05, { maxFrames: 400 }, "the boot file's border");
    // --- Into the page below the screen (pages 30-31), at 8000h
    expect(s.wasm.samGetHmpr() & 0x1f).toBe(29);
    expect(s.wasm.samGetCpuPc()).toBe(0x800e);
  });

  it("a disk without BOOT at byte 256 does not boot", async () => {
    const s = await createSamSession();
    const data = bootFile([0x3e, 0x05, 0xd3, 0xfe, 0xf3, 0x18, 0xfe]);
    data[247] = 0;
    s.insertDisk(0, buildMgtImage([{ name: "x", type: SAM_FILE_CODE, data, startPage: 1, startOffset: 0x8000 }]));
    s.bootToCopyright();
    s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9).runFrames(300);
    expect(s.wasm.samGetBorder() & 0x27).not.toBe(0x05);
  });

  it("reads a sector through the ports: seek, read with DRQ polling, A2 the side", async () => {
    const s = await createBareSam();
    const image = new Uint8Array(819_200);
    image.set([0x11, 0x22, 0x33], mgtSectorOffset(0x80 | 3, 7));
    s.insertDisk(0, image);
    // --- Restore, seek to 3 (data reg = 3), then read sector 7 of side 2 (E4h-E7h)
    const wait = () => {
      for (let i = 0; i < 2_000_000 && (s.in(0x00e0) & 0x01); i++) s.step(1);
    };
    for (let i = 0; i < 0x400; i++) s.poke(i, 0x00);
    s.wasm.samSetCpuPc(0);
    s.out(0x00e0, 0x00);
    wait();
    s.out(0x00e3, 3);
    s.out(0x00e0, 0x10);
    wait();
    expect(s.in(0x00e1)).toBe(3);
    s.out(0x00e6, 7);
    s.out(0x00e4, 0x80);
    const bytes: number[] = [];
    for (let i = 0; i < 4_000_000 && bytes.length < 3; i++) {
      if (s.in(0x00e4) & 0x02) bytes.push(s.in(0x00e7));
      else s.step(1);
    }
    expect(bytes).toEqual([0x11, 0x22, 0x33]);
  });

  it("drive 2's ports read FFh with one drive fitted, and work with two", async () => {
    const one = await createBareSam();
    expect(one.in(0x00f1)).toBe(0xff);
    const two = await createSamSession({ drives: 2 });
    two.out(0x00f1, 0x2a);
    expect(two.in(0x00f1)).toBe(0x2a);
  });

  it("the image readers: MGT as it is, gzip, SAD and SBT wrapped as a bootable disk", async () => {
    const mgt = buildMgtImage([{ name: "hello", type: SAM_FILE_CODE, data: new Uint8Array([1, 2, 3]), startPage: 1, startOffset: 0x8000, execPage: 1, execOffset: 0x8000 }]);
    const disk = samDiskFromImage(mgt);
    expect(typeof disk).not.toBe("string");
    const { gzipSync } = await import("fflate");
    const gz = samDiskFromImage(gzipSync(mgt));
    expect(typeof gz !== "string" && gz.kind).toBe("mgt");
    // --- SAD: side-major tracks
    const sad = new Uint8Array(22 + 819_200);
    sad.set(Array.from("Aley's disk backup", (c) => c.charCodeAt(0)), 0);
    sad.set([2, 80, 10, 8], 18);
    sad[22 + 80 * 5120 + 3 * 5120] = 0x77; // side 1, track 3, sector 1
    const fromSad = samDiskFromImage(sad);
    expect(typeof fromSad !== "string" && fromSad.canonical[mgtSectorOffset(0x83, 1)]).toBe(0x77);
    // --- SBT: the file becomes autoExec at track 4 sector 1, BOOT at byte 256
    const sbt = new Uint8Array(300);
    sbt.set([0x42, 0x4f, 0x4f, 0x54], 247);
    const fromSbt = samDiskFromImage(sbt);
    expect(typeof fromSbt !== "string" && fromSbt.readOnly).toBe(true);
    if (typeof fromSbt !== "string") {
      expect(readMgtDirectory(fromSbt.canonical)[0].name).toBe("autoExec");
      expect(String.fromCharCode(...fromSbt.canonical.subarray(mgtSectorOffset(4, 1) + 256, mgtSectorOffset(4, 1) + 260))).toBe("BOOT");
    }
  });

  it("the guest's writes come back as the whole image", async () => {
    const s = await createBareSam();
    s.insertDisk(0, new Uint8Array(819_200));
    for (let i = 0; i < 0x400; i++) s.poke(i, 0x00);
    s.wasm.samSetCpuPc(0);
    s.out(0x00e2, 1);
    s.out(0x00e0, 0xa0);
    let written = 0;
    for (let i = 0; i < 4_000_000 && written < 512; i++) {
      if (s.in(0x00e0) & 0x02) {
        s.out(0x00e3, 0xab);
        written++;
      } else s.step(1);
    }
    for (let i = 0; i < 20_000 && (s.in(0x00e0) & 1); i++) s.step(1);
    s.runFrames(1);
    expect(s.publishedDiskA()?.[mgtSectorOffset(0, 1)]).toBe(0xab);
  });
});
