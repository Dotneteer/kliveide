import { describe, expect, it } from "vitest";

import {
  buildTvcCasFile,
  buildTvcTapeProgram,
  parseTvcCasFile,
  TvcCasFileError,
  tvcSavedFileOf,
  tvcTapeNameOf,
  tvcTapeProgramTacts
} from "@emu/machines/tvc/TvcCasFile";

/*
 * TVC `.cas` files (`.plans/VIDEOTON_TVC_PLAN.md` §9; the format is documented in
 * `_input/videoton-tvc/rtvc/info/tvc.md`). The core's side - playing and recording - is in
 * `test/tvc-hw/tape.test.ts`.
 */

const PROGRAM = Uint8Array.from([0x08, 0x0a, 0x00, 0xdd, 0x20, 0x34, 0x32, 0xff, 0x00]);

/** The bytes of each block a tape program writes: its BYTE ops between two pilots */
function blocksOf(program: Uint32Array): Uint8Array {
  const out: number[] = [];
  let block: number[] | undefined;
  for (const op of program) {
    if (op >>> 30 === 2) {
      block ??= [];
      block.push(op & 0xff);
    } else if (block) {
      out.push(block.length & 0xff, block.length >> 8, ...block);
      block = undefined;
    }
  }
  return Uint8Array.from(out);
}

describe("TVC .cas files", () => {
  it("writes and reads the container: identifier, record counts, type, length, autostart", () => {
    const cas = buildTvcCasFile(PROGRAM, 0x01, true, 0x19ef);
    expect(cas.length).toBe(144 + 9);
    expect(cas[0]).toBe(0x11);
    // --- 153 bytes: one whole 128-byte record and 25 more
    expect([cas[2], cas[3], cas[4], cas[5]]).toEqual([1, 0, 25, 0]);
    expect([cas[0x81], cas[0x82], cas[0x83], cas[0x84], cas[0x87], cas[0x88]]).toEqual([0x01, 9, 0, 0xff, 0xef, 0x19]);
    const tape = parseTvcCasFile(cas, "C:\\games\\hello world.cas");
    expect(tape.name).toBe("HELLO WORLD");
    expect(tape.fileType).toBe(1);
    expect(tape.autostart).toBe(true);
    expect(Array.from(tape.payload)).toEqual(Array.from(PROGRAM));
  });

  it("refuses what is not a .cas", () => {
    expect(() => parseTvcCasFile(Uint8Array.from([0x10, 0, 0]), "x.cas")).toThrow(TvcCasFileError);
    expect(() => parseTvcCasFile(Uint8Array.from([0x11, 0, 0]), "x.cas")).toThrow(TvcCasFileError);
  });

  it("names a tape by its file name: the stem, upper case, at most 16 characters", () => {
    expect(tvcTapeNameOf("/a/b/Very long program name.cas")).toBe("VERY LONG PROGRA");
  });

  it("writes a header and a data block whose bytes and CRCs the SAVE decoder accepts", () => {
    // --- The tape program's own blocks read back as a recording: the same file comes out
    const program = buildTvcTapeProgram("T", 0x01, false, PROGRAM);
    const saved = tvcSavedFileOf(blocksOf(program));
    expect(saved?.name).toBe("T");
    expect(Array.from(saved!.payload)).toEqual(Array.from(PROGRAM));
    expect(saved!.cas.length).toBe(153);
  });

  it("splits a payload into 256-byte sectors, the last one partial", () => {
    const payload = Uint8Array.from({ length: 600 }, (_, i) => i & 0xff);
    const saved = tvcSavedFileOf(blocksOf(buildTvcTapeProgram("BIG", 0x11, true, payload)));
    expect(Array.from(saved!.payload)).toEqual(Array.from(payload));
    expect(saved!.autostart).toBe(true);
  });

  it("rejects a recording with a broken CRC", () => {
    const blocks = blocksOf(buildTvcTapeProgram("T", 0x01, false, PROGRAM));
    blocks[blocks.length - 6] ^= 0x01;
    expect(tvcSavedFileOf(blocks)).toBeUndefined();
  });

  it("plays for about the time the signal takes: silence, pilots, and 8 cycles a byte", () => {
    const tacts = tvcTapeProgramTacts(buildTvcTapeProgram("T", 0x01, false, PROGRAM));
    // --- 5 nominal seconds of silence (2.5 s), 15,370 pilot cycles of 1,276 T (6.3 s), the bytes
    expect(tacts / 3_125_000).toBeGreaterThan(8);
    expect(tacts / 3_125_000).toBeLessThan(9.5);
  });
});
