import { describe, expect, it } from "vitest";
import {
  createSavedTapeTzx,
  createTzxHeader,
  createTzxStandardSpeedBlock
} from "@emu/tape/tape-save";
import { parseTapeFile } from "@emu/tape/tape-parser";

describe("tape save serialization", () => {
  it("creates the TZX 1.20 header used by the original saver", () => {
    expect([...createTzxHeader()]).toEqual([
      0x5a,
      0x58,
      0x54,
      0x61,
      0x70,
      0x65,
      0x21,
      0x1a,
      0x01,
      0x14
    ]);
  });

  it("creates a TZX standard speed data block", () => {
    const block = createTzxStandardSpeedBlock(new Uint8Array([0x00, 0x11, 0x22]), 1500);

    expect([...block]).toEqual([0x10, 0xdc, 0x05, 0x03, 0x00, 0x00, 0x11, 0x22]);
  });

  it("roundtrips saved header and data blocks through the tape parser", () => {
    const header = new Uint8Array([
      0x00,
      0x03,
      0x44,
      0x45,
      0x4d,
      0x4f,
      0x20,
      0x20,
      0x20,
      0x20,
      0x20,
      0x20,
      0x00,
      0x40,
      0x10,
      0x00,
      0x00,
      0x80,
      0x8a
    ]);
    const data = new Uint8Array([0xff, 0x01, 0x02, 0x03, 0xff]);

    const parsed = parseTapeFile(createSavedTapeTzx(header, data));

    expect(parsed.format).toBe("tzx");
    expect(parsed.warnings).toEqual([]);
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0].pauseAfter).toBe(1000);
    expect(parsed.blocks[1].pauseAfter).toBe(1000);
    expect(parsed.blocks[0].data).toEqual(header);
    expect(parsed.blocks[1].data).toEqual(data);
  });

  it("rejects standard blocks that do not fit the TZX length field", () => {
    expect(() => createTzxStandardSpeedBlock(new Uint8Array(0x10000))).toThrow(
      /Invalid TZX data length/
    );
  });
});
