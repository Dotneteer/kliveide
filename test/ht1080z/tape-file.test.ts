import { describe, expect, it } from "vitest";

import {
  basToBasicTape,
  cmdToSystemTape,
  ht1080zSavedFileName,
  isHt1080zTapeFileName,
  parseHt1080zTapeFile,
  Ht1080zTapeFileError
} from "@emu/machines/ht1080z/Ht1080zTapeFile";

/*
 * The HT-1080Z tape files (`Ht1080zTapeFile.ts`, `.plans/HT1080Z_PLAN.md` §9): `.cas` recognition,
 * `.cmd` and `.bas` turned into the tapes the ROM would have written. Loading them on the machine is
 * `test/ht1080z-hw/tape.test.ts`.
 */

const leader = (n = 255) => new Array(n).fill(0);

describe("HT-1080Z tape files", () => {
  it("knows its extensions", () => {
    expect(["a.cas", "B.CMD", "c.bas"].map(isHt1080zTapeFileName)).toEqual([true, true, true]);
    expect(["a.p", "b.tzx", "cas", undefined].map(isHt1080zTapeFileName)).toEqual([false, false, false, false]);
  });

  it("reads a BASIC .cas: its kind and one-letter name", () => {
    const cas = new Uint8Array([...leader(), 0xa5, 0xd3, 0xd3, 0xd3, 0x41, 0x00, 0x00]);
    expect(parseHt1080zTapeFile(cas, "x.cas")).toMatchObject({ source: "cas", kind: "basic", name: "A" });
  });

  it("reads a SYSTEM .cas whose sync is not on a byte boundary", () => {
    // --- The whole stream shifted right by 3 bits, as a tape copied from audio can be
    const bytes = [...leader(), 0xa5, 0x55, ...Array.from("GAME  ").map((c) => c.charCodeAt(0)), 0x78, 0, 0x70, 0];
    const shifted = new Uint8Array(bytes.length + 1);
    for (let i = 0; i < bytes.length; i++) {
      shifted[i] |= bytes[i] >> 3;
      shifted[i + 1] |= (bytes[i] << 5) & 0xff;
    }
    expect(parseHt1080zTapeFile(shifted, "g.cas")).toMatchObject({ kind: "system", name: "GAME" });
  });

  it("refuses a 1500-baud (Model III) .cas and a file without a 500-baud header", () => {
    const high = new Uint8Array([0x55, 0x55, 0x55, 0x55, 0x7f, 0x55, 0x01]);
    expect(() => parseHt1080zTapeFile(high, "m3.cas")).toThrow(/1500-baud/);
    expect(() => parseHt1080zTapeFile(new Uint8Array([1, 2, 3, 4]), "junk.cas")).toThrow(Ht1080zTapeFileError);
  });

  it("turns a .cmd into a SYSTEM tape: name, 3Ch blocks of at most 256 with their checksums, 78h entry", () => {
    const data = Array.from({ length: 300 }, (_, i) => i & 0xff);
    // --- One 300-byte load block at 6000h (length byte 300 + 2 - 256 = 46 is not <= 2, so it is
    // --- written as two records here, as a .cmd must), then the transfer address 6000h
    const cmd = new Uint8Array([
      0x01, 0x02, 0x00, 0x60, ...data.slice(0, 256),
      0x01, 46, 0x00, 0x61, ...data.slice(256),
      0x1f, 0x03, 0x43, 0x50, 0x52,
      0x02, 0x02, 0x00, 0x60
    ]);
    const tape = cmdToSystemTape(cmd, "PROG");
    expect(Array.from(tape.slice(255, 263))).toEqual([0xa5, 0x55, 0x50, 0x52, 0x4f, 0x47, 0x20, 0x20]);
    const first = 263;
    expect(Array.from(tape.slice(first, first + 4))).toEqual([0x3c, 0x00, 0x00, 0x60]);
    const sum = (0x00 + 0x60 + data.slice(0, 256).reduce((a, b) => a + b, 0)) & 0xff;
    expect(tape[first + 4 + 256]).toBe(sum);
    const second = first + 4 + 256 + 1;
    expect(Array.from(tape.slice(second, second + 4))).toEqual([0x3c, 44, 0x00, 0x61]);
    expect(Array.from(tape.slice(-3))).toEqual([0x78, 0x00, 0x60]);
  });

  it("refuses a .cmd without a transfer address or without code", () => {
    expect(() => cmdToSystemTape(new Uint8Array([0x01, 0x03, 0x00, 0x70, 0xc9]), "X")).toThrow(/transfer address/);
    expect(() => cmdToSystemTape(new Uint8Array([0x02, 0x02, 0x00, 0x70]), "X")).toThrow(/no load blocks/);
  });

  it("turns a tokenised .bas into a CLOAD tape, named after the file, ending in a 00 00 link", () => {
    const bas = new Uint8Array([0xff, 0xf2, 0x42, 0x0a, 0x00, 0xb2, 0x20, 0x34, 0x32, 0x00]);
    const file = parseHt1080zTapeFile(bas, "/somewhere/quiz.bas");
    expect(file).toMatchObject({ source: "bas", kind: "basic", name: "Q" });
    expect(Array.from(file.tapeBytes.slice(255, 260))).toEqual([0xa5, 0xd3, 0xd3, 0xd3, 0x51]);
    expect(Array.from(file.tapeBytes.slice(-2))).toEqual([0, 0]);
    expect(() => basToBasicTape(new Uint8Array([0x0a, 0x00, 0x00]), "Q")).toThrow(/not tokenised/);
  });

  it("names a saved tape after the program on it", () => {
    expect(ht1080zSavedFileName(new Uint8Array([...leader(), 0xa5, 0xd3, 0xd3, 0xd3, 0x41]))).toBe("A.cas");
    expect(ht1080zSavedFileName(new Uint8Array([...leader(), 0xa5, 0x55, 0x47, 0x41, 0x4d, 0x45, 0x20, 0x20]))).toBe(
      "GAME.cas"
    );
    expect(ht1080zSavedFileName(new Uint8Array([1, 2, 3]))).toBe("ht1080z-save.cas");
  });
});
