import { describe, expect, it } from "vitest";
import { toFlag, toHex, toHex8, toHex16 } from "../../src/renderer/src/components/ide/z80CpuPanelFormat";

describe("Z80 CPU panel formatting", () => {
  it("formats byte values as uppercase padded hexadecimal", () => {
    expect(toHex8(0x00)).toBe("00");
    expect(toHex8(0x0a)).toBe("0A");
    expect(toHex8(0xff)).toBe("FF");
  });

  it("formats word values as uppercase padded hexadecimal", () => {
    expect(toHex16(0x0000)).toBe("0000");
    expect(toHex16(0x00af)).toBe("00AF");
    expect(toHex16(0xffff)).toBe("FFFF");
  });

  it("masks values to the requested display width", () => {
    expect(toHex8(0x123)).toBe("23");
    expect(toHex16(0x1_2345)).toBe("2345");
    expect(toHex(0x123456, 6)).toBe("123456");
  });

  it("uses fixed-width placeholders for unavailable values", () => {
    expect(toHex8(undefined)).toBe("--");
    expect(toHex16(undefined)).toBe("----");
    expect(toHex(undefined, 6)).toBe("------");
  });

  it("extracts flag bits from numeric values", () => {
    expect(toFlag(0b1000_0000, 7)).toBe(true);
    expect(toFlag(0b1000_0000, 6)).toBe(false);
    expect(toFlag(0b0000_0001, 0)).toBe(true);
  });

  it("returns undefined flags for unavailable values", () => {
    expect(toFlag(undefined, 7)).toBeUndefined();
  });

  it("rejects invalid flag bit indexes", () => {
    expect(() => toFlag(0, -1)).toThrow(RangeError);
    expect(() => toFlag(0, 32)).toThrow(RangeError);
    expect(() => toFlag(0, 1.5)).toThrow(RangeError);
  });
});
