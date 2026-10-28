import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createTvcSession, type TvcTestSession } from "../harness/tvc";
import { writeShotIfAsked } from "./bare";

/*
 * Booting BASIC 1.2 on the TVC 64K (`.plans/VIDEOTON_TVC_PLAN.md` Phase 2): the ROM tests the RAM,
 * shows the VIDEOTON sign-on, takes a key, and prints its banner and `ok`. The picture hash was
 * recorded after the picture was checked by eye ("TV COMPUTER BASIC 1.2", "Copyright 1985
 * VIDEOTON", "42255 bytes free", "ok" and the block cursor, green on black).
 */

const BOOT_PICTURE_SHA1 = "3cc0f0be284464ae046ce7154375f14ff6cabc24";

/** The colour of a picture pixel (0xAABBGGRR) */
const pixelAt = (s: TvcTestSession, x: number, y: number) => s.screenPixels()[y * 560 + x];

describe("TVC 64K boot", () => {
  it("programs the CRTC with the ROM's values (TVC_VIDEO_GENERATION.md Part 3)", async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    expect(s.crtc().registers.slice(0, 16)).toEqual([99, 64, 75, 0x32, 77, 2, 60, 66, 0, 3, 3, 3, 0, 0, 0x0e, 0xff]);
    // --- 100 characters x 314 lines, 2 T a character: 62,800 T a frame
    expect(s.wasm.tvcGetTactsInCurrentFrame()).toBe(62_800);
  });

  it("boots to BASIC's banner and ok, the picture checked by eye", async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    await writeShotIfAsked(s, "boot");
    const pixels = s.screenPixels();
    const hash = createHash("sha1").update(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)).digest("hex");
    // --- Black paper and border, and the banner in bright green (BASIC's default four-colour palette)
    expect(pixelAt(s, 300, 280).toString(16)).toBe("ff000000");
    const bannerRow = Array.from(pixels.subarray(56 * 560, 57 * 560));
    expect(bannerRow.some((p) => p === 0xff00ff00)).toBe(true);
    expect(hash).toBe(BOOT_PICTURE_SHA1);
  });

  it("runs frames of exactly 62,800 T once BASIC runs", async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    const before = s.wasm.tvcGetHalfClock();
    const frames = s.wasm.tvcGetFrames();
    s.runFrames(10);
    expect(s.wasm.tvcGetFrames() - frames).toBe(10);
    // --- The half-T clock advanced 10 frames, give or take the last instruction's overrun
    const halves = (s.wasm.tvcGetHalfClock() - before) >>> 0;
    expect(Math.abs(halves - 10 * 2 * 62_800)).toBeLessThan(2 * 30);
  });
});
