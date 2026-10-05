import { describe, it, expect } from "vitest";
import {
  formatZ88Ext24,
  z88Pb0Address,
  z88Pb1Address,
  z88Pb2Address,
  z88Pb3Address,
  z88SbfAddress,
  z88SbfSize
} from "@common/z88/z88ScreenPointers";
import { Z88UartTxLines } from "@emu/machines/z88/z88UartTx";

/*
 * Issue #1417: the Blink panel shows each LCD pointer register's raw value and the 24-bit address it
 * points at, as OZvm's debug view does. The expected values are those of the issue's OZvm screenshot.
 */
describe("Z88 LCD pointer registers decoded (issue #1417)", () => {
  it.each([
    ["SBF", z88SbfAddress, 0x0127, 0x24_3800],
    ["PB0", z88Pb0Address, 0x0434, 0x21_2800],
    ["PB1", z88Pb1Address, 0x000d, 0x03_1000],
    ["PB2", z88Pb2Address, 0x004d, 0x26_2000],
    ["PB3", z88Pb3Address, 0x0137, 0x26_3800]
  ])("%s %i points at %i", (_name, decode, value, ext24) => {
    const pointer = decode(value);
    expect(pointer.ext24).toBe(ext24);
    expect(pointer.bank).toBe(ext24 >>> 16);
    expect(pointer.offset).toBe(ext24 & 0x3fff);
  });

  it("formats a 24-bit address as OZvm prints it", () => {
    expect(formatZ88Ext24(0x24_3800)).toBe("243800h");
    expect(formatZ88Ext24(0x03_1000)).toBe("031000h");
    expect(formatZ88Ext24(0)).toBe("000000h");
  });

  it("the Screen Base File runs from its page offset to the end of the bank", () => {
    expect(z88SbfSize(0x0127)).toBe(0x0800); // $24:3800, 2K: 8 rows
    expect(z88SbfSize(0x010f)).toBe(0x0800); // $21:3800, OZ 5's standard file
    expect(z88SbfSize((0x20 << 3) | (0x2000 >> 11))).toBe(0x2000); // $20:2000, 8K: 32 rows
    expect(z88SbfSize(0x20 << 3)).toBe(0x4000); // $20:0000, the whole bank
    expect(z88SbfSize(0)).toBe(0x0800); // unset: the standard 2K, as OZvm
  });
});

describe("Z88 serial TXD output as lines", () => {
  it("ends a line at CR, LF or CR LF, and keeps the unfinished one", () => {
    const lines = new Z88UartTxLines();
    const bytes = (text: string) => [...text].map((c) => c.charCodeAt(0));
    expect(lines.push(bytes("one\r\ntwo\nthr"))).toEqual(["one", "two"]);
    expect(lines.pending).toBe("thr");
    expect(lines.push(bytes("ee\r"))).toEqual(["three"]);
    // --- The LF after a CR that ended a line is the second half of a CR LF pair, not an empty line
    expect(lines.push(bytes("\nfour\r"))).toEqual(["four"]);
  });

  it("drops other control bytes, shows bytes above $7E in hex, and breaks long lines", () => {
    const lines = new Z88UartTxLines(4);
    expect(lines.push([0x41, 0x07, 0xa3, 0x42])).toEqual(["A\\xa3"]);
    expect(lines.pending).toBe("B");
  });
});
