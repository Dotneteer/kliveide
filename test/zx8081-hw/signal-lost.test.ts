import { describe, expect, it } from "vitest";

import { createZx81Session, type Zx81TestSession } from "../harness/zx81";

/**
 * `isVideoSignalLost` (the TV noise setting): true only for a frame with no usable sync, the one a
 * real television showed as noise. A ZX81 running a program in FAST mode holds VSYNC on (the BREAK
 * check's IN from $FE, with no OUT after it); a ZX80 sends no sync while it computes. Either way the
 * core's TV ends the frame with its vertical flywheel, and the picture is one flat level.
 */

/** K mode: SHIFT+F is FAST */
function fast(s: Zx81TestSession): void {
  s.typeChords([0, 8], [30]);
  s.runFrames(30);
}

/** 10 GOTO 10, RUN: a program that never stops */
function runForever(s: Zx81TestSession): void {
  s.typeKeys("10G10\n", { settle: 30 });
  s.typeKeys("R\n", { settle: 60 });
}

describe("isVideoSignalLost", () => {
  it("is false in SLOW mode, at the prompt and with a program running", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    expect(s.machine.isVideoSignalLost()).toBe(false);
    runForever(s);
    expect(s.machine.isVideoSignalLost()).toBe(false);
  });

  it("is false in FAST mode while the ROM waits for a key: it draws the picture then", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    fast(s);
    expect(s.machine.isVideoSignalLost()).toBe(false);
  });

  it("is true in FAST mode while a program runs", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    fast(s);
    runForever(s);
    expect(s.wasm.zx8081GetLastFrameLines()).toBe(390);
    expect(s.machine.isVideoSignalLost()).toBe(true);
  });

  it("is true on an NTSC machine too, whose TV gives up after 328 lines", async () => {
    const s = await createZx81Session({ model: "zx81-16k-us" });
    s.bootToBasic();
    fast(s);
    runForever(s);
    expect(s.wasm.zx8081GetLastFrameLines()).toBe(328);
    expect(s.machine.isVideoSignalLost()).toBe(true);
  });

  it("is true for a ZX80 while it computes", async () => {
    const s = await createZx81Session({ machineId: "zx80", model: "zx80-16k" });
    s.bootToBasic();
    expect(s.machine.isVideoSignalLost()).toBe(false);
    runForever(s);
    expect(s.machine.isVideoSignalLost()).toBe(true);
  });

  it("is false while SAVE draws its stripes: a real TV showed those", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- K mode: S is SAVE; SHIFT+P the quote
    s.typeKeys('S"A"\n', { settle: 0 });
    let sawStripes = false;
    for (let f = 0; f < 100; f++) {
      s.runFrames(1);
      const pixels = s.machine.getPixelBuffer();
      const flat = pixels.every((p) => p === pixels[0]);
      if (!flat) {
        sawStripes = true;
        expect(s.machine.isVideoSignalLost()).toBe(false);
      }
    }
    expect(sawStripes).toBe(true);
  });
});
