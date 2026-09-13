import { describe, it, expect } from "vitest";
import { readTapeFile } from "@renderer/utils/tape-utils";
import { SPECTRUM_48_COLORS, SCR_FILE_LENGTH } from "@emu/machines/spectrum-colors";
import { fileTypeRegistry } from "@renderer/registry";
import { Z80_VIEWER } from "@state/common-ids";

/**
 * Stage 4 — the document panels.
 *
 * These pin the parts of Stage 4 that are logic rather than layout: a parser that stopped throwing
 * away its own error message, a palette whose byte order was documented backwards for years, and a
 * viewer that spent six months unreachable.
 *
 * See `.plans/UI_MODERNIZATION_BATCH_2_PLAN.md` Phases 30, 33 and 37.
 */

describe("readTapeFile", () => {
  /*
   * Both readers return a message saying why they rejected the bytes, and both were discarded — the
   * viewer could only ever say "Invalid tape file format".
   */
  it("reports why a file is not a tape, instead of only that it is not one", () => {
    const result = readTapeFile(new Uint8Array([1, 2, 3, 4]));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(typeof result.error).toBe("string");
  });

  /*
   * Zero bytes is not an error — it reads as a tape with no blocks.
   *
   * Worth pinning as behaviour rather than assuming either way: the readers accept an empty stream
   * and return an empty block list, so the viewer draws an empty tape rather than a failure. That
   * is defensible, and it is *not* what the error path above covers, which is what makes it worth
   * a test of its own: a future "reject empty files" change should be a deliberate one.
   */
  it("reads empty contents as a tape with no blocks, not as a failure", () => {
    const result = readTapeFile(new Uint8Array(0));

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });
});

describe("SPECTRUM_48_COLORS", () => {
  /*
   * The table was headed "ARGB colors" in both of its copies, and the word was the error — not the
   * sixteen labels under it.
   *
   * These values reach the screen as the bytes of a `Uint32Array` handed to `ImageData`, which is
   * RGBA byte order, so on a little-endian host the low byte of each word is **red**. Written as a
   * word that is ABGR. Asserting it on the entries whose channels differ is what makes the claim
   * checkable: a grey or a white would pass under either reading.
   */
  const channels = (abgr: number) => ({
    r: abgr & 0xff,
    g: (abgr >> 8) & 0xff,
    b: (abgr >> 16) & 0xff,
    a: (abgr >>> 24) & 0xff
  });

  it("is ABGR, so the low byte is red", () => {
    // --- Index 2 is labelled Red: red full, green and blue clear.
    expect(channels(SPECTRUM_48_COLORS[2])).toEqual({ r: 0xaa, g: 0x00, b: 0x00, a: 0xff });
    // --- Index 1 is labelled Blue: the mirror image. Under an ARGB reading these two would swap.
    expect(channels(SPECTRUM_48_COLORS[1])).toEqual({ r: 0x00, g: 0x00, b: 0xaa, a: 0xff });
  });

  it("orders its sixteen entries as the Spectrum does", () => {
    expect(SPECTRUM_48_COLORS).toHaveLength(16);
    // --- Cyan is green+blue, yellow is red+green. The two were the pair the audit misread.
    expect(channels(SPECTRUM_48_COLORS[5])).toEqual({ r: 0x00, g: 0xaa, b: 0xaa, a: 0xff });
    expect(channels(SPECTRUM_48_COLORS[6])).toEqual({ r: 0xaa, g: 0xaa, b: 0x00, a: 0xff });
    // --- Bright black is still black.
    expect(SPECTRUM_48_COLORS[8]).toBe(SPECTRUM_48_COLORS[0]);
  });

  it("keeps the .SCR length beside the palette it is read with", () => {
    // --- 6144 bytes of pixel data plus 768 of attributes.
    expect(SCR_FILE_LENGTH).toBe(0x1800 + 0x300);
  });
});

describe("the .z80 file type route", () => {
  /*
   * `Z80_VIEWER` was registered as a document renderer while the `fileTypeRegistry` entry that
   * routes a file to it stayed commented out, so 913 lines of working parser were unreachable for
   * six months. Nothing detected that, because both halves type-check on their own.
   */
  it("routes .z80 files to the Z80 snapshot viewer", () => {
    const entry = fileTypeRegistry.find(
      (item) => item.matchType === "ends" && item.pattern === ".z80"
    );

    expect(entry, ".z80 has no fileTypeRegistry entry — the Z80 viewer is unreachable").toBeTruthy();
    expect(entry!.editor).toBe(Z80_VIEWER);
    expect(entry!.isBinary).toBe(true);
  });

  it("does not tint the .z80 tab icon", () => {
    // --- The entry originally carried `iconFill: "--console-ansi-bright-magenta"`, which
    // --- `doc-icon-neutrality.test.ts` forbids. Restoring the entry verbatim would have failed it.
    const entry = fileTypeRegistry.find(
      (item) => item.matchType === "ends" && item.pattern === ".z80"
    );
    expect(entry!.iconFill).toBeUndefined();
  });
});
