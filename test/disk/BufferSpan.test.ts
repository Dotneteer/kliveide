import "mocha";
import { expect } from "expect";
import { BufferSpan } from "@emu/machines/disk/BufferSpan";

describe("BufferSpan", () => {
  it("constructor works", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    expect(bs.buffer).toEqual(buffer);
    expect(bs.startOffset).toEqual(10);
    expect(bs.length).toEqual(20);

    for (let i = 0; i < bs.length; i++) {
      expect(bs.get(i)).toEqual(0);
    }
  });

  it("get fails on out-of-range index", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    expect(() => bs.get(-1)).toThrowError("Index out of range");
    expect(() => bs.get(20)).toThrowError("Index out of range");
  });

  it("set works #1", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length; i++) {
      bs.set(i, i);
    }

    for (let i = 0; i < bs.length; i++) {
      expect(bs.get(i)).toEqual(i);
    }
  });

  it("set fails on out-of-range index", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    expect(() => bs.set(-1, 0)).toThrowError("Index out of range");
    expect(() => bs.set(20, 0)).toThrowError("Index out of range");
  });

  it("getBit works #1", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length; i++) {
      bs.set(i, 0xff);
    }

    for (let i = 0; i < bs.length * 8; i++) {
      expect(bs.getBit(i)).toEqual(true);
    }
  });

  it("getBit works #2", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length; i++) {
      bs.set(i, 0x00);
    }

    for (let i = 0; i < bs.length * 8; i++) {
      expect(bs.getBit(i)).toEqual(false);
    }
  });

  it("getBit fails on out-of-range index", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    expect(() => bs.getBit(-1)).toThrowError("Index out of range");
    expect(() => bs.getBit(20 * 8)).toThrowError("Index out of range");
  });

  it("setBit works #1", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length * 8; i++) {
      bs.setBit(i, true);
    }

    for (let i = 0; i < bs.length; i++) {
      expect(bs.get(i)).toEqual(0xff);
    }
  });

  it("setBit works #2", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length * 8; i++) {
      bs.setBit(i, false);
    }

    for (let i = 0; i < bs.length; i++) {
      expect(bs.get(i)).toEqual(0x00);
    }
  });

  it("testBit works #1", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length * 8; i++) {
      bs.setBit(i, true);
    }

    for (let i = 0; i < bs.length * 8; i++) {
      expect(bs.testBit(i)).toEqual(true);
    }
  });

  it("testBit works #2", () => {
    const buffer = new Uint8Array(100);
    const bs = new BufferSpan(buffer, 10, 20);

    for (let i = 0; i < bs.length * 8; i++) {
      bs.setBit(i, false);
    }

    for (let i = 0; i < bs.length * 8; i++) {
      expect(bs.testBit(i)).toEqual(false);
    }
  });
});
