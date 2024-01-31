import "mocha";
import { expect } from "expect";
import { decompressZ80DataBlock } from "@renderer/appIde/utils/compression/z80-file-compression";

describe(".z80 file data compression", () => {
  it("Data compression without end marker #1", () => {
    // --- Arrange
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

    // --- Act
    const decomp = decompressZ80DataBlock(data);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
  });

  it("Data compression without end marker #2", () => {
    // --- Arrange
    const data = new Uint8Array([0xed, 0x01, 0xed, 0x03]);

    // --- Act
    const decomp = decompressZ80DataBlock(data);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0xed, 0x01, 0xed, 0x03]));
  });

  it("Data compression without end marker #3", () => {
    // --- Arrange
    const data = new Uint8Array([0xed, 0xed, 0x03, 0x1a]);

    // --- Act
    const decomp = decompressZ80DataBlock(data);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x1a, 0x1a, 0x1a]));
  });

  it("Data compression without end marker #4", () => {
    // --- Arrange
    const data = new Uint8Array([0x01, 0x02, 0xed, 0xed, 0x03, 0x1a]);

    // --- Act
    const decomp = decompressZ80DataBlock(data);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x01, 0x02, 0x1a, 0x1a, 0x1a]));
  });

  it("Data compression without end marker #5", () => {
    // --- Arrange
    const data = new Uint8Array([0x01, 0x02, 0xed, 0xed, 0x03, 0x1a, 0xaa, 0xbb]);

    // --- Act
    const decomp = decompressZ80DataBlock(data);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x01, 0x02, 0x1a, 0x1a, 0x1a, 0xaa, 0xbb]));
  });

  it("Data compression without end marker #6", () => {
    // --- Arrange
    const data = new Uint8Array([0x01, 0xed, 0xed, 0x04, 0x3c, 0x02, 0xed, 0xed, 0x03, 0x1a, 0xaa, 0xbb]);

    // --- Act
    const decomp = decompressZ80DataBlock(data);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x01, 0x3c, 0x3c, 0x3c, 0x3c, 0x02, 0x1a, 0x1a, 0x1a, 0xaa, 0xbb]));
  });

  it("Data compression with end marker #1", () => {
    // --- Arrange
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0xed, 0xed, 0x00]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
  });

  it("Data compression with end marker #2", () => {
    // --- Arrange
    const data = new Uint8Array([0x00, 0x01, 0x00, 0xed, 0xed, 0x00, 0x03, 0x04]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x00, 0x01]));
  });

  it("Data compression with end marker #3", () => {
    // --- Arrange
    const data = new Uint8Array([0xed, 0x01, 0xed, 0x03, 0x00, 0xed, 0xed, 0x00]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0xed, 0x01, 0xed, 0x03]));
  });

  it("Data compression with end marker #4", () => {
    // --- Arrange
    const data = new Uint8Array([0xed, 0xed, 0x03, 0x1a, 0x00, 0xed, 0xed, 0x00]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x1a, 0x1a, 0x1a]));
  });

  it("Data compression with end marker #5", () => {
    // --- Arrange
    const data = new Uint8Array([0x01, 0x02, 0xed, 0xed, 0x03, 0x1a, 0x00, 0xed, 0xed, 0x00]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x01, 0x02, 0x1a, 0x1a, 0x1a]));
  });

  it("Data compression with end marker #6", () => {
    // --- Arrange
    const data = new Uint8Array([0x01, 0x02, 0xed, 0xed, 0x03, 0x1a, 0xaa, 0xbb, 0x00, 0xed, 0xed, 0x00]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x01, 0x02, 0x1a, 0x1a, 0x1a, 0xaa, 0xbb]));
  });

  it("Data compression with end marker #7", () => {
    // --- Arrange
    const data = new Uint8Array([0x01, 0xed, 0xed, 0x04, 0x3c, 0x02, 0xed, 0xed, 0x03, 0x1a, 0xaa, 0xbb, 0x00, 0xed, 0xed, 0x00]);

    // --- Act
    const decomp = decompressZ80DataBlock(data, true);
    // --- Assert

    expect(decomp).toStrictEqual(new Uint8Array([0x01, 0x3c, 0x3c, 0x3c, 0x3c, 0x02, 0x1a, 0x1a, 0x1a, 0xaa, 0xbb]));
  });
});